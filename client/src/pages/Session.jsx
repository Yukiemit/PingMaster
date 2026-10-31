import { Fragment, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout, { PageHero, Toast } from '../components/Layout.jsx';
import MapPreview from '../components/MapPreview.jsx';
import { CalendarIcon, Check, Chevron, Copy } from '../components/Icons.jsx';
import { get, patch, put } from '../lib/api.js';
import { priceRange, walk } from '../lib/format.js';
import './session.css';

const STEPS = ['INVITE', 'PREFERENCE', 'MATCHING', 'RESULTS'];
const CRAVINGS = ['Japanese', 'Korean', 'Chinese', 'Pastry', 'Vietnamese', 'Cafe', 'Mexican', 'American', 'Italian', 'Burgers', 'Filipino'];
const DIETS = [
  ['vegetarian', 'Vegetarian'], ['dairyFree', 'Dairy Free'], ['seafoodAllergy', 'Seafood Allergy'],
  ['glutenFree', 'Gluten-Free'], ['vegan', 'Vegan'], ['nutAllergy', 'Nut Allergy'], ['noPork', 'No Pork'],
];

function Stepper({ step, maxStep, onGo }) {
  return (
    <ol className="stepper">
      {STEPS.map((s, i) => (
        <Fragment key={s}>
          {i > 0 && <li aria-hidden="true" className="stepper__arrow"><Chevron size={40} /></li>}
          <li>
            <button
              className={`stepper__pill${i === step ? ' active' : ''}`}
              aria-current={i === step ? 'step' : undefined}
              disabled={i > maxStep}
              onClick={() => onGo(i)}
            >{s}</button>
          </li>
        </Fragment>
      ))}
    </ol>
  );
}

function Nav({ onBack, onNext, nextLabel = 'Next', busy }) {
  return (
    <div className="step-nav">
      {onBack && <button className="btn btn--outline-red step-nav__btn" onClick={onBack}><Chevron dir="left" size={26} /> Back</button>}
      <button className="btn btn--red step-nav__btn" onClick={onNext} disabled={busy}>{busy ? 'Saving…' : nextLabel} <Chevron size={26} /></button>
    </div>
  );
}

// ---------- Step 1: Invite ----------
function InviteStep({ session, onNext, refresh }) {
  const isOrganizer = session.me.role === 'organizer';
  const [name, setName] = useState(isOrganizer ? (session.name === 'Untitled Session' ? '' : session.name) : (session.me.name === 'Guest' ? '' : session.me.name));
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const link = `${window.location.host}/join/${session.code}`;

  // Watch for friends joining while this screen is open.
  useEffect(() => {
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/join/${session.code}`); } catch { /* clipboard blocked */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const next = async () => {
    setBusy(true);
    try {
      if (name.trim()) await patch(`/sessions/${session.id}${isOrganizer ? '' : '/me'}`, { name });
      await onNext();
    } finally { setBusy(false); }
  };

  const others = session.participants.filter((p) => p.id !== session.me.id);
  const members = isOrganizer
    ? [...others, { ...session.me, joined: true, label: 'You (organizer)' }]
    : session.participants.map((p) => ({ ...p, label: p.id === session.me.id ? 'You' : p.role === 'organizer' ? `${p.name} (organizer)` : p.name }));

  return (
    <>
      <div className="panel spanel">
        <label className="slabel" htmlFor="sname">{isOrganizer ? 'Session Name' : 'User Name'}</label>
        <input id="sname" className="input" placeholder={isOrganizer ? 'Input Session name' : 'Input User Name'} value={name} onChange={(e) => setName(e.target.value)} />

        <label className="slabel" htmlFor="slink">Invite Link</label>
        <div className="slink">
          <input id="slink" className="input" readOnly value={link} onFocus={(e) => e.target.select()} />
          <button className="chip slink__copy" onClick={copy}>{copied ? <><Check width={20} height={20} /> Copied</> : <><Copy width={18} height={18} /> Copy</>}</button>
        </div>

        <span className="slabel">Four-digit PIN</span>
        <div className="spin" aria-label={`PIN ${session.pin.split('').join(' ')}`}>
          {session.pin.split('').map((d, i) => <span key={i}>{d}</span>)}
        </div>

        <h3 className="smembers__title">MEMBERS ({members.length})</h3>
        <ul className="smembers">
          {members.map((m) => (
            <li key={m.id} className={`chip${m.joined ? '' : ' chip--invited'}`} title={m.joined ? 'Joined' : 'Invited — not joined yet'}>{m.label || m.name}</li>
          ))}
        </ul>
        {!isOrganizer && <p className="snote">Waiting on {session.organizerName}? You can fill in your picks now.</p>}
      </div>
      <Nav onNext={next} busy={busy} />
    </>
  );
}

// ---------- Step 2: Preference ----------
function PreferenceStep({ session, onBack, onNext }) {
  const p = session.myPreferences || {};
  const [budgetMin, setMin] = useState(p.budgetMin || '');
  const [budgetMax, setMax] = useState(p.budgetMax || '');
  const [maxWalk, setWalk] = useState(p.maxWalk || '');
  const [cravings, setCravings] = useState(p.cravings?.length ? p.cravings : ['ANY']);
  const [diet, setDiet] = useState(p.diet?.length ? p.diet : ['none']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (list, setList, value, exclusive) => {
    if (value === exclusive) return setList([exclusive]);
    const without = list.filter((x) => x !== exclusive);
    const next = without.includes(value) ? without.filter((x) => x !== value) : [...without, value];
    setList(next.length ? next : [exclusive]);
  };

  const next = async () => {
    setError('');
    setBusy(true);
    try {
      await put(`/sessions/${session.id}/preferences`, { budgetMin, budgetMax, maxWalk, cravings, diet });
      await onNext();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="panel spanel">
        <h3 className="spanel__title">Your Preferences</h3>
        <p className="spanel__sub">Everyone fills this in. Saan Tayo?</p>

        <div className="pref">
          <span className="pref__label">Budget Estimation</span>
          <div className="pref__range">
            <input className="input input--box" inputMode="numeric" placeholder="Php." aria-label="Minimum budget in pesos" value={budgetMin} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} />
            <span className="pref__dash" />
            <input className="input input--box" inputMode="numeric" placeholder="Php." aria-label="Maximum budget in pesos" value={budgetMax} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} />
          </div>

          <span className="pref__label">Maximum Walk</span>
          <div className="pref__range">
            <input className="input input--box" inputMode="numeric" placeholder="Mins." aria-label="Maximum walking time in minutes" value={maxWalk} onChange={(e) => setWalk(e.target.value.replace(/\D/g, ''))} />
            <span className="pref__hint">minutes on foot</span>
          </div>

          <span className="pref__label">Cravings</span>
          <div className="pref__chips">
            <button className="chip chip--strong" aria-pressed={cravings.includes('ANY')} onClick={() => toggle(cravings, setCravings, 'ANY', 'ANY')}>ANY</button>
            {CRAVINGS.map((c) => (
              <button key={c} className="chip" aria-pressed={cravings.includes(c)} onClick={() => toggle(cravings, setCravings, c, 'ANY')}>{c}</button>
            ))}
          </div>

          <span className="pref__label">Dietary needs /<br />Allergy</span>
          <div className="pref__chips">
            <button className="chip chip--strong" aria-pressed={diet.includes('none')} onClick={() => toggle(diet, setDiet, 'none', 'none')}>NONE</button>
            {DIETS.map(([k, label]) => (
              <button key={k} className="chip" aria-pressed={diet.includes(k)} onClick={() => toggle(diet, setDiet, k, 'none')}>{label}</button>
            ))}
          </div>
        </div>
        {error && <p className="alert alert--error" role="alert">{error}</p>}
      </div>
      <Nav onBack={onBack} onNext={next} busy={busy} />
    </>
  );
}

// ---------- Step 3: Matching ----------
function MatchingStep({ session, onBack, onNext }) {
  const [matches, setMatches] = useState(null);
  const [votes, setVotes] = useState(session.myVotes || {});
  const [busy, setBusy] = useState(false);

  useEffect(() => { get(`/sessions/${session.id}/matches`).then((d) => setMatches(d.matches)); }, [session.id]);

  const vote = (rid, v) => setVotes((cur) => {
    const next = { ...cur };
    if (next[rid] === v) delete next[rid]; else next[rid] = v;
    return next;
  });

  const next = async () => {
    setBusy(true);
    try { await put(`/sessions/${session.id}/votes`, { votes }); await onNext(); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="panel spanel">
        <h3 className="spanel__title">Matches for the group</h3>
        <p className="spanel__sub">Ranked by match score. Tap to vote.</p>
        <p className="spanel__meta">{session.preferencesIn} of {session.participants.length} preferences in</p>
        {matches === null && <p>Finding places…</p>}
        {matches?.length === 0 && <p className="snote">No place fits everyone’s dietary needs yet. Go back and loosen a filter.</p>}
        <ul className="matches">
          {matches?.map((r) => (
            <li key={r.id} className={`match${votes[r.id] ? ' voted' : ''}`}>
              <div className="match__info">
                <strong>{r.name}</strong>
                <span>{r.cuisine} · {priceRange(r)} · {walk(r)} <em className="match__score">{r.score}% match</em></span>
              </div>
              <button className={`vote vote--maybe${votes[r.id] === 'maybe' ? ' on' : ''}`} aria-pressed={votes[r.id] === 'maybe'} onClick={() => vote(r.id, 'maybe')}>Maybe</button>
              <button className={`vote vote--yes${votes[r.id] === 'yes' ? ' on' : ''}`} aria-pressed={votes[r.id] === 'yes'} onClick={() => vote(r.id, 'yes')}>Yes</button>
            </li>
          ))}
        </ul>
      </div>
      <Nav onBack={onBack} onNext={next} busy={busy} />
    </>
  );
}

// ---------- Step 4: Results ----------
function gcalUrl({ name, place, date, time }) {
  const start = `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
  const endDate = new Date(`${date}T${time}`);
  endDate.setHours(endDate.getHours() + 2);
  const pad = (n) => String(n).padStart(2, '0');
  const end = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;
  const q = new URLSearchParams({
    action: 'TEMPLATE', text: `${name} @ ${place.name}`, dates: `${start}/${end}`, ctz: 'Asia/Manila',
    location: `${place.name}, ${place.address}`, details: 'Planned with Saan Tayo?',
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

function ResultsStep({ session, onBack, onToast }) {
  const navigate = useNavigate();
  const [res, setRes] = useState(null);
  const [date, setDate] = useState(session.schedule?.date || '');
  const [time, setTime] = useState(session.schedule?.time || '');
  const [error, setError] = useState('');

  useEffect(() => { get(`/sessions/${session.id}/results`).then(setRes); }, [session.id]);

  const schedule = async () => {
    setError('');
    if (!date) { setError('Pick a date first.'); return; }
    const t = time || '12:00';
    const tab = window.open('about:blank', '_blank');
    try {
      await put(`/sessions/${session.id}/schedule`, { date, time: t });
      const url = gcalUrl({ name: session.name, place: res.winner, date, time: t });
      if (tab) tab.location = url; else window.location.href = url;
      onToast('Saved to My Calendar');
    } catch (e) { tab?.close(); setError(e.message); }
  };

  const w = res?.winner;
  return (
    <>
      <div className="panel spanel spanel--results">
        {!res && <p>Counting votes…</p>}
        {res && !w && <p>No restaurant matched. Go back and adjust your preferences.</p>}
        {w && (
          <>
            <p className="res__kicker">The group picked</p>
            <h3 className="res__name">{w.name.toUpperCase()}</h3>
            <p className="res__meta">{w.cuisine} · {priceRange(w)} · {walk(w)}</p>
            <div className="res__map">
              <MapPreview label={w.name} />
              <a className="res__maplink" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${w.name} ${w.address}`)}`} target="_blank" rel="noreferrer">Open in Google Maps</a>
            </div>
            <div className="res__when">
              <label htmlFor="rdate">Date</label>
              <input id="rdate" className="input input--box" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <label htmlFor="rtime">Time</label>
              <input id="rtime" className="input input--box" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            {error && <p className="alert alert--error" role="alert">{error}</p>}
            <button className="chip res__gcal" onClick={schedule}><CalendarIcon width={30} height={30} /> Add to Google Calendar</button>
            <p className="res__tally">{session.votesIn} of {session.participants.length} voted{res.board[0]?.points ? ` · ${res.board[0].points} pts for the winner` : ''}</p>
          </>
        )}
      </div>
      <Nav onBack={onBack} onNext={() => navigate(`/split?session=${session.id}`)} />
    </>
  );
}

export default function Session() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState(null);
  const [maxStep, setMaxStep] = useState(0);
  const [toast, setToast] = useState('');

  const refresh = useCallback(
    () => get(`/sessions/${id}`).then(({ session }) => { setSession(session); return session; }).catch((e) => setError(e.message)),
    [id],
  );

  useEffect(() => {
    refresh().then((s) => {
      if (!s) return;
      const start = s.status === 'done' ? 3 : Object.keys(s.myVotes).length ? 3 : s.myPreferences ? 2 : 0;
      setStep(start);
      setMaxStep(start);
    });
  }, [refresh]);

  const go = async (i) => {
    await refresh();
    setStep(i);
    setMaxStep((m) => Math.max(m, i));
    window.scrollTo({ top: 380, behavior: 'smooth' });
  };

  return (
    <AppLayout>
      <PageHero line1="My" line2="SESSION" sub="Collect picks, match places, and vote." />
      <section className="container session">
        {error && <p className="alert alert--error">{error}</p>}
        {session && step !== null && (
          <>
            <Stepper step={step} maxStep={maxStep} onGo={setStep} />
            {step === 0 && <InviteStep session={session} refresh={refresh} onNext={() => go(1)} />}
            {step === 1 && <PreferenceStep session={session} onBack={() => setStep(0)} onNext={() => go(2)} />}
            {step === 2 && <MatchingStep session={session} onBack={() => setStep(1)} onNext={() => go(3)} />}
            {step === 3 && <ResultsStep session={session} onBack={() => setStep(2)} onToast={setToast} />}
          </>
        )}
      </section>
      <Toast message={toast} onDone={() => setToast('')} />
    </AppLayout>
  );
}
