'use client';

import { useState } from 'react';
import { apiService, Task } from '@/lib/api';

interface TaskManagerProps {
  tasks: Task[];
  currentUserId: string;
  partnerUserId: string;
  onTaskCreated?: () => void;
  onTaskUpdated?: () => void;
  onTaskDeleted?: () => void;
}

export default function TaskManager({
  tasks,
  currentUserId,
  partnerUserId,
  onTaskCreated,
  onTaskUpdated,
  onTaskDeleted,
}: TaskManagerProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'daily',
    time: '09:00',
    days: [] as number[],
    date: '',
    assignedTo: 'both' as 'me' | 'partner' | 'both',
  });

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Build assignedTo array
      let assignedTo: string[] = [];
      if (formData.assignedTo === 'me') {
        assignedTo = [currentUserId];
      } else if (formData.assignedTo === 'partner') {
        assignedTo = [partnerUserId];
      } else {
        assignedTo = [currentUserId, partnerUserId];
      }

      // Build schedule object
      const schedule: any = {};
      if (formData.type !== 'flexible') {
        schedule.time = formData.time;
      }
      if (formData.type === 'weekly' || formData.type === 'custom') {
        schedule.days = formData.days;
      }
      if (formData.type === 'one-time') {
        schedule.date = formData.date;
      }

      await apiService.createTask({
        name: formData.name,
        description: formData.description,
        type: formData.type,
        schedule,
        createdBy: currentUserId,
        assignedTo,
        xpReward: 10,
      });

      // Reset form
      setFormData({
        name: '',
        description: '',
        type: 'daily',
        time: '09:00',
        days: [],
        date: '',
        assignedTo: 'both',
      });
      setShowCreateForm(false);

      if (onTaskCreated) onTaskCreated();
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    setLoading(true);

    try {
      // Build assignedTo array
      let assignedTo: string[] = [];
      if (formData.assignedTo === 'me') {
        assignedTo = [currentUserId];
      } else if (formData.assignedTo === 'partner') {
        assignedTo = [partnerUserId];
      } else {
        assignedTo = [currentUserId, partnerUserId];
      }

      // Build schedule object
      const schedule: any = {};
      if (formData.type !== 'flexible') {
        schedule.time = formData.time;
      }
      if (formData.type === 'weekly' || formData.type === 'custom') {
        schedule.days = formData.days;
      }
      if (formData.type === 'one-time') {
        schedule.date = formData.date;
      }

      await apiService.updateTask(editingTask._id, {
        name: formData.name,
        description: formData.description,
        schedule,
        assignedTo,
      });

      setEditingTask(null);
      if (onTaskUpdated) onTaskUpdated();
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    setLoading(true);

    try {
      await apiService.deleteTask(taskId);
      if (onTaskDeleted) onTaskDeleted();
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (task: Task) => {
    setEditingTask(task);

    // Determine assignedTo
    let assignedTo: 'me' | 'partner' | 'both' = 'both';
    if (task.assignedTo?.length === 1) {
      assignedTo = task.assignedTo[0] === currentUserId ? 'me' : 'partner';
    }

    setFormData({
      name: task.name,
      description: task.description || '',
      type: task.type,
      time: task.schedule?.time || '09:00',
      days: task.schedule?.days || [],
      date: task.schedule?.date || '',
      assignedTo,
    });
  };

  const toggleDay = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day].sort(),
    }));
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4">
      {/* Create Task Button */}
      {!showCreateForm && !editingTask && (
        <button
          onClick={() => setShowCreateForm(true)}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          ➕ Create New Task
        </button>
      )}

      {/* Create/Edit Form */}
      {(showCreateForm || editingTask) && (
        <form
          onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-4"
        >
          <h3 className="text-xl font-bold mb-4">
            {editingTask ? '✏️ Edit Task' : '➕ Create New Task'}
          </h3>

          {/* Task Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Task Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Morning Prayer"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional details about the task"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700"
            />
          </div>

          {/* Task Type */}
          <div>
            <label className="block text-sm font-medium mb-1">Task Type *</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              disabled={!!editingTask}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700"
            >
              <option value="daily">📅 Daily</option>
              <option value="weekly">📆 Weekly</option>
              <option value="custom">🗓️ Custom</option>
              <option value="one-time">📌 One-time</option>
              <option value="flexible">🔄 Flexible</option>
            </select>
          </div>

          {/* Time (for non-flexible tasks) */}
          {formData.type !== 'flexible' && (
            <div>
              <label className="block text-sm font-medium mb-1">Time *</label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700"
              />
            </div>
          )}

          {/* Days (for weekly/custom) */}
          {(formData.type === 'weekly' || formData.type === 'custom') && (
            <div>
              <label className="block text-sm font-medium mb-2">Days *</label>
              <div className="flex flex-wrap gap-2">
                {dayNames.map((day, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => toggleDay(index)}
                    className={`px-3 py-1 rounded-md font-medium transition-colors ${
                      formData.days.includes(index)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date (for one-time) */}
          {formData.type === 'one-time' && (
            <div>
              <label className="block text-sm font-medium mb-1">Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700"
              />
            </div>
          )}

          {/* Assigned To */}
          <div>
            <label className="block text-sm font-medium mb-1">Assigned To *</label>
            <select
              value={formData.assignedTo}
              onChange={(e) =>
                setFormData({ ...formData, assignedTo: e.target.value as any })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700"
            >
              <option value="me">👤 Just Me</option>
              <option value="partner">👥 Just Partner</option>
              <option value="both">👫 Both of Us</option>
            </select>
          </div>

          {/* Form Actions */}
          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : editingTask ? 'Update Task' : 'Create Task'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false);
                setEditingTask(null);
              }}
              className="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Task List */}
      {!showCreateForm && !editingTask && (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task._id}
              className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex items-center justify-between"
            >
              <div className="flex-1">
                <h4 className="font-semibold text-lg">{task.name}</h4>
                {task.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {task.description}
                  </p>
                )}
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span>📋 {task.type}</span>
                  {task.schedule?.time && <span>⏰ {task.schedule.time}</span>}
                  {task.schedule?.days && (
                    <span>
                      📅 {task.schedule.days.map((d) => dayNames[d]).join(', ')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEditing(task)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => handleDeleteTask(task._id)}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors"
                  disabled={loading}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
