import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VR_SUBJECTS } from "@/lib/smartlab";
import { Search, Loader2 } from "lucide-react";

export interface VrMaterial {
  id: string;
  subject: string;
  name: string;
  media_type: string | null;
  size_label: string | null;
  preview_url: string | null;
}

const PAGE = 60;

export function VrMaterialPicker({
  selected,
  onChange,
}: {
  selected: VrMaterial[];
  onChange: (next: VrMaterial[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const { data, isLoading } = useQuery({
    queryKey: ["vr-materials", search, subject, limit],
    queryFn: async () => {
      let q = supabase
        .from("vr_materials")
        .select("id, subject, name, media_type, size_label, preview_url")
        .order("name")
        .limit(limit);
      if (subject) q = q.eq("subject", subject);
      if (search.trim().length >= 2) q = q.ilike("name", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as VrMaterial[];
    },
  });

  const selectedIds = useMemo(() => new Set(selected.map((m) => m.id)), [selected]);

  function toggle(m: VrMaterial) {
    if (selectedIds.has(m.id)) onChange(selected.filter((x) => x.id !== m.id));
    else onChange([...selected, m]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Caută material (min. 2 litere)"
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          variant={subject === null ? "secondary" : "ghost"}
          onClick={() => {
            setSubject(null);
            setLimit(PAGE);
          }}
        >
          Toate
        </Button>
        {VR_SUBJECTS.map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={subject === s ? "secondary" : "ghost"}
            onClick={() => {
              setSubject(s);
              setLimit(PAGE);
            }}
          >
            {s}
          </Button>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 rounded-md border bg-muted/40 p-2">
          {selected.map((m) => (
            <Badge
              key={m.id}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => toggle(m)}
              title="Elimină"
            >
              {m.name} ×
            </Badge>
          ))}
        </div>
      )}

      <ScrollArea className="h-[320px] rounded-md border">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (data ?? []).length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Niciun material găsit.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 lg:grid-cols-4">
            {(data ?? []).map((m) => {
              const isSel = selectedIds.has(m.id);
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => toggle(m)}
                  className={`group overflow-hidden rounded-md border text-left transition-colors ${
                    isSel ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/40"
                  }`}
                >
                  <div className="relative aspect-video bg-muted">
                    {m.preview_url && (
                      <img
                        src={m.preview_url}
                        alt={m.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    )}
                    <Checkbox
                      checked={isSel}
                      className="pointer-events-none absolute left-1.5 top-1.5 bg-background"
                    />
                  </div>
                  <div className="space-y-0.5 p-2">
                    <p className="line-clamp-2 text-xs font-medium">{m.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {m.subject}
                      {m.media_type ? ` · ${m.media_type}` : ""}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {(data ?? []).length >= limit && (
          <div className="p-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setLimit((l) => l + PAGE)}
            >
              Încarcă mai multe
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
