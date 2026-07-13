import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, registerUnauthorizedHandler, setAuthToken } from '../services/api';

export type User = {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  role: string;
  telefono?: string | null;
  direccion?: string | null;
  fecha_ingreso?: string | null;
  dias_vacaciones_disponibles?: number | null;
  foto_perfil_url?: string | null;
  credencial_url?: string | null;
  email_verificado?: boolean;
};

type Permisos = {
  asistencia?: boolean;
  contratos?: boolean;
  nomina?: boolean;
  vacaciones?: boolean;
};

type ThemeMode = 'light' | 'dark';

type State = {
  token: string | null;
  user: User | null;
  permisos: Permisos;
  ready: boolean;
  theme: ThemeMode;
};

type CtxType = State & {
  setAuth: (token: string, user: User) => Promise<void>;
  updateUser: (user: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  loadPermisos: () => Promise<void>;
  toggleTheme: () => Promise<void>;
};

const STORAGE_KEY = '@rrhh_auth';
const THEME_KEY = '@rrhh_theme';

const Ctx = createContext<CtxType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({
    token: null,
    user: null,
    permisos: {},
    ready: false,
    theme: 'light',
  });

  async function loadPermisos() {
    try {
      const { data } = await api.get('/permisos/me');

      setState((s) => ({
        ...s,
        permisos: data?.permisos || {},
      }));
    } catch {
      setState((s) => ({
        ...s,
        permisos: {},
      }));
    }
  }

  async function hydrate() {
    try {
      const [rawAuth, rawTheme] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(THEME_KEY),
      ]);

      const theme: ThemeMode = rawTheme === 'dark' ? 'dark' : 'light';

      if (!rawAuth) {
        setAuthToken(null);

        setState({
          token: null,
          user: null,
          permisos: {},
          ready: true,
          theme,
        });

        return;
      }

      const parsed = JSON.parse(rawAuth);
      const token = parsed?.token ?? null;
      const user = parsed?.user ?? null;

      setAuthToken(token);

      setState({
        token,
        user,
        permisos: {},
        ready: false,
        theme,
      });

      if (token) {
        await loadPermisos();
      }

      setState((s) => ({
        ...s,
        ready: true,
        theme,
      }));
    } catch {
      setAuthToken(null);
      await AsyncStorage.removeItem(STORAGE_KEY);

      setState({
        token: null,
        user: null,
        permisos: {},
        ready: true,
        theme: 'light',
      });
    }
  }

  async function setAuth(token: string, user: User) {
    setAuthToken(token);

    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token,
        user,
      })
    );

    setState((s) => ({
      ...s,
      token,
      user,
      permisos: {},
      ready: false,
    }));

    await loadPermisos();

    setState((s) => ({
      ...s,
      ready: true,
    }));
  }

  async function updateUser(userData: Partial<User>) {
    const nextUser = state.user ? { ...state.user, ...userData } : null;

    if (!nextUser) return;

    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token: state.token,
        user: nextUser,
      })
    );

    setState((s) => ({
      ...s,
      user: nextUser,
    }));
  }

  async function toggleTheme() {
    const nextTheme: ThemeMode = state.theme === 'dark' ? 'light' : 'dark';

    await AsyncStorage.setItem(THEME_KEY, nextTheme);

    setState((s) => ({
      ...s,
      theme: nextTheme,
    }));
  }

  async function logout() {
    setAuthToken(null);
    await AsyncStorage.removeItem(STORAGE_KEY);

    setState((s) => ({
      token: null,
      user: null,
      permisos: {},
      ready: true,
      theme: s.theme,
    }));
  }

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      logout();
    });

    hydrate();
  }, []);

  const value = useMemo<CtxType>(
    () => ({
      token: state.token,
      user: state.user,
      permisos: state.permisos,
      ready: state.ready,
      theme: state.theme,
      setAuth,
      updateUser,
      logout,
      hydrate,
      loadPermisos,
      toggleTheme,
    }),
    [state]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);

  if (!v) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return v;
}