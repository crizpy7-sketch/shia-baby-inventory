import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shia Baby — Store API",
  description: "Backend for the Shia Baby storefront.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
