// Technical-spec helpers for quote items (contractor / customer spec PDFs).

export const OPENING_TYPES = [
  { value: "slide2", label: "הזזה דו כנפי", system: "חלון הזזה דו כנפי" },
  { value: "slide3", label: "הזזה תלת כנפי", system: "חלון הזזה 3 כנפיים" },
  { value: "casement", label: "כנף פותחת", system: "חלון פתיחה פנימה" },
  { value: "kip", label: "קיפ", system: "חלון פתיחה קיפ" },
  { value: "fixed", label: "קבוע", system: "חלון קבוע" },
  { value: "door", label: "דלת", system: "דלת פתיחה פנימה" },
];

export const SPEC_FIELDS = ["location", "opening_type", "profile_series", "system_type", "glazing", "shading"];

export function openingLabel(value) {
  return OPENING_TYPES.find((o) => o.value === value)?.label || "";
}

export function defaultSystemType(value) {
  return OPENING_TYPES.find((o) => o.value === value)?.system || "";
}

// Area of one unit in m² (width/height in cm).
export function itemAreaSqm(item) {
  const w = parseFloat(item.width_cm) || 0;
  const h = parseFloat(item.height_cm) || 0;
  return (w * h) / 10000;
}

// Spec fields to persist. A DB without migration 0027 would reject unknown
// columns, so they are only sent when the item uses them or the row already
// came back from the DB with those columns.
export function specPayload(item) {
  const hasColumns = "opening_type" in item;
  const used = SPEC_FIELDS.some((f) => item[f]);
  if (!hasColumns && !used) return {};
  return Object.fromEntries(SPEC_FIELDS.map((f) => [f, item[f] || null]));
}

// Spec values for printing: explicit fields win; otherwise they are derived
// from the catalog components on the item (category_snapshot series / glass /
// shutter / mesh / structure), so a quote built from the catalog needs no
// retyping.
export function resolveSpec(item, components = []) {
  const names = (cats) =>
    components.filter((c) => cats.includes(c.category_snapshot)).map((c) => c.name_snapshot).filter(Boolean).join(" + ");
  return {
    profile_series: item.profile_series || names(["series"]),
    system_type: item.system_type || defaultSystemType(item.opening_type) || names(["structure"]),
    glazing: item.glazing || names(["glass"]),
    shading: item.shading || names(["shutter", "mesh"]),
  };
}
