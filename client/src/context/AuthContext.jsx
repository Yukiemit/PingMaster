import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { get, post, tokenStore } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!tokenStore.get()) { setReady(true); return; }
    get('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => tokenStore.set(null))
      .finally(() => setReady(true));
  }, []);

  const finish = ({ token, user }) => { tokenStore.set(token); setUser(user); return user; };

  const login = useCallback((email, password) => post('/auth/login', { email, password }).then(finish), []);
  const signup = useCallback((email, password) => post('/auth/signup', { email, password }).then(finish), []);
  const guest = useCallback((name) => post('/auth/guest', { name }).then(finish), []);
  const logout = useCallback(async () => {
    await post('/auth/logout').catch(() => {});
    tokenStore.set(null);
    setUser(null);
  }, []);

  const signIn = useCallback((data) => finish(data), []); // used after a password reset
  const value = useMemo(() => ({ user, ready, login, signup, guest, logout, setUser, signIn }), [user, ready, login, signup, guest, logout, signIn]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
