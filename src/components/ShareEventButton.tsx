import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { eventShareUrl } from "@/lib/redirect";

export function ShareEventButton({ eventId }: { eventId: string }) {
  async function copy() {
    const url = eventShareUrl(eventId);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiat");
    } catch {
      window.prompt("Copiază linkul evenimentului:", url);
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={copy} className="shrink-0">
      <Link2 className="mr-2 h-4 w-4" /> Copiază link
    </Button>
  );
}
