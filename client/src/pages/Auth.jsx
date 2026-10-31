import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { post } from '../lib/api.js';
import boodle from '../assets/boodle.jpg';
import './auth.css';

const COPY = {
  login: { kicker: 'Welcome Back!', title: 'Tara, Kain Ulit!', cta: 'Login', swapText: "Don't have an account?", swapCta: 'Sign Up', swapTo: '/signup' },
  signup: { kicker: 'Welcome sa Barkada!', title: 'Tara, Kain Tayo!', cta: 'Create Account', swapText: 'Already have an account?', swapCta: 'Login', swapTo: '/login' },
};

export default function Auth({ mode }) {
  const c = COPY[mode];
  const { login, signup, guest } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = location.state?.from || '/home';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); navigate(next, { replace: true }); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const submit = (e) => {
    e.preventDefault();
    run(() => (mode === 'login' ? login(email, password) : signup(email, password)));
  };

  const forgot = async () => {
    setError('');
    if (!email) { setError('Type your email above first, then tap Forgot Password.'); return; }
    const { message } = await post('/auth/forgot', { email }).catch((e) => ({ message: e.message }));
    setNotice(message);
  };

  return (
    <div className="auth">
      <aside className="auth__side">
        <Link to="/" aria-label="Saan Tayo? home"><Logo size={46} tone="yellow" /></Link>
        <img className="auth__photo" src={boodle} alt="A Filipino boodle fight spread with crabs, lumpia and garlic rice on banana leaves" />
        <h2 className="auth__tag">Good food is<br />better together.</h2>
        <p className="auth__blurb">Less arguing, more eating.<br />Your next food trip starts here!</p>
        <p className="auth__motto">Find it. Choose it. Eat it.</p>
      </aside>

      <main className="auth__main">
        <p className="auth__kicker">{c.kicker}</p>
        <h1 className="auth__title">{c.title}</h1>

        <form className="auth__form" onSubmit={submit} noValidate>
          <label htmlFor="email">Email Address</label>
          <input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="********************" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />

          <div className="auth__row-end">
            {mode === 'login' ? <button type="button" className="auth__link" onClick={forgot}>Forgot Password?</button> : <span className="auth__hint">At least 6 characters</span>}
          </div>

          {error && <p className="alert alert--error" role="alert">{error}</p>}
          {notice && <p className="alert alert--ok" role="status">{notice}</p>}

          <button className="auth__submit" type="submit" disabled={busy}>{busy ? 'Sandali lang…' : c.cta}</button>

          <p className={`auth__swap auth__swap--${mode}`}>
            <span>{c.swapText}</span>
            <Link className="auth__link" to={c.swapTo} state={location.state}>{c.swapCta}</Link>
          </p>

          <div className="auth__divider">{mode === 'signup' && <span>OR</span>}</div>

          <button type="button" className="auth__guest" disabled={busy} onClick={() => run(() => guest())}>Continue As Guest</button>
          {mode === 'login' && <p className="auth__demo">Demo account: demo@saantayo.app / tarakain</p>}
        </form>
      </main>
    </div>
  );
}
