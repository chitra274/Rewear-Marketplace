import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import AuthModal from './components/AuthModal';
import Home from './pages/Home';
import ListingDetail from './pages/ListingDetail';
import Sell from './pages/Sell';
import Dashboard from './pages/Dashboard';
import { useAuth } from './context/AuthContext';
function Protected({ children, onAuth }) { const { user, loading } = useAuth(); useEffect(() => { if (!loading && !user) onAuth('login'); }, [loading, user, onAuth]); if (loading) return <div className="loading-state">Getting your ReWear space ready…</div>; if (!user) return <Navigate to="/" replace/>; return children; }
function AppShell(){const [authMode,setAuthMode]=useState(null);return <BrowserRouter><Header onAuth={setAuthMode}/><Routes><Route path="/" element={<Home/>}/><Route path="/listing/:id" element={<ListingDetail onAuth={setAuthMode}/>}/><Route path="/sell" element={<Protected onAuth={setAuthMode}><Sell/></Protected>}/><Route path="/dashboard" element={<Protected onAuth={setAuthMode}><Dashboard/></Protected>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>{authMode&&<AuthModal mode={authMode} onClose={()=>setAuthMode(null)} onModeChange={setAuthMode}/>}</BrowserRouter>;}
export default function App(){return <AppShell/>;}
