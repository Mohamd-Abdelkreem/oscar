import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const docker = async (args: readonly string[], timeoutMs = 300000) =>
  (
    await execute("docker", [...args], {
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 1048576,
    })
  ).stdout;

export async function createLinuxCustodyRuntime({
  freshBuild = false,
  dependencyImage,
}: { freshBuild?: boolean; dependencyImage?: string } = {}) {
  const root = resolve(process.cwd(), "../..");
  const temporary = await mkdtemp(join(tmpdir(), "p06-linux-custody-"));
  const id = randomUUID().replaceAll("-", "");
  let image = `oscar-p06-custody:${id}`;
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
    const dependencies = {
      ...Object.fromEntries(
        Object.entries(manifest.dependencies).filter(
          ([name]) => !name.startsWith("@template/"),
        ),
      ),
      "@prisma/client": "7.9.1",
      "@prisma/adapter-pg": "7.9.1",
      pg: "8.22.0",
    };
    if (dependencyImage !== undefined) {
      if (!/^oscar-p06-custody:[0-9a-f]{32}$/u.test(dependencyImage))
        throw new Error("Invalid custody test dependency image.");
      image = (
        await docker([
          "image",
          "inspect",
          "--format",
          "{{.Id}}",
          dependencyImage,
        ])
      ).trim();
      const installed = (
        await docker([
          "run",
          "--rm",
          image,
          "node",
          "-e",
          "const fs=require('node:fs');const manifest=JSON.parse(fs.readFileSync('/opt/oscar/package.json','utf8'));const ids=fs.readFileSync('/etc/passwd','utf8').split('\\n').filter(line=>/^(custody|escrow|worker|api|recoveryowner):/.test(line)).map(line=>line.split(':')[2]);console.log(process.versions.node+'\\n'+JSON.stringify(Object.entries(manifest.dependencies).sort())+'\\n'+ids.join(','));",
        ])
      ).trim();
      if (
        installed !==
        `24.18.1\n${JSON.stringify(Object.entries(dependencies).sort())}\n1000,1001,1002,1003,1004`
      )
        throw new Error(
          "Custody test dependency image does not match current pins.",
        );
    }
    await writeFile(
      join(temporary, "package.json"),
      JSON.stringify({
        type: "module",
        private: true,
        dependencies,
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
    // Fresh acceptance images reinstall pinned dependencies instead of reusing build layers.
    if (dependencyImage === undefined) {
      await docker(
        [
          "build",
          ...(freshBuild ? ["--no-cache"] : []),
          "-q",
          "-t",
          image,
          temporary,
        ],
        freshBuild ? 600000 : 300000,
      );
      imageBuilt = true;
    }
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
    if (dependencyImage !== undefined) {
      for (const container of [primary, recovery]) {
        await docker([
          "exec",
          container,
          "node",
          "-e",
          "const fs=require('node:fs');for(const path of ['/opt/oscar/apps/api/dist','/opt/oscar/node_modules/@template/contracts','/opt/oscar/node_modules/@template/database'])fs.rmSync(path,{recursive:true,force:true});",
        ]);
        for (const [source, target] of [
          ["api", "apps/api/dist"],
          ["contracts", "node_modules/@template/contracts"],
          ["database", "node_modules/@template/database"],
        ] as const)
          await docker([
            "cp",
            join(temporary, source),
            `${container}:/opt/oscar/${target}`,
          ]);
        await docker([
          "exec",
          container,
          "node",
          "-e",
          "const fs=require('node:fs');for(const name of ['contracts','database'])fs.writeFileSync('/opt/oscar/node_modules/@template/'+name+'/package.json',JSON.stringify({type:'module',exports:'./index.js'}));",
        ]);
      }
    }
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
      run: async (
        program: string,
        fixtures: unknown,
        user: "custody" | "worker" | "api" | "recoveryowner" = "custody",
      ) => {
        await writeFile(join(temporary, "program.mjs"), program);
        await writeFile(
          join(temporary, "fixtures.json"),
          JSON.stringify(fixtures),
        );
        await docker([
          "cp",
          join(temporary, "program.mjs"),
          `${primary}:/opt/oscar/program-${user}.mjs`,
        ]);
        const fixturePath =
          user === "custody"
            ? "/primary/fixtures.json"
            : `/home/${user}/fixtures.json`;
        await docker([
          "cp",
          join(temporary, "fixtures.json"),
          `${primary}:${fixturePath}`,
        ]);
        await docker([
          "exec",
          primary,
          "sh",
          "-c",
          `chown ${user}:${user} ${fixturePath} && chmod 600 ${fixturePath}`,
        ]);
        return docker([
          "exec",
          "-u",
          user,
          primary,
          "node",
          `/opt/oscar/program-${user}.mjs`,
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
      preparePayoutOperator: async () => {
        await docker([
          "exec",
          primary,
          "sh",
          "-c",
          "mkdir -p /operator/keys && chown -R recoveryowner:recoveryowner /operator && chmod 700 /operator /operator/keys && runuser -u recoveryowner -- ssh-keygen -q -t ed25519 -N '' -f /operator/identity",
        ]);
        const operatorPublicKey = (
          await docker(["exec", primary, "cat", "/operator/identity.pub"])
        ).trim();
        await writeFile(
          join(temporary, "payout_authorized_key"),
          `restrict,command="/usr/bin/env CUSTODY_RECOVERY_STORAGE_ROOT=/recovery /usr/local/bin/node /opt/oscar/apps/api/dist/infrastructure/custody/recovery-store.cli.js" ${operatorPublicKey}\n`,
        );
        await docker([
          "cp",
          join(temporary, "payout_authorized_key"),
          `${recovery}:/home/escrow/payout_authorized_key`,
        ]);
        await docker([
          "exec",
          recovery,
          "sh",
          "-c",
          "cat /home/escrow/payout_authorized_key >> /home/escrow/.ssh/authorized_keys && rm /home/escrow/payout_authorized_key",
        ]);
        await docker([
          "cp",
          `${recovery}:/escrow/encryption.key`,
          join(temporary, "payout_escrow.key"),
        ]);
        await docker([
          "cp",
          join(temporary, "payout_escrow.key"),
          `${primary}:/operator/encryption.key`,
        ]);
        await rm(join(temporary, "payout_escrow.key"));
        await writeFile(
          join(temporary, "payout_known_hosts"),
          `recovery ${hostKey}\n`,
        );
        await writeFile(
          join(temporary, "payout_ssh_config"),
          "Host recovery\n HostName recovery\n User escrow\n IdentityFile /operator/identity\n",
        );
        for (const [source, target] of [
          ["payout_known_hosts", "known_hosts"],
          ["payout_ssh_config", "ssh_config"],
        ] as const)
          await docker([
            "cp",
            join(temporary, source),
            `${primary}:/operator/${target}`,
          ]);
        await docker([
          "exec",
          primary,
          "sh",
          "-c",
          "chown recoveryowner:recoveryowner /operator/encryption.key /operator/known_hosts /operator/ssh_config && chmod 600 /operator/encryption.key /operator/known_hosts /operator/ssh_config",
        ]);
      },
      close: cleanup,
    };
  } catch (failure) {
    await cleanup();
    throw failure;
  }
}
