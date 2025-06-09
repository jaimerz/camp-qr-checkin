import React, { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { Calendar, Users, MapPin, ArrowLeft, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Tabs from '../components/ui/Tabs';
import Badge from '../components/ui/Badge';
import AuthGuard from '../components/AuthGuard';
import LoadingSpinner from '../components/LoadingSpinner';
import { 
  getParticipantsByEvent, 
  getActivitiesByEvent,
  getEventById,
  getParticipantsByActivityId,
  getParticipantsAtCamp
} from '../utils/firebase';
import { Participant, Activity, Event } from '../types';
import { formatDate } from '../utils/helpers';

const EventDetail: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [participantsAtCamp, setParticipantsAtCamp] = useState<Participant[]>([]);
  const [participantsByActivity, setParticipantsByActivity] = useState<Record<string, Participant[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeTabId, setActiveTabId] = useState('overview');
  const location = useLocation();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedActivityParticipants, setSelectedActivityParticipants] = useState<Participant[]>([]);
  const [selectedActivityName, setSelectedActivityName] = useState<string | null>(null);
  
  const openParticipantsModal = (activityId: string, activityName: string) => {
    console.log(`Opening modal for: ${activityName}`);
    setSelectedActivityParticipants(participantsByActivity[activityId] || []);
    setSelectedActivityName(activityName);
    setModalVisible(true);
  };

  const closeParticipantsModal = () => {
    setModalVisible(false);
    setSelectedActivityParticipants([]);
    setSelectedActivityName(null);
  };

  useEffect(() => {
    if (loading) return;

    const params = new URLSearchParams(location.search);
    const tabParam = params.get('fromTab');

    if (tabParam && activeTabId === 'overview') {
      setActiveTabId(tabParam);

      // Clean the URL without reloading
      const cleanedUrl = `${window.location.origin}${window.location.pathname}${window.location.hash.split('?')[0]}`;
      window.history.replaceState({}, '', cleanedUrl);
    }
  }, [location.search, loading]);

  const fetchData = async () => {
    if (!eventId) return;

    setLoading(true);
    try {
      // Fetch event details
      // For simplicity, we'll fetch from the participants and activities
        
      // Fetch participants
      const participantsData = await getParticipantsByEvent(eventId);
      setParticipants(participantsData);

      // Fetch activities
      const activitiesData = await getActivitiesByEvent(eventId);
      setActivities(activitiesData);

      // Fetch participants at camp
      const atCampData = await getParticipantsAtCamp(eventId);
      setParticipantsAtCamp(atCampData);

      // Fetch participants by activity
      const byActivityData: Record<string, Participant[]> = {};
      for (const activity of activitiesData) {
        const activityParticipants = await getParticipantsByActivityId(eventId!, activity.id);
        byActivityData[activity.id] = activityParticipants;
      }
      setParticipantsByActivity(byActivityData);

      const eventData = await getEventById(eventId);
      setEvent(eventData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchData();
  }, [eventId]);

  const refreshLiveData = async () => {
    if (!eventId) return;

    try {
      const atCampData = await getParticipantsAtCamp(eventId);
      setParticipantsAtCamp(atCampData);
    
      const byActivityData: Record<string, Participant[]> = {};
      for (const activity of activities) {
        const activityParticipants = await getParticipantsByActivityId(eventId!, activity.id);
        byActivityData[activity.id] = activityParticipants;
      }
      setParticipantsByActivity(byActivityData);
    } catch (error) {
      console.error('Error refreshing live data:', error);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!event) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Event Not Found</h3>
            <p className="text-gray-500 mb-6">
              The event you're looking for doesn't exist or you don't have access to it.
            </p>
            <Link to="/dashboard">
              <Button>Back to Dashboard</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Create tabs for different views
  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center mb-4">
                <Calendar className="h-8 w-8 text-teal-500 mr-3" />
                <div>
                  <h3 className="font-medium text-lg text-gray-900">{event.name}</h3>
                  <p className="text-sm text-gray-500">
                    {formatDate(event.startDate)} - {formatDate(event.endDate)}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <Users className="h-5 w-5 text-purple-500 mr-2" />
                    <h4 className="font-medium text-purple-800">Participants</h4>
                  </div>
                  <p className="text-2xl font-bold text-purple-900">{participants.length}</p>
                </div>
                
                <div className="bg-amber-50 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <MapPin className="h-5 w-5 text-amber-500 mr-2" />
                    <h4 className="font-medium text-amber-800">Activities</h4>
                  </div>
                  <p className="text-2xl font-bold text-amber-900">{activities.length}</p>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <Users className="h-5 w-5 text-green-500 mr-2" />
                    <h4 className="font-medium text-green-800">At Camp Now</h4>
                  </div>
                  <p className="text-2xl font-bold text-green-900">{participantsAtCamp.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: 'locations',
      label: 'By Location',
      content: (
        <div className="space-y-6">
          <div className="flex justify-end mb-4">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync View
            </Button>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>At Camp</CardTitle>
            </CardHeader>
            <CardContent>
              {participantsAtCamp.length > 0 ? (
                <div className="space-y-2">
                  {participantsAtCamp.map((participant) => (
                    <div 
                      key={participant.id}
                      className="p-3 bg-white border border-gray-200 rounded-md flex justify-between items-center hover:bg-gray-50"
                    >
                      <div>
                        <p className="font-medium">{participant.name}</p>
                        <p className="text-sm text-gray-500">{participant.church}</p>
                      </div>
                      <Badge variant={participant.type === 'student' ? 'primary' : 'secondary'}>
                        {participant.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No participants at camp</p>
              )}
            </CardContent>
          </Card>
          
          {activities.map((activity) => (
            <Card key={activity.id}>
              <CardHeader>
                <CardTitle>{activity.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {participantsByActivity[activity.id]?.length > 0 ? (
                  <div className="space-y-2">
                    {participantsByActivity[activity.id].map((participant) => (
                      <div 
                        key={participant.id}
                        className="p-3 bg-white border border-gray-200 rounded-md flex justify-between items-center hover:bg-gray-50"
                      >
                        <div>
                          <p className="font-medium">{participant.name}</p>
                          <p className="text-sm text-gray-500">{participant.church}</p>
                        </div>
                        <Badge variant={participant.type === 'student' ? 'primary' : 'secondary'}>
                          {participant.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No participants at this activity</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ),
    },
    {
      id: 'participants',
      label: 'Participants',
      content: (
        <div className="space-y-6">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync View
            </Button>
          </div>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>All Participants</CardTitle>              
            </CardHeader>
            <CardContent>
              {participants.length > 0 ? (
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <Link 
                      key={participant.id}
                      to={`/events/${participant.eventId}/participants/${participant.qrCode}`}
                      className="block"
                    >
                      <div className="p-3 bg-white border border-gray-200 rounded-md flex justify-between items-center hover:bg-gray-50">
                        <div>
                          <p className="font-medium">{participant.name}</p>
                          <p className="text-sm text-gray-500">{participant.church}</p>
                        </div>
                        <Badge variant={participant.type === 'student' ? 'primary' : 'secondary'}>
                          {participant.type}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Participants Yet</h3>
                  <p className="text-gray-500 mb-6">
                    Participants will be visible once an admin imports them.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: 'activities',
      label: 'Activities',
      content: (
        <div className="space-y-6">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync View
            </Button>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>All Activities</CardTitle>              
            </CardHeader>
            <CardContent>
              {activities.length > 0 ? (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <Card key={activity.id} className="hover:shadow-md transition-shadow">
                      <div
                        onClick={() => openParticipantsModal(activity.id, activity.name)}
                        className="cursor-pointer"
                      >
                        <CardContent className="p-4">
                          <h3 className="font-medium text-lg">{activity.name}</h3>
                          <p className="text-gray-500 text-sm">{activity.description}</p>
                          <div className="mt-2 flex items-center">
                            <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                            <span className="text-sm text-gray-500">{activity.location}</span>
                          </div>
                        </CardContent>
                        <CardFooter className="bg-gray-50 py-2 px-4">
                          <div className="flex justify-between items-center w-full">
                            <span className="text-sm text-teal-600 underline">
                              Participants: {participantsByActivity[activity.id]?.length || 0}
                            </span>
                          </div>
                        </CardFooter>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Activities Yet</h3>
                  <p className="text-gray-500">
                    Activities will appear here once an admin adds them.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <AuthGuard>
      <div className="space-y-6">
        <div className="flex items-center mb-6">
          <Link to="/dashboard" className="mr-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
        </div>
        
        <Tabs
          tabs={tabs}
          activeTabId={activeTabId}
          onTabChange={(id) => {
            setActiveTabId(id);
          }}
        />
      </div>

      {modalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">
              Participants in {selectedActivityName}
            </h3>
            {selectedActivityParticipants.length > 0 ? (
              <ul className="space-y-2 max-h-80 overflow-y-auto">
                {selectedActivityParticipants.map((participant) => (
                  <li
                    key={participant.id}
                    className="border p-3 rounded-md flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium">{participant.name}</p>
                      <p className="text-sm text-gray-500">{participant.church}</p>
                    </div>
                    <Badge variant={participant.type === 'student' ? 'primary' : 'secondary'}>
                      {participant.type}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No participants found.</p>
            )}
            <div className="mt-4 text-right">
              <Button onClick={closeParticipantsModal}>Close</Button>
            </div>
          </div>
        </div>
      )}

    </AuthGuard>
  );
};

export default EventDetail;
