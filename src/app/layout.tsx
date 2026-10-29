import type { Metadata, Viewport } from "next";
import "@fontsource-variable/lexend";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "OynaBil",
  description: "Ortaokul dersleri için akıllı tahtada takım yarışmaları.",
  applicationName: "OynaBil",
  appleWebApp: { capable: true, title: "OynaBil", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0c1b3a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className="h-full">
      <body className="min-h-full">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
