export interface FetchEvent extends Event {
    waitUntil(f: Promise<any>): void;
    request: Request;
    respondWith(r: Response | PromiseLike<Response>): void;
}