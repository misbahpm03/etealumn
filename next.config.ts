import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Must cover the largest validated upload (25 MB uniform bucket cap +
      // multipart overhead). Authenticated-only actions; see docs/profile_architecture.md
      // for the production large-upload caveat (presigned direct upload later).
      bodySizeLimit: "26mb",
    },
  },
  async redirects() {
    return [
      // Surface roots resolve to their dashboards.
      {
        source: "/portal",
        destination: "/portal/dashboard",
        permanent: false,
      },
      {
        source: "/admin",
        destination: "/admin/dashboard",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
