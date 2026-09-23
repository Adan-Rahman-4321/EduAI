"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/config";
import { onAuthStateChanged } from "firebase/auth";

export interface UserProfile {
  id?: string;
  full_name: string;
  email: string | null;
  role: string;
}

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (mounted) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/auth/profile", {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setProfile(data.profile);
          }
        } else if (mounted) {
          setProfile({
            full_name: user.displayName || user.email?.split("@")[0] || "User",
            email: user.email || null,
            role: "student",
          });
        }
      } catch {
        if (mounted) {
          setProfile({
            full_name: user.displayName || user.email?.split("@")[0] || "User",
            email: user.email || null,
            role: "student",
          });
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return { profile, loading };
}
