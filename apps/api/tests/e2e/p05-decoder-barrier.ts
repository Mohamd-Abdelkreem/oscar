import { readFile, readdir } from "node:fs/promises";
import type { DecoderObservation } from "../../src/infrastructure/files/image-decoder.js";

// A private Linux-only OS barrier pauses one actual owned decoder. It never
// replaces file parsing, decoding, persistence, cancellation or HTTP outcomes.
export class P05DecoderBarrier {
  private timer: ReturnType<typeof setInterval> | undefined;
  private deadline: ReturnType<typeof setTimeout> | undefined;
  private held: number | null = null;
  private closedSignal: "SIGKILL" | "OTHER" | null = null;
  private scanning = false;
  arm() {
    if (process.platform !== "linux" || this.timer || this.held !== null)
      throw new Error("P05_BARRIER_UNAVAILABLE");
    this.closedSignal = null;
    this.timer = setInterval(() => {
      void this.scan();
    }, 5);
    this.deadline = setTimeout(() => {
      this.dispose();
    }, 5000);
  }
  state() {
    return { held: this.held !== null, closedSignal: this.closedSignal };
  }
  observe(observation: DecoderObservation) {
    if (observation.pid !== this.held) return;
    this.closedSignal = observation.signal === "SIGKILL" ? "SIGKILL" : "OTHER";
    this.held = null;
    if (this.deadline) clearTimeout(this.deadline);
    this.deadline = undefined;
  }
  dispose() {
    if (this.timer) clearInterval(this.timer);
    if (this.deadline) clearTimeout(this.deadline);
    this.timer = undefined;
    this.deadline = undefined;
    if (this.held !== null) {
      try {
        process.kill(this.held, "SIGCONT");
      } catch {
        /* The owned decoder may already have exited. */
      }
      this.held = null;
    }
  }
  private async scan() {
    if (this.scanning || !this.timer) return;
    this.scanning = true;
    try {
      for (const name of await readdir("/proc")) {
        if (!/^\d+$/u.test(name) || !this.timer) continue;
        const pid = Number(name);
        try {
          const status = await readFile("/proc/" + name + "/status", "utf8");
          if (!status.includes("PPid:\t" + String(process.pid) + "\n"))
            continue;
          const command = await readFile("/proc/" + name + "/cmdline", "utf8");
          if (
            !command
              .split("\0")
              .some((argument) =>
                /\/image-decoder-child\.(?:ts|js)$/u.test(argument),
              )
          )
            continue;
          process.kill(pid, "SIGSTOP");
          this.held = pid;
          clearInterval(this.timer);
          this.timer = undefined;
          break;
        } catch {
          /* /proc entries can disappear between reads. */
        }
      }
    } catch {
      this.dispose();
    } finally {
      this.scanning = false;
    }
  }
}
