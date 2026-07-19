'use strict';

const { existsSync } = require('node:fs');
const { join } = require('node:path');

const candidates = [
  join(__dirname, 'build/Release/multi_timer_fix.node'),
  join(__dirname, 'build/Debug/multi_timer_fix.node'),
];

let binding = null;
let loadError = null;
for (const candidate of candidates) {
  if (!existsSync(candidate)) {
    continue;
  }
  try {
    binding = require(candidate);
    break;
  } catch (err) {
    loadError = err;
  }
}

if (!binding) {
  const err = loadError || new Error('multi_timer_fix.node not found (run postinstall)');
  module.exports = {
    closeMultiTimer() {
      throw err;
    },
    loadError: err,
  };
} else {
  module.exports = binding;
}
