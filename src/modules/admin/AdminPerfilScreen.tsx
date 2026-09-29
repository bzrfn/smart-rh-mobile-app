import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';

function getInitials(nombre?: string, apellido?: string) {
  const n = nombre?.trim()?.[0] || '';
  const a = apellido?.trim()?.[0] || '';

  return `${n}${a}`.toUpperCase() || 'AD';
}

export default function AdminPerfilScreen() {
  const { user, theme, toggleTheme, logout } = useAuth();

  const isDark = theme === 'dark';
  const styles = getStyles(isDark);

  function confirmLogout() {
    Alert.alert('Cerrar sesión', '¿Deseas salir de tu cuenta administrativa?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: logout,
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {getInitials(user?.nombre, user?.apellido)}
            </Text>
          </View>

          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>Cuenta administrativa</Text>
            <Text style={styles.title}>
              {user?.nombre} {user?.apellido}
            </Text>
            <Text style={styles.subtitle}>{user?.correo}</Text>

            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{user?.role || 'admin'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de acceso</Text>
          <InfoRow label="Nombre" value={`${user?.nombre || ''} ${user?.apellido || ''}`} styles={styles} />
          <InfoRow label="Correo" value={user?.correo || 'No registrado'} styles={styles} />
          <InfoRow label="Rol" value={user?.role || 'Admin'} styles={styles} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alcance móvil</Text>
          <View style={styles.scopeItem}>
            <Text style={styles.scopeTitle}>Validación de credenciales</Text>
            <Text style={styles.scopeText}>
              Permite verificar la vigencia e identidad de una credencial laboral mediante QR.
            </Text>
          </View>
          <View style={styles.scopeItem}>
            <Text style={styles.scopeTitle}>Revisión administrativa</Text>
            <Text style={styles.scopeText}>
              Muestra pendientes de asistencia, incapacidades y avisos administrativos.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferencias</Text>

          <Pressable style={styles.themeButton} onPress={toggleTheme}>
            <Text style={styles.themeButtonText}>
              {isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            </Text>
          </Pressable>

          <Pressable style={styles.logoutButton} onPress={confirmLogout}>
            <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: any;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function getColors(isDark: boolean) {
  return {
    background: isDark ? '#07111F' : '#F4F7FB',
    card: isDark ? '#0F1B2D' : '#FFFFFF',
    cardSoft: isDark ? '#111F33' : '#F9FBFD',
    primary: isDark ? '#38BDF8' : '#0A57A4',
    primarySoft: isDark ? 'rgba(56,189,248,0.14)' : 'rgba(10,87,164,0.10)',
    teal: isDark ? '#2DD4BF' : '#22B8B0',
    tealBg: isDark ? 'rgba(45,212,191,0.14)' : 'rgba(34,184,176,0.12)',
    text: isDark ? '#F8FAFC' : '#0F172A',
    muted: isDark ? '#9FB0C4' : '#5B6B81',
    border: isDark ? '#26364D' : '#D9E1EC',
    danger: isDark ? '#FCA5A5' : '#B42318',
    dangerBg: isDark ? 'rgba(248,113,113,0.12)' : 'rgba(180,35,24,0.08)',
  };
}

function getStyles(isDark: boolean) {
  const COLORS = getColors(isDark);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    container: { padding: 20, gap: 16, paddingBottom: 40 },
    hero: {
      backgroundColor: COLORS.card,
      borderRadius: 28,
      padding: 22,
      borderWidth: 1,
      borderColor: COLORS.border,
      flexDirection: 'row',
      gap: 16,
      alignItems: 'center',
    },
    avatar: {
      width: 82,
      height: 82,
      borderRadius: 26,
      backgroundColor: COLORS.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    avatarText: {
      color: COLORS.primary,
      fontSize: 26,
      fontWeight: '900',
    },
    heroText: { flex: 1 },
    eyebrow: {
      color: COLORS.teal,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    title: {
      marginTop: 8,
      color: COLORS.text,
      fontSize: 24,
      fontWeight: '900',
      lineHeight: 30,
    },
    subtitle: {
      marginTop: 6,
      color: COLORS.muted,
      fontSize: 14,
      lineHeight: 20,
    },
    roleBadge: {
      alignSelf: 'flex-start',
      marginTop: 12,
      backgroundColor: COLORS.tealBg,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    roleBadgeText: {
      color: COLORS.teal,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    section: {
      backgroundColor: COLORS.card,
      borderRadius: 22,
      padding: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 10,
    },
    sectionTitle: {
      color: COLORS.text,
      fontSize: 20,
      fontWeight: '900',
    },
    infoRow: {
      borderRadius: 16,
      backgroundColor: COLORS.cardSoft,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 14,
    },
    infoLabel: {
      color: COLORS.muted,
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    infoValue: {
      marginTop: 5,
      color: COLORS.text,
      fontSize: 15,
      fontWeight: '800',
      lineHeight: 21,
    },
    scopeItem: {
      borderRadius: 16,
      backgroundColor: COLORS.cardSoft,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 14,
    },
    scopeTitle: {
      color: COLORS.text,
      fontSize: 15,
      fontWeight: '900',
    },
    scopeText: {
      marginTop: 5,
      color: COLORS.muted,
      lineHeight: 20,
      fontSize: 13,
    },
    themeButton: {
      minHeight: 50,
      borderRadius: 16,
      backgroundColor: COLORS.primarySoft,
      borderWidth: 1,
      borderColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeButtonText: {
      color: COLORS.primary,
      fontSize: 15,
      fontWeight: '900',
    },
    logoutButton: {
      minHeight: 50,
      borderRadius: 16,
      backgroundColor: COLORS.dangerBg,
      borderWidth: 1,
      borderColor: COLORS.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoutButtonText: {
      color: COLORS.danger,
      fontSize: 15,
      fontWeight: '900',
    },
  });
}
