import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  
  // Fix for Firebase with Turbopack/Webpack (moved from experimental)
  serverExternalPackages: [
    '@grpc/grpc-js',
    '@grpc/proto-loader',
    'firebase-admin',
  ],
  
  // Allowed dev origins for cross-origin requests
  allowedDevOrigins: [
    '.space.z.ai',
    'localhost:3000',
  ],
};

export default nextConfig;
