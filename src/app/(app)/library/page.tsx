import type { Metadata } from "next";
import { LibraryView } from "@/components/LibraryView";

export const metadata: Metadata = {
  title: "Content Library - DocGen",
};

export default function LibraryPage() {
  return <LibraryView />;
}
