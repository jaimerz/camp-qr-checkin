import React, { useState } from 'react';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { parseParticipantsCsv, prepareCsvParticipantsForImport } from '../utils/csvParser';
import { CsvParticipant } from '../types';
import Button from './ui/Button';

interface CsvUploadProps {
  onParticipantsImported: (participants: any[]) => Promise<void>;
  eventId: string;
}

const CsvUpload: React.FC<CsvUploadProps> = ({ onParticipantsImported, eventId }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [parsedParticipants, setParsedParticipants] = useState<CsvParticipant[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setUploadStatus('idle');
      setErrorMessage(null);
    }
  };

  const handleFileUpload = async () => {
    if (!file) return;
    
    setIsUploading(true);
    setUploadStatus('idle');
    setErrorMessage(null);
    
    try {
      const participants = await parseParticipantsCsv(file);
      setParsedParticipants(participants);
      setUploadStatus('success');
    } catch (error) {
      console.error('CSV parsing error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Error parsing CSV file');
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleImport = async () => {
    if (parsedParticipants.length === 0) return;
    
    setIsUploading(true);
    
    try {
      const participantsToImport = prepareCsvParticipantsForImport(parsedParticipants, eventId);
      await onParticipantsImported(participantsToImport);
      setUploadStatus('success');
      
      // Reset form
      setFile(null);
      setParsedParticipants([]);
      
      // Reset file input
      const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (error) {
      console.error('Import error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Error importing participants');
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Import Participants via CSV</h3>
        <p className="text-sm text-gray-500">
          Upload a CSV file with the following columns: name, church, type (student/leader), assignedLeaders
        </p>
      </div>
      
      <div className="space-y-4">
        <div className={`border-2 border-dashed rounded-lg p-6 text-center ${
          file ? 'border-teal-300 bg-teal-50' : 'border-gray-300 hover:border-teal-300'
        }`}>
          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="sr-only"
          />
          <label
            htmlFor="csv-file-input"
            className="cursor-pointer flex flex-col items-center justify-center"
          >
            <Upload className="h-10 w-10 text-gray-400" />
            <span className="mt-2 block text-sm font-medium text-gray-700">
              {file ? file.name : 'Click to select a CSV file'}
            </span>
            <span className="mt-1 block text-xs text-gray-500">
              {file ? `${(file.size / 1024).toFixed(2)} KB` : 'CSV files only'}
            </span>
          </label>
        </div>
        
        {uploadStatus === 'success' && (
          <div className="bg-green-50 p-4 rounded-md flex items-start">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">CSV file parsed successfully</h3>
              <div className="mt-2 text-sm text-green-700">
                <p>{parsedParticipants.length} participants ready to import</p>
              </div>
            </div>
          </div>
        )}
        
        {uploadStatus === 'error' && (
          <div className="bg-red-50 p-4 rounded-md flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error parsing CSV file</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{errorMessage || 'Unknown error'}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={handleFileUpload}
            disabled={!file || isUploading}
            isLoading={isUploading && uploadStatus !== 'success'}
          >
            {isUploading ? 'Parsing...' : 'Parse CSV'}
          </Button>
          
          {parsedParticipants.length > 0 && (
            <Button
              onClick={handleImport}
              disabled={isUploading}
              isLoading={isUploading && uploadStatus === 'success'}
            >
              {isUploading ? 'Importing...' : `Import ${parsedParticipants.length} Participants`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CsvUpload;