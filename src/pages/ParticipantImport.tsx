import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AuthGuard from '../components/AuthGuard';
import CsvUpload from '../components/CsvUpload';
import Button from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { createParticipant } from '../utils/firebase';
import { Participant } from '../types';

const ParticipantImport: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    success: number;
    failed: number;
  } | null>(null);

    const handleParticipantsImported = async (participants: Omit<Participant, 'id' | 'createdAt'>[]) => {
      if (!eventId || participants.length === 0) return;
    
      setImporting(true);
      let successCount = 0;
      let failedCount = 0;
      const failedNames: string[] = [];
    
      try {
        for (const participant of participants) {
          try {
            await createParticipant({
              ...participant,
              eventId,
            });
            successCount++;
          } catch (err) {
            console.error('Import error:', err);
            failedCount++;
            failedNames.push(participant.name);
          }
        }
    
        setImportStatus({
          success: successCount,
          failed: failedCount,
          failedNames,
        });
    
        if (failedCount === 0) {
          setTimeout(() => {
            navigate(`/events/${eventId}`);
          }, 2000);
        }
      } catch (err) {
        console.error('Unexpected import error:', err);
      } finally {
        setImporting(false);
      }
  };

  return (
    <AuthGuard requiredRole="admin">
      <div className="space-y-6">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/participants')}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Manage Participants
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Import Participants</h1>
        </div>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Prepare a CSV file with the following columns: name, church, type, assignedLeaders</li>
              <li>The 'type' column must contain either 'student' or 'leader'</li>
              <li>The 'assignedLeaders' column should contain comma-separated leader names (optional)</li>
              <li>Make sure each row has values for at least name, church, and type</li>
              <li>Upload the CSV file using the form below</li>
            </ol>
          </CardContent>
        </Card>
        
        <CsvUpload onParticipantsImported={handleParticipantsImported} eventId={eventId || ''} />
        
        {importStatus && (
          <Card className={`mt-6 ${importStatus.failed === 0 ? 'bg-green-50' : 'bg-amber-50'}`}>
            <CardContent className="p-6">
              <h3 className="font-medium text-lg mb-2">
                {importStatus.failed === 0 ? 'Import Successful!' : 'Import Completed with Issues'}
              </h3>
              <p>
                Successfully imported: <span className="font-medium text-green-700">{importStatus.success}</span> participants
              </p>
              {importStatus.failed > 0 && (
                <>
                  <p>
                    Failed to import: <span className="font-medium text-red-700">{importStatus.failed}</span> participants
                  </p>
                  <ul className="text-sm text-gray-600 list-disc ml-6">
                    {importStatus.failedNames?.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </>            
              )}
              {importStatus.failed === 0 && (
                <p className="text-sm text-gray-500 mt-2">Redirecting to event page...</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AuthGuard>
  );
};

export default ParticipantImport;
