import { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  icon?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  count,
  icon,
  defaultOpen = false,
  className,
  contentClassName = "space-y-3 pt-3",
  children,
}: CollapsibleSectionProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn("w-full", className)}>
      <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-md py-2 text-left transition-colors hover:text-foreground">
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
        {icon}
        <h2 className="font-display text-base sm:text-lg font-semibold">
          {title}
          {count !== undefined && (
            <span className="ml-1 text-muted-foreground">({count})</span>
          )}
        </h2>
      </CollapsibleTrigger>
      <CollapsibleContent className={contentClassName}>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default CollapsibleSection;
