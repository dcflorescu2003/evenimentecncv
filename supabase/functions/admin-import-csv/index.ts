import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function removeDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function generateUsername(firstName: string, lastName: string): string {
  const clean = (s: string) => removeDiacritics(s).toLowerCase().replace(/[^a-z]/g, "");
  const first = clean(firstName);
  const last = clean(lastName);
  if (!first || !last) return `user.${Date.now()}`;
  return `${first[0]}.${first}.${last}`;
}

const DEFAULT_PASSWORD = "Cncv1234#";

// Parse class_grade that could be numeric ("9", "10") or Roman ("IX", "X", "XI", "XII")
function parseGrade(value: string): number {
  const trimmed = value.trim();
  // Try numeric first
  const num = parseInt(trimmed);
  if (!isNaN(num) && num >= 1 && num <= 12) return num;
  // Try Roman numerals
  const romanMap: Record<string, number> = {
    "V": 5, "VI": 6, "VII": 7, "VIII": 8,
    "IX": 9, "X": 10, "XI": 11, "XII": 12,
    "I": 1, "II": 2, "III": 3, "IV": 4,
  };
  const upper = trimmed.toUpperCase();
  if (romanMap[upper]) return romanMap[upper];
  return NaN;
}

interface CsvRow {
  role: string;
  first_name: string;
  last_name: string;
  class_grade?: string;
  class_section?: string;
  student_identifier?: string;
  email?: string;
}

interface ImportResult {
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  role: string;
  error?: string;
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

    // Verify admin
    const authHeader = req.headers.get("Authorization")!;
    const { data: { user: caller } } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (!caller) throw new Error("Nu sunteți autentificat");

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Nu aveți permisiuni de administrator");

    const { rows } = await req.json() as { rows: CsvRow[] };
    if (!rows || rows.length === 0) throw new Error("Nu există rânduri de importat");

    // Get existing usernames for dedup
    const { data: existingProfiles } = await supabase
      .from("profiles")
      .select("username")
      .limit(10000);
    const usedUsernames = new Set((existingProfiles || []).map((p: any) => p.username));

    // Get classes for assignment - build multiple lookup keys for flexibility
    const { data: allClasses } = await supabase.from("classes").select("*").limit(10000);
    const classMap = new Map<string, any>();
    for (const c of (allClasses || [])) {
      // Primary key: grade-section (e.g. "10-A")
      if (c.section) {
        classMap.set(`${c.grade_number}-${c.section.toUpperCase()}`, c);
      } else {
        classMap.set(`${c.grade_number}`, c);
      }
    }

    const results: ImportResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      try {
        // Generate unique username
        let baseUsername = generateUsername(row.first_name, row.last_name);
        let username = baseUsername;
        let suffix = 2;
        while (usedUsernames.has(username)) {
          username = `${baseUsername}${suffix}`;
          suffix++;
        }
        usedUsernames.add(username);

        const password = generatePassword();
        const email = `${username}@school.local`;

        // Create auth user
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (authError) throw authError;

        const userId = authUser.user.id;

        // Create profile
        const { error: profileError } = await supabase.from("profiles").insert({
          id: userId,
          first_name: row.first_name,
          last_name: row.last_name,
          username,
          student_identifier: row.student_identifier || null,
          email: row.email || null,
        });
        if (profileError) throw profileError;

        // Assign role
        await supabase.from("user_roles").insert({
          user_id: userId,
          role: row.role,
        });

        // Assign student to class
        if (row.role === "student" && row.class_grade) {
          const grade = parseGrade(row.class_grade);
          if (!isNaN(grade)) {
            const section = (row.class_section || "").trim().toUpperCase();
            const key = section ? `${grade}-${section}` : `${grade}`;
            const cls = classMap.get(key);
            if (cls) {
              const { error: assignError } = await supabase.from("student_class_assignments").insert({
                student_id: userId,
                class_id: cls.id,
                academic_year: cls.academic_year,
              });
              if (assignError) {
                console.error(`Class assignment error for ${row.first_name} ${row.last_name}: ${assignError.message}`);
              }
            } else {
              console.error(`Class not found for key "${key}" (grade=${grade}, section="${section}")`);
            }
          } else {
            console.error(`Invalid grade "${row.class_grade}" for ${row.first_name} ${row.last_name}`);
          }
        }

        results.push({ username, password, first_name: row.first_name, last_name: row.last_name, role: row.role });
        successCount++;
      } catch (err) {
        results.push({
          username: "",
          password: "",
          first_name: row.first_name,
          last_name: row.last_name,
          role: row.role,
          error: err.message,
        });
        errorCount++;
      }
    }

    // Log import batch
    await supabase.from("import_batches").insert({
      imported_by: caller.id,
      file_name: `import_${new Date().toISOString().slice(0, 10)}.csv`,
      row_count: rows.length,
      success_count: successCount,
      error_count: errorCount,
      status: errorCount === 0 ? "completed" : "completed",
      summary_json: { results },
    });

    return new Response(JSON.stringify({ results, success_count: successCount, error_count: errorCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
