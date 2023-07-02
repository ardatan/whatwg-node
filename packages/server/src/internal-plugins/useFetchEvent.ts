import { ServerAdapterPlugin } from '../plugins/types';
import { FetchEvent } from '../types';
import { completeAssign } from '../utils';

type RequestContainer = { request: Request };

export function isFetchEvent(event: any): event is FetchEvent {
  return event != null && event.request != null && event.respondWith != null;
}

// Required for envs like nextjs edge runtime
function isRequestAccessible(serverContext: any): serverContext is RequestContainer {
  try {
    return !!serverContext?.request;
  } catch {
    return false;
  }
}

export function useFetchEvent(): ServerAdapterPlugin<FetchEvent> {
  const eventMap = new WeakMap<Request, FetchEvent>();
  return {
    onRequestAdapt({ args: [event, ...restOfCtx], setRequest, setServerContext }) {
      if (isRequestAccessible(event)) {
        setRequest(event.request);
        const serverContext = restOfCtx.length > 0 ? completeAssign(...restOfCtx) : event;
        setServerContext(serverContext);
      }
    },
    onResponse({ request, response }) {
      const event = eventMap.get(request);
      if (isFetchEvent(event)) {
        event.respondWith(response);
      }
    },
  };
}
