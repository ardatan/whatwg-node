module.exports.CustomEvent = globalThis.CustomEvent;
if (!module.exports.CustomEvent) {
  module.exports.CustomEvent = class CustomEvent extends Event {
    constructor(type, options) {
      super(type, options);
      this.detail = options?.detail ?? null;
    }
  }
}
