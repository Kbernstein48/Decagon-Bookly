import type { Metadata } from "next";
import { headers } from "next/headers";
import { ChatWidget } from "@/components/ChatWidget";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "Bookly — Find your next favorite story";
  const description = "A fictional bookstore with a realtime AI customer-support concierge.";
  return {
    metadataBase: new URL(origin),
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: origin,
      images: [{ url: `${origin}/og.png`, width: 1728, height: 907, alt: "Bookly — Stories worth finding. Support worth trusting." }],
    },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] },
  };
}

export const viewport = { themeColor: "#f8f2e8" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}<ChatWidget /></body>
    </html>
  );
}
