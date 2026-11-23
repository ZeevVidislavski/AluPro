// Central status map: label + semantic tone per entity.
// Labels are kept exactly as they were on each screen (wording is a separate decision).
export const QUOTE_STATUS = {
  draft: { label: "טיוטה", tone: "neutral" },
  sent: { label: "נשלח", tone: "info" },
  approved: { label: "אושר", tone: "success" },
  rejected: { label: "נדחה", tone: "danger" },
};

export const PROJECT_STATUS = {
  draft: { label: "טיוטה", tone: "neutral" },
  approved: { label: "מאושר", tone: "info" },
  completed: { label: "הושלם", tone: "success" },
};
