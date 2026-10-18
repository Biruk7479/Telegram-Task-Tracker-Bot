'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function RulesPage() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-light tracking-tight text-gray-900 dark:text-white">
                Task Tracker
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Build habits together
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Dark Mode Toggle */}
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition"
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
              
              {/* View Toggle */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
                <Link
                  href="/"
                  className="px-5 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  Calendar
                </Link>
                <Link
                  href="/"
                  className="px-5 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  Tasks
                </Link>
                <span className="px-5 py-2 rounded-md text-sm font-medium bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm">
                  Rules
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-[1600px]">
        <div className="max-w-5xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 dark:text-white mb-4">
              Game Rules
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Everything you need to know about how the task tracking system works
            </p>
          </div>

          {/* Weekly XP System */}
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 mb-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-4 mb-6">
              <div className="text-5xl">💯</div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Weekly XP System
                </h2>
                <p className="text-gray-600 dark:text-gray-400">The foundation of the game</p>
              </div>
            </div>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <div className="flex items-start gap-3">
                <span className="text-blue-600 dark:text-blue-400 font-bold mt-1">•</span>
                <p className="text-lg">
                  Everyone starts with <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-bold">100 XP</span> at the beginning of each week
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-blue-600 dark:text-blue-400 font-bold mt-1">•</span>
                <p className="text-lg">
                  Weeks run <span className="font-bold text-blue-600 dark:text-blue-400">Monday to Sunday</span> and settle on <span className="font-bold text-blue-600 dark:text-blue-400">Monday at 6:00 AM</span>, once Sunday has closed (Ethiopia Time, UTC+3)
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-600 dark:text-green-400 font-bold mt-1">•</span>
                <p className="text-lg">
                  Completing tasks <span className="font-bold">preserves</span> your XP - you don't gain points, you keep what you have
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-red-600 dark:text-red-400 font-bold mt-1">•</span>
                <p className="text-lg">
                  Missing tasks causes you to <span className="font-bold text-red-600 dark:text-red-400">LOSE XP</span> through penalties
                </p>
              </div>
            </div>
          </section>

          {/* Task Completion Window */}
          <section className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl shadow-lg p-8 mb-6 border-2 border-green-200 dark:border-green-800">
            <div className="flex items-start gap-4 mb-6">
              <div className="text-5xl">⏰</div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Daily Completion Window
                </h2>
                <p className="text-gray-700 dark:text-gray-300">How long you have to complete tasks</p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">The 6 AM Rule</h3>
              <div className="space-y-3 text-gray-700 dark:text-gray-300">
                <p className="text-lg">
                  Each day's tasks can be completed from <span className="font-bold text-green-600 dark:text-green-400">00:00 (midnight)</span> until <span className="font-bold text-green-600 dark:text-green-400">6:00 AM the next day</span>.
                </p>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 font-mono text-sm">
                  <p className="mb-2 font-bold text-gray-900 dark:text-white">Example:</p>
                  <p>Sunday task scheduled for 8:00 PM</p>
                  <p className="text-green-600 dark:text-green-400">✓ Can complete: Sunday 00:00 - Monday 6:00 AM</p>
                  <p className="text-red-600 dark:text-red-400">✗ After Monday 6:00 AM: Too late, marked incomplete</p>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border border-yellow-300 dark:border-yellow-700">
              <p className="text-yellow-800 dark:text-yellow-300 font-semibold">
                💡 Pro Tip: You have extra time until 6 AM the next morning to confirm tasks from the previous day!
              </p>
            </div>
          </section>

          {/* Task Confirmation */}
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 mb-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-4 mb-6">
              <div className="text-5xl">✅</div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Task Confirmation
                </h2>
                <p className="text-gray-600 dark:text-gray-400">How to respond when tasks are due</p>
              </div>
            </div>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p className="text-lg">
                When it's time for a task, the bot sends a message: <span className="font-semibold">"Did you complete this task?"</span>
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-5 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">✅</span>
                    <h3 className="font-bold text-lg text-green-700 dark:text-green-300">Click Yes</h3>
                  </div>
                  <p>Your XP is preserved. Task marked complete. Streak continues!</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-5 border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">❌</span>
                    <h3 className="font-bold text-lg text-red-700 dark:text-red-300">Click No</h3>
                  </div>
                  <p>Lose 10 XP. Streak resets to 0. Changed your mind? Switching to Yes before the day closes gives the XP back.</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-5 border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🙏</span>
                    <h3 className="font-bold text-lg text-yellow-700 dark:text-yellow-300">Click Excuse</h3>
                  </div>
                  <p>No XP lost and your streak is kept. Only 2 excuses per week, so save them for real reasons.</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">➕</span>
                    <h3 className="font-bold text-lg text-blue-700 dark:text-blue-300">Counter tasks</h3>
                  </div>
                  <p>Tasks like &quot;2 job applications&quot; take ➕1 taps. Reaching the target counts as done; finishing short of it counts as a No.</p>
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800">
                <p className="text-lg">
                  <span className="font-bold">Advanced:</span> Use <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">/markdone</code> to complete tasks in advance without waiting for confirmation prompts.
                </p>
              </div>
            </div>
          </section>

          {/* Penalties - THE KEY RULE */}
          <section className="bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-red-900/30 dark:via-orange-900/30 dark:to-yellow-900/30 rounded-2xl shadow-xl p-8 mb-6 border-4 border-red-300 dark:border-red-700">
            <div className="flex items-start gap-4 mb-6">
              <div className="text-5xl">⚖️</div>
              <div>
                <h2 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-2">
                  Penalties
                </h2>
                <p className="text-red-700 dark:text-red-300 text-lg font-semibold">
                  🔥 XP only goes down. Ignoring a task costs more than an honest No.
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 shadow-md">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">What each answer costs</h3>
              <div className="divide-y divide-gray-200 dark:divide-gray-700 text-lg text-gray-700 dark:text-gray-300">
                <div className="flex justify-between py-3"><span>✅ Done</span><span className="font-mono font-bold text-green-600 dark:text-green-400">0</span></div>
                <div className="flex justify-between py-3"><span>🙏 Excused (2 per week)</span><span className="font-mono font-bold text-yellow-600 dark:text-yellow-400">0</span></div>
                <div className="flex justify-between py-3"><span>❌ Said No, or a counter short of its target</span><span className="font-mono font-bold text-red-600 dark:text-red-400">−10</span></div>
                <div className="flex justify-between py-3"><span>👻 Never answered before the day closed</span><span className="font-mono font-bold text-red-600 dark:text-red-400">−15</span></div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 shadow-md">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Example</h3>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 space-y-3 font-mono text-sm">
                <p>Monday: Zen says No to Gym, Lily ignores Bible and finishes 1 of 2 job applications.</p>
                <p className="ml-4">• Zen: 100 − 10 = <span className="font-bold">90 XP</span></p>
                <p className="ml-4">• Lily: 100 − 15 − 10 = <span className="font-bold text-red-600 dark:text-red-400">75 XP</span></p>
              </div>
            </div>

            <div className="mt-6 bg-gray-50 dark:bg-gray-900 rounded-xl p-5">
              <h4 className="font-bold text-lg text-gray-900 dark:text-white mb-3">Special Cases</h4>
              <div className="space-y-2 text-gray-700 dark:text-gray-300">
                <div className="flex gap-2">
                  <span>🤝</span>
                  <p>Shared (pooled) tasks have one result: if either of you does it, it counts for both; if it is missed, you both lose the XP</p>
                </div>
                <div className="flex gap-2">
                  <span>🔌</span>
                  <p>If the bot was down for a whole day, that day does not count: nobody could answer, so nobody is penalized</p>
                </div>
                <div className="flex gap-2">
                  <span>✏️</span>
                  <p>Editing or deleting a task never changes past days, and stops today&apos;s unanswered copy from counting</p>
                </div>
                <div className="flex gap-2">
                  <span>🛡️</span>
                  <p>XP cannot go below 0</p>
                </div>
              </div>
            </div>
          </section>

          {/* Weekly Winner */}
          <section className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-2xl shadow-lg p-8 mb-6 border-2 border-purple-300 dark:border-purple-700">
            <div className="flex items-start gap-4 mb-6">
              <div className="text-5xl">🏆</div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Weekly Competition
                </h2>
                <p className="text-gray-700 dark:text-gray-300 text-lg">Monday 6:00 AM showdown</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5">
                <h3 className="font-bold text-xl text-purple-600 dark:text-purple-400 mb-3">The Winner</h3>
                <div className="space-y-2 text-gray-700 dark:text-gray-300">
                  <p className="text-lg flex items-start gap-2">
                    <span>👑</span>
                    <span>Person with <span className="font-bold text-purple-600 dark:text-purple-400">higher XP</span> wins the week</span>
                  </p>
                  <p className="text-lg flex items-start gap-2">
                    <span>⬆️</span>
                    <span>Winner <span className="font-bold">levels up</span> (+1 level)</span>
                  </p>
                  <p className="text-lg flex items-start gap-2">
                    <span>🎁</span>
                    <span>Loser receives a random <span className="font-bold">reward task</span> to complete</span>
                  </p>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5">
                <h3 className="font-bold text-xl text-green-600 dark:text-green-400 mb-3">Tie Scenarios</h3>
                <div className="space-y-2 text-gray-700 dark:text-gray-300">
                  <p className="text-lg flex items-start gap-2">
                    <span>⚖️</span>
                    <span>Same XP → Both level up, no reward task</span>
                  </p>
                  <p className="text-lg flex items-start gap-2">
                    <span>💯</span>
                    <span>Both at 100 XP (perfect week) → Both level up!</span>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Task Types */}
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 mb-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-4 mb-6">
              <div className="text-5xl">📋</div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Task Types
                </h2>
                <p className="text-gray-600 dark:text-gray-400">Different scheduling options</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-5 rounded-xl border border-blue-200 dark:border-blue-800">
                <h3 className="font-bold text-xl text-blue-700 dark:text-blue-300 mb-2">Daily</h3>
                <p className="text-gray-700 dark:text-gray-300">Repeats every day at the same time. Must be confirmed by 6 AM the next day.</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-5 rounded-xl border border-purple-200 dark:border-purple-800">
                <h3 className="font-bold text-xl text-purple-700 dark:text-purple-300 mb-2">Weekly</h3>
                <p className="text-gray-700 dark:text-gray-300">Repeats on specific days of the week. Checked only on those days.</p>
              </div>
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 p-5 rounded-xl border border-indigo-200 dark:border-indigo-800">
                <h3 className="font-bold text-xl text-indigo-700 dark:text-indigo-300 mb-2">Custom</h3>
                <p className="text-gray-700 dark:text-gray-300">Choose your own specific days (e.g., Mon, Wed, Fri). Flexible scheduling.</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-5 rounded-xl border border-orange-200 dark:border-orange-800">
                <h3 className="font-bold text-xl text-orange-700 dark:text-orange-300 mb-2">One-time</h3>
                <p className="text-gray-700 dark:text-gray-300">Happens once on a specific date. Cannot be completed after the date passes.</p>
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 p-5 rounded-xl border border-gray-300 dark:border-gray-600 md:col-span-2">
                <h3 className="font-bold text-xl text-gray-700 dark:text-gray-300 mb-2">Flexible</h3>
                <p className="text-gray-700 dark:text-gray-300">No schedule, no deadlines. Complete whenever you want. <span className="font-bold text-green-600 dark:text-green-400">Never causes penalties!</span></p>
              </div>
            </div>
          </section>

          {/* Tips for Success */}
          <section className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-900/30 dark:via-emerald-900/30 dark:to-teal-900/30 rounded-2xl shadow-lg p-8 border-2 border-green-300 dark:border-green-700">
            <div className="flex items-start gap-4 mb-6">
              <div className="text-5xl">💡</div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Pro Tips
                </h2>
                <p className="text-gray-700 dark:text-gray-300">Strategies to win consistently</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5">
                <div className="flex gap-3 mb-2">
                  <span className="text-2xl">⚡</span>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">Use /markdone</h3>
                </div>
                <p className="text-gray-700 dark:text-gray-300">Complete tasks early to skip confirmation prompts entirely</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5">
                <div className="flex gap-3 mb-2">
                  <span className="text-2xl">🎯</span>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">Confirm Same Day</h3>
                </div>
                <p className="text-gray-700 dark:text-gray-300">Aim to confirm tasks on the same day to avoid 6 AM deadlines</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5">
                <div className="flex gap-3 mb-2">
                  <span className="text-2xl">🔔</span>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">Enable Notifications</h3>
                </div>
                <p className="text-gray-700 dark:text-gray-300">Keep bot notifications on so you never miss task reminders</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5">
                <div className="flex gap-3 mb-2">
                  <span className="text-2xl">🔥</span>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">Build Streaks</h3>
                </div>
                <p className="text-gray-700 dark:text-gray-300">Complete tasks consistently to build and maintain streaks</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5">
                <div className="flex gap-3 mb-2">
                  <span className="text-2xl">⚖️</span>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">Understand the Penalty</h3>
                </div>
                <p className="text-gray-700 dark:text-gray-300">Answer every reminder — even a No costs less than ignoring it</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5">
                <div className="flex gap-3 mb-2">
                  <span className="text-2xl">🚀</span>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">Start Strong</h3>
                </div>
                <p className="text-gray-700 dark:text-gray-300">Save your 2 excuses for days that really need them</p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
