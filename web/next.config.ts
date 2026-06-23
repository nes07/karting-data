import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/standings", destination: "/standings/pilotos", permanent: true },
    ];
  },
};

export default nextConfig;
