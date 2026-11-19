// Date + time picker for scheduling the food trip, styled to match the app
// (the browser's built-in date/time pickers can't be themed).
import { useEffect, useRef, useState } from 'react';
import { MONTHS, isoDate, time12 } from '../lib/format.js';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MEALS = [
  ['Breakfast', '08:00'], ['Lunch', '12:00'], ['Merienda', '15:00'], ['Dinner', '19:00'],
];
// Every 30 minutes from 6:00 AM to 11:30 PM for "Other time".
const TIMES = Array.from({ length: 36 }, (_, i) => {
  const m = 360 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});

const parse = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const longDate = (iso) => parse(iso).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const shortDate = (d) => d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });

function quickDates(today) {
  const sat = addDays(today, (6 - today.getDay() + 7) % 7 || 7);
  const list = [['Today', today], ['Tomorrow', addDays(today, 1)]];
  // This weekend (skip days already covered by Today/Tomorrow).
  for (const d of [sat, addDays(sat, 1)]) {
    if (!list.some(([, x]) => isoDate(x) === isoDate(d))) list.push([shortDate(d), d]);
  }
  return list.map(([label, d]) => [label, isoDate(d)]);
}

function MonthGrid({ value, onPick, today }) {
  const start = value ? parse(value) : today;
  const [view, setView] = useState(new Date(start.getFullYear(), start.getMonth(), 1));
  const first = view.getDay();
  const count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const todayIso = isoDate(today);
  const atCurrentMonth = view.getFullYear() === today.getFullYear() && view.getMonth() === today.getMonth();
  const move = (n) => setView(new Date(view.getFullYear(), view.getMonth() + n, 1));

  return (
    <div className="when-cal" role="dialog" aria-label="Choose a date">
      <div className="when-cal__head">
        <button type="button" className="when-cal__nav" onClick={() => move(-1)} disabled={atCurrentMonth} aria-label="Previous month">‹</button>
        <strong>{MONTHS[view.getMonth()]} {view.getFullYear()}</strong>
        <button type="button" className="when-cal__nav" onClick={() => move(1)} aria-label="Next month">›</button>
      </div>
      <div className="when-cal__grid">
        {DAYS.map((d) => <span key={d} className="when-cal__dow">{d}</span>)}
        {Array.from({ length: first }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: count }, (_, i) => {
          const iso = isoDate(new Date(view.getFullYear(), view.getMonth(), i + 1));
          const past = iso < todayIso;
          const cls = ['when-cal__day', iso === todayIso && 'today', iso === value && 'sel'].filter(Boolean).join(' ');
          return (
            <button key={iso} type="button" className={cls} disabled={past} onClick={() => onPick(iso)}
              aria-label={longDate(iso)} aria-pressed={iso === value}>{i + 1}</button>
          );
        })}
      </div>
    </div>
  );
}

export default function WhenPicker({ date, time, onDate, onTime }) {
  const [open, setOpen] = useState(false);
  const [other, setOther] = useState(false);
  const box = useRef(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Close the calendar on outside click or Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const isMeal = MEALS.some(([, t]) => t === time);
  const showOther = other || (time && !isMeal);

  return (
    <div className="when">
      <div className="when__row">
        <span className="when__label">Date</span>
        <div className="when__opts">
          {quickDates(today).map(([label, iso]) => (
            <button key={iso} type="button" className="when__chip" aria-pressed={date === iso} onClick={() => onDate(iso)}>{label}</button>
          ))}
          <div className="when__calwrap" ref={box}>
            <button type="button" className={`when__chip when__chip--pick${open ? ' open' : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}
              aria-pressed={!!date && !quickDates(today).some(([, iso]) => iso === date)}>
              📅 {date && !quickDates(today).some(([, iso]) => iso === date) ? shortDate(parse(date)) : 'Pick a date'}
            </button>
            {open && <MonthGrid value={date} today={today} onPick={(iso) => { onDate(iso); setOpen(false); }} />}
          </div>
        </div>
      </div>

      <div className="when__row">
        <span className="when__label">Time</span>
        <div className="when__opts">
          {MEALS.map(([label, t]) => (
            <button key={t} type="button" className="when__chip when__chip--meal" aria-pressed={time === t} onClick={() => { onTime(t); setOther(false); }}>
              <b>{label}</b><small>{time12(t)}</small>
            </button>
          ))}
          {showOther ? (
            <select className="when__select" value={isMeal ? '' : time} onChange={(e) => onTime(e.target.value)} aria-label="Other time">
              <option value="" disabled>Choose time</option>
              {TIMES.map((t) => <option key={t} value={t}>{time12(t)}</option>)}
            </select>
          ) : (
            <button type="button" className="when__chip" onClick={() => setOther(true)}>Other time</button>
          )}
        </div>
      </div>

      <p className="when__summary" aria-live="polite">
        {date ? <>🍽️ <strong>{longDate(date)}</strong>{time ? <> at <strong>{time12(time)}</strong></> : ' · pick a time'}</> : 'Pick a day for the food trip.'}
      </p>
    </div>
  );
}
