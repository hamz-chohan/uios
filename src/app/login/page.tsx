"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  PERSONAS,
  areaFromPath,
  canAccess,
  safeReturnPath,
  type PersonaId,
} from "@/lib/rbac";
import styles from "./login.module.css";

const ACCOUNTS = Object.keys(PERSONAS) as PersonaId[];

function suggestedAccount(next: string | null): PersonaId | "" {
  if (!next) return "";
  const area = areaFromPath(next);
  if (area === "docgen" || area === "library") return "document-creator";
  if (area === "skills") return "skills-creator";
  return "";
}

function LoginForm() {
  const { persona, loading, signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeReturnPath(searchParams.get("next"));
  const [selected, setSelected] = useState<PersonaId | "">(
    suggestedAccount(next)
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autofillLocked, setAutofillLocked] = useState(true);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const field = passwordRef.current;
    if (!field) return;
    field.value = "";
    setPassword("");
  }, []);

  useEffect(() => {
    if (loading || !persona) return;
    const area = next ? areaFromPath(next) : "home";
    if (!next || !area || canAccess(area, persona.id)) {
      router.replace(next && area && canAccess(area, persona.id) ? next : "/");
    }
  }, [persona, loading, next, router]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      setError("Choose a workspace role to continue.");
      return;
    }
    if (!password.trim()) {
      setError("Enter the workspace password.");
      return;
    }
    const area = next ? areaFromPath(next) : null;
    if (area && !canAccess(area, selected)) {
      setError(
        `${PERSONAS[selected].role} cannot open that area. Choose ${
          suggestedAccount(next)
            ? PERSONAS[suggestedAccount(next) as PersonaId].role
            : "an account with access"
        }.`
      );
      return;
    }
    signIn(selected);
    router.replace(next && area && canAccess(area, selected) ? next : "/");
  }

  const heading = next?.startsWith("/docgen")
    ? "Sign in to open DocGen"
    : next?.startsWith("/skills")
      ? "Sign in to open Skill Creator"
      : "Sign in to UIOS";

  return (
    <div className={styles.gate}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <svg
            className={styles.mark}
            viewBox="0 0 32 32"
            aria-hidden="true"
          >
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
          <div className={styles.copy}>
            <p className={styles.sso}>Request Manager · Enterprise SSO</p>
            <h1 className={`title-mark ${styles.heading}`}>{heading}</h1>
            <p className={styles.sub}>
              Unified access to DocGen, Skill Creator, Library, and Admin.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {next?.startsWith("/docgen") && !error && (
            <p className={styles.hint} role="status">
              DocGen is a Document Creator workspace. Sign in as Sarah Chen, or
              as Administrator.
            </p>
          )}
          <div>
            <label htmlFor="role" className={styles.label}>
              Workspace account
            </label>
            <select
              id="role"
              name="role"
              required
              className={styles.input}
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value as PersonaId | "");
                setError(null);
              }}
            >
              <option value="">Choose an account…</option>
              {ACCOUNTS.map((id) => (
                <option key={id} value={id}>
                  {PERSONAS[id].name} · {PERSONAS[id].role}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <div className={styles.password}>
              <input
                ref={passwordRef}
                id="password"
                name="workspace-pass"
                type={showPassword || !password ? "text" : "password"}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                readOnly={autofillLocked}
                className={styles.input}
                placeholder="Enter your password"
                value={password}
                onFocus={() => setAutofillLocked(false)}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className={styles.toggle}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                    <path d="M9.9 5.2A9.8 9.8 0 0 1 12 5c5 0 9.3 3.1 11 7.5a11.7 11.7 0 0 1-4 4.9" />
                    <path d="M6.1 6.1C4 7.6 2.4 9.6 1 12.5 2.7 16.9 7 20 12 20c1.7 0 3.3-.4 4.7-1.1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M1 12.5C2.7 8.1 7 5 12 5s9.3 3.1 11 7.5C20.3 16.9 16 20 12 20S2.7 16.9 1 12.5Z" />
                    <circle cx="12" cy="12.5" r="3.5" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button type="submit" className={styles.submit}>
            Sign in
          </button>
        </form>
        <p className={styles.foot}>
          Prototype only. Each account maps to one role. After sign-in you see
          that workspace only - no persona switcher.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.gate}>
          <div className={styles.card}>
            <p className={styles.sub}>Loading sign-in…</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
