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

export function uint8ArrayToArrayBuffer(uint8array: Uint8Array): ArrayBuffer {
  return uint8array.buffer.slice(
    uint8array.byteOffset,
    uint8array.byteOffset + uint8array.byteLength,
  );
}

export function defaultHeadersSerializer(
  headers: Headers,
  onContentLength?: (value: string) => void,
): string[] {
  const headerArray: string[] = [];
  headers.forEach((value, key) => {
    if (onContentLength && key === 'content-length') {
      onContentLength(value);
    }
    headerArray.push(`${key}: ${value}`);
  });
  return headerArray;
}
