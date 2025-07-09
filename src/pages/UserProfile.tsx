import React, { useState } from 'react';
import { useUser } from '../context/UserContext';
import { updateUser } from '../utils/firebase';
import AuthGuard from '../components/AuthGuard';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

const UserProfile: React.FC = () => {
  const { user } = useUser();
  const [modalOpen, setModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleUpdate = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await updateUser(user.id, { displayName: inputValue });
      showMessage('Name updated successfully!', 'success');
      setModalOpen(false);
    } catch (err: any) {
      console.error(err);
      showMessage(err.message || 'Failed to update name', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard>
      <div className="max-w-xl mx-auto mt-10 px-4 space-y-6">
        <h1 className="text-2xl font-bold">My Profile</h1>

        {message && (
          <div className={`rounded p-3 text-sm border ${
            messageType === 'success'
              ? 'bg-green-50 text-green-800 border-green-300'
              : 'bg-red-50 text-red-800 border-red-300'
          }`}>
            {message}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <p className="font-semibold">Name</p>
              <p>{user?.displayName || '—'}</p>
            </div>
            <Button onClick={() => {
              setInputValue(user?.displayName || '');
              setModalOpen(true);
            }}>
              Edit
            </Button>
          </div>

          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <p className="font-semibold">Email</p>
              <p>{user?.email || '—'}</p>
            </div>
            <Button disabled>—</Button>
          </div>

          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <p className="font-semibold">Password</p>
              <p>••••••••</p>
            </div>
            <Button disabled>—</Button>
          </div>
        </div>

        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Update Name">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter new name"
            className="w-full border p-2 rounded mt-4"
          />
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </Modal>
      </div>
    </AuthGuard>
  );
};

export default UserProfile;
