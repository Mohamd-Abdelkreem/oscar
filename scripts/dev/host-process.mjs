import { spawn } from "node:child_process";

export function command(executable, args, options = {}) {
  const windowsPnpm = process.platform === "win32" && executable === "pnpm";
  if (windowsPnpm && args.some((arg) => !/^[\w@/:.=-]+$/.test(arg)))
    throw new Error("Unsupported pnpm argument.");
  return new Promise((resolve, reject) => {
    const child = spawn(
      windowsPnpm ? "cmd.exe" : executable,
      windowsPnpm ? ["/d", "/s", "/c", `pnpm ${args.join(" ")}`] : args,
      {
        cwd: options.cwd,
        env: options.env ?? process.env,
        windowsHide: true,
        stdio: [
          "ignore",
          options.capture ? "pipe" : "inherit",
          options.quiet ? "pipe" : "inherit",
        ],
      },
    );
    const chunks = [];
    let bytes = 0;
    child.stdout?.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > 33554432) child.kill("SIGTERM");
      else chunks.push(chunk);
    });
    child.stderr?.on("data", () => {});
    const timer = setTimeout(
      () => child.kill("SIGTERM"),
      options.timeout ?? 600000,
    );
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve(Buffer.concat(chunks))
        : reject(new Error(`${executable} exited ${code}.`));
    });
  });
}
