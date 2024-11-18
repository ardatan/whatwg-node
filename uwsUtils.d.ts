import type uws from 'uWebSockets.js';

declare global {
  function createUWS(): {
    start(): Promise<void>;
    stop(): void;
    addOnceHandler(handler: Parameters<uws.TemplatedApp['any']>[1]): void;
    port?: number;
  };
}

declare global {
  // eslint-disable-next-line no-var
  var Bun: any;
}
