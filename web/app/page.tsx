'use client';

import { useState, useEffect } from 'react';
import Calendar from '../components/Calendar';
import UserStats from '../components/UserStats';
import UserStreaks from '../components/UserStreaks';
import TaskList from '../components/TaskList';

export default function Home() {
  const [selectedView, setSelectedView] = useState<'calendar' | 'tasks'>('calendar');
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Check for saved dark mode preference
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode) {
      setDarkMode(savedMode === 'true');
    }
  }, []);

  useEffect(() => {
    // Update document class and save preference
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  // Hardcoded user IDs from .env
  const user1Id = '5780476905';
  const user1Name = 'Zen';
  const user2Id = '1362950195';
  const user2Name = 'Lily';

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
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition"
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
              
              {/* View Toggle */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
              <button
                onClick={() => setSelectedView('calendar')}
                className={`px-5 py-2 rounded-md text-sm font-medium transition ${
                  selectedView === 'calendar'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Calendar
              </button>
              <button
                onClick={() => setSelectedView('tasks')}
                className={`px-5 py-2 rounded-md text-sm font-medium transition ${
                  selectedView === 'tasks'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Tasks
              </button>
              <a
                href="/rules"
                className="px-5 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                Rules
              </a>
              <a
                href="/manage"
                className="px-5 py-2 rounded-md text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition shadow-sm"
              >
                Manage
              </a>
            </div>
          </div>
        </div>
      </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-[1600px]">
        {selectedView === 'calendar' ? (
          <div className="flex flex-col xl:flex-row gap-6">
            {/* Left Column - Aj's Streaks */}
            <div className="w-full xl:w-72 flex-shrink-0 order-2 xl:order-1">
              <UserStreaks userId={user1Id} title={`${user1Name}'s Streaks`} />
            </div>

            {/* Middle Column - Main Content */}
            <div className="flex-1 order-1 xl:order-2 min-w-0">
              {/* Stats Row */}
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <UserStats userId={user1Id} showStreaks={false} />
                <UserStats userId={user2Id} showStreaks={false} />
              </div>

              {/* Calendar Row */}
              <div className="grid md:grid-cols-2 gap-6">
                <Calendar userId={user1Id} username={user1Name} />
                <Calendar userId={user2Id} username={user2Name} />
              </div>
            </div>

          
            <div className="w-full xl:w-72 flex-shrink-0 order-3">
              <UserStreaks userId={user2Id} title={`${user2Name}'s Streaks`} />
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <TaskList />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-16 py-8">
        <div className="container mx-auto px-6 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">
            Made with ❤️ for Lily by Aj
          </p>
        </div>
      </footer>
    </div>
  );
}
