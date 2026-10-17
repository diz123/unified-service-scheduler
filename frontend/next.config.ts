import type { NextConfig } from 'next';

/** ADR-0002: same-origin proxy to the NestJS API, so the backend needs no CORS. */
const API_ORIGIN = 'http://localhost:3000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_ORIGIN}/:path*` }];
  },
};

export default nextConfig;
