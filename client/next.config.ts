import type { NextConfig } from "next";

// Vercel Build Trigger: 2026-02-03 (Force Refresh)

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    if (!apiUrl) {
      console.warn('NEXT_PUBLIC_API_URL is not defined, rewrites may fail');
    }
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ]
  },
};

export default nextConfig;
