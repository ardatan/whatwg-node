import guildConfig from '@theguild/prettier-config';

export default {
  ...guildConfig,
  importOrderParserPlugins: ['explicitResourceManagement', ...guildConfig.importOrderParserPlugins],
};
