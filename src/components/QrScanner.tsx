import React, { useEffect, useState, useRef } from 'react';
import QrReader from 'react-qr-scanner';
import { Activity, Participant } from '../types';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/Card';

interface QrScannerProps {
  activities: Activity[];
  selectedActivity: Activity | null;
  scanType: 'departure' | 'return';
  onScan: (participantId: string, activityId: string | null) => Promise<void>;
  getParticipantInfo: (participantId: string) => Promise<Participant | null>;
  getParticipantCurrentActivity: (participantId: string) => Promise<Activity | null>;
}

const QrScanner: React.FC<QrScannerProps> = ({
  activities,
  selectedActivity,
  scanType,
  onScan,
  getParticipantInfo,
  getParticipantCurrentActivity,
}) => {
  const qrReaderRef = useRef<any>(null);

  const [scanning, setScanning] = useState(true);
  const [scannerKey, setScannerKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [scannedParticipant, setScannedParticipant] = useState<Participant | null>(null);
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);

  const IDLE_TIMEOUT = 60000;
  const idleTimer = useRef<NodeJS.Timeout | null>(null);

  const successSound = useRef(new Audio('/sounds/success.mp3'));
  const errorSound = useRef(new Audio('/sounds/error.mp3'));

  useEffect(() => {
    let active = true;

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (active) {
          setCameraPermission(true);
          stream.getTracks().forEach((track) => track.stop());
        }
      })
      .catch(() => {
        if (active) {
          setCameraPermission(false);
        }
      });

    return () => {
      active = false;
      if (idleTimer.current) clearTimeout(idleTimer.current);
      const videoEl = qrReaderRef.current?.video;
      const stream = videoEl?.srcObject as MediaStream;
      if (stream?.getTracks) {
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (e) {
            console.warn('Error stopping camera track:', e);
          }
        });
      }
    };
  }, []);

  const resetIdleTimer = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      console.log('⏳ Idle timeout reached, resetting scanner...');
      resetScanner();
    }, IDLE_TIMEOUT);
  };

  const resetScanner = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    setScanning(false);
    setScannerKey((prev) => prev + 1);
    setTimeout(() => {
      setScanning(true);
      resetIdleTimer();
    }, 500);
  };

  const handleError = (err: any) => {
    console.error(err);
    setError('Error accessing camera. Please check permissions.');
    errorSound.current.play().catch(() => {});
    resetScanner();
  };

  const handleScan = async (data: { text: string } | null) => {
    resetIdleTimer();
    if (!data?.text || !scanning) return;

    const qrCode = data.text.trim();
    console.log('📦 Scanned QR text:', qrCode);

    try {
      setScanning(false);
      const participant = await getParticipantInfo(qrCode);
      if (!participant) {
        setError('Invalid QR code. Participant not found.');
        errorSound.current.play().catch(() => {});
        setTimeout(() => {
          setError(null);
          resetScanner();
        }, 3000);
        return;
      }

      setScannedParticipant(participant);

      if (scanType === 'departure') {
        const participantActivity = await getParticipantCurrentActivity(participant.id);
        setCurrentActivity(participantActivity);
        if (participantActivity && participantActivity.id === selectedActivity?.id) {
          setError(`${participant.name} is already at ${participantActivity.name}.`);
          errorSound.current.play().catch(() => {});
          setTimeout(() => {
            setError(null);
            setScannedParticipant(null);
            setCurrentActivity(null);
            resetScanner();
          }, 3000);
          return;
        }
        successSound.current.play().catch(() => {});
        setConfirmModalOpen(true);
      } else if (scanType === 'return') {
        const participantActivity = await getParticipantCurrentActivity(participant.id);
        if (!participantActivity) {
          setError(`${participant.name} is already at camp.`);
          errorSound.current.play().catch(() => {});
          setTimeout(() => {
            setError(null);
            setScannedParticipant(null);
            resetScanner();
          }, 3000);
          return;
        }
        setCurrentActivity(participantActivity);
        successSound.current.play().catch(() => {});
        setConfirmModalOpen(true);
      }
    } catch (err) {
      console.error(err);
      setError('Error processing QR code.');
      errorSound.current.play().catch(() => {});
      setTimeout(() => {
        setError(null);
        resetScanner();
      }, 3000);
    }
  };

  const handleConfirm = async () => {
    if (!scannedParticipant) return;
    try {
      const activityId = scanType === 'departure' ? selectedActivity?.id || null : null;
      await onScan(scannedParticipant.id, activityId);
      setConfirmModalOpen(false);
      setScannedParticipant(null);
      setCurrentActivity(null);
      setTimeout(() => resetScanner(), 1000);
    } catch (err) {
      console.error(err);
      setError('Error updating participant activity.');
      errorSound.current.play().catch(() => {});
      setConfirmModalOpen(false);
      setTimeout(() => {
        setError(null);
        resetScanner();
      }, 3000);
    }
  };

  const handleCancel = () => {
    setConfirmModalOpen(false);
    setScannedParticipant(null);
    setCurrentActivity(null);
    setTimeout(() => resetScanner(), 500);
  };

  if (cameraPermission === false) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Camera Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">
            Camera access is required to scan QR codes. Please grant camera permissions in your browser settings and reload the page.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative">
      <Card className="overflow-hidden">
        <CardHeader className="bg-gray-50">
          <CardTitle className="text-center">
            {scanType === 'departure'
              ? `Scan QR to register for ${selectedActivity?.name || 'activity'}`
              : 'Scan QR to return to camp'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative aspect-[4/3] bg-black">
            {scanning && (
              <QrReader
                key={scannerKey}
                ref={qrReaderRef}
                delay={300}
                onError={handleError}
                onScan={handleScan}
                style={{ width: '100%' }}
                constraints={{ video: { facingMode: 'environment' } }}
              />
            )}
            <div className="absolute inset-0 pointer-events-none border-2 border-white/30">
              <div className="absolute inset-0 border-[20px] border-white/20 flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-white/60 rounded animate-pulse" />
              </div>
            </div>
            {error && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                <div className="bg-white p-4 rounded-lg max-w-xs text-center">
                  <p className="text-red-600 font-medium">{error}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-3 bg-gray-50 sm:items-start">
          <div className="flex flex-row gap-3">
            <Button
              onClick={resetScanner}
              variant="outline"
              className="px-4 py-2 whitespace-nowrap"
            >
              Reset Scanner
            </Button>
          </div>
          <p className="text-sm text-gray-500 text-center sm:text-left">
            Position the QR code in the center of the screen
          </p>
        </CardFooter>
      </Card>

      <Modal isOpen={confirmModalOpen} onClose={handleCancel} title="Confirm Action">
        <div className="space-y-4">
          {scannedParticipant && (
            <div>
              {scanType === 'departure' && (
                <p>
                  {currentActivity
                    ? `${scannedParticipant.name} is currently at ${currentActivity.name}. Change to ${selectedActivity?.name}?`
                    : `Register ${scannedParticipant.name} for ${selectedActivity?.name}?`}
                </p>
              )}
              {scanType === 'return' && (
                <p>{`Confirm ${scannedParticipant.name} is returning to camp?`}</p>
              )}
              <div className="mt-6 flex space-x-3">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleConfirm} variant="primary">
                  Confirm
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default QrScanner;
