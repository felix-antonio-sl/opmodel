#!/usr/bin/env bun
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

const ROOT = "/home/felix/projects/opmodel";
const OUT_DIR = process.argv[2] ?? join(ROOT, "artifacts/visual-audit/joint-sandbox");
const FIXTURE_FILTER = process.argv[3] ?? "";
const DEV_PORT = 4174;
const DEBUG_PORT = 9223;
const DEV_URL = `http://127.0.0.1:${DEV_PORT}/#/joint-sandbox`;
const DEBUG_URL = `http://127.0.0.1:${DEBUG_PORT}`;

type CdpResponse = { id?: number; result?: any; error?: any; method?: string; params?: any };

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-$/g, "") || "item";
}

async function waitForHttp(url: string, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await wait(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function spawnLogged(command: string, args: string[], cwd = ROOT): ChildProcess {
  return spawn(command, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
    detached: true,
  });
}

function killTree(child: ChildProcess) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try { child.kill("SIGTERM"); } catch {}
  }
}

class CdpClient {
  private ws!: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: any) => void }>();

  async connect(webSocketUrl: string) {
    this.ws = new WebSocket(webSocketUrl);
    await new Promise<void>((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (event) => reject(event);
    });
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(String(event.data)) as CdpResponse;
      if (!msg.id) return;
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      if (msg.error) pending.reject(new Error(msg.error.message ?? JSON.stringify(msg.error)));
      else pending.resolve(msg.result);
    };
  }

  send(method: string, params: Record<string, unknown> = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise<any>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  close() {
    this.ws.close();
  }
}

async function getWebSocketUrl(): Promise<string> {
  const res = await fetch(`${DEBUG_URL}/json/list`);
  const targets = await res.json() as Array<{ type: string; webSocketDebuggerUrl: string }>;
  const page = targets.find((target) => target.type === "page");
  if (!page) throw new Error("No page target available for CDP");
  return page.webSocketDebuggerUrl;
}

async function waitFor(client: CdpClient, expression: string, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await client.send("Runtime.evaluate", { expression, returnByValue: true });
    if (result?.result?.value) return;
    await wait(100);
  }
  throw new Error(`Timed out waiting for condition: ${expression}`);
}

async function captureElement(client: CdpClient, selector: string, path: string) {
  const clipResult = await client.send("Runtime.evaluate", {
    expression: `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.max(1, r.width), height: Math.max(1, r.height) };
    })()`,
    returnByValue: true,
  });
  const clip = clipResult?.result?.value;
  if (!clip) throw new Error(`Could not find ${selector}`);
  const shot = await client.send("Page.captureScreenshot", {
    format: "png",
    clip: { ...clip, scale: 1 },
    captureBeyondViewport: true,
  });
  writeFileSync(path, Buffer.from(shot.data, "base64"));
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const dev = spawnLogged("bun", ["run", "--filter", "@opmodel/web", "preview", "--host", "127.0.0.1", "--port", String(DEV_PORT)]);
  const profileDir = `/tmp/opmodel-joint-sandbox-${Date.now()}`;
  rmSync(profileDir, { recursive: true, force: true });
  mkdirSync(profileDir, { recursive: true });
  const chromium = spawnLogged("chromium-browser", [
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ]);

  try {
    await waitForHttp(`http://127.0.0.1:${DEV_PORT}`);
    await waitForHttp(`${DEBUG_URL}/json/version`);

    const client = new CdpClient();
    await client.connect(await getWebSocketUrl());
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 1500,
      height: 950,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await client.send("Page.navigate", { url: DEV_URL });
    await waitFor(client, `(() => document.querySelectorAll("select").length >= 2)()`, 15000);

    let fixtureIds = await client.send("Runtime.evaluate", {
      expression: `(() => [...document.querySelectorAll("select")[0].options].map((o) => o.value))()`,
      returnByValue: true,
    });
    fixtureIds = fixtureIds.result.value as string[];
    if (FIXTURE_FILTER) fixtureIds = fixtureIds.filter((id: string) => id === FIXTURE_FILTER);
    if (fixtureIds.length === 0) throw new Error(`No fixtures matched filter: ${FIXTURE_FILTER}`);

    const summary: Array<{ fixture: string; opd: string; cells: number; issues: number; file: string }> = [];
    for (const fixtureId of fixtureIds) {
      await client.send("Runtime.evaluate", {
        expression: `(() => {
          const select = document.querySelectorAll("select")[0];
          select.value = ${JSON.stringify(fixtureId)};
          select.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        })()`,
        returnByValue: true,
      });
      await wait(400);
      const opdIdsResult = await client.send("Runtime.evaluate", {
        expression: `(() => [...document.querySelectorAll("select")[1].options].map((o) => o.value))()`,
        returnByValue: true,
      });
      const opdIds = opdIdsResult.result.value as string[];
      for (const opdId of opdIds) {
        await client.send("Runtime.evaluate", {
          expression: `(() => {
            const select = document.querySelectorAll("select")[1];
            select.value = ${JSON.stringify(opdId)};
            select.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          })()`,
          returnByValue: true,
        });
        await wait(500);
        const dir = join(OUT_DIR, `${slug(fixtureId)}__${slug(opdId)}`);
        mkdirSync(dir, { recursive: true });
        await captureElement(client, ".joint-paper svg", join(dir, "svg.png"));

        const digest = await client.send("Runtime.evaluate", {
          expression: `(() => {
            const cells = [...document.querySelectorAll(".joint-paper svg [model-id]")];
            return {
              cells: cells.length,
              verifierIssues: [...document.querySelectorAll("details ul li")].map((li) => li.textContent || ""),
              spec: document.querySelector("details pre")?.textContent || ""
            };
          })()`,
          returnByValue: true,
        });
        const data = digest.result.value;
        writeFileSync(join(dir, "spec.json"), data.spec);
        writeFileSync(join(dir, "verifier.json"), JSON.stringify(data.verifierIssues, null, 2));
        summary.push({ fixture: fixtureId, opd: opdId, cells: data.cells, issues: data.verifierIssues.length, file: join(dir, "svg.png") });
        console.log(`${fixtureId}/${opdId} cells=${data.cells} issues=${data.verifierIssues.length}`);
      }
    }

    writeFileSync(join(OUT_DIR, "_index.json"), JSON.stringify(summary, null, 2));
    client.close();
  } finally {
    killTree(dev);
    killTree(chromium);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
