'use client';

// One opportunity on the /opportunities page: who it is from, where it stands,
// how long until the deadline, the plan for applying, and the checklist of
// what it asks for. Ticking a requirement saves at once; editing needs login.
import { Opportunity, OpportunityStatus } from '@/lib/api';

export const ZEN_ID = '5780476905';
export const LILY_ID = '1362950195';

export const memberName = (telegramId: string) =>
  telegramId === ZEN_ID ? 'Zen' : telegramId === LILY_ID ? 'Lily' : 'Someone';

const GREY_BADGE =
  'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800/60 dark:text-gray-300 dark:border-gray-700';
const RED_BADGE =
  'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800';

export const STATUS_BADGE: Record<OpportunityStatus, string> = {
  Watching: GREY_BADGE,
  Preparing: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  Applied: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800',
  Interview: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800',
  Accepted: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800',
  Rejected: RED_BADGE,
  Missed: RED_BADGE,
  Withdrawn: GREY_BADGE,
};

// A 'YYYY-MM-DD' day as a local date (no timezone drift from parsing as UTC).
const toLocalDate = (day: string) => {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Whole days from today until a day; negative once it has passed.
export const daysUntil = (day: string): number => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((toLocalDate(day).getTime() - today.getTime()) / 86400000);
};

export const countdownLabel = (days: number): string => {
  if (days < 0) return `${-days} d overdue`;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
};

// Red within a day (or overdue), orange within a week, blue within a month, grey beyond.
export const countdownColour = (days: number): string => {
  if (days <= 1) return 'text-red-600 dark:text-red-400';
  if (days <= 7) return 'text-orange-600 dark:text-orange-400';
  if (days <= 30) return 'text-blue-600 dark:text-blue-400';
  return 'text-gray-500 dark:text-gray-400';
};

export const formatDay = (day: string): string =>
  toLocalDate(day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

const linkLabel = (link: string): string => {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return link;
  }
};

interface OpportunityCardProps {
  opportunity: Opportunity;
  loggedIn: boolean;
  canEdit: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleRequirement: (index: number, done: boolean) => void;
}

export default function OpportunityCard({
  opportunity: o,
  loggedIn,
  canEdit,
  busy,
  onEdit,
  onDelete,
  onToggleRequirement,
}: OpportunityCardProps) {
  const days = o.deadline ? daysUntil(o.deadline) : null;
  const doneCount = o.requirements.filter((r) => r.done).length;
  const owner = o.assignedTo.length === 1 ? memberName(o.assignedTo[0]) : 'Lily and Zen';

  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-gray-900 dark:text-white break-words">{o.name}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {[o.organisation, o.category].filter(Boolean).join(' · ')}
          </div>
        </div>
        <span
          className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${STATUS_BADGE[o.status] ?? GREY_BADGE}`}
        >
          {o.status}
        </span>
      </div>

      <div className="mt-3 space-y-1 text-sm">
        {o.deadline && days !== null ? (
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-gray-500 dark:text-gray-400">Deadline</span>
            <span className={`font-medium ${countdownColour(days)}`}>{countdownLabel(days)}</span>
            <span className="text-gray-400 dark:text-gray-500">
              {formatDay(o.deadline)}
              {o.deadlineTime ? ` · ${o.deadlineTime}` : ''}
            </span>
          </div>
        ) : (
          <div className="text-gray-400 dark:text-gray-500">No deadline</div>
        )}
        {o.applyFrom && (
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-gray-500 dark:text-gray-400">Opens</span>
            <span className="text-gray-700 dark:text-gray-300">{formatDay(o.applyFrom)}</span>
          </div>
        )}
        {o.applyOn && (
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-gray-500 dark:text-gray-400">Apply on</span>
            <span className="text-gray-700 dark:text-gray-300 font-medium">
              {formatDay(o.applyOn)}
              {o.applyTime ? ` · ${o.applyTime}` : ''}
            </span>
          </div>
        )}
        {o.appliedOn && (
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-gray-500 dark:text-gray-400">Applied</span>
            <span className="text-gray-700 dark:text-gray-300">{formatDay(o.appliedOn)}</span>
          </div>
        )}
      </div>

      {o.requirements.length > 0 && (
        <div className="mt-3">
          <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">
            Asks for · {doneCount}/{o.requirements.length}
          </div>
          <ul className="space-y-1">
            {o.requirements.map((r, index) => (
              <li key={`${index}-${r.text}`}>
                <label
                  className={`flex items-start gap-2 text-sm ${loggedIn && !busy ? 'cursor-pointer' : 'cursor-default'}`}
                  title={loggedIn ? undefined : 'Log in to tick this off'}
                >
                  <input
                    type="checkbox"
                    checked={r.done}
                    disabled={!loggedIn || busy}
                    onChange={(e) => onToggleRequirement(index, e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-blue-500 disabled:opacity-50"
                  />
                  <span
                    className={
                      r.done
                        ? 'line-through text-gray-400 dark:text-gray-500'
                        : 'text-gray-700 dark:text-gray-300'
                    }
                  >
                    {r.text}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {o.notes && (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line break-words">{o.notes}</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        {o.link ? (
          <a
            href={o.link}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate"
            title={o.link}
          >
            {linkLabel(o.link)} ↗
          </a>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500">No link</span>
        )}
        {loggedIn && (
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={onEdit}
              disabled={!canEdit || busy}
              title={canEdit ? 'Edit' : `Only ${owner} can edit this`}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
