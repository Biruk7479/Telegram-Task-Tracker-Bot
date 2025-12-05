'use client';

import { useState, useEffect } from 'react';
import { apiService, User } from '../lib/api';

interface UserStatsProps {
  userId: string;
  showStreaks?: boolean;
}

export default function UserStats({ userId, showStreaks = false }: UserStatsProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, [userId]);

  const loadUser = async () => {
    setLoading(true);
    try {
      const userData = await apiService.getUser(userId);
      setUser(userData);
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  // Weekly XP progress (starts at 100, decreases)
  const getWeeklyXpProgress = () => {
    if (!user) return { left: 100, percentage: 100 };
    const left = user.weeklyXp ?? 100;
    const percentage = Math.max((left / 100) * 100, 0);
    return { left, percentage };
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-6 bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between">
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded w-32"></div>
            <div className="h-4 bg-gray-100 rounded w-20"></div>
          </div>
          <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
        </div>
        <div className="h-2 bg-gray-100 rounded-full"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-20 bg-gray-100 rounded"></div>
          <div className="h-20 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div>Loading stats...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
        User not found
      </div>
    );
  }

  const streaks = Object.entries(user.streaks || {}).filter(([_, count]) => count > 0);

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 dark:bg-gradient-to-br dark:from-gray-900 dark:to-black rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{user.username}</h3>
          <div className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mt-1">
            Level {user.level}
          </div>
        </div>
        <div className="text-5xl">
          {user.level >= 10 ? '🏆' : user.level >= 5 ? '⭐' : '🌟'}
        </div>
      </div>

      <div className="mb-8">
        <div className="flex justify-between mb-3 text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
          <span>Weekly XP</span>
          <span>
            {getWeeklyXpProgress().left} / 100
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden shadow-inner">
          <div
            className={`h-3 transition-all duration-500 ease-out shadow-sm ${
              getWeeklyXpProgress().left > 70 
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-300'
                : getWeeklyXpProgress().left > 40
                ? 'bg-gradient-to-r from-yellow-500 to-yellow-300'
                : 'bg-gradient-to-r from-red-500 to-red-300'
            }`}
            style={{ width: `${getWeeklyXpProgress().percentage}%` }}
          />
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">
          {getWeeklyXpProgress().left === 100 
            ? '✨ Perfect! No penalties yet' 
            : getWeeklyXpProgress().left > 70
            ? '💪 Great job staying on track!'
            : getWeeklyXpProgress().left > 40
            ? '⚠️ Be careful not to miss more tasks'
            : '🚨 Warning: Low XP remaining!'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 p-5 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-sm">
          <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {user.weeklyXp || 100}
          </div>
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider mt-2">
            Weekly XP Left
          </div>
          <div className="text-[10px] text-gray-600 dark:text-gray-400 mt-1">
            Starts at 100
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-5 rounded-xl border border-purple-200 dark:border-purple-800 shadow-sm">
          <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
            {user.level}
          </div>
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider mt-2">
            Current Level
          </div>
        </div>
      </div>

      {showStreaks && streaks.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-800 dark:text-gray-200 mb-4">🔥 Active Streaks</h4>
          <div className="space-y-2">
            {streaks.map(([taskId, count]) => (
              <div
                key={taskId}
                className="flex justify-between items-center bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 p-4 rounded-xl border border-orange-200 dark:border-orange-800 shadow-sm"
              >
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Task</span>
                <span className="font-bold text-orange-600 dark:text-orange-400 flex items-center gap-2">
                  {count} days <span className="text-lg">🔥</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
