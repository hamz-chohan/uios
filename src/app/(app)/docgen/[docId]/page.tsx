import type { Metadata } from "next";
import WorkspaceShell from "@/components/WorkspaceShell";

export const metadata: Metadata = {
  title: "DocGen - Document",
};

// Deep link to a persisted document - loads it straight into review.
export default async function DocumentPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  const { docId } = await params;
  return <WorkspaceShell initialDocId={docId} />;
}
