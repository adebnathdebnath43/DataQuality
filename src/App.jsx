import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ConnectSource from './pages/ConnectSource';
import ConfigureConnection from './pages/ConfigureConnection';
import SourceDetails from './pages/SourceDetails';
import Login from './pages/Login';
import UserManagement from './pages/UserManagement';
import ChangePassword from './pages/ChangePassword';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="connect" element={<ConnectSource />} />
            <Route path="connect/:sourceId" element={<ConfigureConnection />} />
            <Route path="source/:id" element={<SourceDetails />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="change-password" element={<ChangePassword />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
