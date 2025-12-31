'use client';

import { useState, useEffect } from 'react';
import { apiService, Task } from '@/lib/api';
import TaskManager from '@/components/TaskManager';
import TaskCompletionButton from '@/components/TaskCompletionButton';
import GoogleCalendarAuth from '@/components/GoogleCalendarAuth';
import Link from 'next/link';

const ZEN_ID = '5780476905';
const LILY_ID = '1362950195';

export default function ManageTasksPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<'zen' | 'lily'>('zen');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Check if already authenticated
  useEffect(() => {
    const auth = sessionStorage.getItem('taskTrackerAuth');
    if (auth === 'true') {
      setIsAuthenticated(true);
      fetchTasks();
    }

    // Check for saved dark mode preference
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode) {
      setDarkMode(savedMode === 'true');
    }
  }, []);

  useEffect(() => {
    // Update document class
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple password check - matches .env AUTH_PASSWORD
    // In production, you'd want this validated server-side
    const correctPassword = 'YourSecurePassword123'; // Should match AUTH_PASSWORD in .env
    
    if (password === correctPassword) {
      setIsAuthenticated(true);
      sessionStorage.setItem('taskTrackerAuth', 'true');
      setError('');
      fetchTasks();
    } else {
      setError('Incorrect password. Only Zen and Lily can access this page.');
      setPassword('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('taskTrackerAuth');
    setPassword('');
  // Login page
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🔐</div>
            <h1 className="text-2xl font-light tracking-tight text-gray-900 dark:text-white mb-2">
              Task Manager
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Private Dashboard Access
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter access password"
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-950 dark:text-white text-sm"
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 font-medium py-3 px-4 rounded-lg transition-colors text-sm"
            >
              Access Dashboard
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link 
              href="/"
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }           </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors shadow-lg"
            >
              Access Dashboard
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>Only authorized users can access this page</p>
          </div>
        </div>
      </div>
    );
  }

  // Main dashboard
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 bg-white/95 dark:bg-gray-950/95 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-light tracking-tight text-gray-900 dark:text-white">
                Task Manager
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Create, edit, and manage tasks
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* User Switcher */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
                <button
                  onClick={() => setCurrentUser('zen')}
                  className={`px-5 py-2 rounded-md text-sm font-medium transition ${
                    currentUser === 'zen'
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Zen
                </button>
                <button
                  onClick={() => setCurrentUser('lily')}
                  className={`px-5 py-2 rounded-md text-sm font-medium transition ${
                    currentUser === 'lily'
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Lily
                </button>
              </div>

              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition"
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-[1600px]">
        <div className="space-y-8">
          {/* Google Calendar Authorization */}
          <GoogleCalendarAuth />

          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Total Active Tasks</div>
              <div className="text-3xl font-light text-gray-900 dark:text-white">
                {tasks.length}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Zen's Tasks</div>
              <div className="text-3xl font-light text-gray-900 dark:text-white">
                {tasks.filter(t => t.assignedTo?.includes(ZEN_ID) && !t.assignedTo?.includes(LILY_ID)).length}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Lily's Tasks</div>
              <div className="text-3xl font-light text-gray-900 dark:text-white">
                {tasks.filter(t => t.assignedTo?.includes(LILY_ID) && !t.assignedTo?.includes(ZEN_ID)).length}
              </div>
            </div>
          </div>iv className="text-2xl font-bold text-gray-800 dark:text-white">
              {tasks.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Active Tasks</div>
          {/* Task Manager */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-light text-gray-900 dark:text-white mb-6">
              Manage Tasks
            </h2>
            <TaskManager
              tasks={tasks}
              currentUserId={getCurrentUserId()}
              partnerUserId={getPartnerUserId()}
              onTaskCreated={fetchTasks}
              onTaskUpdated={fetchTasks}
              onTaskDeleted={fetchTasks}
            />
          </div>

          {/* Today's Tasks */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-light text-gray-900 dark:text-white mb-6">
              Today's Tasks - Mark Complete
            </h2>k Manager */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6">
            Manage Tasks
          </h2>
          <TaskManager
            tasks={tasks}
            currentUserId={getCurrentUserId()}
            partnerUserId={getPartnerUserId()}
            onTaskCreated={fetchTasks}
            onTaskUpdated={fetchTasks}
            onTaskDeleted={fetchTasks}
          />
        </div>

        {/* Today's Tasks */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6">
            Today's Tasks - Mark Complete
          </h2>
          <div className="space-y-4">
            {loading ? (
            <div className="space-y-3">
              {loading ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading tasks...</div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No active tasks. Create your first task above!
                </div>
              ) : (
                tasks
                  .filter(task => {
                    // Show tasks assigned to current user
                    const userId = getCurrentUserId();
                    return task.assignedTo?.includes(userId);
                  })
                  .map((task) => {
                    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    let scheduleInfo = '';
                    
                    if (task.type === 'daily' && task.schedule?.time) {
                      scheduleInfo = ` • ${task.schedule.time}`;
                    } else if (task.type === 'weekly' && task.schedule?.time && task.schedule?.days) {
                      const days = task.schedule.days.map(d => dayNames[d]).join(', ');
                      scheduleInfo = ` • ${days} at ${task.schedule.time}`;
                    } else if (task.type === 'one-time' && task.schedule?.date) {
                      scheduleInfo = ` • ${task.schedule.date}`;
                    }

                    // Determine color based on assignment
                    let colorClass = 'border-red-200 dark:border-red-800';
                    if (task.assignedTo?.length === 1) {
                      if (task.assignedTo[0] === ZEN_ID) {
                        colorClass = 'border-blue-200 dark:border-blue-800';
                      } else {
                        colorClass = 'border-green-200 dark:border-green-800';
                      }
                    }

                    return (
                      <div
                        key={task._id}
                        className={`border-l-4 ${colorClass} bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 p-4 rounded-lg flex items-center justify-between`}
                      >
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {task.name}
                          </h3>
                          {task.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {task.description}
                            </p>
                          )}
                          <div className="flex gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>{task.type}</span>
                            {scheduleInfo && <span>{scheduleInfo}</span>}
                          </div>
                        </div>
                        <div className="ml-4">
                          <TaskCompletionButton
                            taskId={task._id}
                            taskName={task.name}
                            userId={getCurrentUserId()}
                            scheduledFor={new Date().toISOString().split('T')[0]}
                            onCompletionChanged={fetchTasks}
                          />
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          {/* Instructions */}
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">
              Quick Tips
            </h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <li>• Blue border = Zen's tasks only</li>
              <li>• Green border = Lily's tasks only</li>
              <li>• Red border = Tasks for both</li>
              <li>• Click the user switcher (Zen/Lily) to change perspective</li>
              <li>• Tasks automatically sync to Google Calendar with colors</li>
              <li>• Use Telegram bot for quick access: /addtask, /markdone</li>
            </ul>
          </div>
        </div>
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
