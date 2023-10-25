const fs = require('fs');

const serverPackageJson = JSON.parse(fs.readFileSync('./packages/server/package.json', 'utf8'));
serverPackageJson.devDependencies['uWebSockets.js'] = undefined;
fs.writeFileSync('./packages/server/package.json', JSON.stringify(serverPackageJson, null, 2));

const nodeFetchPackageJson = JSON.parse(
  fs.readFileSync('./packages/node-fetch/package.json', 'utf8'),
);
nodeFetchPackageJson.devDependencies['node-libcurl'] = undefined;
fs.writeFileSync(
  './packages/node-fetch/package.json',
  JSON.stringify(nodeFetchPackageJson, null, 2),
);
