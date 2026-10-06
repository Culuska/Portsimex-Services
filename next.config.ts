import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Job documents (certificates, PODs, contracts) are uploaded through
      // server actions. Vercel caps request bodies at 4.5 MB, so allow just
      // under that (the action itself rejects files over 4 MB with a clear
      // message).
      bodySizeLimit: "4.4mb",
    },
  },
};

export default nextConfig;
