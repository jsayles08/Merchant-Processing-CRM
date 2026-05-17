import type { Metadata } from "next";
import { Geist_Mono, Instrument_Serif, Inter } from "next/font/google";
import { GlobalCopilotWidget } from "@/components/copilot/global-copilot-widget";
import { PresenceHeartbeat } from "@/components/presence-heartbeat";
import { brand } from "@/lib/branding";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: brand.companyName,
  description: `${brand.productName} for agents, managers, and admins.`,
  icons: {
    icon: "/merchantdesk-mark.png",
    shortcut: "/merchantdesk-mark.png",
    apple: "/merchantdesk-mark.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSerif.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <PresenceHeartbeat />
        <GlobalCopilotWidget />
      </body>
    </html>
  );
}
