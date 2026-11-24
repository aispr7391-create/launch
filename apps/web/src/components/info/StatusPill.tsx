import type { ModuleStatus } from "@/config/modules";
import type { PhaseState } from "@/content/site";
import { Badge } from "@/components/ui/primitives";

export function ModuleStatusPill({ status }: { status: ModuleStatus }) {
  if (status === "live") return <Badge tone="up">Live</Badge>;
  if (status === "partial") return <Badge tone="info">Partial</Badge>;
  return <Badge>Not built</Badge>;
}

export function PhasePill({ state }: { state: PhaseState }) {
  if (state === "done") return <Badge tone="up">Done</Badge>;
  if (state === "in-progress") return <Badge tone="info">In progress</Badge>;
  return <Badge>Planned</Badge>;
}
