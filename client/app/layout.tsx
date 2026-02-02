import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ReownProvider } from "@/lib/reown-provider";
import { Web3Provider } from "@/lib/web3-provider";
import AnimatedBackground from "@/components/ui/AnimatedBackground";
import { SettingsProvider } from "@/lib/settings-context";
import UserRegistrationManager from "@/components/UserRegistrationManager";
import Header from "@/components/ui/Header";
import { NetworkChecker } from "@/components/NetworkChecker";
import { RPCMonitorInit } from "@/components/RPCMonitorInit";

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
  icons: {
    icon: '/brand-logo.png',
    shortcut: '/brand-logo.png',
    apple: '/brand-logo.png',
  },
};

export const viewport = {
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
        suppressHydrationWarning={true}
      >
        <RPCMonitorInit />
        <div className="min-h-screen" suppressHydrationWarning={true}>
          <Web3Provider>
            <ReownProvider>
              <SettingsProvider>
                <NetworkChecker />
                <AnimatedBackground />
                <UserRegistrationManager />
                <Header />
                {children}
              </SettingsProvider>
            </ReownProvider>
          </Web3Provider>
        </div>
      </body>
    </html>
  );
}
