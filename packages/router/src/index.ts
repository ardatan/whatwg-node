import { createServerAdapter, DefaultServerAdapterContext, ServerAdapter, ServerAdapterBaseObject } from "@whatwg-node/server";
import { Router as IttyRouter } from "itty-router";
import { Request as DefaultRequestCtor } from "@whatwg-node/fetch";

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface RouterRequest extends Request {
    method: HTTPMethod;
    parsedUrl: URL;
    params: Record<string, string>;
    query: Record<string, string>;
}

export type RouteMethodKey = Lowercase<HTTPMethod> | 'all'; 
export type RouterHandler<TServerContext> = (request: RouterRequest, ctx: TServerContext) => Promise<Response | void> | Response | void;
export type RouteMethod<TServerContext> = (path: string, handler: RouterHandler<TServerContext>) => Router<TServerContext>;

export type RouterBaseObject<TServerContext> = Record<RouteMethodKey, RouteMethod<TServerContext>> & ServerAdapterBaseObject<TServerContext>;
export type Router<TServerContext> = ServerAdapter<TServerContext, RouterBaseObject<TServerContext>>;

export function createRouter<TServerContext = DefaultServerAdapterContext>(base?: string, RequestCtor: typeof Request = DefaultRequestCtor): Router<TServerContext> {
    const ittyRouter = IttyRouter({
        base,
    });
    ittyRouter.all!('*', request => {
        let parsedUrl: URL;
        Object.defineProperty(request, 'parsedUrl', {
            get() {
                if (!parsedUrl) {
                    parsedUrl = new URL(request.url);
                }
                return parsedUrl;
            }
        })
    });
    return createServerAdapter(ittyRouter as any, RequestCtor) as Router<TServerContext>;
}
