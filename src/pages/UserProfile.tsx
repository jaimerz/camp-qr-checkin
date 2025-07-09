import React, { useState } from 'react';
import { updateEmail, updatePassword, updateProfile } from 'firebase/auth';
import { doc, updateDoc, getFirestore } from 'firebase/firestore';
import { useAuth } from '../context/UserContext';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import AuthGuard from '../components/AuthGuard';

const UserProfile: React.FC = () => {
  const { user, firebaseUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(firebaseUser?.email || '');
  const [password, setPassword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalText, setModalText] = useState('');
  const [saving, setSaving] = useState(false);

  const showModal = (msg: string) => {
    setModalText(msg);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!firebaseUser) return;

    setSaving(true);
    try {
      const promises: Promise<any>[] = [];

      if (name && name !== firebaseUser.displayName) {
        promises.push(updateProfile(firebaseUser, { displayName: name }));
      }

      if (email && email !== firebaseUser.email) {
        promises.push(updateEmail(firebaseUser, email));
      }

      if (password) {
        promises.push(updatePassword(firebaseUser, password));
      }

      if (user?.id) {
        const ref = doc(getFirestore(), 'users', user.id);
        promises.push(updateDoc(ref, { name, email }));
      }

      await Promise.all(promises);
      showModal('Profile updated successfully.');
    } catch (err: any) {
      console.error(err);
      showModal(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthGuard>
      <div className="max-w-xl mx-auto mt-8 p-6 bg-white rounded shadow space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">User Profile</h1>
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm text-gray-700">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border p-2 rounded mt-1"
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border p-2 rounded mt-1"
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-700">New Password</span>
            <input
              type="password"
              value={password}
              placeholder="Leave blank to keep current password"
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border p-2 rounded mt-1"
            />
          </label>
          <Button disabled={saving} onClick={handleSave}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Update Status">
          <p>{modalText}</p>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setModalOpen(false)}>OK</Button>
          </div>
        </Modal>
      </div>
    </AuthGuard>
  );
};

export default UserProfile;
