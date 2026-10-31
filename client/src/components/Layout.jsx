import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import Logo from './Logo.jsx';
import { User } from './Icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const LINKS = [
  { to: '/home', label: 'Home' },
  { to: '/calendar', label: 'My Calendar' },
  { to: '/groups', label: 'My Group', also: ['/session', '/join'] },
  { to: '/split', label: 'Split the Bill' },
];

export function AppNav() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <header className="nav">
      <Link to="/home" className="logo-link" aria-label="Saan Tayo? home"><Logo size={62} /></Link>
      <nav className="nav__links" aria-label="Main">
        {LINKS.map((l) => {
          const active = pathname.startsWith(l.to) || l.also?.some((p) => pathname.startsWith(p));
          return (
            <NavLink key={l.to} to={l.to} className={`nav__pill${active ? ' active' : ''}`}>{l.label}</NavLink>
          );
        })}
      </nav>
      <div ref={ref} className="nav__acct">
        <button className="nav__avatar" aria-label="Account menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <User />
        </button>
        {open && (
          <div className="menu" role="menu">
            <div className="menu__head">
              <strong>{user?.name}</strong>
              <small>{user?.isGuest ? 'Guest — sign up to keep your history' : user?.email}</small>
            </div>
            {user?.isGuest && <Link to="/signup" role="menuitem">Create an account</Link>}
            <button role="menuitem" onClick={async () => { await logout(); navigate('/'); }}>Log out</button>
          </div>
        )}
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <Logo size={64} tone="yellow" />
        <p>Collect everyone&apos;s picks, vote, and settle the bill in one place.</p>
      </div>
    </footer>
  );
}

export function PageHero({ line1, line2, sub, action, children }) {
  return (
    <section className="hero">
      <div className="hero__inner">
        {children}
        <h1 className="hero__title"><span className="l1">{line1}</span><span className="l2">{line2}</span></h1>
        <div className="hero__row">
          {sub && <p className="hero__sub">{sub}</p>}
          {action}
        </div>
      </div>
    </section>
  );
}

export default function AppLayout({ children }) {
  return (
    <div className="page">
      <AppNav />
      <main className="page__main">{children}</main>
      <Footer />
    </div>
  );
}

export function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [message, onDone]);
  return message ? <div className="toast" role="status">{message}</div> : null;
}
