import { useParams } from "react-router-dom";
import EventScanScreen from "@/components/scan/EventScanScreen";

export default function ProfScanPage() {
  const { eventId } = useParams<{ eventId: string }>();
  return <EventScanScreen eventId={eventId} backPath="/prof" markNote="Marcat manual de profesor" readerId="prof-qr-reader" />;
}
