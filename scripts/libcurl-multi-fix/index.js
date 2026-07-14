'use strict';

try {
  module.exports = require('./build/Release/multi_timer_fix.node');
} catch {
  try {
    module.exports = require('./build/Debug/multi_timer_fix.node');
  } catch {
    module.exports = null;
  }
}
