'use strict';

/**
 * patch-package errors when a patch exists but the package is missing.
 * node-libcurl is optional (and unsupported on older Node), so skip only that
 * patch when the package was not installed.
 */
const { existsSync, renameSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = join(__dirname, '..');
const optionalPatches = [
  {
    packageDir: join(root, 'node_modules', 'node-libcurl'),
    patchFile: join(root, 'patches', 'node-libcurl+5.1.2.patch'),
  },
];

const skipped = [];
for (const { packageDir, patchFile } of optionalPatches) {
  if (!existsSync(packageDir) && existsSync(patchFile)) {
    const skipFile = `${patchFile}.skip`;
    renameSync(patchFile, skipFile);
    skipped.push([patchFile, skipFile]);
    console.warn(
      `Skipping patch for optional dependency not present at ${packageDir.replace(`${root}/`, '')}`,
    );
  }
}

try {
  const patchPackageCli = require.resolve('patch-package/index.js');
  const result = spawnSync(process.execPath, [patchPackageCli], {
    cwd: root,
    stdio: 'inherit',
  });
  process.exitCode = result.status === null ? 1 : result.status;
} finally {
  for (const [patchFile, skipFile] of skipped) {
    renameSync(skipFile, patchFile);
  }
}
