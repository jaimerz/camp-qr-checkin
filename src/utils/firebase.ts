import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
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

export async function createEvent(event: Omit<Event, 'id' | 'createdAt'>) {
  const eventRef = doc(collection(db, 'events'));
  const newEvent: Event = {
    ...event,
    id: eventRef.id,
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

// Participant related functions

export async function createParticipant(participant: Omit<Participant, 'id' | 'createdAt'>) {
  const participantRef = doc(collection(db, 'participants'));
  const newParticipant: Participant = {
    ...participant,
    id: participantRef.id,
    createdAt: new Date(),
  };
  
  await setDoc(participantRef, newParticipant);
  return newParticipant;
}

export async function getParticipantsByEvent(eventId: string) {
  const participantsQuery = query(
    collection(db, 'participants'),
    where('eventId', '==', eventId)
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

export async function getParticipantByQrCode(qrCode: string, eventId: string) {
  // Try matching by qrCode field first
  const participantsQuery = query(
    collection(db, 'participants'),
    where('qrCode', '==', qrCode),
    where('eventId', '==', eventId)
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

  // ✅ Fallback: try to get participant directly by ID
  const fallbackDoc = await getDoc(doc(db, 'participants', qrCode));
  if (fallbackDoc.exists()) {
    const data = fallbackDoc.data() as Omit<Participant, 'createdAt'> & {
      createdAt: Timestamp;
    };
    return {
      ...data,
      id: fallbackDoc.id,
      createdAt: data.createdAt.toDate(),
    };
  }

  return null;
}

// Activity related functions

export async function createActivity(activity: Omit<Activity, 'id' | 'createdAt'>) {
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

export async function createActivityLog(activityLog: Omit<ActivityLog, 'id' | 'timestamp'>) {
  const activityLogRef = doc(collection(db, 'activityLogs'));
  const newActivityLog: ActivityLog = {
    ...activityLog,
    id: activityLogRef.id,
    timestamp: new Date(),
  };
  
  await setDoc(activityLogRef, newActivityLog);
  return newActivityLog;
}

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
  
  // If the latest log is a return, the participant is at camp
  if (latestLog.type === 'return') {
    return null;
  }
  
  // If the latest log is a departure, get the activity
  if (latestLog.activityId) {
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
  
  for (const doc of activityLogsSnapshot.docs) {
    const activityLogData = doc.data() as Omit<ActivityLog, 'timestamp'> & {
      timestamp: Timestamp;
    };
    
    const log: ActivityLog & { leaderName?: string; activityName?: string } = {
      ...activityLogData,
      timestamp: (activityLogData.timestamp as Timestamp).toDate(),
    };
    
    // Get leader name
    if (log.leaderId) {
      const leaderRef = doc(db, 'users', log.leaderId);
      const leaderSnap = await getDoc(leaderRef);
      if (leaderSnap.exists()) {
        log.leaderName = (leaderSnap.data() as User).displayName;
      }
    }

    // Get activity name if activityId is not null
    if (log.activityId) {
      const activityRef = doc(db, 'activities', log.activityId);
      const activitySnap = await getDoc(activityRef);
      if (activitySnap.exists()) {
        log.activityName = (activitySnap.data() as Activity).name;
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
    collection(db, 'participants'),
    where('church', '==', church),
    where('eventId', '==', eventId)
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

export async function getParticipantsByActivityId(activityId: string) {
  const allLogsQuery = query(
    collection(db, 'activityLogs'),
    where('activityId', '==', activityId)
  );

  const allLogsSnapshot = await getDocs(allLogsQuery);

  const logsByParticipant: Record<string, ActivityLog[]> = {};

  allLogsSnapshot.forEach((doc) => {
    const raw = doc.data() as ActivityLog;
    const log = {
      ...raw,
      timestamp: (raw.timestamp as Timestamp).toDate(),
    };
    if (!logsByParticipant[log.participantId]) {
      logsByParticipant[log.participantId] = [];
    }
    logsByParticipant[log.participantId].push(log);
  });

  // Determine which participants are currently at the activity
  const activeParticipantIds = Object.entries(logsByParticipant)
    .filter(([_, logs]) => {
      const sorted = logs.sort((a, b) =>
        a.timestamp.getTime() - b.timestamp.getTime()
      );
      const last = sorted[sorted.length - 1];
      return last.type === 'departure';
    })
    .map(([participantId]) => participantId);

  if (activeParticipantIds.length === 0) return [];

  // Get participant details for active participants
  const participants: Participant[] = [];

  for (const id of activeParticipantIds) {
    const participantDoc = await getDoc(doc(db, 'participants', id));
    if (participantDoc.exists()) {
      const participantData = participantDoc.data() as Omit<Participant, 'createdAt'> & {
        createdAt: Timestamp;
      };
      participants.push({
        ...participantData,
        createdAt: participantData.createdAt.toDate(),
      });
    }
  }

  return participants;
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
