import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    const rawApiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";
    const apiUrl =
      rawApiUrl.startsWith("http") || rawApiUrl.startsWith("/")
        ? rawApiUrl
        : `https://${rawApiUrl}`;
    return [{ source: "/api/v1/:path*", destination: `${apiUrl}/:path*` }];
  },
};

export default withNextIntl(nextConfig);
