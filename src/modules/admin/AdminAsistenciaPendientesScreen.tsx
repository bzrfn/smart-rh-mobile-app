import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

type AsistenciaPendiente = {
  id: number;
  usuario_id?: number;
  nombre?: string | null;
  apellido?: string | null;
  correo?: string | null;
  fecha?: string | null;
  hora_entrada?: string | null;
  hora_salida?: string | null;
  estado?: string | null;
  duracion_minima_aplicada_minutos?: number | null;
  duracion_registrada_segundos?: number | string | null;
};

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(value?: string | null) {
  if (!value) return 'Pendiente';
  return String(value).slice(0, 5);
}

function formatDuration(value?: number | string | null) {
  const seconds = Number(value);

  if (!Number.isFinite(seconds) || seconds <= 0) return 'Sin duración';

  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes} min`;
  if (minutes <= 0) return `${hours} h`;

  return `${hours} h ${minutes} min`;
}

function getEmployeeName(item: AsistenciaPendiente) {
  const fullName = `${item.nombre || ''} ${item.apellido || ''}`.trim();
  return fullName || `Usuario #${item.usuario_id || '-'}`;
}

function getStatusLabel(value?: string | null) {
  const status = String(value || '').trim();

  if (status === 'INVALIDA_PENDIENTE_REVISION') {
    return 'Revisión requerida';
  }

  return status || 'Pendiente';
}

export default function AdminAsistenciaPendientesScreen() {
  const { theme } = useAuth();

  const isDark = theme === 'dark';
  const colors = getColors(isDark);
  const styles = getStyles(isDark);

  const [items, setItems] = useState<AsistenciaPendiente[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const reviewCount = useMemo(
    () =>
      items.filter(
        item => String(item.estado || '') === 'INVALIDA_PENDIENTE_REVISION'
      ).length,
    [items]
  );

  const loadItems = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError('');

      const { data } = await api.get('/asistencia/pendientes');
      const list = Array.isArray(data?.asistencias) ? data.asistencias : [];

      setItems(list);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          'No se pudieron cargar los pendientes de asistencia.'
      );
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadItems(true)}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Control administrativo</Text>
          <Text style={styles.title}>Pendientes de asistencia</Text>
          <Text style={styles.subtitle}>
            Registros que requieren validación administrativa antes de quedar
            cerrados en asistencia.
          </Text>
        </View>

        <View style={styles.statsRow}>
          <SummaryBox
            label="Total"
            value={String(items.length)}
            tone="primary"
            styles={styles}
          />
          <SummaryBox
            label="Revisión"
            value={String(reviewCount)}
            tone={reviewCount > 0 ? 'gold' : 'teal'}
            styles={styles}
          />
        </View>

        {loading ? (
          <View style={styles.centerCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.centerText}>Cargando pendientes...</Text>
          </View>
        ) : null}

        {!!error && !loading ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sin pendientes</Text>
            <Text style={styles.emptyText}>
              No hay asistencias pendientes de revisión en este momento.
            </Text>
          </View>
        ) : null}

        {items.map(item => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardCode}>
                <Text style={styles.cardCodeText}>AS</Text>
              </View>
              <View style={styles.cardTitleBox}>
                <Text style={styles.cardTitle}>{getEmployeeName(item)}</Text>
                <Text style={styles.cardSubtitle}>
                  {item.correo || `Usuario #${item.usuario_id || '-'}`}
                </Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>
                  {getStatusLabel(item.estado)}
                </Text>
              </View>
            </View>

            <View style={styles.metaGrid}>
              <InfoBox label="Fecha" value={formatDate(item.fecha)} styles={styles} />
              <InfoBox
                label="Entrada"
                value={formatTime(item.hora_entrada)}
                styles={styles}
              />
              <InfoBox
                label="Salida"
                value={formatTime(item.hora_salida)}
                styles={styles}
              />
            </View>

            <View style={styles.detailBox}>
              <Text style={styles.detailTitle}>Detalle del registro</Text>
              <Text style={styles.detailText}>
                Duración registrada: {formatDuration(item.duracion_registrada_segundos)}
              </Text>
              <Text style={styles.detailText}>
                Mínimo aplicado: {item.duracion_minima_aplicada_minutos ?? '-'} min
              </Text>
              <Text style={styles.detailText}>Folio de asistencia #{item.id}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryBox({
  label,
  value,
  tone,
  styles,
}: {
  label: string;
  value: string;
  tone: 'primary' | 'teal' | 'gold';
  styles: any;
}) {
  return (
    <View style={[styles.summaryBox, styles[`${tone}Border`]]}>
      <Text style={[styles.summaryValue, styles[`${tone}Text`]]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function InfoBox({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: any;
}) {
  return (
    <View style={styles.infoBox}>
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
    container: { padding: 20, gap: 14, paddingBottom: 40 },
    hero: {
      backgroundColor: COLORS.card,
      borderRadius: 28,
      padding: 22,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    eyebrow: {
      color: COLORS.teal,
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    title: {
      marginTop: 8,
      color: COLORS.text,
      fontSize: 26,
      fontWeight: '900',
    },
    subtitle: {
      marginTop: 10,
      color: COLORS.muted,
      fontSize: 14,
      lineHeight: 21,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    summaryBox: {
      flex: 1,
      backgroundColor: COLORS.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
    },
    summaryValue: {
      fontSize: 28,
      fontWeight: '900',
    },
    summaryLabel: {
      marginTop: 4,
      color: COLORS.muted,
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    primaryBorder: { borderColor: COLORS.primary },
    tealBorder: { borderColor: COLORS.teal },
    goldBorder: { borderColor: COLORS.gold },
    primaryText: { color: COLORS.primary },
    tealText: { color: COLORS.teal },
    goldText: { color: COLORS.gold },
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
    errorCard: {
      backgroundColor: COLORS.dangerBg,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: COLORS.danger,
    },
    errorText: {
      color: COLORS.danger,
      fontWeight: '800',
      lineHeight: 20,
    },
    emptyCard: {
      backgroundColor: COLORS.card,
      borderRadius: 22,
      padding: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    emptyTitle: {
      color: COLORS.text,
      fontSize: 18,
      fontWeight: '900',
    },
    emptyText: {
      marginTop: 8,
      color: COLORS.muted,
      lineHeight: 21,
    },
    card: {
      backgroundColor: COLORS.card,
      borderRadius: 22,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    cardCode: {
      width: 42,
      height: 42,
      borderRadius: 16,
      backgroundColor: COLORS.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardCodeText: {
      color: COLORS.primary,
      fontWeight: '900',
    },
    cardTitleBox: { flex: 1 },
    cardTitle: {
      color: COLORS.text,
      fontSize: 16,
      fontWeight: '900',
    },
    cardSubtitle: {
      marginTop: 3,
      color: COLORS.muted,
      fontSize: 12,
      fontWeight: '700',
    },
    statusBadge: {
      maxWidth: 108,
      backgroundColor: COLORS.goldBg,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    statusBadgeText: {
      color: COLORS.gold,
      fontSize: 10,
      fontWeight: '900',
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    metaGrid: {
      marginTop: 14,
      flexDirection: 'row',
      gap: 10,
    },
    infoBox: {
      flex: 1,
      backgroundColor: COLORS.cardSoft,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    infoLabel: {
      color: COLORS.muted,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    infoValue: {
      marginTop: 5,
      color: COLORS.text,
      fontSize: 13,
      fontWeight: '900',
    },
    detailBox: {
      marginTop: 14,
      backgroundColor: COLORS.cardSoft,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    detailTitle: {
      color: COLORS.text,
      fontSize: 13,
      fontWeight: '900',
      marginBottom: 6,
    },
    detailText: {
      color: COLORS.muted,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '700',
    },
  });
}
