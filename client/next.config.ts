import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    reactCompiler: true,
  },
  webpack: (config, { isServer }) => {
    // Exclude problematic Solana and Coinbase SDK modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    
    // Ignore problematic modules during build
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push({
        '@solana/kit': 'commonjs @solana/kit',
        '@solana-program/system': 'commonjs @solana-program/system',
        '@solana-program/token': 'commonjs @solana-program/token',
        'axios': 'commonjs axios',
        'axios-retry': 'commonjs axios-retry'
      });
    }
    
    return config;
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ]
  },
};

export default nextConfig;
