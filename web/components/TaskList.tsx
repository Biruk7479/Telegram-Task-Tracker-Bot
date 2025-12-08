'use client';

import { useState, useEffect } from 'react';
import { apiService, Task } from '../lib/api';

const user1Id = '5780476905';
const user1Name = 'Zen';
const user2Id = '1362950195';
const user2Name = 'Lily';

interface TaskCardProps {
  task: Task;
  currentUserId: string;
}

function TaskCard({ task, currentUserId }: TaskCardProps) {
  const getTaskTypeColor = (type: string) => {
    switch (type) {
      case 'daily':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800';
      case 'weekly':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800';
      case 'custom':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800';
      case 'one-time':
        return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800';
      case 'flexible':
        return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700';
    }
  };

  const getDayNames = (days: number[]) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map(d => dayNames[d]).join(', ');
  };

  const getUserName = (userId: string) => {
    return userId === user1Id ? user1Name : user2Name;
  };

  const creatorName = getUserName(task.createdBy);
  const assignedUsers = task.assignedTo || [task.createdBy];
  const isAssignedToCurrentUser = assignedUsers.includes(currentUserId);
  const isAssignedToBoth = assignedUsers.length === 2;
  const currentUserName = getUserName(currentUserId);
  const otherUserId = currentUserId === user1Id ? user2Id : user1Id;
  const otherUserName = getUserName(otherUserId);

  return (
    <div className="group border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:border-gray-300 dark:hover:border-gray-600 transition-all bg-white dark:bg-gray-800/50 hover:shadow-lg">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{task.name}</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${getTaskTypeColor(task.type)}`}>
                {task.type}
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600">
                by {creatorName}
              </span>
              {isAssignedToBoth ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-300 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800">
                  Zen & Lily
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-300 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">
                  {isAssignedToCurrentUser ? currentUserName : otherUserName}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {task.description && (
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
          {task.description}
        </p>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        {task.schedule?.time && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 dark:text-gray-400">Time:</span>
            <span className="font-mono text-gray-700 dark:text-gray-300 font-medium">{task.schedule.time}</span>
          </div>
        )}

        {task.schedule?.days && task.schedule.days.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 dark:text-gray-400">Days:</span>
            <span className="text-gray-700 dark:text-gray-300 font-medium">{getDayNames(task.schedule.days)}</span>
          </div>
        )}

        {task.schedule?.date && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 dark:text-gray-400">Date:</span>
            <span className="text-gray-700 dark:text-gray-300 font-medium">
              {new Date(task.schedule.date).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAssignment, setFilterAssignment] = useState<'all' | 'zen' | 'lily' | 'both'>('all');
  const [filterTaskType, setFilterTaskType] = useState<string>('all');
  const [filterCreator, setFilterCreator] = useState<'all' | 'zen' | 'lily'>('all');
  const [currentUserId] = useState<string>(user1Id); // Default to Zen

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

  const filteredTasks = tasks.filter(task => {
    const assignedUsers = task.assignedTo || [task.createdBy];
    const isAssignedToZen = assignedUsers.includes(user1Id);
    const isAssignedToLily = assignedUsers.includes(user2Id);
    const isAssignedToBoth = assignedUsers.length === 2;

    // Filter by assignment
    if (filterAssignment === 'zen' && !isAssignedToZen) return false;
    if (filterAssignment === 'lily' && !isAssignedToLily) return false;
    if (filterAssignment === 'both' && !isAssignedToBoth) return false;

    // Filter by task type
    if (filterTaskType !== 'all' && task.type !== filterTaskType) return false;

    // Filter by creator
    if (filterCreator === 'zen' && task.createdBy !== user1Id) return false;
    if (filterCreator === 'lily' && task.createdBy !== user2Id) return false;

    return true;
  });

  const taskStats = {
    all: tasks.length,
    zen: tasks.filter(t => (t.assignedTo || [t.createdBy]).includes(user1Id)).length,
    lily: tasks.filter(t => (t.assignedTo || [t.createdBy]).includes(user2Id)).length,
    both: tasks.filter(t => (t.assignedTo || []).length === 2).length,
    createdByZen: tasks.filter(t => t.createdBy === user1Id).length,
    createdByLily: tasks.filter(t => t.createdBy === user2Id).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse">
          <div className="text-lg text-gray-600 dark:text-gray-400">Loading tasks...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Tasks</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {filteredTasks.length} of {tasks.length} tasks
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        {/* Creator Filter */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
            Created By
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterCreator('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filterCreator === 'all'
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              All <span className="ml-1 opacity-60">({tasks.length})</span>
            </button>
            <button
              onClick={() => setFilterCreator('zen')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filterCreator === 'zen'
                  ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/40'
              }`}
            >
              Zen <span className="ml-1 opacity-60">({taskStats.createdByZen})</span>
            </button>
            <button
              onClick={() => setFilterCreator('lily')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filterCreator === 'lily'
                  ? 'bg-pink-600 text-white dark:bg-pink-500'
                  : 'bg-pink-50 text-pink-700 hover:bg-pink-100 dark:bg-pink-900/20 dark:text-pink-300 dark:hover:bg-pink-900/40'
              }`}
            >
              Lily <span className="ml-1 opacity-60">({taskStats.createdByLily})</span>
            </button>
          </div>
        </div>

        {/* Assignment Filter */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
            Assigned To
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterAssignment('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filterAssignment === 'all'
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              All <span className="ml-1 opacity-60">({taskStats.all})</span>
            </button>
            <button
              onClick={() => setFilterAssignment('zen')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filterAssignment === 'zen'
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40'
              }`}
            >
              Zen <span className="ml-1 opacity-60">({taskStats.zen})</span>
            </button>
            <button
              onClick={() => setFilterAssignment('lily')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filterAssignment === 'lily'
                  ? 'bg-purple-600 text-white dark:bg-purple-500'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/40'
              }`}
            >
              Lily <span className="ml-1 opacity-60">({taskStats.lily})</span>
            </button>
            <button
              onClick={() => setFilterAssignment('both')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filterAssignment === 'both'
                  ? 'bg-green-600 text-white dark:bg-green-500'
                  : 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/40'
              }`}
            >
              Both <span className="ml-1 opacity-60">({taskStats.both})</span>
            </button>
          </div>
        </div>

        {/* Task Type Filter */}
        <div>
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
            Task Type
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterTaskType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterTaskType === 'all'
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterTaskType('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterTaskType === 'daily'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setFilterTaskType('weekly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterTaskType === 'weekly'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setFilterTaskType('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterTaskType === 'custom'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              Custom
            </button>
            <button
              onClick={() => setFilterTaskType('one-time')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterTaskType === 'one-time'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              One-time
            </button>
            <button
              onClick={() => setFilterTaskType('flexible')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterTaskType === 'flexible'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              Flexible
            </button>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
            <p className="text-lg font-medium text-gray-600 dark:text-gray-400">No tasks found</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              {filterAssignment !== 'all' || filterTaskType !== 'all' || filterCreator !== 'all'
                ? 'Try adjusting your filters'
                : 'Use the Telegram bot to create tasks!'}
            </p>
          </div>
        ) : (
          filteredTasks.map(task => (
            <TaskCard 
              key={task._id} 
              task={task}
              currentUserId={currentUserId}
            />
          ))
        )}
      </div>
    </div>
  );
}
