/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.aliexpress.com' },
      { protocol: 'https', hostname: '**.alicdn.com' },
      { protocol: 'https', hostname: 'ae01.alicdn.com' },
    ],
  },
  // Same-origin proxy: /api/* is transparently forwarded to the Render backend.
  // The Google OAuth flow goes through /api so the callback returns to THIS origin
  // (eliminates cross-domain cookie/fragment/FRONTEND_URL issues). Regular API calls
  // keep going direct to the backend (NEXT_PUBLIC_API_URL) to avoid proxy timeouts.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'https://nexus-backend-wb5h.onrender.com/:path*' },
    ];
  },
};

module.exports = nextConfig;
