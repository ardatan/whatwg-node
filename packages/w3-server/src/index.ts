import { IncomingMessage, ServerResponse } from "http";
import { Response } from "cross-undici-fetch";
import { FetchEventImpl } from "./FetchEvent";
import { createRequestFromIncomingMessage, sendToServerResponse } from "./utils";

export function create() {
    const eventTarget = new EventTarget();
    return {
        requestListener(
            incomingMessage: IncomingMessage,
            serverResponse: ServerResponse
        ) {
            const request = createRequestFromIncomingMessage(incomingMessage);
            const fetchEvent = new FetchEventImpl(
                "fetch",
                {
                    request,
                },
                (response) => sendToServerResponse(response, serverResponse),
                (error) => {
                    console.error(error);
                    return sendToServerResponse(new Response(error.message, { status: 500 }), serverResponse);
                }
            );
            eventTarget.dispatchEvent(fetchEvent);
        },
        addEventListener(listener: (event: FetchEvent) => void) {
            return eventTarget.addEventListener("fetch", listener as EventListener);
        },
    };
}
