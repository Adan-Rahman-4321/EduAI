import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_ROLES = ["student", "teacher", "parent", "admin"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing authorization token" }, { status: 401 });
    }

    const idToken = authHeader.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    // If custom claim role exists, return it
    if (decodedToken.role && VALID_ROLES.includes(decodedToken.role as ValidRole)) {
      return NextResponse.json({ role: decodedToken.role });
    }

    // Otherwise, check database for existing role
    let assignedRole: ValidRole = "student";
    try {
      const supabase = createAdminClient();
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("firebase_uid", decodedToken.uid)
        .maybeSingle();

      if (profile?.role && VALID_ROLES.includes(profile.role as ValidRole)) {
        assignedRole = profile.role as ValidRole;
      }
    } catch (dbErr) {
      console.warn("Database lookup in /api/auth/role GET failed:", dbErr);
    }

    // Set custom claim so all future tokens have the verified role
    await adminAuth.setCustomUserClaims(decodedToken.uid, { role: assignedRole });

    return NextResponse.json({ role: assignedRole });
  } catch (error: any) {
    console.error("Error in GET /api/auth/role:", error);
    return NextResponse.json({ error: error?.message || "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing authorization token" }, { status: 401 });
    }

    const idToken = authHeader.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const body = await request.json().catch(() => ({}));
    const requestedRole = body.role;

    const role: ValidRole = VALID_ROLES.includes(requestedRole) ? requestedRole : "student";

    // Set cryptographic Firebase Custom User Claim
    await adminAuth.setCustomUserClaims(decodedToken.uid, { role });

    // Sync to Supabase profiles table for database relations
    try {
      const supabase = createAdminClient();
      const { error: syncError } = await supabase
        .from("profiles")
        .upsert(
          {
            firebase_uid: decodedToken.uid,
            full_name: body.fullName || decodedToken.name || null,
            email: decodedToken.email || null,
            role,
          },
          { onConflict: "firebase_uid" }
        );

      if (syncError) {
        console.warn("Profile sync in /api/auth/role POST warning:", syncError.message);
      }
    } catch (syncErr) {
      console.warn("Database sync warning in /api/auth/role:", syncErr);
    }

    return NextResponse.json({ success: true, role });
  } catch (error: any) {
    console.error("Error in POST /api/auth/role:", error);
    return NextResponse.json({ error: error?.message || "Failed to set role" }, { status: 500 });
  }
}
