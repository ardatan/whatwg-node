# Web Platform Tests

Runs a subset of [web-platform-tests](https://github.com/web-platform-tests/wpt) against
[`@whatwg-node/node-fetch`](../../packages/node-fetch). The runner is adapted from
[undici](https://github.com/nodejs/undici) (Deno MIT license).

The WPT checkout is a **shallow + sparse** submodule: only the dirs listed in
[`sparse-paths.txt`](./sparse-paths.txt) are materialized (`fetch`, `xhr`, `mimesniff`, plus
serve/manifest helpers).

## Prerequisites

- Python 3
- Git submodule at `test/web-platform-tests/wpt`
- Hosts entries for `web-platform.test` (setup can configure them)

```bash
git submodule update --init --depth 1 -- test/web-platform-tests/wpt
npm run build
npm run test:wpt:setup
```

`test:wpt:setup` re-applies the sparse checkout automatically.

## Run

```bash
npm run test:wpt
```

Subset / single file:

```bash
node test/web-platform-tests/wpt-runner.mjs run /fetch/api/headers
node test/web-platform-tests/wpt-runner.mjs run /fetch/api/headers/headers-basic.any.html
```

### Docker (no local `/etc/hosts` / `python3-venv` needed)

```bash
docker run --rm \
  -v "$PWD":/work -w /work \
  -e CI=true \
  node:26-bookworm \
  bash -c 'apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3 python3-venv >/dev/null &&
    (python3 test/web-platform-tests/wpt/wpt make-hosts-file >> /etc/hosts) &&
    npm run build && npm run test:wpt'
```

## Syncing WPT

**Cron (recommended):** [`.github/workflows/update-wpt.yml`](../../.github/workflows/update-wpt.yml)
runs weekly (Monday 06:00 UTC) and on `workflow_dispatch`. It bumps the sparse submodule, refreshes
`expectation.json`, and opens a PR (`chore/update-wpt`). Merge stays manual so you can review drift.

**Local / on demand:**

```bash
npm run test:wpt:sync # submodule --remote + sparse + manifest
npm run test:wpt      # refresh expectation.json (success-bit baseline)
git add test/web-platform-tests/wpt test/web-platform-tests/expectation.json
git commit -m "test: bump WPT"
```

CI test workflow pins the committed submodule SHA; it does not auto-bump on every PR.

The WPT CI gate (`.github/workflows/wpt.yml`) is `expectation.json` success-bit drift, not “all
tests pass”.
