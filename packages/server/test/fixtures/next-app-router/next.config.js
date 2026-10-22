const path = require('node:path');

/** @type {import('next').NextConfig} */
module.exports = {
  // `next` is installed at the monorepo root. Turbopack only resolves it from the
  // workspace root (the directory with the lockfile), not from this fixture.
  turbopack: {
    root: path.resolve(__dirname, '../../../../..'),
  },
  // Load the server package from its built entry, the same way an application does.
  serverExternalPackages: [
    '@whatwg-node/server',
    '@whatwg-node/fetch',
    '@whatwg-node/node-fetch',
    '@whatwg-node/promise-helpers',
    '@whatwg-node/disposablestack',
    '@envelop/instrumentation',
  ],
};
