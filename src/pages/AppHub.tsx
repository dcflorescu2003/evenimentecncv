import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, GraduationCap } from "lucide-react";
import { getEnabledModules } from "@/modules/registry";

export default function AppHub() {
  const { profile, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const items = getEnabledModules(roles);

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="header-safe sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-3 sm:px-4 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <GraduationCap className="h-6 w-6 text-primary shrink-0" />
          <span className="font-display text-base sm:text-lg font-semibold truncate">CNCV</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-sm text-muted-foreground truncate max-w-[200px]">
            {profile?.display_name}
          </span>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Ieșire">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 text-center sm:text-left">
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">
              Bun venit{profile?.first_name ? `, ${profile.first_name}` : ""}!
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Alege modulul pe care vrei să îl accesezi.
            </p>
          </div>

          {items.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Nu există module disponibile pentru contul tău.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {items.map(({ module, path }) => {
                const Icon = module.icon;
                return (
                  <button
                    key={module.key}
                    onClick={() => navigate(path)}
                    className="group text-left"
                  >
                    <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
                      <CardContent className="flex flex-col gap-3 p-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <h2 className="font-display text-lg font-semibold">{module.label}</h2>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {module.description}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
