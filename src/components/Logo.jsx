import React from 'react';

const Logo = ({ className = '' }) => {
    return (
        <div className={`flex-center ${className}`} style={{ gap: '0.5rem' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 2L2 9L16 16L30 9L16 2Z" fill="#22D3EE" fillOpacity="0.8" />
                <path d="M16 30L30 23L16 16L2 23L16 30Z" fill="#8B5CF6" fillOpacity="0.8" />
                <path d="M2 9V23L16 16V2L2 9Z" fill="#A78BFA" fillOpacity="0.5" />
                <path d="M30 9V23L16 16V2L30 9Z" fill="#67E8F9" fillOpacity="0.5" />
            </svg>
            <span className="text-gradient" style={{ fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
                Aether
            </span>
        </div>
    );
};

export default Logo;
