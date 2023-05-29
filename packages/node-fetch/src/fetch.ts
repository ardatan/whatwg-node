import { fetchLegacy } from './fetch-legacy.js';
import { fetchViaUndici } from './fetch-undici.js';

function getNodeMajorVersion() {
  const version = process.version;
  const match = version.match(/^v(\d+)/);
  if (!match) {
    throw new Error(`Unable to parse Node.js version: ${version}`);
  }
  return parseInt(match[1]);
}

export const fetchPonyfill: typeof fetchLegacy | typeof fetchViaUndici =
  getNodeMajorVersion() >= 19 ? fetchViaUndici : fetchLegacy;
