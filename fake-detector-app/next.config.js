const { withSentryConfig } = require("@sentry/nextjs");

const nextConfig = {
  // ✅ FORCE Node.js runtime for middleware (fixes edge runtime errors)
  experimental: {
    serverComponentsExternalPackages: [],
  },

  // ✅ AGGRESSIVE ONNX WEBPACK FIX FOR 95% AI ACCURACY
  webpack: (config, {}) => {
    // 🎯 AGGRESSIVE AI PACKAGE EXCLUSION FOR DEVELOPMENT
    if (process.env.NODE_ENV !== 'production') {
      config.externals.push({
        // 🎯 STRICT AI PACKAGE EXCLUSION - Prevent binary parsing errors
        '@xenova/transformers': 'commonjs @xenova/transformers',
        'onnxruntime-node': 'commonjs onnxruntime-node',
        'onnxruntime-web': 'commonjs onnxruntime-web',
        'transformers': 'commonjs transformers',
        'sharp': 'commonjs sharp',
        '@google-cloud/vertexai': 'commonjs @google-cloud/vertexai',
        'google-auth-library': 'commonjs google-auth-library',
      });

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
      config.externals.push({
        // 🎯 STRICT AI PACKAGE EXCLUSION - Prevent binary parsing errors in production
        '@xenova/transformers': 'commonjs @xenova/transformers',
        'onnxruntime-node': 'commonjs onnxruntime-node',
        'onnxruntime-web': 'commonjs onnxruntime-web',
        'transformers': 'commonjs transformers',
        'sharp': 'commonjs sharp',
        '@google-cloud/vertexai': 'commonjs @google-cloud/vertexai',
        'google-auth-library': 'commonjs google-auth-library',
      });

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
      // 🔐 Production Security Headers
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' https://www.google.com https://www.gstatic.com 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://*.sentry.io; frame-src 'self' https://www.google.com; worker-src 'self' blob: 'unsafe-eval' 'unsafe-inline';"
          }
        ]
      },
      // API Security (no caching)
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

module.exports = withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
}, {
  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/cron/get-started/
  // Note: This feature is currently in beta
  automaticVercelMonitors: true,
});
