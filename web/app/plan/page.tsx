'use client';

// The plan from the notebook page: who owns which area, and what sits inside
// each one. Three columns — Li, both of us ("Lizen"), Zen — read from
// /api/structure, which the tracker can rewrite from its Settings page.
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiService, StructureArea } from '../../lib/api';

const COLUMNS: { owner: StructureArea['owner']; title: string; subtitle: string; accent: string }[] = [
  { owner: 'li', title: 'Li', subtitle: 'Lily only', accent: 'text-emerald-600 dark:text-emerald-400' },
  { owner: 'lizen', title: 'Lizen', subtitle: 'Both of us', accent: 'text-violet-600 dark:text-violet-400' },
  { owner: 'zen', title: 'Zen', subtitle: 'Zen only', accent: 'text-blue-600 dark:text-blue-400' },
];

export default function PlanPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [areas, setAreas] = useState<StructureArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    apiService
      .getStructure()
      .then(setAreas)
      .catch(() => setError('The plan could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

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

  const byOwner = (owner: StructureArea['owner']) =>
    areas.filter((a) => a.owner === owner).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

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
                <span className="px-5 py-2 rounded-md text-sm font-medium bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm">
                  Plan
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">The plan</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            The notebook page: what each of us runs alone, and what we run together. Tasks and goals hang off these areas.
          </p>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {COLUMNS.map((c) => (
              <div key={c.owner} className="animate-pulse bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-3">
                <div className="h-5 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
                <div className="h-16 bg-gray-100 dark:bg-gray-800/60 rounded" />
                <div className="h-16 bg-gray-100 dark:bg-gray-800/60 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 text-sm text-gray-500 dark:text-gray-400">
            {error}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {COLUMNS.map((c) => {
              const list = byOwner(c.owner);
              return (
                <section key={c.owner} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                  <div className="flex items-baseline justify-between mb-4">
                    <h3 className={`text-lg font-semibold ${c.accent}`}>{c.title}</h3>
                    <span className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">{c.subtitle}</span>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">Nothing here yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {list.map((a) => (
                        <div key={`${a.owner}-${a.area}`} className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/60 p-3">
                          <div className="font-medium text-gray-900 dark:text-white">{a.area}</div>
                          {a.items.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5">
                              {a.items.map((item) => (
                                <li key={item} className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
                                  <span className="text-gray-300 dark:text-gray-600">•</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
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
