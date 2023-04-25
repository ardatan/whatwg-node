import { CookieStore } from '@whatwg-node/cookie-store';
import { ServerAdapterPlugin } from '@whatwg-node/server';

declare global {
  interface Request {
    cookieStore?: CookieStore;
  }
}

export function useCookies<TServerContext>(): ServerAdapterPlugin<TServerContext> {
  return {
    onRequest({ request }) {
      request.cookieStore = new CookieStore(request.headers.get('cookie') || '');
    },
    onResponse({ request, response }) {
      if (request.cookieStore) {
        response.headers.set('set-cookie', request.cookieStore.cookieString);
      }
    },
  };
}
