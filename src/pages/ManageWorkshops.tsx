import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import AuthGuard from '../components/AuthGuard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  clearWorkshopRegistrations,
  createWorkshop,
  deleteWorkshop,
  getEventById,
  setWorkshopDateLockForEvent,
  subscribeToWorkshopsByEvent,
  updateWorkshop,
} from '../utils/firebase';
import { Event, Workshop } from '../types';
import { CURRENT_DATE_REFERENCE, formatDate, formatDateKey } from '../utils/helpers';

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ManageWorkshops: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableTo, setAvailableTo] = useState('');
  const [maxRegistrationsPerDay, setMaxRegistrationsPerDay] = useState('1');
  const [editWorkshop, setEditWorkshop] = useState<Workshop | null>(null);
  const [editName, setEditName] = useState('');
  const [editAvailableFrom, setEditAvailableFrom] = useState('');
  const [editAvailableTo, setEditAvailableTo] = useState('');
  const [editMaxRegistrationsPerDay, setEditMaxRegistrationsPerDay] = useState('1');
  const [editActive, setEditActive] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmText, setConfirmText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const todayKey = formatDateKey(CURRENT_DATE_REFERENCE);
  const isDateSelectionLocked = workshops.length > 0 && workshops.every((workshop) => workshop.lockRegistrationDateToToday);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const load = async () => {
      setLoading(true);
      try {
        if (!eventId) {
          setActiveEvent(null);
          return;
        }

        const event = await getEventById(eventId);
        if (!event.active) {
          setActiveEvent(null);
          return;
        }

        setActiveEvent(event);

        unsubscribe = subscribeToWorkshopsByEvent(event.id, (liveWorkshops) => {
            const sorted = [...liveWorkshops].sort((a, b) => a.name.localeCompare(b.name));
            setWorkshops(sorted);
        });
      } catch (error) {
        console.error('Error loading workshops:', error);
        showMessage('Failed to load workshops.', 'error');
      } finally {
        setLoading(false);
      }
    };

    load();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [eventId]);

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(null), 3000);
  };

  const resetCreateForm = () => {
    setName('');
    setAvailableFrom('');
    setAvailableTo('');
    setMaxRegistrationsPerDay('1');
  };

  const openConfirmModal = (text: string, onConfirm: () => void) => {
    setConfirmText(text);
    setConfirmAction(() => onConfirm);
    setModalOpen(true);
  };

  const openEditModal = (workshop: Workshop) => {
    setEditWorkshop(workshop);
    setEditName(workshop.name);
    setEditAvailableFrom(toDateInputValue(workshop.availableFrom));
    setEditAvailableTo(toDateInputValue(workshop.availableTo));
    setEditMaxRegistrationsPerDay(String(workshop.maxRegistrationsPerDay));
    setEditActive(workshop.active);
  };

  const handleAdd = async () => {
    if (!activeEvent || !name || !availableFrom || !availableTo) {
      return;
    }

    const fromDate = new Date(`${availableFrom}T00:00:00`);
    const toDate = new Date(`${availableTo}T00:00:00`);

    if (fromDate.getTime() > toDate.getTime()) {
      showMessage('The start date must be before or equal to the end date.', 'error');
      return;
    }

    if (workshops.some((workshop) => workshop.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      showMessage('A workshop with that name already exists.', 'error');
      return;
    }

    try {
      await createWorkshop(activeEvent.id, {
        name: name.trim(),
        availableFrom: fromDate,
        availableTo: toDate,
        maxRegistrationsPerDay: Number(maxRegistrationsPerDay),
        lockRegistrationDateToToday: isDateSelectionLocked,
        active: true,
      });
      resetCreateForm();
      showMessage('Workshop created!', 'success');
    } catch (error) {
      console.error('Error creating workshop:', error);
      showMessage('Failed to create workshop.', 'error');
    }
  };

  const handleDelete = (workshop: Workshop) => {
    if (!activeEvent) {
      return;
    }

    openConfirmModal(
      `Are you sure you want to delete ${workshop.name}? Its registrations and daily counts will also be deleted.`,
      async () => {
        try {
          await deleteWorkshop(activeEvent.id, workshop.id);
          showMessage('Workshop deleted.', 'success');
        } catch (error) {
          console.error('Error deleting workshop:', error);
          showMessage('Failed to delete workshop.', 'error');
        }
        setModalOpen(false);
      }
    );
  };

  const handleBulkAction = () => {
    if (!activeEvent || bulkAction !== 'delete' || selectedIds.length === 0) {
      return;
    }

    openConfirmModal(
      `Are you sure you want to delete ${selectedIds.length} selected workshop${selectedIds.length > 1 ? 's' : ''}? Their registrations and daily counts will also be deleted.`,
      async () => {
        try {
          for (const workshopId of selectedIds) {
            await deleteWorkshop(activeEvent.id, workshopId);
          }
          setSelectedIds([]);
          setBulkAction('');
          showMessage('Selected workshops deleted.', 'success');
        } catch (error) {
          console.error('Error deleting workshops:', error);
          showMessage('Failed to delete some workshops.', 'error');
        }
        setModalOpen(false);
      }
    );
  };

  const handleClearRegistrations = () => {
    if (!activeEvent) {
      return;
    }

    openConfirmModal(
      'Are you sure you want to delete all workshop registrations for the active event? This is intended for test cleanup.',
      async () => {
        try {
          await clearWorkshopRegistrations(activeEvent.id);
          showMessage('All workshop registrations were deleted.', 'success');
        } catch (error) {
          console.error('Error clearing workshop registrations:', error);
          showMessage('Failed to clear workshop registrations.', 'error');
        }
        setModalOpen(false);
      }
    );
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <AuthGuard requiredRole="admin">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Manage Workshops</h1>

        {message && (
          <div className={`fixed top-6 left-1/2 z-50 -translate-x-1/2 rounded-md border px-4 py-2 text-sm shadow-lg transition-opacity duration-300 ${
            messageType === 'success'
              ? 'border-green-300 bg-green-50 text-green-800'
              : 'border-red-300 bg-red-50 text-red-800'
          }`}>
            {message}
          </div>
        )}

        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Confirm">
          <p>{confirmText}</p>
          <div className="mt-4 flex space-x-3">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={confirmAction}>Confirm</Button>
          </div>
        </Modal>

        <Modal isOpen={!!editWorkshop} onClose={() => setEditWorkshop(null)} title="Edit Workshop">
          <div className="space-y-4">
            <input
              type="text"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              className="mt-4 w-full rounded border p-2"
              placeholder="Workshop name"
            />
            <input
              type="date"
              value={editAvailableFrom}
              onChange={(event) => setEditAvailableFrom(event.target.value)}
              className="w-full rounded border p-2"
              min={todayKey}
            />
            <input
              type="date"
              value={editAvailableTo}
              onChange={(event) => setEditAvailableTo(event.target.value)}
              className="w-full rounded border p-2"
              min={editAvailableFrom || todayKey}
            />
            <label className="block text-sm font-medium text-gray-700">Daily registration limit</label>
            <input
              type="number"
              min="1"
              value={editMaxRegistrationsPerDay}
              onChange={(event) => setEditMaxRegistrationsPerDay(event.target.value)}
              className="w-full rounded border p-2"
              placeholder="Max registrations per day"
            />
            <label className="flex items-center space-x-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={editActive}
                onChange={(event) => setEditActive(event.target.checked)}
              />
              <span>Workshop is active</span>
            </label>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setEditWorkshop(null)}>Cancel</Button>
              <Button
                onClick={async () => {
                  if (!activeEvent || !editWorkshop || !editName || !editAvailableFrom || !editAvailableTo) {
                    return;
                  }

                  const fromDate = new Date(`${editAvailableFrom}T00:00:00`);
                  const toDate = new Date(`${editAvailableTo}T00:00:00`);

                  if (fromDate.getTime() > toDate.getTime()) {
                    showMessage('The start date must be before or equal to the end date.', 'error');
                    return;
                  }

                  try {
                    await updateWorkshop(activeEvent.id, editWorkshop.id, {
                      name: editName.trim(),
                      availableFrom: fromDate,
                      availableTo: toDate,
                      maxRegistrationsPerDay: Number(editMaxRegistrationsPerDay),
                      active: editActive,
                    });
                    setEditWorkshop(null);
                    showMessage('Workshop updated.', 'success');
                  } catch (error) {
                    console.error('Error updating workshop:', error);
                    showMessage('Failed to update workshop.', 'error');
                  }
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </Modal>

        {!activeEvent ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600">No active event is available right now.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Registration Date Mode</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600">
                  Current mode: <span className="font-medium">{isDateSelectionLocked ? 'Locked to current date' : 'Date can be selected manually'}</span>
                </p>
                <Button
                  variant={isDateSelectionLocked ? 'outline' : 'secondary'}
                  disabled={workshops.length === 0}
                  onClick={async () => {
                    if (!activeEvent || workshops.length === 0) {
                      return;
                    }

                    try {
                      await setWorkshopDateLockForEvent(activeEvent.id, !isDateSelectionLocked);
                      showMessage(
                        isDateSelectionLocked
                          ? 'Workshop registration date can now be selected manually.'
                          : 'Workshop registration date is now locked to the current date.',
                        'success'
                      );
                    } catch (error) {
                      console.error('Error updating workshop date mode:', error);
                      showMessage('Failed to update the registration date mode.', 'error');
                    }
                  }}
                >
                  {isDateSelectionLocked ? 'Allow Manual Date Selection' : 'Lock Registration to Current Date'}
                </Button>
                {workshops.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Create at least one workshop before changing the registration date mode.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Add Workshop</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Workshop name"
                  className="w-full rounded border p-2"
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Available from</label>
                    <input
                      type="date"
                      value={availableFrom}
                      onChange={(event) => setAvailableFrom(event.target.value)}
                      className="w-full rounded border p-2"
                      min={todayKey}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Available to</label>
                    <input
                      type="date"
                      value={availableTo}
                      onChange={(event) => setAvailableTo(event.target.value)}
                      className="w-full rounded border p-2"
                      min={availableFrom || todayKey}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Daily registration limit</label>
                  <input
                    type="number"
                    min="1"
                    value={maxRegistrationsPerDay}
                    onChange={(event) => setMaxRegistrationsPerDay(event.target.value)}
                    placeholder="Max registrations per day"
                    className="w-full rounded border p-2"
                  />
                </div>
                <Button onClick={handleAdd}>Add Workshop</Button>
              </CardContent>
            </Card>

            <div className="flex items-center space-x-3">
              <select
                value={bulkAction}
                onChange={(event) => setBulkAction(event.target.value)}
                className="rounded-md border border-gray-300 p-2 text-sm"
              >
                <option value="">Bulk Actions</option>
                <option value="delete">Delete Selected</option>
              </select>
              <Button
                variant="danger"
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
                  checked={workshops.length > 0 && selectedIds.length === workshops.length}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setSelectedIds(workshops.map((workshop) => workshop.id));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                  className="h-4 w-4"
                />
                <CardTitle>All Workshops</CardTitle>
              </CardHeader>
              <CardContent>
                {workshops.length > 0 ? (
                  <div className="space-y-2">
                    {workshops.map((workshop) => (
                      <div
                        key={workshop.id}
                        className="flex items-center justify-between rounded-md border border-gray-200 bg-white p-3 hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(workshop.id)}
                            onChange={(event) => {
                              if (event.target.checked) {
                                setSelectedIds([...selectedIds, workshop.id]);
                              } else {
                                setSelectedIds(selectedIds.filter((id) => id !== workshop.id));
                              }
                            }}
                          />
                          <div>
                            <p className="font-medium">{workshop.name}</p>
                            <p className="text-sm text-gray-500">
                              {formatDate(workshop.availableFrom)} - {formatDate(workshop.availableTo)}
                            </p>
                            <p className="text-sm text-gray-500">
                              Max per day: {workshop.maxRegistrationsPerDay} | Status: {workshop.active ? 'Active' : 'Inactive'} | Date mode: {workshop.lockRegistrationDateToToday ? 'Current date only' : 'Manual'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <Button variant="outline" size="sm" onClick={() => openEditModal(workshop)}>Edit</Button>
                          <button onClick={() => handleDelete(workshop)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">No workshops found.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Workshop Registration Cleanup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600">
                  Delete all workshop registrations for <span className="font-medium">{activeEvent.name}</span> to reset testing data.
                </p>
                <Button variant="danger" onClick={handleClearRegistrations}>
                  Delete All Workshop Registrations
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AuthGuard>
  );
};

export default ManageWorkshops;
