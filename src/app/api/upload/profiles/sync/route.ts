import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_ROLES = ["student", "teacher", "parent", "admin"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing authentication token" },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const body = await request.json().catch(() => ({}));
    const { fullName, email, role: requestedRole } = body;

    const supabase = createAdminClient();

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("firebase_uid", decodedToken.uid)
      .maybeSingle();

    const roleToSet: ValidRole =
      requestedRole && VALID_ROLES.includes(requestedRole)
        ? requestedRole
        : existingProfile?.role && VALID_ROLES.includes(existingProfile.role as ValidRole)
        ? (existingProfile.role as ValidRole)
        : (decodedToken.role as ValidRole) || "student";

    // Securely set Firebase Custom User Claim for authorization
    await adminAuth.setCustomUserClaims(decodedToken.uid, { role: roleToSet });

    if (!existingProfile) {
      const { data, error } = await supabase
        .from("profiles")
        .insert({
          firebase_uid: decodedToken.uid,
          full_name: fullName || decodedToken.name || null,
          email: email || decodedToken.email || null,
          role: roleToSet,
        })
        .select()
        .single();

      if (error) {
        console.warn("Profile insert warning:", error.message);
      }

      return NextResponse.json({
        success: true,
        profile: data,
        role: roleToSet,
        message: "Profile created",
      });
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName || decodedToken.name || null,
        email: email || decodedToken.email || null,
        role: roleToSet,
      })
      .eq("firebase_uid", decodedToken.uid)
      .select()
      .single();

    if (error) {
      console.warn("Profile update warning:", error.message);
    }

    return NextResponse.json({
      success: true,
      profile: data,
      role: roleToSet,
      message: "Profile updated",
    });
  } catch (error: any) {
    console.error("Profile sync error:", error);

    return NextResponse.json(
      { error: error?.message || "Authentication failed" },
      { status: 401 }
    );
  }
}