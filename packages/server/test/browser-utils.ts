import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import puppeteer, { type Browser } from 'puppeteer';

export async function listen(
  handler: RequestListener,
): Promise<{ server: Server; port: number; origin: string }> {
  const server = createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  return {
    server,
    port,
    origin: `http://127.0.0.1:${port}`,
  };
}

export async function withBrowser<T>(run: (browser: Browser) => Promise<T>): Promise<T> {
  const disableSandbox =
    process.env.CI === 'true' ||
    process.env.PUPPETEER_DISABLE_SANDBOX === '1' ||
    process.env.PUPPETEER_DISABLE_SANDBOX === 'true';
  const browser = await puppeteer.launch({
    headless: true,
    args: disableSandbox ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
  });
  try {
    return await run(browser);
  } finally {
    await browser.close();
  }
}

export async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close(err => (err ? reject(err) : resolve()));
  });
}
