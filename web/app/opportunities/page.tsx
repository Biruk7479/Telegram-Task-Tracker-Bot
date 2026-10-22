'use client';

// Opportunities: scholarships, internships, jobs and the like, each with a
// deadline, a plan for when to apply and a checklist of what it asks for.
// Three columns — Lily, Zen, both of us — read from /api/opportunities.
// Anyone can read; adding, editing and ticking requirements need a member's login.
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  apiService,
  auth,
  AuthUser,
  Opportunity,
  OpportunityCategory,
  OpportunityStatus,
  OPPORTUNITY_CATEGORIES,
  OPPORTUNITY_STATUSES,
  OPEN_OPPORTUNITY_STATUSES,
} from '../../lib/api';
import OpportunityCard, { ZEN_ID, LILY_ID, memberName } from '../../components/OpportunityCard';
import OpportunityForm from '../../components/OpportunityForm';

type GroupKey = 'lily' | 'zen' | 'both';
type StatusFilter = 'open' | 'all' | OpportunityStatus;
type CategoryFilter = 'all' | OpportunityCategory;

const GROUPS: { key: GroupKey; title: string; subtitle: string; accent: string }[] = [
  { key: 'lily', title: 'Lily', subtitle: 'Lily only', accent: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'zen', title: 'Zen', subtitle: 'Zen only', accent: 'text-blue-600 dark:text-blue-400' },
  { key: 'both', title: 'Both', subtitle: 'Both of us', accent: 'text-violet-600 dark:text-violet-400' },
];

// Two assignees → Both; otherwise whoever it is assigned to (falling back on the creator).
const groupOf = (o: Opportunity): GroupKey => {
  const ids = o.assignedTo?.length ? o.assignedTo : [o.createdBy];
  const lily = ids.includes(LILY_ID);
  const zen = ids.includes(ZEN_ID);
  if (lily && zen) return 'both';
  if (lily) return 'lily';
  if (zen) return 'zen';
  return 'both';
};

const isOpen = (o: Opportunity) => OPEN_OPPORTUNITY_STATUSES.includes(o.status);

const statusOf = (err: unknown): number | undefined =>
  (err as { response?: { status?: number } } | undefined)?.response?.status;

const PILL_ON = 'bg-gray-900 text-white dark:bg-white dark:text-gray-900';
const PILL_OFF = 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700';

export default function OpportunitiesPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Login: the token lives in sessionStorage (see lib/api.ts); the password decides who you are.
  const [user, setUser] = useState<AuthUser | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginHint, setLoginHint] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
    if (auth.getToken()) setUser(auth.getUser());
  }, []);

  const load = useCallback(async () => {
    try {
      setOpportunities(await apiService.getOpportunities());
      setError(null);
    } catch {
      setError('The opportunities could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // ---- login -------------------------------------------------------------

  const askLogin = (hint: string) => {
    setLoginHint(hint);
    setLoginError('');
    setShowLogin(true);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const loggedIn = await apiService.login(password);
      setUser(loggedIn);
      setShowLogin(false);
      setLoginHint(null);
      setLoginError('');
      setPassword('');
    } catch {
      setLoginError('Incorrect password. Only Zen and Lily can make changes.');
      setPassword('');
    }
  };

  const handleLogout = () => {
    auth.clear();
    setUser(null);
    setShowForm(false);
    setEditing(null);
  };

  // A write came back 401: the token has expired, so ask for the password again.
  const handleWriteError = (err: unknown, message: string) => {
    console.error(message, err);
    if (statusOf(err) === 401) {
      auth.clear();
      setUser(null);
      askLogin('Your login has expired. Log in again to make changes.');
      return;
    }
    if (statusOf(err) === 403) {
      alert('Only the person this opportunity belongs to can change it.');
      return;
    }
    alert(message);
  };

  // ---- writes ------------------------------------------------------------

  const currentUserId = user?.telegramId ?? '';
  const partnerUserId = currentUserId === LILY_ID ? ZEN_ID : LILY_ID;

  const replaceInList = (updated: Opportunity) =>
    setOpportunities((prev) => prev.map((o) => (o._id === updated._id ? updated : o)));

  const startAdding = () => {
    if (!user) {
      askLogin('Log in to add an opportunity.');
      return;
    }
    setEditing(null);
    setShowForm(true);
  };

  const startEditing = (o: Opportunity) => {
    if (!user) {
      askLogin('Log in to edit an opportunity.');
      return;
    }
    setEditing(o);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const handleSave = async (fields: Partial<Opportunity> & { name: string }) => {
    setSaving(true);
    try {
      if (editing) {
        replaceInList(await apiService.updateOpportunity(editing._id, fields));
      } else {
        await apiService.createOpportunity(fields);
        await load(); // the API sorts by deadline; let it place the new one
      }
      closeForm();
    } catch (err) {
      handleWriteError(err, editing ? 'The opportunity could not be saved.' : 'The opportunity could not be added.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (o: Opportunity) => {
    if (!confirm(`Delete "${o.name}"? This cannot be undone.`)) return;
    setBusyId(o._id);
    try {
      await apiService.deleteOpportunity(o._id);
      setOpportunities((prev) => prev.filter((x) => x._id !== o._id));
    } catch (err) {
      handleWriteError(err, 'The opportunity could not be deleted.');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleRequirement = async (o: Opportunity, index: number, done: boolean) => {
    setBusyId(o._id);
    try {
      replaceInList(await apiService.setOpportunityRequirement(o._id, index, done));
    } catch (err) {
      handleWriteError(err, 'The requirement could not be updated.');
    } finally {
      setBusyId(null);
    }
  };

  // ---- filters -----------------------------------------------------------

  const matchesStatus = (o: Opportunity) =>
    statusFilter === 'all' ? true : statusFilter === 'open' ? isOpen(o) : o.status === statusFilter;
  const matchesCategory = (o: Opportunity) => categoryFilter === 'all' || o.category === categoryFilter;
  const visible = opportunities.filter((o) => matchesStatus(o) && matchesCategory(o));

  const countFor = (filter: StatusFilter) =>
    opportunities.filter((o) => (filter === 'all' ? true : filter === 'open' ? isOpen(o) : o.status === filter)).length;

  const byGroup = (key: GroupKey) => visible.filter((o) => groupOf(o) === key);

  const statusPills: { key: StatusFilter; label: string }[] = [
    { key: 'open', label: 'Open' },
    { key: 'all', label: 'All' },
    ...OPPORTUNITY_STATUSES.map((s) => ({ key: s as StatusFilter, label: s })),
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-light tracking-tight text-gray-900 dark:text-white">Task Tracker</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Build habits together</p>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-1">
                  <span className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-white">
                    {user.name || memberName(user.telegramId)}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-900 transition"
                  >
                    Log out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => askLogin('Log in to add, edit or tick things off. Reading needs no login.')}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-900 transition"
                >
                  Log in
                </button>
              )}
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition"
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
                <Link href="/" className="px-5 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  Calendar
                </Link>
                <Link href="/plan" className="px-5 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  Plan
                </Link>
                <span className="px-5 py-2 rounded-md text-sm font-medium bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm">
                  Opportunities
                </span>
                <Link href="/rules" className="px-5 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  Rules
                </Link>
                <Link href="/manage" className="px-5 py-2 rounded-md text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition shadow-sm">
                  Manage
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Opportunities</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Scholarships, internships, jobs and the rest: when they close, when we plan to apply, and what each one asks for.
          </p>
        </div>

        {/* Login, shown only when a change needs it */}
        {showLogin && !user && (
          <form
            onSubmit={handleLogin}
            className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 mb-6 max-w-md"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Log in</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
              {loginHint ?? 'Your own password decides who you are.'}
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoFocus
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-950 text-gray-900 dark:text-white text-sm"
            />
            {loginError && (
              <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
                {loginError}
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                className="flex-1 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => setShowLogin(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Add / edit */}
        <div className="mb-6">
          {showForm && user ? (
            <OpportunityForm
              key={editing?._id ?? 'new'}
              opportunity={editing}
              currentUserId={currentUserId}
              partnerUserId={partnerUserId}
              saving={saving}
              onSave={handleSave}
              onCancel={closeForm}
            />
          ) : (
            <button
              onClick={startAdding}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              + Add an opportunity
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 mb-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {statusPills.map((pill) => (
                <button
                  key={pill.key}
                  onClick={() => setStatusFilter(pill.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    statusFilter === pill.key ? PILL_ON : PILL_OFF
                  }`}
                >
                  {pill.label} <span className="ml-1 opacity-60">({countFor(pill.key)})</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-950 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All categories</option>
              {OPPORTUNITY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* The list, grouped by whose it is */}
        {loading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {GROUPS.map((g) => (
              <div key={g.key} className="animate-pulse bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-3">
                <div className="h-5 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
                <div className="h-24 bg-gray-100 dark:bg-gray-800/60 rounded" />
                <div className="h-24 bg-gray-100 dark:bg-gray-800/60 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 text-sm text-gray-500 dark:text-gray-400">
            {error}
          </div>
        ) : opportunities.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
            <p className="text-lg font-medium text-gray-600 dark:text-gray-400">No opportunities yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Add the first one above.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
            <p className="text-lg font-medium text-gray-600 dark:text-gray-400">Nothing matches these filters</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              {opportunities.length} in all; try &quot;All&quot; or another category.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {GROUPS.map((g) => {
              const list = byGroup(g.key);
              return (
                <section key={g.key} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                  <div className="flex items-baseline justify-between mb-4">
                    <h3 className={`text-lg font-semibold ${g.accent}`}>
                      {g.title}
                      <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">{list.length}</span>
                    </h3>
                    <span className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">{g.subtitle}</span>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">Nothing here.</p>
                  ) : (
                    <div className="space-y-3">
                      {list.map((o) => (
                        <OpportunityCard
                          key={o._id}
                          opportunity={o}
                          loggedIn={!!user}
                          canEdit={!!user && o.assignedTo.includes(user.telegramId)}
                          busy={busyId === o._id}
                          onEdit={() => startEditing(o)}
                          onDelete={() => handleDelete(o)}
                          onToggleRequirement={(index, done) => handleToggleRequirement(o, index, done)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-800 mt-16 py-8">
        <div className="container mx-auto px-6 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Made with ❤️ for Lily by Aj</p>
        </div>
      </footer>
    </div>
  );
}
