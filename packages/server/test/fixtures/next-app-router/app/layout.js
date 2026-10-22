import { createElement } from 'react';

export default function RootLayout({ children }) {
  return createElement('html', { lang: 'en' }, createElement('body', null, children));
}
