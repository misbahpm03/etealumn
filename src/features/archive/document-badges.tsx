import { Badge } from "@/components/ui/badge";
import type {
  DocumentStatus,
  DocumentVisibility,
} from "@/types";

const STATUS_TONES: Record<DocumentStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  UNDER_REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  ARCHIVED: "neutral",
};

const VISIBILITY_LABELS: Record<DocumentVisibility, string> = {
  PUBLIC: "Public",
  STUDENT_ONLY: "Students & alumni",
  FACULTY_ONLY: "Faculty & staff",
  PRIVATE: "Private",
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{status.replace("_", " ")}</Badge>;
}

export function DocumentVisibilityBadge({
  visibility,
}: {
  visibility: DocumentVisibility;
}) {
  return <Badge tone="neutral">{VISIBILITY_LABELS[visibility]}</Badge>;
}
