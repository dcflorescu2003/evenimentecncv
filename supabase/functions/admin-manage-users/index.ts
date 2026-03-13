import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generatePassword(length = 10): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#";
  let result = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (const byte of array) {
    result += chars[byte % chars.length];
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller
    const authHeader = req.headers.get("Authorization")!;
    const { data: { user: caller } } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (!caller) throw new Error("Nu sunteți autentificat");

    const body = await req.json();
    const { action } = body;

    // Check admin for most actions
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });

    if (action === "create_user") {
      if (!isAdmin) throw new Error("Nu aveți permisiuni de administrator");
      const { first_name, last_name, username, role } = body;
      const password = generatePassword();
      const email = `${username}@school.local`;

      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (authError) throw authError;

      const userId = authUser.user.id;

      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        first_name,
        last_name,
        username,
      });
      if (profileError) throw profileError;

      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: userId,
        role,
      });
      if (roleError) throw roleError;

      return new Response(JSON.stringify({ password, username }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_password") {
      if (!isAdmin) throw new Error("Nu aveți permisiuni de administrator");
      const { user_id } = body;
      const password = generatePassword();

      const { error } = await supabase.auth.admin.updateUserById(user_id, { password });
      if (error) throw error;

      return new Response(JSON.stringify({ password }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "batch_reset_class_passwords") {
      const { class_id } = body;
      if (!class_id) throw new Error("class_id lipsește");

      // Allow admin OR homeroom teacher for this class
      const { data: isHomeroom } = await supabase.rpc("has_role", {
        _user_id: caller.id,
        _role: "homeroom_teacher",
      });

      if (!isAdmin) {
        if (!isHomeroom) throw new Error("Nu aveți permisiuni");
        // Verify caller is homeroom teacher for this class
        const { data: cls } = await supabase
          .from("classes")
          .select("homeroom_teacher_id")
          .eq("id", class_id)
          .single();
        if (!cls || cls.homeroom_teacher_id !== caller.id) {
          throw new Error("Nu sunteți dirigintele acestei clase");
        }
      }

      // Get students in this class
      const { data: assignments } = await supabase
        .from("student_class_assignments")
        .select("student_id")
        .eq("class_id", class_id)
        .limit(10000);

      const studentIds = (assignments || []).map((a: any) => a.student_id);
      if (studentIds.length === 0) {
        return new Response(JSON.stringify({ results: [], message: "Niciun elev în clasă" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, username")
        .in("id", studentIds);

      const results = [];
      for (const profile of (profiles || [])) {
        const password = generatePassword();
        const { error } = await supabase.auth.admin.updateUserById(profile.id, { password });
        if (error) {
          results.push({
            first_name: profile.first_name,
            last_name: profile.last_name,
            username: profile.username,
            password: "",
            error: error.message,
          });
        } else {
          results.push({
            first_name: profile.first_name,
            last_name: profile.last_name,
            username: profile.username,
            password,
          });
        }
      }

      // Sort by last_name, first_name
      results.sort((a, b) => {
        const cmp = a.last_name.localeCompare(b.last_name);
        return cmp !== 0 ? cmp : a.first_name.localeCompare(b.first_name);
      });

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Acțiune necunoscută: ${action}`);
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
