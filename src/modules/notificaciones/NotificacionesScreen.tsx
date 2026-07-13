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
import { useNavigation } from '@react-navigation/native';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

type Notificacion = {
  _id: string;
  usuario_id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  metadata?: Record<string, any>;
  createdAt?: string;
};

type FilterType = 'todas' | 'pendientes' | 'leidas';

type NotificationAction = {
  label: string;
  route: string;
};

function formatDate(value?: string) {
  if (!value) return 'Sin fecha';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha';
  }

  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeText(value?: string) {
  return String(value || '').trim().toUpperCase();
}

function getTypeLabel(tipo: string, metadata?: Record<string, any>) {
  const normalized = normalizeText(tipo);
  const origen = normalizeText(metadata?.origen);

  const map: Record<string, string> = {
    RECORDATORIO_ENTRADA: 'Entrada',
    RECORDATORIO_SALIDA: 'Salida',
    DIA_COMPLETO: 'Jornada',
    SOPORTE_ABIERTO: 'Soporte abierto',
    SOPORTE_EN_REVISION: 'Soporte en revisión',
    SOPORTE_RESUELTO: 'Soporte resuelto',
    SOPORTE_CERRADO: 'Soporte cerrado',
    SOPORTE_RESPUESTA_ADMIN: 'Respuesta soporte',
    TICKET_SOPORTE: 'Soporte',
    TICKET_ACTUALIZADO: 'Soporte',
    TICKET_CERRADO: 'Soporte',
    GENERACION_CONTRATO: 'Contrato',
    GENERACION_CREDENCIAL: 'Credencial',
    CONTRATO_GENERADO: 'Contrato',
    CREDENCIAL_GENERADA: 'Credencial',
    VACACIONES: 'Vacaciones',
    NOMINA: 'Nómina',
    PERFIL: 'Perfil',
    ACTIVIDAD: 'Actividad',
  };

  if (map[normalized]) return map[normalized];

  if (origen === 'SOPORTE') return 'Soporte';
  if (normalized.includes('SOPORTE') || normalized.includes('TICKET')) return 'Soporte';
  if (normalized.includes('ASISTENCIA') || normalized.includes('ENTRADA') || normalized.includes('SALIDA')) return 'Asistencia';
  if (normalized.includes('CONTRATO')) return 'Contrato';
  if (normalized.includes('CREDENCIAL')) return 'Credencial';
  if (normalized.includes('DOCUMENTO')) return 'Documento';
  if (normalized.includes('VACACION')) return 'Vacaciones';
  if (normalized.includes('NOMINA') || normalized.includes('NÓMINA')) return 'Nómina';
  if (normalized.includes('PERFIL')) return 'Perfil';
  if (normalized.includes('ACTIVIDAD')) return 'Actividad';

  return normalized.replace(/_/g, ' ');
}

function getNotificationAction(item: Notificacion): NotificationAction | null {
  const tipo = normalizeText(item.tipo);
  const origen = normalizeText(item.metadata?.origen);
  const modulo = normalizeText(item.metadata?.modulo);
  const categoria = normalizeText(item.metadata?.categoria);

  if (
    origen === 'SOPORTE' ||
    modulo === 'SOPORTE' ||
    tipo.includes('SOPORTE') ||
    tipo.includes('TICKET')
  ) {
    return {
      label: 'Ver seguimiento',
      route: 'Soporte',
    };
  }

  if (
    tipo === 'RECORDATORIO_ENTRADA' ||
    tipo === 'RECORDATORIO_SALIDA'
  ) {
    return {
      label: 'Escanear QR',
      route: 'QrScan',
    };
  }

  if (
    tipo === 'DIA_COMPLETO' ||
    tipo.includes('ASISTENCIA') ||
    categoria.includes('ASISTENCIA')
  ) {
    return {
      label: 'Ver asistencia',
      route: 'Asistencia',
    };
  }

  if (
    tipo.includes('CONTRATO') ||
    categoria.includes('CONTRATO')
  ) {
    return {
      label: 'Ver documentos',
      route: 'Documentos',
    };
  }

  if (
    tipo.includes('CREDENCIAL') ||
    categoria.includes('CREDENCIAL')
  ) {
    return {
      label: 'Ver credencial',
      route: 'Credencial',
    };
  }

  if (
    tipo.includes('DOCUMENTO') ||
    categoria.includes('DOCUMENTO')
  ) {
    return {
      label: 'Ver documentos',
      route: 'Documentos',
    };
  }

  if (
    tipo.includes('VACACION') ||
    tipo.includes('VACACIONES') ||
    categoria.includes('VACACION') ||
    categoria.includes('VACACIONES')
  ) {
    return {
      label: 'Ver vacaciones',
      route: 'Vacaciones',
    };
  }

  if (
    tipo.includes('NOMINA') ||
    tipo.includes('NÓMINA') ||
    categoria.includes('NOMINA') ||
    categoria.includes('NÓMINA')
  ) {
    return {
      label: 'Ver nómina',
      route: 'Nomina',
    };
  }

  if (tipo.includes('PERFIL')) {
    return {
      label: 'Ver perfil',
      route: 'Perfil',
    };
  }

  if (tipo.includes('ACTIVIDAD')) {
    return {
      label: 'Ver actividad',
      route: 'Actividad',
    };
  }

  return null;
}

export default function NotificacionesScreen() {
  const navigation = useNavigation<any>();
  const { theme } = useAuth();
  const isDark = theme === 'dark';
  const styles = getStyles(isDark);
  const colors = getColors(isDark);

  const [items, setItems] = useState<Notificacion[]>([]);
  const [filter, setFilter] = useState<FilterType>('todas');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');

  const stats = useMemo(() => {
    const pendientes = items.filter((item) => !item.leida).length;
    const leidas = items.filter((item) => item.leida).length;

    return {
      total: items.length,
      pendientes,
      leidas,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (filter === 'pendientes') return items.filter((item) => !item.leida);
    if (filter === 'leidas') return items.filter((item) => item.leida);
    return items;
  }, [items, filter]);

  async function loadNotifications(showLoader = true) {
    try {
      if (showLoader) setLoading(true);
      setMessage('');

      const { data } = await api.get('/notificaciones/mis-notificaciones');
      const list = Array.isArray(data?.notificaciones) ? data.notificaciones : [];

      setItems(list);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'No se pudieron cargar las notificaciones.');
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadNotifications(false);
    setRefreshing(false);
  }

  async function markAsRead(id: string) {
    try {
      await api.patch(`/notificaciones/${id}/leida`);

      setItems((prev) =>
        prev.map((item) =>
          item._id === id ? { ...item, leida: true } : item
        )
      );
    } catch {
      setMessage('No se pudo marcar la notificación como leída.');
    }
  }

  async function markAllAsRead() {
    const unread = items.filter((item) => !item.leida);

    if (unread.length === 0) return;

    try {
      setMessage('');

      await Promise.all(
        unread.map((item) => api.patch(`/notificaciones/${item._id}/leida`))
      );

      setItems((prev) => prev.map((item) => ({ ...item, leida: true })));
    } catch {
      setMessage('No se pudieron marcar todas las notificaciones.');
    }
  }

  async function handleNotificationAction(item: Notificacion) {
    const action = getNotificationAction(item);

    if (!action) return;

    if (!item.leida) {
      await markAsRead(item._id);
    }

    navigation.navigate(action.route);
  }

  useEffect(() => {
    loadNotifications();
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
          <Text style={styles.eyebrow}>Centro de avisos</Text>
          <Text style={styles.title}>Notificaciones</Text>
          <Text style={styles.subtitle}>
            Consulta avisos del sistema, recordatorios de asistencia, seguimiento de soporte
            y eventos importantes de tu cuenta.
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Total" value={String(stats.total)} accent="blue" styles={styles} />
          <StatCard label="Pendientes" value={String(stats.pendientes)} accent="teal" styles={styles} />
          <StatCard label="Leídas" value={String(stats.leidas)} accent="blue" styles={styles} />
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.secondaryButton} onPress={() => loadNotifications()}>
            <Text style={styles.secondaryButtonText}>Actualizar</Text>
          </Pressable>

          <Pressable
            style={[
              styles.primaryButton,
              stats.pendientes === 0 && styles.disabledButton,
            ]}
            disabled={stats.pendientes === 0}
            onPress={markAllAsRead}
          >
            <Text style={styles.primaryButtonText}>Marcar todo leído</Text>
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          <FilterChip
            label="Todas"
            active={filter === 'todas'}
            onPress={() => setFilter('todas')}
            styles={styles}
          />

          <FilterChip
            label="Pendientes"
            active={filter === 'pendientes'}
            onPress={() => setFilter('pendientes')}
            styles={styles}
          />

          <FilterChip
            label="Leídas"
            active={filter === 'leidas'}
            onPress={() => setFilter('leidas')}
            styles={styles}
          />
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Cargando notificaciones...</Text>
          </View>
        ) : filteredItems.length > 0 ? (
          <View style={styles.list}>
            {filteredItems.map((item) => {
              const action = getNotificationAction(item);

              return (
                <View
                  key={item._id}
                  style={[
                    styles.notificationCard,
                    item.leida ? styles.notificationRead : styles.notificationUnread,
                  ]}
                >
                  <View style={styles.notificationTop}>
                    <View style={styles.notificationTitleBlock}>
                      <Text style={styles.typeLabel}>
                        {getTypeLabel(item.tipo, item.metadata)}
                      </Text>
                      <Text style={styles.notificationTitle}>{item.titulo}</Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        item.leida ? styles.statusBadgeRead : styles.statusBadgeUnread,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          item.leida ? styles.statusBadgeTextRead : styles.statusBadgeTextUnread,
                        ]}
                      >
                        {item.leida ? 'Leída' : 'Pendiente'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.notificationMessage}>{item.mensaje}</Text>

                  {item.metadata?.respuesta_admin ? (
                    <View style={styles.responseBox}>
                      <Text style={styles.responseLabel}>Respuesta administrativa</Text>
                      <Text style={styles.responseText}>
                        {String(item.metadata.respuesta_admin)}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.notificationFooter}>
                    <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>

                    <View style={styles.footerActions}>
                      {action ? (
                        <Pressable
                          style={styles.navigateButton}
                          onPress={() => handleNotificationAction(item)}
                        >
                          <Text style={styles.navigateButtonText}>{action.label}</Text>
                        </Pressable>
                      ) : null}

                      {!item.leida && (
                        <Pressable
                          style={styles.readButton}
                          onPress={() => markAsRead(item._id)}
                        >
                          <Text style={styles.readButtonText}>Marcar leída</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sin notificaciones</Text>
            <Text style={styles.emptyText}>
              No hay avisos para mostrar con el filtro seleccionado.
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
    <Pressable
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
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
    warningBg: isDark ? 'rgba(250,204,21,0.13)' : 'rgba(245,158,11,0.14)',
    success: isDark ? '#2DD4BF' : '#0F766E',
    successBg: isDark ? 'rgba(45,212,191,0.14)' : 'rgba(15,118,110,0.1)',
    actionBg: isDark ? 'rgba(56,189,248,0.12)' : 'rgba(10,87,164,0.1)',
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
    primaryButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 16,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontWeight: '900',
      fontSize: 13,
      textAlign: 'center',
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
    disabledButton: {
      opacity: 0.55,
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
    notificationCard: {
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
      elevation: 3,
    },
    notificationUnread: {
      borderColor: COLORS.primary,
    },
    notificationRead: {
      opacity: 0.78,
    },
    notificationTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 12,
    },
    notificationTitleBlock: {
      flex: 1,
    },
    typeLabel: {
      color: COLORS.teal,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    notificationTitle: {
      color: COLORS.text,
      fontSize: 18,
      fontWeight: '900',
      maxWidth: 220,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    statusBadgeUnread: {
      backgroundColor: COLORS.warningBg,
    },
    statusBadgeRead: {
      backgroundColor: COLORS.successBg,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    statusBadgeTextUnread: {
      color: COLORS.warning,
    },
    statusBadgeTextRead: {
      color: COLORS.success,
    },
    notificationMessage: {
      color: COLORS.textMuted,
      fontSize: 14,
      lineHeight: 22,
    },
    responseBox: {
      marginTop: 12,
      borderRadius: 16,
      padding: 12,
      backgroundColor: isDark ? 'rgba(45,212,191,0.12)' : 'rgba(34,184,176,0.1)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(45,212,191,0.25)' : 'rgba(34,184,176,0.18)',
    },
    responseLabel: {
      color: COLORS.teal,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 5,
    },
    responseText: {
      color: COLORS.text,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 19,
    },
    notificationFooter: {
      marginTop: 16,
      gap: 12,
    },
    dateText: {
      color: COLORS.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    footerActions: {
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'wrap',
    },
    navigateButton: {
      flexGrow: 1,
      backgroundColor: COLORS.actionBg,
      borderWidth: 1,
      borderColor: COLORS.primary,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      alignItems: 'center',
    },
    navigateButtonText: {
      color: COLORS.primary,
      fontSize: 12,
      fontWeight: '900',
      textAlign: 'center',
    },
    readButton: {
      flexGrow: 1,
      backgroundColor: COLORS.primary,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      alignItems: 'center',
    },
    readButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
      textAlign: 'center',
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