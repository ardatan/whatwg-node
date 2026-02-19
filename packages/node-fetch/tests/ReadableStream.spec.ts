import { Buffer } from 'node:buffer';
import { setTimeout } from 'node:timers/promises';
import { describe, expect, it } from '@jest/globals';
import { PonyfillReadableStream } from '../src/ReadableStream.js';

describe('ReadableStream', () => {
  it('pull queueing', async () => {
    let cnt = 0;
    const readableStream = new PonyfillReadableStream({
      async pull(controller) {
        controller.enqueue(
          Buffer.from(
            JSON.stringify({
              cnt,
            }),
          ),
        );
        cnt++;
        if (cnt > 3) {
          controller.close();
        }
        await setTimeout(300);
      },
    });
    const reader = readableStream.getReader();
    let chunksStr = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      chunksStr += (value as Buffer).toString('utf-8');
    }
    expect(chunksStr).toBe(`{"cnt":0}{"cnt":1}{"cnt":2}{"cnt":3}`);
  });
  it('should send data from start and push lazily', async () => {
    let interval: any;
    const timeoutSignal = new AbortController();
    let pullCount = 0;
    let active: boolean;
    const rs = new PonyfillReadableStream({
      start(controller) {
        let startCount = 0;
        interval = setInterval(() => {
          controller.enqueue(Buffer.from(`startCount: ${startCount++}\n`));
        }, 300);
      },
      pull(controller) {
        if (active) {
          throw new Error('There is still a timeout running');
        }
        active = true;
        return setTimeout(1200, undefined, { signal: timeoutSignal.signal }).then(
          () => {
            controller.enqueue(Buffer.from(`pullCount: ${pullCount++}\n`));
            active = false;
          },
          () => {},
        );
      },
      cancel() {
        clearInterval(interval);
        timeoutSignal.abort();
      },
    });
    const reader = rs.getReader();
    let chunksStr = '';
    while (true) {
      const { value } = await reader.read();
      const valueStr = Buffer.from(value as Buffer).toString('utf-8');
      chunksStr += valueStr;
      if (chunksStr.includes('pullCount: 3')) {
        await reader.cancel();
        break;
      }
    }
    expect(chunksStr).toBe(`startCount: 0
startCount: 1
startCount: 2
pullCount: 0
startCount: 3
startCount: 4
startCount: 5
startCount: 6
pullCount: 1
startCount: 7
startCount: 8
startCount: 9
startCount: 10
pullCount: 2
startCount: 11
startCount: 12
startCount: 13
startCount: 14
pullCount: 3
`);
  });
  it('should send data from start without pull lazily', async () => {
    let interval: any;
    const rs = new PonyfillReadableStream({
      start(controller) {
        let startCount = 0;
        interval = setInterval(() => {
          controller.enqueue(Buffer.from(`startCount: ${startCount++}`));
        }, 300);
      },
      cancel() {
        clearInterval(interval);
      },
    });
    const reader = rs.getReader();
    const chunks = [];
    while (true) {
      const { value } = await reader.read();
      const valueStr = Buffer.from(value as Buffer).toString('utf-8');
      chunks.push(valueStr);
      if (valueStr === 'startCount: 5') {
        await reader.cancel();
        break;
      }
    }
    expect(chunks).toEqual([
      'startCount: 0',
      'startCount: 1',
      'startCount: 2',
      'startCount: 3',
      'startCount: 4',
      'startCount: 5',
    ]);
  });
});
