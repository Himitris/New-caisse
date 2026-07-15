const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

// expo-sqlite on web runs SQLite in a worker via WebAssembly + SharedArrayBuffer,
// which requires the page to be served as cross-origin isolated.
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    return middleware(req, res, next);
  };
};

module.exports = config;
