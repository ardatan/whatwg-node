import { CookieStore, getCookieString } from '@whatwg-node/cookie-store';
import { ServerAdapterPlugin } from '@whatwg-node/server';

declare global {
  interface Request {
    cookieStore?: CookieStore;
  }
}

export function useCookies<TServerContext>(): ServerAdapterPlugin<TServerContext> {
  const cookieStringsByRequest = new WeakMap<Request, string[]>();
  return {
    onRequest({ request }) {
      const cookieStrings: string[] = [];
      request.cookieStore = new CookieStore(request.headers.get('cookie') ?? '');
      request.cookieStore.onchange = function ({ changed, deleted }) {
        changed.forEach(cookie => {
          cookieStrings.push(getCookieString(cookie));
        });
        deleted.forEach(cookie => {
          cookieStrings.push(getCookieString({ ...cookie, value: undefined }));
        });
      };
      cookieStringsByRequest.set(request, cookieStrings);
    },
    onResponse({ request, response }) {
      const cookieStrings = cookieStringsByRequest.get(request);
      cookieStrings?.forEach(cookieString => {
        response.headers.append('Set-Cookie', cookieString);
      });
    },
  };
}
