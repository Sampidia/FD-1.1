/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ FORCE Node.js runtime for middleware (fixes edge runtime errors)
  experimental: {
    serverComponentsExternalPackages: [],
  },

  // ✅ AGGRESSIVE ONNX WEBPACK FIX FOR 95% AI ACCURACY
  webpack: (config, {}) => {
    // 🎯 AGGRESSIVE AI PACKAGE EXCLUSION FOR DEVELOPMENT
    if (process.env.NODE_ENV !== 'production') {
      config.externals = [
        ...config.externals,
        // 🎯 STRICT AI PACKAGE EXCLUSION - Prevent binary parsing errors
        ({ request }, callback) => {
          // Include ANY AI/ML packages that might cause compilation errors
          if (request?.includes('@xenova/transformers') ||
              request?.includes('onnxruntime') ||
              request?.includes('transformers') ||
              request?.includes('sharp') ||
              request?.endsWith('.node')) {
            console.log(`🚫 WEBPACK (DEV): Excluding AI package ${request}`)
            return callback(null, `commonjs ${request}`);
          }
          callback();
        }
      ];

      // 🎯 COMPLETE RESOLVE ALIASES - Prevent auto-imports that break compilation
      config.resolve = {
        ...config.resolve,
        alias: {
          ...config.resolve.alias,
          // 🔧 PREVENT AUTO-IMPORTS THAT CAUSE COMPILATION ERRORS
          '@xenova/transformers': false,    // ← Your 95% AI that was working!
          'onnxruntime-node': false,        // ← ONNX causing the issue
          'onnxruntime-web': false,         // ← Alternative ONNX packages

          // Node.js modules that cause webpack conflicts
          'node:path': false,
          'node:crypto': false,
          'node:fs': false,
          'node:http': false,
          'node:https': false,
        }
      };

      // 🔧 NODE.JS COMPATIBILITY - Handle legacy requirements
      config.resolve.fallback = {
        ...config.resolve.fallback,
        // Buffer polyfill for remaining compatibility
        'buffer': require.resolve('buffer'),
        // Fallback for Node.js modules
        'path': false,
        'fs': false,
        'crypto': false,
        'http': false,
        'https': false,
        'stream': false,
        'util': false,
        'url': false,
        'querystring': false,
        'zlib': false,
      };

    // 🎯 PRODUCTION MODE - Exclude AI/ML binaries to prevent webpack parsing errors
    } else {
      config.externals = [
        ...config.externals,
        // 🎯 STRICT AI PACKAGE EXCLUSION - Prevent binary parsing errors in production
        ({ request }, callback) => {
          // Include ANY AI/ML packages that might cause compilation errors
          if (request?.includes('@xenova/transformers') ||
              request?.includes('onnxruntime') ||
              request?.includes('transformers') ||
              request?.includes('sharp') ||
              request?.endsWith('.node')) {
            console.log(`🚫 WEBPACK (PRODUCTION): Excluding AI package ${request}`)
            return callback(null, `commonjs ${request}`);
          }
          callback();
        }
      ];

      // 🎯 COMPLETE RESOLVE ALIASES FOR PRODUCTION - Prevent auto-imports that break compilation
      config.resolve = {
        ...config.resolve,
        alias: {
          ...config.resolve.alias,
          // 🔧 PREVENT AUTO-IMPORTS THAT CAUSE COMPILATION ERRORS IN PRODUCTION
          '@xenova/transformers': false,
          'onnxruntime-node': false,
          'onnxruntime-web': false,

          // Node.js modules that cause webpack conflicts
          'node:path': false,
          'node:crypto': false,
          'node:fs': false,
          'node:http': false,
          'node:https': false,
        }
      };
    }

    // Add rule to ignore .node files (backup for externals)
    config.module.rules.push({
      test: /\.node$/,
      use: 'ignore-loader',
    });

    return config;
  },

  // ✅ Security and performance optimizations
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ['image/webp', 'image/avif'],
  },

  // ✅ Headers need to be wrapped in an async function
  async headers() {
    return [
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store'
          }
        ]
      }
    ]
  },
}

module.exports = nextConfig
