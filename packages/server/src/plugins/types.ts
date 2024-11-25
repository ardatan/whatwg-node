import {
  FetchAPI,
  ServerAdapterRequestHandler,
  type ServerAdapterInitialContext,
} from '../types.js';

export type ServerAdapterPlugin<TServerContext = {}> =
  | {
      onRequest?: OnRequestHook<TServerContext & ServerAdapterInitialContext>;
      onResponse?: OnResponseHook<TServerContext & ServerAdapterInitialContext>;
      [Symbol.dispose]?: () => void;
      [Symbol.asyncDispose]?: () => PromiseLike<void> | void;
    }
  | undefined;

export type OnRequestHook<TServerContext> = (
  payload: OnRequestEventPayload<TServerContext>,
) => Promise<void> | void;

export interface OnRequestEventPayload<TServerContext> {
  request: Request;
  setRequest(newRequest: Request): void;
  serverContext: TServerContext;
  fetchAPI: FetchAPI;
  requestHandler: ServerAdapterRequestHandler<TServerContext>;
  setRequestHandler(newRequestHandler: ServerAdapterRequestHandler<TServerContext>): void;
  endResponse(response: Response): void;
  url: URL;
}

export type OnResponseHook<TServerContext> = (
  payload: OnResponseEventPayload<TServerContext>,
) => Promise<void> | void;

export interface OnResponseEventPayload<TServerContext> {
  request: Request;
  serverContext: TServerContext;
  response: Response;
  setResponse(newResponse: Response): void;
  fetchAPI: FetchAPI;
}
