import { FetchAPI, ServerAdapterRequestHandler } from '../types';

export interface ServerAdapterPlugin<TServerContext = {}> {
  onRequest?: OnRequestHook<TServerContext>;
  onResponse?: OnResponseHook<TServerContext>;
}

export type OnRequestHook<TServerContext> = (
  payload: OnRequestEventPayload<TServerContext>,
) => Promise<void> | void;

export interface OnRequestEventPayload<TServerContext> {
  request: Request;
  serverContext: TServerContext | undefined;
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
  serverContext: TServerContext | undefined;
  response: Response;
}
