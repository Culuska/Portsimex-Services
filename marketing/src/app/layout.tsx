import type { Metadata } from "next";
import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono, Tinos } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
});

// Tinos matches the Times-style lettering of the Portsimex Services logo.
const tinos = Tinos({
  variable: "--font-tinos",
  subsets: ["latin"],
  weight: ["700"],
});

export const metadata: Metadata = {
  title: {
    default: "Portsimex Services — Your World Brought Closer",
    template: "%s — Portsimex Services",
  },
  description:
    "Portsimex Services Ltd: freight forwarding, customs clearance and tax exemption, inland transport, warehousing, travel, permits and armoured vehicle rental across Somalia and the Horn of Africa.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable} ${tinos.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-paper text-text">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
