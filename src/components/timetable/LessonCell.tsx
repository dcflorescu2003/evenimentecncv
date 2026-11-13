import { MapPin, Users } from "lucide-react";

export interface LessonPart { subject: string; room?: string | null; teacher?: string | null; className?: string | null }

/** O oră (eventual pe grupe): materie, clasă, sală și profesor scris mai mic. */
export default function LessonCell({ parts }: { parts: LessonPart[] }) {
  return (
    <div className="flex flex-col gap-1.5 text-left">
      {parts.map((p, i) => (
        <div key={i} className={i > 0 ? "border-t border-dashed pt-1.5" : ""}>
          <div className="text-sm font-medium leading-tight">{p.subject}</div>
          {p.className && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" />{p.className}</div>
          )}
          {p.room && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{p.room}</div>
          )}
          {p.teacher && <div className="text-[11px] leading-tight text-muted-foreground">{p.teacher}</div>}
        </div>
      ))}
    </div>
  );
}
