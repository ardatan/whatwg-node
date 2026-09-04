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
  echo "Using corepack npm (Node ${node_major}.${node_minor})"
  exec corepack npm install
fi

echo "Using bundled npm (Node ${node_major}.${node_minor} is below npm@12 engine range)"
exec npm install
