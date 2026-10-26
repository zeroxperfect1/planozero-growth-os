import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "planozero-setup-test-"));
const port = 15175;
const url = `http://127.0.0.1:${port}`;
let child;

before(async () => {
  child = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      VERCEL: "",
      SETUP_TOKEN: "",
      PORT: String(port),
      DATABASE_URL: "",
      DB_PATH: join(dir, "setup.sqlite"),
    },
    stdio: "pipe",
  });
  let output = "";
  child.stderr.on("data", (d) => (output += d));
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Setup-token test server did not start: " + output);
});

after(async () => {
  child?.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 150));
  rmSync(dir, { recursive: true, force: true });
});

test("production setup cannot be claimed without a strong SETUP_TOKEN", async () => {
  const session = await fetch(`${url}/api/session`).then((r) => r.json());
  assert.equal(session.configured, false);
  assert.equal(session.setupProtected, true);
  const response = await fetch(`${url}/api/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Dirección",
      email: "director@planozero.cl",
      password: "secure-test-password-2026",
    }),
  });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /SETUP_TOKEN.*32 caracteres/);
});
