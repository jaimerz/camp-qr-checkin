import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import './index.css';

import DashboardLayout from './components/layout/DashboardLayout';
import ScrollToTop from './components/layout/ScrollToTop';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import EventDetail from './pages/EventDetail';
import QrScanner from './pages/QrScanner';
import ParticipantImport from './pages/ParticipantImport';
import ParticipantDetail from './pages/ParticipantDetail';
import ManageParticipants from './pages/ManageParticipants';
import ManageEvents from './pages/ManageEvents';
import ManageActivities from './pages/ManageActivities';
import Reports from './pages/Reports';
import ResetPassword from './pages/ResetPassword';
import ManageUsers from './pages/ManageUsers';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UserProvider>
      <Router>
        <ScrollToTop />
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
            <Route path="/activities" element={<ManageActivities />} />
            <Route path="/participants" element={<ManageParticipants />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/users" element={<ManageUsers />} />
          </Route>
        </Routes>
      </Router>
    </UserProvider>
  </StrictMode>
);
