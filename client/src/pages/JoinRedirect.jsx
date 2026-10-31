import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { post } from '../lib/api.js';

// Handles invite links: saantayo.app/join/<code>
export default function JoinRedirect() {
  const { code } = useParams();
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    post('/sessions/join', { code })
      .then(({ session }) => navigate(`/session/${session.id}`, { replace: true }))
      .catch((e) => setError(e.message));
  }, [user, code, navigate]);

  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: `/join/${code}` }} />;
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      {error ? <p className="alert alert--error">{error}</p> : <p>Joining session…</p>}
    </div>
  );
}
