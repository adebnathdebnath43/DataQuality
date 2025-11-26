import React from 'react';
import './Card.css';

const Card = ({ children, className = '', title }) => {
    return (
        <div className={`card glass-panel ${className}`}>
            {title && <h3 className="card-title">{title}</h3>}
            <div className="card-content">
                {children}
            </div>
        </div>
    );
};

export default Card;
