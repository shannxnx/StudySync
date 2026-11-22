import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { startGeminiFixture } from "./mock-gemini.mjs";

const reserve = net.createServer();
reserve.listen(Number(process.env.STUDYSYNC_TEST_PORT || 0), "127.0.0.1");
await once(reserve, "listening");
const port = reserve.address().port;
await new Promise((resolve) => reserve.close(resolve));
const service = await startGeminiFixture();
const env = { ...process.env, STUDYSYNC_TEST_PORT: String(port) };
const next = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--port",
    String(port),
    "--hostname",
    "127.0.0.1",
  ],
  {
    windowsHide: true,
    stdio: "inherit",
    env: {
      ...env,
      GEMINI_API_KEY: "local-fixture",
      GOOGLE_GEMINI_BASE_URL: "http://127.0.0.1:" + service.address().port,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
);
let runner;
function stop() {
  if (runner?.exitCode === null) runner.kill();
  if (next.exitCode === null) next.kill();
  service.closeAllConnections();
  service.close();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (next.exitCode !== null)
      throw new Error("The production test server stopped.");
    try {
      const res = await fetch("http://127.0.0.1:" + port);
      await res.arrayBuffer();
      ready = res.ok;
    } catch {}
    if (ready) break;
    await delay(200);
  }
  if (!ready) throw new Error("The production test server did not start.");
  runner = spawn(
    process.execPath,
    ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
    { windowsHide: true, stdio: "inherit", env },
  );
  const [code] = await once(runner, "exit");
  process.exitCode = code ?? 1;
} finally {
  stop();
}
