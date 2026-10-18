// All day logic runs in the configured timezone (Africa/Addis_Ababa), whatever
// timezone the server itself is in. Days are handled as 'YYYY-MM-DD' keys so
// that a date never shifts when it crosses a timezone boundary.
const config = require('../config');

const TZ = config.timezone.name;

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

// Local calendar parts of an instant: { dateKey, time: 'HH:MM', hour, minute }
const localParts = (date = new Date()) => {
  const p = Object.fromEntries(formatter.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    dateKey: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
};

const toDateKey = (date) => localParts(new Date(date)).dateKey;

const todayKey = (now = new Date()) => localParts(now).dateKey;

const isDateKey = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

const addDays = (dateKey, n) => {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// 0 = Sunday … 6 = Saturday, matching task.schedule.days
const weekdayOf = (dateKey) => new Date(`${dateKey}T00:00:00Z`).getUTCDay();

// Weeks run Monday → Sunday and are named by their Monday.
const weekKeyOf = (dateKey) => addDays(dateKey, -((weekdayOf(dateKey) + 6) % 7));

const daysBetween = (fromKey, toKey) =>
  Math.round((new Date(`${toKey}T00:00:00Z`) - new Date(`${fromKey}T00:00:00Z`)) / 86400000);

// '7:5' / '7:05' → '07:05'
const normalizeTime = (time) => {
  if (!time) return time;
  const [h, m] = String(time).split(':');
  return `${String(h).padStart(2, '0')}:${String(m || '0').padStart(2, '0')}`;
};

// The instant at which the local wall-clock reads dateKey + time.
const zonedInstant = (dateKey, time = '00:00') => {
  const [y, mo, d] = dateKey.split('-').map(Number);
  const [h, mi] = normalizeTime(time).split(':').map(Number);
  const wanted = Date.UTC(y, mo - 1, d, h, mi);
  // Guess as if UTC, then correct by the zone's offset at that moment.
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const p = localParts(new Date(guess));
    const [py, pmo, pd] = p.dateKey.split('-').map(Number);
    const seen = Date.UTC(py, pmo - 1, pd, p.hour, p.minute);
    guess += wanted - seen;
  }
  return new Date(guess);
};

// A day can be acted on until closeHour the next morning.
const closeInstant = (dateKey) =>
  zonedInstant(addDays(dateKey, 1), `${String(config.rules.closeHour).padStart(2, '0')}:00`);

const isDayOpen = (dateKey, now = new Date()) => now < closeInstant(dateKey);

// The most recent day whose close time has passed.
const latestClosableDay = (now = new Date()) => {
  const { dateKey, hour } = localParts(now);
  return addDays(dateKey, hour >= config.rules.closeHour ? -1 : -2);
};

module.exports = {
  TZ,
  localParts,
  toDateKey,
  todayKey,
  isDateKey,
  addDays,
  weekdayOf,
  weekKeyOf,
  daysBetween,
  normalizeTime,
  zonedInstant,
  closeInstant,
  isDayOpen,
  latestClosableDay,
};
