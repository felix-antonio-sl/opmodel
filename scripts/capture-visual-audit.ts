#!/usr/bin/env bun
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import {
  compileOplDocuments,
  parseOplDocuments,
  saveModel,
  type Model,
} from "../packages/core/src/index";
import { autoLayoutModel } from "../packages/web/src/lib/auto-layout";
import { buildVisualReport } from "../packages/web/src/lib/visual-report";

const ROOT = "/home/felix/projects/opmodel";
const FIXTURE_PATH = process.argv[2] ?? join(ROOT, "tests/stress-test-max-complexity.opl");
const OUT_DIR = process.argv[3] ?? join(ROOT, "artifacts/visual-audit/stress-test-max-complexity");
const PREVIEW_PORT = 4173;
const DEBUG_PORT = 9222;
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`;
const DEBUG_URL = `http://127.0.0.1:${DEBUG_PORT}`;

type CdpResponse = { id?: number; result?: any; error?: any; method?: string; params?: any };

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "opd";
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function buildModelFromOpl(path: string): Promise<{ model: Model; modelJson: string; report: ReturnType<typeof buildVisualReport> }> {
  const opl = readFileSync(path, "utf8");
  const parsed = parseOplDocuments(opl);
  if (!parsed.ok) throw new Error(parsed.error.message);
  const compiled = compileOplDocuments(parsed.value, { ignoreUnsupported: true });
  if (!compiled.ok) throw new Error(compiled.error.message);
  const laidOut = autoLayoutModel(compiled.value).model;
  const report = buildVisualReport(laidOut);
  return { model: laidOut, modelJson: saveModel(laidOut), report };
}

function spawnLogged(command: string, args: string[], cwd = ROOT): ChildProcess {
  const child = spawn(command, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });
  child.stdout?.on("data", () => {});
  child.stderr?.on("data", () => {});
  return child;
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
      if (msg.id) {
        const pending = this.pending.get(msg.id);
        if (!pending) return;
        this.pending.delete(msg.id);
        if (msg.error) pending.reject(new Error(msg.error.message ?? JSON.stringify(msg.error)));
        else pending.resolve(msg.result);
      }
    };
  }

  send(method: string, params: Record<string, unknown> = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise<any>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  async close() {
    this.ws.close();
  }
}

async function startPreview(): Promise<ChildProcess> {
  const child = spawnLogged("bun", ["run", "--filter", "@opmodel/web", "preview", "--host", "127.0.0.1", "--port", String(PREVIEW_PORT)]);
  await waitForHttp(PREVIEW_URL);
  return child;
}

async function startChromium(): Promise<ChildProcess> {
  const profileDir = `/tmp/opmodel-visual-audit-${Date.now()}`;
  rmSync(profileDir, { recursive: true, force: true });
  mkdirSync(profileDir, { recursive: true });
  const child = spawnLogged("chromium-browser", [
    "--headless",
    "--disable-gpu",
    "--no-sandbox",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ]);
  await waitForHttp(`${DEBUG_URL}/json/version`);
  return child;
}

async function getWebSocketUrl(): Promise<string> {
  const res = await fetch(`${DEBUG_URL}/json/list`);
  const data = await res.json() as Array<{ type: string; webSocketDebuggerUrl: string }>;
  const page = data.find((target) => target.type === "page");
  if (!page) throw new Error("No page target available for CDP");
  return page.webSocketDebuggerUrl;
}

async function navigate(client: CdpClient, url: string) {
  await client.send("Page.navigate", { url });
  await wait(800);
}

async function setModelInLocalStorage(client: CdpClient, modelJson: string) {
  const expr = `(() => {
    localStorage.setItem("opmodel:current", ${JSON.stringify(modelJson)});
    localStorage.setItem("opmodel:backups", JSON.stringify([{ id: "visual-audit", name: "Visual Audit", savedAt: new Date().toISOString(), json: ${JSON.stringify(modelJson)} }]));
    return true;
  })()`;
  await client.send("Runtime.evaluate", { expression: expr, awaitPromise: false, returnByValue: true });
}

async function clickOpd(client: CdpClient, opdName: string) {
  const expr = `(() => {
    const nodes = [...document.querySelectorAll('.opd-tree__node')];
    const node = nodes.find((el) => (el.textContent || '').includes(${JSON.stringify(opdName)}));
    if (!node) return false;
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  })()`;
  const result = await client.send("Runtime.evaluate", { expression: expr, returnByValue: true });
  if (!result?.result?.value) throw new Error(`Could not select OPD ${opdName}`);
  await wait(500);
}

async function boundingRect(client: CdpClient, selector: string) {
  const expr = `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.max(1, r.width), height: Math.max(1, r.height) };
  })()`;
  const result = await client.send("Runtime.evaluate", { expression: expr, returnByValue: true });
  return result?.result?.value as { x: number; y: number; width: number; height: number } | null;
}

async function captureClip(client: CdpClient, path: string, clip: { x: number; y: number; width: number; height: number }) {
  const result = await client.send("Page.captureScreenshot", {
    format: "png",
    clip: { ...clip, scale: 1 },
    captureBeyondViewport: true,
  });
  writeFileSync(path, Buffer.from(result.data, "base64"));
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const { model, modelJson, report } = await buildModelFromOpl(FIXTURE_PATH);
  writeFileSync(join(OUT_DIR, "model.opmodel"), modelJson);
  writeFileSync(join(OUT_DIR, "visual-report.json"), JSON.stringify(report, null, 2));

  const preview = await startPreview();
  const chromium = await startChromium();

  try {
    const wsUrl = await getWebSocketUrl();
    const client = new CdpClient();
    await client.connect(wsUrl);
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 1720,
      height: 1280,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await navigate(client, PREVIEW_URL);
    await setModelInLocalStorage(client, modelJson);
    await client.send("Page.reload", { ignoreCache: true });
    await wait(1200);

    const opds = [...model.opds.values()].map((opd) => opd.name);
    const shots: Array<{ opd: string; file: string }> = [];

    for (const opdName of opds) {
      await clickOpd(client, opdName);
      const clip = await boundingRect(client, ".opd-canvas");
      if (!clip) throw new Error(`Could not find .opd-canvas for ${opdName}`);
      const file = `${String(shots.length + 1).padStart(2, "0")}-${slug(opdName)}.png`;
      await captureClip(client, join(OUT_DIR, file), clip);
      shots.push({ opd: opdName, file });
    }

    writeFileSync(join(OUT_DIR, "screenshots.json"), JSON.stringify(shots, null, 2));
    await client.close();
  } finally {
    preview.kill("SIGTERM");
    chromium.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
