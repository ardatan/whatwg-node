const guildConfig = require('@theguild/prettier-config');
module.exports = {
  ...guildConfig,
  importOrderParserPlugins: ['explicitResourceManagement', ...guildConfig.importOrderParserPlugins],
};
