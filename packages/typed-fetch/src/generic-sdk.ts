import { fetch } from '@whatwg-node/fetch';

export interface GenericSDKOptions {
  endpoint?: string;
  fetchFn?: typeof fetch;
}

export interface GenericRequestParams {
  json?: any;
  params?: Record<string, string>;
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
}

export function createGenericSDK({ endpoint, fetchFn = fetch }: GenericSDKOptions = {}) {
  return new Proxy({} as any, {
    get(_target, path: string) {
      return new Proxy({} as any, {
        get(_target, method: string) {
          return function (requestParams: GenericRequestParams) {
            const url = new URL(path, endpoint);
            for (const pathParamKey in requestParams.params || {}) {
              const value = requestParams.params?.[pathParamKey];
              if (value) {
                url.pathname = url.pathname.replace(`{${pathParamKey}}`, value);
              }
            }
            for (const queryParamKey in requestParams.query || {}) {
              const value = requestParams.query?.[queryParamKey];
              if (value) {
                if (Array.isArray(value)) {
                  value.forEach(v => url.searchParams.append(queryParamKey, v));
                } else {
                  url.searchParams.append(queryParamKey, value);
                }
              }
            }
            const requestInit: RequestInit & { headers: Record<string, string> } = {
              method,
              headers: requestParams.headers || {},
            };

            if (requestParams.json) {
              requestInit.body = JSON.stringify(requestParams.json);
              requestInit.headers['Content-Type'] = 'application/json';
            }

            return fetchFn(url, requestInit);
          };
        },
      });
    },
  });
}
