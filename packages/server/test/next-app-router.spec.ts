import { spawn, type ChildProcess } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

// Next.js App Router passes route handlers a Proxy around `NextRequest`.
// That is a platform `Request` subclass, which used to be classified as the
// ponyfill and then failed inside `useLimitRequestBodySize`.
// Bun has no ponyfill split. Deno and the leak suite do not start `next dev`.
const describeNext =
  globalThis.Bun || globalThis.Deno || process.env.LEAK_TEST ? describe.skip : describe;

describeNext('Next.js App Router with useLimitRequestBodySize', () => {
  let child: ChildProcess | undefined;
  let baseUrl = '';
  let logs = '';
  let fixtureDir = '';

  beforeAll(async () => {
    const repoRoot = path.resolve(__dirname, '../../..');
    fixtureDir = path.join(__dirname, 'fixtures/next-app-router');
    const bob = path.join(repoRoot, 'node_modules', '.bin', 'bob');
    const nextBin = path.join(repoRoot, 'node_modules', 'next', 'dist', 'bin', 'next');

    await new Promise<void>((resolve, reject) => {
      const build = spawn(bob, ['build', '--incremental'], {
        cwd: repoRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '';
      build.stdout?.on('data', chunk => {
        output += chunk.toString();
      });
      build.stderr?.on('data', chunk => {
        output += chunk.toString();
      });
      build.on('error', reject);
      build.on('exit', code => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`bob build exited ${code}\n${output}`));
      });
    });

    const port = await new Promise<number>((resolve, reject) => {
      const probe = createServer();
      probe.once('error', reject);
      probe.listen(0, '127.0.0.1', () => {
        const address = probe.address();
        if (address == null || typeof address === 'string') {
          probe.close();
          reject(new Error('Could not allocate a port'));
          return;
        }
        const allocated = address.port;
        probe.close(err => (err ? reject(err) : resolve(allocated)));
      });
    });

    const env = { ...process.env };
    delete env.NODE_OPTIONS;
    env.NODE_ENV = 'development';
    env.NEXT_TELEMETRY_DISABLED = '1';

    child = spawn(
      process.execPath,
      [nextBin, 'dev', '--hostname', '127.0.0.1', '--port', String(port)],
      {
        cwd: fixtureDir,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    child.stdout?.on('data', chunk => {
      logs += chunk.toString();
    });
    child.stderr?.on('data', chunk => {
      logs += chunk.toString();
    });

    baseUrl = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 90_000;
    let lastError = '';
    while (Date.now() < deadline) {
      if (child.exitCode != null) {
        throw new Error(`next dev exited ${child.exitCode}\n${logs}`);
      }
      if (logs.includes('Module not found') || logs.includes('Turbopack build encountered')) {
        throw new Error(`next dev failed to compile\n${logs.split('\n').slice(-80).join('\n')}`);
      }
      try {
        const response = await fetch(`${baseUrl}/graphql`);
        if (response.status === 200) {
          return;
        }
        const body = await response.text();
        lastError = `${response.status} ${body.slice(0, 500)}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
      await delay(250);
    }
    throw new Error(
      `next dev did not become ready: ${lastError}\n${logs.split('\n').slice(-80).join('\n')}`,
    );
  }, 180_000);

  afterAll(async () => {
    if (child != null && child.exitCode == null) {
      child.kill('SIGTERM');
      const deadline = Date.now() + 10_000;
      while (child.exitCode == null && Date.now() < deadline) {
        await delay(100);
      }
      if (child.exitCode == null) {
        child.kill('SIGKILL');
      }
    }
    if (fixtureDir) {
      await Promise.all(
        ['AGENTS.md', 'next-env.d.ts'].map(name =>
          rm(path.join(fixtureDir, name), { force: true }),
        ),
      );
    }
  });

  it('reads a small POST body with the native Fetch API', async () => {
    const response = await fetch(`${baseUrl}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'hello from next',
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      text: 'hello from next',
      // `proxyNextRequest` binds function properties, so `constructor.name` is `bound NextRequest`.
      incomingConstructor: 'bound NextRequest',
      nativeFetchAPI: true,
    });
  });

  it('rejects an oversized body with 413', async () => {
    const response = await fetch(`${baseUrl}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'x'.repeat(80),
    });
    expect(response.status).toBe(413);
    expect(await response.text()).toMatch(/Request body too large/);
  });

  it('rejects a streamed body once it passes the limit', async () => {
    const response = await fetch(`${baseUrl}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(80));
          controller.close();
        },
      }),
      // @ts-expect-error duplex is required for streamed bodies
      duplex: 'half',
    });
    const payload = (await response.json()) as { error?: string };
    expect(response.status).toBe(413);
    expect(payload).toEqual({ error: 'Request body too large' });
  });
});
