import type { UnitStatus } from "@/lib/types";

// Human labels for the unit statuses (chips uppercase via CSS).
export const STATUS_LABELS: Record<UnitStatus, string> = {
  PENDING: "Pending",
  FILLED_CITED: "Filled · Cited",
  NEEDS_AUTHOR: "Needs author",
  NEEDS_VALIDATION: "Needs validation",
  OVERRIDDEN: "Overridden",
  APPROVED: "Approved",
};

export function StatusChip({
  status,
  count,
  className,
}: {
  status: UnitStatus;
  count?: number; // dashboard roll-up: "2 × Needs author"
  className?: string;
}) {
  return (
    <span
      className={className ? `chip ${className}` : "chip"}
      data-status={status}
    >
      {count !== undefined && count > 1 ? `${count} × ` : ""}
      {STATUS_LABELS[status]}
    </span>
  );
}
