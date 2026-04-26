import { Badge } from "@/components/ui/badge";
import { Megaphone } from "lucide-react";

interface CseBadgeProps {
  className?: string;
  short?: boolean;
}

/**
 * Badge pentru evenimentele organizate de Consiliul Școlar al Elevilor.
 * Vizual distinct (violet) și folosit oriunde evenimentele sunt listate.
 */
export function CseBadge({ className = "", short = false }: CseBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={`shrink-0 border-purple-300 bg-purple-100 text-purple-900 hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-900/40 dark:text-purple-200 ${className}`}
      title="Eveniment organizat de Consiliul Școlar al Elevilor"
    >
      <Megaphone className="mr-1 h-3 w-3" />
      {short ? "CSE" : "Eveniment CSE"}
    </Badge>
  );
}
