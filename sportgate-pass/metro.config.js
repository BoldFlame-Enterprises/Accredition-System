const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname, {
  // Enable CSS support
  isCSSEnabled: true,
});

// Completely disable package exports to avoid resolution issues
config.resolver.unstable_enablePackageExports = false;

// Add custom resolver to handle @expo/metro-runtime issue
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle @expo/metro-runtime resolution issue
  if (moduleName === '@expo/metro-runtime') {
    try {
      // Try to resolve the built version first
      const builtPath = require.resolve('@expo/metro-runtime/build/index.js');
      return {
        filePath: builtPath,
        type: 'sourceFile',
      };
    } catch {
      // Fallback to the main field if build doesn't exist
      try {
        const mainPath = require.resolve('@expo/metro-runtime');
        return {
          filePath: mainPath,
          type: 'sourceFile',
        };
      } catch {
        // If all else fails, return null to let Metro handle it
        return null;
      }
    }
  }
  
  // For all other modules, use the default resolver
  return context.resolveRequest(context, moduleName, platform);
};

// Add alias support for @/ imports
config.resolver.alias = {
  '@': './src',
};

// Force resolver main fields order
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;