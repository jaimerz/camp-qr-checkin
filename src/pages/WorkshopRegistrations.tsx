import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useParams } from 'react-router-dom';
import AuthGuard from '../components/AuthGuard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import Tabs from '../components/ui/Tabs';
import {
  deregisterParticipantFromWorkshop,
  getEventById,
  getParticipantsByEvent,
  getWorkshopDailyCountsByDate,
  getWorkshopRegistrationsByDate,
  registerParticipantForWorkshop,
  subscribeToWorkshopDailyCountsByDate,
  subscribeToWorkshopRegistrationsByDate,
  subscribeToWorkshopsByEvent,
} from '../utils/firebase';
import { Event, Participant, Workshop, WorkshopDailyCount, WorkshopRegistration } from '../types';
import {
  CURRENT_DATE_REFERENCE,
  formatDate,
  getUpcomingWorkshopDateKeys,
  isDateWithinRange,
  parseDateKey,
} from '../utils/helpers';
import { useUser } from '../context/UserContext';

const WorkshopRegistrations: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useUser();
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [registrations, setRegistrations] = useState<WorkshopRegistration[]>([]);
  const [counts, setCounts] = useState<WorkshopDailyCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDateKey, setSelectedDateKey] = useState('');
  const [selectedParticipantId, setSelectedParticipantId] = useState('');
  const [participantQuery, setParticipantQuery] = useState('');
  const [showParticipantSuggestions, setShowParticipantSuggestions] = useState(false);
  const [activeTabId, setActiveTabId] = useState('register');
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [refreshing, setRefreshing] = useState(false);
  const [submittingWorkshopId, setSubmittingWorkshopId] = useState<string | null>(null);
  const [deregisteringId, setDeregisteringId] = useState<string | null>(null);
  const [registrationSearchQuery, setRegistrationSearchQuery] = useState('');
  const setupMessageCount = Number(Boolean(selectedParticipant)) + Number(Boolean(selectedParticipantRegistration));

  useEffect(() => {
    let unsubscribeWorkshops: (() => void) | undefined;

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

        const participantData = await getParticipantsByEvent(event.id);
        participantData.sort((a, b) => a.name.localeCompare(b.name));
        setParticipants(participantData);

        unsubscribeWorkshops = subscribeToWorkshopsByEvent(event.id, (liveWorkshops) => {
          const sorted = [...liveWorkshops].sort((a, b) => a.name.localeCompare(b.name));
          setWorkshops(sorted);
        });
      } catch (error) {
        console.error('Error loading workshop registration page:', error);
        showMessage('Failed to load workshop registration data.', 'error');
      } finally {
        setLoading(false);
      }
    };

    load();

    return () => {
      if (unsubscribeWorkshops) {
        unsubscribeWorkshops();
      }
    };
  }, [eventId]);

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(null), 3500);
  };

  const dateOptions = getUpcomingWorkshopDateKeys(workshops, CURRENT_DATE_REFERENCE);

  useEffect(() => {
    if (!dateOptions.length) {
      setSelectedDateKey('');
      return;
    }

    if (!selectedDateKey || !dateOptions.includes(selectedDateKey)) {
      setSelectedDateKey(dateOptions[0]);
    }
  }, [dateOptions, selectedDateKey]);

  useEffect(() => {
    if (!activeEvent || !selectedDateKey) {
      setRegistrations([]);
      setCounts([]);
      return;
    }

    const unsubscribeRegistrations = subscribeToWorkshopRegistrationsByDate(
      activeEvent.id,
      selectedDateKey,
      (liveRegistrations) => {
        const sorted = [...liveRegistrations].sort((a, b) => a.participantName.localeCompare(b.participantName));
        setRegistrations(sorted);
      }
    );

    const unsubscribeCounts = subscribeToWorkshopDailyCountsByDate(activeEvent.id, selectedDateKey, (liveCounts) => {
      setCounts(liveCounts);
    });

    return () => {
      unsubscribeRegistrations();
      unsubscribeCounts();
    };
  }, [activeEvent, selectedDateKey]);

  const selectedParticipant = participants.find((participant) => participant.id === selectedParticipantId) || null;
  const selectedParticipantRegistration = registrations.find(
    (registration) => registration.participantId === selectedParticipantId
  ) || null;

  const filteredParticipants = participants.filter((participant) => {
    const query = participantQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return (
      participant.name.toLowerCase().includes(query) ||
      participant.church.toLowerCase().includes(query)
    );
  });

  const countMap = counts.reduce<Record<string, WorkshopDailyCount>>((accumulator, count) => {
    accumulator[count.workshopId] = count;
    return accumulator;
  }, {});

  const selectedDate = selectedDateKey ? parseDateKey(selectedDateKey) : null;
  const filteredRegistrations = registrations.filter((registration) => {
    const query = registrationSearchQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return (
      registration.participantName.toLowerCase().includes(query) ||
      registration.participantChurch.toLowerCase().includes(query) ||
      registration.workshopName.toLowerCase().includes(query)
    );
  });

  const refreshSelectedDate = async () => {
    if (!activeEvent || !selectedDateKey) {
      return;
    }

    setRefreshing(true);
    try {
      const [registrationData, countData] = await Promise.all([
        getWorkshopRegistrationsByDate(activeEvent.id, selectedDateKey),
        getWorkshopDailyCountsByDate(activeEvent.id, selectedDateKey),
      ]);

      registrationData.sort((a, b) => a.participantName.localeCompare(b.participantName));
      setRegistrations(registrationData);
      setCounts(countData);
      showMessage('Workshop registrations refreshed.', 'success');
    } catch (error) {
      console.error('Error refreshing workshop registrations:', error);
      showMessage('Failed to refresh workshop registrations.', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const tabs = [
    {
      id: 'register',
      label: 'Register',
      content: (
        <div className="space-y-6">
          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle>Registration Setup</CardTitle>
            </CardHeader>
            <CardContent className={`space-y-4 ${setupMessageCount > 0 ? 'pb-4' : 'pb-2'}`}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Workshop date</label>
                  <select
                    value={selectedDateKey}
                    onChange={(event) => setSelectedDateKey(event.target.value)}
                    className="w-full rounded border border-gray-300 p-2"
                    disabled={!dateOptions.length}
                  >
                    {dateOptions.length === 0 ? (
                      <option value="">No current or future workshop dates</option>
                    ) : (
                      dateOptions.map((dateKey) => (
                        <option key={dateKey} value={dateKey}>
                          {formatDate(parseDateKey(dateKey))}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Participant</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={participantQuery}
                      onChange={(event) => {
                        setParticipantQuery(event.target.value);
                        setShowParticipantSuggestions(true);
                        if (!event.target.value.trim()) {
                          setSelectedParticipantId('');
                        }
                      }}
                      onFocus={() => setShowParticipantSuggestions(true)}
                      onBlur={() => {
                        setTimeout(() => setShowParticipantSuggestions(false), 150);
                      }}
                      placeholder="Search participant by name or church"
                      className="w-full rounded border border-gray-300 p-2"
                    />
                    {showParticipantSuggestions && filteredParticipants.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded border border-gray-200 bg-white shadow-lg">
                        {filteredParticipants.slice(0, 20).map((participant) => (
                          <button
                            key={participant.id}
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              setSelectedParticipantId(participant.id);
                              setParticipantQuery(`${participant.name} (${participant.church})`);
                              setShowParticipantSuggestions(false);
                            }}
                          >
                            <span className="font-medium">{participant.name}</span>
                            <span className="ml-2 text-gray-500">{participant.church}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selectedParticipant && (
                <div className="rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
                  Selected participant: <span className="font-medium">{selectedParticipant.name}</span> from {selectedParticipant.church}
                </div>
              )}

              {selectedParticipantRegistration && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  This participant is already registered for <span className="font-medium">{selectedParticipantRegistration.workshopName}</span> on {selectedDate ? formatDate(selectedDate) : selectedDateKey}.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {workshops.map((workshop) => {
              const availableOnSelectedDate = selectedDate ? isDateWithinRange(selectedDate, workshop.availableFrom, workshop.availableTo) : false;
              const count = countMap[workshop.id]?.count || 0;
              const isFull = count >= workshop.maxRegistrationsPerDay;
              const disabledReason = !workshop.active
                ? 'Inactive'
                : !availableOnSelectedDate
                  ? 'Unavailable on this date'
                  : isFull
                    ? 'Full'
                    : '';
              const canRegister = Boolean(
                activeEvent &&
                selectedParticipant &&
                selectedDateKey &&
                workshop.active &&
                availableOnSelectedDate &&
                !isFull &&
                !selectedParticipantRegistration
              );

              return (
                <Card key={workshop.id}>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">
                      {workshop.name} ({count} / {workshop.maxRegistrationsPerDay})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {disabledReason && (
                      <p className="text-sm text-gray-500">{disabledReason}</p>
                    )}
                    <Button
                      fullWidth
                      disabled={!canRegister}
                      isLoading={submittingWorkshopId === workshop.id}
                      onClick={async () => {
                        if (!activeEvent || !selectedParticipant || !user || !selectedDateKey) {
                          return;
                        }

                        setSubmittingWorkshopId(workshop.id);
                        try {
                          await registerParticipantForWorkshop({
                            eventId: activeEvent.id,
                            workshopId: workshop.id,
                            participant: selectedParticipant,
                            registeredBy: user.id,
                            dateKey: selectedDateKey,
                          });
                          setSelectedParticipantId('');
                          setParticipantQuery('');
                          showMessage(`Registered ${selectedParticipant.name} for ${workshop.name}.`, 'success');
                        } catch (error) {
                          console.error('Error registering participant for workshop:', error);
                          showMessage(error instanceof Error ? error.message : 'Failed to register participant.', 'error');
                        } finally {
                          setSubmittingWorkshopId(null);
                        }
                      }}
                    >
                      Register
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ),
    },
    {
      id: 'registrations',
      label: 'Current Registrations',
      content: (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3">
                <CardTitle>
                  {selectedDate ? `Registrations for ${formatDate(selectedDate)}` : 'Registrations'}
                </CardTitle>
                <input
                  type="text"
                  value={registrationSearchQuery}
                  onChange={(event) => setRegistrationSearchQuery(event.target.value)}
                  placeholder="Search participant, church, or workshop"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm md:w-80"
                />
              </div>
              <Button variant="outline" onClick={refreshSelectedDate} isLoading={refreshing}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {filteredRegistrations.length > 0 ? (
                <div className="space-y-2">
                  {filteredRegistrations.map((registration) => (
                    <div
                      key={registration.id}
                      className="flex items-center justify-between rounded-md border border-gray-200 bg-white p-3 hover:bg-gray-50"
                    >
                      <div>
                        <p className="font-medium">{registration.participantName}</p>
                        <p className="text-sm text-gray-500">
                          {registration.participantChurch} | {registration.workshopName}
                        </p>
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        isLoading={deregisteringId === registration.id}
                        onClick={async () => {
                          if (!activeEvent) {
                            return;
                          }

                          setDeregisteringId(registration.id);
                          try {
                            await deregisterParticipantFromWorkshop({
                              eventId: activeEvent.id,
                              registration,
                            });
                            showMessage(`Removed ${registration.participantName} from ${registration.workshopName}.`, 'success');
                          } catch (error) {
                            console.error('Error deregistering participant:', error);
                            showMessage(error instanceof Error ? error.message : 'Failed to deregister participant.', 'error');
                          } finally {
                            setDeregisteringId(null);
                          }
                        }}
                      >
                        De-register
                      </Button>
                    </div>
                  ))}
                </div>
              ) : registrations.length > 0 ? (
                <p className="text-sm text-gray-600">No registrations match the current search.</p>
              ) : (
                <p className="text-sm text-gray-600">No registrations found for the selected date.</p>
              )}
            </CardContent>
          </Card>
        </div>
      ),
    },
  ];

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <AuthGuard>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Workshop Registrations</h1>

        {message && (
          <div className={`fixed top-6 left-1/2 z-50 -translate-x-1/2 rounded-md border px-4 py-2 text-sm shadow-lg transition-opacity duration-300 ${
            messageType === 'success'
              ? 'border-green-300 bg-green-50 text-green-800'
              : 'border-red-300 bg-red-50 text-red-800'
          }`}>
            {message}
          </div>
        )}

        {!activeEvent ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600">No active event is available right now.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {workshops.length === 0 ? (
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm text-gray-600">No workshops have been created for the active event yet.</p>
                </CardContent>
              </Card>
            ) : (
              <Tabs tabs={tabs} activeTabId={activeTabId} onTabChange={setActiveTabId} />
            )}
          </>
        )}
      </div>
    </AuthGuard>
  );
};

export default WorkshopRegistrations;
