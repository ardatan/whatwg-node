#!/usr/bin/env bash
set -euo pipefail

# npm@12 (packageManager) only supports Node ^22.22.2 || ^24.15.0 || >=26.
node_major="$(node -p "process.versions.node.split('.')[0]")"
node_minor="$(node -p "process.versions.node.split('.')[1]")"
node_patch="$(node -p "process.versions.node.split('.')[2]")"

use_corepack_npm=0
if [[ "$node_major" -ge 26 ]]; then
  use_corepack_npm=1
elif [[ "$node_major" -eq 24 && "$node_minor" -ge 15 ]]; then
  # ^24.15.0
  use_corepack_npm=1
elif [[ "$node_major" -eq 22 ]]; then
  if [[ "$node_minor" -gt 22 ]] || { [[ "$node_minor" -eq 22 ]] && [[ "$node_patch" -ge 2 ]]; }; then
    # ^22.22.2
    use_corepack_npm=1
  fi
fi

if [[ "$use_corepack_npm" -eq 1 ]]; then
  package_manager="$(node -p "require('./package.json').packageManager")"
  echo "Activating ${package_manager} via corepack (Node ${node_major}.${node_minor}.${node_patch})"
  # shared-config runs `corepack enable` before setup-node; setup-node then
  # reinstalls Node's bundled npm. Re-enable/activate so later `npm run …`
  # steps also use packageManager and stop emitting EBADDEVENGINES.
  corepack enable
  corepack prepare "${package_manager}" --activate
  hash -r
  echo "npm $(npm --version)"
  exec npm install
fi

echo "Using bundled npm $(npm --version) (Node ${node_major}.${node_minor}.${node_patch} is below npm@12 engine range)"
exec npm install
