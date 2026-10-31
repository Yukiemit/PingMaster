import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Landing from './pages/Landing.jsx';
import Auth from './pages/Auth.jsx';
import Home from './pages/Home.jsx';
import MyGroup from './pages/MyGroup.jsx';
import Calendar from './pages/Calendar.jsx';
import Session from './pages/Session.jsx';
import JoinRedirect from './pages/JoinRedirect.jsx';
import SplitBill from './pages/SplitBill.jsx';

// Logged-in users and guests can use the app; everyone else goes to login.
function RequireUser({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Auth mode="login" />} />
      <Route path="/signup" element={<Auth mode="signup" />} />
      <Route path="/join/:code" element={<JoinRedirect />} />
      <Route path="/home" element={<RequireUser><Home /></RequireUser>} />
      <Route path="/groups" element={<RequireUser><MyGroup /></RequireUser>} />
      <Route path="/calendar" element={<RequireUser><Calendar /></RequireUser>} />
      <Route path="/session/:id" element={<RequireUser><Session /></RequireUser>} />
      <Route path="/split" element={<RequireUser><SplitBill /></RequireUser>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
