import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PASSWORD = "Cncv1234#";

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
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    let caller: any = null;
    if (token) {
      try {
        const { data: { user } } = await supabase.auth.getUser(token);
        caller = user;
      } catch (_) {
        // Service role key won't resolve to a user
      }
    }

    const body = await req.json();
    const { action } = body;

    // Check admin for most actions
    let isAdmin = false;
    if (caller) {
      const { data } = await supabase.rpc("has_role", {
        _user_id: caller.id,
        _role: "admin",
      });
      isAdmin = !!data;
    }

    // Check if this is a service-role call (internal tools pass service role key)
    const apikeyHeader = req.headers.get("apikey") || "";
    const isServiceRole = apikeyHeader === serviceRoleKey || token === serviceRoleKey;

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

    if (action === "batch_reset_by_role") {
      if (!isAdmin) throw new Error("Nu aveți permisiuni de administrator");
      const { role } = body;
      if (!role) throw new Error("role lipsește");

      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", role)
        .limit(10000);

      const userIds = (roleRows || []).map((r: any) => r.user_id);
      if (userIds.length === 0) {
        return new Response(JSON.stringify({ results: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, username")
        .in("id", userIds);

      const results = [];
      for (const profile of (profiles || [])) {
        const password = generatePassword();
        const { error } = await supabase.auth.admin.updateUserById(profile.id, { password });
        if (error) {
          results.push({ first_name: profile.first_name, last_name: profile.last_name, username: profile.username, password: "", error: error.message });
        } else {
          results.push({ first_name: profile.first_name, last_name: profile.last_name, username: profile.username, password });
        }
      }

      results.sort((a, b) => {
        const cmp = a.last_name.localeCompare(b.last_name);
        return cmp !== 0 ? cmp : a.first_name.localeCompare(b.first_name);
      });

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_single_user") {
      if (!isAdmin) throw new Error("Nu aveți permisiuni de administrator");
      const { user_id } = body;
      const password = generatePassword();

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, username")
        .eq("id", user_id)
        .single();
      if (!profile) throw new Error("Utilizatorul nu a fost găsit");

      const { error } = await supabase.auth.admin.updateUserById(user_id, { password });
      if (error) throw error;

      return new Response(JSON.stringify({ results: [{ first_name: profile.first_name, last_name: profile.last_name, username: profile.username, password }] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "bulk_delete_students") {
      if (!isAdmin && !isServiceRole) throw new Error("Nu aveți permisiuni de administrator");
      const { exclude_usernames = [] } = body;

      // List all auth users (paginated)
      const allStudentIds: string[] = [];
      let page = 1;
      const perPage = 1000;
      while (true) {
        const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage });
        if (error) throw error;
        if (!users || users.length === 0) break;

        // For each user, check if they're a student
        for (const u of users) {
          // Get username from email (username@school.local)
          const username = u.email?.replace("@school.local", "") || "";
          if (exclude_usernames.includes(username)) continue;

          // Check if student role
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", u.id)
            .eq("role", "student");

          if (roles && roles.length > 0) {
            allStudentIds.push(u.id);
          }
        }

        if (users.length < perPage) break;
        page++;
      }

      let deleted = 0;
      let errors = 0;
      for (const id of allStudentIds) {
        // Delete related data first
        await supabase.from("student_class_assignments").delete().eq("student_id", id);
        await supabase.from("user_roles").delete().eq("user_id", id);
        await supabase.from("profiles").delete().eq("id", id);
        const { error } = await supabase.auth.admin.deleteUser(id);
        if (error) {
          console.error(`Failed to delete ${id}: ${error.message}`);
          errors++;
        } else {
          deleted++;
        }
      }

      return new Response(JSON.stringify({ deleted, errors, total: allStudentIds.length }), {
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
