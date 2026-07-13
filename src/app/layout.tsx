import type { Metadata, Viewport } from "next";
import { Cinzel } from "next/font/google";
import { RegisterSW } from "@/components/RegisterSW";
import "./globals.css";

// Font display per titoli e wordmark: classico, da tavolo da gioco.
// next/font lo scarica al build e lo serve self-hosted (zero richieste esterne).
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Briscola Napoletana",
  description: "Briscola con carte napoletane — multiplayer in tempo reale con gli amici",
  manifest: "/manifest.json",
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Briscola",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#0a120a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={cinzel.variable}>
      <body>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}