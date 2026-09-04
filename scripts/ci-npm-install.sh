#!/usr/bin/env bash
set -euo pipefail

# npm@12 (packageManager) only supports Node ^22.22.2 || ^24.15.0 || >=26.
node_major="$(node -p "process.versions.node.split('.')[0]")"
node_minor="$(node -p "process.versions.node.split('.')[1]")"

use_corepack_npm=0
if [[ "$node_major" -ge 26 ]]; then
  use_corepack_npm=1
elif [[ "$node_major" -eq 24 && "$node_minor" -ge 15 ]]; then
  use_corepack_npm=1
elif [[ "$node_major" -eq 22 && "$node_minor" -ge 22 ]]; then
  use_corepack_npm=1
fi

if [[ "$use_corepack_npm" -eq 1 ]]; then
  package_manager="$(node -p "require('./package.json').packageManager")"
  echo "Activating ${package_manager} via corepack (Node ${node_major}.${node_minor})"
  # shared-config runs `corepack enable` before setup-node; setup-node then
  # reinstalls Node's bundled npm. Re-enable/activate so later `npm run …`
  # steps also use packageManager and stop emitting EBADDEVENGINES.
  corepack enable
  corepack prepare "${package_manager}" --activate
  hash -r
  echo "npm $(npm --version)"
  exec npm install
fi

echo "Using bundled npm $(npm --version) (Node ${node_major}.${node_minor} is below npm@12 engine range)"
exec npm install
