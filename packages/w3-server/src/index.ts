import { IncomingMessage, ServerResponse } from 'http';
import { Response } from 'cross-undici-fetch';
import { FetchEvent } from './FetchEvent';
import { createRequestFromIncomingMessage, sendToServerResponse } from './utils';
import { EventEmitter } from 'events';

export function create() {
  const eventEmitter = new EventEmitter();
  eventEmitter.setMaxListeners(Infinity);
  return {
    requestListener(incomingMessage: IncomingMessage, serverResponse: ServerResponse) {
      const request = createRequestFromIncomingMessage(incomingMessage);
      const fetchEvent = new FetchEvent(
        'fetch',
        {
          request,
        },
        response => sendToServerResponse(response, serverResponse),
        error => {
          console.error(error);
          return sendToServerResponse(new Response(error.message, { status: 500 }), serverResponse);
        }
      );
      eventEmitter.emit('fetch', fetchEvent);
    },
    addEventListener(listener: (event: FetchEvent) => void) {
      return eventEmitter.addListener('fetch', listener);
    },
  };
}
