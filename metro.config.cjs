const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/private/defaults/exclusionList').default;

const config = getDefaultConfig(__dirname);

config.resolver.blockList = exclusionList([
  /[/\\]\.worktrees[/\\].*/,
  /[/\\]android[/\\](?:app[/\\])?build[/\\].*/,
  /[/\\]node_modules[/\\].*[/\\]android[/\\]build[/\\].*/,
]);

module.exports = config;
