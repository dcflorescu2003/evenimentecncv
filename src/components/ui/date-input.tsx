import * as React from "react";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";

interface DateInputProps {
  value: string; // yyyy-mm-dd
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  placeholder?: string;
}

/**
 * Custom date input that displays dd.mm.yyyy format
 * Internally stores yyyy-mm-dd for database compatibility
 */
export function DateInput({ value, onChange, className, id, placeholder = "zz.ll.aaaa" }: DateInputProps) {
  const hiddenRef = React.useRef<HTMLInputElement>(null);

  // Convert yyyy-mm-dd to dd.mm.yyyy for display
  function toDisplay(isoDate: string): string {
    if (!isoDate) return "";
    const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return `${match[3]}.${match[2]}.${match[1]}`;
    return isoDate;
  }

  // Convert dd.mm.yyyy to yyyy-mm-dd for storage
  function toIso(displayDate: string): string {
    const match = displayDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    return displayDate;
  }

  const [displayValue, setDisplayValue] = React.useState(toDisplay(value));

  React.useEffect(() => {
    setDisplayValue(toDisplay(value));
  }, [value]);

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value.replace(/[^\d.]/g, "");

    // Auto-insert dots
    const digits = raw.replace(/\./g, "");
    if (digits.length <= 2) {
      raw = digits;
    } else if (digits.length <= 4) {
      raw = `${digits.slice(0, 2)}.${digits.slice(2)}`;
    } else {
      raw = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 8)}`;
    }

    setDisplayValue(raw);

    // Only fire onChange when we have a complete valid date
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
      const iso = toIso(raw);
      // Validate it's a real date
      const d = new Date(iso);
      if (!isNaN(d.getTime())) {
        onChange(iso);
      }
    }
  }

  function openNativePicker() {
    hiddenRef.current?.showPicker?.();
  }

  function handleNativeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (val) {
      onChange(val);
      setDisplayValue(toDisplay(val));
    }
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleTextChange}
        placeholder={placeholder}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
      />
      <button
        type="button"
        onClick={openNativePicker}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
      >
        <CalendarDays className="h-4 w-4" />
      </button>
      {/* Hidden native date input for calendar picker fallback */}
      <input
        ref={hiddenRef}
        type="date"
        value={value}
        onChange={handleNativeChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}
