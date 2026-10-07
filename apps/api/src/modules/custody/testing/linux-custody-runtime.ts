import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const docker = async (args: readonly string[]) =>
  (
    await execute("docker", [...args], {
      windowsHide: true,
      timeout: 300000,
      maxBuffer: 1048576,
    })
  ).stdout;

export async function createLinuxCustodyRuntime() {
  const root = resolve(process.cwd(), "../..");
  const temporary = await mkdtemp(join(tmpdir(), "p06-linux-custody-"));
  const id = randomUUID().replaceAll("-", "");
  const image = `oscar-p06-custody:${id}`;
  const network = `p06-custody-${id}`;
  const primary = `${network}-primary`;
  const recovery = `${network}-recovery`;
  const volumes = [
    `${network}-primary-files`,
    `${network}-recovery-files`,
    `${network}-escrow`,
  ] as const;
  let imageBuilt = false;
  let networkCreated = false;
  const containers: string[] = [];
  const cleanup = async () => {
    for (const container of containers.splice(0))
      await docker(["rm", "--force", container]);
    if (networkCreated) await docker(["network", "rm", network]);
    for (const volume of volumes) {
      const listed = await docker([
        "volume",
        "ls",
        "-q",
        "--filter",
        `name=^${volume}$`,
      ]);
      if (listed.trim() === volume) await docker(["volume", "rm", volume]);
    }
    if (imageBuilt) await docker(["image", "rm", image]);
    await rm(temporary, { recursive: true, force: true });
  };
  try {
    for (const [source, destination] of [
      ["apps/api/dist", "api"],
      ["packages/contracts/dist", "contracts"],
      ["packages/database/dist", "database"],
    ] as const)
      await cp(join(root, source), join(temporary, destination), {
        recursive: true,
      });
    const manifest = JSON.parse(
      await readFile(join(root, "apps/api/package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };
    await writeFile(
      join(temporary, "package.json"),
      JSON.stringify({
        type: "module",
        private: true,
        dependencies: {
          ...Object.fromEntries(
            Object.entries(manifest.dependencies).filter(
              ([name]) => !name.startsWith("@template/"),
            ),
          ),
          "@prisma/client": "7.9.1",
          "@prisma/adapter-pg": "7.9.1",
          pg: "8.22.0",
        },
      }),
    );
    await writeFile(
      join(temporary, "Dockerfile"),
      `FROM node:24.18.1-bookworm-slim
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends openssh-server openssh-client >/dev/null && rm -rf /var/lib/apt/lists/*
RUN useradd -u 1000 -o -m custody && useradd -u 1001 -m escrow && usermod -p x escrow && useradd -u 1002 -m worker && useradd -u 1003 -m api && useradd -u 1004 -m recoveryowner
WORKDIR /opt/oscar
COPY package.json ./package.json
RUN npm install --no-audit --no-fund >/dev/null
COPY api ./apps/api/dist
COPY contracts ./node_modules/@template/contracts
COPY database ./node_modules/@template/database
RUN printf '{"type":"module","exports":"./index.js"}' > node_modules/@template/contracts/package.json && printf '{"type":"module","exports":"./index.js"}' > node_modules/@template/database/package.json && touch pnpm-workspace.yaml && mkdir /run/sshd
`,
    );
    await docker(["build", "-q", "-t", image, temporary]);
    imageBuilt = true;
    await docker(["network", "create", network]);
    networkCreated = true;
    await docker([
      "run",
      "-d",
      "--name",
      recovery,
      "--network",
      network,
      "--network-alias",
      "recovery",
      "--mount",
      `type=volume,source=${volumes[1]},target=/recovery`,
      "--mount",
      `type=volume,source=${volumes[2]},target=/escrow`,
      image,
      "sh",
      "-c",
      "chown escrow:escrow /recovery && chmod 700 /recovery && chown recoveryowner:recoveryowner /escrow && chmod 700 /escrow && ssh-keygen -A >/dev/null && exec /usr/sbin/sshd -D -e -o PasswordAuthentication=no -o UsePAM=no",
    ]);
    containers.push(recovery);
    await docker([
      "run",
      "-d",
      "--name",
      primary,
      "--network",
      network,
      "--mount",
      `type=volume,source=${volumes[0]},target=/primary`,
      image,
      "sleep",
      "infinity",
    ]);
    containers.push(primary);
    await docker([
      "exec",
      primary,
      "sh",
      "-c",
      "chown custody:custody /primary && chmod 700 /primary && runuser -u custody -- ssh-keygen -q -t ed25519 -N '' -f /primary/identity",
    ]);
    const publicKey = (
      await docker(["exec", primary, "cat", "/primary/identity.pub"])
    ).trim();
    await writeFile(
      join(temporary, "authorized_keys"),
      `restrict,command="/usr/bin/env CUSTODY_RECOVERY_STORAGE_ROOT=/recovery /usr/local/bin/node /opt/oscar/apps/api/dist/infrastructure/custody/recovery-store.cli.js" ${publicKey}\n`,
    );
    await docker([
      "cp",
      join(temporary, "authorized_keys"),
      `${recovery}:/home/escrow/authorized_keys`,
    ]);
    await docker([
      "exec",
      recovery,
      "sh",
      "-c",
      "mkdir -p /home/escrow/.ssh && mv /home/escrow/authorized_keys /home/escrow/.ssh/authorized_keys && chown -R escrow:escrow /home/escrow/.ssh && chmod 700 /home/escrow/.ssh && chmod 600 /home/escrow/.ssh/authorized_keys",
    ]);
    const hostKey = (
      await docker([
        "exec",
        recovery,
        "cat",
        "/etc/ssh/ssh_host_ed25519_key.pub",
      ])
    )
      .trim()
      .split(" ")
      .slice(0, 2)
      .join(" ");
    await writeFile(join(temporary, "known_hosts"), `recovery ${hostKey}\n`);
    await writeFile(
      join(temporary, "ssh_config"),
      "Host recovery\n HostName recovery\n User escrow\n IdentityFile /primary/identity\n",
    );
    for (const filename of ["known_hosts", "ssh_config"]) {
      await docker([
        "cp",
        join(temporary, filename),
        `${primary}:/primary/${filename}`,
      ]);
      await docker([
        "exec",
        primary,
        "sh",
        "-c",
        `chown custody:custody /primary/${filename} && chmod 600 /primary/${filename}`,
      ]);
    }
    return {
      primary,
      recovery,
      run: async (program: string, fixtures: unknown) => {
        await writeFile(join(temporary, "program.mjs"), program);
        await writeFile(
          join(temporary, "fixtures.json"),
          JSON.stringify(fixtures),
        );
        await docker([
          "cp",
          join(temporary, "program.mjs"),
          `${primary}:/opt/oscar/program.mjs`,
        ]);
        await docker([
          "cp",
          join(temporary, "fixtures.json"),
          `${primary}:/primary/fixtures.json`,
        ]);
        await docker([
          "exec",
          primary,
          "sh",
          "-c",
          "chown custody:custody /primary/fixtures.json && chmod 600 /primary/fixtures.json",
        ]);
        return docker([
          "exec",
          "-u",
          "custody",
          primary,
          "node",
          "/opt/oscar/program.mjs",
        ]);
      },
      runRoot: async (
        target: "primary" | "recovery",
        args: readonly string[],
      ) => docker(["exec", target === "primary" ? primary : recovery, ...args]),
      escrow: async () => {
        await docker([
          "cp",
          `${primary}:/primary/encryption.key`,
          join(temporary, "escrow.key"),
        ]);
        await docker([
          "cp",
          join(temporary, "escrow.key"),
          `${recovery}:/escrow/encryption.key`,
        ]);
        await docker([
          "exec",
          recovery,
          "sh",
          "-c",
          "chown recoveryowner:recoveryowner /escrow/encryption.key && chmod 600 /escrow/encryption.key",
        ]);
        await rm(join(temporary, "escrow.key"));
      },
      restoreEscrow: async () => {
        await docker([
          "cp",
          `${recovery}:/escrow/encryption.key`,
          join(temporary, "escrow.key"),
        ]);
        await docker([
          "cp",
          join(temporary, "escrow.key"),
          `${primary}:/primary/escrow.key`,
        ]);
        await docker([
          "exec",
          primary,
          "sh",
          "-c",
          "chown custody:custody /primary/escrow.key && chmod 600 /primary/escrow.key",
        ]);
        await rm(join(temporary, "escrow.key"));
      },
      close: cleanup,
    };
  } catch (failure) {
    await cleanup();
    throw failure;
  }
}
