/**
 * Two-step explicit calculation engine for production components.
 * No formula parsing — sequential condition-based logic.
 */

function applyOp(temp, op, val) {
  if (op === "add")      return temp + (val ?? 0);
  if (op === "subtract") return temp - (val ?? 0);
  if (op === "multiply") return temp * (val ?? 1);
  if (op === "divide")   return (val && val !== 0) ? temp / val : temp;
  return temp; // none or unknown
}

export function calculateLength(comp, opening_width, opening_height) {
  if (!comp.length_base) return null;

  // Step 1: resolve base
  let temp;
  if (comp.length_base === "opening_width")  temp = opening_width;
  else if (comp.length_base === "opening_height") temp = opening_height;
  else if (comp.length_base === "fixed")     return comp.length_val1 ?? 0;

  // Step 2: apply first operation
  if (comp.length_op1 && comp.length_op1 !== "none") {
    temp = applyOp(temp, comp.length_op1, comp.length_val1);
  }

  // Step 3: apply second operation
  if (comp.length_op2 && comp.length_op2 !== "none") {
    temp = applyOp(temp, comp.length_op2, comp.length_val2);
  }

  return temp;
}

export function calculateWidth(comp, opening_width, opening_height) {
  if (!comp.width_base) return null;

  let temp;
  if (comp.width_base === "opening_width")  temp = opening_width;
  else if (comp.width_base === "opening_height") temp = opening_height;
  else if (comp.width_base === "fixed")     return comp.width_val1 ?? 0;

  if (comp.width_op1 && comp.width_op1 !== "none") {
    temp = applyOp(temp, comp.width_op1, comp.width_val1);
  }

  if (comp.width_op2 && comp.width_op2 !== "none") {
    temp = applyOp(temp, comp.width_op2, comp.width_val2);
  }

  return temp;
}

export function calculateComponents(components, opening_width, opening_height) {
  return components.map(comp => ({
    ...comp,
    calculated_length: calculateLength(comp, opening_width, opening_height),
    calculated_width:  calculateWidth(comp, opening_width, opening_height)
  }));
}