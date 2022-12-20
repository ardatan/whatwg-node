import { createServerAdapter, type DefaultServerAdapterContext } from "@whatwg-node/server";
import { Router as IttyRouter } from "itty-router";
import { Request as DefaultRequestCtor } from "@whatwg-node/fetch";
import type { Router } from "./types";

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
