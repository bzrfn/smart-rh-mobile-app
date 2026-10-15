import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  Theme,
  useNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../contexts/AuthContext';

import LoginScreen from '../modules/auth/LoginScreen';
import RegisterScreen from '../modules/auth/RegisterScreen';
import ForgotPasswordScreen from '../modules/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../modules/auth/ResetPasswordScreen';
import VerifyLoginCodeScreen from '../modules/auth/VerifyLoginCodeScreen';
import VerifyAccountScreen from '../modules/auth/VerifyAccountScreen';
import HomeScreen from '../modules/auth/HomeScreen';

import QrScanScreen from '../modules/asistencia/QrScanScreen';
import AsistenciaScreen from '../modules/asistencia/AsistenciaScreen';
import CalendarioLaboralScreen from '../modules/calendario/CalendarioLaboralScreen';
import MaxAssistantFloating from '../modules/chatbot/MaxAssistantFloating';
import ContratosScreen from '../modules/contratos/ContratosScreen';
import NominaScreen from '../modules/nomina/NominaScreen';
import VacacionesScreen from '../modules/vacaciones/VacacionesScreen';
import IncapacidadesScreen from '../modules/incapacidades/IncapacidadesScreen';
import AdminAsistenciaPendientesScreen from '../modules/admin/AdminAsistenciaPendientesScreen';
import AdminDashboardScreen from '../modules/admin/AdminDashboardScreen';
import AdminIncapacidadesRevisionScreen from '../modules/admin/AdminIncapacidadesRevisionScreen';
import AdminPerfilScreen from '../modules/admin/AdminPerfilScreen';
import AdminUsuariosScreen from '../modules/admin/AdminUsuariosScreen';
import CredencialScreen from '../modules/documentos/CredencialScreen';
import VerificarCredencialScreen from '../modules/documentos/VerificarCredencialScreen';
import DocumentosScreen from '../modules/documentos/DocumentosScreen';
import NotificacionesScreen from '../modules/notificaciones/NotificacionesScreen';
import ActividadScreen from '../modules/actividad/ActividadScreen';
import PerfilScreen from '../modules/perfil/PerfilScreen';
import SoporteScreen from '../modules/soporte/SoporteScreen';
import SmartRhSessionLayer from '../components/SmartRhSessionLayer';
import { getSmartRhColors, getSmartRhShadow } from '../design/smartRhTheme';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword:
    | {
        correo?: string;
        fromProfile?: boolean;
      }
    | undefined;
  VerifyLoginCode: {
    correo: string;
    challengeId: string;
  };
  VerifyAccount: { correo: string };

  Home: undefined;
  AdminDashboard: undefined;
  AdminAsistenciaPendientes: undefined;
  AdminIncapacidadesRevision: undefined;
  AdminPerfil: undefined;
  QrScan: undefined;
  Asistencia: undefined;
  CalendarioLaboral: undefined;
  Contratos: undefined;
  Nomina: undefined;
  Vacaciones: undefined;
  Incapacidades: undefined;
  AdminUsuarios: undefined;
  Credencial: undefined;
  VerificarCredencial: undefined;
  Documentos: undefined;
  Notificaciones: undefined;
  Actividad: undefined;
  Perfil: undefined;
  Soporte: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function isAdminRole(role?: string | null) {
  return String(role || '').trim().toLowerCase() === 'admin';
}

function getColors(isDark: boolean) {
  const colors = getSmartRhColors(isDark);

  return {
    background: colors.background,
    surface: colors.card,
    primary: colors.primary,
    teal: colors.success,
    text: colors.text,
    textMuted: colors.textMuted,
    border: colors.border,
  };
}

function buildNavTheme(isDark: boolean): Theme {
  const colors = getColors(isDark);

  return {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
      notification: colors.teal,
    },
  };
}

export default function RootNavigator() {
  const { token, ready, theme, user } = useAuth();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  const isDark = theme === 'dark';
  const colors = getColors(isDark);
  const styles = getStyles(isDark);

  function navigateFromSession(route: string) {
    if (!navigationRef.isReady()) return;

    (navigationRef as any).navigate(route);
  }

  if (!ready) {
    return (
      <View style={styles.loadingScreen}>
        <View style={styles.loadingCard}>
          <Text style={styles.loadingBrand}>SMART RH</Text>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={styles.loadingText}>Cargando sesión...</Text>
        </View>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={buildNavTheme(isDark)}>
      <View style={styles.navigationHost}>
        <View style={token ? styles.navigatorFrameWithSession : styles.navigatorFrame}>
          {token ? (
            isAdminRole(user?.role) ? (
              <AdminNavigator />
            ) : (
              <EmployeeNavigator />
            )
          ) : (
            <AuthNavigator />
          )}
        </View>

        {token ? (
          <SmartRhSessionLayer
            isDark={isDark}
            onNavigate={navigateFromSession}
          />
        ) : null}

        {token ? <MaxAssistantFloating /> : null}
      </View>
    </NavigationContainer>
  );
}

function AuthNavigator() {
  const { theme } = useAuth();
  const isDark = theme === 'dark';
  const colors = getColors(isDark);

  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerShadowVisible: false,
        headerTintColor: colors.primary,
        headerTitleStyle: {
          fontWeight: '700',
          color: colors.text,
          fontSize: 18,
        },
        headerBackTitleVisible: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{
          title: 'Iniciar sesión',
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="VerifyLoginCode"
        component={VerifyLoginCodeScreen}
        options={{
          title: 'Código de acceso',
          headerTransparent: true,
          headerTitle: '',
        }}
      />

      <Stack.Screen
        name="VerifyAccount"
        component={VerifyAccountScreen}
        options={{
          title: 'Confirmar cuenta',
          headerTransparent: true,
          headerTitle: '',
        }}
      />

      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          title: 'Crear cuenta',
          headerTransparent: true,
          headerTitle: '',
        }}
      />

      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{
          title: 'Recuperar contraseña',
          headerTransparent: true,
          headerTitle: '',
        }}
      />

      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{
          title: 'Restablecer contraseña',
          headerTransparent: true,
          headerTitle: '',
        }}
      />
    </Stack.Navigator>
  );
}

function EmployeeNavigator() {
  const { theme } = useAuth();
  const isDark = theme === 'dark';
  const colors = getColors(isDark);

  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerShadowVisible: false,
        headerTintColor: colors.primary,
        headerTitleStyle: {
          fontWeight: '700',
          color: colors.text,
          fontSize: 20,
        },
        headerBackTitleVisible: false,
        headerTitleAlign: 'center',
        contentStyle: {
          backgroundColor: colors.background,
        },
        animation: 'fade',
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'SMART RH',
          headerShown: false,
          headerTitleStyle: {
            fontWeight: '700',
            color: colors.text,
            fontSize: 22,
          },
        }}
      />

      <Stack.Screen name="QrScan" component={QrScanScreen} options={{ title: 'Escanear QR' }} />
      <Stack.Screen name="Asistencia" component={AsistenciaScreen} options={{ title: 'Asistencia' }} />
      <Stack.Screen name="CalendarioLaboral" component={CalendarioLaboralScreen} options={{ title: 'Calendario laboral' }} />
      <Stack.Screen name="Contratos" component={ContratosScreen} options={{ title: 'Contratos' }} />
      <Stack.Screen name="Nomina" component={NominaScreen} options={{ title: 'Nóminas' }} />
      <Stack.Screen name="Vacaciones" component={VacacionesScreen} options={{ title: 'Vacaciones' }} />
<Stack.Screen
  name="Incapacidades"
  component={IncapacidadesScreen}
  options={{ title: 'Incapacidades' }}
/>
      <Stack.Screen name="Credencial" component={CredencialScreen} options={{ title: 'Credencial digital' }} />
      <Stack.Screen name="Documentos" component={DocumentosScreen} options={{ title: 'Documentos' }} />
      <Stack.Screen name="Notificaciones" component={NotificacionesScreen} options={{ title: 'Notificaciones' }} />
      <Stack.Screen name="Actividad" component={ActividadScreen} options={{ title: 'Actividad reciente' }} />
      <Stack.Screen name="Perfil" component={PerfilScreen} options={{ title: 'Perfil del empleado' }} />
      <Stack.Screen name="Soporte" component={SoporteScreen} options={{ title: 'Soporte' }} />
      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{ title: 'Cambiar contraseña' }}
      />
    </Stack.Navigator>
  );
}

function AdminNavigator() {
  const { theme } = useAuth();
  const isDark = theme === 'dark';
  const colors = getColors(isDark);

  return (
    <Stack.Navigator
      initialRouteName="AdminDashboard"
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerShadowVisible: false,
        headerTintColor: colors.primary,
        headerTitleStyle: {
          fontWeight: '700',
          color: colors.text,
          fontSize: 20,
        },
        headerBackTitleVisible: false,
        headerTitleAlign: 'center',
        contentStyle: {
          backgroundColor: colors.background,
        },
        animation: 'fade',
      }}
    >
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{
          title: 'Panel admin',
          headerShown: false,
          headerTitleStyle: {
            fontWeight: '700',
            color: colors.text,
            fontSize: 22,
          },
        }}
      />
      <Stack.Screen
        name="VerificarCredencial"
        component={VerificarCredencialScreen}
        options={{ title: 'Verificar credencial' }}
      />
      <Stack.Screen
        name="CalendarioLaboral"
        component={CalendarioLaboralScreen}
        options={{ title: 'Calendario laboral' }}
      />
      <Stack.Screen
        name="AdminUsuarios"
        component={AdminUsuariosScreen}
        options={{ title: 'Administrar accesos' }}
      />
      <Stack.Screen
        name="AdminAsistenciaPendientes"
        component={AdminAsistenciaPendientesScreen}
        options={{ title: 'Pendientes de asistencia' }}
      />
      <Stack.Screen
        name="AdminIncapacidadesRevision"
        component={AdminIncapacidadesRevisionScreen}
        options={{ title: 'Incapacidades por revisar' }}
      />
      <Stack.Screen
        name="Notificaciones"
        component={NotificacionesScreen}
        options={{ title: 'Notificaciones admin' }}
      />
      <Stack.Screen
        name="Soporte"
        component={SoporteScreen}
        options={{ title: 'Soporte' }}
      />
      <Stack.Screen
        name="AdminPerfil"
        component={AdminPerfilScreen}
        options={{ title: 'Perfil admin' }}
      />
      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{ title: 'Cambiar contraseña' }}
      />
    </Stack.Navigator>
  );
}

function getStyles(isDark: boolean) {
  const colors = getColors(isDark);
  const shadow = getSmartRhShadow(isDark);

  return StyleSheet.create({
    navigationHost: {
      flex: 1,
      backgroundColor: colors.background,
    },
    navigatorFrame: {
      flex: 1,
      backgroundColor: colors.background,
    },
    navigatorFrameWithSession: {
      flex: 1,
      paddingBottom: 96,
      backgroundColor: colors.background,
    },
    loadingScreen: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    loadingCard: {
      width: '100%',
      maxWidth: 280,
      backgroundColor: colors.surface,
      borderRadius: 28,
      paddingVertical: 28,
      paddingHorizontal: 24,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow,
      borderWidth: 1,
      borderColor: colors.border,
    },
    loadingBrand: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: 0.6,
      marginBottom: 16,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: '700',
    },
  });
}
