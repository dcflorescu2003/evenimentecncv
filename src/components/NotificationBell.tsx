import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDate } from "@/lib/time";
import { getNotificationUrl } from "@/lib/notification-routing";

export default function NotificationBell() {
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  async function markAllRead() {
    if (!user || unreadCount === 0) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function handleClick(n: any) {
    if (!n.is_read && user) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", n.id);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
    const url = getNotificationUrl(n, roles);
    setOpen(false);
    if (url) navigate(url);
  }

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o);
      if (o && unreadCount > 0) markAllRead();
    }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b px-4 py-3">
          <h4 className="text-sm font-semibold">Notificări</h4>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Nicio notificare</p>
          ) : (
            notifications.map((n: any) => {
              const url = getNotificationUrl(n, roles);
              const clickable = !!url;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n)}
                  disabled={!clickable}
                  className={`block w-full border-b px-4 py-3 text-left text-sm last:border-b-0 ${
                    !n.is_read ? "bg-accent/30" : ""
                  } ${clickable ? "cursor-pointer hover:bg-accent/60 transition-colors" : "cursor-default"}`}
                >
                  <p className="font-medium">{n.title}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{n.body}</p>
                  <p className="text-muted-foreground text-[10px] mt-1">{formatDate(n.created_at)}</p>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
