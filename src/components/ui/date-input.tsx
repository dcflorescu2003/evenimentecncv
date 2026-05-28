import * as React from "react";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ro } from "date-fns/locale";

interface DateInputProps {
  value: string; // yyyy-mm-dd
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  placeholder?: string;
}

function toDisplay(isoDate: string): string {
  if (!isoDate) return "";
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : isoDate;
}

function toIso(display: string): string {
  const m = display.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : display;
}

function fromIsoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? undefined : d;
}

function dateToIso(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/**
 * Custom date input — display dd.mm.yyyy, storage yyyy-mm-dd.
 * Calendar picker works in cross-origin iframes (preview), unlike native showPicker.
 */
export function DateInput({ value, onChange, className, id, placeholder = "zz.ll.aaaa" }: DateInputProps) {
  const [displayValue, setDisplayValue] = React.useState(toDisplay(value));
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setDisplayValue(toDisplay(value));
  }, [value]);

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value.replace(/[^\d.]/g, "");
    const digits = raw.replace(/\./g, "");
    if (digits.length <= 2) raw = digits;
    else if (digits.length <= 4) raw = `${digits.slice(0, 2)}.${digits.slice(2)}`;
    else raw = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 8)}`;

    setDisplayValue(raw);

    if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
      const iso = toIso(raw);
      const d = new Date(iso);
      if (!isNaN(d.getTime())) onChange(iso);
    }
  }

  const selected = fromIsoToDate(value);

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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
            aria-label="Deschide calendarul"
          >
            <CalendarDays className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-50" align="end">
          <Calendar
            mode="single"
            locale={ro}
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => {
              if (d) {
                const iso = dateToIso(d);
                onChange(iso);
                setDisplayValue(toDisplay(iso));
                setOpen(false);
              }
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
