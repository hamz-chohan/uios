"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { canAccess, loginHref } from "@/lib/rbac";

export function DocGenLink({
  href = "/docgen",
  className,
  children = "DocGen",
}: {
  href?: string;
  className?: string;
  children?: ReactNode;
}) {
  const { persona } = useAuth();
  const allowed = persona ? canAccess("docgen", persona.id) : false;
  return (
    <Link href={allowed ? href : loginHref(href)} className={className}>
      {children}
    </Link>
  );
}
