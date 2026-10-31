import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout, { PageHero } from '../components/Layout.jsx';
import { Chevron } from '../components/Icons.jsx';
import { get } from '../lib/api.js';
import { MONTHS, isoDate, time12 } from '../lib/format.js';
import { useStartSession } from './Home.jsx';
import './calendar.css';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function Calendar() {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [startSession, starting] = useStartSession();

  useEffect(() => { get('/calendar').then((d) => setEvents(d.events)).catch(() => {}); }, []);

  const byDate = useMemo(() => {
    const m = {};
    events.forEach((e) => (m[e.date] ||= []).push(e));
    return m;
  }, [events]);

  const y = cursor.getFullYear();
  const mo = cursor.getMonth();
  const lead = new Date(y, mo, 1).getDay();
  const count = new Date(y, mo + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const todayIso = isoDate(today);
  const upcoming = events.filter((e) => e.date >= todayIso);
  const shown = selected ? byDate[selected] || [] : upcoming;

  return (
    <AppLayout>
      <PageHero
        line1="My"
        line2="CALENDAR."
        sub="See your itinerary and booked sessions."
        action={<button className="btn btn--cream" onClick={() => startSession()} disabled={starting}>Start My Session <Chevron /></button>}
      />

      <section className="container cal">
        <div className="cal__head">
          <button className="cal__nav" aria-label="Previous month" onClick={() => { setSelected(null); setCursor(new Date(y, mo - 1, 1)); }}><Chevron dir="left" size={26} /></button>
          <h2>{MONTHS[mo].toUpperCase()} {y}</h2>
          <button className="cal__nav" aria-label="Next month" onClick={() => { setSelected(null); setCursor(new Date(y, mo + 1, 1)); }}><Chevron size={26} /></button>
          <span className="cal__legend">Session</span>
        </div>

        <div className="cal__grid" role="grid" aria-label={`${MONTHS[mo]} ${y}`}>
          {DAYS.map((d, i) => <div key={d} className={`cal__dow${i === 0 ? ' sun' : ''}`} role="columnheader">{d}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={`b${i}`} />;
            const iso = isoDate(new Date(y, mo, d));
            const has = byDate[iso];
            const cls = ['cal__day', i % 7 === 0 && 'sun', has && 'has', iso === todayIso && 'today', selected === iso && 'sel'].filter(Boolean).join(' ');
            return (
              <button
                key={iso} className={cls} role="gridcell"
                aria-label={`${MONTHS[mo]} ${d}${has ? `, ${has.length} session${has.length > 1 ? 's' : ''}` : ''}${iso === todayIso ? ', today' : ''}`}
                onClick={() => setSelected(has && selected !== iso ? iso : null)}
              >{d}</button>
            );
          })}
        </div>
      </section>

      <section className="container">
        <h2 className="section-title">
          {selected ? `SESSIONS ON ${MONTHS[Number(selected.slice(5, 7)) - 1].toUpperCase()} ${Number(selected.slice(8))}` : 'UPCOMING SESSIONS'}
          {selected && <button className="cal__clear" onClick={() => setSelected(null)}>Show upcoming</button>}
        </h2>
        {shown.length === 0 && <p className="empty">Nothing booked yet. Finish a session and pick a date to see it here.</p>}
        <ul className="ev-list">
          {shown.map((e) => {
            const d = new Date(`${e.date}T00:00`);
            return (
              <li key={e.id} className="ev">
                <div className="ev__date"><b>{d.getDate()}</b><span>{MONTHS[d.getMonth()].slice(0, 3).toUpperCase()}</span></div>
                <Link className="row-card ev__card" to={`/session/${e.id}`}>
                  <strong>{e.name}</strong>
                  <span>{e.restaurant} · {time12(e.time)} · {e.people} people</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </AppLayout>
  );
}
