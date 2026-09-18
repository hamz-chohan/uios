"use client";

import { useParams } from "next/navigation";
import { SkillStudio } from "@/components/SkillStudio";

export default function SkillStudioPage() {
  const { id } = useParams<{ id: string }>();
  return <SkillStudio skillId={id} />;
}
