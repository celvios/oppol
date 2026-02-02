import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import "@/lib/rpc-monitor"; // Track RPC usage

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OPoll Protocol",
  description: "Decentralized prediction markets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
