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

type IncapacidadAdmin = {
  id: number;
  usuario_id?: number;
  empleado_nombre?: string | null;
  empleado_apellido?: string | null;
  nombre?: string | null;
  apellido?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  dias_calculados?: number | null;
  motivo?: string | null;
  estado?: string | null;
  created_at?: string | null;
  analisis?: {
    estado_revision?: string | null;
    motivos_revision?: string[] | null;
  } | null;
};

function formatDate(value?: string | null) {
  if (!value) return 'No registrada';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'No registrada';

  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getEmployeeName(item: IncapacidadAdmin) {
  const directName = `${item.empleado_nombre || ''} ${item.empleado_apellido || ''}`.trim();
  const fallbackName = `${item.nombre || ''} ${item.apellido || ''}`.trim();

  return directName || fallbackName || `Usuario #${item.usuario_id || '-'}`;
}

function requiresReview(item: IncapacidadAdmin) {
  const estado = String(item.estado || '').trim().toLowerCase();
  const revision = String(item.analisis?.estado_revision || '').trim().toLowerCase();

  return estado === 'pendiente' || revision === 'requiere_revision';
}

export default function AdminIncapacidadesRevisionScreen() {
  const { theme } = useAuth();

  const isDark = theme === 'dark';
  const colors = getColors(isDark);
  const styles = getStyles(isDark);

  const [items, setItems] = useState<IncapacidadAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const pendingItems = useMemo(
    () => items.filter(requiresReview),
    [items]
  );

  const loadItems = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError('');

      const { data } = await api.get('/incapacidades');
      const list = Array.isArray(data?.incapacidades) ? data.incapacidades : [];

      setItems(list);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          'No se pudieron cargar las incapacidades por revisar.'
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
          <Text style={styles.eyebrow}>Revisión administrativa</Text>
          <Text style={styles.title}>Incapacidades por revisar</Text>
          <Text style={styles.subtitle}>
            Solicitudes pendientes o marcadas por la validación inteligente para revisión humana.
          </Text>
        </View>

        {loading ? (
          <View style={styles.centerCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.centerText}>Cargando incapacidades...</Text>
          </View>
        ) : null}

        {!!error && !loading ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!loading && !error && pendingItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sin pendientes</Text>
            <Text style={styles.emptyText}>
              No hay incapacidades pendientes de revisión en este momento.
            </Text>
          </View>
        ) : null}

        {pendingItems.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardCode}>
                <Text style={styles.cardCodeText}>IN</Text>
              </View>
              <View style={styles.cardTitleBox}>
                <Text style={styles.cardTitle}>{getEmployeeName(item)}</Text>
                <Text style={styles.cardSubtitle}>Solicitud #{item.id}</Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>
                  {item.estado || 'pendiente'}
                </Text>
              </View>
            </View>

            <Text style={styles.reasonText}>{item.motivo || 'Sin motivo registrado.'}</Text>

            <View style={styles.metaGrid}>
              <InfoBox label="Inicio" value={formatDate(item.fecha_inicio)} styles={styles} />
              <InfoBox label="Fin" value={formatDate(item.fecha_fin)} styles={styles} />
              <InfoBox
                label="Días"
                value={String(item.dias_calculados ?? '-')}
                styles={styles}
              />
            </View>

            {(item.analisis?.motivos_revision || []).length ? (
              <View style={styles.reviewBox}>
                <Text style={styles.reviewTitle}>Motivos de revisión</Text>
                {(item.analisis?.motivos_revision || []).slice(0, 3).map((reason, index) => (
                  <Text key={`${item.id}-${index}`} style={styles.reviewText}>
                    {reason}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
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
      backgroundColor: COLORS.goldBg,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    statusBadgeText: {
      color: COLORS.gold,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    reasonText: {
      marginTop: 14,
      color: COLORS.text,
      fontSize: 14,
      lineHeight: 21,
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
    reviewBox: {
      marginTop: 14,
      backgroundColor: COLORS.goldBg,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: COLORS.gold,
    },
    reviewTitle: {
      color: COLORS.gold,
      fontSize: 13,
      fontWeight: '900',
      marginBottom: 6,
    },
    reviewText: {
      color: COLORS.text,
      fontSize: 12,
      lineHeight: 18,
    },
  });
}
