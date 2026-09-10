import { Buffer } from 'node:buffer';
import { setTimeout } from 'node:timers/promises';
import { describe, expect, it } from '@jest/globals';
import { PonyfillReadableStream } from '../src/ReadableStream.js';
import { PonyfillTextEncoderStream } from '../src/TextEncoderDecoderStream.js';

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

  it('values({ preventCancel: true }) does not destroy the stream on break', async () => {
    const makeStream = () => {
      let i = 0;
      return new PonyfillReadableStream({
        async pull(controller) {
          await Promise.resolve();
          if (i < 3) {
            controller.enqueue(Buffer.from(String(i++)));
          } else {
            controller.close();
          }
        },
      });
    };

    const keptOpen = makeStream();
    const keptIterator = keptOpen.values({ preventCancel: true });
    await keptIterator.next();
    await keptIterator.return?.();
    expect(keptOpen.readable.destroyed).toBe(false);

    const rest: string[] = [];
    for await (const chunk of keptOpen.values()) {
      rest.push(Buffer.from(chunk as Buffer).toString('utf-8'));
    }
    expect(rest.length).toBeGreaterThan(0);

    const cancelled = makeStream();
    const cancelledIterator = cancelled.values();
    await cancelledIterator.next();
    await cancelledIterator.return?.();
    expect(cancelled.readable.destroyed).toBe(true);
  });

  it('pipeTo rejects when the destination write fails', async () => {
    const rs = new PonyfillReadableStream({
      start(controller) {
        controller.enqueue(Buffer.from('hi'));
        controller.close();
      },
    });
    const ws = new WritableStream({
      write() {
        throw new Error('write failed');
      },
    });

    await expect(rs.pipeTo(ws)).rejects.toThrow('write failed');
  });

  it('cancel(reason) resolves without treating the reason as a stream failure', async () => {
    let cancelledWith: unknown;
    const rs = new PonyfillReadableStream({
      start(controller) {
        controller.enqueue(Buffer.from('x'));
      },
      cancel(reason) {
        cancelledWith = reason;
      },
    });

    await expect(rs.cancel(new Error('stop'))).resolves.toBeUndefined();
    expect(cancelledWith).toBeInstanceOf(Error);
    expect((cancelledWith as Error).message).toBe('stop');
  });

  it('cancel(reason) resolves when there is no cancel hook', async () => {
    const rs = new PonyfillReadableStream({
      start(controller) {
        controller.enqueue(Buffer.from('x'));
      },
    });

    await expect(rs.cancel(new Error('stop'))).resolves.toBeUndefined();
  });

  it('destroy(err) is not swallowed when it races with cancel()', async () => {
    const rs = new PonyfillReadableStream({
      start(controller) {
        controller.enqueue(Buffer.from('x'));
      },
    });

    // Prevent Node from converting an unhandled 'error' into a thrown exception.
    rs.readable.on('error', () => {});
    const origDestroy = rs.readable.destroy.bind(rs.readable);
    // After cancel marks intent, force destroy(err) so a real failure races the cancel path.
    rs.readable.destroy = ((err?: Error | null) => {
      if (err == null) {
        return origDestroy(new Error('boom'));
      }
      return origDestroy(err);
    }) as typeof rs.readable.destroy;

    await expect(rs.cancel(new Error('stop'))).rejects.toMatchObject({ message: 'boom' });
    expect(rs.readable.errored).toMatchObject({ message: 'boom' });
  });

  it('destroy(err) is preserved when cancel hook fulfills during the race', async () => {
    const rs = new PonyfillReadableStream({
      start(controller) {
        controller.enqueue(Buffer.from('x'));
      },
      cancel() {
        return Promise.resolve();
      },
    });

    rs.readable.on('error', () => {});
    const origDestroy = rs.readable.destroy.bind(rs.readable);
    rs.readable.destroy = ((err?: Error | null) => {
      if (err == null) {
        return origDestroy(new Error('boom'));
      }
      return origDestroy(err);
    }) as typeof rs.readable.destroy;

    await expect(rs.cancel(new Error('stop'))).rejects.toMatchObject({ message: 'boom' });
    expect(rs.readable.errored).toMatchObject({ message: 'boom' });
  });

  it('cancel() rejects with the stored error when the stream is already errored', async () => {
    const rs = new PonyfillReadableStream({
      start(controller) {
        controller.enqueue(Buffer.from('x'));
      },
    });
    rs.readable.on('error', () => {});
    rs.readable.destroy(new Error('already failed'));
    await expect(rs.cancel(new Error('stop'))).rejects.toMatchObject({ message: 'already failed' });
  });

  it('cancel() rejects when underlyingSource.cancel fails', async () => {
    const rs = new PonyfillReadableStream({
      start(controller) {
        controller.enqueue(Buffer.from('x'));
      },
      cancel() {
        return Promise.reject(new Error('cancel hook failed'));
      },
    });
    rs.readable.on('error', () => {});
    await expect(rs.cancel(new Error('stop'))).rejects.toMatchObject({
      message: 'cancel hook failed',
    });
  });

  it('getReader().cancel(reason) reaches underlyingSource.cancel via pipeThrough', async () => {
    let cancelledWith: unknown;
    const source = new PonyfillReadableStream({
      start() {},
      cancel(reason) {
        cancelledWith = reason;
      },
    });
    const expectedError = new Error('reader cancel');
    const piped = source.pipeThrough(new PonyfillTextEncoderStream());
    await piped.getReader().cancel(expectedError);
    expect(cancelledWith).toBe(expectedError);
  });
});
