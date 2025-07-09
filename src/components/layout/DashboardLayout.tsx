import React, { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import LoadingSpinner from '../LoadingSpinner';
import { useUser } from '../../context/UserContext';

const DashboardLayout: React.FC = () => {
  const { loading } = useUser();
  const location = useLocation();
  const layoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let attempt = 0;

    const scrollToTop = () => {
      requestAnimationFrame(() => {
        if (layoutRef.current) {
          window.scrollTo({ top: 0, behavior: 'auto' });

          // If header isn't fully rendered yet, try again a few times
          if (window.scrollY > 2 && attempt < 10) {
            attempt++;
            scrollToTop();
          }
        }
      });
    };

    scrollToTop();
  }, [location.pathname]);

  if (loading) {
    return (
      <div ref={layoutRef} className="min-h-screen flex flex-col bg-gray-50 overflow-x-hidden">
        <Header />
        <div className="flex-grow flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div ref={layoutRef} className="min-h-screen flex flex-col bg-gray-50 overflow-x-hidden">
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
