# Subscription authentication on the Linux VM

The default `HARNESS_AUTH_MODE=subscription` uses the VM's existing CLI login.
No API keys are forwarded in this mode. Log in interactively on the VM once;
subsequent harness calls reuse that login. Authentication is separate from the
choice of model and role; see [model configuration](models.md).

| Provider | Default authoritative VM file | Optional source override |
| --- | --- | --- |
| Claude | `~/.claude/.credentials.json` | `HARNESS_CLAUDE_AUTH_FILE` |
| Codex | `~/.codex/auth.json` | `HARNESS_CODEX_AUTH_FILE` |

## Persistence and role isolation

`scripts/subscription_auth.py` creates private runtime homes under
`~/.local/state/cospec/auth/runtime/<role>/<provider>`. Override the parent with
`HARNESS_AUTH_STATE_DIR`; it must be outside the experiment repository. This
storage is not included in `_work`, run archives, Docker images or Git.

Container creation starts a fresh role home and seeds only its credential file.
The mounted directory is writable so the official CLI can replace credentials
atomically. Host histories, global instructions, plugins and other providers'
credentials are not copied. Existing Claude transcript mounts remain separate.

For every model call, `harness.run_llm(provider, role, command, ...)`:

1. Takes an exclusive provider lock shared by the harness's roles.
2. Reads the latest authoritative VM credential into that role's home.
3. Records a pending write-back marker, then executes the official CLI.
4. Persists changed credentials to the VM source, including after a failed model
   request, and removes the marker. Files are replaced atomically with mode 0600.

The next role, container or run therefore uses the refreshed credential. Failed
authentication does not silently switch to an API key. Expired/revoked sessions
that the CLI cannot refresh still require an interactive login on the VM.

All experimental calls must go through `run_llm`; direct `docker exec` calls do
not participate in this write-back protocol. Provider adapters should use
`auth_env(provider, role)` for container flags and `run_llm` for invocations.
The Broker supports Claude/Codex Maker and Director roles. The Judge supports
Claude and Codex.

## Other CLI sessions and interrupted calls

The provider lock serializes this harness, not independently launched host CLIs.
Before writing refreshed tokens, the harness checks whether the VM source has
changed. Conflicting updates stop the call without overwriting that source and
preserve the pending runtime credential for investigation. This detects conflicts;
it cannot make an unrelated CLI participate in the lock or prevent server-side
refresh-token rotation. Avoid using the same login concurrently for other work
while running experiments. A separate profile requires its own CLI login, not
another copy of the same refresh token.

On a call timeout or keyboard interrupt, the wrapper removes its role container
before writing back credentials, so an abandoned CLI cannot continue refreshing.
Workspace bind mounts survive; the interrupted run needs inspection before reuse.
After a host/process crash, a pending marker prevents automatic state cleanup or
another invocation. Remove the old role container, then recover using the same
source and state-directory environment settings:

```sh
python scripts/subscription_auth.py recover codex --role maker
```

Recovery refuses to proceed while the role container exists or when both copies
have changed incompatibly. Do not delete pending state or restore an older token
over a newer login. Resolve a conflict by choosing/re-establishing the valid login
before resetting its pending state; token contents must not enter logs or reports.

## Checks and compatibility

Check only the saved login format, without a model request or printing tokens:

```sh
python scripts/subscription_auth.py check claude
python scripts/subscription_auth.py check codex
python -m unittest discover -s scripts -p 'test_subscription_auth.py'
```

`HARNESS_AUTH_MODE=env` explicitly retains the old Claude-only environment token
or API-key mode. Set exactly one of `CLAUDE_CODE_OAUTH_TOKEN` and
`ANTHROPIC_API_KEY`. This mode has no file refresh/write-back protocol.

Persistence tests simulate credential rotation, atomic replacement, external
conflicts and crash recovery. Live checks verify existing-login requests across
container recreation; they do not simulate expiry or revoke a real login.

Validated on this VM on 2026-09-14:

- Six unit tests passed, covering all providers' refresh persistence, role-home
  recreation, conflicting external updates, failed requests, interrupted
  write-back recovery, timeouts and missing credentials.
- Claude and Codex each completed two fresh-container requests through
  `auth_env` and `run_llm`, with no pending write-backs.
- These requests used Claude Opus 4.8 and Codex `gpt-5.6-sol`. Low effort was
  used only for authentication checks. None changed the authoritative credential.
