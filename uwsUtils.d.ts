import type uws from 'uWebSockets.js';

declare global {
  function createUWS(): {
    start(): Promise<void>;
    stop(): void;
    addOnceHandler(handler: Parameters<uws.TemplatedApp['any']>[1], ...ctxParts: any[]): void;
    port?: number;
  };
}

declare global {
  var Bun: any;
}
