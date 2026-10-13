import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import AnimatedEntrance from '../../components/AnimatedEntrance';
import ConstellationAccent from '../../components/ConstellationAccent';
import { getSmartRhColors, getSmartRhShadow } from '../../design/smartRhTheme';

type Props = {
  navigation: any;
};

type Accent = 'blue' | 'teal' | 'gold' | 'danger';

type DashboardState = {
  asistenciaPendiente: number;
  incapacidadesRevision: number;
  notificacionesPendientes: number;
};

type SummaryLoadMode = 'initial' | 'manual' | 'silent';

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
  const { user, token, logout, theme } = useAuth();

  const isDark = theme === 'dark';
  const styles = getStyles(isDark);
  const colors = getColors(isDark);
  const isAdmin = isAdminRole(user?.role);

  const [summary, setSummary] = useState<DashboardState>(EMPTY_STATE);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const hasLoadedSummaryRef = useRef(false);

  const adminName = useMemo(
    () => `${user?.nombre || 'Administrador'} ${user?.apellido || ''}`.trim(),
    [user?.apellido, user?.nombre]
  );

  const loadSummary = useCallback(
    async (mode: SummaryLoadMode = 'initial') => {
      if (!token || !isAdmin) return;

      const showInitialLoading = mode === 'initial';
      const showManualRefresh = mode === 'manual';
      const showErrors = mode !== 'silent';

      try {
        if (showManualRefresh) setRefreshing(true);
        else if (showInitialLoading) setLoading(true);

        if (showErrors) setError('');

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
          if (showErrors) {
            setError('Algunos indicadores no pudieron actualizarse.');
          }
        }
      } catch (e: any) {
        if (showErrors) {
          setError(
            e?.response?.data?.message ||
              'No se pudo cargar el resumen administrativo.'
          );
        }
      } finally {
        hasLoadedSummaryRef.current = true;

        if (showManualRefresh) setRefreshing(false);
        else if (showInitialLoading) setLoading(false);
      }
    },
    [isAdmin, token]
  );

  useFocusEffect(
    useCallback(() => {
      loadSummary(hasLoadedSummaryRef.current ? 'silent' : 'initial');
    }, [loadSummary])
  );

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
            onRefresh={() => loadSummary('manual')}
            tintColor={colors.primary}
          />
        }
      >
        <AnimatedEntrance delay={40}>
          <View style={styles.hero}>
            <View style={styles.heroRail} />
            <View style={styles.heroGlow} />
            <ConstellationAccent
              isDark={isDark}
              style={styles.constellationAccent}
            />
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

            <View style={styles.heroCommandRow}>
              <View style={styles.heroCommandChip}>
                <Text style={styles.heroCommandValue}>
                  {summary.asistenciaPendiente}
                </Text>
                <Text style={styles.heroCommandLabel}>Asistencia</Text>
              </View>
              <View style={styles.heroCommandChip}>
                <Text style={styles.heroCommandValue}>
                  {summary.incapacidadesRevision}
                </Text>
                <Text style={styles.heroCommandLabel}>Incapacidades</Text>
              </View>
              <View style={styles.heroCommandChip}>
                <Text style={styles.heroCommandValue}>
                  {summary.notificacionesPendientes}
                </Text>
                <Text style={styles.heroCommandLabel}>Avisos</Text>
              </View>
            </View>
          </View>
        </AnimatedEntrance>

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

        <AnimatedEntrance delay={90}>
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
        </AnimatedEntrance>

        <AnimatedEntrance delay={140}>
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
                code="CL"
                title="Calendario laboral"
                detail="Agenda mensual de asistencia, vacaciones e incapacidades."
                accent="teal"
                onPress={() => navigation.navigate('CalendarioLaboral')}
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
        </AnimatedEntrance>

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
      <View style={styles.actionTextBlock}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDetail}>{detail}</Text>
      </View>
      <Text style={styles.actionArrow}>›</Text>
    </Pressable>
  );
}

function getColors(isDark: boolean) {
  const colors = getSmartRhColors(isDark);

  return {
    background: colors.background,
    card: colors.card,
    cardSoft: colors.cardSoft,
    primary: colors.primary,
    primaryText: colors.primary,
    heroSurface: colors.card,
    heroSurfaceSoft: colors.cardSoft,
    heroText: colors.text,
    heroMuted: colors.textMuted,
    heroAccent: colors.primary,
    actionPrimary: colors.primary,
    primarySoft: colors.primarySoft,
    teal: colors.success,
    tealBg: colors.successSoft,
    gold: colors.warning,
    goldBg: colors.warningSoft,
    danger: colors.danger,
    dangerBg: colors.dangerSoft,
    text: colors.text,
    muted: colors.textMuted,
    border: colors.border,
  };
}

function getStyles(isDark: boolean) {
  const COLORS = getColors(isDark);
  const shadow = getSmartRhShadow(isDark);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    container: {
      paddingHorizontal: 18,
      paddingTop: 14,
      gap: 16,
      paddingBottom: 132,
    },
    blockedWrap: {
      flex: 1,
      justifyContent: 'center',
      padding: 22,
      backgroundColor: COLORS.background,
    },
    hero: {
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: COLORS.heroSurface,
      borderRadius: 34,
      padding: 24,
      borderWidth: 1,
      borderColor: COLORS.border,
      ...shadow,
    },
    heroRail: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 7,
      backgroundColor: COLORS.heroAccent,
    },
    heroGlow: {
      position: 'absolute',
      right: -46,
      top: -38,
      width: 156,
      height: 156,
      borderRadius: 78,
      backgroundColor: isDark
        ? 'rgba(12,66,67,0.18)'
        : 'rgba(12,66,67,0.16)',
    },
    constellationAccent: {
      top: 4,
      right: -18,
      opacity: isDark ? 0.34 : 0.5,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 18,
    },
    brandPill: {
      backgroundColor: COLORS.heroSurfaceSoft,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    brandPillText: {
      color: COLORS.heroAccent,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    adminPill: {
      backgroundColor: COLORS.heroSurfaceSoft,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    adminPillText: {
      color: COLORS.heroText,
      fontSize: 12,
      fontWeight: '900',
    },
    eyebrow: {
      color: COLORS.heroMuted,
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    title: {
      marginTop: 8,
      color: COLORS.heroText,
      fontSize: 28,
      fontWeight: '900',
    },
    subtitle: {
      marginTop: 10,
      color: COLORS.heroMuted,
      lineHeight: 22,
      fontSize: 15,
    },
    heroCommandRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 20,
    },
    heroCommandChip: {
      flex: 1,
      minHeight: 68,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: COLORS.heroSurfaceSoft,
      borderWidth: 1,
      borderColor: COLORS.border,
      justifyContent: 'center',
    },
    heroCommandValue: {
      color: COLORS.heroAccent,
      fontSize: 20,
      fontWeight: '900',
    },
    heroCommandLabel: {
      marginTop: 2,
      color: COLORS.heroMuted,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
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
      ...shadow,
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
      gap: 10,
    },
    actionCard: {
      minHeight: 92,
      backgroundColor: COLORS.card,
      borderRadius: 24,
      padding: 14,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      ...shadow,
    },
    actionCode: {
      width: 42,
      height: 42,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionCodeText: {
      fontSize: 13,
      fontWeight: '900',
    },
    actionTextBlock: {
      flex: 1,
    },
    actionTitle: {
      color: COLORS.text,
      fontSize: 16,
      fontWeight: '900',
      lineHeight: 20,
    },
    actionDetail: {
      marginTop: 6,
      color: COLORS.muted,
      fontSize: 12,
      lineHeight: 18,
    },
    actionArrow: {
      color: COLORS.muted,
      fontSize: 28,
      fontWeight: '500',
      marginRight: 2,
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
      backgroundColor: COLORS.actionPrimary,
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
      color: COLORS.primaryText,
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
    textBlue: { color: COLORS.primaryText },
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
