import React, { useEffect, useMemo, useState } from 'react';
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
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

type Props = {
  navigation: any;
};

type AsistenciaItem = {
  id: number;
  usuario_id: number;
  nombre?: string;
  apellido?: string;
  correo?: string;
  fecha: string;
  hora_entrada?: string | null;
  hora_salida?: string | null;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  qr_token?: string | null;
};

type WeeklyReport = {
  week: {
    start: string;
    end: string;
  };
  summary: {
    total: number;
    pendientes: number;
    aprobadas: number;
    rechazadas: number;
    dias_con_asistencia: number;
  };
  dias: Array<{
    id: number;
    fecha: string;
    hora_entrada?: string | null;
    hora_salida?: string | null;
    estado: 'pendiente' | 'aprobada' | 'rechazada';
  }>;
};

export default function AsistenciaScreen({ navigation }: Props) {
  const { permisos, theme } = useAuth();
  const isDark = theme === 'dark';
  const COLORS = getColors(isDark);
  const styles = getStyles(isDark);

  const [items, setItems] = useState<AsistenciaItem[]>([]);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!permisos.asistencia) {
      Alert.alert(
        'Acceso restringido',
        'No tienes permiso para visualizar este módulo.',
        [{ text: 'Aceptar', onPress: () => navigation.navigate('Home') }]
      );
    }
  }, [permisos.asistencia, navigation]);

  const loadAsistencias = async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);

      const [historialRes, reportRes] = await Promise.all([
        api.get('/asistencia/me/weekly'),
        api.get('/asistencia/me/weekly/report'),
      ]);

      setItems(
        Array.isArray(historialRes?.data?.asistencias)
          ? historialRes.data.asistencias
          : []
      );

      setWeeklyReport(reportRes?.data?.report ?? null);
    } catch (e: any) {
      Alert.alert(
        'Error',
        e?.response?.data?.message ??
          'No se pudo cargar el historial semanal de asistencia.'
      );
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
      setLoadingReport(false);
    }
  };

  const onlyReloadReport = async () => {
    try {
      setLoadingReport(true);
      const { data } = await api.get('/asistencia/me/weekly/report');
      setWeeklyReport(data?.report ?? null);
    } catch (e: any) {
      Alert.alert(
        'Error',
        e?.response?.data?.message ?? 'No se pudo actualizar el reporte semanal.'
      );
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    if (!permisos.asistencia) return;
    loadAsistencias();
  }, [permisos.asistencia]);

  const summary = useMemo(() => {
    return {
      total: items.length,
      pendientes: items.filter((i) => i.estado === 'pendiente').length,
      aprobadas: items.filter((i) => i.estado === 'aprobada').length,
      rechazadas: items.filter((i) => i.estado === 'rechazada').length,
      conSalida: items.filter((i) => Boolean(i.hora_salida)).length,
    };
  }, [items]);

  if (!permisos.asistencia) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadAsistencias(true)}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.shapeTopLeftLarge} />
        <View style={styles.shapeTopLeftSmall} />
        <View style={styles.shapeBottomRightLarge} />
        <View style={styles.shapeBottomRightSmall} />

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>SMART RH</Text>
            </View>

            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Reporte semanal</Text>
            </View>
          </View>

          <Text style={styles.eyebrow}>Consulta personal</Text>
          <Text style={styles.title}>Asistencia</Text>
          <Text style={styles.text}>
            Visualiza tu asistencia semanal, revisa entradas y salidas registradas
            y consulta el estado de validación de cada día.
          </Text>

          <View style={styles.heroInfoCard}>
            <Text style={styles.heroInfoTitle}>Semana actual</Text>
            <Text style={styles.heroInfoText}>
              {weeklyReport?.week
                ? `${formatDateDisplay(weeklyReport.week.start)} al ${formatDateDisplay(
                    weeklyReport.week.end
                  )}`
                : 'Sin rango semanal disponible'}
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryCard label="Total" value={summary.total} accent="blue" styles={styles} />
          <SummaryCard label="Pendientes" value={summary.pendientes} accent="blue" styles={styles} />
          <SummaryCard label="Aprobadas" value={summary.aprobadas} accent="teal" styles={styles} />
          <SummaryCard label="Con salida" value={summary.conSalida} accent="teal" styles={styles} />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionEyebrow}>Reporte</Text>
              <Text style={styles.sectionTitle}>Resumen semanal</Text>
              <Text style={styles.sectionSubtitle}>
                Consulta los días trabajados, registros aprobados y asistencias de
                la semana actual.
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.refreshButton,
                pressed && styles.refreshButtonPressed,
              ]}
              onPress={onlyReloadReport}
            >
              <Text style={styles.refreshButtonText}>
                {loadingReport ? 'Actualizando...' : 'Actualizar'}
              </Text>
            </Pressable>
          </View>

          {!weeklyReport ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.loadingText}>Cargando reporte...</Text>
            </View>
          ) : (
            <>
              <View style={styles.reportGrid}>
                <ReportMiniCard label="Días con asistencia" value={weeklyReport.summary.dias_con_asistencia} styles={styles} />
                <ReportMiniCard label="Pendientes" value={weeklyReport.summary.pendientes} styles={styles} />
                <ReportMiniCard label="Aprobadas" value={weeklyReport.summary.aprobadas} styles={styles} />
                <ReportMiniCard label="Rechazadas" value={weeklyReport.summary.rechazadas} styles={styles} />
              </View>

              <View style={styles.weekRangeCard}>
                <Text style={styles.weekRangeTitle}>Periodo del reporte</Text>
                <Text style={styles.weekRangeText}>
                  {formatDateDisplay(weeklyReport.week.start)} →{' '}
                  {formatDateDisplay(weeklyReport.week.end)}
                </Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionEyebrow}>Detalle</Text>
              <Text style={styles.sectionTitle}>Historial semanal</Text>
              <Text style={styles.sectionSubtitle}>
                Cada registro puede incluir hora de entrada y hora de salida del mismo día.
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.refreshButton,
                pressed && styles.refreshButtonPressed,
              ]}
              onPress={() => loadAsistencias(true)}
            >
              <Text style={styles.refreshButtonText}>Actualizar</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.loadingText}>Cargando historial...</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}>
                <Text style={styles.emptyIconText}>○</Text>
              </View>
              <Text style={styles.emptyTitle}>Sin registros semanales</Text>
              <Text style={styles.emptyText}>
                Aún no tienes registros de asistencia en la semana actual.
              </Text>
            </View>
          ) : (
            items.map((item) => (
              <View key={item.id} style={styles.requestCard}>
                <View style={styles.requestTopRow}>
                  <View style={styles.requestAccent} />

                  <View style={[styles.statusBadge, getStatusBadgeStyle(item.estado, styles)]}>
                    <Text style={[styles.statusBadgeText, getStatusTextStyle(item.estado, styles)]}>
                      {item.estado}
                    </Text>
                  </View>
                </View>

                <View style={styles.requestHeader}>
                  <View style={styles.requestHeaderLeft}>
                    <Text style={styles.requestTitle}>Registro #{item.id}</Text>
                    <Text style={styles.requestSubtitle}>
                      {formatDateDisplay(item.fecha)}
                    </Text>
                  </View>
                </View>

                <View style={styles.metricsRow}>
                  <MetricChip label="Entrada" value={item.hora_entrada || 'Sin dato'} accent="blue" styles={styles} />
                  <MetricChip label="Salida" value={item.hora_salida || 'Pendiente'} accent={item.hora_salida ? 'teal' : 'warning'} styles={styles} />
                </View>

                <View style={styles.requestFooter}>
                  <Text style={styles.requestFooterText}>
                    Estado actual del registro:{' '}
                    <Text style={styles.requestFooterValue}>{item.estado}</Text>
                  </Text>

                  <Text style={styles.requestFooterText}>
                    Tipo de jornada:{' '}
                    <Text style={styles.requestFooterValue}>
                      {item.hora_entrada && item.hora_salida
                        ? 'Entrada y salida registradas'
                        : item.hora_entrada
                        ? 'Solo entrada registrada'
                        : 'Sin registro completo'}
                    </Text>
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  styles,
}: {
  label: string;
  value: number;
  accent: 'blue' | 'teal' | 'danger';
  styles: any;
}) {
  return (
    <View style={styles.summaryCard}>
      <View
        style={[
          styles.summaryAccent,
          accent === 'teal'
            ? styles.summaryAccentTeal
            : accent === 'danger'
            ? styles.summaryAccentDanger
            : styles.summaryAccentBlue,
        ]}
      />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ReportMiniCard({
  label,
  value,
  styles,
}: {
  label: string;
  value: number;
  styles: any;
}) {
  return (
    <View style={styles.reportMiniCard}>
      <Text style={styles.reportMiniValue}>{value}</Text>
      <Text style={styles.reportMiniLabel}>{label}</Text>
    </View>
  );
}

function MetricChip({
  label,
  value,
  accent,
  styles,
}: {
  label: string;
  value: string;
  accent: 'blue' | 'teal' | 'warning';
  styles: any;
}) {
  return (
    <View
      style={[
        styles.metricChip,
        accent === 'teal'
          ? styles.metricChipTeal
          : accent === 'warning'
          ? styles.metricChipWarning
          : styles.metricChipBlue,
      ]}
    >
      <Text
        style={[
          styles.metricChipLabel,
          accent === 'warning' ? styles.metricChipLabelWarning : null,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.metricChipValue,
          accent === 'warning' ? styles.metricChipValueWarning : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function getStatusBadgeStyle(estado: AsistenciaItem['estado'], styles: any) {
  switch (estado) {
    case 'aprobada':
      return styles.statusApproved;
    case 'rechazada':
      return styles.statusRejected;
    default:
      return styles.statusPending;
  }
}

function getStatusTextStyle(estado: AsistenciaItem['estado'], styles: any) {
  switch (estado) {
    case 'aprobada':
      return styles.statusApprovedText;
    case 'rechazada':
      return styles.statusRejectedText;
    default:
      return styles.statusPendingText;
  }
}

function formatDateDisplay(value?: string) {
  if (!value) return 'Sin fecha';
  return String(value).slice(0, 10);
}

function getColors(isDark: boolean) {
  return {
    background: isDark ? '#07111F' : '#F4F7FB',
    card: isDark ? '#0F1B2D' : '#FFFFFF',
    cardSoft: isDark ? '#111F33' : '#F9FBFD',
    primary: isDark ? '#38BDF8' : '#0A57A4',
    primaryDark: isDark ? '#0EA5E9' : '#084785',
    primarySoft: isDark ? 'rgba(56,189,248,0.14)' : 'rgba(10,87,164,0.10)',
    teal: isDark ? '#2DD4BF' : '#22B8B0',
    tealSoft: isDark ? '#14B8A6' : '#67D5CC',
    tealBg: isDark ? 'rgba(45,212,191,0.14)' : 'rgba(34,184,176,0.12)',
    text: isDark ? '#F8FAFC' : '#0F172A',
    textMuted: isDark ? '#9FB0C4' : '#5B6B81',
    border: isDark ? '#26364D' : '#D9E1EC',
    danger: '#D64545',
    dangerBg: 'rgba(214,69,69,0.12)',
    warningBg: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.14)',
    warningText: '#B45309',
  };
}

function getStyles(isDark: boolean) {
  const COLORS = getColors(isDark);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    container: { padding: 20, paddingBottom: 36, overflow: 'hidden', backgroundColor: COLORS.background },

    heroCard: {
      backgroundColor: COLORS.card,
      borderRadius: 30,
      padding: 24,
      marginBottom: 18,
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.28 : 0.09,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
      borderWidth: 1,
      borderColor: COLORS.border,
      zIndex: 2,
    },
    heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    heroPill: { backgroundColor: COLORS.primarySoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
    heroPillText: { color: COLORS.primary, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
    heroBadge: { backgroundColor: COLORS.tealBg, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
    heroBadgeText: { color: COLORS.teal, fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
    eyebrow: { marginTop: 18, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, color: COLORS.textMuted, marginBottom: 8 },
    title: { fontSize: 28, fontWeight: '900', color: COLORS.primary, marginBottom: 12 },
    text: { fontSize: 15, color: COLORS.textMuted, lineHeight: 24 },
    heroInfoCard: { marginTop: 18, backgroundColor: COLORS.cardSoft, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.border },
    heroInfoTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
    heroInfoText: { marginTop: 6, fontSize: 14, color: COLORS.textMuted, lineHeight: 21 },

    summaryRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 18, zIndex: 2 },
    summaryCard: { width: '48%', backgroundColor: COLORS.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.border, elevation: 3, marginBottom: 12 },
    summaryAccent: { width: 42, height: 6, borderRadius: 999, marginBottom: 12 },
    summaryAccentBlue: { backgroundColor: COLORS.primary },
    summaryAccentTeal: { backgroundColor: COLORS.teal },
    summaryAccentDanger: { backgroundColor: COLORS.danger },
    summaryValue: { fontSize: 22, fontWeight: '900', color: COLORS.text },
    summaryLabel: { marginTop: 4, fontSize: 13, color: COLORS.textMuted, fontWeight: '700' },

    sectionCard: { backgroundColor: COLORS.card, borderRadius: 26, padding: 20, elevation: 4, borderWidth: 1, borderColor: COLORS.border, zIndex: 2, marginBottom: 18 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
    sectionHeaderText: { flex: 1, marginRight: 12 },
    sectionEyebrow: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color: COLORS.textMuted, marginBottom: 6 },
    sectionTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text },
    sectionSubtitle: { marginTop: 6, fontSize: 14, color: COLORS.textMuted, lineHeight: 21 },
    refreshButton: { backgroundColor: COLORS.primarySoft, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, minWidth: 96, alignItems: 'center' },
    refreshButtonPressed: { opacity: 0.8 },
    refreshButtonText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },

    loadingBox: { paddingVertical: 26, alignItems: 'center' },
    loadingText: { marginTop: 10, color: COLORS.textMuted, fontWeight: '700' },

    reportGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    reportMiniCard: { width: '48%', backgroundColor: COLORS.cardSoft, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
    reportMiniValue: { fontSize: 22, fontWeight: '900', color: COLORS.primary },
    reportMiniLabel: { marginTop: 6, fontSize: 13, color: COLORS.textMuted, fontWeight: '700' },
    weekRangeCard: { marginTop: 6, backgroundColor: COLORS.primarySoft, borderRadius: 18, padding: 14 },
    weekRangeTitle: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
    weekRangeText: { marginTop: 6, fontSize: 14, color: COLORS.text, fontWeight: '700' },

    emptyBox: { paddingVertical: 22, alignItems: 'center' },
    emptyIconWrap: { width: 66, height: 66, borderRadius: 22, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    emptyIconText: { fontSize: 24, fontWeight: '900', color: COLORS.primary },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
    emptyText: { marginTop: 8, color: COLORS.textMuted, lineHeight: 21, textAlign: 'center', paddingHorizontal: 12 },

    requestCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, padding: 16, marginBottom: 14, backgroundColor: COLORS.cardSoft },
    requestTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    requestAccent: { width: 52, height: 6, borderRadius: 999, backgroundColor: COLORS.primary },
    requestHeader: { marginTop: 14 },
    requestHeaderLeft: { flex: 1 },
    requestTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
    requestSubtitle: { marginTop: 4, color: COLORS.textMuted, fontSize: 13 },

    metricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
    metricChip: { width: '48.5%', borderRadius: 16, padding: 14, borderWidth: 1 },
    metricChipBlue: { backgroundColor: COLORS.card, borderColor: COLORS.border },
    metricChipTeal: { backgroundColor: COLORS.tealBg, borderColor: COLORS.tealBg },
    metricChipWarning: { backgroundColor: COLORS.warningBg, borderColor: COLORS.warningBg },
    metricChipLabel: { fontSize: 12, fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
    metricChipLabelWarning: { color: COLORS.warningText },
    metricChipValue: { marginTop: 6, fontSize: 15, fontWeight: '800', color: COLORS.text },
    metricChipValueWarning: { color: COLORS.warningText },

    requestFooter: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 6 },
    requestFooterText: { fontSize: 13, color: COLORS.textMuted },
    requestFooterValue: { fontWeight: '800', color: COLORS.text, textTransform: 'capitalize' },

    statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
    statusBadgeText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
    statusPending: { backgroundColor: COLORS.primarySoft },
    statusPendingText: { color: COLORS.primary },
    statusApproved: { backgroundColor: COLORS.tealBg },
    statusApprovedText: { color: COLORS.teal },
    statusRejected: { backgroundColor: COLORS.dangerBg },
    statusRejectedText: { color: '#B42318' },

    shapeTopLeftLarge: { position: 'absolute', top: -70, left: -95, width: 230, height: 230, borderRadius: 115, backgroundColor: COLORS.primary, opacity: isDark ? 0.16 : 0.08 },
    shapeTopLeftSmall: { position: 'absolute', top: 40, left: -28, width: 110, height: 110, borderRadius: 55, backgroundColor: COLORS.teal, opacity: isDark ? 0.2 : 0.14 },
    shapeBottomRightLarge: { position: 'absolute', bottom: -90, right: -90, width: 220, height: 220, borderRadius: 110, backgroundColor: COLORS.primary, opacity: isDark ? 0.16 : 0.08 },
    shapeBottomRightSmall: { position: 'absolute', bottom: 34, right: -18, width: 95, height: 95, borderRadius: 48, backgroundColor: COLORS.tealSoft, opacity: isDark ? 0.24 : 0.25 },
  });
}