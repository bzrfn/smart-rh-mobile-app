import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

type Actividad = {
  _id: string;
  usuario_id: number;
  tipo: string;
  titulo: string;
  descripcion: string;
  modulo: string;
  origen?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
};

type FilterType = 'todas' | 'auth' | 'asistencia' | 'vacaciones' | 'documentos';

function formatDate(value?: string) {
  if (!value) return 'Sin fecha';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Sin fecha';

  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getModuleLabel(modulo: string) {
  const map: Record<string, string> = {
    auth: 'Acceso',
    asistencia: 'Asistencia',
    vacaciones: 'Vacaciones',
    documentos: 'Documentos',
  };

  return map[modulo] || modulo;
}

export default function ActividadScreen() {
  const { theme } = useAuth();
  const isDark = theme === 'dark';
  const styles = getStyles(isDark);
  const colors = getColors(isDark);

  const [items, setItems] = useState<Actividad[]>([]);
  const [filter, setFilter] = useState<FilterType>('todas');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');

  const stats = useMemo(() => {
    return {
      total: items.length,
      asistencia: items.filter((item) => item.modulo === 'asistencia').length,
      documentos: items.filter((item) => item.modulo === 'documentos').length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (filter === 'todas') return items;
    return items.filter((item) => item.modulo === filter);
  }, [items, filter]);

  async function loadActivity(showLoader = true) {
    try {
      if (showLoader) setLoading(true);
      setMessage('');

      const { data } = await api.get('/actividad/mi-actividad');
      const list = Array.isArray(data?.actividad) ? data.actividad : [];

      setItems(list);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'No se pudo cargar la actividad reciente.');
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadActivity(false);
    setRefreshing(false);
  }

  useEffect(() => {
    loadActivity();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Bitácora personal</Text>
          <Text style={styles.title}>Actividad reciente</Text>
          <Text style={styles.subtitle}>
            Consulta las acciones registradas en tu cuenta dentro de SMART RH.
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Total" value={String(stats.total)} accent="blue" styles={styles} />
          <StatCard label="Asistencia" value={String(stats.asistencia)} accent="teal" styles={styles} />
          <StatCard label="Documentos" value={String(stats.documentos)} accent="blue" styles={styles} />
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.secondaryButton} onPress={() => loadActivity()}>
            <Text style={styles.secondaryButtonText}>Actualizar</Text>
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          <FilterChip label="Todas" active={filter === 'todas'} onPress={() => setFilter('todas')} styles={styles} />
          <FilterChip label="Acceso" active={filter === 'auth'} onPress={() => setFilter('auth')} styles={styles} />
          <FilterChip label="Asistencia" active={filter === 'asistencia'} onPress={() => setFilter('asistencia')} styles={styles} />
          <FilterChip label="Vacaciones" active={filter === 'vacaciones'} onPress={() => setFilter('vacaciones')} styles={styles} />
          <FilterChip label="Documentos" active={filter === 'documentos'} onPress={() => setFilter('documentos')} styles={styles} />
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Cargando actividad...</Text>
          </View>
        ) : filteredItems.length > 0 ? (
          <View style={styles.list}>
            {filteredItems.map((item) => (
              <View key={item._id} style={styles.activityCard}>
                <View style={styles.activityTop}>
                  <View>
                    <Text style={styles.typeLabel}>{getModuleLabel(item.modulo)}</Text>
                    <Text style={styles.activityTitle}>{item.titulo}</Text>
                  </View>

                  <View style={styles.originBadge}>
                    <Text style={styles.originBadgeText}>{item.origen || 'sistema'}</Text>
                  </View>
                </View>

                <Text style={styles.activityDescription}>{item.descripcion}</Text>

                <View style={styles.activityFooter}>
                  <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
                  <Text style={styles.typeText}>{item.tipo}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sin actividad registrada</Text>
            <Text style={styles.emptyText}>
              Aún no hay eventos para mostrar con el filtro seleccionado.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  styles,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: any;
}) {
  return (
    <Pressable style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function StatCard({
  label,
  value,
  accent,
  styles,
}: {
  label: string;
  value: string;
  accent: 'blue' | 'teal';
  styles: any;
}) {
  return (
    <View style={styles.statCard}>
      <View
        style={[
          styles.statAccent,
          accent === 'teal' ? styles.statAccentTeal : styles.statAccentBlue,
        ]}
      />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function getColors(isDark: boolean) {
  return {
    background: isDark ? '#07111F' : '#F4F7FB',
    card: isDark ? '#0F1B2D' : '#FFFFFF',
    cardSoft: isDark ? '#111F33' : '#F9FBFD',
    primary: isDark ? '#38BDF8' : '#0A57A4',
    teal: isDark ? '#2DD4BF' : '#22B8B0',
    text: isDark ? '#F8FAFC' : '#0F172A',
    textMuted: isDark ? '#9FB0C4' : '#5B6B81',
    border: isDark ? '#26364D' : '#D9E1EC',
    warning: isDark ? '#FACC15' : '#B45309',
  };
}

function getStyles(isDark: boolean) {
  const COLORS = getColors(isDark);

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    container: {
      padding: 20,
      paddingBottom: 44,
      backgroundColor: COLORS.background,
    },
    hero: {
      backgroundColor: COLORS.card,
      borderRadius: 30,
      padding: 24,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginBottom: 18,
      elevation: 4,
    },
    eyebrow: {
      color: COLORS.teal,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 10,
    },
    title: {
      color: COLORS.primary,
      fontSize: 34,
      fontWeight: '900',
    },
    subtitle: {
      color: COLORS.textMuted,
      fontSize: 15,
      lineHeight: 23,
      marginTop: 10,
    },
    statsGrid: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    statCard: {
      flex: 1,
      backgroundColor: COLORS.card,
      borderRadius: 22,
      padding: 15,
      borderWidth: 1,
      borderColor: COLORS.border,
      elevation: 3,
    },
    statAccent: {
      width: 38,
      height: 6,
      borderRadius: 999,
      marginBottom: 12,
    },
    statAccentBlue: {
      backgroundColor: COLORS.primary,
    },
    statAccentTeal: {
      backgroundColor: COLORS.teal,
    },
    statValue: {
      color: COLORS.text,
      fontSize: 22,
      fontWeight: '900',
    },
    statLabel: {
      color: COLORS.textMuted,
      fontSize: 12,
      fontWeight: '800',
      marginTop: 4,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 14,
    },
    secondaryButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 16,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    secondaryButtonText: {
      color: COLORS.primary,
      fontWeight: '900',
      fontSize: 13,
      textAlign: 'center',
    },
    filterRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
      flexWrap: 'wrap',
    },
    filterChip: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
    },
    filterChipActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    filterChipText: {
      color: COLORS.textMuted,
      fontSize: 13,
      fontWeight: '900',
    },
    filterChipTextActive: {
      color: '#FFFFFF',
    },
    message: {
      color: COLORS.warning,
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 14,
    },
    loadingCard: {
      backgroundColor: COLORS.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 24,
      alignItems: 'center',
      gap: 10,
    },
    loadingText: {
      color: COLORS.textMuted,
      fontWeight: '800',
    },
    list: {
      gap: 14,
    },
    activityCard: {
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
      elevation: 3,
    },
    activityTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 12,
    },
    typeLabel: {
      color: COLORS.teal,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    activityTitle: {
      color: COLORS.text,
      fontSize: 18,
      fontWeight: '900',
      maxWidth: 220,
    },
    originBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(45,212,191,0.14)' : 'rgba(34,184,176,0.12)',
    },
    originBadgeText: {
      color: COLORS.teal,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    activityDescription: {
      color: COLORS.textMuted,
      fontSize: 14,
      lineHeight: 22,
    },
    activityFooter: {
      marginTop: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    dateText: {
      color: COLORS.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    typeText: {
      color: COLORS.primary,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      maxWidth: 150,
      textAlign: 'right',
    },
    emptyCard: {
      backgroundColor: COLORS.card,
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
    },
    emptyTitle: {
      color: COLORS.primary,
      fontSize: 20,
      fontWeight: '900',
    },
    emptyText: {
      color: COLORS.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      marginTop: 8,
    },
  });
}