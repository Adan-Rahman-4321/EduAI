"use client";

import { Bot, Home, BookOpen, Brain, Library, Calendar, Award, Users, Settings, BarChart3, X } from "lucide-react";
import { usePathname } from "next/navigation";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: "admin" | "teacher" | "student" | "parent";
  activeSection?: string;
}

export default function Sidebar({ isOpen, onClose, userRole, activeSection = "dashboard" }: SidebarProps) {
  const pathname = usePathname();

  const menuItems = {
    admin: [
      { icon: Home, label: "Dashboard", hash: "" },
      { icon: Users, label: "Users", hash: "users" },
      { icon: BarChart3, label: "Analytics", hash: "analytics" },
      { icon: Settings, label: "Settings", hash: "settings" },
    ],
    teacher: [
      { icon: Home, label: "Dashboard", hash: "" },
      { icon: BookOpen, label: "Assignments", hash: "assignments" },
      { icon: Users, label: "Students", hash: "students" },
      { icon: Calendar, label: "Attendance", hash: "attendance" },
      { icon: Library, label: "Library", hash: "library" },
    ],
    student: [
      { icon: Home, label: "Dashboard", hash: "" },
      { icon: Brain, label: "AI Tutor", hash: "tutor" },
      { icon: BookOpen, label: "Smart Quiz", hash: "quiz" },
      { icon: Award, label: "Flashcards", hash: "flashcards" },
      { icon: Library, label: "Library", hash: "library" },
      { icon: Calendar, label: "Notes", hash: "planner" },
    ],
    parent: [
      { icon: Home, label: "Dashboard", hash: "" },
      { icon: BarChart3, label: "Performance", hash: "performance" },
      { icon: BookOpen, label: "Assignments", hash: "assignments" },
      { icon: Calendar, label: "Attendance", hash: "attendance" },
    ],
  };

  const items = menuItems[userRole] || menuItems.student;

  const handleNav = (hash: string) => {
    // Update URL hash — triggers hashchange in dashboards/page.tsx
    window.location.hash = hash || "";
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-slate-900/95 backdrop-blur-md border-r border-slate-700/50 z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 md:sticky md:top-0 md:h-screen overflow-y-auto flex flex-col`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-blue-500">
              EduAI
            </span>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu Items */}
        <nav className="p-4 space-y-1 flex-1">
          {items.map((item) => {
            const Icon = item.icon;
            const sectionId = item.hash || "dashboard";
            const isActive = activeSection === sectionId || (!item.hash && activeSection === "dashboard");

            return (
              <button
                key={sectionId}
                onClick={() => handleNav(item.hash)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all text-left ${
                  isActive
                    ? "bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-slate-800 border border-transparent"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700/50 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span>AI Powered</span>
          </div>
        </div>
      </aside>
    </>
  );
}
