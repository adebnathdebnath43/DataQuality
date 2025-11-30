import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import './Layout.css';

const Layout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [showUserMenu, setShowUserMenu] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="layout">
            <header className="navbar glass-panel">
                <div className="container flex-center navbar-content">
                    <Link to="/" style={{ textDecoration: 'none' }}>
                        <Logo />
                    </Link>
                    <nav className="nav-links">
                        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Dashboard</Link>
                        <Link to="/connect" className={location.pathname === '/connect' ? 'active' : ''}>Connect Source</Link>
                    </nav>
                    <div className="user-menu" style={{ position: 'relative' }}>
                        <button
                            className="user-menu-button"
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '8px',
                                padding: '0.5rem 1rem',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <span>👤</span>
                            <span>{user?.name || user?.username}</span>
                            <span style={{ fontSize: '0.7rem' }}>▼</span>
                        </button>
                        {showUserMenu && (
                            <div
                                className="user-menu-dropdown"
                                style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: '0.5rem',
                                    background: 'var(--card-bg)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '8px',
                                    minWidth: '200px',
                                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                                    zIndex: 1000
                                }}
                            >
                                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Signed in as</div>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user?.username}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        {user?.role === 'admin' ? '🔑 Admin' : '👤 User'}
                                    </div>
                                </div>
                                <div style={{ padding: '0.5rem 0' }}>
                                    {user?.role === 'admin' && (
                                        <Link
                                            to="/users"
                                            onClick={() => setShowUserMenu(false)}
                                            style={{
                                                display: 'block',
                                                padding: '0.75rem 1rem',
                                                color: 'var(--text-primary)',
                                                textDecoration: 'none',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
                                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                        >
                                            👥 User Management
                                        </Link>
                                    )}
                                    <Link
                                        to="/change-password"
                                        onClick={() => setShowUserMenu(false)}
                                        style={{
                                            display: 'block',
                                            padding: '0.75rem 1rem',
                                            color: 'var(--text-primary)',
                                            textDecoration: 'none',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
                                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                    >
                                        🔒 Change Password
                                    </Link>
                                    <button
                                        onClick={handleLogout}
                                        style={{
                                            width: '100%',
                                            display: 'block',
                                            padding: '0.75rem 1rem',
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#ef4444',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s',
                                            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                                        }}
                                        onMouseEnter={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.1)'}
                                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                    >
                                        🚪 Logout
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="main-content container">
                <Outlet />
            </main>

            <footer className="footer">
                <div className="container">
                    <p>&copy; 2025 Aether. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default Layout;
