import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "IronLog",
  description: "Strength training log with effective-rep tracking.",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  // The gym screen is a grid of small number inputs. Pinch-zoom stays available;
  // what this stops is the double-tap zoom that fires when you mean to tick a set.
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Nav />
      </body>
    </html>
  );
}
