import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Card from '../components/Card';
import Button from '../components/Button';
import './Login.css'; // Reuse login styles

const ChangePassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const { changePassword, user } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('Password must be at least 6 characters long');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (changePassword(password)) {
            navigate('/');
        } else {
            setError('Failed to update password');
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-header">
                    <div className="login-logo">🔒</div>
                    <h1>Change Password</h1>
                    <p>Please set a new password for your account</p>
                </div>

                <Card className="login-card">
                    <form onSubmit={handleSubmit}>
                        {error && <div className="login-error">{error}</div>}

                        <div className="form-group">
                            <label>New Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter new password"
                                required
                                className="form-input"
                            />
                        </div>

                        <div className="form-group">
                            <label>Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm new password"
                                required
                                className="form-input"
                            />
                        </div>

                        <Button type="submit" variant="primary" className="login-button">
                            Update Password
                        </Button>
                    </form>
                </Card>
            </div>
        </div>
    );
};

export default ChangePassword;
