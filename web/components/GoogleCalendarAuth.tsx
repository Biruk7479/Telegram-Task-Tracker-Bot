'use client';

import { useState } from 'react';
import { apiService } from '@/lib/api';

export default function GoogleCalendarAuth() {
  const [loading, setLoading] = useState(false);

  const handleAuthorize = async () => {
    setLoading(true);

    try {
      const { authUrl } = await apiService.getGoogleAuthUrl();
      window.open(authUrl, '_blank');
    } catch (error) {
      console.error('Error getting auth URL:', error);
      alert('Failed to get authorization URL');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">📅</span>
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
            Google Calendar Sync
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
            Connect your Google Calendar to automatically sync tasks with color-coding:
          </p>
          <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1 mb-3">
            <li>🔵 Blue - Tasks assigned to you only</li>
            <li>🟢 Green - Tasks assigned to partner only</li>
            <li>🔴 Red - Tasks assigned to both</li>
          </ul>
          <button
            onClick={handleAuthorize}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Opening...' : '🔗 Connect Google Calendar'}
          </button>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
            After authorizing, copy the refresh token and add it to your .env file.
          </p>
        </div>
      </div>
    </div>
  );
}
