// @ts-check

/**
 * Lighthouse CI Configuration
 * @see https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
 * @type {import('@lhci/cli').Config}
 */
module.exports = {
  ci: {
    collect: {
      settings: {
        // Match local `pnpm lighthouse` behavior
        preset: 'desktop',
        chromeFlags: '--no-sandbox',
      },
    },
    assert: {
      // Report only - don't fail CI, just warn
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
        // Vercel preview deployments always set x-robots-tag: noindex
        // This is correct behavior but causes is-crawlable to fail
        'is-crawlable': 'off',
      },
    },
  },
}
