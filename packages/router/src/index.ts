import { Response as OriginalResponse } from '@whatwg-node/fetch';
import { TypedResponseCtor } from '@whatwg-node/typed-fetch';

export * from './types';
export * from './createRouter';
export { URLPattern } from '@whatwg-node/fetch';
export { useCORS, useErrorHandling } from '@whatwg-node/server';
export { useOpenAPI } from './openapi';
export { FromSchema } from 'json-schema-to-ts';
export * from './createRouterSDK';
export { TypedRequest as RouterRequest } from '@whatwg-node/typed-fetch';

export const Response = OriginalResponse as TypedResponseCtor;
