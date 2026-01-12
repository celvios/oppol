import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/lib/web3-provider";
import AnimatedBackground from "@/components/ui/AnimatedBackground";
import { SettingsProvider } from "@/lib/settings-context";
import SettingsToggle from "@/components/ui/SettingsToggle";
import BottomNav from "@/components/mobile/BottomNav";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OPoll | Decentralized Prediction Market",
  description: "Predict the future. Own the outcome.",
  themeColor: "#05050A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased bg-void text-text-primary`}
        suppressHydrationWarning
      >
        <Web3Provider>
          <SettingsProvider>
            <AnimatedBackground />
            {children}
            <SettingsToggle />
            <BottomNav />
          </SettingsProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
