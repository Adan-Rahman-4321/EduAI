"use client";

import { useState, useEffect } from "react";
import { Home, Brain, BookOpen, Award, Library, Calendar } from "lucide-react";
import StudentDashboard from "./dashboards/StudentDashboard";
import AITutorChat from "./AITutorChat";
import SmartQuizGenerator from "./SmartQuizGenerator";
import FlashcardsViewer from "./FlashcardsViewer";
import DigitalLibrary from "./DigitalLibrary";
import AINotesGenerator from "./AINotesGenerator";

interface StudentTabsProps {
  language: "EN" | "UR";
  activeSection?: string;
}

export default function StudentTabs({ language, activeSection }: StudentTabsProps) {
  const [activeTab, setActiveTab] = useState(activeSection || "dashboard");

  // Sync with external activeSection changes (from Sidebar navigation)
  useEffect(() => {
    if (activeSection) {
      setActiveTab(activeSection);
    }
  }, [activeSection]);

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: Home, component: StudentDashboard },
    { id: "tutor", label: "AI Tutor", icon: Brain, component: AITutorChat },
    { id: "quiz", label: "Smart Quiz", icon: BookOpen, component: SmartQuizGenerator },
    { id: "flashcards", label: "Flashcards", icon: Award, component: FlashcardsViewer },
    { id: "library", label: "Library", icon: Library, component: DigitalLibrary },
    { id: "planner", label: "Notes", icon: Calendar, component: AINotesGenerator },
  ];

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || StudentDashboard;

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation - Hidden on mobile, visible on larger screens */}
      <div className="hidden md:flex gap-2 mb-6 p-2 bg-slate-900/50 rounded-xl border border-slate-700/50 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-sky-500 text-white shadow-lg shadow-sky-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        <ActiveComponent language={language} />
      </div>
    </div>
  );
}
