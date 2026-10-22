'use client';

// The add / edit form for an opportunity. The page decides whether a save is a
// create or an update; this form only turns its fields into the fields the API
// takes. Requirements are typed one per line; lines whose text is unchanged
// keep their tick when the form is saved again.
import { useState } from 'react';
import {
  Opportunity,
  OpportunityCategory,
  OpportunityStatus,
  OPPORTUNITY_CATEGORIES,
  OPPORTUNITY_STATUSES,
} from '@/lib/api';

const INPUT =
  'w-full px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-950 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const LABEL = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

interface FormState {
  name: string;
  organisation: string;
  link: string;
  category: OpportunityCategory;
  status: OpportunityStatus;
  forWhom: 'me' | 'both';
  deadline: string;
  deadlineTime: string;
  applyFrom: string;
  applyOn: string;
  applyTime: string;
  requirements: string;
  notes: string;
}

const todayIso = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const fromOpportunity = (o: Opportunity | null, currentUserId: string): FormState => ({
  name: o?.name ?? '',
  organisation: o?.organisation ?? '',
  link: o?.link ?? '',
  category: o?.category ?? 'Scholarship',
  status: o?.status ?? 'Watching',
  forWhom: o ? (o.assignedTo.length > 1 || !o.assignedTo.includes(currentUserId) ? 'both' : 'me') : 'me',
  deadline: o?.deadline?.slice(0, 10) ?? '',
  deadlineTime: o?.deadlineTime ?? '',
  applyFrom: o?.applyFrom?.slice(0, 10) ?? '',
  applyOn: o?.applyOn?.slice(0, 10) ?? '',
  applyTime: o?.applyTime ?? '',
  requirements: (o?.requirements ?? []).map((r) => r.text).join('\n'),
  notes: o?.notes ?? '',
});

interface OpportunityFormProps {
  // null when adding; the opportunity when editing
  opportunity: Opportunity | null;
  currentUserId: string;
  partnerUserId: string;
  saving: boolean;
  onSave: (fields: Partial<Opportunity> & { name: string }) => void;
  onCancel: () => void;
}

export default function OpportunityForm({
  opportunity,
  currentUserId,
  partnerUserId,
  saving,
  onSave,
  onCancel,
}: OpportunityFormProps) {
  const [form, setForm] = useState<FormState>(() => fromOpportunity(opportunity, currentUserId));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return;

    // One requirement per line; keep the tick on lines whose text did not change.
    const previous = opportunity?.requirements ?? [];
    const requirements = form.requirements
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => ({ text, done: previous.find((r) => r.text === text)?.done ?? false }));

    const fields: Partial<Opportunity> & { name: string } = {
      name,
      organisation: form.organisation.trim(),
      link: form.link.trim(),
      category: form.category,
      status: form.status,
      assignedTo: form.forWhom === 'both' ? [currentUserId, partnerUserId] : [currentUserId],
      deadline: form.deadline || null,
      deadlineTime: form.deadline && form.deadlineTime ? form.deadlineTime : null,
      applyFrom: form.applyFrom || null,
      applyOn: form.applyOn || null,
      applyTime: form.applyOn && form.applyTime ? form.applyTime : null,
      requirements,
      notes: form.notes.trim(),
    };
    // Moving to Applied stamps the day, unless it was already stamped.
    if (form.status === 'Applied' && !opportunity?.appliedOn) {
      fields.appliedOn = todayIso();
    }
    onSave(fields);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 space-y-4"
    >
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {opportunity ? 'Edit opportunity' : 'Add an opportunity'}
      </h3>

      <div>
        <label className={LABEL}>Name *</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Chevening Scholarship 2027"
          required
          autoFocus
          className={INPUT}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Organisation</label>
          <input
            type="text"
            value={form.organisation}
            onChange={(e) => set('organisation', e.target.value)}
            placeholder="Who offers it"
            className={INPUT}
          />
        </div>
        <div>
          <label className={LABEL}>Link</label>
          <input
            type="url"
            value={form.link}
            onChange={(e) => set('link', e.target.value)}
            placeholder="https://"
            className={INPUT}
          />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <label className={LABEL}>Category</label>
          <select
            value={form.category}
            onChange={(e) => set('category', e.target.value as OpportunityCategory)}
            className={INPUT}
          >
            {OPPORTUNITY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>Status</label>
          <select
            value={form.status}
            onChange={(e) => set('status', e.target.value as OpportunityStatus)}
            className={INPUT}
          >
            {OPPORTUNITY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>For whom</label>
          <select
            value={form.forWhom}
            onChange={(e) => set('forWhom', e.target.value as FormState['forWhom'])}
            className={INPUT}
          >
            <option value="me">Me</option>
            <option value="both">Both of us</option>
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Deadline</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => set('deadline', e.target.value)}
              className={INPUT}
            />
            <input
              type="time"
              value={form.deadlineTime}
              onChange={(e) => set('deadlineTime', e.target.value)}
              disabled={!form.deadline}
              className={`${INPUT} w-32 disabled:opacity-50`}
            />
          </div>
        </div>
        <div>
          <label className={LABEL}>Applications open on</label>
          <input
            type="date"
            value={form.applyFrom}
            onChange={(e) => set('applyFrom', e.target.value)}
            className={INPUT}
          />
        </div>
      </div>

      <div>
        <label className={LABEL}>I will apply on</label>
        <div className="flex gap-2">
          <input
            type="date"
            value={form.applyOn}
            onChange={(e) => set('applyOn', e.target.value)}
            className={INPUT}
          />
          <input
            type="time"
            value={form.applyTime}
            onChange={(e) => set('applyTime', e.target.value)}
            disabled={!form.applyOn}
            className={`${INPUT} w-32 disabled:opacity-50`}
          />
        </div>
      </div>

      <div>
        <label className={LABEL}>What it asks for</label>
        <textarea
          value={form.requirements}
          onChange={(e) => set('requirements', e.target.value)}
          placeholder={'One per line, e.g.\nCV\nTwo reference letters\nMotivation statement'}
          rows={4}
          className={INPUT}
        />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">One requirement per line. Ticks are kept for lines you leave as they are.</p>
      </div>

      <div>
        <label className={LABEL}>Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Anything worth remembering"
          rows={3}
          className={INPUT}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
