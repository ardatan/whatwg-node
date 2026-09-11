// Copyright 2018-2025 the Deno authors. MIT license.
// Adapted from nodejs/undici for @whatwg-node/node-fetch.

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout as sleep } from 'node:timers/promises';
import { debuglog } from 'node:util';
import * as jsondiffpatch from 'jsondiffpatch';
import { sanitizeUnpairedSurrogates } from './runner/utils.mjs';

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const WPT_DIR = join(import.meta.dirname, 'wpt');
const WPT_SCRIPT_PATH = join(WPT_DIR, 'wpt');
const EXPECTATION_PATH = join(import.meta.dirname, 'expectation.json');
const CA_CERT_PATH = join(import.meta.dirname, 'runner/certs/cacert.pem');
const SPARSE_PATHS_FILE = join(import.meta.dirname, 'sparse-paths.txt');

const log = debuglog('WHATWG_NODE_WPT');
const WPT_SERVER_URL = 'http://web-platform.test:8000';
const WPT_HTTPS_SERVER_URL = 'https://web-platform.test:8443';
const WPT_H2_SERVER_URL = 'https://web-platform.test:9000';
const PYTHON_CANDIDATES = ['python3', 'python'];

let pythonInfoPromise;

const SERVER_READY_CHECKS = [
  [
    'http-default',
    line => line.includes('http on port 8000') && line.includes('Starting http server'),
  ],
  ['http-alt', line => /\bhttp on port (?!8000\b)\d+\].*Starting http server/.test(line)],
  [
    'http-local',
    line => line.includes('http-local on port') && line.includes('Starting http server'),
  ],
  [
    'http-public',
    line => line.includes('http-public on port') && line.includes('Starting http server'),
  ],
  [
    'https-8443',
    line => line.includes('https on port 8443') && line.includes('Starting https server'),
  ],
  [
    'https-8444',
    line => line.includes('https on port 8444') && line.includes('Starting https server'),
  ],
  [
    'https-local',
    line => line.includes('https-local on port') && line.includes('Starting https server'),
  ],
  [
    'https-public',
    line => line.includes('https-public on port') && line.includes('Starting https server'),
  ],
  ['ws', line => line.includes('ws on port') && line.includes('Listen on:')],
  ['wss', line => line.includes('wss on port') && line.includes('Listen on:')],
  ['h2', line => line.includes('h2 on port 9000') && line.includes('Starting http2 server')],
];

function streamServerLogs(stream, target, onLine) {
  let buffer = '';

  stream.setEncoding('utf8');
  stream.on('data', chunk => {
    target.write(chunk);
    buffer += chunk;

    let endIndex;
    while ((endIndex = buffer.indexOf('\n')) !== -1) {
      onLine(buffer.slice(0, endIndex));
      buffer = buffer.slice(endIndex + 1);
    }
  });

  stream.on('end', () => {
    if (buffer.length > 0) {
      onLine(buffer);
    }
  });
}

async function terminateProcess(proc, exitPromise) {
  if (proc.exitCode != null) {
    await exitPromise;
    return;
  }

  if (process.platform === 'win32') {
    try {
      await new Promise(resolve => {
        const killer = spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], {
          stdio: 'ignore',
        });

        killer.once('error', resolve);
        killer.once('exit', resolve);
      });
    } catch {
      proc.kill();
    }
  } else {
    proc.kill('SIGINT');

    const exited = await Promise.race([
      exitPromise.then(() => true),
      new Promise(resolve => setTimeout(resolve, 1_000, false)),
    ]);

    if (!exited && proc.exitCode == null) {
      proc.kill('SIGKILL');
    }
  }

  await exitPromise;
}

function parsePythonVersion(output) {
  const versionRegex = /^Python (?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)/m.exec(output.trim());

  if (versionRegex === null) {
    return null;
  }

  const { major, minor, patch } = versionRegex.groups;
  return { major: Number(major), minor: Number(minor), patch: Number(patch) };
}

async function getPythonInfo() {
  pythonInfoPromise ??= (async () => {
    const failures = [];

    for (const command of PYTHON_CANDIDATES) {
      const result = await new Promise(resolve => {
        const proc = spawn(command, ['--version'], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let output = '';
        let settled = false;
        const onData = chunk => {
          output += chunk.toString();
        };

        proc.stdout.on('data', onData);
        proc.stderr.on('data', onData);

        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            proc.kill();
            resolve({ command, reason: 'timed out while checking version' });
          }
        }, 10_000);

        proc.once('error', err => {
          if (settled) {
            return;
          }

          settled = true;
          clearTimeout(timeout);
          resolve({ command, reason: err.message });
        });

        proc.once('exit', code => {
          if (settled) {
            return;
          }

          settled = true;
          clearTimeout(timeout);

          const version = parsePythonVersion(output);
          if (code === 0 && version !== null && version.major === 3) {
            resolve({ command, version });
            return;
          }

          const reason =
            version !== null
              ? `found unsupported Python ${version.major}.${version.minor}.${version.patch}`
              : output.trim() || `exited with code ${code}`;
          resolve({ command, reason });
        });
      });

      if ('version' in result) {
        return result;
      }

      failures.push(`${command}: ${result.reason}`);
    }

    throw new Error(`Python 3 is required. Checked: ${failures.join('; ')}`);
  })();

  return pythonInfoPromise;
}

async function applySparseCheckout() {
  if (!existsSync(SPARSE_PATHS_FILE)) {
    return;
  }

  const paths = readFileSync(SPARSE_PATHS_FILE, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

  if (paths.length === 0) {
    return;
  }

  const initProc = spawn('git', ['sparse-checkout', 'init', '--cone'], {
    cwd: WPT_DIR,
    stdio: 'inherit',
  });
  const initOk = await new Promise(resolve => {
    initProc.on('exit', code => resolve(code === 0));
    initProc.on('error', () => resolve(false));
  });
  if (!initOk) {
    throw new Error('Failed to initialize git sparse-checkout for WPT');
  }

  const setProc = spawn('git', ['sparse-checkout', 'set', ...paths], {
    cwd: WPT_DIR,
    stdio: 'inherit',
  });
  const setOk = await new Promise(resolve => {
    setProc.on('exit', code => resolve(code === 0));
    setProc.on('error', () => resolve(false));
  });
  if (!setOk) {
    throw new Error(`Failed to set WPT sparse-checkout paths: ${paths.join(', ')}`);
  }
}

async function ensureWPTCheckout() {
  if (!existsSync(WPT_SCRIPT_PATH)) {
    console.log('WPT checkout missing, attempting to initialize git submodule...');

    const submoduleProc = spawn(
      'git',
      ['submodule', 'update', '--init', '--depth', '1', '--', 'test/web-platform-tests/wpt'],
      {
        cwd: REPO_ROOT,
        stdio: 'inherit',
      },
    );

    const submoduleOk = await new Promise(resolve => {
      submoduleProc.on('exit', code => resolve(code === 0));
      submoduleProc.on('error', () => resolve(false));
    });

    if (!submoduleOk || !existsSync(WPT_SCRIPT_PATH)) {
      throw new Error(
        'WPT checkout is missing. Run `git submodule update --init --depth 1 test/web-platform-tests/wpt`.',
      );
    }
  }

  // Keep only the suites we run (see sparse-paths.txt).
  await applySparseCheckout();
}

async function startWPTServer() {
  const { command: pythonCommand } = await getPythonInfo();
  const { promise, resolve, reject } = Promise.withResolvers();
  const {
    promise: readyPromise,
    resolve: resolveReady,
    reject: rejectReady,
  } = Promise.withResolvers();
  const readyChecks = new Set();
  let serverResponding = false;
  let readySettled = false;

  const maybeResolveReady = () => {
    if (!readySettled && serverResponding && readyChecks.size === SERVER_READY_CHECKS.length) {
      readySettled = true;
      resolveReady();
    }
  };

  const onServerLine = line => {
    for (const [name, matches] of SERVER_READY_CHECKS) {
      if (!readyChecks.has(name) && matches(line)) {
        readyChecks.add(name);
        maybeResolveReady();
      }
    }
  };

  const proc = spawn(
    pythonCommand,
    [WPT_SCRIPT_PATH, 'serve', '--config', '../runner/config.json'],
    {
      cwd: WPT_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  streamServerLogs(proc.stdout, process.stdout, onServerLine);
  streamServerLogs(proc.stderr, process.stderr, onServerLine);

  proc.once('exit', (code, signal) => {
    if (!readySettled) {
      readySettled = true;
      rejectReady(
        new Error(
          `WPT server exited before it was ready (code: ${code}, signal: ${signal ?? 'none'})`,
        ),
      );
    }

    resolve();
  });

  proc.once('error', err => {
    if (!readySettled) {
      readySettled = true;
      rejectReady(err);
    }

    reject(err);
  });

  const readinessTimeout = setTimeout(() => {
    if (!readySettled) {
      readySettled = true;
      const missing = SERVER_READY_CHECKS.map(([name]) => name)
        .filter(name => !readyChecks.has(name))
        .join(', ');
      rejectReady(new Error(`Timed out waiting for WPT server readiness. Missing: ${missing}`));
    }
  }, 30_000);

  try {
    while (!serverResponding && !proc.killed && proc.exitCode == null && !readySettled) {
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        const req = await globalThis.fetch(WPT_SERVER_URL);
        await req.body?.cancel();
        if (req.status === 200) {
          serverResponding = true;
          maybeResolveReady();
        }
      } catch {
        // Server not ready yet
      }
    }

    await readyPromise;
    return { proc, exitPromise: promise, readinessTimeout };
  } catch (err) {
    clearTimeout(readinessTimeout);

    try {
      await terminateProcess(proc, promise);
    } catch {
      // ignore
    }

    throw err;
  }
}

async function runWithTestUtil(testFunction) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Starting WPT server (attempt ${attempt}/${maxRetries})...`);

    try {
      const { proc, exitPromise, readinessTimeout } = await startWPTServer();

      console.log(`✅ WPT server started at ${WPT_SERVER_URL}`);

      try {
        const results = await testFunction();
        return results;
      } finally {
        clearTimeout(readinessTimeout);
        console.log('Killing WPT server');
        await terminateProcess(proc, exitPromise);
      }
    } catch (err) {
      lastError = err;

      if (attempt < maxRetries) {
        console.log(`⚠️ WPT server failed to start: ${err.message}`);
        console.log('Retrying in 2 seconds...');
        await sleep(2_000);
      }
    }
  }

  throw lastError;
}

function runSingleTest(url, _options, _expectation, timeout = 10000) {
  const startTime = Date.now();
  const { promise, resolve, reject } = Promise.withResolvers();
  const useExtraCACerts = !(
    url.pathname.startsWith('/websockets/') && url.searchParams.get('wpt_flags')?.includes('h2')
  );

  const proc = spawn(
    'node',
    [
      '--expose-gc',
      '--no-warnings',
      join(import.meta.dirname, 'runner/test-runner.mjs'),
      url.toString(),
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NO_COLOR: '1',
        ...(useExtraCACerts ? { NODE_EXTRA_CA_CERTS: CA_CERT_PATH } : {}),
      },
    },
  );

  const cases = [];
  let harnessStatus = null;
  let stdoutOutput = '';
  let stderrOutput = '';
  let error;

  const timer = setTimeout(() => {
    if (!proc.killed) {
      proc.kill('SIGINT');
    }
  }, timeout);

  proc.stdout.setEncoding('utf-8');
  proc.stdout.on('data', chunk => {
    stdoutOutput += chunk;

    let delimiterIndex;
    while ((delimiterIndex = stdoutOutput.indexOf('#$#$#')) !== -1) {
      const endIndex = stdoutOutput.indexOf('\n', delimiterIndex);
      if (endIndex !== -1) {
        const message = stdoutOutput.slice(delimiterIndex + 5, endIndex);
        try {
          const { tests, harnessStatus: _harnessStatus } = JSON.parse(message);
          harnessStatus = _harnessStatus;
          cases.push(...tests);
        } catch {
          console.error('Failed to parse:', message);
        }
        stdoutOutput = stdoutOutput.slice(endIndex + 1);
      } else {
        break;
      }
    }
  });

  proc.stderr.setEncoding('utf-8');
  proc.stderr.on('data', chunk => {
    stderrOutput += chunk;

    let delimiterIndex;
    while ((delimiterIndex = stderrOutput.indexOf('!#!#!#')) !== -1) {
      const endIndex = stderrOutput.indexOf('\n', delimiterIndex);
      if (endIndex !== -1) {
        const message = stderrOutput.slice(delimiterIndex + 6, endIndex);
        try {
          ({ error } = JSON.parse(message));
        } catch {
          error = { message: `Failed to parse runner error frame: ${message}` };
        }
        stderrOutput = stderrOutput.slice(endIndex + 1);
      } else {
        break;
      }
    }
  });

  proc.once('close', () => {
    clearTimeout(timer);
    const duration = Date.now() - startTime;

    resolve({
      status: harnessStatus?.status ?? 1,
      harnessStatus,
      duration,
      cases,
      error,
    });
  });

  proc.once('error', err => reject(err));

  return promise;
}

function getExpectation() {
  if (!existsSync(EXPECTATION_PATH)) {
    return {};
  }
  return JSON.parse(readFileSync(EXPECTATION_PATH, 'utf8'));
}

/** Ports that are fixed in WPT config; anything else is treated as ephemeral. */
const STABLE_PORTS = new Set(['8000', '8443', '8444', '9000']);

/**
 * Strip ephemeral listen ports from case names so expectations stay stable across
 * runs (WPT assigns random ports for alt/http-local/etc.).
 */
function normalizeCaseName(name) {
  return String(name ?? '').replace(/:(\d+)\b/g, (match, port) =>
    STABLE_PORTS.has(port) ? match : ':<port>',
  );
}

function updateExpectations(results) {
  const expectations = getExpectation();

  for (const { test, result } of results) {
    const pathSegments = test.path.slice(1).split('/');
    const filename = pathSegments.pop();

    let current = expectations;
    for (const segment of pathSegments) {
      current[segment] ??= {};
      current = current[segment];
    }

    const currentFilename = current[filename];

    current[filename] = {
      success:
        typeof currentFilename?.success === 'string'
          ? currentFilename.success
          : result.status === 0,
      cases: result.cases.map(c => {
        const name = normalizeCaseName(c.name);
        const currentCase = currentFilename?.cases?.find(cc => normalizeCaseName(cc.name) === name);

        if (currentCase?.flaky) {
          return {
            name,
            flaky: true,
          };
        }

        return {
          name,
          success: c.status === 0,
          message: c.message ?? undefined,
        };
      }),
    };
  }

  writeFileSync(EXPECTATION_PATH, JSON.stringify(expectations, null, 2) + '\n');
  console.log(`✅ Updated expectations file: ${EXPECTATION_PATH}`);
}

function getManifest() {
  const manifestPath = join(WPT_DIR, 'MANIFEST.json');
  if (!existsSync(manifestPath)) {
    throw new Error('MANIFEST.json not found. Run setup first.');
  }
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function resolveTestUrl(testPath) {
  const normalized = testPath.startsWith('/') ? testPath : `/${testPath}`;
  const pathname = normalized.split('?')[0];
  const filename = pathname.slice(pathname.lastIndexOf('/') + 1);

  let base = WPT_SERVER_URL;
  if (filename.includes('.h2.') || normalized.includes('wpt_flags=h2')) {
    base = WPT_H2_SERVER_URL;
  } else if (
    filename.includes('.https.') ||
    filename.includes('.wss.') ||
    normalized.includes('wpt_flags=https')
  ) {
    base = WPT_HTTPS_SERVER_URL;
  }

  return new URL(normalized, base);
}

function discoverTestsToRun(filter, expectation) {
  const manifest = getManifest();
  const tests = [];

  function walkManifest(folder, parentExpectation, prefix) {
    for (const [key, entry] of Object.entries(folder)) {
      if (Array.isArray(entry)) {
        for (const [path, options] of entry.slice(1)) {
          if (!key.endsWith('.html') && !key.endsWith('.js')) continue;

          const testPath = path || `${prefix}/${key}`;
          const url = resolveTestUrl(testPath);

          if (
            url.pathname.includes('.worker.') ||
            url.pathname.includes('serviceworker') ||
            url.pathname.includes('sharedworker') ||
            url.pathname.includes('shadowrealm')
          ) {
            continue;
          }

          const finalPath = url.pathname + url.search;
          if (!filter.some(f => finalPath.startsWith(f) || finalPath.slice(1).startsWith(f))) {
            continue;
          }

          const pathSegments = finalPath.slice(1).split('/');

          const filename = pathSegments[pathSegments.length - 1];
          const testExpectation = parentExpectation?.[filename];

          tests.push({
            path: finalPath,
            url,
            options: options || { script_metadata: [] },
            expectation: testExpectation,
          });
        }
      } else {
        const folderExpectation =
          Array.isArray(parentExpectation) || typeof parentExpectation === 'boolean'
            ? parentExpectation
            : parentExpectation?.[key];

        walkManifest(entry, folderExpectation, `${prefix}/${key}`);
      }
    }
  }

  if (manifest.items?.testharness) {
    walkManifest(manifest.items.testharness, expectation, '');
  }

  return tests;
}

function generateWPTReport(results, startTime, endTime) {
  const reportResults = [];

  for (const { test, result } of results) {
    const status =
      result.status !== 0 ? 'CRASH' : result.harnessStatus?.status === 0 ? 'OK' : 'ERROR';

    const message = result.harnessStatus?.message ?? result.error?.message ?? null;

    const reportResult = {
      test: test.path,
      subtests: result.cases.map(c => {
        let expected;
        if (c.status !== 0) {
          const { success, cases } = test.expectation ?? {};
          if (success === false) {
            expected = 'FAIL';
          } else if (Array.isArray(cases)) {
            const theCase = cases.find(
              aCase => normalizeCaseName(aCase.name) === normalizeCaseName(c.name),
            );
            expected = theCase && !theCase.success ? 'FAIL' : 'PASS';
          }
        }

        return {
          name: sanitizeUnpairedSurrogates(c.name),
          status: c.status === 0 ? 'PASS' : 'FAIL',
          message: c.message ? sanitizeUnpairedSurrogates(c.message) : null,
          expected,
          known_intermittent: [],
        };
      }),
      status,
      message: message ? sanitizeUnpairedSurrogates(message) : null,
      duration: result.duration,
      expected: status === 'OK' ? undefined : 'OK',
      known_intermittent: [],
    };

    reportResults.push(reportResult);
  }

  return {
    time_start: startTime,
    time_end: endTime,
    results: reportResults,
  };
}

async function setupHostsFile(pythonCommand, hostsPath) {
  const makeHostsProc = spawn(pythonCommand, [WPT_SCRIPT_PATH, 'make-hosts-file'], {
    cwd: WPT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  makeHostsProc.stdout.setEncoding('utf-8');
  makeHostsProc.stdout.on('data', data => {
    stdout += data;
  });

  const success = await new Promise(resolve => {
    makeHostsProc.on('exit', code => resolve(code === 0));
  });

  if (!success) {
    throw new Error('Failed to generate hosts entries');
  }

  const entries = '\n\n# Configured for Web Platform Tests (whatwg-node)\n' + stdout;
  const existing = existsSync(hostsPath) ? readFileSync(hostsPath, 'utf8') : '';
  writeFileSync(hostsPath, existing + entries);
  console.log(`Updated ${hostsPath}`);
}

async function setup() {
  console.log('Setting up WPT environment...');

  await ensureWPTCheckout();

  const { command: pythonCommand, version: pythonVersion } = await getPythonInfo();
  console.log(
    `Using Python command: ${pythonCommand} (${pythonVersion.major}.${pythonVersion.minor}.${pythonVersion.patch})`,
  );

  const manifestPath = join(WPT_DIR, 'MANIFEST.json');
  if (!existsSync(manifestPath)) {
    console.log('Updating WPT manifest...');
    const manifestProc = spawn(pythonCommand, [WPT_SCRIPT_PATH, 'manifest'], {
      cwd: WPT_DIR,
      stdio: 'inherit',
    });
    const manifestOk = await new Promise(resolve => {
      manifestProc.on('exit', code => resolve(code === 0));
      manifestProc.on('error', () => resolve(false));
    });

    if (!manifestOk) {
      throw new Error('Failed to update manifest');
    }
  } else {
    console.log('Using existing WPT manifest');
  }

  const hostsPath =
    process.platform === 'win32'
      ? `${process.env.SystemRoot}\\System32\\drivers\\etc\\hosts`
      : '/etc/hosts';

  const hostsContent = existsSync(hostsPath) ? readFileSync(hostsPath, 'utf8') : '';
  const etcHostsConfigured = hostsContent.includes('web-platform.test');

  if (etcHostsConfigured) {
    console.log(hostsPath + ' is already configured.');
  } else if (process.env.CI) {
    throw new Error(
      `${hostsPath} is missing web-platform.test entries. Configure hosts before running setup in CI.`,
    );
  } else {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise(resolve => {
      rl.question(
        `The WPT requires certain entries to be present in your ${hostsPath} file. Should these be configured automatically? (y/n): `,
        resolve,
      );
    })
      .finally(() => rl.close())
      .then(a => a.trim().toLowerCase());

    let hostsModified = false;
    if (answer === 'y' || answer === 'yes') {
      try {
        await setupHostsFile(pythonCommand, hostsPath);
        hostsModified = true;
      } catch {
        console.error('❌ \x1B[31mAutomatic configuration failed.\x1B[0m');
      }
    }
    if (!hostsModified) {
      console.log('Please configure hosts file manually:');
      console.log(`cd ${WPT_DIR}`);
      if (process.platform === 'win32') {
        console.log(
          `${pythonCommand} wpt make-hosts-file | Out-File $env:SystemRoot\\System32\\drivers\\etc\\hosts -Encoding ascii -Append`,
        );
      } else {
        console.log(`${pythonCommand} wpt make-hosts-file | sudo tee -a /etc/hosts`);
      }

      console.log('❌ \x1B[31mSetup incomplete.\x1B[0m');
      process.exit(1); // eslint-disable-line n/no-process-exit
    }
  }

  if (!existsSync(EXPECTATION_PATH)) {
    writeFileSync(EXPECTATION_PATH, '{}\n');
    console.log(`Created empty expectations file: ${EXPECTATION_PATH}`);
  }

  console.log('✅ Setup complete!');
}

function successProjection(node) {
  if (node == null || typeof node !== 'object') {
    return node;
  }

  // Case arrays → map keyed by normalized name so port churn / reorder is ignored;
  // only success/flaky bits gate CI.
  if (Array.isArray(node)) {
    /** @type {Record<string, { success?: boolean, flaky?: boolean }>} */
    const out = {};
    for (const entry of node) {
      const key = normalizeCaseName(entry?.name);
      out[key] = entry?.flaky ? { flaky: true } : { success: !!entry?.success };
    }
    return out;
  }

  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'message' || key === 'name') {
      continue;
    }
    if (key === 'success' || key === 'flaky') {
      out[key] = value;
      continue;
    }
    if (key === 'cases' || (value && typeof value === 'object')) {
      out[key] = successProjection(value);
    }
  }
  return out;
}

async function run(filters = []) {
  if (filters.length === 0) {
    throw new Error('At least one path filter is required, e.g. `run /fetch`');
  }

  await ensureWPTCheckout();

  const startTime = Date.now();
  const expectation = getExpectation();
  const tests = discoverTestsToRun(filters, expectation);

  console.log(`Going to run ${tests.length} test files`);

  const results = await runWithTestUtil(async () => {
    const testResults = [];

    for (const test of tests) {
      console.log(`${'='.repeat(40)}\n${test.path}\n`);

      const timeout = test.options.timeout === 'long' ? 60_000 : 10_000;
      const result = await runSingleTest(test.url, test.options, test.expectation, timeout);

      testResults.push({ test, result });

      console.log(`${test.path}: ${result.cases.length} tests ran in ${result.duration}ms:`);

      if (result.cases.length === 0) {
        console.log(`\t??. ❌ ${result.error?.message ?? 'N/A'}`);
      }

      for (const c of result.cases) {
        console.log(`\t${c.index + 1}. "${c.name}": ${c.status === 0 ? '✅ PASS' : '❌ FAIL'}`);

        if (c.status !== 0 && (c.message || c.stack)) {
          log(`${c.message ?? ''}:\n${(c.stack ?? '').split('\n').slice(1).join('\n')}`);
        }
      }
    }

    return testResults;
  });

  const endTime = Date.now();
  console.log(`\nCompleted in ${endTime - startTime}ms`);

  const totalTests = results.length;
  const { pass, fail } = results.reduce(
    (curr, { result }) => {
      for (const c of result.cases) {
        if (c.status !== 0) {
          curr.fail++;
        } else {
          curr.pass++;
        }
      }

      return curr;
    },
    { pass: 0, fail: 0 },
  );

  console.log('\n' + '='.repeat(50));
  console.log('TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total Test Files: ${totalTests}`);
  console.log(`✅ Passing: ${pass}`);
  console.log(`❌ Failing: ${fail}`);
  console.log('='.repeat(50));

  if (process.env.WPT_REPORT) {
    const report = generateWPTReport(results, startTime, endTime);
    writeFileSync(process.env.WPT_REPORT, JSON.stringify(report));
  } else {
    const totalCases = results.reduce((n, { result }) => n + (result.cases?.length ?? 0), 0);

    if (process.env.WPT_UPDATE_EXPECTATIONS) {
      // Used by the weekly bump workflow: refresh baseline without failing on drift.
      // Guard before write: zero files OR zero cases would wipe useful expectations.
      if (results.length === 0 || totalCases === 0) {
        throw new Error('WPT_UPDATE_EXPECTATIONS run produced zero test cases');
      }
    }

    const oldExpectations = getExpectation();
    updateExpectations(results);

    if (process.env.WPT_UPDATE_EXPECTATIONS) {
      process.exitCode = 0;
      return;
    }

    // propertyFilter(name === 'success') alone is wrong: it drops container keys like
    // `fetch`/`xhr` before nested success bits are compared (always empty diff).
    const jsondiff = jsondiffpatch.create();
    const diff = jsondiff.diff(
      successProjection(oldExpectations),
      successProjection(getExpectation()),
    );
    process.exitCode = diff === undefined ? 0 : 1;

    if (diff !== undefined) {
      console.dir(diff, { depth: Infinity });
    }
  }
}

const command = process.argv[2];
const filters = process.argv.slice(3);

switch (command) {
  case 'setup':
    await setup();
    break;
  case 'run':
    await run(filters);
    break;
  default:
    console.log(`
WPT Test Runner for @whatwg-node/node-fetch

Commands:
  setup              Configure environment
  run [filter...]    Run tests
`);
    break;
}
