import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, RefreshCw, Users, PlusCircle } from 'lucide-react';
import AuthGuard from '../components/AuthGuard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { getEvents, getParticipantsByEvent, resetTestData, createParticipant } from '../utils/firebase';
import { generateQRCodePDF } from '../utils/qrcode';
import { Event, Participant } from '../types';

const ManageParticipants: React.FC = () => {
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingQrCodes, setGeneratingQrCodes] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [name, setName] = useState('');
  const [church, setChurch] = useState('');
  const [type, setType] = useState<'student' | 'leader'>('student');

  useEffect(() => {
    const fetchActiveEventAndParticipants = async () => {
      setLoading(true);
      try {
        const events = await getEvents();
        const active = events.filter(e => e.active).sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0];
        setActiveEvent(active);

        if (active) {
          const data = await getParticipantsByEvent(active.id);
          setParticipants(data);
        }
      } catch (error) {
        console.error('Error loading event or participants:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveEventAndParticipants();
  }, []);

  const handleGenerateQrCodes = async () => {
    if (!participants.length) return;
    setGeneratingQrCodes(true);
    try {
      const pdfBlob = await generateQRCodePDF(participants);
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qr-codes.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating QR codes:', error);
    } finally {
      setGeneratingQrCodes(false);
    }
  };

  const handleResetTestData = async () => {
    if (!activeEvent) return;
    setResetting(true);
    try {
      await resetTestData(activeEvent.id);
      const data = await getParticipantsByEvent(activeEvent.id);
      setParticipants(data);
    } catch (error) {
      console.error('Error resetting test data:', error);
    } finally {
      setResetting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <AuthGuard requiredRole="admin">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Manage Participants</h1>

        {/* Action Buttons */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-x-4">
            <Button
              onClick={handleGenerateQrCodes}
              isLoading={generatingQrCodes}
              disabled={!participants.length}
            >
              <Download className="h-4 w-4 mr-2" />
              Generate QR Codes
            </Button>

            <Button
              variant="outline"
              onClick={handleResetTestData}
              isLoading={resetting}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset Test Data
            </Button>
          </CardContent>
        </Card>

        {/* Import Participants */}
        <Card>
          <CardHeader>
            <CardTitle>Import Participants</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Upload a CSV file to bulk-import participants to this event.
            </p>
            <Link to={`/participants/import/${activeEvent?.id}`}>
              <Button>Import CSV</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Add New Participant</CardTitle>
            </CardHeader>
            <CardContent>
                <form
                onSubmit={async (e) => {
                    e.preventDefault();
                    if (!activeEvent || !name || !church || !type) return;

                    try {
                    const newParticipant = {
                        eventId: activeEvent.id,
                        name,
                        church,
                        type,
                        assignedLeaders: [],
                    };
                    await createParticipant(newParticipant);
                    const updatedList = await getParticipantsByEvent(activeEvent.id);
                    setParticipants(updatedList);
                    setName('');
                    setChurch('');
                    setType('student');
                    } catch (err) {
                    console.error('Error adding participant:', err);
                    alert('Could not add participant');
                    }
                }}
                className="space-y-4"
                >
                <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                    required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Church</label>
                    <input
                    type="text"
                    value={church}
                    onChange={(e) => setChurch(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                    required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                    >
                    <option value="student">Student</option>
                    <option value="leader">Leader</option>
                    </select>
                </div>
                <Button type="submit">Add Participant</Button>
                </form>
            </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add New Participant</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              This section will allow you to add individual participants manually.
            </p>
            <Button disabled>
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Participant (Coming Soon)
            </Button>
          </CardContent>
        </Card>

        {/* Participant List (placeholder) */}
        <Card>
          <CardHeader>
            <CardTitle>All Participants</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              A full table with edit/delete options will go here.
            </p>
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
};

export default ManageParticipants;