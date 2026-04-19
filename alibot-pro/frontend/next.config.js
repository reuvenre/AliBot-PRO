/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.aliexpress.com' },
      { protocol: 'https', hostname: '**.alicdn.com' },
      { protocol: 'https', hostname: 'ae01.alicdn.com' },
    ],
  },
  output: 'standalone', // needed for Docker
};

module.exports = nextConfig;
