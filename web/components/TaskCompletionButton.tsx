'use client';

import { useState } from 'react';
import { apiService } from '@/lib/api';

interface TaskCompletionButtonProps {
  taskId: string;
  taskName: string;
  userId: string;
  scheduledFor?: string;
  initialCompleted?: boolean | null;
  onCompletionChanged?: () => void;
}

export default function TaskCompletionButton({
  taskId,
  taskName,
  userId,
  scheduledFor,
  initialCompleted,
  onCompletionChanged,
}: TaskCompletionButtonProps) {
  const [completed, setCompleted] = useState<boolean | null>(initialCompleted ?? null);
  const [loading, setLoading] = useState(false);

  const handleToggle = async (newStatus: boolean) => {
    setLoading(true);

    try {
      await apiService.markTaskComplete(taskId, userId, newStatus, scheduledFor);
      setCompleted(newStatus);
      if (onCompletionChanged) onCompletionChanged();
    } catch (error) {
      console.error('Error marking task:', error);
      alert('Failed to update task status');
    } finally {
      setLoading(false);
    }
  };

  if (completed === null) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => handleToggle(true)}
          disabled={loading}
          className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50"
          title={`Mark "${taskName}" as complete`}
        >
          ✓ Complete
        </button>
        <button
          onClick={() => handleToggle(false)}
          disabled={loading}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50"
          title={`Mark "${taskName}" as incomplete`}
        >
          ✗ Skip
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {completed ? (
        <div className="flex items-center gap-2">
          <span className="text-green-600 dark:text-green-400 font-medium text-sm">
            ✅ Completed
          </span>
          <button
            onClick={() => handleToggle(false)}
            disabled={loading}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline disabled:opacity-50"
          >
            Undo
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-red-600 dark:text-red-400 font-medium text-sm">
            ❌ Skipped
          </span>
          <button
            onClick={() => handleToggle(true)}
            disabled={loading}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline disabled:opacity-50"
          >
            Mark Complete
          </button>
        </div>
      )}
    </div>
  );
}
