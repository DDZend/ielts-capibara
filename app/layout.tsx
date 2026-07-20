import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import "./role-access.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "IELTS Mastery — Your Clear Path to Band 7.0";
  const description = "Personal IELTS preparation across all four skills, with a focused study plan, live teacher support and daily guidance from Capi Coach.";
  return {
    metadataBase: new URL(origin),
    title,
    description,
    icons: { icon: "/capi-profile.png", shortcut: "/capi-profile.png" },
    openGraph: { title, description, type: "website", images: [{ url: new URL("/og.png", origin), width: 1734, height: 907, alt: "IELTS Mastery — Your clearest path to IELTS 7.0." }] },
    twitter: { card: "summary_large_image", title, description, images: [new URL("/og.png", origin)] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
