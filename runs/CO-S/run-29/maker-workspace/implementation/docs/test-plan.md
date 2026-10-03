# Test plan

## Layers

- Domain unit tests cover validation, URL normalization, collection uniqueness and assignment, combined finding, deletion, state sanitization, and persistence serialization.
- Browser acceptance tests map one-for-one to SCN-001 through SCN-012 and exercise the production UI using Chromium.
- Phase 3 verification reruns both suites, checks startup through the declared harness command, inspects the rendered application at desktop and narrow widths, and records any gaps honestly.

## Commands

```sh
npm test
npm run test:acceptance
```

The browser suite starts an isolated server on port 4100 by default. It uses the repository-pinned Playwright 1.61.0 package and the environment’s shared browser binaries.
