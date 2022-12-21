import { createServerAdapter, type DefaultServerAdapterContext } from '@whatwg-node/server';
import { Router as IttyRouter } from 'itty-router';
import { Request as DefaultRequestCtor } from '@whatwg-node/fetch';
import type { Router, RouterBaseObject } from './types';

interface RouterOptions<TServerContext = DefaultServerAdapterContext> {
  base?: string,
  RequestCtor?: typeof Request,
  plugins?: Array<(router: RouterBaseObject<TServerContext>) => RouterBaseObject<TServerContext>>,
}

export function createRouter<TServerContext = DefaultServerAdapterContext>(
  options?: RouterOptions<TServerContext>
): Router<TServerContext> {
  let ittyRouter = IttyRouter({
    base: options?.base,
  }) as unknown as RouterBaseObject<TServerContext>;
  ittyRouter.all!('*', request => {
    let parsedUrl: URL;
    Object.defineProperty(request, 'parsedUrl', {
      get() {
        if (!parsedUrl) {
          parsedUrl = new URL(request.url);
        }
        return parsedUrl;
      },
    });
  });
  options?.plugins?.forEach(plugin => {
    ittyRouter = plugin(ittyRouter);
  })
  return createServerAdapter(ittyRouter, options?.RequestCtor || DefaultRequestCtor);
}
