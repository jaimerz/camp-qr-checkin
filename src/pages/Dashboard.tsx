import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users, MapPin, BarChart, Activity, QrCode } from 'lucide-react';
import { getCurrentUser, getEvents } from '../utils/firebase';
import { User, Event } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import AuthGuard from '../components/AuthGuard';
import LoadingSpinner from '../components/LoadingSpinner';

const Dashboard: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const activeEvent = events
    .filter((event) => event.active)
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0];
  const activeEventId = activeEvent?.id;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userResult = await getCurrentUser();
        if (userResult) {
          setUser(userResult.userData);
        }
        
        const eventsData = await getEvents();
        setEvents(eventsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <AuthGuard>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          {user?.role === 'admin' && (
            <Link to="/events/new">
              <Button>
                Create New Event
              </Button>
            </Link>
          )}
        </div>

        {/* User welcome section */}
        <Card>
          <CardHeader>
            <CardTitle>Welcome, {user?.displayName}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              You are logged in as a {user?.role === 'admin' ? 'Camp Administrator' : 'Camp Leader'}.
            </p>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <h2 className="text-lg font-semibold text-gray-900 mt-8">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['admin', 'leader'].includes(user?.role || '') && (
            <Link
              to={activeEventId ? `/scan/${activeEventId}` : '#'}
              className={`block ${!activeEventId ? 'pointer-events-none opacity-50' : ''}`}
            >
              <Card className="h-full transition-transform hover:shadow-md hover:-translate-y-1">
                <CardContent className="flex flex-col items-center justify-center p-6">
                  <QrCode className="h-12 w-12 text-teal-500 mb-4" />
                  <h3 className="font-medium text-gray-900">Scan QR Codes</h3>
                  <p className="text-sm text-gray-500 text-center mt-2">
                    Register participants for activities
                  </p>
                </CardContent>
              </Card>
            </Link>
          )}

          {user?.role === 'admin' && (
            <>
              <Link to="/participants" className="block">
                <Card className="h-full transition-transform hover:shadow-md hover:-translate-y-1">
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    <Users className="h-12 w-12 text-purple-500 mb-4" />
                    <h3 className="font-medium text-gray-900">Manage Participants</h3>
                    <p className="text-sm text-gray-500 text-center mt-2">
                      Add, edit or remove camp participants
                    </p>
                  </CardContent>
                </Card>
              </Link>

              <Link to="/activities" className="block">
                <Card className="h-full transition-transform hover:shadow-md hover:-translate-y-1">
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    <Activity className="h-12 w-12 text-amber-500 mb-4" />
                    <h3 className="font-medium text-gray-900">Manage Activities</h3>
                    <p className="text-sm text-gray-500 text-center mt-2">
                      Create and organize camp activities
                    </p>
                  </CardContent>
                </Card>
              </Link>

              <Link to="/reports" className="block">
                <Card className="h-full transition-transform hover:shadow-md hover:-translate-y-1">
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    <BarChart className="h-12 w-12 text-blue-500 mb-4" />
                    <h3 className="font-medium text-gray-900">View Reports</h3>
                    <p className="text-sm text-gray-500 text-center mt-2">
                      Track participation and attendance
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </>
          )}
        </div>

        {/* Recent events */}
        <h2 className="text-lg font-semibold text-gray-900 mt-8">Events</h2>
        {events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((event) => (
              <Link to={`/events/${event.id}`} key={event.id}>
                <Card className="h-full transition-transform hover:shadow-md hover:-translate-y-1">
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <Calendar className="h-8 w-8 text-teal-500 mr-3" />
                      <h3 className="font-medium text-lg text-gray-900">{event.name}</h3>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-500">
                        Date: {event.startDate.toLocaleDateString()} – {event.endDate.toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Events Found</h3>
                <p className="text-gray-500 mb-6">
                  There are no events created yet. Create your first event to get started.
                </p>
                {user?.role === 'admin' && (
                  <Link to="/events/new">
                    <Button>Create New Event</Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AuthGuard>
  );
};

export default Dashboard;
