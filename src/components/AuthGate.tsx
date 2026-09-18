"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { areaFromPath, canAccess, loginHref } from "@/lib/rbac";

function Gate({ children }: { children: React.ReactNode }) {
  const { persona, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (loading) return;
    if (!persona && !isLogin) {
      router.replace(loginHref(pathname === "/" ? null : pathname));
      return;
    }
    if (!persona) return;
    const area = areaFromPath(pathname);
    if (area && !canAccess(area, persona.id)) {
      router.replace(loginHref(pathname));
    }
  }, [persona, loading, isLogin, pathname, router]);

  if (isLogin) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent"
          role="status"
          aria-label="Checking session"
        />
      </div>
    );
  }

  if (!persona) return null;

  const area = areaFromPath(pathname);
  if (area && !canAccess(area, persona.id)) return null;

  return <>{children}</>;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Gate>{children}</Gate>
    </AuthProvider>
  );
}
