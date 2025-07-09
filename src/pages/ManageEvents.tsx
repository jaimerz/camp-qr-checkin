import React, { useEffect, useState } from 'react';
import { Event, User } from '../types';
import {
  getEvents,
  createEvent,
  deleteEventWithCascade,
  setActiveEvent,
} from '../utils/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import AuthGuard from '../components/AuthGuard';
import { Trash2 } from 'lucide-react';
import { doc, updateDoc, getFirestore } from 'firebase/firestore';
import { useUser } from '../context/UserContext';

const ManageEvents: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [confirmInput, setConfirmInput] = useState('');
  const [targetEventName, setTargetEventName] = useState('');
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const { user } = useUser();

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(null), 3000);
  };

  const fetchEvents = async () => {
    const all = await getEvents();
    setEvents(all);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const generateEventId = (name: string) => {
    return name
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
  };

  const handleCreate = async () => {
    if (!name || !startDate || !endDate || !user) {
      showMessage('Please complete all required fields.', 'error');
      return;
    }
    const eventId = generateEventId(name);
    if (events.find(e => e.id === eventId)) {
      showMessage('An event with that name already exists.', 'error');
      return;
    }
    const newEvent = {
      id: eventId,
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      description,
      createdAt: new Date(),
      createdBy: user.id,
      active: events.length === 0,
    };
    try {
      await createEvent(newEvent);
      setName(''); setDescription(''); setStartDate(''); setEndDate('');
      fetchEvents();
      showMessage('Event created successfully!', 'success');
    } catch (err) {
      console.error('Failed to create event:', err);
      showMessage('Failed to create event.', 'error');
    }
  };

  const openDeleteModal = (event: Event) => {
    setTargetEventName(event.name);
    setConfirmText(`Type "I want to delete ${event.name}" to confirm deletion. This will erase ALL participants, activities, and logs linked to this event.`);
    setConfirmInput('');
    setModalOpen(true);
  };

  const activateEvent = async (eventId: string) => {
    await setActiveEvent(eventId);
    fetchEvents();
    showMessage('Active event updated.', 'success');
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <AuthGuard requiredRole="admin">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Manage Events</h1>

        {message && (
          <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 shadow-lg text-sm px-4 py-2 rounded-md border transition-opacity duration-300 ${
            messageType === 'success' ? 'bg-green-50 text-green-800 border-green-300' : 'bg-red-50 text-red-800 border-red-300'
          }`}>
            {message}
          </div>
        )}

        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Confirm Deletion">
          <p>{confirmText}</p>
          <input type="text" value={confirmInput} onChange={(e) => setConfirmInput(e.target.value)} className="mt-3 w-full border border-gray-300 rounded-md p-2" />
          <div className="mt-4 flex space-x-3">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => {
              if (confirmInput !== `I want to delete ${targetEventName}`) {
                showMessage('Confirmation text does not match.', 'error'); return;
              }
              try {
                const target = events.find(e => e.name === targetEventName);
                if (!target) throw new Error('Target event not found');
                await deleteEventWithCascade(target.id);
                showMessage('Event deleted.', 'success');
                fetchEvents();
              } catch (err) {
                console.error(err);
                showMessage('Failed to delete event.', 'error');
              } finally {
                setModalOpen(false); setConfirmInput('');
              }
            }}>Delete Event</Button>
          </div>
        </Modal>

        <Modal isOpen={!!editEvent} onClose={() => setEditEvent(null)} title="Edit Event">
          <div className="space-y-4">
            <input value={editEvent?.name || ''} disabled className="w-full border p-2 bg-gray-100 rounded mt-4" />
            <input
              type="text"
              placeholder="Description"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full border p-2 rounded"
            />
            <input
              type="date"
              min={today}
              value={editStart}
              onChange={(e) => setEditStart(e.target.value)}
              className="w-full border p-2 rounded"
            />
            <input
              type="date"
              min={editStart ? new Date(new Date(editStart).getTime() + 86400000).toISOString().split('T')[0] : ''}
              value={editEnd}
              onChange={(e) => setEditEnd(e.target.value)}
              className="w-full border p-2 rounded"
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setEditEvent(null)}>Cancel</Button>
              <Button onClick={async () => {
                if (!editEvent) return;
                try {
                  await updateDoc(doc(getFirestore(), 'events', editEvent.id), {
                    startDate: new Date(editStart),
                    endDate: new Date(editEnd),
                    description: editDesc,
                  });
                  showMessage('Event updated.', 'success');
                  setEditEvent(null);
                  fetchEvents();
                } catch (err) {
                  console.error(err);
                  showMessage('Update failed.', 'error');
                }
              }}>Save</Button>
            </div>
          </div>
        </Modal>

        {/* Create new event */}
        <Card>
          <CardHeader><CardTitle>Create New Event</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <input type="text" placeholder="Event name" value={name} onChange={(e) => setName(e.target.value)} className="w-full border p-2 rounded" />
            <input type="text" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border p-2 rounded" />
            <input type="date" min={today} value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border p-2 rounded" />
            <input type="date" min={startDate ? new Date(new Date(startDate).getTime() + 86400000).toISOString().split('T')[0] : ''} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border p-2 rounded" />
            <Button onClick={handleCreate}>Create Event</Button>
          </CardContent>
        </Card>

        {/* Existing events */}
        <Card>
          <CardHeader><CardTitle>Existing Events</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {events.map(event => (
              <div key={event.id} className="p-3 border rounded flex justify-between items-center">
                <div>
                  <p className="font-medium">{event.name}</p>
                  <p className="text-sm text-gray-500">{new Date(event.startDate).toLocaleDateString()} – {new Date(event.endDate).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" onClick={() => {
                    setEditEvent(event);
                    setEditStart(new Date(event.startDate).toISOString().split('T')[0]);
                    setEditEnd(new Date(event.endDate).toISOString().split('T')[0]);
                    setEditDesc(event.description || '');
                  }}>Edit</Button>
                  <Button variant={event.active ? 'default' : 'outline'} onClick={() => activateEvent(event.id)}>
                    {event.active ? 'Active' : 'Set Active'}
                  </Button>
                  <Button variant="destructive" onClick={() => openDeleteModal(event)} className="p-2" aria-label="Delete">
                    <Trash2 className="h-5 w-5 text-red-500 hover:text-red-700" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
};

export default ManageEvents;
