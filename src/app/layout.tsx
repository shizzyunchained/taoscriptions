import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://taoscriptions.vercel.app"),
  title: "Neural Relics — Alpha Burn Artifacts on Bittensor",
  description:
    "Forge numbered digital artifacts by atomically buying and burning subnet alpha on Bittensor.",
  applicationName: "Neural Relics",
  openGraph: {
    title: "Neural Relics",
    description: "Forge permanence from alpha on Bittensor.",
    type: "website",
    images: [
      {
        url: "/og-social.png",
        width: 1200,
        height: 630,
        alt: "Neural Relics — Forge permanence from alpha.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Neural Relics",
    description: "Forge permanence from alpha on Bittensor.",
    images: ["/og-social.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
