import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, User } from 'lucide-react';
import { getParticipantActivityLogs, getParticipantByQrCode } from '../utils/firebase';
import { ActivityLog, Participant } from '../types';
import { formatDateTime } from '../utils/helpers';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import Badge from '../components/ui/Badge';
import AuthGuard from '../components/AuthGuard';

const ParticipantDetail: React.FC = () => {
  const { eventId, qrCode } = useParams<{ eventId: string; qrCode: string }>();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      if (!eventId || !qrCode) return;
      setLoading(true);
      try {
        const p = await getParticipantByQrCode(qrCode, eventId);
        if (!p) {
          setParticipant(null);
          return;
        }
        setParticipant(p);

        const history = await getParticipantActivityLogs(p.id);
        setLogs(history);
      } catch (error) {
        console.error('Error fetching participant data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [eventId, qrCode]);

  if (loading) return <LoadingSpinner />;

  if (!participant) {
    return (
      <Card className="p-6">
        <p className="text-red-500">Participant not found.</p>
      </Card>
    );
  }

  return (
    <AuthGuard>
      <div className="space-y-6">
        <button
          className="text-sm text-teal-600 flex items-center mb-4"
          onClick={() => navigate(`/events/${eventId}?fromTab=participants`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Participants
        </button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="w-5 h-5 text-gray-500" />
              <span>{participant.name}</span>
              <Badge>{participant.type}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Church: {participant.church}</p>
            <p className="text-sm text-gray-600">ID: {participant.id}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-gray-500" />
              <span>Activity History</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-gray-500">No activity logs found.</p>
            ) : (
              <ul className="space-y-2">
                {logs.map((log) => (
                  <li key={log.id} className="border rounded-md p-3 text-sm">
                    <div className="flex justify-between">
                      <span>
                        {log.type === 'change'
                          ? <>🔁 Changed from <strong>{log.fromActivityName || log.fromActivityId}</strong> to <strong>{log.activityName || log.activityId}</strong></>
                          : log.type === 'departure'
                          ? <>🚶‍♂️ Left for <strong>{log.activityName || log.activityId}</strong></>
                          : <>🏕️ Returned from <strong>{log.activityName || log.activityId}</strong></>}
                      </span>
                      <span className="text-gray-400">{formatDateTime(log.timestamp)}</span>
                    </div>
                    {log.leaderName && (
                      <p className="text-gray-500 text-xs mt-1">Scanned by: {log.leaderName}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
};

export default ParticipantDetail;
