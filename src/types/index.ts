export type UserRole = 'admin' | 'leader';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Date;
}

export interface Event {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  createdBy: string;
  active: boolean;
}

export type ParticipantType = 'student' | 'leader';

export interface Participant {
  id: string;
  name: string;
  church: string;
  type: ParticipantType;
  assignedLeaders: string[];
  eventId: string;
  qrCode: string;
  createdAt: Date;
}

export interface Activity {
  id: string;
  name: string;
  description: string;
  location: string;
  eventId: string;
  createdAt: Date;
}

export interface ActivityLog {
  id: string;
  participantId: string;
  activityId: string | null; // null means at camp
  leaderId: string;
  timestamp: Date;
  type: 'departure' | 'return';
}

export interface CsvParticipant {
  name: string;
  church: string;
  type: ParticipantType;
  assignedLeaders: string;
}