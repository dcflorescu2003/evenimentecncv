import { useNavigate } from "react-router-dom";
import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  variant?: "icon" | "labeled";
  className?: string;
}

export function ModulesButton({ variant = "icon", className }: Props) {
  const navigate = useNavigate();
  if (variant === "labeled") {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/app")}
        className={className}
        title="Module"
      >
        <LayoutGrid className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Module</span>
      </Button>
    );
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => navigate("/app")}
      className={className}
      title="Module"
      aria-label="Module"
    >
      <LayoutGrid className="h-4 w-4" />
    </Button>
  );
}
