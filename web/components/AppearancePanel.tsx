'use client';

import { useEffect, useState } from 'react';

type Surface = 'solid' | 'glass' | 'blur';
type Palette = 'classic' | 'sunset' | 'ocean' | 'forest' | 'grape' | 'mono';

const SURFACES: { value: Surface; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'glass', label: 'Glass' },
  { value: 'blur', label: 'Frosted' },
];

// Each swatch previews the palette's three backdrop colours.
const PALETTES: { value: Palette; label: string; colors: [string, string, string] }[] = [
  { value: 'classic', label: 'Classic', colors: ['#7ea4ff', '#5fd3a0', '#ffb0c9'] },
  { value: 'sunset', label: 'Sunset', colors: ['#ff9a76', '#ff6fa8', '#ffd36e'] },
  { value: 'ocean', label: 'Ocean', colors: ['#5ec8e5', '#4f8cff', '#7de3c8'] },
  { value: 'forest', label: 'Forest', colors: ['#6fcf97', '#a3d977', '#4fb3a0'] },
  { value: 'grape', label: 'Grape', colors: ['#b18cff', '#ff8ad8', '#8aa2ff'] },
  { value: 'mono', label: 'Mono', colors: ['#9ca3af', '#d1d5db', '#6b7280'] },
];

const save = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing: the choice just won't be remembered.
  }
};

// A small floating button on every page that opens the look settings.
export default function AppearancePanel() {
  const [open, setOpen] = useState(false);
  const [surface, setSurface] = useState<Surface>('blur');
  const [palette, setPalette] = useState<Palette>('classic');

  useEffect(() => {
    const d = document.documentElement.dataset;
    if (d.surface) setSurface(d.surface as Surface);
    if (d.palette) setPalette(d.palette as Palette);
  }, []);

  const chooseSurface = (v: Surface) => {
    setSurface(v);
    document.documentElement.dataset.surface = v;
    save('surfaceStyle', v);
  };

  const choosePalette = (v: Palette) => {
    setPalette(v);
    document.documentElement.dataset.palette = v;
    save('colorTheme', v);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
      {open ? (
        <div className="w-64 rounded-2xl p-4 bg-white/90 dark:bg-gray-900/90 border border-white/70 dark:border-white/10 shadow-2xl backdrop-blur-md text-sm text-gray-800 dark:text-gray-100">
          <div className="font-semibold mb-2">Style</div>
          <div className="grid grid-cols-3 gap-1 mb-4">
            {SURFACES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => chooseSurface(s.value)}
                aria-pressed={surface === s.value}
                className={`py-2 rounded-lg font-medium transition-colors ${
                  surface === s.value
                    ? 'text-white'
                    : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15'
                }`}
                style={surface === s.value ? { backgroundColor: 'var(--accent)' } : undefined}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="font-semibold mb-2">Color</div>
          <div className="grid grid-cols-3 gap-2">
            {PALETTES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => choosePalette(p.value)}
                aria-pressed={palette === p.value}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${
                  palette === p.value ? 'bg-black/10 dark:bg-white/15' : 'hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <span
                  className="w-9 h-9 rounded-full border border-white/70 shadow"
                  style={{ background: `conic-gradient(${p.colors[0]} 0 33%, ${p.colors[1]} 0 66%, ${p.colors[2]} 0)` }}
                />
                <span className="text-xs">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close appearance settings' : 'Appearance settings'}
        aria-expanded={open}
        className="w-12 h-12 rounded-full text-xl bg-white/80 dark:bg-gray-900/80 border border-white/70 dark:border-white/10 shadow-lg backdrop-blur-md hover:scale-105 transition-transform"
      >
        {open ? '✕' : '🎨'}
      </button>
    </div>
  );
}
