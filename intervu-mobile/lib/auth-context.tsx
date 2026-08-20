import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth as authStore, type LoginResponse } from './api';

type AuthContextType = {
  user: LoginResponse | null;
  isLoading: boolean;
  login: (data: LoginResponse) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LoginResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate from SecureStore on mount
  useEffect(() => {
    authStore.load().then((stored) => {
      setUser(stored);
      setIsLoading(false);
    });
  }, []);

  const login = async (data: LoginResponse) => {
    await authStore.save(data);
    setUser(data);
  };

  const logout = async () => {
    await authStore.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
