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

// Shared label maps (previously duplicated in ProjectDetails, ProfitabilityReport and Finance).
export const PAYMENT_TYPE_LABELS = { advance: "מקדמה", interim: "תשלום ביניים", final: "תשלום סופי" };
export const PAYMENT_METHOD_LABELS = { cash: "מזומן", check: "צ'ק", transfer: "העברה בנקאית", credit: "אשראי" };
export const ORDER_TYPE_LABELS = { aluminum: "אלומיניום", hardware: "פרזול", glass: "זכוכית", extras: "תוספות" };
