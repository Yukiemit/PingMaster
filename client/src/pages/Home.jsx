import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppLayout, { PageHero } from '../components/Layout.jsx';
import { Chevron } from '../components/Icons.jsx';
import PinInput from '../components/PinInput.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { get, post } from '../lib/api.js';
import './home.css';

const STEPS = [
  { n: 1, title: 'Invite', text: 'Share/input a link or a four-digit PIN.' },
  { n: 2, title: 'Match', text: 'Budget, cravings, and dietary needs shape the shortlist.' },
  { n: 3, title: 'Vote', text: 'The group picks and see the route. You may add it to your calendar.' },
  { n: 4, title: 'Split the bill', text: 'Equal, individual, or shared. See who owes what.' },
];

export function useStartSession() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const start = async (groupId) => {
    setBusy(true);
    try {
      const { session } = await post('/sessions', { groupId });
      navigate(`/session/${session.id}`);
    } catch (e) {
      alert(e.message);
    } finally { setBusy(false); }
  };
  return [start, busy];
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [startSession, starting] = useStartSession();
  const [link, setLink] = useState('');
  const [pin, setPin] = useState('');
  const [joinError, setJoinError] = useState('');
  const [sessions, setSessions] = useState(null);

  useEffect(() => { get('/sessions').then((d) => setSessions(d.sessions)).catch(() => setSessions([])); }, []);

  const join = async (e) => {
    e.preventDefault();
    setJoinError('');
    if (!link.trim() && pin.length !== 4) { setJoinError('Paste an invite link or enter the 4-digit PIN.'); return; }
    try {
      const { session } = await post('/sessions/join', link.trim() ? { code: link } : { pin });
      navigate(`/session/${session.id}`);
    } catch (err) { setJoinError(err.message); }
  };

  return (
    <AppLayout>
      <PageHero
        line1="Kahit saan?"
        line2="NOT ANYMORE."
        sub={<>Collect everyone&apos;s picks, vote, and settle<br className="br-lg" /> the bill in one place.</>}
        action={<button className="btn btn--cream" onClick={() => startSession()} disabled={starting}>Start My Session <Chevron /></button>}
      >
        <p className="home__hi">Hi, {user?.name} !</p>
      </PageHero>

      <section className="join container">
        <h2>Got an invite from a friend?</h2>
        <p>Get a link or code then click join.</p>
        <form onSubmit={join}>
          <div className="join__fields">
            <input className="join__link" placeholder="Paste the invite link here" aria-label="Invite link" value={link} onChange={(e) => setLink(e.target.value)} />
            <PinInput value={pin} onChange={setPin} className="join__pin" />
          </div>
          {joinError && <p className="alert alert--error join__err" role="alert">{joinError}</p>}
          <button className="btn btn--green join__btn" type="submit">Join a Session <Chevron /></button>
        </form>
      </section>

      <section className="how">
        <h2>HOW IT WORKS?</h2>
        <div className="how__grid">
          {STEPS.map((s) => (
            <article key={s.n} className="how__card">
              <span className="how__num">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container recent">
        <h2 className="section-title">RECENT SESSIONS</h2>
        {sessions === null && <p className="muted">Loading…</p>}
        {sessions?.length === 0 && (
          <div className="empty">
            <p>No sessions yet. Start one and send the link to your barkada.</p>
          </div>
        )}
        <ul className="rows">
          {sessions?.map((s) => (
            <li key={s.id}>
              <Link to={`/session/${s.id}`} className="row-card">
                <strong>{s.name}</strong>
                <span>
                  {s.picked ? s.picked.name : s.status === 'open' ? 'Waiting for picks' : 'Voting in progress'} · {s.participants.map((p) => p.name).join('-')} ({s.participants.length})
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </AppLayout>
  );
}
