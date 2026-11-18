import type { Metadata, Viewport } from "next";
import { Cinzel, Cinzel_Decorative, EB_Garamond } from "next/font/google";
import Sparkles from "@/components/Sparkles";
import "./globals.css";

const display = Cinzel_Decorative({ subsets: ["latin"], weight: ["700", "900"], variable: "--font-display" });
const caps = Cinzel({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-caps" });
const body = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Alchemdle: the daily alchemy puzzle",
  description: "Merge elements to brew one target a day in as few merges as possible. A daily alchemy puzzle with a par.",
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/icons/om-alembic.svg` },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1a1540",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${caps.variable} ${body.variable}`}>
      <body>
        <Sparkles />
        {children}
      </body>
    </html>
  );
}
