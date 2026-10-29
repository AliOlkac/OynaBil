import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Durağan çıktı: her statik barındırmada (Cloudflare Pages, Vercel, okul sunucusu) çalışır
  // ve çevrimdışı önbelleğe alınabilir. Çok cihazlı sürüm sunucu isteyince bu satır kalkar.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
