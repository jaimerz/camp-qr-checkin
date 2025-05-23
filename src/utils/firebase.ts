import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore,
  collection,
  doc,
  db, // assuming db initialized
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  Timestamp,
  writeBatch,
  addDoc,
  serverTimestamp } from 'firebase/firestore';
import { User, UserRole, Participant, Activity, ActivityLog, Event } from '../types';

const firebaseConfig = {
  apiKey: "AIzaSyAKaqOCzuU6si-EIKxcySZwbYR2stozSPc",
  authDomain: "camp-qr-checkin.firebaseapp.com",
  projectId: "camp-qr-checkin",
  storageBucket: "camp-qr-checkin.firebasestorage.app",
  messagingSenderId: "17791451766",
  appId: "1:17791451766:web:98a01f90888217f6e29557"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Participant related functions

export const deleteParticipantWithLogs = async (eventId: string, participantId: string) => {
  const db = getFirestore();
  
  // Delete logs
  const logsQuery = query(
    collection(db, 'activityLogs'),
    where('participantId', '==', participantId)
  );
  const logsSnapshot = await getDocs(logsQuery);

  const batch = writeBatch(db);
  logsSnapshot.forEach((doc) => batch.delete(doc.ref));

  // Delete participant
  const participantRef = doc(db, `events/${eventId}/participants/${participantId}`);
  batch.delete(participantRef);

  await batch.commit();
};


export const updateParticipantLocation = async (
  eventId: string,
  participantId: string,
  activityId: string | null
) => {
  console.log('[updateParticipantLocation] Called with:', { eventId, participantId, activityId });

  try {
    const ref = doc(db, 'events', eventId, 'participants', participantId);
    await updateDoc(ref, {
      currentActivityId: activityId,
    });
  } catch (error) {
    await addDoc(collection(db, 'debug_logs'), {
      message: 'Failed to update participant activity',
      eventId,
      participantId,
      activityId,
      timestamp: new Date(),
      error: JSON.stringify((error as any)?.message || error),
    });

    throw error;
  }
};

export async function loginUser(email: string, password: string) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
    
    if (userDoc.exists()) {
      return { user: userCredential.user, userData: userDoc.data() };
    } else {
      throw new Error('User data not found');
    }
  } catch (error) {
    throw error;
  }
}

export async function registerUser(email: string, password: string, displayName: string, role: UserRole) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    const userData: User = {
      id: user.uid,
      email,
      displayName,
      role,
      createdAt: new Date(),
    };
    
    await setDoc(doc(db, 'users', user.uid), userData);
    return userData;
  } catch (error) {
    throw error;
  }
}

export async function logoutUser() {
  return signOut(auth);
}

export async function getCurrentUser() {
  const user = auth.currentUser;
  
  if (user) {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      return { user, userData: userDoc.data() as User };
    }
  }
  
  return null;
}

// Event related functions

export async function createEvent(event: Omit<Event, 'createdAt'>) {
  const eventRef = doc(db, 'events', event.id); // use provided id

  const newEvent: Event = {
    ...event,
    createdAt: new Date(),
  };

  await setDoc(eventRef, newEvent);
  return newEvent;
}

export async function getEvents() {
  const eventsSnapshot = await getDocs(collection(db, 'events'));
  const events: Event[] = [];
  
  eventsSnapshot.forEach((doc) => {
    const eventData = doc.data() as Omit<Event, 'id' | 'createdAt' | 'startDate' | 'endDate'> & {
      createdAt: Timestamp;
      startDate: Timestamp;
      endDate: Timestamp;
    };
    
    events.push({
      id: doc.id,
      ...eventData,
      createdAt: eventData.createdAt.toDate(),
      startDate: eventData.startDate.toDate(),
      endDate: eventData.endDate.toDate(),
    });
  });
  
  return events;
}

export async function getEventById(eventId: string): Promise<Event> {
  const eventRef = doc(db, 'events', eventId);
  const snapshot = await getDoc(eventRef);

  if (!snapshot.exists()) {
    throw new Error('Event not found');
  }

  const data = snapshot.data() as Omit<Event, 'startDate' | 'endDate' | 'createdAt'> & {
    startDate: Timestamp;
    endDate: Timestamp;
    createdAt: Timestamp;
  };

  return {
    id: snapshot.id,
    ...data,
    startDate: data.startDate.toDate(),
    endDate: data.endDate.toDate(),
    createdAt: data.createdAt.toDate(),
  };
}

export const setActiveEvent = async (eventId: string) => {
  const db = getFirestore();
  const eventsRef = collection(db, 'events');
  const snapshot = await getDocs(eventsRef);

  const updates = snapshot.docs.map((docSnap) => {
    const isActive = docSnap.id === eventId;
    return updateDoc(doc(db, 'events', docSnap.id), { active: isActive });
  });

  await Promise.all(updates);
};

export const deleteEventWithCascade = async (eventId: string) => {
  const db = getFirestore();

  // Delete activities with this eventId
  const activitiesRef = collection(db, 'activities');
  const activitiesSnapshot = await getDocs(query(activitiesRef, where('eventId', '==', eventId)));

  const activityIds = activitiesSnapshot.docs.map((docSnap) => docSnap.id);

  await Promise.all(
    activityIds.map((id) => deleteDoc(doc(db, 'activities', id)))
  );

  // Delete activityLogs linked to those activities
  const logsRef = collection(db, 'activityLogs');
  const logsSnapshot = await getDocs(logsRef); // no indexing on nested so we filter in JS

  const logsToDelete = logsSnapshot.docs.filter((log) =>
    activityIds.includes(log.data().activityId)
  );

  await Promise.all(
    logsToDelete.map((log) => deleteDoc(doc(db, 'activityLogs', log.id)))
  );

  // Delete all participants under this event
  const participantsRef = collection(db, `events/${eventId}/participants`);
  const participantsSnapshot = await getDocs(participantsRef);

  await Promise.all(
    participantsSnapshot.docs.map((docSnap) =>
      deleteDoc(doc(db, `events/${eventId}/participants`, docSnap.id))
    )
  );

  // Delete the event itself
  await deleteDoc(doc(db, 'events', eventId));
};

// Participant related functions

export function generateDeterministicQrCode(eventId: string, name: string, church: string): string {
  const input = `${eventId}-${name.trim().toLowerCase()}-${church.trim().toLowerCase()}`;
  return input.replace(/\s+/g, '-'); // Normalize all whitespace to hyphens
}

export async function createParticipant(participant: Omit<Participant, 'id' | 'createdAt'>) {
  if (!participant.eventId) throw new Error('Missing eventId for participant');

  // Check if participant with same name + church already exists
  const existingQuery = query(
    collection(db, 'events', participant.eventId, 'participants'),
    where('name', '==', participant.name),
    where('church', '==', participant.church)
  );

  const existingSnapshot = await getDocs(existingQuery);

  if (!existingSnapshot.empty) {
    throw new Error(`Duplicate: ${participant.name} from ${participant.church}`);
  }

  const participantRef = doc(collection(db, 'events', participant.eventId, 'participants'));

  const newParticipant: Participant = {
    ...participant,
    id: participantRef.id,
    qrCode: generateDeterministicQrCode(participant.eventId, participant.name, participant.church),
    createdAt: new Date(),
  };

  await setDoc(participantRef, newParticipant);
  return newParticipant;
}

export async function getParticipantsByEvent(eventId: string) {
  const participantsQuery = collection(db, 'events', eventId, 'participants');
  
  const participantsSnapshot = await getDocs(participantsQuery);
  const participants: Participant[] = [];
  
  participantsSnapshot.forEach((doc) => {
    const participantData = doc.data() as Omit<Participant, 'createdAt'> & {
      createdAt: Timestamp;
    };
    
    participants.push({
      ...participantData,
      createdAt: participantData.createdAt.toDate(),
    });
  });
  
  return participants;
}

export async function getParticipantById(eventId: string, participantId: string): Promise<Participant | null> {
  const ref = doc(db, 'events', eventId, 'participants', participantId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() as Omit<Participant, 'createdAt'> & {
    createdAt: Timestamp;
  };

  return {
    id: snapshot.id,
    ...data,
    createdAt: data.createdAt.toDate(),
  };
}

export async function getParticipantByQrCode(qrCode: string, eventId: string) {
  // 🔥 OLD (flat structure)
  // const participantsQuery = query(
  //   collection(db, 'participants'),
  //   where('qrCode', '==', qrCode),
  //   where('eventId', '==', eventId)
  // );

  const participantsQuery = query(
    collection(db, 'events', eventId, 'participants'),
    where('qrCode', '==', qrCode)
  );

  const participantsSnapshot = await getDocs(participantsQuery);

  if (!participantsSnapshot.empty) {
    const participantDoc = participantsSnapshot.docs[0];
    const participantData = participantDoc.data() as Omit<Participant, 'createdAt'> & {
      createdAt: Timestamp;
    };

    return {
      id: participantDoc.id,
      ...participantData,
      createdAt: participantData.createdAt.toDate(),
    };
  }

  return null;
}

// Activity related functions

export async function createActivity(activity: Omit<Activity, 'id' | 'createdAt'>) {
  // Prevent duplicates for same event + name
  const duplicateQuery = query(
    collection(db, 'activities'),
    where('eventId', '==', activity.eventId),
    where('name', '==', activity.name)
  );
  const duplicateSnap = await getDocs(duplicateQuery);
  if (!duplicateSnap.empty) {
    throw new Error(`Activity "${activity.name}" already exists for this event.`);
  }

  const activityRef = doc(collection(db, 'activities'));
  const newActivity: Activity = {
    ...activity,
    id: activityRef.id,
    createdAt: new Date(),
  };
  
  await setDoc(activityRef, newActivity);
  return newActivity;
}

export async function getActivitiesByEvent(eventId: string) {
  const activitiesQuery = query(
    collection(db, 'activities'),
    where('eventId', '==', eventId)
  );
  
  const activitiesSnapshot = await getDocs(activitiesQuery);
  const activities: Activity[] = [];
  
  activitiesSnapshot.forEach((doc) => {
    const activityData = doc.data() as Omit<Activity, 'createdAt'> & {
      createdAt: Timestamp;
    };
    
    activities.push({
      ...activityData,
      createdAt: activityData.createdAt.toDate(),
    });
  });
  
  return activities;
}

// Activity log related functions

export const createActivityLog = async ({
  participantId,
  activityId,
  fromActivityId,
  leaderId,
  type,
}: {
  participantId: string;
  activityId: string;
  fromActivityId?: string;
  leaderId: string;
  type: 'departure' | 'return' | 'change';
}) => {
  const logData: any = {
    participantId,
    activityId,
    leaderId,
    type,
    timestamp: serverTimestamp(),
  };

  if (type === 'change' && fromActivityId) {
    logData.fromActivityId = fromActivityId;
  }

  await addDoc(collection(db, 'activityLogs'), logData);
};

export async function getParticipantCurrentActivity(participantId: string) {
  const activityLogsQuery = query(
    collection(db, 'activityLogs'),
    where('participantId', '==', participantId)
  );
  
  const activityLogsSnapshot = await getDocs(activityLogsQuery);
  const activityLogs: ActivityLog[] = [];
  
  activityLogsSnapshot.forEach((doc) => {
    const activityLogData = doc.data() as Omit<ActivityLog, 'timestamp'> & {
      timestamp: Timestamp;
    };
    
    activityLogs.push({
      ...activityLogData,
      timestamp: activityLogData.timestamp.toDate(),
    });
  });
  
  // Sort logs by timestamp in descending order
  activityLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
  if (activityLogs.length === 0) {
    return null;
  }

  const latestLog = activityLogs[0];

  // If the latest log is a return, they are at camp
  if (latestLog.type === 'return') {
    return null;
  }

  // If the latest log is a departure or change, get the activity
  if ((latestLog.type === 'departure' || latestLog.type === 'change') && latestLog.activityId) {
    const activityDoc = await getDoc(doc(db, 'activities', latestLog.activityId));
    if (activityDoc.exists()) {
      return activityDoc.data() as Activity;
    }
  }

  return null;
}

export async function getParticipantActivityLogs(participantId: string) {
  const activityLogsQuery = query(
    collection(db, 'activityLogs'),
    where('participantId', '==', participantId)
  );
  
  const activityLogsSnapshot = await getDocs(activityLogsQuery);
  const activityLogs: (ActivityLog & { leaderName?: string; activityName?: string })[] = [];
  
  for (const snap of activityLogsSnapshot.docs) {
    const activityLogData = snap.data() as Omit<ActivityLog, 'timestamp'> & {
      timestamp: Timestamp;
    };

    const log: ActivityLog & { leaderName?: string; activityName?: string } = {
      ...activityLogData,
      timestamp: (activityLogData.timestamp as Timestamp).toDate(),
    };

    if (log.leaderId) {
      const leaderRef = doc(db, 'users', log.leaderId);
      const leaderSnap = await getDoc(leaderRef);
      if (leaderSnap.exists()) {
        log.leaderName = (leaderSnap.data() as User).displayName;
      }
    }

    if (log.activityId) {
      const activityRef = doc(db, 'activities', log.activityId);
      const activitySnap = await getDoc(activityRef);
      if (activitySnap.exists()) {
        log.activityName = (activitySnap.data() as Activity).name;
      }
    }
    
    if (log.fromActivityId) {
      const fromActivityRef = doc(db, 'activities', log.fromActivityId);
      const fromActivitySnap = await getDoc(fromActivityRef);
      if (fromActivitySnap.exists()) {
        log.fromActivityName = (fromActivitySnap.data() as Activity).name;
      }
    }

    activityLogs.push(log);
  }
  
  // Sort logs by timestamp in descending order
  activityLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
  return activityLogs;
}

export async function getParticipantsByChurch(church: string, eventId: string) {
  const participantsQuery = query(
    collection(db, 'events', eventId, 'participants'),
    where('church', '==', church)
  );
  
  const participantsSnapshot = await getDocs(participantsQuery);
  const participants: Participant[] = [];
  
  participantsSnapshot.forEach((doc) => {
    const participantData = doc.data() as Omit<Participant, 'createdAt'> & {
      createdAt: Timestamp;
    };
    
    participants.push({
      ...participantData,
      createdAt: participantData.createdAt.toDate(),
    });
  });
  
  return participants;
}

export async function getParticipantsByActivityId(eventId: string, activityId: string) {
  const participants = await getParticipantsByEvent(eventId);
  const matchingParticipants: Participant[] = [];

  for (const participant of participants) {
    const logsQuery = query(
      collection(db, 'activityLogs'),
      where('participantId', '==', participant.id)
    );
    const logsSnapshot = await getDocs(logsQuery);

    const logs: ActivityLog[] = logsSnapshot.docs.map((doc) => {
      const raw = doc.data() as Omit<ActivityLog, 'timestamp'> & {
        timestamp: Timestamp;
      };
      return {
        ...raw,
        timestamp: raw.timestamp.toDate(),
      };
    });

    if (logs.length === 0) continue;

    // Sort by timestamp DESC
    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const latest = logs[0];

    // If latest is departure or change and destination is this activity
    if (
      (latest.type === 'departure' || latest.type === 'change') &&
      latest.activityId === activityId
    ) {
      matchingParticipants.push(participant);
    }
  }

  return matchingParticipants;
}

export async function getParticipantsAtCamp(eventId: string) {
  // Get all participants for the event
  const allParticipants = await getParticipantsByEvent(eventId);
  
  // Filter out participants who are currently at an activity
  const participantsAtActivity: string[] = [];
  
  for (const participant of allParticipants) {
    const currentActivity = await getParticipantCurrentActivity(participant.id);
    
    if (currentActivity) {
      participantsAtActivity.push(participant.id);
    }
  }
  
  // Return participants who are at camp
  return allParticipants.filter(
    (participant) => !participantsAtActivity.includes(participant.id)
  );
}

export async function resetTestData(eventId: string) {
  // Delete all activity logs for the event
  const participants = await getParticipantsByEvent(eventId);
  
  for (const participant of participants) {
    const logsQuery = query(
      collection(db, 'activityLogs'),
      where('participantId', '==', participant.id)
    );
    
    const logsSnapshot = await getDocs(logsQuery);
    
    for (const doc of logsSnapshot.docs) {
      await deleteDoc(doc.ref);
    }
  }
}

export async function deleteActivity(_eventId: string, activityId: string) {
  // Delete logs with this activityId
  const logsQuery = query(
    collection(db, 'activityLogs'),
    where('activityId', '==', activityId)
  );
  const logsSnapshot = await getDocs(logsQuery);

  const batch = writeBatch(db);
  logsSnapshot.forEach((doc) => batch.delete(doc.ref));

  // Delete activity
  const ref = doc(db, 'activities', activityId);
  batch.delete(ref);

  await batch.commit();
}

export async function updateActivity(activityId: string, updates: Partial<Activity>) {
  const ref = doc(db, 'activities', activityId);
  await updateDoc(ref, updates);
}