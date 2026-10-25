import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { eventShareUrl, clubShareUrl, volunteerShareUrl } from "@/lib/redirect";

type ShareKind = "event" | "club" | "volunteer";

const LABELS: Record<ShareKind, string> = {
  event: "linkul evenimentului",
  club: "linkul clubului",
  volunteer: "linkul proiectului",
};

export function ShareEventButton({
  eventId,
  kind = "event",
}: {
  eventId: string;
  kind?: ShareKind;
}) {
  async function copy() {
    const url =
      kind === "club"
        ? clubShareUrl(eventId)
        : kind === "volunteer"
          ? volunteerShareUrl(eventId)
          : eventShareUrl(eventId);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiat");
    } catch {
      window.prompt(`Copiază ${LABELS[kind]}:`, url);
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={copy} className="shrink-0">
      <Link2 className="mr-2 h-4 w-4" /> Copiază link
    </Button>
  );
}
