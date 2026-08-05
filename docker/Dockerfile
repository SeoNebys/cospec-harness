# Shared base image for the maker, director, and judge agents.
#
# All three roles run the same image; they differ only by mounted workspace
# (CLAUDE.md config) and mounts, not by image. Authentication is injected at
# run time via ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN (no secrets baked in).
#
# Runs as the non-root `node` user (uid 1000, built into the node image):
# `claude --dangerously-skip-permissions` refuses to run as root.

FROM node:20-bookworm-slim

# Base tools + Python (Spec Kit's `specify` CLI is run via uv for the SDD method).
RUN apt-get update && apt-get install -y --no-install-recommends \
      git curl ca-certificates python3 python3-venv ripgrep less \
    && rm -rf /var/lib/apt/lists/*

# uv/uvx into a system-wide location so the non-root user can run `specify`.
RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
    && cp /root/.local/bin/uv /root/.local/bin/uvx /usr/local/bin/

# Claude Code CLI used in the archived experiment (every agent is a headless
# `claude -p` process). Keep this version aligned with the archived transcripts.
ARG CLAUDE_CODE_VERSION=2.1.197
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} --no-audit --no-fund

# Pre-seed first-run state so headless `-p` never blocks on onboarding / trust
# prompts, under the node user's home. Keys are best-effort.
RUN mkdir -p /home/node/.claude/projects && chown -R node:node /home/node
COPY --chown=node:node claude-config.json /home/node/.claude.json

WORKDIR /work
USER node
CMD ["sleep", "infinity"]
