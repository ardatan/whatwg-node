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
