console.log('>>> CUSTOM METRO CONFIG LOADED <<<');
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// Force-map hoisted packages to the workspace-root node_modules so Metro
// resolves them regardless of pnpm's layout.
config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (_target, name) =>
      path.join(workspaceRoot, 'node_modules', name),
  }
);

module.exports = config;