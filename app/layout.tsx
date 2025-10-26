import type { Metadata } from "next";
import "./globals.css";
// ⬇️ add these
import MainNav from "@/components/main-nav";
import { SonnerProvider } from "@/components/sonner-provider"; // see below if you don't have it

export const metadata: Metadata = {
  title: "ZTrack",
  description: "Network reporting & inventory platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <MainNav />
        {/* Padding top to avoid content under sticky nav */}
        <div className="pt-4">{children}</div>
        <SonnerProvider />
      </body>
    </html>
  );
}
