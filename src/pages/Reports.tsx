import React, { useEffect, useState } from 'react';
import {
  getEvents,
  getParticipantsByEvent,
  getActivitiesByEvent,
  getParticipantsAtCamp,
  getParticipantsByActivityId,
  getParticipantActivityLogs
} from '../utils/firebase';
import { Event, Participant, Activity } from '../types';
import AuthGuard from '../components/AuthGuard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import { RefreshCw, MapPin, Users } from 'lucide-react';
import Button from '../components/ui/Button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';

const Reports: React.FC = () => {
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [participantsAtCamp, setParticipantsAtCamp] = useState<Participant[]>([]);
  const [participantsByActivity, setParticipantsByActivity] = useState<Record<string, Participant[]>>({});
  const [activityEngagement, setActivityEngagement] = useState<Record<string, number>>({});
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

      const engagementMap: Record<string, Set<string>> = {};
      for (const activity of activitiesData) {
        engagementMap[activity.id] = new Set();
      }

      for (const participant of participantsData) {
        const logs = await getParticipantActivityLogs(participant.id);
        const latest = logs.find(log => log.type === 'change' || log.type === 'departure');
        if (latest?.activityId && engagementMap[latest.activityId]) {
          engagementMap[latest.activityId].add(participant.id);
        }
      }

      const engagementCounts: Record<string, number> = {};
      for (const activityId in engagementMap) {
        engagementCounts[activityId] = engagementMap[activityId].size;
      }

      setParticipants(participantsData);
      setActivities(activitiesData);
      setParticipantsAtCamp(atCampData);
      setParticipantsByActivity(byActivityData);
      setActivityEngagement(engagementCounts);
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

  const engagementChartData = activities.map((a) => ({
    name: a.name,
    count: activityEngagement[a.id] || 0,
  })).sort((a, b) => b.count - a.count);

  const churchChartData = Object.entries(byChurch).map(([church, count]) => ({
    name: church,
    count,
  })).sort((a, b) => b.count - a.count);

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
            <div className="bg-purple-50 p-4 rounded-lg">
              <h2 className="text-sm font-medium text-purple-800">Total Participants</h2>
              <p className="text-2xl font-bold text-purple-900">{participants.length}</p>
            </div>
            <div className="bg-teal-50 p-4 rounded-lg">
              <h2 className="text-sm font-medium text-teal-800">Students</h2>
              <p className="text-2xl font-bold text-teal-900">{studentCount}</p>
            </div>
            <div className="bg-amber-50 p-4 rounded-lg">
              <h2 className="text-sm font-medium text-amber-800">Leaders</h2>
              <p className="text-2xl font-bold text-amber-900">{leaderCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Location Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-3 bg-white border border-gray-200 rounded-md flex justify-between items-center hover:bg-gray-50">
              <div className="flex items-center">
                <Users className="h-5 w-5 text-green-600 mr-2" />
                <p className="font-medium text-gray-800">At Camp</p>
              </div>
              <span className="text-sm font-medium text-gray-600">{participantsAtCamp.length}</span>
            </div>
            {activities.map((activity) => (
              <div key={activity.id} className="p-3 bg-white border border-gray-200 rounded-md flex justify-between items-center hover:bg-gray-50">
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 text-blue-600 mr-2" />
                  <p className="font-medium text-gray-800">{activity.name}</p>
                </div>
                <span className="text-sm font-medium text-gray-600">{participantsByActivity[activity.id]?.length || 0}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Engagement</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={engagementChartData} layout="vertical" margin={{ left: 30, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={140} />
                <Tooltip />
                <Bar dataKey="count" fill="#0ea5e9" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Participants by Church</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={churchChartData} layout="vertical" margin={{ left: 30, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={140} />
                <Tooltip />
                <Bar dataKey="count" fill="#14b8a6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
};

export default Reports;
