import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load users from local storage or seed default admin
        const storedUsers = JSON.parse(localStorage.getItem('aether_users') || '[]');
        if (storedUsers.length === 0) {
            const defaultAdmin = {
                username: 'admin',
                password: 'admin123',
                role: 'admin',
                name: 'Administrator',
                isTemporaryPassword: false
            };
            storedUsers.push(defaultAdmin);
            localStorage.setItem('aether_users', JSON.stringify(storedUsers));
        }
        setUsers(storedUsers);

        // Check local storage for existing session
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = (username, password) => {
        const foundUser = users.find(u => u.username === username && u.password === password);
        if (foundUser) {
            // Don't store password in session
            const { password, ...userSession } = foundUser;
            setUser(userSession);
            localStorage.setItem('user', JSON.stringify(userSession));
            return true;
        }
        return false;
    };

    const registerUser = (username, password, role, name) => {
        if (users.some(u => u.username === username)) {
            return false; // User already exists
        }
        const newUser = {
            username,
            password,
            role,
            name,
            isTemporaryPassword: true
        };
        const updatedUsers = [...users, newUser];
        setUsers(updatedUsers);
        localStorage.setItem('aether_users', JSON.stringify(updatedUsers));
        return true;
    };

    const changePassword = (newPassword) => {
        if (!user) return false;

        const updatedUsers = users.map(u => {
            if (u.username === user.username) {
                return { ...u, password: newPassword, isTemporaryPassword: false };
            }
            return u;
        });

        setUsers(updatedUsers);
        localStorage.setItem('aether_users', JSON.stringify(updatedUsers));

        // Update current session
        const updatedUser = { ...user, isTemporaryPassword: false };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        return true;
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('user');
    };

    return (
        <AuthContext.Provider value={{ user, users, login, logout, registerUser, changePassword, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
