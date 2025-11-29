import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Card from '../components/Card';
import Button from '../components/Button';
import './UserManagement.css';

const UserManagement = () => {
    const { users, registerUser, user: currentUser } = useAuth();
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role: 'viewer',
        name: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!formData.username || !formData.password || !formData.name) {
            setError('All fields are required');
            return;
        }

        const result = registerUser(formData.username, formData.password, formData.role, formData.name);
        if (result) {
            setSuccess(`User ${formData.username} created successfully`);
            setFormData({ username: '', password: '', role: 'viewer', name: '' });
        } else {
            setError('Username already exists');
        }
    };

    return (
        <div className="user-management fade-in">
            <div className="header-section">
                <h1>User Management</h1>
                <p>Create and manage users for the Aether platform</p>
            </div>

            <div className="management-grid">
                <Card title="Create New User" className="create-user-card">
                    <form onSubmit={handleSubmit}>
                        {error && <div className="alert error">{error}</div>}
                        {success && <div className="alert success">{success}</div>}

                        <div className="form-group">
                            <label>Full Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. John Doe"
                                className="form-input"
                            />
                        </div>

                        <div className="form-group">
                            <label>Username</label>
                            <input
                                type="text"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                placeholder="e.g. jdoe"
                                className="form-input"
                            />
                        </div>

                        <div className="form-group">
                            <label>Password</label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                placeholder="Enter password"
                                className="form-input"
                            />
                        </div>

                        <div className="form-group">
                            <label>Role</label>
                            <select
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                className="form-input"
                            >
                                <option value="viewer">Viewer (Read Only)</option>
                                <option value="admin">Aether Admin (Full Access)</option>
                            </select>
                        </div>

                        <Button type="submit" variant="primary" style={{ width: '100%', marginTop: '1rem' }}>
                            Create User
                        </Button>
                    </form>
                </Card>

                <Card title="Existing Users" className="users-list-card">
                    <div className="users-list">
                        {users.map((u, index) => (
                            <div key={index} className="user-item">
                                <div className="user-avatar">
                                    {u.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="user-info">
                                    <h4>{u.name} {u.username === currentUser.username && '(You)'}</h4>
                                    <p className="user-role">
                                        {u.role === 'admin' ? 'Aether Admin' : 'Viewer'}
                                    </p>
                                    <p className="user-username">@{u.username}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default UserManagement;
