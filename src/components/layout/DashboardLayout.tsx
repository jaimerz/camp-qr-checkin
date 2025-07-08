import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import LoadingSpinner from '../LoadingSpinner';
import { useUser } from '../../context/UserContext';

const DashboardLayout: React.FC = () => {
  const { loading } = useUser();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 overflow-x-hidden">
        <Header />
        <div className="flex-grow flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 overflow-x-hidden">
      <Header />
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default DashboardLayout;
