import { Response as OriginalResponse, ReadableStream, TextEncoder } from '@whatwg-node/fetch';
import { TypedResponseCtor } from './typed-fetch';
import { JSONSerializer } from './types';

export const serializerByResponse = new WeakMap<Response, JSONSerializer>();
const responseTextEncoder = new TextEncoder();

// This allows us to hook into serialization of the response body
export const Response = new Proxy(OriginalResponse, {
  get(OriginalResponse, prop, receiver) {
    if (prop === 'json') {
      return function createProxyResponseJson(jsonObj: any, init?: ResponseInit) {
        const defaultSerializer: JSONSerializer = obj => JSON.stringify(obj);
        let pull: any = () => {};
        const response = new OriginalResponse(
          new ReadableStream({
            pull(controller) {
              pull(controller);
            },
          }),
          {
            ...init,
            headers: {
              'Content-Type': 'application/json',
              ...(init?.headers || {}),
            },
          },
        );
        pull = (controller: ReadableStreamDefaultController) => {
          const serializer = serializerByResponse.get(response) || defaultSerializer;
          const serializedJson = serializer(jsonObj);
          const encodedJson = responseTextEncoder.encode(serializedJson);
          controller.enqueue(encodedJson);
          controller.close();
        };
        return response;
      };
    }
    return Reflect.get(OriginalResponse, prop, receiver);
  },
}) as TypedResponseCtor;
