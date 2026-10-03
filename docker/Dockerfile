# Shared tools for Maker, Director and Judge; credentials and experimental
# policies are supplied per role at runtime, never baked into this image.
FROM node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553

ARG CLAUDE_CODE_VERSION=2.1.270
ARG CODEX_VERSION=0.154.0
ARG UV_VERSION=0.12.13
ARG SPECIFY_VERSION=1.0.6
ARG PLAYWRIGHT_VERSION=1.61.0
ARG HOST_UID=1000
ARG HOST_GID=1000

RUN apt-get update && apt-get install -y --no-install-recommends \
      git curl ca-certificates python3 python3-venv ripgrep less libsecret-1-0 build-essential \
    && rm -rf /var/lib/apt/lists/*

# Separate environments keep Python tools off the distro-managed interpreter.
RUN python3 -m venv /opt/bootstrap \
    && /opt/bootstrap/bin/pip install --no-cache-dir "uv==${UV_VERSION}" \
    && python3 -m venv /opt/spec-kit \
    && /opt/bootstrap/bin/uv pip install --no-cache \
         --python /opt/spec-kit/bin/python "specify-cli==${SPECIFY_VERSION}"
ENV PATH="/opt/spec-kit/bin:/opt/bootstrap/bin:${PATH}"

# Pin the browser and both language bindings together; install OS dependencies
# while building as root, then validate browser launch as the experiment user.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers
RUN python3 -m venv /opt/browser-tools \
    && /opt/browser-tools/bin/pip install --no-cache-dir "playwright==${PLAYWRIGHT_VERSION}" \
    && /opt/browser-tools/bin/python -m playwright install --with-deps chromium \
    && npm install --prefix /opt/browser-node "playwright@${PLAYWRIGHT_VERSION}" \
         "@playwright/test@${PLAYWRIGHT_VERSION}" --no-audit --no-fund \
    && chmod -R a+rX /opt/playwright-browsers /opt/browser-tools /opt/browser-node \
    && rm -rf /var/lib/apt/lists/*
ENV PATH="/opt/browser-tools/bin:/opt/browser-node/node_modules/.bin:${PATH}" \
    NODE_PATH=/opt/browser-node/node_modules

RUN npm install -g \
      "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
      "@openai/codex@${CODEX_VERSION}" \
      --allow-scripts=@anthropic-ai/claude-code,@github/keytar \
      --no-audit --no-fund \
    && npm cache clean --force

ENV DISABLE_AUTOUPDATER=1

# Match the host account when bind-mounting the experiment's working folders.
RUN groupmod --gid "${HOST_GID}" node \
    && usermod --uid "${HOST_UID}" --gid "${HOST_GID}" node \
    && mkdir -p /work /home/node/.claude/projects /home/node/.codex \
    && chown -R node:node /work /home/node
COPY --chown=node:node claude-config.json /home/node/.claude.json
COPY --chmod=755 verify-tools.sh /usr/local/bin/verify-experiment-tools

WORKDIR /work
USER node
# This checks installations without credentials or model requests.
RUN verify-experiment-tools > /home/node/tool-versions.txt
RUN python -c 'from playwright.sync_api import sync_playwright; p=sync_playwright().start(); b=p.chromium.launch(); b.close(); p.stop()'
CMD ["sleep", "infinity"]
