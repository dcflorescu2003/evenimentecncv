import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, KeyRound, UserCheck, UserX, Plus, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type UserRole = Tables<"user_roles">;

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  student: "Elev",
  homeroom_teacher: "Diriginte",
  coordinator_teacher: "Asistent",
  teacher: "Profesor",
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [createDialog, setCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    first_name: "", last_name: "", username: "", role: "student" as string,
  });

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("last_name")
        .limit(10000);
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: allRoles = [] } = useQuery({
    queryKey: ["user_roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*");
      if (error) throw error;
      return data as UserRole[];
    },
  });

  function getRoles(userId: string) {
    return allRoles.filter((r) => r.user_id === userId).map((r) => r.role);
  }

  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch = !search ||
      p.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.username.toLowerCase().includes(search.toLowerCase()) ||
      p.first_name.toLowerCase().includes(search.toLowerCase()) ||
      p.last_name.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || getRoles(p.id).includes(roleFilter as any);
    return matchesSearch && matchesRole;
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Status actualizat");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: { action: "reset_password", user_id: userId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setNewPassword(data.password);
      toast.success("Parolă resetată cu succes");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createUserMutation = useMutation({
    mutationFn: async (values: typeof createForm) => {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: {
          action: "create_user",
          first_name: values.first_name,
          last_name: values.last_name,
          username: values.username,
          role: values.role,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["user_roles"] });
      setCreateDialog(false);
      setNewPassword(data.password);
      toast.success("Utilizator creat");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.first_name || !createForm.last_name || !createForm.username) {
      toast.error("Completați toate câmpurile");
      return;
    }
    createUserMutation.mutate(createForm);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Utilizatori</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestionare conturi: elevi, diriginți, asistenți.
          </p>
        </div>
        <Button onClick={() => setCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" /> Utilizator nou
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Căutare după nume sau username…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate rolurile</SelectItem>
            {Object.entries(roleLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nume</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Roluri</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32">Acțiuni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Se încarcă…
                </TableCell>
              </TableRow>
            ) : filteredProfiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Niciun utilizator găsit
                </TableCell>
              </TableRow>
            ) : (
              filteredProfiles.map((p) => {
                const userRoles = getRoles(p.id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.display_name || `${p.first_name} ${p.last_name}`}</TableCell>
                    <TableCell className="font-mono text-sm">{p.username}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {userRoles.map((r) => (
                          <Badge key={r} variant="secondary">{roleLabels[r] || r}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? "default" : "destructive"}>
                        {p.is_active ? "Activ" : "Inactiv"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Resetează parola"
                          onClick={() => setResetUserId(p.id)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={p.is_active ? "Dezactivează" : "Activează"}
                          onClick={() => toggleActiveMutation.mutate({ id: p.id, is_active: !p.is_active })}
                        >
                          {p.is_active ? (
                            <UserX className="h-4 w-4 text-destructive" />
                          ) : (
                            <UserCheck className="h-4 w-4 text-green-600" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Reset Password Confirm */}
      <AlertDialog open={!!resetUserId && !newPassword} onOpenChange={(o) => !o && setResetUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetare parolă</AlertDialogTitle>
            <AlertDialogDescription>
              Se va genera o parolă nouă pentru acest utilizator. Parola veche nu va mai funcționa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={() => resetUserId && resetPasswordMutation.mutate(resetUserId)}>
              Resetează
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Password Display */}
      <Dialog open={!!newPassword} onOpenChange={(o) => { if (!o) { setNewPassword(null); setResetUserId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Parolă generată</DialogTitle>
            <DialogDescription>
              Copiați parola acum. Nu va mai fi afișată ulterior.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border bg-muted p-3">
            <code className="flex-1 text-lg font-mono">{newPassword}</code>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(newPassword || "");
                toast.success("Parolă copiată");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Utilizator nou</DialogTitle>
            <DialogDescription>Creați un cont nou cu parolă generată automat.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prenume *</Label>
                <Input value={createForm.first_name} onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Nume *</Label>
                <Input value={createForm.last_name} onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Username *</Label>
              <Input value={createForm.username} onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} placeholder="ex: i.ion.popescu" />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={createForm.role} onValueChange={(v) => setCreateForm({ ...createForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDialog(false)}>Anulează</Button>
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? "Se creează…" : "Creează"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
