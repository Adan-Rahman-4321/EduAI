"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import AdminDashboard from "@/components/dashboards/AdminDashboard";
import TeacherDashboard from "@/components/dashboards/TeacherDashboard";
import StudentDashboard from "@/components/dashboards/StudentDashboard";
import ParentDashboard from "@/components/dashboards/ParentDashboard";
import Navbar from "@/components/Navbar";

type UserRole = "admin" | "teacher" | "student" | "parent";

export default function DashboardsPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [language, setLanguage] = useState<"EN" | "UR">("EN");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (mounted) {
          router.push("/auth");
        }
        return;
      }

      try {
        let tokenResult = await user.getIdTokenResult();
        let userRole = tokenResult.claims.role as UserRole | undefined;

        // If custom claim is not set yet, fetch and register it via server
        if (!userRole) {
          const idToken = await user.getIdToken();
          const res = await fetch("/api/auth/role", {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            userRole = data.role as UserRole;
            await user.getIdToken(true);
          }
        }

        if (mounted) {
          setRole(userRole || "student");
        }
      } catch (err) {
        console.error("Firebase authorization error:", err);
        if (mounted) {
          setRole("student");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [router]);

  if (isLoading || !role) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <Navbar language={language} setLanguage={setLanguage} />
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {role === "admin" && <AdminDashboard />}
        {role === "teacher" && <TeacherDashboard language={language} />}
        {role === "student" && <StudentDashboard language={language} />}
        {role === "parent" && <ParentDashboard language={language} />}
      </main>
    </div>
  );
}
