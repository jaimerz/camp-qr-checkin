import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import AuthGuard from '../components/AuthGuard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/ui/Modal';
import { getAllUsers, updateUser, deleteUserFromDatabase } from '../utils/firebase';
import { User } from '../types';

const ManageUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmText, setConfirmText] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'leader' | 'admin'>('leader');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const normalize = (s: string) => s.trim().toLowerCase();
  const matchesSearch = (u: User) =>
    normalize(u.displayName).includes(normalize(searchQuery)) ||
    normalize(u.email).includes(normalize(searchQuery));

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const data = await getAllUsers();
        const sortedData = data.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setUsers(sortedData);
      } catch (error) {
        console.error('Error loading users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(null), 3000);
  };

  const openConfirmModal = (text: string, onConfirm: () => void) => {
    setConfirmText(text);
    setConfirmAction(() => onConfirm);
    setModalOpen(true);
  };

  const handleDelete = (user: User) => {
    openConfirmModal(`Are you sure you want to delete ${user.displayName}?`, async () => {
      try {
        await deleteUserFromDatabase(user.id);
        const updatedList = users.filter((u) => u.id !== user.id);
        setUsers(updatedList);
        showMessage('User deleted successfully', 'success');
      } catch (error) {
        console.error('Error deleting user:', error);
        showMessage('Error deleting user', 'error');
      } finally {
        setModalOpen(false);
      }
    });
  };

  const handleBulkAction = () => {
    if (bulkAction === 'delete') {
      const count = selectedIds.length;
      if (count === 0) return;

      openConfirmModal(
        `Are you sure you want to delete ${count} user${count > 1 ? 's' : ''}?`,
        async () => {
          try {
            for (const id of selectedIds) {
              await deleteUserFromDatabase(id);
            }
            const updatedList = users.filter((u) => !selectedIds.includes(u.id));
            setUsers(updatedList);
            setSelectedIds([]);
            setBulkAction('');
            showMessage('Selected users deleted.', 'success');
          } catch (err) {
            console.error('Bulk delete error:', err);
            showMessage('Failed to delete some users.', 'error');
          } finally {
            setModalOpen(false);
          }
        }
      );
    }
  };

  const openEditModal = (user: User) => {
    setEditUser(user);
    setEditName(user.displayName);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditModalOpen(true);
  };

  const saveEdit = async () => {
    if (!editUser) return;

    try {
      const updates: Partial<User> = { displayName: editName, email: editEmail };
      await updateUser(editUser.id, updates);

      const updatedList = users.map((u) =>
        u.id === editUser.id ? { ...u, displayName: editName, email: editEmail } : u
      );

      setUsers(updatedList);
      setEditModalOpen(false);
      showMessage('User updated.', 'success');
    } catch (err) {
      console.error('Error updating user:', err);
      showMessage('Failed to update user.', 'error');
    }
  };

  const confirmRoleChange = () => {
    if (!editUser) return;

    if (editUser.role === editRole) {
      saveEdit();
      return;
    }

    // Close edit modal BEFORE opening confirmation modal
    setEditModalOpen(false);

    openConfirmModal(
      `Are you sure you want to change ${editUser.displayName}'s role from ${editUser.role} to ${editRole}?`,
      async () => {
        try {
          await updateUser(editUser.id, {
            displayName: editName,
            email: editEmail,
            role: editRole,
          });

          const updatedList = users.map((u) =>
            u.id === editUser.id ? { ...u, displayName: editName, email: editEmail, role: editRole } : u
          );

          setUsers(updatedList);
          showMessage('User role updated.', 'success');
        } catch (err) {
          console.error('Error updating user:', err);
          showMessage('Failed to update user role.', 'error');
        } finally {
          setModalOpen(false);
        }
      }
    );
  };

  if (loading) return <LoadingSpinner />;

  return (
    <AuthGuard requiredRole="admin">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>

        {message && (
          <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 shadow-lg text-sm px-4 py-2 rounded-md border transition-opacity duration-300 ${
            messageType === 'success'
              ? 'bg-green-50 text-green-800 border-green-300'
              : 'bg-red-50 text-red-800 border-red-300'
          }`}>
            {message}
          </div>
        )}

        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Please Confirm">
          <p>{confirmText}</p>
          <div className="mt-4 flex space-x-3">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmAction()}>Confirm</Button>
          </div>
        </Modal>

        <div className="flex items-center space-x-3 mb-4">
          <select
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
            className="border border-gray-300 rounded-md p-2 text-sm"
          >
            <option value="">Bulk Actions</option>
            <option value="delete">Delete Selected</option>
          </select>
          <Button
            variant="destructive"
            disabled={selectedIds.length === 0 || !bulkAction}
            onClick={handleBulkAction}
          >
            Apply
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center space-x-3 w-full md:w-auto">
              <input
                type="checkbox"
                checked={users.length > 0 && selectedIds.length === users.length}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedIds(users.map((u) => u.id));
                  } else {
                    setSelectedIds([]);
                  }
                }}
                className="h-4 w-4"
              />
              <CardTitle>
                All Users ({users.filter(matchesSearch).length} / {users.length})
              </CardTitle>
            </div>
            <input
              type="text"
              placeholder="Search by name or email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-gray-300 rounded-md px-4 py-2 w-full md:w-1/3"
            />
          </CardHeader>

          <CardContent>
            {users.length > 0 ? (
              <div className="space-y-2">
                {users.filter(matchesSearch).map((user) => (
                  <div
                    key={user.id}
                    className="p-3 bg-white border border-gray-200 rounded-md flex justify-between items-center hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds([...selectedIds, user.id]);
                          } else {
                            setSelectedIds(selectedIds.filter((id) => id !== user.id));
                          }
                        }}
                      />
                      <div>
                        <p className="font-medium">{user.displayName}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-500">{user.role}</span>
                      <Button variant="outline" size="sm" onClick={() => openEditModal(user)}>Edit</Button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">No users found.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit User">
        <div className="space-y-4">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full border p-2 rounded mt-4"
            placeholder="Name"
            required
          />
          <input
            type="email"
            value={editEmail}
            disabled
            onChange={(e) => setEditEmail(e.target.value)}
            className="w-full border p-2 rounded"
            placeholder="Email"
            required
          />
          <select
            value={editRole}
            onChange={(e) => setEditRole(e.target.value as 'leader' | 'admin')}
            className="w-full border p-2 rounded"
          >
            <option value="leader">Leader</option>
            <option value="admin">Admin</option>
          </select>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancel</Button>
            <Button onClick={confirmRoleChange}>Save</Button>
          </div>
        </div>
      </Modal>
    </AuthGuard>
  );
};

export default ManageUsers;
