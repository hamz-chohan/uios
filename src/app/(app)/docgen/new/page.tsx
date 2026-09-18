import type { Metadata } from "next";
import WorkspaceShell from "@/components/WorkspaceShell";

export const metadata: Metadata = {
  title: "DocGen - New document",
};

export default function NewDocumentPage() {
  return <WorkspaceShell />;
}
