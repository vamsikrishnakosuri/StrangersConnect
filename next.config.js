/** @type {import('next').NextConfig} */

const securityHeaders = [
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
