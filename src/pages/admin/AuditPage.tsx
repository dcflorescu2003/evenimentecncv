import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Shield } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type AuditLog = Tables<"audit_logs">;

const actionLabels: Record<string, string> = {
  create: "Creare",
  update: "Actualizare",
  delete: "Ștergere",
  import: "Import",
  attendance_mark: "Marcare prezență",
  password_reset: "Resetare parolă",
  status_change: "Schimbare status",
};

export default function AuditPage() {
  const [search, setSearch] = useState("");
  const [filterEntity, setFilterEntity] = useState("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as AuditLog[];
    },
  });

  const { data: profiles = {} } = useQuery({
    queryKey: ["audit_profiles", logs.map((l) => l.user_id).filter(Boolean)],
    queryFn: async () => {
      const userIds = [...new Set(logs.map((l) => l.user_id).filter(Boolean))] as string[];
      if (userIds.length === 0) return {};
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, first_name, last_name")
        .in("id", userIds);
      if (error) return {};
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => {
        map[p.id] = p.display_name || `${p.first_name} ${p.last_name}`;
      });
      return map;
    },
    enabled: logs.length > 0,
  });

  const entityTypes = [...new Set(logs.map((l) => l.entity_type))].sort();

  const filtered = logs.filter((l) => {
    if (filterEntity !== "all" && l.entity_type !== filterEntity) return false;
    if (search) {
      const q = search.toLowerCase();
      const userName = l.user_id ? (profiles as Record<string, string>)[l.user_id] || "" : "";
      if (
        !l.action.toLowerCase().includes(q) &&
        !l.entity_type.toLowerCase().includes(q) &&
        !userName.toLowerCase().includes(q) &&
        !(l.entity_id || "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Jurnal audit</h1>
        <p className="mt-1 text-sm text-muted-foreground">Istoric acțiuni și modificări în sistem.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Caută…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tip entitate" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate entitățile</SelectItem>
            {entityTypes.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Utilizator</TableHead>
              <TableHead>Acțiune</TableHead>
              <TableHead>Entitate</TableHead>
              <TableHead>Detalii</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Se încarcă…</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  <Shield className="mx-auto mb-2 h-8 w-8" />
                  Nicio intrare în jurnal
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("ro-RO")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.user_id ? (profiles as Record<string, string>)[log.user_id] || log.user_id.slice(0, 8) : "Sistem"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {actionLabels[log.action] || log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="text-muted-foreground">{log.entity_type}</span>
                    {log.entity_id && (
                      <span className="ml-1 text-xs text-muted-foreground">#{log.entity_id.slice(0, 8)}</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                    {log.details ? JSON.stringify(log.details) : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
