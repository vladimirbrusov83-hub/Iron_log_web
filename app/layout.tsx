import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: "IronLog",
  description: "Strength training log with effective-rep tracking.",
};

export const viewport: Viewport = {
  themeColor: "#0b0b0c",
  width: "device-width",
  initialScale: 1,
  // The gym screen is a grid of small number inputs. Pinch-zoom stays available;
  // what this stops is the double-tap zoom that fires when you mean to tick a set.
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body>
        {/* `relative` only, deliberately no z-index: a stacking context here
            would trap every full-screen overlay inside it, and the nav below
            (z-40) would sit on top of pickers and sheets that ask for z-50.
            The grain layer is `fixed; z-index: 0` and still paints underneath,
            because this wrapper comes after it in tree order. */}
        <div className="relative">{children}</div>
        <Nav />
      </body>
    </html>
  );
}
