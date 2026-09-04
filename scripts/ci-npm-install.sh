#!/usr/bin/env bash
set -euo pipefail

# Pick a Corepack-managed npm that matches this Node's engines, instead of
# relying on whatever bundled npm setup-node left on PATH.
#
# npm@12: ^22.22.2 || ^24.15.0 || >=26
# npm@11: ^20.17.0 || >=22.9.0
# npm@10: ^18.17.0 || >=20.5.0

node_major="$(node -p "process.versions.node.split('.')[0]")"
node_minor="$(node -p "process.versions.node.split('.')[1]")"
node_patch="$(node -p "process.versions.node.split('.')[2]")"

package_manager="$(node -p "require('./package.json').packageManager")"

supports_npm12=0
if [[ "$node_major" -ge 26 ]]; then
  supports_npm12=1
elif [[ "$node_major" -eq 24 && "$node_minor" -ge 15 ]]; then
  supports_npm12=1
elif [[ "$node_major" -eq 22 ]]; then
  if [[ "$node_minor" -gt 22 ]] || { [[ "$node_minor" -eq 22 ]] && [[ "$node_patch" -ge 2 ]]; }; then
    supports_npm12=1
  fi
fi

supports_npm11=0
if [[ "$node_major" -gt 22 ]] || { [[ "$node_major" -eq 22 ]] && [[ "$node_minor" -ge 9 ]]; }; then
  supports_npm11=1
elif [[ "$node_major" -eq 20 && "$node_minor" -ge 17 ]]; then
  # ^20.17.0
  supports_npm11=1
fi

if [[ "$supports_npm12" -eq 1 ]]; then
  selected_npm="$package_manager"
elif [[ "$supports_npm11" -eq 1 ]]; then
  selected_npm="npm@11.19.0"
else
  selected_npm="npm@10.9.2"
fi

echo "Activating ${selected_npm} via corepack (Node ${node_major}.${node_minor}.${node_patch})"
# shared-config runs `corepack enable` before setup-node; setup-node then
# reinstalls Node's bundled npm. Explicitly enable the npm shim and activate
# a Node-compatible npm so later bare `npm run …` steps use it.
corepack enable npm
corepack prepare "${selected_npm}" --activate
hash -r
echo "npm $(npm --version)"
exec npm install
