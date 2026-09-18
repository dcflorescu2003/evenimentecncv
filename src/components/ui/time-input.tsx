import * as React from "react";
import { Clock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isValidTime24h, normalizeTimeInput } from "@/lib/time";

interface TimeInputProps extends Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
}

const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(
  ({ className, value, onChange, onBlur, required, ...props }, ref) => {
    const invalid = value.length === 5 && !isValidTime24h(value);

    return (
      <div className={cn("relative", className)}>
        <Input
          {...props}
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={5}
          placeholder="HH:MM"
          value={value}
          required={required}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(normalizeTimeInput(event.target.value))}
          onBlur={(event) => {
            onBlur?.(event);
            if (value && !isValidTime24h(value)) event.currentTarget.setCustomValidity("Introduceți o oră între 00:00 și 23:59.");
            else event.currentTarget.setCustomValidity("");
          }}
          onInput={(event) => event.currentTarget.setCustomValidity("")}
          className="pr-9 tabular-nums"
        />
        <Clock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    );
  },
);

TimeInput.displayName = "TimeInput";

export { TimeInput };