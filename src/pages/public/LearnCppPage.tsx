import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Search, LogIn } from "lucide-react";
import { CPP_C9 } from "@/data/cpp-clasa-9";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function LearnCppPage() {
  const [q, setQ] = useState("");
  const chapters = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return CPP_C9;
    return CPP_C9.map((ch) => ({
      ...ch,
      lessons: ch.lessons.filter((l) => norm(l.title + " " + l.summary).includes(n)),
    })).filter((ch) => ch.lessons.length);
  }, [q]);
  let idx = 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <span className="flex items-center gap-2 text-primary font-semibold">
            <BookOpen className="h-5 w-5" /> Învață · CNCV
          </span>
          <Link to="/login" className="text-sm text-primary hover:underline flex items-center gap-1">
            <LogIn className="h-4 w-4" /> Autentificare
          </Link>
        </div>
        <h1 className="font-display text-3xl font-bold mb-2">Informatică – clasa a IX-a (C++)</h1>
        <p className="text-muted-foreground mb-2">
          Lecțiile sunt în ordinea în care se predau. Programa este pentru clasele de matematică-informatică intensiv.
        </p>
        <Badge variant="secondary" className="mb-6">Intensiv informatică</Badge>

        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută o lecție (ex: cmmdc, for, sortare)" className="pl-9" />
        </div>

        <div className="space-y-8">
          {chapters.map((ch, ci) => (
            <section key={ch.id}>
              <h2 className="text-xl font-semibold">Capitolul {CPP_C9.indexOf(CPP_C9.find((c) => c.id === ch.id)!) + 1}. {ch.title}</h2>
              <p className="text-sm text-muted-foreground mb-3">{ch.description}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {ch.lessons.map((l) => (
                  <Link
                    key={l.slug}
                    to={`/invata/cpp-9/${l.slug}`}
                    className="rounded-lg border bg-card p-3 hover:border-primary transition-colors"
                  >
                    <p className="font-medium">{l.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{l.summary}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
          {!chapters.length && <p className="text-muted-foreground">Nicio lecție găsită.</p>}
        </div>
      </div>
    </div>
  );
}
