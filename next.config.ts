import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Make NEXT_PUBLIC_* available if some module expects them
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_API_KEY,
  },

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
