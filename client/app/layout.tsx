import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/lib/web3-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OPOLL | WhatsApp Prediction Market",
  description: "Trade on information directly from WhatsApp, powered by BNB Chain",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${robotoMono.variable} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <Web3Provider>
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}
