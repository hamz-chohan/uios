export type PersonaId = "document-creator" | "skills-creator" | "administrator";

export interface Persona {
  id: PersonaId;
  name: string;
  role: string;
  initials: string;
  email: string;
  homeLede: string;
}

export const PERSONAS: Record<PersonaId, Persona> = {
  "document-creator": {
    id: "document-creator",
    name: "Sarah Chen",
    role: "Document Creator",
    initials: "SC",
    email: "sarah.chen@uios.studio",
    homeLede:
      "Generate and approve documents from skills that Skill Creator has published.",
  },
  "skills-creator": {
    id: "skills-creator",
    name: "Maya Patel",
    role: "Skill Creator",
    initials: "MP",
    email: "maya.patel@uios.studio",
    homeLede:
      "Write a portable .md skill from a prompt, then publish it for Document Creators.",
  },
  administrator: {
    id: "administrator",
    name: "Alex Rivera",
    role: "Administrator",
    initials: "AR",
    email: "alex.rivera@uios.studio",
    homeLede:
      "Skill registry, DocGen usage, and people - the operating view of the workspace.",
  },
};

export const AUTH_KEY = "uios-auth-session";

export type NavArea = "home" | "docgen" | "skills" | "library";

export const RBAC: Record<NavArea, PersonaId[]> = {
  home: ["document-creator", "skills-creator", "administrator"],
  docgen: ["document-creator", "administrator"],
  library: ["document-creator", "administrator"],
  skills: ["skills-creator", "administrator"],
};

export function canAccess(area: NavArea, persona: PersonaId): boolean {
  return RBAC[area].includes(persona);
}

export function areaFromPath(pathname: string): NavArea | null {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/docgen")) return "docgen";
  if (pathname.startsWith("/library")) return "library";
  if (pathname.startsWith("/skills")) return "skills";
  return null;
}

// In-app return paths only - never an open redirect.
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return null;
  }
  return raw;
}

export function loginHref(next?: string | null): string {
  const path = safeReturnPath(next);
  return path ? `/login?next=${encodeURIComponent(path)}` : "/login";
}
