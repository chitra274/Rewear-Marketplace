import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('rewear_user')); } catch { return null; } });
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('rewear_token')));
  useEffect(() => { if (localStorage.getItem('rewear_token')) api('/auth/me').then(({user}) => { setUser(user); localStorage.setItem('rewear_user', JSON.stringify(user)); }).catch(() => logout()).finally(() => setLoading(false)); }, []);
  function saveSession(data) { localStorage.setItem('rewear_token', data.token); localStorage.setItem('rewear_user', JSON.stringify(data.user)); setUser(data.user); }
  function logout() { localStorage.removeItem('rewear_token'); localStorage.removeItem('rewear_user'); setUser(null); }
  return <AuthContext.Provider value={{ user, loading, saveSession, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
