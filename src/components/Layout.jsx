import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import Logo from './Logo';
import './Layout.css';

const Layout = () => {
    const location = useLocation();

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
