"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/config";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Settings, X, LogOut, User } from "lucide-react";
import AdminDashboard from "@/components/dashboards/AdminDashboard";
import TeacherDashboard from "@/components/dashboards/TeacherDashboard";
import ParentDashboard from "@/components/dashboards/ParentDashboard";
import StudentTabs from "@/components/StudentTabs";
import Sidebar from "@/components/Sidebar";

type UserRole = "admin" | "teacher" | "student" | "parent";

// ── Inline Settings Modal ────────────────────────────────────────────────────
function SettingsModal({ onClose, language }: { onClose: () => void; language: "EN" | "UR" }) {
  const isUrdu = language === "UR";
  const [darkMode, setDarkMode] = useState(true);
  const [aiVoice, setAiVoice] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    try { await signOut(auth); } catch {}
    router.push("/auth");
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <h3 className={`text-base font-bold text-white flex items-center gap-2 ${isUrdu ? "font-urdu" : ""}`}>
            <Settings className="w-4 h-4 text-sky-400" />
            {isUrdu ? "ترتیبات" : "Settings"}
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Dark Mode */}
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium text-slate-200 ${isUrdu ? "font-urdu" : ""}`}>{isUrdu ? "ڈارک موڈ" : "Dark Mode"}</p>
              <p className={`text-xs text-slate-400 ${isUrdu ? "font-urdu" : ""}`}>{isUrdu ? "تھیم تبدیل کریں" : "Toggle dark theme"}</p>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`w-10 h-5 rounded-full relative transition-colors ${darkMode ? "bg-sky-500" : "bg-slate-700"}`}
            >
              <span className={`absolute top-1 w-3 h-3 bg-white rounded-full shadow transition-all ${darkMode ? "right-1" : "left-1"}`} />
            </button>
          </div>

          {/* AI Voice */}
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium text-slate-200 ${isUrdu ? "font-urdu" : ""}`}>{isUrdu ? "AI آواز" : "AI Tutor Voice"}</p>
              <p className={`text-xs text-slate-400 ${isUrdu ? "font-urdu" : ""}`}>{isUrdu ? "آواز جوابات فعال کریں" : "Enable voice responses"}</p>
            </div>
            <button
              onClick={() => setAiVoice(!aiVoice)}
              className={`w-10 h-5 rounded-full relative transition-colors ${aiVoice ? "bg-sky-500" : "bg-slate-700"}`}
            >
              <span className={`absolute top-1 w-3 h-3 rounded-full shadow transition-all ${aiVoice ? "bg-white right-1" : "bg-slate-400 left-1"}`} />
            </button>
          </div>

          {/* Profile */}
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors text-sm">
            <User className="w-4 h-4" />
            {isUrdu ? "پروفائل دیکھیں" : "View Profile"}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors text-sm border border-red-500/20"
          >
            <LogOut className="w-4 h-4" />
            {isUrdu ? "لاگ آؤٹ" : "Log Out"}
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium transition-colors text-sm"
          >
            {isUrdu ? "محفوظ کریں" : "Save Preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard Page ──────────────────────────────────────────────────────
export default function DashboardsPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [language, setLanguage] = useState<"EN" | "UR">("EN");
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("dashboard");
  const [showSettings, setShowSettings] = useState(false);

  // Hash-based navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      setActiveSection(hash || "dashboard");
    };
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Firebase auth
  useEffect(() => {
    let mounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (mounted) router.push("/auth");
        return;
      }
      try {
        let tokenResult = await user.getIdTokenResult();
        let userRole = tokenResult.claims.role as UserRole | undefined;
        if (!userRole) {
          const idToken = await user.getIdToken();
          const res = await fetch("/api/auth/role", { headers: { Authorization: `Bearer ${idToken}` } });
          if (res.ok) {
            const data = await res.json();
            userRole = data.role as UserRole;
            await user.getIdToken(true);
          }
        }
        if (mounted) setRole(userRole || "student");
      } catch {
        if (mounted) setRole("student");
      } finally {
        if (mounted) setIsLoading(false);
      }
    });
    return () => { mounted = false; unsubscribe(); };
  }, [router]);

  if (isLoading || !role) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userRole={role}
        activeSection={activeSection}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="glass-panel sticky top-0 z-40 px-4 md:px-6 py-3 border-b border-slate-700/50 flex items-center justify-between">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* EduAI brand — mobile */}
          <span className="md:hidden text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-blue-500">
            EduAI
          </span>

          {/* Right controls */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Language switcher */}
            <div className="flex items-center bg-slate-800/50 rounded-full p-0.5 border border-slate-700/50">
              <button
                onClick={() => setLanguage("EN")}
                className={`px-2.5 md:px-3 py-1 rounded-full text-xs md:text-sm font-medium transition-colors ${language === "EN" ? "bg-sky-500 text-white" : "text-slate-400 hover:text-slate-200"}`}
              >EN</button>
              <button
                onClick={() => setLanguage("UR")}
                className={`px-2.5 md:px-3 py-1 rounded-full text-xs md:text-sm font-medium transition-colors font-urdu ${language === "UR" ? "bg-sky-500 text-white" : "text-slate-400 hover:text-slate-200"}`}
              >اردو</button>
            </div>

            {/* Settings button */}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full h-full">
            {role === "admin" && <AdminDashboard />}
            {role === "teacher" && <TeacherDashboard language={language} />}
            {role === "student" && <StudentTabs language={language} activeSection={activeSection} />}
            {role === "parent" && <ParentDashboard language={language} />}
          </div>
        </main>
      </div>

      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} language={language} />}
    </div>
  );
}
