import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

type Props = {
  navigation: any;
};

type Accent = 'blue' | 'teal' | 'gold' | 'danger';

type DashboardState = {
  asistenciaPendiente: number;
  incapacidadesRevision: number;
  notificacionesPendientes: number;
};

const EMPTY_STATE: DashboardState = {
  asistenciaPendiente: 0,
  incapacidadesRevision: 0,
  notificacionesPendientes: 0,
};

function isAdminRole(role?: string | null) {
  return String(role || '').trim().toLowerCase() === 'admin';
}

function countUnreadNotifications(value: any) {
  const list = Array.isArray(value?.notificaciones) ? value.notificaciones : [];
  return list.filter((item: any) => !item?.leida).length;
}

function countIncapacidadesRevision(value: any) {
  const list = Array.isArray(value?.incapacidades) ? value.incapacidades : [];
  return list.filter((item: any) => {
    const estado = String(item?.estado || '').trim().toLowerCase();
    const revision = String(
      item?.validacion_automatica?.estado_validacion || ''
    )
      .trim()
      .toLowerCase();

    return estado === 'pendiente' || revision === 'requiere_revision';
  }).length;
}

export default function AdminDashboardScreen({ navigation }: Props) {
  const { user, token, logout, theme, toggleTheme } = useAuth();

  const isDark = theme === 'dark';
  const styles = getStyles(isDark);
  const colors = getColors(isDark);
  const isAdmin = isAdminRole(user?.role);

  const [summary, setSummary] = useState<DashboardState>(EMPTY_STATE);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const adminName = useMemo(
    () => `${user?.nombre || 'Administrador'} ${user?.apellido || ''}`.trim(),
    [user?.apellido, user?.nombre]
  );

  const loadSummary = useCallback(
    async (isRefresh = false) => {
      if (!token || !isAdmin) return;

      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        setError('');

        const [asistenciaResult, incapacidadesResult, notificacionesResult] =
          await Promise.allSettled([
            api.get('/asistencia/pendientes'),
            api.get('/incapacidades'),
            api.get('/notificaciones/mis-notificaciones'),
          ]);

        const asistenciaPendiente =
          asistenciaResult.status === 'fulfilled' &&
          Array.isArray(asistenciaResult.value?.data?.asistencias)
            ? asistenciaResult.value.data.asistencias.length
            : 0;

        const incapacidadesRevision =
          incapacidadesResult.status === 'fulfilled'
            ? countIncapacidadesRevision(incapacidadesResult.value?.data)
            : 0;

        const notificacionesPendientes =
          notificacionesResult.status === 'fulfilled'
            ? countUnreadNotifications(notificacionesResult.value?.data)
            : 0;

        setSummary({
          asistenciaPendiente,
          incapacidadesRevision,
          notificacionesPendientes,
        });

        if (
          asistenciaResult.status === 'rejected' ||
          incapacidadesResult.status === 'rejected' ||
          notificacionesResult.status === 'rejected'
        ) {
          setError('Algunos indicadores no pudieron actualizarse.');
        }
      } catch (e: any) {
        setError(
          e?.response?.data?.message ||
            'No se pudo cargar el resumen administrativo.'
        );
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [isAdmin, token]
  );

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

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

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.blockedWrap}>
          <View style={styles.card}>
            <Text style={styles.blockedTitle}>Acceso restringido</Text>
            <Text style={styles.blockedText}>
              Esta sección requiere una cuenta administradora.
            </Text>
            <Pressable style={styles.primaryButton} onPress={confirmLogout}>
              <Text style={styles.primaryButtonText}>Cerrar sesión</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadSummary(true)}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.brandPill}>
              <Text style={styles.brandPillText}>SMART RH</Text>
            </View>
            <View style={styles.adminPill}>
              <Text style={styles.adminPillText}>Admin móvil</Text>
            </View>
          </View>

          <Text style={styles.eyebrow}>Panel administrativo</Text>
          <Text style={styles.title}>{adminName}</Text>
          <Text style={styles.subtitle}>
            Herramientas móviles para validación de credenciales, revisión de
            pendientes y seguimiento administrativo.
          </Text>
        </View>

        {loading ? (
          <View style={styles.centerCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.centerText}>Cargando resumen...</Text>
          </View>
        ) : null}

        {!!error && !loading ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.statsGrid}>
          <StatCard
            label="Asistencia"
            value={String(summary.asistenciaPendiente)}
            detail="Pendientes de revisión"
            accent={summary.asistenciaPendiente > 0 ? 'gold' : 'teal'}
            styles={styles}
          />
          <StatCard
            label="Incapacidades"
            value={String(summary.incapacidadesRevision)}
            detail="Por revisar"
            accent={summary.incapacidadesRevision > 0 ? 'gold' : 'teal'}
            styles={styles}
          />
          <StatCard
            label="Avisos"
            value={String(summary.notificacionesPendientes)}
            detail="No leídos"
            accent={summary.notificacionesPendientes > 0 ? 'gold' : 'teal'}
            styles={styles}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Herramientas admin</Text>
          <Text style={styles.sectionSubtitle}>
            Accesos separados del flujo normal del empleado.
          </Text>

          <View style={styles.actionGrid}>
            <ActionCard
              code="QR"
              title="Verificar credencial QR"
              detail="Valida identidad, vigencia y estado de la credencial."
              accent="teal"
              onPress={() => navigation.navigate('VerificarCredencial')}
              styles={styles}
            />
            <ActionCard
              code="AS"
              title="Pendientes de asistencia"
              detail={`${summary.asistenciaPendiente} registros pendientes.`}
              accent={summary.asistenciaPendiente > 0 ? 'gold' : 'blue'}
              onPress={() => navigation.navigate('AdminAsistenciaPendientes')}
              styles={styles}
            />
            <ActionCard
              code="IN"
              title="Incapacidades por revisar"
              detail={`${summary.incapacidadesRevision} solicitudes detectadas.`}
              accent={summary.incapacidadesRevision > 0 ? 'gold' : 'blue'}
              onPress={() => navigation.navigate('AdminIncapacidadesRevision')}
              styles={styles}
            />
            <ActionCard
              code="NT"
              title="Solicitudes y notificaciones"
              detail="Consulta avisos administrativos recientes."
              accent="blue"
              onPress={() => navigation.navigate('Notificaciones')}
              styles={styles}
            />
            <ActionCard
              code="PF"
              title="Perfil admin"
              detail="Datos de la cuenta administrativa."
              accent="teal"
              onPress={() => navigation.navigate('AdminPerfil')}
              styles={styles}
            />
            <ActionCard
              code="US"
              title="Usuarios y permisos"
              detail="Administración móvil existente."
              accent="blue"
              onPress={() => navigation.navigate('AdminUsuarios')}
              styles={styles}
            />
          </View>
        </View>

        <View style={styles.footerActions}>
          <Pressable style={styles.secondaryButton} onPress={toggleTheme}>
            <Text style={styles.secondaryButtonText}>
              {isDark ? 'Modo claro' : 'Modo oscuro'}
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

function StatCard({
  label,
  value,
  detail,
  accent,
  styles,
}: {
  label: string;
  value: string;
  detail: string;
  accent: Accent;
  styles: any;
}) {
  return (
    <View style={[styles.statCard, getAccentBorderStyle(accent, styles)]}>
      <View style={[styles.statDot, getAccentBgStyle(accent, styles)]} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statDetail}>{detail}</Text>
    </View>
  );
}

function ActionCard({
  code,
  title,
  detail,
  accent,
  onPress,
  styles,
}: {
  code: string;
  title: string;
  detail: string;
  accent: Accent;
  onPress: () => void;
  styles: any;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionCard,
        getAccentBorderStyle(accent, styles),
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.actionCode, getAccentBgStyle(accent, styles)]}>
        <Text style={[styles.actionCodeText, getAccentTextStyle(accent, styles)]}>
          {code}
        </Text>
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionDetail}>{detail}</Text>
    </Pressable>
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
    gold: isDark ? '#FACC15' : '#B7791F',
    goldBg: isDark ? 'rgba(250,204,21,0.14)' : 'rgba(183,121,31,0.12)',
    danger: isDark ? '#FCA5A5' : '#B42318',
    dangerBg: isDark ? 'rgba(248,113,113,0.12)' : 'rgba(180,35,24,0.08)',
    text: isDark ? '#F8FAFC' : '#0F172A',
    muted: isDark ? '#9FB0C4' : '#5B6B81',
    border: isDark ? '#26364D' : '#D9E1EC',
  };
}

function getStyles(isDark: boolean) {
  const COLORS = getColors(isDark);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    container: { padding: 20, gap: 16, paddingBottom: 40 },
    blockedWrap: {
      flex: 1,
      justifyContent: 'center',
      padding: 22,
      backgroundColor: COLORS.background,
    },
    hero: {
      backgroundColor: COLORS.card,
      borderRadius: 28,
      padding: 22,
      borderWidth: 1,
      borderColor: COLORS.border,
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.28 : 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 18,
    },
    brandPill: {
      backgroundColor: COLORS.primarySoft,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    brandPillText: {
      color: COLORS.primary,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    adminPill: {
      backgroundColor: COLORS.tealBg,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    adminPillText: {
      color: COLORS.teal,
      fontSize: 12,
      fontWeight: '900',
    },
    eyebrow: {
      color: COLORS.muted,
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    title: {
      marginTop: 8,
      color: COLORS.text,
      fontSize: 28,
      fontWeight: '900',
    },
    subtitle: {
      marginTop: 10,
      color: COLORS.muted,
      lineHeight: 22,
      fontSize: 15,
    },
    card: {
      backgroundColor: COLORS.card,
      borderRadius: 24,
      padding: 22,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    blockedTitle: {
      color: COLORS.text,
      fontSize: 24,
      fontWeight: '900',
      textAlign: 'center',
    },
    blockedText: {
      marginTop: 10,
      color: COLORS.muted,
      lineHeight: 22,
      textAlign: 'center',
    },
    centerCard: {
      backgroundColor: COLORS.card,
      borderRadius: 22,
      padding: 18,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    centerText: {
      marginTop: 8,
      color: COLORS.muted,
      fontWeight: '700',
    },
    warningCard: {
      backgroundColor: COLORS.goldBg,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: COLORS.gold,
    },
    warningText: {
      color: COLORS.gold,
      fontWeight: '800',
      lineHeight: 20,
    },
    statsGrid: {
      flexDirection: 'row',
      gap: 10,
    },
    statCard: {
      flex: 1,
      minHeight: 126,
      backgroundColor: COLORS.card,
      borderRadius: 20,
      padding: 14,
      borderWidth: 1,
    },
    statDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginBottom: 12,
    },
    statValue: {
      color: COLORS.text,
      fontSize: 26,
      fontWeight: '900',
    },
    statLabel: {
      marginTop: 4,
      color: COLORS.text,
      fontSize: 13,
      fontWeight: '900',
    },
    statDetail: {
      marginTop: 4,
      color: COLORS.muted,
      fontSize: 12,
      lineHeight: 17,
    },
    section: {
      gap: 10,
    },
    sectionTitle: {
      color: COLORS.text,
      fontSize: 22,
      fontWeight: '900',
    },
    sectionSubtitle: {
      color: COLORS.muted,
      lineHeight: 21,
    },
    actionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    actionCard: {
      width: '48%',
      minHeight: 154,
      backgroundColor: COLORS.card,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
    },
    actionCode: {
      width: 42,
      height: 42,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    actionCodeText: {
      fontSize: 13,
      fontWeight: '900',
    },
    actionTitle: {
      color: COLORS.text,
      fontSize: 15,
      fontWeight: '900',
      lineHeight: 20,
    },
    actionDetail: {
      marginTop: 6,
      color: COLORS.muted,
      fontSize: 12,
      lineHeight: 18,
    },
    infoCard: {
      backgroundColor: COLORS.cardSoft,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    infoTitle: {
      color: COLORS.text,
      fontSize: 16,
      fontWeight: '900',
    },
    infoText: {
      marginTop: 6,
      color: COLORS.muted,
      lineHeight: 21,
    },
    footerActions: {
      gap: 10,
    },
    primaryButton: {
      marginTop: 18,
      minHeight: 50,
      borderRadius: 16,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '900',
    },
    secondaryButton: {
      minHeight: 50,
      borderRadius: 16,
      backgroundColor: COLORS.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: {
      color: COLORS.primary,
      fontSize: 15,
      fontWeight: '900',
    },
    logoutButton: {
      minHeight: 50,
      borderRadius: 16,
      backgroundColor: COLORS.dangerBg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.danger,
    },
    logoutButtonText: {
      color: COLORS.danger,
      fontSize: 15,
      fontWeight: '900',
    },
    borderBlue: { borderColor: COLORS.primary },
    borderTeal: { borderColor: COLORS.teal },
    borderGold: { borderColor: COLORS.gold },
    borderDanger: { borderColor: COLORS.danger },
    bgBlue: { backgroundColor: COLORS.primarySoft },
    bgTeal: { backgroundColor: COLORS.tealBg },
    bgGold: { backgroundColor: COLORS.goldBg },
    bgDanger: { backgroundColor: COLORS.dangerBg },
    textBlue: { color: COLORS.primary },
    textTeal: { color: COLORS.teal },
    textGold: { color: COLORS.gold },
    textDanger: { color: COLORS.danger },
    pressed: {
      opacity: 0.82,
      transform: [{ scale: 0.99 }],
    },
  });
}

function getAccentBorderStyle(accent: Accent, styles: any) {
  if (accent === 'teal') return styles.borderTeal;
  if (accent === 'gold') return styles.borderGold;
  if (accent === 'danger') return styles.borderDanger;
  return styles.borderBlue;
}

function getAccentBgStyle(accent: Accent, styles: any) {
  if (accent === 'teal') return styles.bgTeal;
  if (accent === 'gold') return styles.bgGold;
  if (accent === 'danger') return styles.bgDanger;
  return styles.bgBlue;
}

function getAccentTextStyle(accent: Accent, styles: any) {
  if (accent === 'teal') return styles.textTeal;
  if (accent === 'gold') return styles.textGold;
  if (accent === 'danger') return styles.textDanger;
  return styles.textBlue;
}
