FROM node:24.18.1-bookworm-slim
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends openssh-server openssh-client >/dev/null && rm -rf /var/lib/apt/lists/*
RUN useradd -u 1000 -o -m custody && useradd -u 1001 -m escrow && usermod -p x escrow && useradd -u 1002 -m worker && useradd -u 1003 -m api && useradd -u 1004 -m recoveryowner
WORKDIR /opt/oscar
COPY package.json ./package.json
RUN npm install --no-audit --no-fund
COPY api ./apps/api/dist
COPY contracts ./node_modules/@template/contracts
COPY database ./node_modules/@template/database
COPY dev ./dev
RUN printf '{"type":"module","exports":"./index.js"}' > node_modules/@template/contracts/package.json && printf '{"type":"module","exports":"./index.js"}' > node_modules/@template/database/package.json && touch pnpm-workspace.yaml && mkdir /run/sshd
