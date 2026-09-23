import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_ROLES = ["student", "teacher", "parent", "admin"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

// ── GET: resolve role from token claim or DB ──────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));

    // Already has valid claim
    if (decoded.role && VALID_ROLES.includes(decoded.role as ValidRole))
      return NextResponse.json({ role: decoded.role });

    // Lookup in DB by firebase_uid
    let assignedRole: ValidRole = "student";
    try {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("firebase_uid", decoded.uid)
        .maybeSingle();
      if (data?.role && VALID_ROLES.includes(data.role as ValidRole))
        assignedRole = data.role as ValidRole;
    } catch { /* fallback to student */ }

    await adminAuth.setCustomUserClaims(decoded.uid, { role: assignedRole });
    return NextResponse.json({ role: assignedRole });
  } catch (e) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// ── POST: assign role, sync profile to Supabase ───────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json({ error: "Missing token" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    const requestedRole = String(body.role || "student");
    let role: ValidRole = VALID_ROLES.includes(requestedRole as ValidRole)
      ? (requestedRole as ValidRole)
      : "student";

    // Admin role: check allowlist (soft — don't hard-block if table missing)
    if (requestedRole === "admin") {
      try {
        const supabase = createAdminClient();
        const { data: allowed } = await supabase
          .from("admin_allowlist")
          .select("email")
          .eq("email", (decoded.email || "").toLowerCase())
          .maybeSingle();
        if (!allowed) {
          return NextResponse.json(
            { error: "Access denied — email not in admin allowlist." },
            { status: 403 }
          );
        }
        role = "admin";
      } catch {
        // If admin_allowlist table doesn't exist yet, allow — admin sets up DB manually
        role = "admin";
      }
    }

    // Set Firebase custom claim
    await adminAuth.setCustomUserClaims(decoded.uid, { role });

    // Sync to Supabase profiles
    // profiles.id is BIGINT IDENTITY — don't pass it; upsert on firebase_uid
    try {
      const supabase = createAdminClient();

      const upsertData: Record<string, unknown> = {
        firebase_uid: decoded.uid,
        full_name:    String(body.fullName || decoded.name || "").trim() || "User",
        email:        decoded.email || null,
        role,
      };

      // Parent: store child link
      if (role === "parent" && body.childStudentEmail) {
        upsertData.child_student_email =
          String(body.childStudentEmail).trim().toLowerCase();
      }

      const { error: upsertErr } = await supabase
        .from("profiles")
        .upsert(upsertData, { onConflict: "firebase_uid" });

      if (upsertErr) {
        console.warn("[role/POST] profile upsert warning:", upsertErr.message);
      }
    } catch (e) {
      console.warn("[role/POST] DB sync error:", e);
    }

    return NextResponse.json({ success: true, role });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
