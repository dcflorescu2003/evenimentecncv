import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, AlertTriangle } from "lucide-react";
import { ALL_LESSONS } from "@/data/cpp-clasa-9";
import NotFound from "@/pages/NotFound";

export default function LearnCppLessonPage() {
  const { slug } = useParams();
  const i = ALL_LESSONS.findIndex((l) => l.slug === slug);
  if (i < 0) return <NotFound />;
  const l = ALL_LESSONS[i];
  const prev = ALL_LESSONS[i - 1];
  const next = ALL_LESSONS[i + 1];

  return (
    <div className="min-h-screen bg-background">
      <article className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/invata" className="text-sm text-primary hover:underline flex items-center gap-1 mb-6">
          <ArrowLeft className="h-4 w-4" /> Toate lecțiile
        </Link>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {l.chapter.title} · Lecția {i + 1} din {ALL_LESSONS.length}
        </p>
        <h1 className="font-display text-3xl font-bold mt-1 mb-3">{l.title}</h1>
        <p className="text-lg text-muted-foreground mb-6">{l.summary}</p>

        <h2 className="text-lg font-semibold mb-2">De reținut</h2>
        <ul className="list-disc pl-5 space-y-1 mb-6">
          {l.points.map((p) => <li key={p}>{p}</li>)}
        </ul>

        {l.code && (
          <>
            <h2 className="text-lg font-semibold mb-2">Exemplu</h2>
            <pre className="rounded-lg bg-muted p-4 overflow-x-auto text-sm mb-6"><code>{l.code}</code></pre>
          </>
        )}

        {l.pitfall && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 flex gap-2 mb-6">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm">{l.pitfall}</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground mb-8">Programă: clasa a IX-a, matematică-informatică intensiv.</p>

        <nav className="flex justify-between gap-4 border-t pt-4">
          {prev ? (
            <Link to={`/invata/cpp-9/${prev.slug}`} className="text-sm text-primary hover:underline flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" /> {prev.title}
            </Link>
          ) : <span />}
          {next && (
            <Link to={`/invata/cpp-9/${next.slug}`} className="text-sm text-primary hover:underline flex items-center gap-1 text-right">
              {next.title} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </nav>
      </article>
    </div>
  );
}
