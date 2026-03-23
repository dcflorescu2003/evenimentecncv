import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Search, KeyRound, UserCheck, UserX, Plus, Copy, Trash2, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
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
  manager: "Manager",
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 100;
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [createDialog, setCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    first_name: "", last_name: "", username: "", role: "student" as string, teaching_norm: "" as string,
  });
  const [editNormId, setEditNormId] = useState<string | null>(null);
  const [editNormValue, setEditNormValue] = useState("");
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", username: "", teaching_norm: "", roles: [] as string[] });

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
        .select("*")
        .limit(10000);
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

  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProfiles = filteredProfiles.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page when filters change
  const handleSearch = (value: string) => { setSearch(value); setCurrentPage(1); };
  const handleRoleFilter = (value: string) => { setRoleFilter(value); setCurrentPage(1); };

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
      const bodyData: any = {
        action: "create_user",
        first_name: values.first_name,
        last_name: values.last_name,
        username: values.username,
        role: values.role,
      };
      if ((values.role === "teacher" || values.role === "homeroom_teacher") && values.teaching_norm) {
        bodyData.teaching_norm = Number(values.teaching_norm);
      }
      const { data, error } = await supabase.functions.invoke("admin-manage-users", { body: bodyData });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["user_roles"] });
      setCreateDialog(false);
      setCreateForm({ first_name: "", last_name: "", username: "", role: "student", teaching_norm: "" });
      setNewPassword(data.password);
      toast.success("Utilizator creat");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateNormMutation = useMutation({
    mutationFn: async ({ id, norm }: { id: string; norm: number | null }) => {
      const { error } = await supabase.from("profiles").update({ teaching_norm: norm } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setEditNormId(null);
      toast.success("Norma actualizată");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editUserMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: typeof editForm }) => {
      const bodyData: any = {
        action: "update_user",
        user_id: id,
        first_name: values.first_name,
        last_name: values.last_name,
        username: values.username,
        roles: values.roles,
      };

      bodyData.teaching_norm = values.roles.includes("teacher") || values.roles.includes("homeroom_teacher")
        ? (values.teaching_norm ? Number(values.teaching_norm) : null)
        : null;

      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: bodyData,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["user_roles"] });
      setEditUser(null);
      toast.success("Utilizator actualizat");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEditDialog(p: Profile) {
    setEditUser(p);
    setEditForm({
      first_name: p.first_name,
      last_name: p.last_name,
      username: p.username,
      teaching_norm: (p as any).teaching_norm?.toString() || "",
      roles: getRoles(p.id),
    });
  }

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("admin-manage-users", {
        body: { action: "delete_user", user_id: userId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["user_roles"] });
      setDeleteUserId(null);
      toast.success("Utilizator șters");
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
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={handleRoleFilter}>
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
                    <TableCell className="font-medium">{p.display_name || `${p.last_name} ${p.first_name}`}</TableCell>
                    <TableCell className="font-mono text-sm">{p.username}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 items-center">
                        {userRoles.map((r) => (
                          <Badge key={r} variant="secondary">{roleLabels[r] || r}</Badge>
                        ))}
                        {userRoles.some((r) => r === "teacher" || r === "homeroom_teacher") && (
                          editNormId === p.id ? (
                            <form className="flex items-center gap-1" onSubmit={(e) => {
                              e.preventDefault();
                              updateNormMutation.mutate({ id: p.id, norm: editNormValue ? Number(editNormValue) : null });
                            }}>
                              <Input type="number" min="0" className="h-6 w-16 text-xs" value={editNormValue} onChange={(e) => setEditNormValue(e.target.value)} autoFocus />
                              <Button type="submit" variant="ghost" size="icon" className="h-6 w-6 text-xs">✓</Button>
                            </form>
                          ) : (
                            <button
                              className="text-xs text-muted-foreground hover:text-primary ml-1"
                              onClick={() => { setEditNormId(p.id); setEditNormValue((p as any).teaching_norm?.toString() || ""); }}
                              title="Editează norma"
                            >
                              {(p as any).teaching_norm ? `· ${(p as any).teaching_norm}h` : "· fără normă"}
                            </button>
                          )
                        )}
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
                          title="Editează utilizator"
                          onClick={() => openEditDialog(p)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Șterge utilizator"
                          onClick={() => setDeleteUserId(p.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Delete User Confirm */}
      <AlertDialog open={!!deleteUserId} onOpenChange={(o) => !o && setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergere utilizator</AlertDialogTitle>
            <AlertDialogDescription>
              Această acțiune este ireversibilă. Toate datele asociate (rezervări, bilete, asignări) vor fi șterse definitiv.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteUserId && deleteUserMutation.mutate(deleteUserId)}
            >
              {deleteUserMutation.isPending ? "Se șterge…" : "Șterge definitiv"}
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

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editează utilizator</DialogTitle>
            <DialogDescription>Modificați detaliile utilizatorului.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!editForm.first_name || !editForm.last_name || !editForm.username) {
              toast.error("Completați toate câmpurile obligatorii");
              return;
            }
            if (editForm.roles.length === 0) {
              toast.error("Selectați cel puțin un rol");
              return;
            }
            editUserMutation.mutate({ id: editUser!.id, values: editForm });
          }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prenume *</Label>
                <Input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Nume *</Label>
                <Input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Username *</Label>
              <Input value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Roluri *</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(roleLabels).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={editForm.roles.includes(k)}
                      onCheckedChange={(checked) => {
                        setEditForm(prev => ({
                          ...prev,
                          roles: checked
                            ? [...prev.roles, k]
                            : prev.roles.filter(r => r !== k),
                        }));
                      }}
                    />
                    {v}
                  </label>
                ))}
              </div>
            </div>
            {editForm.roles.some((r) => r === "teacher" || r === "homeroom_teacher") && (
              <div className="space-y-2">
                <Label>Norma (ore)</Label>
                <Input type="number" min="0" placeholder="ex: 12" value={editForm.teaching_norm} onChange={(e) => setEditForm({ ...editForm, teaching_norm: e.target.value })} />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Anulează</Button>
              <Button type="submit" disabled={editUserMutation.isPending}>
                {editUserMutation.isPending ? "Se salvează…" : "Salvează"}
              </Button>
            </DialogFooter>
          </form>
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
            {(createForm.role === "teacher" || createForm.role === "homeroom_teacher") && (
              <div className="space-y-2">
                <Label>Norma (ore)</Label>
                <Input type="number" min="0" placeholder="ex: 12" value={createForm.teaching_norm} onChange={(e) => setCreateForm({ ...createForm, teaching_norm: e.target.value })} />
              </div>
            )}
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
