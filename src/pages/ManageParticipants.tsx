import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, RefreshCw, Trash2 } from 'lucide-react';
import AuthGuard from '../components/AuthGuard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/ui/Modal';
import {
  getEvents,
  getParticipantsByEvent,
  createParticipant,
  deleteParticipantWithLogs,
  generateDeterministicQrCode,
} from '../utils/firebase';
import { generateQRCodePDF } from '../utils/qrcode';
import { Event, Participant } from '../types';
import { doc, updateDoc, getFirestore } from 'firebase/firestore';

  const ManageParticipants: React.FC = () => {
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingQrCodes, setGeneratingQrCodes] = useState(false);
  const [name, setName] = useState('');
  const [church, setChurch] = useState('');
  const [type, setType] = useState<'student' | 'leader'>('student');
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmText, setConfirmText] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editParticipant, setEditParticipant] = useState<Participant | null>(null);
  const [editType, setEditType] = useState<'student' | 'leader'>('student');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [assignedLeaders, setAssignedLeaders] = useState<string[]>([]);
  const [editLeaders, setEditLeaders] = useState<string[]>([]);
  const leaderNames = Array.from(
    new Set(participants.filter(p => p.type === 'leader').map(p => p.name))
  );
  
  const TagInput: React.FC<{
    tags: string[];
    setTags: (tags: string[]) => void;
    suggestions: string[];
    placeholder?: string;
  }> = ({ tags, setTags, suggestions, placeholder }) => {
    const [input, setInput] = useState('');
    const [filtered, setFiltered] = useState<string[]>([]);
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

    useEffect(() => {
      const f = suggestions
        .filter(s => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s));
      setFiltered(input ? f : []);
      setHighlightedIndex(-1);
    }, [input, suggestions, tags]);

    const addTag = (tagToAdd?: string) => {
      const tag = (tagToAdd ?? input).trim();
      if (tag && !tags.includes(tag)) {
        setTags([...tags, tag]);
      }
      setInput('');
      setHighlightedIndex(-1); // Optional safety
    };

    return (
      <div className="relative border p-2 rounded w-full bg-white">
        <div className="flex flex-wrap gap-2 mb-1">
          {tags.map((tag, idx) => (
            <span key={idx} className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded flex items-center">
              {tag}
              <button
                type="button"
                className="ml-1 text-xs text-red-600 hover:text-red-800"
                onClick={() => setTags(tags.filter((t) => t !== tag))}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlightedIndex((prev) =>
                prev < filtered.length - 1 ? prev + 1 : 0
              );
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlightedIndex((prev) =>
                prev > 0 ? prev - 1 : filtered.length - 1
              );
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
                addTag(filtered[highlightedIndex]);
              } else {
                addTag(); // use input as fallback
              }
            } else if (e.key === ',') {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder}
          className="w-full outline-none"
        />
        {filtered.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white border rounded shadow">
            {filtered.map((s, i) => (
              <div
                key={i}
                className={`p-2 cursor-pointer text-sm ${
                  i === highlightedIndex ? 'bg-blue-100' : 'hover:bg-gray-100'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(s);
                }}
              >
                {s}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

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

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(null), 3000);
  };

  const openConfirmModal = (text: string, onConfirm: () => void) => {
    setConfirmText(text);
    setConfirmAction(() => onConfirm);
    setModalOpen(true);
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

  const handleDelete = (participant: Participant) => {
    openConfirmModal(
      `Are you sure you want to delete ${participant.name}? This will also delete their activity logs.`,
      async () => {
        try {
          await deleteParticipantWithLogs(participant.eventId, participant.id);
          const updatedList = await getParticipantsByEvent(participant.eventId);
          setParticipants(updatedList);
          showMessage('Participant and logs deleted successfully', 'success');
        } catch (error) {
          console.error('Error deleting participant and logs:', error);
          showMessage('Error deleting participant', 'error');
        }
        setModalOpen(false);
      }
    );
  };

  const handleBulkAction = () => {
    if (bulkAction === 'delete') {
      const count = selectedIds.length;
      if (count === 0 || !activeEvent) return;

      openConfirmModal(
        `Are you sure you want to delete ${count} participant${count > 1 ? 's' : ''}? This will also delete their activity logs.`,
        async () => {
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
          setModalOpen(false);
        }
      );
    }
  };

  const openEditModal = (p: Participant) => {
    setEditParticipant(p);
    setEditType(p.type);
    setEditLeaders(p.assignedLeaders || []);
    setEditModalOpen(true);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <AuthGuard requiredRole="admin">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Manage Participants</h1>
        {message && (
          <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 shadow-lg text-sm px-4 py-2 rounded-md border transition-opacity duration-300 ${
            messageType === 'success'
              ? 'bg-green-50 text-green-800 border-green-300'
              : 'bg-red-50 text-red-800 border-red-300'
          }`}>
            {message}
          </div>
        )}

        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Please Confirm">
          <p>{confirmText}</p>
          <div className="mt-4 flex space-x-3">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmAction}>Confirm</Button>
          </div>
        </Modal>

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
            <p className="text-sm text-gray-600 mb-4">
              Add a new participant directly using the simple form by clicking the button below.
            </p>
            <Button onClick={() => setAddModalOpen(true)}>Add Participant</Button>
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
          <CardHeader className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={participants.length > 0 && selectedIds.length === participants.length}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedIds(participants.map((p) => p.id));
                } else {
                  setSelectedIds([]);
                }
              }}
              className="h-4 w-4"
            />
            <CardTitle>All Participants</CardTitle>
          </CardHeader>

          <CardContent>
            {participants.length > 0 ? (
              <div className="space-y-2">
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
                      <Button variant="outline" size="sm" onClick={() => openEditModal(participant)}>Edit</Button>
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
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Participant">
        <div className="space-y-4">
          <input
            disabled
            value={editParticipant?.name || ''}
            className="w-full border p-2 bg-gray-100 rounded mt-4"
          />
          <input
            disabled
            value={editParticipant?.church || ''}
            className="w-full border p-2 bg-gray-100 rounded"
          />
          <select
            value={editType}
            onChange={(e) => setEditType(e.target.value as 'student' | 'leader')}
            className="w-full border p-2 rounded"
          >
            <option value="student">Student</option>
            <option value="leader">Leader</option>
          </select>
          <TagInput
            tags={editLeaders}
            setTags={setEditLeaders}
            suggestions={leaderNames}
            placeholder="Type name and press Enter"
          />
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!editParticipant || !activeEvent) return;
                try {
                  const ref = doc(getFirestore(), 'events', activeEvent.id, 'participants', editParticipant.id);
                  await updateDoc(ref, {
                    type: editType,
                    assignedLeaders: editLeaders,
                  });
                  const updatedList = await getParticipantsByEvent(activeEvent.id);
                  setParticipants(updatedList);
                  setEditModalOpen(false);
                  showMessage('Participant updated.', 'success');
                } catch (err) {
                  console.error(err);
                  showMessage('Failed to update participant.', 'error');
                }
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Participant">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!activeEvent || !name || !church || !type) return;

            const qrCode = generateDeterministicQrCode(activeEvent.id, name, church);
            const refreshedList = await getParticipantsByEvent(activeEvent.id);
            if (refreshedList.some(p => p.qrCode === qrCode)) {
              showMessage('Participant already exists for this event.', 'error');
              return;
            }

            try {
              const newParticipant = {
                eventId: activeEvent.id,
                name,
                church,
                type,
                assignedLeaders: assignedLeaders,
                qrCode,
              };
              await createParticipant(newParticipant);
              const updatedList = await getParticipantsByEvent(activeEvent.id);
              setParticipants(updatedList);
              setName('');
              setChurch('');
              setType('student');
              setAssignedLeaders('');
              setAddModalOpen(false);
              showMessage('Participant added successfully!', 'success');
            } catch (err) {
              console.error('Error adding participant:', err);
              showMessage('Could not add participant.', 'error');
            }
          }}
          className="space-y-4"
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full border p-2 rounded mt-4"
            required
          />
          <input
            type="text"
            value={church}
            onChange={(e) => setChurch(e.target.value)}
            placeholder="Church"
            className="w-full border p-2 rounded"
            required
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'student' | 'leader')}
            className="w-full border p-2 rounded"
          >
            <option value="student">Student</option>
            <option value="leader">Leader</option>
          </select>
          <TagInput
            tags={assignedLeaders}
            setTags={setAssignedLeaders}
            suggestions={leaderNames}
            placeholder="Type name and press Enter"
          />
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </AuthGuard>
  );
};

export default ManageParticipants;
