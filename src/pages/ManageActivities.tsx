import React, { useEffect, useState } from 'react';
import { Activity, Event } from '../types';
import {
  getActivitiesByEvent,
  createActivity,
  deleteActivity,
  updateActivity,
  getEvents,
} from '../utils/firebase';
import { Trash2 } from 'lucide-react';
import AuthGuard from '../components/AuthGuard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

const ManageActivities: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [editActivity, setEditActivity] = useState<Activity | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmText, setConfirmText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    const loadData = async () => {
      const events = await getEvents();
      const current = events.find((e) => e.active);
      setActiveEvent(current);
      if (current) {
        const data = await getActivitiesByEvent(current.id);
        setActivities(data);
      }
    };
    loadData();
  }, []);

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAdd = async () => {
    if (!name || !location || !activeEvent) return;
    try {
      await createActivity({ eventId: activeEvent.id, name, description, location });
      const updated = await getActivitiesByEvent(activeEvent.id);
      setActivities(updated);
      setName('');
      setDescription('');
      setLocation('');
      showMessage('Activity created!', 'success');
    } catch (err: any) {
      console.error(err);
      const msg = err.message?.includes('already exists') ? err.message : 'Failed to create activity';
      showMessage(msg, 'error');
    }
  };

  const openEditModal = (activity: Activity) => {
    setEditActivity(activity);
    setEditName(activity.name);
    setEditDescription(activity.description);
    setEditLocation(activity.location);
  };

  const openConfirmModal = (text: string, onConfirm: () => void) => {
    setConfirmText(text);
    setConfirmAction(() => onConfirm);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    openConfirmModal(
      'Are you sure you want to delete this activity? All participant records (logs) linked to it will also be permanently deleted.',
      async () => {
        if (!activeEvent) return;
        await deleteActivity(activeEvent.id, id);
        const updated = await getActivitiesByEvent(activeEvent.id);
        setActivities(updated);
        showMessage('Activity deleted.', 'success');
        setModalOpen(false);
    });
  };

  const handleBulkAction = () => {
    if (bulkAction === 'delete' && selectedIds.length && activeEvent) {
      openConfirmModal(
        `Are you sure you want to delete ${selectedIds.length} selected activities? This will also delete all logs linked to these activities.`,
        async () => {
          for (const id of selectedIds) {
            await deleteActivity(activeEvent.id, id);
          }
          const updated = await getActivitiesByEvent(activeEvent.id);
          setActivities(updated);
          setSelectedIds([]);
          setBulkAction('');
          showMessage('Activities deleted.', 'success');
          setModalOpen(false);
      });
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setBulkAction('');
  };

  return (
    <AuthGuard requiredRole="admin">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Manage Activities</h1>

        {message && (
          <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 shadow-lg text-sm px-4 py-2 rounded-md border transition-opacity duration-300 ${
            messageType === 'success'
              ? 'bg-green-50 text-green-800 border-green-300'
              : 'bg-red-50 text-red-800 border-red-300'
          }`}>
            {message}
          </div>
        )}

        <Modal isOpen={modalOpen} onClose={handleModalClose} title="Confirm">
          <p>{confirmText}</p>
          <div className="mt-4 flex space-x-3">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmAction}>Confirm</Button>
          </div>
        </Modal>

        <Modal isOpen={!!editActivity} onClose={() => setEditActivity(null)} title="Edit Activity">
          <div className="space-y-4">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full border p-2 rounded mt-4"
              placeholder="Activity name"
            />
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full border p-2 rounded"
            />
            <input
              type="text"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              className="w-full border p-2 rounded"
              placeholder="Location"
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setEditActivity(null)}>Cancel</Button>
              <Button onClick={async () => {
                if (!activeEvent || !editActivity) return;
                await updateActivity(editActivity.id, {
                  name: editName,
                  location: editLocation,
                  description: editDescription,
                });
                const updated = await getActivitiesByEvent(activeEvent.id);
                setActivities(updated);
                setEditActivity(null);
                showMessage('Activity updated.', 'success');
              }}>
                Save
              </Button>
            </div>
          </div>
        </Modal>

        <Card>
          <CardHeader><CardTitle>Add Activity</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Activity name"
              className="w-full border p-2 rounded"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              className="w-full border p-2 rounded"
            />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
              className="w-full border p-2 rounded"
            />
            <Button onClick={handleAdd}>Add Activity</Button>
          </CardContent>
        </Card>

        <div className="flex items-center space-x-3 mt-4">
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
              checked={activities.length > 0 && selectedIds.length === activities.length}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedIds(activities.map((a) => a.id));
                } else {
                  setSelectedIds([]);
                }
              }}
              className="h-4 w-4"
            />
            <CardTitle>All Activities</CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length > 0 ? (
              <div className="space-y-2">
                {activities.map((activity) => (
                  <div key={activity.id} className="p-3 bg-white border border-gray-200 rounded-md flex justify-between items-center hover:bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(activity.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds([...selectedIds, activity.id]);
                          } else {
                            setSelectedIds(selectedIds.filter((id) => id !== activity.id));
                          }
                        }}
                      />
                      <div>
                        <p className="font-medium">{activity.name}</p>
                        <p className="text-sm text-gray-500">{activity.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Button variant="outline" size="sm" onClick={() => openEditModal(activity)}>Edit</Button>
                      <button onClick={() => handleDelete(activity.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">No activities found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
};

export default ManageActivities;
