import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reseller — Private AI Gateway",
  description: "370+ models. One endpoint. Plans, BYOK, and usage analytics.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
