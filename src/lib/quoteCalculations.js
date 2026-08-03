/**
 * Calculate the value of a single component given item dimensions and item quantity.
 * comp.quantity = כמות הרכיב (ברירת מחדל 1)
 * itemQty = כמות הפריט (יחידות)
 */
export function calcComponentValue(component, widthCm, heightCm, itemQty = 1) {
  const w = parseFloat(widthCm) || 0;
  const h = parseFloat(heightCm) || 0;
  const price = parseFloat(component.price_snapshot) || 0;
  const compQty = (component.quantity != null && component.quantity !== "") ? parseFloat(component.quantity) : 1;
  const qty = parseFloat(itemQty) || 1;

  switch (component.pricing_method_snapshot) {
    case "sqm":          return (w * h / 10000) * price * compQty * qty;
    case "meter":
    case "meter_width":  return (w / 100) * price * compQty * qty;
    case "meter_height": return (h / 100) * price * compQty * qty;
    case "unit":         return price * compQty * qty;
    default:             return 0;
  }
}

/**
 * Calculate total price for a quote item (sum of all components × all quantities)
 */
export function calcItemTotal(components, widthCm, heightCm, itemQty = 1) {
  return components.reduce((sum, comp) => {
    return sum + calcComponentValue(comp, widthCm, heightCm, itemQty);
  }, 0);
}

/**
 * Generate auto-description from component names in order
 */
export function generateDescription(components) {
  return components.map(c => c.name_snapshot).join(" + ");
}

/**
 * Format pricing method label
 */
export function pricingMethodLabel(method) {
  const labels = {
    sqm: 'מ"ר',
    meter: "מ' רץ רוחב",
    meter_width: "מ' רץ רוחב",
    meter_height: "מ' רץ גובה",
    unit: "יחידה"
  };
  return labels[method] || method;
}

export const CATEGORY_LABELS = {
  product: "מוצר",
  series: "סדרה",
  structure: "מבנה",
  shutter: "תריס",
  motor: "מנוע",
  mesh: "רשת",
  addon: "תוספת",
  glass: "זכוכית",
  other: "אחר"
};

export const CATEGORY_COLORS = {
  product: "bg-blue-100 text-blue-700",
  series: "bg-indigo-100 text-indigo-700",
  structure: "bg-slate-100 text-slate-700",
  shutter: "bg-purple-100 text-purple-700",
  motor: "bg-orange-100 text-orange-700",
  mesh: "bg-green-100 text-green-700",
  addon: "bg-amber-100 text-amber-700",
  glass: "bg-cyan-100 text-cyan-700",
  other: "bg-gray-100 text-gray-700"
};