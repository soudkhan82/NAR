"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

type NavItem = { href: string; label: string };

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home" }, // 🏠 Added Home
  { href: "/Eutran", label: "EUTRAN" },
  { href: "/eas", label: "EAS" },
  { href: "/isp", label: "ISP" },
  { href: "/Availability", label: "Availability" },
  { href: "/traffic", label: "Traffic" },
  { href: "/Lpa", label: "LPA" },
  { href: "/assets", label: "Assets" },
  { href: "/transactions", label: "Transactions" },
];

function NavLink({ href, label }: NavItem) {
  const pathname = usePathname();
  const active =
    pathname === href || (href !== "/" && pathname?.startsWith(href + "/"));

  return (
    <Link
      href={href}
      className={[
        "px-3 py-2 rounded-md text-sm font-medium transition-colors",
        active
          ? "bg-emerald-600 text-white"
          : "text-foreground/80 hover:text-foreground hover:bg-emerald-50",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default function MainNav() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Brand / Logo */}
        <Link
          href="/"
          className="font-extrabold text-emerald-700 tracking-tight"
        >
          ZTrack
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        {/* Mobile menu */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <div className="mt-8 flex flex-col gap-2">
                {NAV_ITEMS.map((item) => (
                  <NavLink key={item.href} {...item} />
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
