import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Heart, Plus, UserRound, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
export default function Header({ onAuth }) {
  const { user, logout } = useAuth(); const navigate = useNavigate();
  return <header className="site-header"><div className="header-inner"><Link to="/" className="brand"><span className="brand-mark">r.</span><span>rewear</span></Link><nav className="main-nav"><NavLink to="/">Discover</NavLink><a href="/#how">How it works</a></nav><div className="header-actions">{user ? <><Link className="sell-link" to="/sell"><Plus size={16}/> Sell an item</Link><Link className="icon-link" to="/dashboard" aria-label="Dashboard"><UserRound size={19}/></Link><button className="icon-link" onClick={() => { logout(); navigate('/'); }} aria-label="Log out"><LogOut size={18}/></button></> : <><button className="text-button" onClick={() => onAuth('login')}>Log in</button><button className="dark-button small" onClick={() => onAuth('register')}>Join ReWear</button></>}</div></div></header>;
}
