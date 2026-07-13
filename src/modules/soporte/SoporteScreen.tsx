import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

type TicketEstado = 'abierto' | 'en_revision' | 'resuelto' | 'cerrado';
type TicketPrioridad = 'baja' | 'media' | 'alta';
type FiltroEstado = 'todos' | TicketEstado;

type Ticket = {
  _id: string;
  usuario_id: number;
  categoria: string;
  titulo: string;
  descripcion: string;
  estado: TicketEstado;
  prioridad: TicketPrioridad;
  respuesta_admin?: string;
  createdAt?: string;
  updatedAt?: string;
};

const categorias = [
  'Asistencia',
  'Nómina',
  'Vacaciones',
  'Contrato',
  'Credencial',
  'Datos personales',
  'Acceso a la app',
  'Otro',
];

const prioridades: TicketPrioridad[] = ['baja', 'media', 'alta'];

const filtrosEstado: { value: FiltroEstado; label: string; description: string }[] = [
  { value: 'todos', label: 'Todos', description: 'Historial general' },
  { value: 'abierto', label: 'Abiertos', description: 'Pendientes de revisión' },
  { value: 'en_revision', label: 'En revisión', description: 'En seguimiento' },
  { value: 'resuelto', label: 'Resueltos', description: 'Atendidos por admin' },
  { value: 'cerrado', label: 'Cerrados', description: 'Archivados' },
];

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

function estadoLabel(estado: TicketEstado) {
  const map: Record<TicketEstado, string> = {
    abierto: 'Abierto',
    en_revision: 'En revisión',
    resuelto: 'Resuelto',
    cerrado: 'Cerrado',
  };

  return map[estado] || estado;
}

function prioridadLabel(prioridad: TicketPrioridad) {
  const map: Record<TicketPrioridad, string> = {
    baja: 'Baja',
    media: 'Media',
    alta: 'Alta',
  };

  return map[prioridad] || prioridad;
}

function getProgressText(estado: TicketEstado) {
  if (estado === 'abierto') {
    return 'Tu reporte fue recibido y está pendiente de revisión administrativa.';
  }

  if (estado === 'en_revision') {
    return 'El área administrativa ya está revisando tu reporte.';
  }

  if (estado === 'resuelto') {
    return 'El área administrativa marcó este reporte como resuelto.';
  }

  return 'Este ticket fue cerrado y quedó como antecedente en tu historial.';
}

export default function SoporteScreen() {
  const { theme } = useAuth();
  const isDark = theme === 'dark';
  const colors = getColors(isDark);
  const styles = getStyles(isDark);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categoria, setCategoria] = useState('Asistencia');
  const [prioridad, setPrioridad] = useState<TicketPrioridad>('media');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');

  const resumen = useMemo(() => {
    return {
      total: tickets.length,
      abiertos: tickets.filter((t) => t.estado === 'abierto').length,
      revision: tickets.filter((t) => t.estado === 'en_revision').length,
      resueltos: tickets.filter((t) => t.estado === 'resuelto').length,
      cerrados: tickets.filter((t) => t.estado === 'cerrado').length,
      alta: tickets.filter((t) => t.prioridad === 'alta').length,
    };
  }, [tickets]);

  const ticketsFiltrados = useMemo(() => {
    if (filtroEstado === 'todos') return tickets;
    return tickets.filter((ticket) => ticket.estado === filtroEstado);
  }, [tickets, filtroEstado]);

  function getFilterCount(value: FiltroEstado) {
    if (value === 'todos') return resumen.total;
    if (value === 'abierto') return resumen.abiertos;
    if (value === 'en_revision') return resumen.revision;
    if (value === 'resuelto') return resumen.resueltos;
    return resumen.cerrados;
  }

  async function loadTickets(showLoader = true) {
    try {
      if (showLoader) setLoading(true);
      setMessage('');

      const { data } = await api.get('/soporte/mis-tickets');
      const list = Array.isArray(data?.tickets) ? data.tickets : [];

      setTickets(list);
    } catch (error: any) {
      setMessage(
        error?.response?.data?.message ||
          'No se pudieron cargar los tickets de soporte.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadTickets(false);
    setRefreshing(false);
  }

  async function enviarTicket() {
    const cleanTitulo = titulo.trim();
    const cleanDescripcion = descripcion.trim();

    if (!cleanTitulo) {
      Alert.alert('Campo requerido', 'Escribe un título para el reporte.');
      return;
    }

    if (!cleanDescripcion) {
      Alert.alert('Campo requerido', 'Describe el problema que quieres reportar.');
      return;
    }

    try {
      setSending(true);
      setMessage('');

      await api.post('/soporte/mis-tickets', {
        categoria,
        prioridad,
        titulo: cleanTitulo,
        descripcion: cleanDescripcion,
      });

      setTitulo('');
      setDescripcion('');
      setCategoria('Asistencia');
      setPrioridad('media');

      await loadTickets(false);

      Alert.alert('Reporte enviado', 'Tu incidencia fue registrada correctamente.');
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'No se pudo registrar el reporte de soporte.'
      );
    } finally {
      setSending(false);
    }
  }

  async function cerrarTicket(id: string) {
    Alert.alert(
      'Cerrar ticket',
      '¿Deseas cerrar este ticket? Quedará guardado en tu historial como cerrado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar',
          style: 'destructive',
          onPress: async () => {
            try {
              setClosingId(id);
              await api.patch(`/soporte/mis-tickets/${id}/cerrar`);
              await loadTickets(false);
            } catch (error: any) {
              Alert.alert(
                'Error',
                error?.response?.data?.message || 'No se pudo cerrar el ticket.'
              );
            } finally {
              setClosingId(null);
            }
          },
        },
      ]
    );
  }

  useEffect(() => {
    loadTickets();
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
          <Text style={styles.eyebrow}>Centro de soporte</Text>
          <Text style={styles.title}>Reportar incidencia</Text>
          <Text style={styles.subtitle}>
            Registra problemas relacionados con asistencia, nómina, vacaciones,
            documentos o acceso a la app. Después podrás consultar el avance,
            la respuesta administrativa y el estado final del ticket.
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Total" value={String(resumen.total)} accent="blue" styles={styles} />
          <StatCard label="Abiertos" value={String(resumen.abiertos)} accent="teal" styles={styles} />
          <StatCard label="En revisión" value={String(resumen.revision)} accent="blue" styles={styles} />
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Resueltos" value={String(resumen.resueltos)} accent="teal" styles={styles} />
          <StatCard label="Cerrados" value={String(resumen.cerrados)} accent="blue" styles={styles} />
          <StatCard label="Alta prioridad" value={String(resumen.alta)} accent="danger" styles={styles} />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionEyebrow}>Nuevo reporte</Text>
          <Text style={styles.sectionTitle}>Detalle de la incidencia</Text>

          <Text style={styles.label}>Categoría</Text>
          <View style={styles.chipGrid}>
            {categorias.map((item) => (
              <Pressable
                key={item}
                style={[styles.chip, categoria === item && styles.chipActive]}
                onPress={() => setCategoria(item)}
              >
                <Text style={[styles.chipText, categoria === item && styles.chipTextActive]}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Prioridad</Text>
          <View style={styles.chipGrid}>
            {prioridades.map((item) => (
              <Pressable
                key={item}
                style={[
                  styles.chip,
                  prioridad === item && styles.chipActive,
                  prioridad === item && item === 'alta' && styles.chipActiveDanger,
                ]}
                onPress={() => setPrioridad(item)}
              >
                <Text style={[styles.chipText, prioridad === item && styles.chipTextActive]}>
                  {item.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Título</Text>
          <TextInput
            value={titulo}
            onChangeText={setTitulo}
            placeholder="Ej. Mi contrato no abre"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />

          <Text style={styles.label}>Descripción</Text>
          <TextInput
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Describe qué ocurrió, cuándo pasó y qué necesitas que se revise."
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.textarea]}
            multiline
            textAlignVertical="top"
          />

          <Pressable
            style={[styles.primaryButton, sending && styles.primaryButtonDisabled]}
            onPress={enviarTicket}
            disabled={sending}
          >
            <Text style={styles.primaryButtonText}>
              {sending ? 'Enviando...' : 'Enviar reporte'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <View style={styles.historyHeaderText}>
              <Text style={styles.sectionEyebrow}>Seguimiento</Text>
              <Text style={styles.sectionTitle}>Mis reportes</Text>
              <Text style={styles.historySubtitle}>
                Consulta el estado de tus tickets, revisa la respuesta del administrador
                y cierra los casos cuando ya no requieran seguimiento.
              </Text>
            </View>

            <Pressable style={styles.refreshButton} onPress={() => loadTickets()}>
              <Text style={styles.refreshButtonText}>Actualizar</Text>
            </Pressable>
          </View>

          <View style={styles.statusFilterPanel}>
            <View style={styles.statusFilterHeader}>
              <View>
                <Text style={styles.statusFilterEyebrow}>Estado del seguimiento</Text>
                <Text style={styles.statusFilterTitle}>Filtrar reportes</Text>
              </View>

              <View style={styles.statusFilterTotalBadge}>
                <Text style={styles.statusFilterTotalNumber}>{ticketsFiltrados.length}</Text>
                <Text style={styles.statusFilterTotalLabel}>visibles</Text>
              </View>
            </View>

            <View style={styles.statusFilterGrid}>
              {filtrosEstado.map((item) => {
                const active = filtroEstado === item.value;
                const count = getFilterCount(item.value);

                return (
                  <Pressable
                    key={item.value}
                    style={[
                      styles.statusFilterCard,
                      active && styles.statusFilterCardActive,
                      item.value === 'resuelto' && styles.statusFilterCardSuccess,
                      item.value === 'cerrado' && styles.statusFilterCardMuted,
                    ]}
                    onPress={() => setFiltroEstado(item.value)}
                  >
                    <View style={styles.statusFilterCardTop}>
                      <Text
                        style={[
                          styles.statusFilterCardLabel,
                          active && styles.statusFilterCardLabelActive,
                        ]}
                      >
                        {item.label}
                      </Text>

                      <Text
                        style={[
                          styles.statusFilterCardCount,
                          active && styles.statusFilterCardCountActive,
                        ]}
                      >
                        {count}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.statusFilterCardDescription,
                        active && styles.statusFilterCardDescriptionActive,
                      ]}
                    >
                      {item.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>Cargando tickets...</Text>
            </View>
          ) : ticketsFiltrados.length > 0 ? (
            <View style={styles.ticketList}>
              {ticketsFiltrados.map((ticket) => (
                <View key={ticket._id} style={styles.ticketCard}>
                  <View style={styles.ticketTop}>
                    <View style={styles.ticketTitleBlock}>
                      <Text style={styles.ticketCategory}>{ticket.categoria}</Text>
                      <Text style={styles.ticketTitle}>{ticket.titulo}</Text>
                    </View>

                    <View
                      style={[
                        styles.ticketStatusBadge,
                        ticket.estado === 'abierto' && styles.statusOpen,
                        ticket.estado === 'en_revision' && styles.statusReview,
                        ticket.estado === 'resuelto' && styles.statusResolved,
                        ticket.estado === 'cerrado' && styles.statusClosed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.ticketStatusText,
                          ticket.estado === 'abierto' && styles.statusTextOpen,
                          ticket.estado === 'en_revision' && styles.statusTextReview,
                          ticket.estado === 'resuelto' && styles.statusTextResolved,
                          ticket.estado === 'cerrado' && styles.statusTextClosed,
                        ]}
                      >
                        {estadoLabel(ticket.estado)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.ticketDescription}>{ticket.descripcion}</Text>

                  <View style={styles.progressBox}>
                    <Text style={styles.progressLabel}>Seguimiento</Text>
                    <Text style={styles.progressText}>{getProgressText(ticket.estado)}</Text>
                  </View>

                  {ticket.respuesta_admin ? (
                    <View style={styles.adminResponse}>
                      <Text style={styles.adminResponseLabel}>Respuesta administrativa</Text>
                      <Text style={styles.adminResponseText}>{ticket.respuesta_admin}</Text>
                    </View>
                  ) : (
                    <View style={styles.pendingResponse}>
                      <Text style={styles.pendingResponseLabel}>Sin respuesta administrativa</Text>
                      <Text style={styles.pendingResponseText}>
                        El área correspondiente aún no ha registrado una respuesta para este reporte.
                      </Text>
                    </View>
                  )}

                  <View style={styles.detailGrid}>
                    <View style={styles.detailBox}>
                      <Text style={styles.detailLabel}>Prioridad</Text>
                      <Text
                        style={[
                          styles.detailValue,
                          ticket.prioridad === 'alta' && styles.priorityHighText,
                        ]}
                      >
                        {prioridadLabel(ticket.prioridad)}
                      </Text>
                    </View>

                    <View style={styles.detailBox}>
                      <Text style={styles.detailLabel}>Creación</Text>
                      <Text style={styles.detailValue}>{formatDate(ticket.createdAt)}</Text>
                    </View>

                    <View style={styles.detailBox}>
                      <Text style={styles.detailLabel}>Actualización</Text>
                      <Text style={styles.detailValue}>{formatDate(ticket.updatedAt)}</Text>
                    </View>
                  </View>

                  {ticket.estado !== 'cerrado' ? (
                    <Pressable
                      style={[
                        styles.closeButton,
                        closingId === ticket._id && styles.closeButtonDisabled,
                      ]}
                      onPress={() => cerrarTicket(ticket._id)}
                      disabled={closingId === ticket._id}
                    >
                      <Text style={styles.closeButtonText}>
                        {closingId === ticket._id ? 'Cerrando...' : 'Cerrar ticket'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Sin reportes para mostrar</Text>
              <Text style={styles.emptyText}>
                No hay tickets registrados con el filtro seleccionado.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
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
  accent: 'blue' | 'teal' | 'danger';
  styles: any;
}) {
  return (
    <View style={styles.statCard}>
      <View
        style={[
          styles.statAccent,
          accent === 'teal'
            ? styles.statAccentTeal
            : accent === 'danger'
              ? styles.statAccentDanger
              : styles.statAccentBlue,
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
    danger: '#D64545',
    dangerBg: 'rgba(214,69,69,0.12)',
    success: isDark ? '#2DD4BF' : '#0F766E',
    successBg: isDark ? 'rgba(45,212,191,0.13)' : 'rgba(15,118,110,0.1)',
    mutedBg: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.16)',
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
      lineHeight: 40,
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
      marginBottom: 18,
    },
    statCard: {
      flex: 1,
      minHeight: 112,
      backgroundColor: COLORS.card,
      borderRadius: 22,
      padding: 14,
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
    statAccentDanger: {
      backgroundColor: COLORS.danger,
    },
    statValue: {
      color: COLORS.text,
      fontSize: 24,
      fontWeight: '900',
    },
    statLabel: {
      color: COLORS.textMuted,
      fontSize: 13,
      fontWeight: '800',
      marginTop: 4,
    },
    formCard: {
      backgroundColor: COLORS.card,
      borderRadius: 28,
      padding: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginBottom: 18,
      elevation: 3,
    },
    sectionEyebrow: {
      color: COLORS.teal,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    sectionTitle: {
      color: COLORS.text,
      fontSize: 24,
      fontWeight: '900',
      marginBottom: 16,
    },
    label: {
      color: COLORS.textMuted,
      fontSize: 13,
      fontWeight: '900',
      marginBottom: 10,
      marginTop: 8,
    },
    chipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 10,
    },
    chip: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.cardSoft,
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: 999,
    },
    chipActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    chipActiveDanger: {
      backgroundColor: COLORS.danger,
      borderColor: COLORS.danger,
    },
    chipText: {
      color: COLORS.textMuted,
      fontSize: 12,
      fontWeight: '900',
    },
    chipTextActive: {
      color: '#FFFFFF',
    },
    input: {
      minHeight: 52,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.cardSoft,
      color: COLORS.text,
      paddingHorizontal: 16,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 10,
    },
    textarea: {
      minHeight: 120,
      paddingTop: 14,
      lineHeight: 22,
    },
    primaryButton: {
      marginTop: 10,
      minHeight: 54,
      borderRadius: 18,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonDisabled: {
      opacity: 0.65,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '900',
    },
    historyCard: {
      backgroundColor: COLORS.card,
      borderRadius: 28,
      padding: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
      elevation: 3,
    },
    historyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      alignItems: 'flex-start',
      marginBottom: 14,
    },
    historyHeaderText: {
      flex: 1,
    },
    historySubtitle: {
      color: COLORS.textMuted,
      fontSize: 14,
      lineHeight: 21,
      marginTop: -6,
      marginBottom: 4,
    },
    refreshButton: {
      backgroundColor: COLORS.cardSoft,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    refreshButtonText: {
      color: COLORS.primary,
      fontWeight: '900',
      fontSize: 13,
    },
    statusFilterPanel: {
      backgroundColor: isDark ? 'rgba(56,189,248,0.07)' : 'rgba(10,87,164,0.06)',
      borderRadius: 22,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 14,
      marginBottom: 16,
    },
    statusFilterHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      alignItems: 'center',
      marginBottom: 12,
    },
    statusFilterEyebrow: {
      color: COLORS.teal,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 3,
    },
    statusFilterTitle: {
      color: COLORS.text,
      fontSize: 17,
      fontWeight: '900',
    },
    statusFilterTotalBadge: {
      minWidth: 74,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
    },
    statusFilterTotalNumber: {
      color: COLORS.primary,
      fontSize: 18,
      fontWeight: '900',
    },
    statusFilterTotalLabel: {
      color: COLORS.textMuted,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    statusFilterGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    statusFilterCard: {
      width: '48%',
      minHeight: 86,
      borderRadius: 18,
      padding: 12,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    statusFilterCardActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    statusFilterCardSuccess: {
      borderColor: isDark ? 'rgba(45,212,191,0.24)' : 'rgba(15,118,110,0.2)',
    },
    statusFilterCardMuted: {
      opacity: 0.95,
    },
    statusFilterCardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    statusFilterCardLabel: {
      color: COLORS.text,
      fontSize: 13,
      fontWeight: '900',
      flex: 1,
    },
    statusFilterCardLabelActive: {
      color: '#FFFFFF',
    },
    statusFilterCardCount: {
      color: COLORS.primary,
      fontSize: 20,
      fontWeight: '900',
    },
    statusFilterCardCountActive: {
      color: '#FFFFFF',
    },
    statusFilterCardDescription: {
      color: COLORS.textMuted,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '700',
    },
    statusFilterCardDescriptionActive: {
      color: 'rgba(255,255,255,0.85)',
    },
    message: {
      color: COLORS.warning,
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 12,
    },
    loadingBox: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      gap: 10,
    },
    loadingText: {
      color: COLORS.textMuted,
      fontWeight: '800',
    },
    ticketList: {
      gap: 14,
    },
    ticketCard: {
      backgroundColor: COLORS.cardSoft,
      borderRadius: 22,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    ticketTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 10,
    },
    ticketTitleBlock: {
      flex: 1,
    },
    ticketCategory: {
      color: COLORS.teal,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    ticketTitle: {
      color: COLORS.text,
      fontSize: 18,
      fontWeight: '900',
      lineHeight: 23,
    },
    ticketStatusBadge: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    ticketStatusText: {
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    statusOpen: {
      backgroundColor: COLORS.warningBg,
    },
    statusReview: {
      backgroundColor: COLORS.mutedBg,
    },
    statusResolved: {
      backgroundColor: COLORS.successBg,
    },
    statusClosed: {
      backgroundColor: COLORS.mutedBg,
    },
    statusTextOpen: {
      color: COLORS.warning,
    },
    statusTextReview: {
      color: COLORS.primary,
    },
    statusTextResolved: {
      color: COLORS.success,
    },
    statusTextClosed: {
      color: COLORS.textMuted,
    },
    ticketDescription: {
      color: COLORS.textMuted,
      fontSize: 14,
      lineHeight: 22,
    },
    progressBox: {
      marginTop: 12,
      backgroundColor: isDark ? 'rgba(56,189,248,0.1)' : 'rgba(10,87,164,0.08)',
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    progressLabel: {
      color: COLORS.primary,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 5,
    },
    progressText: {
      color: COLORS.textMuted,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '700',
    },
    adminResponse: {
      marginTop: 12,
      backgroundColor: isDark ? 'rgba(45,212,191,0.12)' : 'rgba(34,184,176,0.1)',
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(45,212,191,0.24)' : 'rgba(34,184,176,0.2)',
    },
    adminResponseLabel: {
      color: COLORS.teal,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 5,
    },
    adminResponseText: {
      color: COLORS.text,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '700',
    },
    pendingResponse: {
      marginTop: 12,
      backgroundColor: COLORS.mutedBg,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    pendingResponseLabel: {
      color: COLORS.textMuted,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 5,
    },
    pendingResponseText: {
      color: COLORS.textMuted,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '700',
    },
    detailGrid: {
      marginTop: 14,
      gap: 10,
    },
    detailBox: {
      backgroundColor: COLORS.card,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    detailLabel: {
      color: COLORS.textMuted,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 5,
    },
    detailValue: {
      color: COLORS.text,
      fontSize: 13,
      fontWeight: '900',
    },
    priorityHighText: {
      color: COLORS.danger,
    },
    closeButton: {
      marginTop: 14,
      minHeight: 44,
      borderRadius: 15,
      backgroundColor: COLORS.dangerBg,
      borderWidth: 1,
      borderColor: COLORS.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeButtonDisabled: {
      opacity: 0.55,
    },
    closeButtonText: {
      color: COLORS.danger,
      fontWeight: '900',
      fontSize: 13,
    },
    emptyCard: {
      backgroundColor: COLORS.cardSoft,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 20,
      alignItems: 'center',
    },
    emptyTitle: {
      color: COLORS.primary,
      fontSize: 20,
      fontWeight: '900',
      textAlign: 'center',
    },
    emptyText: {
      color: COLORS.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      marginTop: 8,
    },
  });
}