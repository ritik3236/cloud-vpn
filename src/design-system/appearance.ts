/**
 * Named full palettes. Each is one `[data-appearance]` block in globals.css setting the whole
 * token set; `mode` only groups them in the picker and decides the system-preference fallback.
 *
 * The swatch pairs are literal colours on purpose — they preview OTHER palettes, so they cannot
 * come from the live variables. This is the one place literals are allowed.
 */
export type AppearanceMode = 'light' | 'dark';

export type Appearance = {
  id: string;
  name: string;
  mode: AppearanceMode;
  swatch: [string, string];
};

export const APPEARANCES: Appearance[] = [
  { id: 'slate-light', name: 'Slate', mode: 'light', swatch: ['#fcfcfc', '#3f3f46'] },
  { id: 'emerald-light', name: 'Emerald', mode: 'light', swatch: ['#f6fdfa', '#0f7a5f'] },
  { id: 'rose-light', name: 'Rose', mode: 'light', swatch: ['#fffafb', '#c2405b'] },
  { id: 'slate-dark', name: 'Slate', mode: 'dark', swatch: ['#18181b', '#fafafa'] },
  { id: 'dim', name: 'Dim', mode: 'dark', swatch: ['#2e3440', '#e2e6ee'] },
  { id: 'violet-dark', name: 'Violet', mode: 'dark', swatch: ['#1a1424', '#a78bfa'] },
  { id: 'amber-dark', name: 'Amber', mode: 'dark', swatch: ['#1b1610', '#f0b429'] },
];

export const DEFAULT_APPEARANCE = 'slate-light';
export const DARK_FALLBACK = 'slate-dark';
export const APPEARANCE_STORAGE_KEY = 'cvpn-appearance';

/**
 * Runs before first paint, inlined in <head>. Applying a theme from an effect instead paints
 * the default palette and then flashes to the user's on every hard load.
 */
export const APPEARANCE_SCRIPT = `
try {
  var stored = localStorage.getItem('${APPEARANCE_STORAGE_KEY}');
  var valid = ${JSON.stringify(APPEARANCES.map((a) => a.id))};
  if (!stored || stored === 'system' || valid.indexOf(stored) === -1) {
    stored = matchMedia('(prefers-color-scheme: dark)').matches ? '${DARK_FALLBACK}' : '${DEFAULT_APPEARANCE}';
  }
  document.documentElement.dataset.appearance = stored;
} catch (e) {
  document.documentElement.dataset.appearance = '${DEFAULT_APPEARANCE}';
}
`.trim();
