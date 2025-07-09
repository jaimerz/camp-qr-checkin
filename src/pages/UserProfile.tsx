import React, { useState } from 'react';
import { updateEmail, updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { useUser } from '../context/UserContext';
import { db } from '../utils/firebase';
import AuthGuard from '../components/AuthGuard';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

const UserProfile: React.FC = () => {
  const { user } = useUser(); // user.id, user.displayName, user.email, user.auth
  const [modalOpen, setModalOpen] = useState<'name' | 'email' | 'password' | null>(null);
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
    if (!user?.id || !user?.auth) return;
    setLoading(true);
    try {
      if (modalOpen === 'name') {
        await updateDoc(doc(db, 'users', user.id), {
          displayName: inputValue,
        });
      } else if (modalOpen === 'email') {
        await updateEmail(user.auth, inputValue);
        await updateDoc(doc(db, 'users', user.id), {
          email: inputValue,
        });
      } else if (modalOpen === 'password') {
        await updatePassword(user.auth, inputValue);
      }
      showMessage('Updated successfully!', 'success');
    } catch (err: any) {
      console.error(err);
      showMessage(err.message || 'Update failed.', 'error');
    } finally {
      setLoading(false);
      setModalOpen(null);
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
              setModalOpen('name');
              setInputValue(user?.displayName || '');
            }}>
              Edit
            </Button>
          </div>

          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <p className="font-semibold">Email</p>
              <p>{user?.email || '—'}</p>
            </div>
            <Button onClick={() => {
              setModalOpen('email');
              setInputValue(user?.email || '');
            }}>
              Edit
            </Button>
          </div>

          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <p className="font-semibold">Password</p>
              <p>••••••••</p>
            </div>
            <Button onClick={() => {
              setModalOpen('password');
              setInputValue('');
            }}>
              Change
            </Button>
          </div>
        </div>

        <Modal
          isOpen={modalOpen !== null}
          onClose={() => setModalOpen(null)}
          title={`Update ${modalOpen}`}
        >
          <input
            type={modalOpen === 'password' ? 'password' : 'text'}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Enter new ${modalOpen}`}
            className="w-full border p-2 rounded mt-4"
          />
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setModalOpen(null)}>Cancel</Button>
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
