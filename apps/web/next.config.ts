import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    // Ensure the URL has a protocol to satisfy Next.js rewrite requirements
    const apiUrl = rawApiUrl.startsWith('http') || rawApiUrl.startsWith('/') 
      ? rawApiUrl 
      : `https://${rawApiUrl}`;

    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
