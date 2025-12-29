'use client';

import { useState, useEffect } from 'react';
import { apiService, Task } from '@/lib/api';
import TaskManager from '@/components/TaskManager';
import TaskCompletionButton from '@/components/TaskCompletionButton';
import GoogleCalendarAuth from '@/components/GoogleCalendarAuth';

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

  // Check if already authenticated
  useEffect(() => {
    const auth = sessionStorage.getItem('taskTrackerAuth');
    if (auth === 'true') {
      setIsAuthenticated(true);
      fetchTasks();
    }
  }, []);

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
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const data = await apiService.getTasks();
      setTasks(data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentUserId = () => currentUser === 'zen' ? ZEN_ID : LILY_ID;
  const getPartnerUserId = () => currentUser === 'zen' ? LILY_ID : ZEN_ID;

  // Login page
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🔐</div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
              Task Tracker
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Zen & Lily's Private Dashboard
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
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                📋 Task Manager
              </h1>
              
              {/* User Switcher */}
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentUser('zen')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentUser === 'zen'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  👤 Zen
                </button>
                <button
                  onClick={() => setCurrentUser('lily')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentUser === 'lily'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  👥 Lily
                </button>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Google Calendar Authorization */}
        <GoogleCalendarAuth />

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="text-3xl mb-2">📊</div>
            <div className="text-2xl font-bold text-gray-800 dark:text-white">
              {tasks.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Active Tasks</div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="text-3xl mb-2">🔵</div>
            <div className="text-2xl font-bold text-gray-800 dark:text-white">
              {tasks.filter(t => t.assignedTo?.includes(ZEN_ID) && !t.assignedTo?.includes(LILY_ID)).length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Zen's Tasks</div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="text-3xl mb-2">🟢</div>
            <div className="text-2xl font-bold text-gray-800 dark:text-white">
              {tasks.filter(t => t.assignedTo?.includes(LILY_ID) && !t.assignedTo?.includes(ZEN_ID)).length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Lily's Tasks</div>
          </div>
        </div>

        {/* Task Manager */}
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
              <div className="text-center py-8 text-gray-500">Loading tasks...</div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
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
                      className={`border-l-4 ${colorClass} bg-gray-50 dark:bg-gray-700 p-4 rounded-lg flex items-center justify-between`}
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-gray-800 dark:text-white">
                          {task.name}
                        </h3>
                        {task.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {task.description}
                          </p>
                        )}
                        <div className="flex gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>📋 {task.type}</span>
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
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            💡 Quick Tips
          </h3>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>• 🔵 <strong>Blue border</strong> = Zen's tasks only</li>
            <li>• 🟢 <strong>Green border</strong> = Lily's tasks only</li>
            <li>• 🔴 <strong>Red border</strong> = Tasks for both</li>
            <li>• Click the user switcher (Zen/Lily) to change perspective</li>
            <li>• Tasks automatically sync to Google Calendar with colors</li>
            <li>• Use Telegram bot for quick access: /addtask, /markdone</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
