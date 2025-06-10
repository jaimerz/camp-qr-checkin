import React, { useEffect, useState } from 'react';
import { getEvents, getParticipantsByEvent, getActivitiesByEvent, getParticipantsAtCamp, getParticipantsByActivityId } from '../utils/firebase';
import { Event, Participant, Activity } from '../types';
import AuthGuard from '../components/AuthGuard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import { RefreshCw, MapPin, Users } from 'lucide-react';
import Button from '../components/ui/Button';

const Reports: React.FC = () => {
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [participantsAtCamp, setParticipantsAtCamp] = useState<Participant[]>([]);
  const [participantsByActivity, setParticipantsByActivity] = useState<Record<string, Participant[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const events = await getEvents();
      const active = events.filter(e => e.active).sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0];
      setActiveEvent(active);
      if (!active) return;

      const participantsData = await getParticipantsByEvent(active.id);
      const activitiesData = await getActivitiesByEvent(active.id);
      const atCampData = await getParticipantsAtCamp(active.id);

      const byActivityData: Record<string, Participant[]> = {};
      for (const activity of activitiesData) {
        const list = await getParticipantsByActivityId(active.id, activity.id);
        byActivityData[activity.id] = list;
      }

      setParticipants(participantsData);
      setActivities(activitiesData);
      setParticipantsAtCamp(atCampData);
      setParticipantsByActivity(byActivityData);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!activeEvent) return <p className="text-center text-gray-600 py-10">No active event found.</p>;

  const studentCount = participants.filter(p => p.type === 'student').length;
  const leaderCount = participants.filter(p => p.type === 'leader').length;
  const byChurch: Record<string, number> = {};
  participants.forEach(p => {
    if (!byChurch[p.church]) byChurch[p.church] = 0;
    byChurch[p.church]++;
  });

  return (
    <AuthGuard>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Participation Report</h1>
          <Button onClick={fetchData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border-l-4 border-purple-500 shadow">
              <h2 className="text-sm font-medium text-gray-500">Total Participants</h2>
              <p className="text-2xl font-bold text-gray-900">{participants.length}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border-l-4 border-teal-500 shadow">
              <h2 className="text-sm font-medium text-gray-500">Students</h2>
              <p className="text-2xl font-bold text-gray-900">{studentCount}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border-l-4 border-amber-500 shadow">
              <h2 className="text-sm font-medium text-gray-500">Leaders</h2>
              <p className="text-2xl font-bold text-gray-900">{leaderCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Location Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center mb-2">
                <Users className="h-5 w-5 text-green-600 mr-2" />
                <h4 className="font-medium text-green-800">At Camp</h4>
              </div>
              <p className="text-2xl font-bold text-green-900">{participantsAtCamp.length}</p>
            </div>
            {activities.map((activity) => (
              <div key={activity.id} className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center mb-2">
                  <MapPin className="h-5 w-5 text-blue-600 mr-2" />
                  <h4 className="font-medium text-blue-800">{activity.name}</h4>
                </div>
                <p className="text-2xl font-bold text-blue-900">{participantsByActivity[activity.id]?.length || 0}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Participants by Church</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(byChurch).map(([church, count]) => (
              <div key={church} className="bg-white p-3 rounded shadow border-l-4 border-teal-300">
                <p className="font-medium text-gray-800">{church}</p>
                <p className="text-sm text-gray-500">{count} participants</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
};

export default Reports;
