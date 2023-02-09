export function getHeadersObj(headers: Headers): Record<string, string> {
  if (headers == null || !('forEach' in headers)) {
    return headers as any;
  }
  const obj: Record<string, string> = {};
  headers.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

export function uint8ArrayToBuffer(uint8array: Uint8Array): ArrayBuffer {
  return uint8array.buffer.slice(
    uint8array.byteOffset,
    uint8array.byteOffset + uint8array.byteLength,
  );
}
