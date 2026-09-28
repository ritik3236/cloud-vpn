import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The VPN moved under /vpn when this became a multi-service portal. Anyone holding an old
  // link — a bookmark, a browser's address-bar memory — still lands in the right place.
  async redirects() {
    return [
      { source: "/dashboard", destination: "/vpn/dashboard", permanent: true },
      { source: "/dashboard/:path*", destination: "/vpn/dashboard/:path*", permanent: true },
      { source: "/me", destination: "/vpn/me", permanent: true },
    ];
  },
};

export default nextConfig;
