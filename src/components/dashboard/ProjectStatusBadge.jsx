import StatusBadge from "@/components/shared/StatusBadge";
import { PROJECT_STATUS } from "@/lib/statuses";

export default function ProjectStatusBadge({ status }) {
  const config = PROJECT_STATUS[status] || PROJECT_STATUS.draft;
  return <StatusBadge tone={config.tone}>{config.label}</StatusBadge>;
}
