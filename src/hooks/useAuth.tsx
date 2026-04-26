import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "student" | "homeroom_teacher" | "coordinator_teacher" | "teacher" | "manager" | "cse";

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  display_name: string | null;
  is_active: boolean;
  must_change_password: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const authRequestRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    const applySignedOutState = () => {
      authRequestRef.current += 1;
      if (!isMounted) return;
      setSession(null);
      setUser(null);
      setProfile(null);
      setRoles([]);
      setLoading(false);
    };

    const loadUserState = async (nextSession: Session) => {
      const requestId = ++authRequestRef.current;

      if (!isMounted) return;
      setSession(nextSession);
      setUser(nextSession.user);
      setLoading(true);

      try {
        const [profileRes, rolesRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, first_name, last_name, username, display_name, is_active, must_change_password")
            .eq("id", nextSession.user.id)
            .maybeSingle(),
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", nextSession.user.id),
        ]);

        if (!isMounted || authRequestRef.current !== requestId) return;

        if (profileRes.error && profileRes.error.code !== "PGRST116") {
          console.error("Failed to load profile", profileRes.error);
        }
        if (rolesRes.error) {
          console.error("Failed to load roles", rolesRes.error);
        }

        setProfile((profileRes.data as Profile | null) ?? null);
        setRoles((rolesRes.data ?? []).map((r: { role: string }) => r.role as AppRole));
      } finally {
        if (isMounted && authRequestRef.current === requestId) {
          setLoading(false);
        }
      }
    };

    const handleSessionChange = (nextSession: Session | null) => {
      if (!nextSession?.user) {
        applySignedOutState();
        return;
      }

      void loadUserState(nextSession);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      handleSessionChange(nextSession);
    });

    supabase.auth.getSession()
      .then(({ data: { session: initialSession } }) => {
        handleSessionChange(initialSession);
      })
      .catch(() => {
        applySignedOutState();
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(username: string, password: string) {
    // We use email field to store username@school.local
    const email = `${username}@school.local`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setRoles([]);
  }

  function hasRole(role: AppRole) {
    return roles.includes(role);
  }

  return (
    <AuthContext.Provider
      value={{ session, user, profile, roles, loading, signIn, signOut, hasRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
