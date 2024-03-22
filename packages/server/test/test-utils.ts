interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: any): void;
}

export function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void;
  let reject: (reason: any) => void;
  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  return { promise, resolve: resolve!, reject: reject! };
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
