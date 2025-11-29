import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import Card from '../components/Card';
import './Login.css';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from?.pathname || '/';

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (login(username, password)) {
            navigate(from, { replace: true });
        } else {
            setError('Invalid username or password');
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-header">
                    <div className="login-logo">🔶</div>
                    <h1>Welcome Back</h1>
                    <p>Sign in to Aether Data Quality</p>
                </div>

                <Card className="login-card">
                    <form onSubmit={handleSubmit}>
                        {error && <div className="login-error">{error}</div>}

                        <div className="form-group">
                            <label htmlFor="username">Username</label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter your username"
                                required
                                className="form-input"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                                className="form-input"
                            />
                        </div>

                        <Button type="submit" variant="primary" className="login-button">
                            Sign In
                        </Button>


                    </form>
                </Card>
            </div>
        </div>
    );
};

export default Login;
