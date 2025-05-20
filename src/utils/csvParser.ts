import Papa from 'papaparse';
import { CsvParticipant, Participant } from '../types';
import { v4 as uuidv4 } from 'uuid';

export async function parseParticipantsCsv(file: File): Promise<CsvParticipant[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing error: ${results.errors[0].message}`));
          return;
        }
        
        try {
          const participants: CsvParticipant[] = results.data.map((row: any) => {
            // Validate required fields
            if (!row.name || !row.church || !row.type) {
              throw new Error('Missing required fields in CSV');
            }
            
            // Validate participant type
            if (row.type !== 'student' && row.type !== 'leader') {
              throw new Error(`Invalid participant type: ${row.type}. Must be 'student' or 'leader'`);
            }
            
            return {
              name: row.name.trim(),
              church: row.church.trim(),
              type: row.type.trim() as 'student' | 'leader',
              assignedLeaders: row.assignedleaders ? row.assignedleaders.trim() : '',
            };
          });
          
          resolve(participants);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

export function prepareCsvParticipantsForImport(
  csvParticipants: CsvParticipant[],
  eventId: string
): Omit<Participant, 'id' | 'createdAt'>[] {
  return csvParticipants.map((participant) => {
    // Parse assigned leaders
    const assignedLeaders = participant.assignedLeaders
      ? participant.assignedLeaders.split(',').map((leader) => leader.trim())
      : [];
    
    // Generate a unique QR code
    const qrCode = uuidv4();
    
    return {
      name: participant.name,
      church: participant.church,
      type: participant.type,
      assignedLeaders,
      eventId,
      qrCode,
    };
  });
}