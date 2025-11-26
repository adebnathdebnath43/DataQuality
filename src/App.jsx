import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ConnectSource from './pages/ConnectSource';
import ConfigureConnection from './pages/ConfigureConnection';
import SourceDetails from './pages/SourceDetails';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="connect" element={<ConnectSource />} />
          <Route path="connect/:sourceId" element={<ConfigureConnection />} />
          <Route path="source/:id" element={<SourceDetails />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
