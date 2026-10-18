// Local previews of what the server will do with a mark, shared by the app
// and the widgets so a tap shows its result before the network answers.
import type { Action, Board, Occurrence, Task } from './types';

export const applyLocally = (o: Occurrence, action: Action, amount = 1): Occurrence => {
  switch (action) {
    case 'done': return { ...o, status: 'done', progress: Math.max(o.progress, o.target) };
    case 'undo': return { ...o, status: 'pending', progress: 0 };
    case 'missed': return { ...o, status: 'missed' };
    case 'excused': return { ...o, status: 'excused' };
    case 'progress': {
      const progress = Math.max(0, o.progress + amount);
      return { ...o, progress, status: progress >= o.target ? 'done' : 'pending' };
    }
  }
};

export const replaceOccurrence = (board: Board, next: Occurrence): Board => ({
  ...board,
  members: board.members.map((m) => {
    const swap = (list: Occurrence[]) => list.map((o) => (o._id === next._id ? next : o));
    const items = swap(m.items);
    return {
      ...m,
      items,
      yesterdayPending: swap(m.yesterdayPending),
      done: items.filter((o) => o.status === 'done').length,
    };
  }),
});

// Your list for today with yesterday's still-open items first.
export const myOpenList = (board: Board, userId: string) => {
  const m = board.members.find((x) => x.userId === userId);
  return m ? [...m.yesterdayPending, ...m.items] : [];
};

export const statusGlyph = (o: Occurrence) => {
  if (o.status === 'done') return '✓';
  if (o.status === 'missed' || o.status === 'ignored') return '✗';
  if (o.status === 'excused') return '–';
  if (o.target > 1 && o.progress > 0) return '◐';
  return '○';
};

export const counterText = (o: Occurrence) => (o.target > 1 ? `${o.progress}/${o.target}` : '');

export const shortNumber = (n: number) => (Math.abs(n) >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n));

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// "Mon, Wed · 07:00" style summary of a task's schedule.
export const scheduleText = (t: Task) => {
  const time = t.schedule?.time ? ` · ${t.schedule.time}` : '';
  switch (t.type) {
    case 'daily': return `Every day${time}`;
    case 'weekly':
    case 'custom': return `${(t.schedule?.days ?? []).map((d) => DAY_NAMES[d]).join(', ')}${time}`;
    case 'one-time': return `${String(t.schedule?.date ?? '').slice(0, 10)}${time}`;
    default: return 'Whenever';
  }
};
