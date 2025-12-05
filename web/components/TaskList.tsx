'use client';

import { useState, useEffect } from 'react';
import { apiService, Task } from '../lib/api';

interface TaskCardProps {
  task: Task;
  userName: string;
  userColor: 'blue' | 'purple';
}

function TaskCard({ task, userName, userColor }: TaskCardProps) {
  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case 'daily':
        return '📅';
      case 'weekly':
        return '📆';
      case 'flexible':
        return '🔄';
      default:
        return '📋';
    }
  };

  const getDayNames = (days: number[]) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map(d => dayNames[d]).join(', ');
  };

  const userBadgeColors = {
    blue: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
    purple: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  };

  return (
    <div className="group border border-gray-200 dark:border-gray-800 rounded-2xl p-6 hover:border-gray-300 dark:hover:border-gray-700 transition-all bg-white dark:bg-gray-900/70 hover:shadow-xl">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <span className="text-3xl opacity-80">{getTaskTypeIcon(task.type)}</span>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{task.name}</h3>
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${userBadgeColors[userColor]}`}> 
              {userName}
            </span>
          </div>
        </div>
      </div>

      {task.description && (
        <p className="text-gray-800 dark:text-gray-200 text-base mb-4 ml-[52px]">
          {task.description}
        </p>
      )}

      <div className="flex flex-wrap gap-4 text-sm ml-[52px]">
        <div className="flex items-center gap-2">
          <span className="font-semibold uppercase tracking-wider text-xs text-gray-900 dark:text-white">Type</span>
          <span className="capitalize bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-lg font-bold text-gray-900 dark:text-white">{task.type}</span>
        </div>

        {task.schedule?.time && (
          <div className="flex items-center gap-2">
            <span className="font-semibold uppercase tracking-wider text-xs text-gray-900 dark:text-white">Time</span>
            <span className="font-mono bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-lg font-bold text-gray-900 dark:text-white">{task.schedule.time}</span>
          </div>
        )}

        {task.schedule?.days && task.schedule.days.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="font-semibold uppercase tracking-wider text-xs text-gray-900 dark:text-white">Days</span>
            <span className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-lg font-bold text-gray-900 dark:text-white">{getDayNames(task.schedule.days)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState<string>('5780476905'); 

  const user1Id = '5780476905';
  const user1Name = 'Zen';
  const user2Id = '1362950195';
  const user2Name = 'Lily';

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const taskData = await apiService.getTasks();
      setTasks(taskData);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserName = (userId: string) => {
    if (userId === user1Id) return user1Name;
    if (userId === user2Id) return user2Name;
    return 'Unknown';
  };

  const filteredTasks = tasks.filter(task => {
    return task.createdBy === filterUser;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div>Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Active Tasks</h2>
        <div className="flex gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <button
            onClick={() => setFilterUser(user1Id)}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition ${
              filterUser === user1Id
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-750'
            }`}
          >
            {user1Name}
          </button>
          <button
            onClick={() => setFilterUser(user2Id)}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition ${
              filterUser === user2Id
                ? 'bg-purple-500 text-white shadow-md'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-750'
            }`}
          >
            {user2Name}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-8">
        {filteredTasks.length === 0 ? (
          <div className="text-center text-gray-500 py-16 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
            <p className="text-lg font-medium text-gray-600">No tasks yet.</p>
            <p className="text-sm mt-2">Use the Telegram bot to create tasks!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTasks.map(task => (
              <TaskCard 
                key={task._id} 
                task={task} 
                userName={getUserName(task.createdBy)}
                userColor={task.createdBy === user1Id ? 'blue' : 'purple'}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
