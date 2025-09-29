import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/providers/session-provider";
import { MaintenanceModeProvider } from "@/components/maintenance-mode";
import { SentryProvider } from "@/components/sentry-provider";
import { ServiceWorkerProvider } from "@/components/service-worker-provider";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Fake Products Detector - Verify Before You Buy",
  description: "Discover counterfeit products before you buy. Scan, verify authenticity with NAFDAC integration and protect your health.",
  keywords: ["fake products", "counterfeit detection", "product verification", "NAFDAC", "drug safety", "health protection"],
  authors: [{ name: "Sam TECH" }],
  creator: "Fake Products Detector",
  publisher: "Fake Products Detector",
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "https://scan.sampidia.com",
    title: "Fake Products Detector - Verify Before You Buy",
    description: "Discover counterfeit products before you buy. Scan, verify authenticity with NAFDAC integration and protect your health.",
    siteName: "Fake Products Detector",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fake Products Detector - Verify Before You Buy",
    description: "Discover counterfeit products before you buy. Scan, verify authenticity with NAFDAC integration and protect your health.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
 width: "device-width",
 initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteKey = process.env.RECAPTCHA_SITE_KEY || process.env.RECAPTCHA_SITE_KEY_PLACEHOLDER;

  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ProductChecker" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="msapplication-TileImage" content="/logo.png" />
        <meta name="msapplication-TileColor" content="#2563eb" />

        {/* Google reCAPTCHA v2 invisible - Loaded conditionally per page */}
      </head>
      <body className="font-sans antialiased">
        <ServiceWorkerProvider>
          <SentryProvider>
            <AuthProvider>
              <MaintenanceModeProvider>
                {children}
                <PWAInstallPrompt />
              </MaintenanceModeProvider>
            </AuthProvider>
          </SentryProvider>
        </ServiceWorkerProvider>
      </body>
    </html>
  );
}
