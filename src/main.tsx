import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import './index.css';

import DashboardLayout from './components/layout/DashboardLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import EventDetail from './pages/EventDetail';
import QrScanner from './pages/QrScanner';
import ParticipantImport from './pages/ParticipantImport';
import ParticipantDetail from './pages/ParticipantDetail';
import NewActivity from './pages/NewActivity';
import ManageParticipants from './pages/ManageParticipants';
import ManageEvents from './pages/ManageEvents';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/events" element={<ManageEvents />} />
          <Route path="/events/:eventId" element={<EventDetail />} />
          <Route path="/scan/:eventId" element={<QrScanner />} />
          <Route path="/participants/import/:eventId" element={<ParticipantImport />} />
          <Route path="/events/:eventId/participants/:qrCode" element={<ParticipantDetail />} />
          <Route path="/activities/new/:eventId" element={<NewActivity />} />
          <Route path="/participants" element={<ManageParticipants />} />          
        </Route>
      </Routes>
    </Router>
  </StrictMode>
);
