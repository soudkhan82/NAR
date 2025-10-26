import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true }, // ⬅️ ignore ESLint in CI
  // typescript: { ignoreBuildErrors: true }, // (optional) only if TS errors block build
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "juhtdavzrumcbjcmrjsg.supabase.co" },
    ],
  },
};
export default nextConfig;
