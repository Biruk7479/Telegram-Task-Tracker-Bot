'use client';

import { useState, useEffect } from 'react';
import { apiService, CalendarDay } from '../lib/api';

interface CalendarProps {
  userId: string;
  username: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Calendar({ userId, username }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  useEffect(() => {
    loadCalendarData();
  }, [userId, year, month]);

  const loadCalendarData = async () => {
    setLoading(true);
    try {
      const data = await apiService.getCalendar(userId, year, month);
      setCalendarData(data);
    } catch (error) {
      console.error('Error loading calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = () => {
    return new Date(year, month, 0).getDate();
  };

  const getFirstDayOfMonth = () => {
    return new Date(year, month - 1, 1).getDay();
  };

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const getDayData = (day: number): CalendarDay | undefined => {
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    return calendarData.find(d => d.date === dateStr);
  };

  const getDayColor = (dayData: CalendarDay | undefined) => {
    if (!dayData || !dayData.scheduledTasks || dayData.scheduledTasks.length === 0) {
      return 'bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-400';
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [dateYear, dateMonth, dateDay] = dayData.date.split('-').map(Number);
    const currentDate = new Date(dateYear, dateMonth - 1, dateDay);
    currentDate.setHours(0, 0, 0, 0);
    const isPastDay = currentDate < today;
    
    // Check task completion status
    const totalTasks = dayData.scheduledTasks.length;
    const completedTasks = dayData.scheduledTasks.filter(t => t.completed === true).length;
    const pendingTasks = dayData.scheduledTasks.filter(t => t.completed === null).length;
    const incompleteTasks = dayData.scheduledTasks.filter(t => t.completed === false).length;
    
    // Deep green: 100% completed
    if (completedTasks === totalTasks) {
      return 'bg-emerald-400 text-gray-900 border border-emerald-400';
    }

    // Deep red: 2+ tasks incomplete OR no completions at all on past day
    if (incompleteTasks >= 2 || (isPastDay && completedTasks === 0 && incompleteTasks > 0)) {
      return 'bg-red-500 text-gray-900 border border-red-500';
    }

    // Light red: 1 incomplete task
    if (incompleteTasks === 1) {
      return 'bg-red-300 text-gray-900 border border-red-300';
    }

    // Light green: Partial completion (some done, some pending/not yet determined)
    if (completedTasks > 0 && completedTasks < totalTasks) {
      return 'bg-emerald-200 text-gray-900 border border-emerald-200';
    }

    // Cyan: Pending tasks (future or current day with no completions yet)
    if (pendingTasks > 0 && !isPastDay) {
      return 'bg-cyan-300 text-gray-900 border border-cyan-300';
    }

    // Default gray for no data
    return 'bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-400';
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth();
    const firstDay = getFirstDayOfMonth();
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2 bg-gray-50/50"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayData = getDayData(day);
      const isToday = day === new Date().getDate() && 
                      month === new Date().getMonth() + 1 && 
                      year === new Date().getFullYear();
      
      const isSelected = selectedDay?.date === dayData?.date && dayData;

      days.push(
        <div
          key={day}
          onClick={() => setSelectedDay(dayData || null)}
          className={`
            p-2 min-h-[60px] rounded-lg cursor-pointer transition-all relative
            ${getDayColor(dayData)}
            ${isToday ? 'ring-2 ring-offset-2 ring-blue-500' : ''}
            ${isSelected ? 'ring-2 ring-blue-400' : ''}
          `}
        >
          <div className="font-medium text-sm text-gray-900">{day}</div>
          {dayData && (
            <div className="mt-2 space-y-1">
              {dayData.scheduledTasks && dayData.scheduledTasks.length > 0 && (
                <div className="text-2xl font-bold text-gray-900">
                  {dayData.scheduledTasks.length}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return days;
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-6 bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="grid grid-cols-7 gap-2">
          {[...Array(35)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 dark:bg-gradient-to-br dark:from-gray-900 dark:to-black rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{username}'s Activity</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">Track your daily consistency</p>
          </div>
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-all hover:shadow-sm text-gray-700 dark:text-gray-300"
            >
              ←
            </button>
            <span className="px-4 font-semibold min-w-[120px] text-center text-gray-900 dark:text-white">
              {MONTHS[month - 1]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-all hover:shadow-sm text-gray-700 dark:text-gray-300"
            >
              →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
          {DAYS.map(day => (
            <div key={day} className="text-center font-semibold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider p-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {renderCalendar()}
        </div>
      </div>

      {selectedDay && (
        <div className="mt-8 border-t border-gray-200 pt-6">
          <h4 className="font-semibold text-lg mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
            Activity for {selectedDay.date}
          </h4>
          
          {selectedDay.scheduledTasks && selectedDay.scheduledTasks.length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Tasks for {selectedDay.date}</h5>
              <div className="grid gap-2">
                {selectedDay.scheduledTasks.map((task, index) => {
                  let statusTag = { text: 'Pending', color: 'bg-cyan-100 text-cyan-900 border-cyan-400' };
                  let cardStyle = 'bg-cyan-300 border-cyan-300 text-gray-900';
                  
                  if (task.completed === true) {
                    statusTag = { text: 'Completed ✓', color: 'bg-emerald-100 text-emerald-900 border-emerald-400' };
                    cardStyle = 'bg-emerald-400 border-emerald-400 text-gray-900';
                  } else if (task.missedConfirmation) {
                    statusTag = { text: 'Missed', color: 'bg-red-100 text-red-900 border-red-500' };
                    cardStyle = 'bg-red-500 border-red-500 text-gray-900';
                  } else if (task.completed === false) {
                    statusTag = { text: 'Not Done', color: 'bg-red-100 text-red-900 border-red-300' };
                    cardStyle = 'bg-red-300 border-red-300 text-gray-900';
                  }
                  
                  return (
                    <div
                      key={`scheduled-${task._id}-${index}`}
                      className={`p-3 rounded-lg border ${cardStyle} flex items-center justify-between`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">📅</span>
                        <span className="text-sm font-medium">{task.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span>{task.time}</span>
                        <span className={`px-2 py-1 rounded-full font-semibold border ${statusTag.color}`}>
                          {statusTag.text}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {(!selectedDay.scheduledTasks || selectedDay.scheduledTasks.length === 0) && (
            <p className="text-center text-gray-600 dark:text-gray-300 py-8">No activity for this day</p>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-gray-700 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700 pt-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-400 rounded-sm shadow-sm"></div>
          <span>All Complete</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-200 rounded-sm"></div>
          <span>Partial</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-cyan-300 rounded-sm"></div>
          <span>In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-300 rounded-sm"></div>
          <span>1 Missed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
          <span>2+ Missed/None</span>
        </div>
      </div>
    </div>
  );
}
