import { createGenericSDK, GenericSDKOptions } from '@whatwg-node/typed-fetch';
import { Router } from './types';

export type RouterSDKOptions = GenericSDKOptions;

export function createRouterSDK<TRouter extends Router<any, any>>(
  opts?: RouterSDKOptions,
): TRouter['sdk'] {
  return createGenericSDK(opts);
}
