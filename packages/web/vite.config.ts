import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import type { Plugin } from "vite";

/** Dev-only plugin: persist bug reports to dev-data/test-bugs.json */
function bugCapturePlugin(): Plugin {
  const root = path.resolve(__dirname, "../..");
  const bugsFile = path.join(root, "dev-data", "test-bugs.json");

  function ensureDir() {
    const dir = path.dirname(bugsFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  function readBugs(): unknown[] {
    try { return JSON.parse(fs.readFileSync(bugsFile, "utf-8")); }
    catch { return []; }
  }

  function writeBugs(bugs: unknown[]) {
    ensureDir();
    fs.writeFileSync(bugsFile, JSON.stringify(bugs, null, 2), "utf-8");
  }

  return {
    name: "bug-capture",
    configureServer(server) {
      server.middlewares.use("/api/dev/bugs", (req, res) => {
        if (req.method === "GET") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(readBugs()));
          return;
        }
        if (req.method === "POST") {
          let body = "";
          req.on("data", (chunk: Buffer) => { body += chunk; });
          req.on("end", () => {
            const bug = JSON.parse(body);
            const bugs = readBugs();
            bugs.unshift(bug);
            writeBugs(bugs);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, id: bug.id }));
          });
          return;
        }
        if (req.method === "DELETE") {
          const id = req.url?.replace(/^\//, "");
          if (id) {
            const bugs = readBugs().filter((b: any) => b.id !== id);
            writeBugs(bugs);
          }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true }));
          return;
        }
        res.statusCode = 405;
        res.end();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), bugCapturePlugin()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) return "react-vendor";
          if (id.includes("@opmodel/core")) return "opmodel-core";
          if (id.includes("src/components/OpdCanvas") || id.includes("src/components/canvas/") || id.includes("src/lib/edge-router") || id.includes("src/lib/spatial-layout")) return "canvas";
        },
      },
    },
  },
});
