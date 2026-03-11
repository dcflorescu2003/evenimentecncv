import { useParams } from "react-router-dom";

export default function ScanPage() {
  const { eventId } = useParams();
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Scanare QR</h1>
      <p className="mt-2 text-muted-foreground">Eveniment: {eventId}</p>
    </div>
  );
}
