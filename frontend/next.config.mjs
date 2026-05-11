/** @type {import('next').NextConfig} */
const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1";
const backendUpstream = process.env.BACKEND_UPSTREAM ?? "http://backend:8000";
const exportMode = process.env.NEXT_OUTPUT_MODE === "export";

const nextConfig = {
  reactStrictMode: true,
  output: exportMode ? "export" : "standalone",
  trailingSlash: exportMode,
  images: exportMode ? { unoptimized: true } : undefined,
  async rewrites() {
    if (exportMode) return [];
    return [
      {
        source: `${apiBase}/:path*`,
        destination: `${backendUpstream}${apiBase}/:path*`,
      },
    ];
  },
  async headers() {
    if (exportMode) return [];
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
