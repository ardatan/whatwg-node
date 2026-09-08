const { resolve } = require('path');
const CI = !!process.env.CI;

const ROOT_DIR = __dirname;
const TSCONFIG = resolve(ROOT_DIR, 'tsconfig.json');
const tsconfig = require(TSCONFIG);
const ESM_PACKAGES = ['cookie'];

function pathsToModuleNameMapper(paths, { prefix = '' } = {}) {
  /** @type {Record<string, string>} */
  const mapper = {};
  for (const [alias, targets] of Object.entries(paths)) {
    const target = targets[0];
    if (alias.includes('*')) {
      mapper[`^${alias.replace(/\*/g, '(.*)')}$`] = `${prefix}${target.replace(/\*/g, '$1')}`;
    } else {
      mapper[`^${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`] = `${prefix}${target}`;
    }
  }
  return mapper;
}

let globals = {};

try {
  global.createUWS = require('./uwsUtils').createUWS;
} catch (err) {
  console.warn(`Failed to load uWebSockets.js. Skipping tests that require it.`, err);
}

try {
  globals.libcurl = require('node-libcurl');
} catch (err) {
  console.warn('Failed to load node-libcurl. Skipping tests that require it.', err);
}

module.exports = {
  displayName: process.env.LEAK_TEST ? 'Leak Tests' : 'Unit Tests',
  testEnvironment: 'node',
  rootDir: ROOT_DIR,
  restoreMocks: true,
  reporters: ['default'],
  modulePathIgnorePatterns: ['dist', 'test-assets', 'test-files', 'fixtures', 'bun'],
  testPathIgnorePatterns: [
    '/node_modules/',
    ...(!process.env.LEAK_TEST ? ['<rootDir>/scripts/leak-warmup\\.spec\\.ts$'] : []),
  ],
  moduleNameMapper: pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {
    prefix: `${ROOT_DIR}/`,
  }),
  transformIgnorePatterns: [`node_modules/(?!(${ESM_PACKAGES.join('|')})/)`],
  transform: {
    '^.+\\.mjs?$': 'babel-jest',
    '^.+\\.ts?$': 'babel-jest',
    '^.+\\.js$': 'babel-jest',
  },
  collectCoverage: false,
  globals,
  // Babel 8 retains the first Jest isolate under --detectLeaks; absorb that false positive.
  ...(process.env.LEAK_TEST
    ? {
        runner: '<rootDir>/scripts/jest-leak-runner.cjs',
        testSequencer: '<rootDir>/scripts/jest-leak-sequencer.cjs',
      }
    : {}),
  cacheDirectory: resolve(ROOT_DIR, `${CI ? '' : 'node_modules/'}.cache/jest`),
  resolver: 'bob-the-bundler/jest-resolver',
};
