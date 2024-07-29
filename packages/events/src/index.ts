export const CustomEvent =
  globalThis.CustomEvent ||
  class PonyfillCustomEvent<T = any> extends Event implements CustomEvent<T> {
    detail!: T;
    constructor(type: string, eventInitDict?: CustomEventInit<T>) {
      super(type, eventInitDict);
      if (eventInitDict?.detail != null) {
        this.detail = eventInitDict.detail;
      }
    }

    initCustomEvent(
      type: string,
      bubbles?: boolean,
      cancelable?: boolean,
      detail?: T | undefined,
    ): void {
      this.initEvent(type, bubbles, cancelable);
      if (detail != null) {
        this.detail = detail;
      }
    }
  };
