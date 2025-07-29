import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import AuthGuard from '../components/AuthGuard';
import {
  getActivitiesByEvent,
  getParticipantByQrCode,
  getParticipantCurrentActivity,
  createActivityLog,
  updateParticipantLocation,
} from '../utils/firebase';
import { Activity, Participant } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import QrScanner from '../components/QrScanner';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useUser } from '../context/UserContext';

const QrScannerPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<string>('');
  const [scanType, setScanType] = useState<'departure' | 'return' | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const { user } = useUser();

  useEffect(() => {
    const fetchActivities = async () => {
      if (!eventId) return;
      setLoading(true);
      try {
        const activitiesData = await getActivitiesByEvent(eventId);
        activitiesData.sort((a, b) => a.name.localeCompare(b.name));
        setActivities(activitiesData);
      } catch (err) {
        console.error('Error fetching activities:', err);
        setError('Failed to load activities');
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [eventId]);

  const handleScan = async (participantId: string, activityId: string | null) => {
    if (!eventId) return false;

    try {
      const leaderId = user?.id;
      if (!leaderId) {
        alert('Error: unable to identify scanner.');
        return false;
      }

      const currentActivity = await getParticipantCurrentActivity(participantId);

      if (scanType === 'departure') {
        if (currentActivity) {
          if (currentActivity.id === activityId) {
            alert('⚠️ Participant is already at this activity.');
            return false;
          }
          await createActivityLog({
            eventId,
            participantId,
            activityId,
            fromActivityId: currentActivity.id,
            leaderId,
            type: 'change',
          });
        } else {
          await createActivityLog({
            eventId,
            participantId,
            activityId,
            leaderId,
            type: 'departure',
          });
        }
        await updateParticipantLocation(eventId, participantId, activityId);
      }

      if (scanType === 'return') {
        if (!currentActivity) {
          alert('⚠️ Participant is already at camp.');
          return false;
        }

        await createActivityLog({
          eventId,
          participantId,
          activityId: currentActivity.id,
          leaderId,
          type: 'return',
        });

        await updateParticipantLocation(eventId, participantId, null);
      }

      return true;
    } catch (err) {
      console.error('Error recording scan:', err);
      return false;
    }
  };

  const validateAndHandleScan = async (participantId: string, activityId: string | null) => {
    if (!scanType) {
      setModalMessage('Please select a scan type before scanning.');
      setShowModal(true);
      return false;
    }

    if (scanType === 'departure' && !selectedActivityId) {
      setModalMessage('Please select an activity for departure.');
      setShowModal(true);
      return false;
    }

    return await handleScan(participantId, activityId);
  };

  const getParticipantInfo = async (participantId: string): Promise<Participant | null> => {
    if (!eventId) return null;
    try {
      return await getParticipantByQrCode(participantId, eventId);
    } catch (err) {
      console.error('Error getting participant info:', err);
      return null;
    }
  };

  const getCurrentActivity = async (participantId: string): Promise<Activity | null> => {
    try {
      return await getParticipantCurrentActivity(participantId);
    } catch (err) {
      console.error('Error getting current activity:', err);
      return null;
    }
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Activities Available</h3>
            <p className="text-gray-500 mb-6">
              You need to create at least one activity before you can start scanning QR codes.
            </p>
            <Button as="a" href={`/activities/new/${eventId}`}>
              Create Activity
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedActivity = activities.find((a) => a.id === selectedActivityId) || null;

  return (
    <AuthGuard>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">QR Scanner</h1>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Scan Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Scan Type"
                id="scan-type"
                value={scanType}
                onChange={(e) => setScanType(e.target.value as 'departure' | 'return' | '')}
                options={[
                  { value: '', label: '-- Select Scan Type --' },
                  { value: 'departure', label: 'Departure (Leaving Camp)' },
                  { value: 'return', label: 'Return (Coming Back to Camp)' },
                ]}
              />

              {scanType === 'departure' && (
                <Select
                  label="Activity"
                  id="activity"
                  value={selectedActivityId}
                  onChange={(e) => setSelectedActivityId(e.target.value)}
                  options={[
                    { value: '', label: '-- Select Activity --' },
                    ...activities.map((activity) => ({
                      value: activity.id,
                      label: activity.name,
                    })),
                  ]}
                />
              )}
            </div>
          </CardContent>
        </Card>

        <QrScanner
          activities={activities}
          selectedActivity={selectedActivity}
          scanType={scanType as 'departure' | 'return'}
          onScan={validateAndHandleScan}
          getParticipantInfo={(qrCode) => getParticipantByQrCode(qrCode, eventId!)}
          getParticipantCurrentActivity={getCurrentActivity}
        />

        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Missing Selection">
          <div className="p-4 text-gray-700">{modalMessage}</div>
        </Modal>
      </div>
    </AuthGuard>
  );
};

export default QrScannerPage;
