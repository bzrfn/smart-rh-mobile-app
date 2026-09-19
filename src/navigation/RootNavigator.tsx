import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  Theme,
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
import ContratosScreen from '../modules/contratos/ContratosScreen';
import NominaScreen from '../modules/nomina/NominaScreen';
import VacacionesScreen from '../modules/vacaciones/VacacionesScreen';
import AdminUsuariosScreen from '../modules/admin/AdminUsuariosScreen';
import CredencialScreen from '../modules/documentos/CredencialScreen';
import VerificarCredencialScreen from '../modules/documentos/VerificarCredencialScreen';
import DocumentosScreen from '../modules/documentos/DocumentosScreen';
import NotificacionesScreen from '../modules/notificaciones/NotificacionesScreen';
import ActividadScreen from '../modules/actividad/ActividadScreen';
import PerfilScreen from '../modules/perfil/PerfilScreen';
import SoporteScreen from '../modules/soporte/SoporteScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { correo?: string } | undefined;
  VerifyLoginCode: { correo: string };
  VerifyAccount: { correo: string };

  Home: undefined;
  QrScan: undefined;
  Asistencia: undefined;
  Contratos: undefined;
  Nomina: undefined;
  Vacaciones: undefined;
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

function getColors(isDark: boolean) {
  return {
    background: isDark ? '#07111F' : '#F4F7FB',
    surface: isDark ? '#0F1B2D' : '#FFFFFF',
    primary: isDark ? '#38BDF8' : '#0A57A4',
    teal: isDark ? '#2DD4BF' : '#22B8B0',
    text: isDark ? '#F8FAFC' : '#0F172A',
    textMuted: isDark ? '#9FB0C4' : '#5B6B81',
    border: isDark ? '#26364D' : '#D9E1EC',
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
  const { token, ready, theme } = useAuth();

  const isDark = theme === 'dark';
  const colors = getColors(isDark);
  const styles = getStyles(isDark);

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
    <NavigationContainer theme={buildNavTheme(isDark)}>
      {token ? <AppNavigator /> : <AuthNavigator />}
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
          fontWeight: '800',
          color: colors.primary,
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

function AppNavigator() {
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
          fontWeight: '900',
          color: colors.primary,
          fontSize: 20,
        },
        headerBackTitleVisible: false,
        headerTitleAlign: 'center',
        contentStyle: {
          backgroundColor: colors.background,
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'SMART RH',
          headerTitleStyle: {
            fontWeight: '900',
            color: colors.primary,
            fontSize: 22,
          },
        }}
      />

      <Stack.Screen name="QrScan" component={QrScanScreen} options={{ title: 'Escanear QR' }} />
      <Stack.Screen name="Asistencia" component={AsistenciaScreen} options={{ title: 'Asistencia' }} />
      <Stack.Screen name="Contratos" component={ContratosScreen} options={{ title: 'Contratos' }} />
      <Stack.Screen name="Nomina" component={NominaScreen} options={{ title: 'Nóminas' }} />
      <Stack.Screen name="Vacaciones" component={VacacionesScreen} options={{ title: 'Vacaciones' }} />
      <Stack.Screen name="Credencial" component={CredencialScreen} options={{ title: 'Credencial digital' }} />
      <Stack.Screen
        name="VerificarCredencial"
        component={VerificarCredencialScreen}
        options={{ title: 'Verificar credencial' }}
      />
      <Stack.Screen name="Documentos" component={DocumentosScreen} options={{ title: 'Documentos' }} />
      <Stack.Screen name="Notificaciones" component={NotificacionesScreen} options={{ title: 'Notificaciones' }} />
      <Stack.Screen name="Actividad" component={ActividadScreen} options={{ title: 'Actividad reciente' }} />
      <Stack.Screen name="Perfil" component={PerfilScreen} options={{ title: 'Perfil del empleado' }} />
      <Stack.Screen name="Soporte" component={SoporteScreen} options={{ title: 'Soporte' }} />
      <Stack.Screen name="AdminUsuarios" component={AdminUsuariosScreen} options={{ title: 'Administrar accesos' }} />
    </Stack.Navigator>
  );
}

function getStyles(isDark: boolean) {
  const colors = getColors(isDark);

  return StyleSheet.create({
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
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.28 : 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
      borderWidth: 1,
      borderColor: colors.border,
    },
    loadingBrand: {
      fontSize: 26,
      fontWeight: '900',
      color: colors.primary,
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