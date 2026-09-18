"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { canAccess, type NavArea } from "@/lib/rbac";

const NAV_ITEMS: {
  href: string;
  label: string;
  area: NavArea;
  isActive: (pathname: string) => boolean;
  icon: ReactNode;
}[] = [
  {
    href: "/",
    label: "Home",
    area: "home",
    isActive: (pathname) => pathname === "/",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: "/docgen",
    label: "DocGen",
    area: "docgen",
    isActive: (pathname) => pathname.startsWith("/docgen"),
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    href: "/skills",
    label: "Skill Creator",
    area: "skills",
    isActive: (pathname) => pathname.startsWith("/skills"),
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/library",
    label: "Library",
    area: "library",
    isActive: (pathname) => pathname.startsWith("/library"),
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <line x1="9" y1="7" x2="15" y2="7" />
      </svg>
    ),
  },
];

export function RailNav() {
  const { persona } = useAuth();
  const pathname = usePathname();

  const items = NAV_ITEMS.filter(
    (item) => persona && canAccess(item.area, persona.id)
  );

  return (
    <nav
      aria-label="Primary"
      className="z-20 flex w-[232px] shrink-0 flex-col border-r border-hairline bg-white px-3 pb-4 pt-3.5"
    >
      <Link
        href="/"
        aria-label="UIOS Content Studio"
        className="mb-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5"
      >
        <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
          <rect width="32" height="32" rx="8" fill="#111" />
          <path
            d="M9 8.5v9.2c0 3.9 3.1 7 7 7s7-3.1 7-7V8.5"
            fill="none"
            stroke="#fff"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <circle cx="24.2" cy="24.2" r="3.1" fill="#6b38fb" />
        </svg>
        <span>
          <span className="block text-[15px] font-bold tracking-[0.16em] text-ink">
            UIOS
          </span>
          <span className="block text-[9px] font-semibold tracking-[0.1em] text-muted uppercase">
            Content Studio
          </span>
        </span>
      </Link>

      {items.map((item) => {
        const active = item.isActive(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] ${
              active
                ? "bg-[#f3f4f6] font-semibold text-ink"
                : "font-medium text-[#374151] hover:bg-[#f3f4f6] hover:text-ink"
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}

      <div className="flex-1" aria-hidden />

      <div className="border-t border-hairline px-2 pt-3">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.04em] text-[#4b5563]">
          <i className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" aria-hidden />
          Demo · Medical affairs
        </p>
      </div>
    </nav>
  );
}
