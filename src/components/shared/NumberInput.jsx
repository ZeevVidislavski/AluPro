import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Numeric field for prices, sizes, quantities and percentages.
 * Behavior is the same as <Input type="number">; it only adds left-to-right digits,
 * tabular numerals and an optional unit suffix (e.g. "ס\"מ", "%").
 */
const NumberInput = forwardRef(({ className, suffix, inputMode = "decimal", ...props }, ref) => {
  const field = (
    <Input
      ref={ref}
      type="number"
      dir="ltr"
      inputMode={inputMode}
      className={cn("tabular-nums", suffix && "pe-10", className)}
      {...props}
    />
  );
  if (!suffix) return field;
  return (
    <div className="relative">
      {field}
      <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">{suffix}</span>
    </div>
  );
});
NumberInput.displayName = "NumberInput";

export default NumberInput;
