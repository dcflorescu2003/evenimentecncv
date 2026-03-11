import { useParams } from "react-router-dom";

export default function EventParticipantsPage() {
  const { eventId } = useParams();
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Participanți eveniment</h1>
      <p className="mt-2 text-muted-foreground">Eveniment: {eventId}</p>
    </div>
  );
}
