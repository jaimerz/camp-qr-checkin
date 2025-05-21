import { UserRole } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Combine Tailwind classes safely
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format date to readable string
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Format timestamp for activity logs
export function formatTimestamp(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Check if user has admin permissions
export function isAdmin(role: UserRole): boolean {
  return role === 'admin';
}

// Generate a random color based on a string (for visual identification)
export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    '#F87171', // red
    '#FB923C', // orange
    '#FACC15', // yellow
    '#4ADE80', // green
    '#22D3EE', // cyan
    '#60A5FA', // blue
    '#C084FC', // purple
    '#F472B6', // pink
  ];
  
  return colors[Math.abs(hash) % colors.length];
}

// Get church background color based on church name
export function getChurchColor(church: string): string {
  return stringToColor(church);
}

// Get participant type badge color
export function getParticipantTypeColor(type: 'student' | 'leader'): string {
  return type === 'student' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
}

// Format date time
export function formatDateTime(date: Date): string {
  return date.toLocaleString(); // Or customize format if needed
}

// Get activity log type badge color
export function getActivityLogTypeColor(type: 'departure' | 'return'): string {
  return type === 'departure' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800';
}
