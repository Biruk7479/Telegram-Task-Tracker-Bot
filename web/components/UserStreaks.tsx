'use client';

import { useState, useEffect } from 'react';
import { apiService, User, Task } from '../lib/api';

interface UserStreaksProps {
  userId: string;
  title?: string;
}

export default function UserStreaks({ userId, title }: UserStreaksProps) {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [userData, tasksData] = await Promise.all([
        apiService.getUser(userId),
        apiService.getTasks()
      ]);
      setUser(userData);
      
      // Create map of task ID to name
      const taskMap: Record<string, string> = {};
      tasksData.forEach(t => {
        taskMap[t._id] = t.name;
      });
      setTasks(taskMap);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-6 bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="h-4 bg-gray-200 rounded w-20"></div>
        <div className="space-y-2">
          <div className="h-10 bg-gray-100 rounded"></div>
          <div className="h-10 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const streaks = Object.entries(user.streaks || {}).filter(([_, count]) => count > 0);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {title || `${user.username}'s Streaks`}
      </h3>
      
      {streaks.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
          No active streaks yet.
          <br />
          Complete tasks to start a streak!
        </div>
      ) : (
        <div className="space-y-3">
          {streaks.map(([taskId, count]) => (
            <div
              key={taskId}
              className="flex justify-between items-center bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800"
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate flex-1 mr-2">
                {tasks[taskId] || 'Unknown Task'}
              </span>
              <span className="font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1 text-sm whitespace-nowrap">
                {count} <span className="text-base">🔥</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
