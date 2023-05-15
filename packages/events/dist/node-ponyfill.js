module.exports.CustomEvent = globalThis.CustomEvent;
if (!module.exports.CustomEvent) {
  module.exports.CustomEvent = class CustomEvent extends module.exports.Event {
    constructor(type, options) {
      super(type, options);
      this.detail = options && options.detail;
    }
  }
}
