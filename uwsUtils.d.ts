import type uws from 'uWebSockets.js';

declare global {
  const uwsUtils: {
    start(): Promise<void>;
    stop(): void;
    addOnceHandler(handler: Parameters<uws.TemplatedApp['any']>[1]): void;
    port?: number;
  };
}
