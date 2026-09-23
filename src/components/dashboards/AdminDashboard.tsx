'use client';

import { useState, useEffect } from 'react';
import {
  ShieldAlert, Users, TrendingUp, Activity, Database,
  Settings, Plus, X, CheckCircle2, Loader2, Shield,
  BookOpen, Brain, BarChart3, AlertCircle, Trash2,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { useUserProfile } from '@/hooks/useUserProfile';
import { auth } from '@/lib/firebase/config';

interface Analytics {
  totalUsers: number;
  activeSubscriptions: number;
  uptime: string;
  offlineSyncs: string;
  roleBreakdown: { student: number; teacher: number; parent: number; admin: number };
  completedQuizzes: number;
  avgQuizScore: number;
  notesCreated: number;
  masteredCards: number;
  totalCards: number;
  usageChart: { name: string; active_users: number; quizzes: number }[];
}

interface UserRow {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  created_at: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export default function AdminDashboard() {
  const { profile } = useUserProfile();
  const displayName = profile?.full_name || 'Admin';

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'settings'>('overview');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const [usersList, setUsersList] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('student');
  const [addingUser, setAddingUser] = useState(false);

  const [settings, setSettings] = useState({ offline_mode: true, strict_rbac: true, emergency_halt: false });
  const [notice, setNotice] = useState('');

  // â”€â”€ Fetch analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    (async () => {
      try {
        const hdrs = await authHeaders();
        const res = await fetch('/api/admin/analytics', { headers: hdrs });
        if (res.ok) setAnalytics(await res.json());
      } catch { /* show empty state */ } finally {
        setAnalyticsLoading(false);
      }
    })();
  }, []);

  // â”€â”€ Fetch users when tab changes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (activeTab !== 'users') return;
    loadUsers();
  }, [activeTab, userRoleFilter]);

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const hdrs = await authHeaders();
      const params = new URLSearchParams({ limit: '100' });
      if (userRoleFilter !== 'all') params.set('role', userRoleFilter);
      if (userSearch.trim()) params.set('search', userSearch.trim());
      const res = await fetch(`/api/admin/users?${params}`, { headers: hdrs });
      if (res.ok) {
        const d = await res.json();
        setUsersList(d.users || []);
      }
    } catch { /* empty */ } finally {
      setUsersLoading(false);
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim()) return;
    setAddingUser(true);
    try {
      const hdrs = { ...await authHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ full_name: newFullName, email: newEmail || null, role: newRole }),
      });
      if (res.ok) {
        const d = await res.json();
        setUsersList(prev => [d.user, ...prev]);
        setNotice('User created successfully!');
        setTimeout(() => setNotice(''), 3000);
      } else {
        const err = await res.json();
        setNotice(`Error: ${err.error}`);
      }
    } catch {
      setNotice('Failed to create user');
    } finally {
      setAddingUser(false);
      setNewFullName(''); setNewEmail(''); setIsAddUserOpen(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Delete this user profile?')) return;
    try {
      const hdrs = { ...await authHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch('/api/admin/users', { method: 'DELETE', headers: hdrs, body: JSON.stringify({ id }) });
      if (res.ok) setUsersList(prev => prev.filter(u => u.id !== id));
    } catch { /* silent */ }
  };

  const handleToggleSetting = async (key: 'offline_mode' | 'strict_rbac' | 'emergency_halt') => {
    const val = !settings[key];
    setSettings(prev => ({ ...prev, [key]: val }));
    try {
      const hdrs = { ...await authHeaders(), 'Content-Type': 'application/json' };
      await fetch('/api/admin/settings', { method: 'POST', headers: hdrs, body: JSON.stringify({ key, enabled: val }) });
      setNotice(`Setting "${key}" updated`);
      setTimeout(() => setNotice(''), 3000);
    } catch { /* silent */ }
  };

  // â”€â”€ Role badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const roleBadge = (role: string) => {
    const map: Record<string, string> = {
      admin:   'bg-purple-500/20 text-purple-400 border-purple-500/30',
      teacher: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
      parent:  'bg-amber-500/20 text-amber-400 border-amber-500/30',
      student: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    };
    return map[role] || 'bg-slate-700 text-slate-300 border-slate-600';
  };

  return (
    <div className="flex flex-col gap-6 w-full overflow-y-auto scrollbar-hide pb-8">

      {/* â”€â”€ Header â”€â”€ */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-sky-400" /> Welcome, {displayName}
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Platform administration â€” real-time data from Supabase</p>
        </div>
        <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
          {(['overview', 'users', 'settings'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${activeTab === tab ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {tab === 'overview' ? 'Analytics' : tab === 'users' ? 'Users' : 'Settings'}
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {notice}
        </div>
      )}

      {/* â”€â”€ Analytics Tab â”€â”€ */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-6 animate-in fade-in">
          {analyticsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-pulse">
              {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-800 rounded-xl" />)}
            </div>
          ) : analytics ? (
            <>
              {/* KPI row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { icon: Users,     label: 'Total Users',       value: analytics.totalUsers.toLocaleString(),         color: 'text-sky-400'    },
                  { icon: Brain,     label: 'Quizzes Completed',  value: analytics.completedQuizzes.toLocaleString(),   color: 'text-purple-400' },
                  { icon: BookOpen,  label: 'Notes Created',      value: analytics.notesCreated.toLocaleString(),       color: 'text-emerald-400'},
                  { icon: Activity,  label: 'Platform Uptime',    value: analytics.uptime,                              color: 'text-amber-400'  },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="glass-card p-5 flex flex-col gap-2">
                    <div className={`flex items-center gap-2 ${color}`}>
                      <Icon className="w-4 h-4" />
                      <span className="text-xs font-bold">{label}</span>
                    </div>
                    <span className="text-2xl font-bold text-white">{value}</span>
                  </div>
                ))}
              </div>

              {/* Role breakdown */}
              <div className="glass-card p-6">
                <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-sky-400" /> User Role Breakdown
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {Object.entries(analytics.roleBreakdown).map(([role, count]) => (
                    <div key={role} className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 text-center">
                      <p className="text-xl font-bold text-white">{count}</p>
                      <p className={`text-xs mt-1 capitalize font-medium ${roleBadge(role).split(' ')[1]}`}>{role}s</p>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analytics.usageChart} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
                    <Bar dataKey="active_users" name="New Registrations" fill="#0ea5e9" radius={[4,4,0,0]} />
                    <Bar dataKey="quizzes"      name="Quizzes Taken"     fill="#8b5cf6" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-xs text-slate-500 mt-2 text-center">Last 7 days â€” new registrations & quizzes per day</p>
              </div>

              {/* Secondary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="glass-card p-5">
                  <p className="text-xs text-slate-400 mb-1">Avg Quiz Score</p>
                  <p className="text-3xl font-bold text-white">{analytics.avgQuizScore}%</p>
                </div>
                <div className="glass-card p-5">
                  <p className="text-xs text-slate-400 mb-1">Flashcard Mastery</p>
                  <p className="text-3xl font-bold text-white">{analytics.masteredCards}/{analytics.totalCards}</p>
                </div>
                <div className="glass-card p-5">
                  <p className="text-xs text-slate-400 mb-1">Offline Syncs</p>
                  <p className="text-3xl font-bold text-white">{analytics.offlineSyncs}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="glass-card p-10 flex flex-col items-center gap-3">
              <AlertCircle className="w-10 h-10 text-slate-600" />
              <p className="text-slate-400">Failed to load analytics. Check your connection.</p>
            </div>
          )}
        </div>
      )}

      {/* â”€â”€ Users Tab â”€â”€ */}
      {activeTab === 'users' && (
        <div className="glass-card p-6 animate-in fade-in flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="font-semibold text-slate-200">Registered Profiles</h3>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Search name..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadUsers()}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-sky-500 w-36"
              />
              <select
                value={userRoleFilter}
                onChange={e => setUserRoleFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-sky-500"
              >
                <option value="all">All Roles</option>
                <option value="student">Students</option>
                <option value="teacher">Teachers</option>
                <option value="parent">Parents</option>
                <option value="admin">Admins</option>
              </select>
              <button onClick={() => setIsAddUserOpen(true)} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors">
                <Plus className="w-4 h-4" /> Add User
              </button>
            </div>
          </div>

          {usersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-sky-400 animate-spin" />
            </div>
          ) : usersList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Users className="w-10 h-10 text-slate-600" />
              <p className="text-slate-400 text-sm">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-800/50 text-xs uppercase tracking-wider text-slate-400">
                    <th className="p-3 font-medium">Name</th>
                    <th className="p-3 font-medium">Email</th>
                    <th className="p-3 font-medium">Role</th>
                    <th className="p-3 font-medium">Joined</th>
                    <th className="p-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {usersList.map(user => (
                    <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3 font-medium text-slate-200 text-sm">{user.full_name || 'â€”'}</td>
                      <td className="p-3 text-sm text-slate-400">{user.email || 'â€”'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${roleBadge(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-slate-400">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'â€”'}
                      </td>
                      <td className="p-3 text-right">
                        <button onClick={() => handleDeleteUser(user.id)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-slate-600 mt-2 px-1">{usersList.length} record{usersList.length !== 1 ? 's' : ''} shown</p>
            </div>
          )}

          {/* Add User Modal */}
          {isAddUserOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 max-w-md w-full shadow-2xl relative animate-in zoom-in-95">
                <button onClick={() => setIsAddUserOpen(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/50 rounded-full">
                  <X className="w-4 h-4" />
                </button>
                <h3 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-400" /> Add New Profile
                </h3>
                <form onSubmit={handleAddUser} className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase">Full Name</label>
                    <input type="text" required placeholder="e.g. Ayesha Siddiqa" value={newFullName} onChange={e => setNewFullName(e.target.value)} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase">Email (optional)</label>
                    <input type="email" placeholder="user@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase">Role</label>
                    <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 text-sm">
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="parent">Parent</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex gap-3 mt-2">
                    <button type="button" onClick={() => setIsAddUserOpen(false)} className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm">Cancel</button>
                    <button type="submit" disabled={addingUser} className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 disabled:opacity-60">
                      {addingUser ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : 'Create Profile'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* â”€â”€ Settings Tab â”€â”€ */}
      {activeTab === 'settings' && (
        <div className="glass-card p-6 animate-in fade-in flex flex-col gap-4">
          <h3 className="font-semibold text-slate-200 flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-400" /> Platform Controls
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'offline_mode' as const, title: 'Offline Learning Mode', desc: 'Allow textbook & quiz local caching', danger: false },
              { key: 'strict_rbac' as const,  title: 'Strict RBAC Policies',  desc: 'Enforce role-based permission constraints', danger: false },
            ].map(({ key, title, desc }) => (
              <div key={key} className="p-4 border border-slate-700/50 rounded-xl bg-slate-800/30 flex justify-between items-center">
                <div>
                  <h4 className="text-white font-medium">{title}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                </div>
                <button
                  onClick={() => handleToggleSetting(key)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings[key] ? 'bg-emerald-500' : 'bg-slate-700'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${settings[key] ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            ))}
            <div className="p-4 border border-red-500/20 rounded-xl bg-red-500/10 flex justify-between items-center md:col-span-2">
              <div>
                <h4 className="text-red-400 font-medium">Emergency System Halt</h4>
                <p className="text-xs text-red-300 mt-0.5">Temporarily restrict new user sessions platform-wide</p>
              </div>
              <button
                onClick={() => handleToggleSetting('emergency_halt')}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${settings.emergency_halt ? 'bg-red-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}
              >
                {settings.emergency_halt ? 'Resume System' : 'Initiate Halt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

