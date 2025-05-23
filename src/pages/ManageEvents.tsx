import React, { useEffect, useState } from 'react';
import { Event } from '../types';
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
import { getCurrentUser } from '../utils/firebase'; // Add this if not already
import { User } from '../types'; // Assuming you have this

const ManageEvents: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmInput, setConfirmInput] = useState('');
  const [targetEventName, setTargetEventName] = useState('');
  const [description, setDescription] = useState('');
  const [user, setUser] = useState<User | null>(null);

  const fetchEvents = async () => {
    const all = await getEvents();
    setEvents(all);
  };

  useEffect(() => {
    const fetchData = async () => {
        const currentUser = await getCurrentUser();
        setUser(currentUser?.userData || null);

        const all = await getEvents();
        setEvents(all);
    };

    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!name || !startDate || !endDate || !description || !user) return;

    const hasEvents = events.length > 0;
    const newEvent = {
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      description,
      createdAt: new Date(),
      createdBy: user.id,
      active: !hasEvents, // true if no events yet
    };

    await createEvent(newEvent);

    // Reset form
    setName('');
    setDescription('');
    setStartDate('');
    setEndDate('');

    fetchEvents();
  };

  const openDeleteModal = (event: Event) => {
    setTargetEventName(event.name);
    setConfirmText(`Type "I want to delete ${event.name}" to confirm deletion. This will erase ALL participants, activities, and logs linked to this event.`);
    setConfirmAction(() => async () => {
      if (confirmInput !== `I want to delete ${event.name}`) return;
      await deleteEventWithCascade(event.id);
      setModalOpen(false);
      setConfirmInput('');
      fetchEvents();
    });
    setModalOpen(true);
  };

  const activateEvent = async (eventId: string) => {
    await setActiveEvent(eventId); // You’ll update others to inactive in this function
    fetchEvents();
  };

  return (
    <AuthGuard requiredRole="admin">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Manage Events</h1>

        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Confirm Deletion">
          <p>{confirmText}</p>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            className="mt-3 w-full border border-gray-300 rounded-md p-2"
          />
          <div className="mt-4 flex space-x-3">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmAction}>Delete Event</Button>
          </div>
        </Modal>

        {/* Create new event */}
        <Card>
          <CardHeader>
            <CardTitle>Create New Event</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input type="text" placeholder="Event name" value={name} onChange={(e) => setName(e.target.value)} className="w-full border p-2 rounded" />
            <input
              type="text"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border p-2 rounded"
            />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border p-2 rounded" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border p-2 rounded" />            
            <Button onClick={handleCreate}>Create Event</Button>
          </CardContent>
        </Card>

        {/* Existing events */}
        <Card>
          <CardHeader>
            <CardTitle>Existing Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {events.map(event => (
              <div key={event.id} className="p-3 border rounded flex justify-between items-center">
                <div>
                  <p className="font-medium">{event.name}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(event.startDate).toLocaleDateString()} – {new Date(event.endDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant={event.active ? 'default' : 'outline'} onClick={() => activateEvent(event.id)}>
                    {event.active ? 'Active' : 'Set Active'}
                  </Button>
                  <Button variant="destructive" onClick={() => openDeleteModal(event)}>Delete</Button>
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
