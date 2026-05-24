import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Utensils, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MenuItem {
  id: string;
  name: string;
  dish_type: string;
  date: string;
}

function formatRoDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function dayLabel(iso: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso + "T00:00:00");
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Astăzi";
  if (diff === 1) return "Mâine";
  const names = ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"];
  return names[d.getDay()];
}

const DISH_LABEL: Record<string, string> = {
  fel1: "Felul 1",
  fel2: "Felul 2",
  desert: "Desert",
};

export default function CantinaMenuSection() {
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("get-cantina-menu");
      if (cancelled) return;
      if (error || data?.error) {
        setError("Meniul cantinei nu este disponibil momentan.");
      } else {
        setItems((data?.items as MenuItem[]) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Group by date. Prefer today + future; fall back to most recent past dates if none.
  const todayISO = new Date().toISOString().slice(0, 10);
  const allGrouped = (items ?? []).reduce<Record<string, MenuItem[]>>((acc, item) => {
    (acc[item.date] ??= []).push(item);
    return acc;
  }, {});
  const allDates = Object.keys(allGrouped).sort();
  const futureDates = allDates.filter((d) => d >= todayISO);
  const dates = futureDates.length > 0 ? futureDates.slice(0, 5) : allDates.slice(-2);
  const grouped = allGrouped;
  const showStaleHint = futureDates.length === 0 && dates.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Utensils className="h-5 w-5 text-primary" />
          Meniu cantină
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
        {!loading && error && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
        {!loading && !error && dates.length === 0 && (
          <p className="text-sm text-muted-foreground">Niciun meniu disponibil momentan.</p>
        )}
        {!loading && !error && dates.length > 0 && showStaleHint && (
          <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" />
            Meniul pentru zilele următoare nu a fost încă publicat. Afișăm ultimul meniu disponibil.
          </div>
        )}
        {!loading && !error && dates.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dates.map((date) => (
              <div key={date} className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-sm font-semibold">{dayLabel(date)}</span>
                  <span className="text-xs text-muted-foreground">{formatRoDate(date)}</span>
                </div>
                <ul className="space-y-1.5">
                  {grouped[date]
                    .sort((a, b) => a.dish_type.localeCompare(b.dish_type))
                    .map((item) => (
                      <li key={item.id} className="flex items-start gap-2 text-sm">
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {DISH_LABEL[item.dish_type] ?? item.dish_type}
                        </Badge>
                        <span className="leading-snug">{item.name}</span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
