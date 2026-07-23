import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { 
  getFirestore,
  collection,
  doc,
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
  serverTimestamp,
  onSnapshot,
  runTransaction
} from 'firebase/firestore';
import { User, Participant, Activity, ActivityLog, Event, Workshop, WorkshopRegistration, WorkshopDailyCount } from '../types';
import { formatDateKey, isDateWithinRange } from './helpers';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Participant related functions

export const deleteParticipantWithLogs = async (eventId: string, participantId: string) => {
  const db = getFirestore();
  
  // Delete logs
  const logsQuery = query(
    collection(db, 'activityLogs'),
    where('participantId', '==', participantId)
  );
  const logsSnapshot = await getDocs(logsQuery);

  const workshopRegistrationsQuery = query(
    collection(db, 'events', eventId, 'workshopRegistrations'),
    where('participantId', '==', participantId)
  );
  const workshopRegistrationsSnapshot = await getDocs(workshopRegistrationsQuery);

  const batch = writeBatch(db);
  logsSnapshot.forEach((doc) => batch.delete(doc.ref));

  const workshopCountAdjustments = new Map<string, { ref: ReturnType<typeof doc>; decrementBy: number }>();

  for (const registrationDoc of workshopRegistrationsSnapshot.docs) {
    const registrationData = registrationDoc.data() as {
      workshopId: string;
      dateKey: string;
    };

    batch.delete(registrationDoc.ref);

    const countId = buildWorkshopDailyCountId(registrationData.workshopId, registrationData.dateKey);
    const countRef = doc(db, 'events', eventId, 'workshopDailyCounts', countId);
    const existing = workshopCountAdjustments.get(countId);

    if (existing) {
      existing.decrementBy += 1;
    } else {
      workshopCountAdjustments.set(countId, { ref: countRef, decrementBy: 1 });
    }
  }

  for (const { ref, decrementBy } of workshopCountAdjustments.values()) {
    const countSnapshot = await getDoc(ref);

    if (!countSnapshot.exists()) {
      continue;
    }

    const currentCount = Number(countSnapshot.data().count || 0);

    if (currentCount <= decrementBy) {
      batch.delete(ref);
    } else {
      batch.update(ref, { count: currentCount - decrementBy });
    }
  }

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

  try {
    const ref = doc(db, 'events', eventId, 'participants', participantId);
    await updateDoc(ref, {
      location: activityId || 'camp',
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

export async function registerUser(email: string, password: string, displayName: string) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    const userData: User = {
      id: user.uid,
      email,
      displayName,
      role: 'leader', // 🔒 New users can only register as Leaders, only admins can update this through User Management.
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

  const workshopsSnapshot = await getDocs(collection(db, 'events', eventId, 'workshops'));
  await Promise.all(
    workshopsSnapshot.docs.map((docSnap) =>
      deleteDoc(doc(db, 'events', eventId, 'workshops', docSnap.id))
    )
  );

  const workshopRegistrationsSnapshot = await getDocs(collection(db, 'events', eventId, 'workshopRegistrations'));
  await Promise.all(
    workshopRegistrationsSnapshot.docs.map((docSnap) =>
      deleteDoc(doc(db, 'events', eventId, 'workshopRegistrations', docSnap.id))
    )
  );

  const workshopDailyCountsSnapshot = await getDocs(collection(db, 'events', eventId, 'workshopDailyCounts'));
  await Promise.all(
    workshopDailyCountsSnapshot.docs.map((docSnap) =>
      deleteDoc(doc(db, 'events', eventId, 'workshopDailyCounts', docSnap.id))
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
    location: 'camp', // ✅ Add this line to default location
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
  eventId,
  participantId,
  activityId,
  fromActivityId,
  leaderId,
  type,
}: {
  eventId: string;
  participantId: string;
  activityId: string;
  fromActivityId?: string;
  leaderId: string;
  type: 'departure' | 'return' | 'change';
}) => {
  const logData: any = {
    eventId,
    participantId,
    activityId,
    leaderId,
    type,
    timestamp: serverTimestamp(),
  };

  if (type === 'change' && fromActivityId) {
    logData.fromActivityId = fromActivityId;
  }

  await addDoc(collection(db, 'activityLogs'), { ...logData });
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
  
  const participantsQuery = query(
    collection(db, 'events', eventId, 'participants'),
    where('location', '==', activityId)
  );

  const participantsSnapshot = await getDocs(participantsQuery);
  const participants: Participant[] = [];

  participantsSnapshot.forEach((doc) => {
    const data = doc.data() as Omit<Participant, 'createdAt'> & { createdAt: Timestamp };
    participants.push({
      id: doc.id,
      ...data,
      createdAt: data.createdAt.toDate(),
    });
  });

  return participants;
}

// For debuging, could be removed
export async function listAllParticipantLocations(eventId: string) {
  const participantsSnapshot = await getDocs(collection(db, 'events', eventId, 'participants'));

  const locations: Record<string, number> = {};

  participantsSnapshot.forEach((doc) => {
    const data = doc.data() as { location: string };
    const location = data.location || 'camp';

    if (!locations[location]) {
      locations[location] = 0;
    }
    locations[location]++;
  });
}

export async function getParticipantsAtCamp(eventId: string) {
  const participantsQuery = query(
    collection(db, 'events', eventId, 'participants'),
    where('location', '==', 'camp')
  );

  const participantsSnapshot = await getDocs(participantsQuery);
  const participants: Participant[] = [];

  participantsSnapshot.forEach((doc) => {
    const data = doc.data() as Omit<Participant, 'createdAt'> & { createdAt: Timestamp };
    participants.push({
      id: doc.id,
      ...data,
      createdAt: data.createdAt.toDate(),
    });
  });

  return participants;
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

// Utility to backfill participant locations based on latest activity logs
export const backfillParticipantLocations = async (eventId: string) => {
  if (!eventId) return;

  console.log('🔥 Starting location backfill...');

  // Get all participants for the event
  const allParticipants = await getParticipantsByEvent(eventId);

  for (const participant of allParticipants) {
    const logsQuery = query(
      collection(db, 'activityLogs'),
      where('participantId', '==', participant.id)
    );

    const logsSnapshot = await getDocs(logsQuery);

    // If no logs, set location to camp
    if (logsSnapshot.empty) {
      console.log(`👀 No logs for participant ${participant.id}, setting location to camp`);
      await updateParticipantLocation(eventId, participant.id, null);
      continue;
    }

    // Find the most recent log
    let latestLog: ActivityLog | null = null;

    logsSnapshot.forEach((doc) => {
      const data = doc.data() as Omit<ActivityLog, 'timestamp'> & { timestamp: Timestamp };
      const log: ActivityLog = { ...data, timestamp: data.timestamp.toDate() };

      if (!latestLog || log.timestamp > latestLog.timestamp) {
        latestLog = log;
      }
    });

    if (latestLog) {
      if (latestLog.type === 'return') {
        console.log(`✅ Participant ${participant.id} last returned to camp`);
        await updateParticipantLocation(eventId, participant.id, null);
      } else {
        console.log(`✅ Participant ${participant.id} is at activity ${latestLog.activityId}`);
        await updateParticipantLocation(eventId, participant.id, latestLog.activityId || null);
      }
    }
  }

  console.log('🎉 Location backfill complete.');
};

export async function deleteActivity(eventId: string, activityId: string) {
  const logsQuery = query(
    collection(db, 'activityLogs'),
    where('activityId', '==', activityId)
  );
  const logsSnapshot = await getDocs(logsQuery);

  const batch = writeBatch(db);

  logsSnapshot.forEach((doc) => batch.delete(doc.ref));

  const participantsQuery = query(
    collection(db, `events/${eventId}/participants`),
    where('location', '==', activityId)
  );
  const participantsSnapshot = await getDocs(participantsQuery);

  participantsSnapshot.forEach((docSnap) => {
    batch.update(docSnap.ref, { location: 'camp' });
  });

  const ref = doc(db, 'activities', activityId);
  batch.delete(ref);

  await batch.commit();
}

export async function updateActivity(activityId: string, updates: Partial<Activity>) {
  const ref = doc(db, 'activities', activityId);
  await updateDoc(ref, updates);
}

// Workshop related functions

export async function createWorkshop(eventId: string, workshop: Omit<Workshop, 'id' | 'createdAt'>) {
  const workshopsRef = collection(db, 'events', eventId, 'workshops');
  const workshopRef = doc(workshopsRef);
  const newWorkshop: Workshop = {
    ...workshop,
    id: workshopRef.id,
    createdAt: new Date(),
  };

  await setDoc(workshopRef, newWorkshop);
  return newWorkshop;
}

export async function updateWorkshop(eventId: string, workshopId: string, updates: Partial<Workshop>) {
  const workshopRef = doc(db, 'events', eventId, 'workshops', workshopId);
  await updateDoc(workshopRef, updates);
}

export async function getWorkshopsByEvent(eventId: string): Promise<Workshop[]> {
  const snapshot = await getDocs(collection(db, 'events', eventId, 'workshops'));
  const workshops: Workshop[] = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as Omit<Workshop, 'availableFrom' | 'availableTo' | 'createdAt'> & {
      availableFrom: Timestamp;
      availableTo: Timestamp;
      createdAt: Timestamp;
    };

    workshops.push({
      id: docSnap.id,
      ...data,
      availableFrom: data.availableFrom.toDate(),
      availableTo: data.availableTo.toDate(),
      createdAt: data.createdAt.toDate(),
    });
  });

  return workshops;
}

export function subscribeToWorkshopsByEvent(
  eventId: string,
  callback: (workshops: Workshop[]) => void
) {
  return onSnapshot(collection(db, 'events', eventId, 'workshops'), (snapshot) => {
    const workshops: Workshop[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Omit<Workshop, 'availableFrom' | 'availableTo' | 'createdAt'> & {
        availableFrom: Timestamp;
        availableTo: Timestamp;
        createdAt: Timestamp;
      };

      return {
        id: docSnap.id,
        ...data,
        availableFrom: data.availableFrom.toDate(),
        availableTo: data.availableTo.toDate(),
        createdAt: data.createdAt.toDate(),
      };
    });

    callback(workshops);
  });
}

export async function deleteWorkshop(eventId: string, workshopId: string) {
  const countsSnapshot = await getDocs(collection(db, 'events', eventId, 'workshopDailyCounts'));
  const registrationsSnapshot = await getDocs(collection(db, 'events', eventId, 'workshopRegistrations'));

  const batch = writeBatch(db);

  countsSnapshot.docs.forEach((docSnap) => {
    if (docSnap.data().workshopId === workshopId) {
      batch.delete(docSnap.ref);
    }
  });

  registrationsSnapshot.docs.forEach((docSnap) => {
    if (docSnap.data().workshopId === workshopId) {
      batch.delete(docSnap.ref);
    }
  });

  batch.delete(doc(db, 'events', eventId, 'workshops', workshopId));
  await batch.commit();
}

export function subscribeToWorkshopRegistrationsByDate(
  eventId: string,
  dateKey: string,
  callback: (registrations: WorkshopRegistration[]) => void
) {
  const registrationsQuery = query(
    collection(db, 'events', eventId, 'workshopRegistrations'),
    where('dateKey', '==', dateKey)
  );

  return onSnapshot(registrationsQuery, (snapshot) => {
    const registrations: WorkshopRegistration[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Omit<WorkshopRegistration, 'registeredAt'> & {
        registeredAt: Timestamp;
      };

      return {
        id: docSnap.id,
        ...data,
        registeredAt: data.registeredAt.toDate(),
      };
    });

    callback(registrations);
  });
}

export function subscribeToWorkshopDailyCountsByDate(
  eventId: string,
  dateKey: string,
  callback: (counts: WorkshopDailyCount[]) => void
) {
  const countsQuery = query(
    collection(db, 'events', eventId, 'workshopDailyCounts'),
    where('dateKey', '==', dateKey)
  );

  return onSnapshot(countsQuery, (snapshot) => {
    const counts: WorkshopDailyCount[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<WorkshopDailyCount, 'id'>),
    }));

    callback(counts);
  });
}

function buildWorkshopRegistrationId(dateKey: string, participantId: string) {
  return `${dateKey}__${participantId}`;
}

function buildWorkshopDailyCountId(workshopId: string, dateKey: string) {
  return `${workshopId}__${dateKey}`;
}

export async function registerParticipantForWorkshop({
  eventId,
  workshopId,
  participant,
  registeredBy,
  dateKey,
}: {
  eventId: string;
  workshopId: string;
  participant: Participant;
  registeredBy: string;
  dateKey: string;
}) {
  const workshopRef = doc(db, 'events', eventId, 'workshops', workshopId);
  const registrationRef = doc(
    db,
    'events',
    eventId,
    'workshopRegistrations',
    buildWorkshopRegistrationId(dateKey, participant.id)
  );

  await runTransaction(db, async (transaction) => {
    const workshopSnap = await transaction.get(workshopRef);

    if (!workshopSnap.exists()) {
      throw new Error('Workshop not found.');
    }

    const workshopData = workshopSnap.data() as Omit<Workshop, 'availableFrom' | 'availableTo' | 'createdAt'> & {
      availableFrom: Timestamp;
      availableTo: Timestamp;
      createdAt: Timestamp;
    };

    const workshop: Workshop = {
      id: workshopSnap.id,
      ...workshopData,
      availableFrom: workshopData.availableFrom.toDate(),
      availableTo: workshopData.availableTo.toDate(),
      createdAt: workshopData.createdAt.toDate(),
    };

    const selectedDate = new Date(`${dateKey}T00:00:00`);

    if (!workshop.active || !isDateWithinRange(selectedDate, workshop.availableFrom, workshop.availableTo)) {
      throw new Error('This workshop is not available on the selected date.');
    }

    const existingRegistrationSnap = await transaction.get(registrationRef);
    if (existingRegistrationSnap.exists()) {
      const existing = existingRegistrationSnap.data() as WorkshopRegistration;
      if (existing.workshopId === workshopId) {
        throw new Error('Participant is already registered for this workshop on that date.');
      }
      throw new Error(`Participant is already registered for ${existing.workshopName} on that date.`);
    }

    const countRef = doc(
      db,
      'events',
      eventId,
      'workshopDailyCounts',
      buildWorkshopDailyCountId(workshopId, dateKey)
    );
    const countSnap = await transaction.get(countRef);
    const currentCount = countSnap.exists() ? (countSnap.data().count as number) : 0;

    if (currentCount >= workshop.maxRegistrationsPerDay) {
      throw new Error('This workshop just reached its maximum registrations.');
    }

    transaction.set(registrationRef, {
      workshopId: workshop.id,
      workshopName: workshop.name,
      participantId: participant.id,
      participantName: participant.name,
      participantChurch: participant.church,
      dateKey,
      registeredBy,
      registeredAt: serverTimestamp(),
    });

    transaction.set(countRef, {
      workshopId: workshop.id,
      workshopName: workshop.name,
      dateKey,
      count: currentCount + 1,
      maxRegistrations: workshop.maxRegistrationsPerDay,
    });
  });
}

export async function deregisterParticipantFromWorkshop({
  eventId,
  registration,
}: {
  eventId: string;
  registration: WorkshopRegistration;
}) {
  const registrationRef = doc(db, 'events', eventId, 'workshopRegistrations', registration.id);
  const countRef = doc(
    db,
    'events',
    eventId,
    'workshopDailyCounts',
    buildWorkshopDailyCountId(registration.workshopId, registration.dateKey)
  );

  await runTransaction(db, async (transaction) => {
    const registrationSnap = await transaction.get(registrationRef);
    if (!registrationSnap.exists()) {
      throw new Error('Registration no longer exists.');
    }

    const countSnap = await transaction.get(countRef);
    const currentCount = countSnap.exists() ? (countSnap.data().count as number) : 0;

    transaction.delete(registrationRef);

    if (currentCount <= 1) {
      transaction.delete(countRef);
    } else {
      transaction.update(countRef, { count: currentCount - 1 });
    }
  });
}

export async function clearWorkshopRegistrations(eventId: string) {
  const registrationsSnapshot = await getDocs(collection(db, 'events', eventId, 'workshopRegistrations'));
  const countsSnapshot = await getDocs(collection(db, 'events', eventId, 'workshopDailyCounts'));

  let batch = writeBatch(db);
  let operationCount = 0;

  const commitBatch = async () => {
    if (operationCount === 0) {
      return;
    }

    await batch.commit();
    batch = writeBatch(db);
    operationCount = 0;
  };

  for (const docSnap of registrationsSnapshot.docs) {
    batch.delete(docSnap.ref);
    operationCount++;
    if (operationCount >= 450) {
      await commitBatch();
    }
  }

  for (const docSnap of countsSnapshot.docs) {
    batch.delete(docSnap.ref);
    operationCount++;
    if (operationCount >= 450) {
      await commitBatch();
    }
  }

  await commitBatch();
}

export function getDefaultWorkshopDateKey(workshops: Workshop[], today = new Date()) {
  const upcomingKeys = Array.from(
    new Set(
      workshops.flatMap((workshop) => {
        if (!workshop.active) {
          return [];
        }
        const start = workshop.availableFrom;
        const end = workshop.availableTo;
        const keys: string[] = [];
        for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
          const current = new Date(cursor);
          if (current >= new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
            keys.push(formatDateKey(current));
          }
        }
        return keys;
      })
    )
  ).sort();

  return upcomingKeys[0] || '';
}

export async function getWorkshopRegistrationsByDate(eventId: string, dateKey: string): Promise<WorkshopRegistration[]> {
  const registrationsQuery = query(
    collection(db, 'events', eventId, 'workshopRegistrations'),
    where('dateKey', '==', dateKey)
  );
  const snapshot = await getDocs(registrationsQuery);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Omit<WorkshopRegistration, 'registeredAt'> & {
      registeredAt: Timestamp;
    };

    return {
      id: docSnap.id,
      ...data,
      registeredAt: data.registeredAt.toDate(),
    };
  });
}

export async function getWorkshopDailyCountsByDate(eventId: string, dateKey: string): Promise<WorkshopDailyCount[]> {
  const countsQuery = query(
    collection(db, 'events', eventId, 'workshopDailyCounts'),
    where('dateKey', '==', dateKey)
  );
  const snapshot = await getDocs(countsQuery);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<WorkshopDailyCount, 'id'>),
  }));
}

// User related functions
export async function getAllUsers() {
  const usersSnapshot = await getDocs(collection(db, 'users'));
  return usersSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as User[];
}

export async function updateUser(userId: string, updates: Partial<User>) {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, updates);
}

export async function deleteUserFromDatabase(userId: string) {
  const userRef = doc(db, 'users', userId);
  await deleteDoc(userRef);
}

export async function getUserById(uid: string): Promise<User> {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error('User not found');
  }
  return { id: docSnap.id, ...docSnap.data() } as User;
}
