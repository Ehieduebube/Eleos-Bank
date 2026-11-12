import type { NextConfig } from "next";

/**
 * Cache Components is intentionally OFF: every Eleos page is per-user and
 * balance-bearing, so rendering is fully dynamic and nothing is served from a
 * shared cache. Fresh data after mutations comes from revalidatePath() in the
 * server actions.
 */
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
  // Dev-only "N" button: keep it off the sidebar's profile row (bottom-left by default).
  devIndicators: { position: "bottom-right" },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
