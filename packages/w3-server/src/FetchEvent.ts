export class FetchEventImpl extends Event implements FetchEvent {
  clientId: string;
  handled: Promise<undefined>;
  request: Request;
  resultingClientId: string;
  constructor(
    type: "fetch",
    eventInitDict: FetchEventInit,
    private onResponse: (response: Response) => Promise<void> | void,
    private onError: (error: any) => Promise<void> | void
  ) {
    super(type, eventInitDict);
    this.handled = Promise.resolve(undefined);
    this.clientId = eventInitDict.clientId || Date.now().toString();
    this.resultingClientId = eventInitDict.resultingClientId || this.clientId;
    this.request = eventInitDict.request;
  }

  private waitUntil$: Promise<any>[] = [];

  respondWith(response$: Response | PromiseLike<Response>): void {
    Promise.resolve(response$)
      .then(async (response) => {
        await Promise.all(this.waitUntil$);
        return this.onResponse?.(response);
      })
      .catch((error) => {
        return this.onError?.(error);
      });
  }

  waitUntil(p: Promise<any>): void {
    this.waitUntil$.push(p);
  }
}
