import { Cookie, CookieListItem } from './types';

export function getCookieString(item: CookieListItem | Cookie) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let cookieString = `${item.name}=${encodeURIComponent(item.value!)}`;

  if (item.domain) {
    cookieString += '; Domain=' + item.domain;
  }

  if (item.path) {
    cookieString += '; Path=' + item.path;
  }

  if (typeof item.expires === 'number') {
    cookieString += '; Expires=' + new Date(item.expires).toUTCString();
  } else if (item.expires) {
    cookieString += '; Expires=' + item.expires.toUTCString();
  }

  if ((item.name && item.name.startsWith('__Secure')) || item.secure) {
    item.sameSite = 'lax';
    cookieString += '; Secure';
  }

  switch (item.sameSite) {
    case 'lax':
      cookieString += '; SameSite=Lax';
      break;
    case 'strict':
      cookieString += '; SameSite=Strict';
      break;
    case 'none':
      cookieString += '; SameSite=None';
      break;
  }

  if (item.httpOnly) {
    cookieString += '; HttpOnly';
  }

  return cookieString;
}
