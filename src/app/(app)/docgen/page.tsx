import type { Metadata } from "next";
import { DocumentsDashboard } from "@/components/DocumentsDashboard";

export const metadata: Metadata = {
  title: "DocGen - UIOS Content Studio",
};

// The module landing: recent documents or the generate-new path.
// WorkspaceShell lives at /docgen/new and /docgen/[docId].
export default function DocgenPage() {
  return <DocumentsDashboard />;
}
