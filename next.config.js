/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === 'production'

// The only server the browser may talk to besides this site
const signalUrl = process.env.NEXT_PUBLIC_SIGNAL_URL || 'ws://localhost:8787/ws'
const signalOrigin = new URL(signalUrl).origin

const csp = [
  "default-src 'self'",
  // Next.js hydrates with inline scripts; no third-party scripts are allowed
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  `connect-src 'self' ${signalOrigin}${isProd ? '' : ' ws: http://localhost:*'}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // Force HTTPS for two years, including subdomains
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Do not leak the page URL to other sites
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Nobody can embed the app in an iframe to trick users into sharing their camera
  { key: 'X-Frame-Options', value: 'DENY' },
  // Camera and mic only for this site; everything else off
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
]

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: { root: __dirname },
  compiler: {
    // Production builds keep only errors in the browser console, so no connection details are printed
    removeConsole: isProd ? { exclude: ['error'] } : false,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  async redirects() {
    // One canonical address for search engines: send the vercel.app copy to the real domain
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'strangers-connect.vercel.app' }],
        destination: 'https://www.strangersconnect.com/:path*',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
