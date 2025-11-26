import React from 'react';
import './Button.css';

const Button = ({ children, variant = 'primary', onClick, className = '', ...props }) => {
    return (
        <button
            className={`btn btn-${variant} ${className}`}
            onClick={onClick}
            {...props}
        >
            {children}
        </button>
    );
};

export default Button;
