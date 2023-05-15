import { CookieChangeEventInit, CookieList } from './types.js';

export class CookieChangeEvent extends Event {
  changed: CookieList;
  deleted: CookieList;

  constructor(type: string, eventInitDict: CookieChangeEventInit = { changed: [], deleted: [] }) {
    super(type, eventInitDict);
    this.changed = eventInitDict.changed || [];
    this.deleted = eventInitDict.deleted || [];
  }
}
