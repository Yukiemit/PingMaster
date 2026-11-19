import { Fragment, useCallback, useEffect, useState } from 'react';
import PlaceSearch from '../components/PlaceSearch.jsx';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout, { PageHero, Toast } from '../components/Layout.jsx';
import MapPreview from '../components/MapPreview.jsx';
import WhenPicker from '../components/WhenPicker.jsx';
import { MapsProvider, MatchesMap, RouteMap, SpotMap, useMapsKey } from '../components/GoogleMaps.jsx';
import { CalendarIcon, Check, Chevron, Copy } from '../components/Icons.jsx';
import { get, patch, put } from '../lib/api.js';
import { dietLabel, distance, mins, priceRange, time12, walk } from '../lib/format.js';
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

// ---------- Meetup spot (organizer picks where the group meets) ----------
function MeetupPicker({ session, mapsKey, refresh }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const spot = session.meetup;

  const save = async (place, message) => {
    setBusy('Saving the spot…');
    setError('');
    setDone('');
    try {
      await put(`/sessions/${session.id}/meetup`, place);
      await refresh();
      setDone(message || 'Meetup spot saved.');
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const useMine = () => {
    if (!navigator.geolocation) { setError("This browser can't share your location. Search for a place instead."); return; }
    setBusy('Getting your location…');
    setError('');
    setDone('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const acc = Math.round(pos.coords.accuracy);
        // No label: the server names the spot after the closest place.
        save({ lat: pos.coords.latitude, lng: pos.coords.longitude }, acc > 200
          ? `Location found, but it's only accurate to about ${acc >= 1000 ? `${(acc / 1000).toFixed(1)} km` : `${acc} m`}. Drag the pin on the map to the exact spot.`
          : 'Location found. Drag the pin if it is a little off.');
      },
      (err) => {
        setBusy('');
        setError(err.code === 1
          ? 'Location access is blocked. Click the location icon in the address bar to allow it, or search for a place instead.'
          : "Couldn't get your location. Search for a place instead.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };


  return (
    <div className="meetup">
      <span className="slabel">Meetup Spot</span>
      <p className="meetup__current">{spot ? <>📍 <strong>{spot.label}</strong></> : 'Not set yet. Nearby restaurants are found from here.'}</p>
      <div className="meetup__row">
        <button type="button" className="chip meetup__mine" onClick={useMine} disabled={!!busy}>{busy.startsWith('Getting') ? 'Locating…' : 'Use my location'}</button>
        <PlaceSearch
          near={spot}
          disabled={!!busy}
          onError={setError}
          onPick={(place) => save({ lat: place.lat, lng: place.lng, label: place.label, placeId: place.placeId }, `Meetup spot set to ${place.label}.`)}
        />
      </div>
      {busy && <p className="meetup__status" role="status">{busy}</p>}
      {done && !busy && <p className="meetup__status meetup__status--ok" role="status">✓ {done}</p>}
      {error && <p className="alert alert--error" role="alert">{error}</p>}
      {spot && mapsKey && (
        <div className="meetup__map">
          <SpotMap spot={spot} onMove={(p) => save(p, 'Pin moved. Meetup spot updated.')} />
          <span className="meetup__maphint">Drag the pin to adjust</span>
        </div>
      )}
      {spot && session.votesIn > 0 && <p className="snote">Changing the spot clears everyone's votes.</p>}
    </div>
  );
}

// ---------- Step 1: Invite ----------
function InviteStep({ session, mapsKey, onNext, refresh }) {
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
        {session.mapsEnabled && isOrganizer && <MeetupPicker session={session} mapsKey={mapsKey} refresh={refresh} />}
        {session.mapsEnabled && !isOrganizer && (
          <p className="meetup__current meetup__current--joiner">
            {session.meetup ? <>📍 Meetup spot: <strong>{session.meetup.label}</strong></> : `${session.organizerName} hasn't set the meetup spot yet.`}
          </p>
        )}
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
function MatchingStep({ session, mapsKey, onBack, onNext, onInvite }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [votes, setVotes] = useState(session.myVotes || {});
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(null);
  const matches = data?.matches ?? null;

  useEffect(() => {
    get(`/sessions/${session.id}/matches`).then(setData).catch((e) => { setError(e.message); setData({ matches: [] }); });
  }, [session.id]);
  const isOrganizer = session.me.role === 'organizer';
  const showMap = !!(mapsKey && data?.meetup && matches?.length && matches[0].lat != null);

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
        <p className="spanel__meta">{session.preferencesIn} of {session.participants.length} preferences in{data?.meetup ? ` · near ${data.meetup.label}` : ''}</p>
        {matches === null && <p>Finding places near the meetup spot…</p>}
        {error && <p className="alert alert--error" role="alert">{error}</p>}
        {data?.needsMeetup && (
          <div className="snote">
            {isOrganizer
              ? <>Set the meetup spot first so we can find restaurants near it. <button className="chip" onClick={onInvite}>Set meetup spot</button></>
              : `Waiting for ${session.organizerName} to set the meetup spot.`}
          </div>
        )}
        {!data?.needsMeetup && !error && matches?.length === 0 && <p className="snote">No place fits everyone’s dietary needs yet. Go back and loosen a filter.</p>}
        {showMap && (
          <div className="mmap">
            <MatchesMap meetup={data.meetup} matches={matches} activeId={active} onSelect={setActive} />
          </div>
        )}
        <ul className="matches">
          {matches?.map((r, i) => (
            <li key={r.id} className={`match${votes[r.id] ? ' voted' : ''}${active === r.id ? ' active' : ''}`}>
              <button type="button" className="match__info" onClick={() => setActive(r.id)} aria-label={`Show ${r.name} on the map`}>
                <strong>{showMap && <b className="match__num">{i + 1}</b>}{r.name}</strong>
                <span>{r.cuisine} · {priceRange(r)} · {walk(r)} <em className="match__score">{r.score}% match</em></span>
                {(r.rating || r.dietUnknown?.length > 0) && (
                  <small className="match__extra">
                    {r.rating ? `★ ${r.rating.toFixed(1)} (${r.ratingCount})` : ''}
                    {r.rating && r.dietUnknown?.length > 0 ? ' · ' : ''}
                    {r.dietUnknown?.length > 0 ? `Ask about: ${r.dietUnknown.map(dietLabel).join(', ')}` : ''}
                  </small>
                )}
              </button>
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

const whenText = ({ date, time }) => {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(y, m - 1, d).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  return `${day} at ${time12(time)}`;
};

// Everyone (the organizer too) sends a date & time; the organizer confirms one of those picks.
function WhenSection({ live, winner, reload, onToast }) {
  const isOrg = live.me.role === 'organizer';
  const final = live.status === 'done' && live.schedule;
  const mine = live.myProposal;
  const [date, setDate] = useState(mine?.date || '');
  const [time, setTime] = useState(mine?.time || '');
  const [chosen, setChosen] = useState(null); // organizer: the pick to confirm, as "date time"
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Picks grouped by date & time, most popular first.
  const groups = Object.values(live.proposals.reduce((acc, p) => {
    const k = `${p.date} ${p.time}`;
    (acc[k] ||= { key: k, date: p.date, time: p.time, people: [] }).people.push(p);
    return acc;
  }, {})).sort((a, b) => b.people.length - a.people.length || a.key.localeCompare(b.key));
  const joined = live.participants.filter((p) => p.joined).length;
  const chosenPick = groups.find((g) => g.key === chosen) || null; // gone if that person changed their pick

  const openCalendar = (when, tab) => {
    const url = gcalUrl({ name: live.name, place: winner, ...when });
    if (tab) tab.location = url; else window.open(url, '_blank');
  };

  const sendPick = async () => {
    setError('');
    if (!date || !time) { setError('Pick both a date and a time.'); return; }
    setBusy(true);
    try {
      await put(`/sessions/${live.id}/proposal`, { date, time });
      await reload();
      onToast(isOrg ? 'Your pick was added to the list' : `Your pick was sent to ${live.organizerName}`);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const confirm = async () => {
    setError('');
    if (!chosenPick) { setError("Choose one of the group's picks first."); return; }
    const when = { date: chosenPick.date, time: chosenPick.time };
    const tab = window.open('about:blank', '_blank');
    setBusy(true);
    try {
      await put(`/sessions/${live.id}/schedule`, when);
      openCalendar(when, tab);
      await reload();
      setChanging(false);
      setChosen(null);
      onToast('Final date set. Everyone can see it now.');
    } catch (e) { tab?.close(); setError(e.message); } finally { setBusy(false); }
  };

  if (final && !changing) {
    return (
      <div className="when-final">
        <p className="when-final__label">Final date</p>
        <p className="when-final__date">📅 {whenText(live.schedule)}</p>
        <p className="when-final__by">Chosen by {isOrg ? 'you' : live.organizerName} from the group's picks</p>
        <button className="chip res__gcal" onClick={() => openCalendar(live.schedule)}><CalendarIcon width={30} height={30} /> Add to my Google Calendar</button>
        {isOrg && (
          <button type="button" className="linkish when-final__change" onClick={() => { setChosen(`${live.schedule.date} ${live.schedule.time}`); setChanging(true); }}>
            Choose a different pick
          </button>
        )}
      </div>
    );
  }

  const picksList = (
    <div className="picks">
      <p className="picks__head">Everyone's picks · {live.proposals.length} of {joined}</p>
      {groups.length === 0 && <p className="picks__empty">No picks yet.{isOrg ? ' Send yours, and choose once the group has sent theirs.' : ''}</p>}
      <ul>
        {groups.map((g) => {
          const on = isOrg && chosen === g.key;
          return (
            <li key={g.key} className={`pick${on ? ' chosen' : ''}`}>
              <span className="pick__when">{whenText(g)}</span>
              <span className="pick__who">{g.people.map((p) => (p.isYou ? 'You' : p.name)).join(', ')}</span>
              <span className="pick__count">{g.people.length} {g.people.length === 1 ? 'vote' : 'votes'}</span>
              {isOrg && (
                <button type="button" className="chip pick__use" aria-pressed={on} onClick={() => setChosen(on ? null : g.key)}>
                  {on ? '✓ Chosen' : 'Choose'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div className="when-section">
      <h4 className="when-section__title">{isOrg ? 'When are we going? You make the final call.' : 'When works for you?'}</h4>
      <p className="when-section__sub">
        {isOrg
          ? "Send your own pick like everyone else, then choose the final date from the group's picks."
          : `Send your pick. ${live.organizerName} chooses the final date from everyone's picks.`}
      </p>

      {!changing && (
        <>
          <p className="when-section__step">{mine ? `Your pick: ${whenText(mine)}` : 'Your pick'}</p>
          <WhenPicker date={date} time={time} onDate={setDate} onTime={setTime} />
          <button className="chip res__gcal res__gcal--sm" onClick={sendPick} disabled={busy}>{busy ? 'Sending…' : mine ? 'Update my pick' : 'Send my pick'}</button>
        </>
      )}

      {isOrg && <p className="when-section__step">Final decision</p>}
      {picksList}

      {error && <p className="alert alert--error" role="alert">{error}</p>}
      {isOrg && (
        <>
          <button className="chip res__gcal res__confirm" onClick={confirm} disabled={busy || !chosenPick}>
            <CalendarIcon width={30} height={30} /> {chosenPick ? `Confirm ${whenText(chosenPick)}` : groups.length ? 'Choose a pick to confirm' : "Waiting for everyone's picks"}
          </button>
          <p className="when-section__note">Confirming locks the restaurant and date for everyone and opens Google Calendar for you.</p>
          {changing && <button type="button" className="linkish when-final__change" onClick={() => setChanging(false)}>Keep the current date</button>}
        </>
      )}
    </div>
  );
}

function directionsUrl(from, w) {
  const q = new URLSearchParams({ api: '1', destination: w.name, destination_place_id: w.id, travelmode: 'walking' });
  if (from) q.set('origin', `${from.lat},${from.lng}`);
  return `https://www.google.com/maps/dir/?${q}`;
}

function ResultsStep({ session, mapsKey, onBack, onToast }) {
  const navigate = useNavigate();
  const [res, setRes] = useState(null);
  const [route, setRoute] = useState(null);

  // Keep the result live: votes and date picks can change until the organizer confirms.
  const load = useCallback(() => get(`/sessions/${session.id}/results`).then(setRes).catch(() => {}), [session.id]);
  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 5000);
    return () => clearInterval(t);
  }, [load]);
  const live = res?.session || session;
  const final = live.status === 'done';
  const waiting = live.participants.filter((p) => p.joined).length - live.votesIn;

  // Walking route from the meetup spot (real places only).
  const real = res?.winner?.source === 'google';
  useEffect(() => {
    if (!real) return;
    get(`/sessions/${session.id}/route`).then(setRoute).catch(() => setRoute({ route: null }));
  }, [real, session.id, res?.winner?.id]);

  const w = res?.winner;
  return (
    <>
      <div className="panel spanel spanel--results">
        {!res && <p>Counting votes…</p>}
        {res?.needsMeetup && <p>The meetup spot isn't set yet. Go back to the Invite step to set it.</p>}
        {res && !w && !res.needsMeetup && <p>No restaurant matched. Go back and adjust your preferences.</p>}
        {w && (
          <>
            <p className="res__kicker">{final ? 'The group picked' : 'Leading right now'}</p>
            <h3 className="res__name">{w.name.toUpperCase()}</h3>
            <p className="res__meta">
              {w.cuisine} · {priceRange(w)} · {route?.route
                ? `${distance(route.route.distanceMeters)} · ${mins(Math.max(1, Math.round(route.route.durationSeconds / 60)))} walk`
                : walk(w)}
            </p>
            {real && route?.from && <p className="res__from">From 📍 {route.from.label}{w.address ? ` to ${w.address}` : ''}</p>}
            <div className="res__map">
              {real && mapsKey && route?.from
                ? <RouteMap from={route.from} to={route.to} polyline={route.route?.polyline} />
                : <MapPreview label={w.name} />}
              <a
                className="res__maplink"
                href={real ? directionsUrl(route?.from, w) : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${w.name} ${w.address}`)}`}
                target="_blank"
                rel="noreferrer"
              >{real ? 'Directions in Google Maps' : 'Open in Google Maps'}</a>
            </div>
            {route?.route?.steps?.length > 0 && (
              <details className="res__dir">
                <summary>Walking directions ({route.route.steps.length} steps)</summary>
                <ol>
                  {route.route.steps.map((st, i) => (
                    <li key={i}><span>{st.instruction}</span>{st.distanceMeters > 0 && <em>{distance(st.distanceMeters)}</em>}</li>
                  ))}
                </ol>
              </details>
            )}
            <WhenSection live={live} winner={w} reload={load} onToast={onToast} />
            <p className="res__tally">
              {live.votesIn} of {live.participants.length} voted{res.board[0]?.points ? ` · ${res.board[0].points} pts for the ${final ? 'winner' : 'leader'}` : ''}
              {!final && (waiting > 0 ? ` · waiting for ${waiting} more vote${waiting === 1 ? '' : 's'}, this can still change` : ` · this updates live until ${live.me.role === 'organizer' ? 'you confirm' : `${live.organizerName} confirms`} the date`)}
            </p>
          </>
        )}
      </div>
      <Nav onBack={onBack} onNext={() => navigate(`/split?session=${session.id}`)} />
    </>
  );
}

// Loads Google Maps only when a key is configured.
const WithMaps = ({ apiKey, children }) => (apiKey ? <MapsProvider apiKey={apiKey}>{children}</MapsProvider> : <>{children}</>);

export default function Session() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState(null);
  const [maxStep, setMaxStep] = useState(0);
  const [toast, setToast] = useState('');
  const mapsKey = useMapsKey();

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
          <WithMaps apiKey={mapsKey}>
            <Stepper step={step} maxStep={maxStep} onGo={setStep} />
            {step === 0 && <InviteStep session={session} mapsKey={mapsKey} refresh={refresh} onNext={() => go(1)} />}
            {step === 1 && <PreferenceStep session={session} onBack={() => setStep(0)} onNext={() => go(2)} />}
            {step === 2 && <MatchingStep session={session} mapsKey={mapsKey} onBack={() => setStep(1)} onNext={() => go(3)} onInvite={() => setStep(0)} />}
            {step === 3 && <ResultsStep session={session} mapsKey={mapsKey} onBack={() => setStep(2)} onToast={setToast} />}
          </WithMaps>
        )}
      </section>
      <Toast message={toast} onDone={() => setToast('')} />
    </AppLayout>
  );
}
