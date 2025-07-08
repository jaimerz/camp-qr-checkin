// context/UserContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentUser } from '../utils/firebase';
import { User } from '../types';

interface UserContextType {
  user: User | null;
  loading: boolean;
}

const UserContext = createContext<UserContextType>({ user: null, loading: true });

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await getCurrentUser();
        setUser(result?.userData || null);
      } catch (e) {
        console.error('Failed to load user', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
