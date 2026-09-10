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
  if (process.exitCode !== 0) {
    return;
  }

  // Build helper that calls Multi::CloseTimerAsync after Multi.close().
  // (node-libcurl 5's close() leaks the uv timer / ObjectWrap Ref under Jest --detectLeaks.)
  const libcurlDir = join(root, 'node_modules', 'node-libcurl');
  const fixDir = join(root, 'scripts', 'libcurl-multi-fix');
  if (existsSync(libcurlDir) && existsSync(join(fixDir, 'binding.gyp'))) {
    console.log('Building libcurl Multi timer fix addon...');
    const nodeGyp = require.resolve('node-gyp/bin/node-gyp.js');
    const rebuild = spawnSync(process.execPath, [nodeGyp, 'rebuild'], {
      cwd: fixDir,
      stdio: 'inherit',
    });
    if (rebuild.status !== 0) {
      console.warn(
        'Warning: failed to build libcurl-multi-fix; Jest leak tests may fail with libcurl loaded.',
      );
    }
  }
} finally {
  for (const [patchFile, skipFile] of skipped) {
    renameSync(skipFile, patchFile);
  }
}
