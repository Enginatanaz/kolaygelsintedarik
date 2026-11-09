import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { bootstrapSystemData } from '../services/seedService';
import { registerServiceWorkerAndPush, unregisterDeviceTokenOnLogout } from '../services/notificationService';

export function getSessionToken(): string | null {
  return localStorage.getItem('tedarik360_session_token');
}

interface AuthContextType {
  currentUser: { uid: string } | null;
  userProfile: UserProfile | null;
  sessionToken: string | null;
  loading: boolean;
  loginWithUsername: (username: string, password: string) => Promise<void>;
  updateUserProfile: (updater: Partial<UserProfile>) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<{ uid: string } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore authenticated session from localStorage
  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem('tedarik360_session_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          setSessionToken(storedToken);
          setCurrentUser({ uid: data.user.uid });
          setUserProfile(data.user);
          bootstrapSystemData();
          registerServiceWorkerAndPush({ requestPermission: false }).catch(() => {});
        } else {
          localStorage.removeItem('tedarik360_session_token');
          setSessionToken(null);
          setCurrentUser(null);
          setUserProfile(null);
        }
      } catch (err) {
        console.error('Session restore error:', err);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const loginWithUsername = async (username: string, password: string) => {
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || !password) {
      throw new Error('Kullanıcı adı ve şifre gereklidir.');
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Requirement 10: Print real Firebase / Server error code to console
        console.error(`[Firebase Auth Error Code]: ${data.code || 'auth/unknown'} - ${data.error}`);
        throw new Error(data.error || 'Giriş yapılamadı.');
      }

      // Success: Save token & user
      localStorage.setItem('tedarik360_session_token', data.token);
      setSessionToken(data.token);
      setCurrentUser({ uid: data.user.uid });
      setUserProfile(data.user);

      bootstrapSystemData();
      registerServiceWorkerAndPush({ requestPermission: false }).catch(() => {});
    } catch (err: any) {
      console.error('[Firebase Auth Error Caught]:', err.message);
      throw err;
    }
  };

  const updateUserProfile = (updater: Partial<UserProfile>) => {
    setUserProfile((prev) => (prev ? { ...prev, ...updater } : null));
  };

  const signOut = async () => {
    try {
      await unregisterDeviceTokenOnLogout(currentUser?.uid);
      localStorage.removeItem('tedarik360_session_token');
      setSessionToken(null);
      setCurrentUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error('Sign Out Error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        sessionToken,
        loading,
        loginWithUsername,
        updateUserProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
