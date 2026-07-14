import Papa from 'papaparse';
import { CsvParticipant, Participant } from '../types';
import { v4 as uuidv4 } from 'uuid';

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function toTitleCase(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\b([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export async function parseParticipantsCsv(file: File): Promise<CsvParticipant[]> {
  const rawCsv = await file.text();
  const cleanedCsv = rawCsv
    .split(/\r?\n/)
    .filter((line) => !/^[\s,]*$/.test(line))
    .join('\n');

  return new Promise((resolve, reject) => {
    Papa.parse(cleanedCsv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing error: ${results.errors[0].message}`));
          return;
        }
        
        try {
          const cleanedRows = results.data.filter((row: any) =>
            Object.values(row).some((value) => String(value ?? '').trim() !== '')
          );

          const participants: CsvParticipant[] = cleanedRows.map((row: any) => {
            // Validate required fields
            const name = String(row.name ?? '').trim();
            const church = String(row.church ?? '').trim();
            const type = String(row.type ?? '').trim().toLowerCase();

            if (!name || !church || !type) {
              throw new Error('Missing required fields in CSV');
            }
            
            // Validate participant type
            if (type !== 'student' && type !== 'leader') {
              throw new Error(`Invalid participant type: ${row.type}. Must be 'student' or 'leader'`);
            }
            
            return {
              name: toTitleCase(name),
              church,
              type: type as 'student' | 'leader',
              assignedLeaders: row.assignedleaders ? String(row.assignedleaders).trim() : '',
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
