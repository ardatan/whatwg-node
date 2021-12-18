TextEncoder.prototype.encode = function encodeStringWithNodeBuffer(str) {
    return Buffer.from(str, this.encoding);
};

TextDecoder.prototype.decode = function decodeTypedArrayWithNodeBuffer(arr) {
    return Buffer.from(arr.buffer).toString(this.encoding);
};