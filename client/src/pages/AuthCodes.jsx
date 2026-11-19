// "Check your email" (6-digit verification code) and "Forgot password" screens.
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import PinInput from '../components/PinInput.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { post } from '../lib/api.js';
import boodle from '../assets/boodle.jpg';
import './auth.css';

function AuthShell({ kicker, title, children }) {
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
        <p className="auth__kicker">{kicker}</p>
        <h1 className="auth__title">{title}</h1>
        {children}
      </main>
    </div>
  );
}

// Counts down after a code is sent so people don't spam "resend".
function useCooldown(seconds) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return undefined;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, () => setLeft(seconds)];
}

export function VerifyEmail() {
  const { user, ready, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = location.state?.from || '/home';
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [left, restart] = useCooldown(60);

  const submit = async (value = code) => {
    if (value.length !== 6 || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { user: u } = await post('/auth/verify', { code: value });
      setUser(u);
      navigate(next, { replace: true });
    } catch (e) { setError(e.message); setCode(''); } finally { setBusy(false); }
  };

  const resend = async () => {
    setError(''); setNotice('');
    try {
      await post('/auth/resend');
      restart();
      setNotice(`We sent a new code to ${user.email}.`);
    } catch (e) { setError(e.message); }
  };

  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.isGuest || user.emailVerified) return <Navigate to={next} replace />;

  return (
    <AuthShell kicker="One last step!" title="Check your email">
      <form className="auth__form codeform" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <p className="codeform__lead">We sent a 6-digit code to <strong>{user.email}</strong>. Enter it below to confirm it's really you.</p>
        <PinInput
          length={6}
          autoFocus
          label="Six-digit code"
          className="codeform__pin"
          value={code}
          onChange={(v) => { setCode(v); if (v.length === 6) submit(v); }}
        />
        {error && <p className="alert alert--error" role="alert">{error}</p>}
        {notice && <p className="alert alert--ok" role="status">{notice}</p>}
        <button className="auth__submit" type="submit" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Confirm email'}</button>
        <p className="codeform__help">
          Didn't get it? Check Spam or Promotions.{' '}
          <button type="button" className="codeform__link" onClick={resend} disabled={left > 0}>
            {left > 0 ? `Send a new code in ${left}s` : 'Send a new code'}
          </button>
        </p>
        <p className="codeform__help">
          Wrong email?{' '}
          <button type="button" className="codeform__link" onClick={async () => { await logout(); navigate('/signup'); }}>Sign up again</button>
        </p>
      </form>
    </AuthShell>
  );
}

export function ForgotPassword() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState('email'); // 'email' -> 'code'
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [left, restart] = useCooldown(0);

  const send = async (e) => {
    e?.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const { message } = await post('/auth/forgot', { email });
      setNotice(message);
      setStep('code');
      restart();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const reset = async (e) => {
    e.preventDefault();
    if (code.length !== 6) { setError('Enter the 6-digit code from the email.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await post('/auth/reset', { email, code, password });
      signIn(data);
      navigate('/home', { replace: true });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <AuthShell kicker="Forgot your password?" title={step === 'email' ? 'Walang problema!' : 'Enter the code'}>
      {step === 'email' ? (
        <form className="auth__form codeform" onSubmit={send}>
          <p className="codeform__lead">Type the email you signed up with. We'll send you a 6-digit code to reset your password.</p>
          <label htmlFor="femail">Email Address</label>
          <input id="femail" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          {error && <p className="alert alert--error" role="alert">{error}</p>}
          <button className="auth__submit codeform__submit" type="submit" disabled={busy || !email.trim()}>{busy ? 'Sending…' : 'Send code'}</button>
          <p className="codeform__help"><Link className="codeform__link" to="/login">Back to login</Link></p>
        </form>
      ) : (
        <form className="auth__form codeform" onSubmit={reset}>
          {notice && <p className="alert alert--ok" role="status">{notice}</p>}
          <span className="codeform__label">6-digit code sent to {email}</span>
          <PinInput length={6} autoFocus label="Six-digit code" className="codeform__pin" value={code} onChange={setCode} />
          <label htmlFor="fpass">New Password</label>
          <input id="fpass" type="password" autoComplete="new-password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          {error && <p className="alert alert--error" role="alert">{error}</p>}
          <button className="auth__submit codeform__submit" type="submit" disabled={busy || code.length !== 6 || password.length < 6}>{busy ? 'Saving…' : 'Set new password'}</button>
          <p className="codeform__help">
            Didn't get it? Check Spam.{' '}
            <button type="button" className="codeform__link" onClick={send} disabled={busy || left > 0}>Send again</button>
            {' · '}
            <button type="button" className="codeform__link" onClick={() => { setStep('email'); setCode(''); setNotice(''); }}>Change email</button>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
