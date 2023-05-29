import { fetchLegacy } from './fetch-legacy';
import { fetchViaUndici } from './fetch-undici';

function getNodeMajorVersion() {
  const version = process.version;
  const match = version.match(/^v(\d+)/);
  if (!match) {
    throw new Error(`Unable to parse Node.js version: ${version}`);
  }
  return parseInt(match[1]);
}

export let fetchPonyfill: typeof fetchLegacy | typeof fetchViaUndici;

if (getNodeMajorVersion() >= 17) {
  fetchPonyfill = fetchViaUndici;
} else {
  fetchPonyfill = fetchLegacy;
}
