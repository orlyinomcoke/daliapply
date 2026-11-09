import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // resumes and ID photos are uploaded through server actions
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
