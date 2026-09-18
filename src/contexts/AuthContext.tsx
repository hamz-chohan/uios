"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  AUTH_KEY,
  PERSONAS,
  type Persona,
  type PersonaId,
} from "@/lib/rbac";

interface Session {
  persona: PersonaId;
  signedInAt: string;
}

interface AuthContextType {
  persona: Persona | null;
  loading: boolean;
  signIn: (personaId: PersonaId) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (!session?.persona || !PERSONAS[session.persona]) return null;
    return session;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = readSession();
    setPersona(session ? PERSONAS[session.persona] : null);
    setLoading(false);
  }, []);

  const signIn = (personaId: PersonaId) => {
    const next: Session = {
      persona: personaId,
      signedInAt: new Date().toISOString(),
    };
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(next));
    setPersona(PERSONAS[personaId]);
  };

  const signOut = () => {
    sessionStorage.removeItem(AUTH_KEY);
    setPersona(null);
  };

  return (
    <AuthContext.Provider value={{ persona, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
