# Experiment container

Maker, Director and Judge use the same image with separate working directories,
session directories and credentials. The image contains tools, not experiment
policies, reference specifications or credentials.

## Build

From the `experiment/` directory:

```sh
docker build --build-arg HOST_UID="$(id -u)" --build-arg HOST_GID="$(id -g)" \
  -t cospec-harness-env docker/
```

The default UID and GID are 1000, matching the current VM account. The container
runs as `node` and uses `/work`. Role-specific state belongs under
`/home/node/.claude` or `/home/node/.codex`.
The harness must mount and archive the appropriate session directories for the
selected provider, and supply only the credentials needed by that role.

## Tool versions

| Tool | Version |
| --- | --- |
| Node.js | 24.21.0, base image pinned by digest in Dockerfile |
| Claude Code | 2.1.270 |
| Codex CLI | 0.154.0 |
| uv | 0.12.13 |
| Spec Kit (`specify-cli`) | 1.0.6 |
| Python / Node Playwright and `@playwright/test` | 1.61.0 |
| Chromium | 149.0.7827.55 (Playwright-managed) |

Python and system packages come from Debian Bookworm. CLI versions can be
overridden with build arguments, but an experiment batch must use one validated
image. Rebuilding can change transitive and Debian package versions; retain the
built image and record its image ID along with the tool versions.

## Check installed tools

```sh
docker run --rm --network none cospec-harness-env verify-experiment-tools
docker image inspect cospec-harness-env --format '{{.Id}}'
```

The build runs the same version checks as the non-root user and stores their
output in `/home/node/tool-versions.txt`. These checks do not invoke models or
require credentials. Authentication and role-specific model calls require
separate validation in the harness.

Spec Kit is installed in `/opt/spec-kit`; `specify` is on `PATH`. Project
initialization runs inside each fresh Maker workspace. The harness selects the
integration and uses Bash scripts for Linux.

The Broker runs on the host. Its Python dependencies are in
`../requirements.txt`; Playwright's Chromium and Linux browser dependencies
must also be installed on the host to render prototype screenshots.

## VM validation

Validated on 2026-09-14 with UID/GID 1000:1000:

- Image ID: `sha256:0bcf7bf7aaf6a000acbcf9445c6108d7647882d0b6d6f54105f8920885208abc`.
- Image build and all tool version checks passed.
- With networking disabled, Spec Kit initialized both Claude and Codex projects
  and installed the specify, plan, tasks and implement skills.
- A host bind mount and each agent's state directory were writable by `node`.
- Verification containers were removed after execution.

The harness connects VM subscription files and preserves CLI credential
refreshes through the shared [authentication wrapper](authentication.md).
[Model configuration and execution](models.md) covers Claude/Codex role selection,
two independent Judges, session continuation and result paths. Host Chromium
rendering and a three-round COSPEC-S pilot have been validated; see the
[pilot report](../pilots/cospec-s-claude-codex-20260914/report.md). A complete
development cycle and the other methods still require separate validation.

The [feedback continuation](../pilots/cospec-s-feedback-20260914/report.md)
verified one further Maker/Director exchange and exposed missing JavaScript in
the presentation copy. COSPEC now copies the complete `prototypes/` directory
with relative paths intact and renders the delivered HTML. Browser checks of
all three revised prototype variants passed after this fix.

The [SDD-S and VC-S pilots](../pilots/sdd-vc-claude-codex-20260914/report.md)
each completed three dialogue rounds. SDD-S exercised specification review and
the planning skill. VC-S exposed a blank-screen issue when its Vite entry point
was captured through `file://`. [HTTP presentation](presentation.md) now uses the
Maker's declared runtime endpoint and Docker bridge address. The archived VC
app passed HTTP loading, Director access and browser interaction checks; see
the [verification report](../pilots/vc-http-presentation-20260914/report.md).

Claude's automatic updater is disabled. Do not rebuild or update tools mid-batch.
The VM validation and operational environment validation sections describe
historical images. The current rebuild is recorded separately below.

## Operational environment validation (2026-09-15)

The shared image now contains Chromium and its Linux dependencies, Playwright
1.61.0 bindings for both Python and Node, and C/C++ build tools. `python` uses
`/opt/browser-tools`; `playwright` is on PATH and browser binaries are shared at
`/opt/playwright-browsers`. Project-local Playwright imports should pin 1.61.0 to
match these binaries. Frameworks and databases remain application choices.

The installation follows the [official browser dependency instructions](https://playwright.dev/python/docs/browsers).
The image was built as root but browser launch/click checks ran as `node`.
Maker and Director use an init process and 256 MB shared-memory allowance.
The VM Broker still uses `experiment/.venv/bin/python`; pass that path directly
when spawning a background process. Resolving its symlink to `/usr/bin/python`
bypasses the virtual environment.

Validated image: `sha256:7adaad267d0b1b38e20b25dcab8977525db55f48f743056c5c85ff27909af3cf`.
Tags: `cospec-harness-env:latest` and `cospec-harness-env:operational-check`.
The previous image remains available by its recorded immutable ID.
[Verification evidence](../pilots/operational-contract-check-20260915/verification.json)
includes real VM/Director access and Python/Node browser interactions with no
model calls. Existing experimental results were not replayed or modified.

## Rebuild validation (2026-10-03)

The image was rebuilt after removing the inactive Judge provider's CLI.
`cospec-harness-env:latest` now resolves to
`sha256:835570b863834874c62c1b07200719df25ef81ed877a14baf5b2d5249b7b1ba6`.

- Claude Code 2.1.270 and Codex CLI 0.154.0 ran successfully.
- The build's tool checks and Chromium launch check passed.
- In a fresh container with networking disabled, Python and Node Playwright
  both launched Chromium 149.0.7827.55 and passed a button-click check.
- The container ran as UID/GID 1000:1000, and the removed provider's executables
  and state directory were absent.
- No credentials were mounted and no model requests were made.

The original experimental image
`sha256:7adaad267d0b1b38e20b25dcab8977525db55f48f743056c5c85ff27909af3cf`
remains available. Archived results retain that original image identity; they
were not regenerated with this rebuild.
