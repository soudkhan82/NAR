import type { Metadata } from "next";
import "./globals.css";
import MainNav from "@/app/components/main-nav";
import { SonnerProvider } from "@/app/components/sonner-provider";
import AuthShell from "@/app/components/auth-shell";

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
        <AuthShell>
          {/* MainNav will be smart and hide itself on /login */}
          <MainNav />
          <div className="pt-4">{children}</div>
        </AuthShell>

        <SonnerProvider />
      </body>
    </html>
  );
}
