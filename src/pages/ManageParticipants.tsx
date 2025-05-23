""import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, RefreshCw, Users, PlusCircle, Trash2 } from 'lucide-react';
import AuthGuard from '../components/AuthGuard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  getEvents,
  getParticipantsByEvent,
  resetTestData,
  createParticipant,
  deleteParticipantWithLogs,
} from '../utils/firebase';
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
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState('');

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

  const handleBulkAction = async () => {
    if (bulkAction === 'delete') {
      if (!activeEvent) return;
      if (!selectedIds.length) return;

      const confirmed = confirm(`Are you sure you want to delete ${selectedIds.length} participants? Their activity logs will also be deleted.`);
      if (!confirmed) return;

      try {
        for (const id of selectedIds) {
          await deleteParticipantWithLogs(activeEvent.id, id);
        }
        const updatedList = await getParticipantsByEvent(activeEvent.id);
        setParticipants(updatedList);
        setSelectedIds([]);
        setBulkAction('');
        showMessage('Selected participants deleted.', 'success');
      } catch (err) {
        console.error('Bulk delete error:', err);
        showMessage('Failed to delete some participants.', 'error');
      }
    }
  };

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(null), 3000);
  };

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

  const handleDelete = async (participant: Participant) => {
    const confirmed = confirm(
      `Are you sure you want to delete ${participant.name}? This will also delete their activity logs.`
    );
    if (!confirmed) return;

    try {
      await deleteParticipantWithLogs(participant.eventId, participant.id);
      const updatedList = await getParticipantsByEvent(participant.eventId);
      setParticipants(updatedList);
      showMessage('Participant and logs deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting participant and logs:', error);
      showMessage('Error deleting participant', 'error');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === participants.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(participants.map(p => p.id));
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <AuthGuard requiredRole="admin">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Manage Participants</h1>
        {message && (
          <div className={`fixed top-4 right-4 z-50 p-3 rounded-md shadow-md text-sm font-medium transition-opacity duration-300 ${
            messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message}
          </div>
        )}

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

                const qrCode = `${activeEvent.id}::${church}::${name}`.toLowerCase().trim();
                const exists = participants.some(p => p.qrCode === qrCode);

                if (exists) {
                  showMessage('Participant already exists for this event.', 'error');
                  return;
                }

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
                  showMessage('Participant added successfully!', 'success');
                } catch (err) {
                  console.error('Error adding participant:', err);
                  showMessage('Could not add participant because it already exists', 'error');
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

        <div className="flex items-center space-x-3 mb-4">
          <select
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
            className="border border-gray-300 rounded-md p-2 text-sm"
          >
            <option value="">Bulk Actions</option>
            <option value="delete">Delete Selected</option>
          </select>
          <Button
            variant="destructive"
            disabled={selectedIds.length === 0 || !bulkAction}
            onClick={handleBulkAction}
          >
            Apply
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Participants</CardTitle>
          </CardHeader>
          <CardContent>
            {participants.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center space-x-3 mb-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === participants.length}
                    onChange={toggleSelectAll}
                    className="ml-1"
                  />
                  <span className="text-sm text-gray-700">Select All</span>
                </div>
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="p-3 bg-white border border-gray-200 rounded-md flex justify-between items-center hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(participant.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds([...selectedIds, participant.id]);
                          } else {
                            setSelectedIds(selectedIds.filter((id) => id !== participant.id));
                          }
                        }}
                      />
                      <div>
                        <p className="font-medium">{participant.name}</p>
                        <p className="text-sm text-gray-500">{participant.church}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-500">{participant.type}</span>
                      <button
                        onClick={() => handleDelete(participant)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">No participants found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
};

export default ManageParticipants;
