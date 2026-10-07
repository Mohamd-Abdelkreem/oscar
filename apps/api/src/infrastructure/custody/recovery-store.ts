import type { RecoveryEnvelope } from "./encrypted-envelope.js";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import type { SignerCustodyConfig } from "../../core/config/custody.config.js";
import { envelopeDigest } from "./key-storage.js";
import { CustodyStorageError } from "./protected-files.js";
import {
  recoveryRequestSchema,
  validateRecoveryResponse,
  type RecoveryRequest,
  type RecoveryResponse,
  type RecoveryAck,
} from "./recovery-store.protocol.js";
import type { RuntimeSignals } from "../logger/runtime-signals.js";

export class SshRecoveryStore {
  constructor(
    private readonly config: SignerCustodyConfig,
    private readonly signals?: RuntimeSignals,
  ) {}
  async put(envelope: RecoveryEnvelope): Promise<RecoveryAck> {
    const response = await this.exchange({
      operation: "PUT",
      envelope,
      digest: envelopeDigest(envelope),
    });
    if (response.operation !== "PUT")
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    return response;
  }
  async get(
    objectId: string,
    version: number,
  ): Promise<Extract<RecoveryResponse, { operation: "GET" }>> {
    const response = await this.exchange({
      operation: "GET",
      objectId,
      version,
    });
    if (response.operation !== "GET")
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    return response;
  }
  async list(
    cursor?: string,
    type: RecoveryEnvelope["type"] = "KEY_ASSIGNMENT",
  ): Promise<Extract<RecoveryResponse, { operation: "LIST" }>> {
    const response = await this.exchange({
      operation: "LIST",
      type,
      limit: this.config.maximumListPage,
      ...(cursor === undefined ? {} : { cursor }),
    });
    if (response.operation !== "LIST")
      throw new CustodyStorageError("CUSTODY_EVIDENCE_CONFLICT");
    return response;
  }
  private async exchange(input: RecoveryRequest): Promise<RecoveryResponse> {
    const request = recoveryRequestSchema.parse(input);
    const message = JSON.stringify(request);
    if (Buffer.byteLength(message) > this.config.maximumMessageBytes)
      throw new CustodyStorageError("CUSTODY_INPUT_INVALID");
    for (let attempt = 1; attempt <= this.config.maximumAttempts; attempt++) {
      try {
        const response = validateRecoveryResponse(
          request,
          await this.invoke(message),
        );
        return response;
      } catch (failure) {
        if (
          !(failure instanceof CustodyStorageError) ||
          failure.code !== "RECOVERY_UNAVAILABLE" ||
          attempt === this.config.maximumAttempts
        ) {
          if (
            failure instanceof CustodyStorageError &&
            failure.code === "RECOVERY_UNAVAILABLE"
          )
            this.signals?.observe("RECOVERY_UNAVAILABLE", true, {
              processKind: "SIGNER",
              code: failure.code,
            });
          throw failure;
        }
        await delay(100 * attempt);
      }
    }
    throw new CustodyStorageError("RECOVERY_UNAVAILABLE");
  }
  private invoke(message: string): Promise<unknown> {
    const options = [
      "BatchMode=yes",
      "IdentitiesOnly=yes",
      "StrictHostKeyChecking=yes",
      `UserKnownHostsFile=${this.config.knownHostsFile}`,
      "GlobalKnownHostsFile=/dev/null",
      "ForwardAgent=no",
      "ClearAllForwardings=yes",
      "RequestTTY=no",
      "PermitLocalCommand=no",
      "ControlMaster=no",
      "ControlPath=none",
      "ProxyCommand=none",
      "ProxyJump=none",
      "PasswordAuthentication=no",
      "KbdInteractiveAuthentication=no",
    ];
    const child = spawn(
      "ssh",
      [
        "-F",
        this.config.sshConfigFile,
        ...options.flatMap((option) => ["-o", option]),
        "-T",
        this.config.recoveryHost,
      ],
      { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let outputBytes = 0;
      let diagnosticBytes = 0;
      let failed = false;
      const fail = () => {
        failed = true;
        child.kill("SIGKILL");
      };
      const timer = setTimeout(fail, this.config.sshTimeoutMs);
      child.stdout.on("data", (chunk: Buffer) => {
        outputBytes += chunk.length;
        if (outputBytes > this.config.maximumMessageBytes) fail();
        else chunks.push(chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        diagnosticBytes += chunk.length;
        if (diagnosticBytes > this.config.maximumMessageBytes) fail();
      });
      child.stdin.on("error", fail);
      child.once("error", () => {
        clearTimeout(timer);
        reject(new CustodyStorageError("RECOVERY_UNAVAILABLE"));
      });
      child.once("close", (exit) => {
        clearTimeout(timer);
        if (failed) {
          reject(new CustodyStorageError("RECOVERY_UNAVAILABLE"));
          return;
        }
        let decoded: unknown;
        try {
          decoded = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          reject(new CustodyStorageError("RECOVERY_UNAVAILABLE"));
          return;
        }
        if (exit !== 0) {
          const code =
            typeof decoded === "object" &&
            decoded !== null &&
            "error" in decoded
              ? decoded.error
              : undefined;
          reject(
            new CustodyStorageError(
              code === "RECOVERY_NOT_FOUND"
                ? "RECOVERY_NOT_FOUND"
                : code === "CUSTODY_EVIDENCE_CONFLICT"
                  ? "CUSTODY_EVIDENCE_CONFLICT"
                  : "RECOVERY_UNAVAILABLE",
            ),
          );
          return;
        }
        resolve(decoded);
      });
      child.stdin.end(message);
    });
  }
}
