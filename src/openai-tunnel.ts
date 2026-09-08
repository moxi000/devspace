import { spawn, type ChildProcess } from "node:child_process";
import type { ServerConfig } from "./config.js";

/** Start the official client in the foreground; the CLI owns its lifecycle. */
export async function startOpenAiTunnel(config: ServerConfig): Promise<ChildProcess> {
  const tunnel = config.openaiTunnel;
  if (!tunnel) {
    throw new Error("OpenAI tunnel is not configured.");
  }

  const host = config.host.includes(":") ? `[${config.host}]` : config.host;
  const child = spawn(tunnel.binary, [
    "run",
    "--control-plane.tunnel-id", tunnel.tunnelId,
    "--mcp.server-url", `http://${host}:${config.port}/mcp`,
    "--mcp.extra-headers", "X-DevSpace-Tunnel-Secret: env:DEVSPACE_TUNNEL_SECRET",
    "--health.listen-addr", "127.0.0.1:0",
  ], {
    env: {
      ...process.env,
      CONTROL_PLANE_API_KEY: tunnel.apiKey,
      DEVSPACE_TUNNEL_SECRET: tunnel.secret,
    },
    stdio: "inherit",
    shell: false,
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      child.removeListener("spawn", onSpawn);
      reject(error);
    };
    const onSpawn = () => {
      child.removeListener("error", onError);
      resolve();
    };
    child.once("error", onError);
    child.once("spawn", onSpawn);
  });
  return child;
}

/** Only signal the client instance started by this DevSpace process. */
export function stopOpenAiTunnel(child: ChildProcess): void {
  if (child.exitCode === null && child.signalCode === null && !child.killed) {
    child.kill("SIGTERM");
  }
}
