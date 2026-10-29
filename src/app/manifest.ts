import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OynaBil",
    short_name: "OynaBil",
    description: "Ortaokul dersleri için akıllı tahtada takım yarışmaları.",
    lang: "tr",
    start_url: "/",
    display: "fullscreen",
    orientation: "any",
    background_color: "#0c1b3a",
    theme_color: "#0c1b3a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
