import { useParams } from "react-router-dom";

export default function EventDetailPage() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Detalii eveniment</h1>
      <p className="mt-2 text-muted-foreground">Eveniment: {id}</p>
    </div>
  );
}
