'use client';

import { useEffect, useState } from 'react';

type Surface = 'solid' | 'glass' | 'blur';

const KEY = 'surfaceStyle';
const OPTIONS: { value: Surface; label: string; title: string }[] = [
  { value: 'solid', label: '▢', title: 'Solid cards' },
  { value: 'glass', label: '◇', title: 'Clear glass' },
  { value: 'blur', label: '❄', title: 'Frosted blur' },
];

// A small floating switcher, on every page: how cards look in this browser.
export default function StylePicker() {
  const [surface, setSurface] = useState<Surface>('blur');

  useEffect(() => {
    const saved = document.documentElement.dataset.surface as Surface | undefined;
    if (saved) setSurface(saved);
  }, []);

  const choose = (value: Surface) => {
    setSurface(value);
    document.documentElement.dataset.surface = value;
    try {
      localStorage.setItem(KEY, value);
    } catch {
      // Private browsing: the choice just won't be remembered.
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex gap-1 p-1 rounded-full bg-white/70 dark:bg-gray-900/70 border border-white/60 dark:border-white/10 shadow-lg backdrop-blur-md">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-label={o.title}
          aria-pressed={surface === o.value}
          onClick={() => choose(o.value)}
          className={`w-9 h-9 rounded-full text-base transition ${
            surface === o.value
              ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
              : 'text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
