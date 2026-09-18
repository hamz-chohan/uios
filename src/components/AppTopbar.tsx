"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { WorkspaceSearch } from "@/components/WorkspaceSearch";
import { useAuth } from "@/contexts/AuthContext";

function crumbs(pathname: string): { href: string; label: string }[] {
  const items = [{ href: "/", label: "Home" }];
  if (pathname.startsWith("/docgen")) {
    items.push({ href: "/docgen", label: "DocGen" });
    if (pathname === "/docgen/new") items.push({ href: "/docgen/new", label: "New document" });
    else if (pathname !== "/docgen") items.push({ href: pathname, label: "Document" });
  } else if (pathname.startsWith("/skills")) {
    items.push({ href: "/skills", label: "Skill Creator" });
    if (pathname === "/skills/new") items.push({ href: "/skills/new", label: "New skill" });
    else if (pathname !== "/skills") items.push({ href: pathname, label: "Skill" });
  } else if (pathname.startsWith("/library")) {
    items.push({ href: "/library", label: "Library" });
  }
  return items;
}

export function AppTopbar() {
  const { persona, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const trail = crumbs(pathname);

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-hairline bg-white px-5">
      <nav aria-label="Breadcrumb" className="min-w-0 text-[13px] font-medium text-muted">
        {trail.map((c, i) => {
          const last = i === trail.length - 1;
          return (
            <span key={c.href + i}>
              {i > 0 && <span className="mx-1.5 text-faint">/</span>}
              {last ? (
                <span className="font-semibold text-ink">{c.label}</span>
              ) : (
                <Link href={c.href} className="font-medium text-[#6b38fb] no-underline hover:text-[#5529e0] hover:no-underline">
                  {c.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      <WorkspaceSearch />

      <div className="ml-auto flex items-center gap-2.5">
      <span className="proto hidden lg:inline">
        Guided demo
      </span>

      {persona && (
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#111] text-[10px] font-bold text-white">
            {persona.initials}
          </span>
          <span className="hidden min-w-0 sm:grid">
            <strong className="truncate text-[12px] font-semibold">{persona.name}</strong>
            <span className="truncate text-[11px] text-muted">{persona.role}</span>
          </span>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-[11px] font-semibold text-muted hover:bg-[#f0f1f3] hover:text-ink"
            onClick={() => {
              signOut();
              router.replace("/login");
            }}
          >
            Sign out
          </button>
        </div>
      )}
      </div>
    </header>
  );
}
