import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

type Props = {
  navigation: any;
};

type VacacionItem = {
  id: number;
  usuario_id: number;
  dias_disponibles: number;
  dias_disponibles_actuales?: number;
  dias_solicitados: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
};

export default function VacacionesScreen({ navigation }: Props) {
  const { permisos, theme } = useAuth();
  const isDark = theme === 'dark';
  const COLORS = getColors(isDark);
  const styles = getStyles(isDark);

  const [items, setItems] = useState<VacacionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [diasDisponibles, setDiasDisponibles] = useState(0);
  const [diasSolicitados, setDiasSolicitados] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const [fechaInicioDate, setFechaInicioDate] = useState<Date | null>(null);
  const [fechaFinDate, setFechaFinDate] = useState<Date | null>(null);
  const [showInicioPicker, setShowInicioPicker] = useState(false);
  const [showFinPicker, setShowFinPicker] = useState(false);

  useEffect(() => {
    if (!permisos.vacaciones) {
      Alert.alert('Acceso restringido', 'No tienes permiso para visualizar este módulo.', [
        { text: 'Aceptar', onPress: () => navigation.navigate('Home') },
      ]);
    }
  }, [permisos.vacaciones, navigation]);

  async function loadVacaciones(isRefresh = false) {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const { data } = await api.get('/vacaciones/me');

      setItems(Array.isArray(data?.vacaciones) ? data.vacaciones : []);
      setDiasDisponibles(Number(data?.dias_disponibles_actuales ?? 0));
    } catch (e: any) {
      Alert.alert(
        'Error',
        e?.response?.data?.message ?? 'No se pudieron cargar tus solicitudes de vacaciones.'
      );
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    if (!permisos.vacaciones) return;
    loadVacaciones();
  }, [permisos.vacaciones]);

  const statusSummary = useMemo(() => {
    return {
      total: items.length,
      pendientes: items.filter((i) => i.estado === 'pendiente').length,
      aprobadas: items.filter((i) => i.estado === 'aprobada').length,
      rechazadas: items.filter((i) => i.estado === 'rechazada').length,
    };
  }, [items]);

  function formatDateToApi(date: Date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function handleInicioChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS !== 'ios') setShowInicioPicker(false);
    if (event.type === 'dismissed' || !selectedDate) return;

    setFechaInicioDate(selectedDate);
    setFechaInicio(formatDateToApi(selectedDate));

    if (fechaFinDate && selectedDate > fechaFinDate) {
      setFechaFinDate(null);
      setFechaFin('');
    }
  }

  function handleFinChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS !== 'ios') setShowFinPicker(false);
    if (event.type === 'dismissed' || !selectedDate) return;

    setFechaFinDate(selectedDate);
    setFechaFin(formatDateToApi(selectedDate));
  }

  async function onSubmit() {
    if (submitting) return;

    if (!diasSolicitados.trim() || !fechaInicio.trim() || !fechaFin.trim()) {
      Alert.alert('Campos requeridos', 'Completa días solicitados, fecha inicio y fecha fin.');
      return;
    }

    const diasSolicitadosNum = Number(diasSolicitados);

    if (Number.isNaN(diasSolicitadosNum) || diasSolicitadosNum <= 0) {
      Alert.alert('Dato inválido', 'Los días solicitados deben ser mayores a 0.');
      return;
    }

    if (diasSolicitadosNum > diasDisponibles) {
      Alert.alert('Saldo insuficiente', 'Los días solicitados exceden los días disponibles.');
      return;
    }

    if (new Date(fechaFin).getTime() < new Date(fechaInicio).getTime()) {
      Alert.alert('Fechas inválidas', 'La fecha fin no puede ser menor que la fecha inicio.');
      return;
    }

    try {
      setSubmitting(true);

      const { data } = await api.post('/vacaciones', {
        dias_solicitados: diasSolicitadosNum,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      });

      if (!data?.ok) {
        Alert.alert('Error', data?.message ?? 'No se pudo registrar la solicitud.');
        return;
      }

      Alert.alert('Solicitud registrada', data?.message ?? 'Tu solicitud fue enviada correctamente.');

      setDiasSolicitados('');
      setFechaInicio('');
      setFechaFin('');
      setFechaInicioDate(null);
      setFechaFinDate(null);

      await loadVacaciones();
    } catch (e: any) {
      Alert.alert(
        'Error',
        e?.response?.data?.message ?? 'No se pudo registrar la solicitud de vacaciones.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!permisos.vacaciones) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadVacaciones(true)}
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
              <Text style={styles.heroBadgeText}>Vacaciones</Text>
            </View>
          </View>

          <Text style={styles.eyebrow}>Consulta y solicitud</Text>
          <Text style={styles.title}>Vacaciones</Text>
          <Text style={styles.text}>
            Solicita vacaciones, consulta tu saldo disponible y revisa el estado de tus solicitudes.
          </Text>

          <View style={styles.availableCard}>
            <Text style={styles.availableLabel}>Días disponibles actuales</Text>
            <Text style={styles.availableValue}>{diasDisponibles}</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryCard label="Total" value={statusSummary.total} accent="blue" styles={styles} />
          <SummaryCard label="Pendientes" value={statusSummary.pendientes} accent="blue" styles={styles} />
          <SummaryCard label="Aprobadas" value={statusSummary.aprobadas} accent="teal" styles={styles} />
          <SummaryCard label="Rechazadas" value={statusSummary.rechazadas} accent="danger" styles={styles} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Nueva solicitud</Text>
          <Text style={styles.sectionSubtitle}>
            El sistema valida los días disponibles antes de registrar la solicitud.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Días disponibles</Text>
            <View style={styles.readonlyInput}>
              <Text style={styles.readonlyValue}>{diasDisponibles}</Text>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Días solicitados</Text>
            <TextInput
              value={diasSolicitados}
              onChangeText={setDiasSolicitados}
              keyboardType="numeric"
              style={styles.input}
              placeholder="3"
              placeholderTextColor={COLORS.placeholder}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Fecha inicio</Text>
            <Pressable style={styles.dateInput} onPress={() => setShowInicioPicker(true)}>
              <Text style={fechaInicio ? styles.dateText : styles.datePlaceholder}>
                {fechaInicio || 'Seleccionar fecha'}
              </Text>
            </Pressable>

            {showInicioPicker && (
              <DateTimePicker
                value={fechaInicioDate || new Date()}
                mode="date"
                display="default"
                onChange={handleInicioChange}
              />
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Fecha fin</Text>
            <Pressable style={styles.dateInput} onPress={() => setShowFinPicker(true)}>
              <Text style={fechaFin ? styles.dateText : styles.datePlaceholder}>
                {fechaFin || 'Seleccionar fecha'}
              </Text>
            </Pressable>

            {showFinPicker && (
              <DateTimePicker
                value={fechaFinDate || fechaInicioDate || new Date()}
                mode="date"
                display="default"
                onChange={handleFinChange}
                minimumDate={fechaInicioDate || undefined}
              />
            )}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              pressed && !submitting ? styles.submitButtonPressed : null,
              submitting ? styles.submitButtonDisabled : null,
            ]}
            onPress={onSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Enviar solicitud</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionEyebrow}>Historial</Text>
              <Text style={styles.sectionTitle}>Mis solicitudes</Text>
              <Text style={styles.sectionSubtitle}>
                Consulta el estado actual de tus solicitudes registradas.
              </Text>
            </View>

            <Pressable style={styles.refreshButton} onPress={() => loadVacaciones(true)}>
              <Text style={styles.refreshButtonText}>Actualizar</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.loadingText}>Cargando solicitudes...</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Sin solicitudes</Text>
              <Text style={styles.emptyText}>Aún no tienes solicitudes de vacaciones registradas.</Text>
            </View>
          ) : (
            items.map((item) => (
              <View key={item.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <View style={styles.requestHeaderText}>
                    <Text style={styles.requestTitle}>Solicitud #{item.id}</Text>
                    <Text style={styles.requestSubtitle}>
                      {item.fecha_inicio} → {item.fecha_fin}
                    </Text>
                  </View>

                  <StatusBadge estado={item.estado} styles={styles} />
                </View>

                <View style={styles.requestDetails}>
                  <Text style={styles.requestDetail}>
                    Días solicitados: <Text style={styles.requestValue}>{item.dias_solicitados}</Text>
                  </Text>

                  <Text style={styles.requestDetail}>
                    Saldo actual:{' '}
                    <Text style={styles.requestValue}>
                      {item.dias_disponibles_actuales ?? diasDisponibles}
                    </Text>
                  </Text>

                  <Text style={styles.requestDetail}>
                    Saldo al registrar:{' '}
                    <Text style={styles.requestValue}>{item.dias_disponibles}</Text>
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
  const accentStyle =
    accent === 'teal'
      ? styles.summaryAccentTeal
      : accent === 'danger'
      ? styles.summaryAccentDanger
      : styles.summaryAccentBlue;

  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryAccent, accentStyle]} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function StatusBadge({ estado, styles }: { estado: VacacionItem['estado']; styles: any }) {
  const badgeStyle =
    estado === 'aprobada'
      ? styles.statusApproved
      : estado === 'rechazada'
      ? styles.statusRejected
      : styles.statusPending;

  const textStyle =
    estado === 'aprobada'
      ? styles.statusApprovedText
      : estado === 'rechazada'
      ? styles.statusRejectedText
      : styles.statusPendingText;

  return (
    <View style={[styles.statusBadge, badgeStyle]}>
      <Text style={[styles.statusBadgeText, textStyle]}>{estado}</Text>
    </View>
  );
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
    tealBg: isDark ? 'rgba(45,212,191,0.14)' : 'rgba(34,184,176,0.12)',
    text: isDark ? '#F8FAFC' : '#0F172A',
    textMuted: isDark ? '#9FB0C4' : '#5B6B81',
    border: isDark ? '#26364D' : '#D9E1EC',
    danger: '#D64545',
    dangerBg: 'rgba(214,69,69,0.12)',
    placeholder: isDark ? '#6B7A90' : '#8B9AAF',
  };
}

function getStyles(isDark: boolean) {
  const COLORS = getColors(isDark);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    container: {
      padding: 20,
      paddingBottom: 32,
      overflow: 'hidden',
      backgroundColor: COLORS.background,
    },

    heroCard: {
      backgroundColor: COLORS.card,
      borderRadius: 24,
      padding: 20,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      elevation: 4,
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    heroPill: {
      backgroundColor: COLORS.primarySoft,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
    },
    heroPillText: {
      color: COLORS.primary,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    heroBadge: {
      backgroundColor: COLORS.tealBg,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
    },
    heroBadgeText: {
      color: COLORS.teal,
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: COLORS.textMuted,
      marginTop: 14,
      marginBottom: 8,
    },
    title: {
      fontSize: 24,
      fontWeight: '900',
      color: COLORS.primary,
      marginBottom: 10,
    },
    text: {
      fontSize: 15,
      color: COLORS.textMuted,
      lineHeight: 22,
    },
    availableCard: {
      marginTop: 16,
      backgroundColor: COLORS.cardSoft,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    availableLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: COLORS.textMuted,
    },
    availableValue: {
      marginTop: 6,
      fontSize: 28,
      fontWeight: '900',
      color: COLORS.primary,
    },

    summaryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: 18,
    },
    summaryCard: {
      width: '48%',
      backgroundColor: COLORS.card,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginBottom: 12,
    },
    summaryAccent: {
      width: 42,
      height: 6,
      borderRadius: 999,
      marginBottom: 12,
    },
    summaryAccentBlue: { backgroundColor: COLORS.primary },
    summaryAccentTeal: { backgroundColor: COLORS.teal },
    summaryAccentDanger: { backgroundColor: COLORS.danger },
    summaryValue: {
      fontSize: 22,
      fontWeight: '900',
      color: COLORS.text,
    },
    summaryLabel: {
      marginTop: 4,
      fontSize: 13,
      color: COLORS.textMuted,
      fontWeight: '700',
    },

    card: {
      backgroundColor: COLORS.card,
      borderRadius: 24,
      padding: 20,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      elevation: 4,
    },

    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 18,
      gap: 12,
    },
    sectionHeaderText: { flex: 1 },
    sectionEyebrow: {
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: COLORS.textMuted,
      marginBottom: 6,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '900',
      color: COLORS.text,
      marginBottom: 8,
    },
    sectionSubtitle: {
      fontSize: 14,
      color: COLORS.textMuted,
      lineHeight: 21,
    },
    refreshButton: {
      backgroundColor: COLORS.primarySoft,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      alignSelf: 'flex-start',
    },
    refreshButtonText: {
      color: COLORS.primary,
      fontWeight: '900',
      fontSize: 13,
    },

    fieldGroup: { marginBottom: 14 },
    label: {
      marginBottom: 8,
      fontSize: 13,
      fontWeight: '700',
      color: COLORS.textMuted,
    },
    input: {
      height: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.cardSoft,
      paddingHorizontal: 14,
      fontSize: 15,
      color: COLORS.text,
    },
    readonlyInput: {
      minHeight: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.cardSoft,
      paddingHorizontal: 14,
      justifyContent: 'center',
    },
    readonlyValue: {
      fontSize: 16,
      fontWeight: '900',
      color: COLORS.primary,
    },
    dateInput: {
      minHeight: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.cardSoft,
      paddingHorizontal: 14,
      justifyContent: 'center',
    },
    dateText: {
      fontSize: 15,
      color: COLORS.text,
    },
    datePlaceholder: {
      fontSize: 15,
      color: COLORS.placeholder,
    },

    submitButton: {
      marginTop: 6,
      height: 54,
      borderRadius: 18,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitButtonPressed: {
      transform: [{ scale: 0.99 }],
      backgroundColor: COLORS.primaryDark,
    },
    submitButtonDisabled: {
      opacity: 0.85,
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '900',
    },

    loadingBox: {
      paddingVertical: 18,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 10,
      color: COLORS.textMuted,
    },

    emptyBox: {
      paddingVertical: 14,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '900',
      color: COLORS.primary,
    },
    emptyText: {
      marginTop: 6,
      color: COLORS.textMuted,
      lineHeight: 20,
    },

    requestCard: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 18,
      padding: 16,
      marginBottom: 12,
      backgroundColor: COLORS.cardSoft,
    },
    requestHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      alignItems: 'flex-start',
    },
    requestHeaderText: { flex: 1 },
    requestTitle: {
      fontSize: 16,
      fontWeight: '900',
      color: COLORS.text,
    },
    requestSubtitle: {
      marginTop: 4,
      color: COLORS.textMuted,
      fontSize: 13,
    },
    requestDetails: {
      marginTop: 14,
      gap: 6,
    },
    requestDetail: {
      color: COLORS.textMuted,
      fontSize: 14,
    },
    requestValue: {
      color: COLORS.text,
      fontWeight: '900',
    },

    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    statusPending: {
      backgroundColor: COLORS.primarySoft,
    },
    statusPendingText: {
      color: COLORS.primary,
    },
    statusApproved: {
      backgroundColor: COLORS.tealBg,
    },
    statusApprovedText: {
      color: COLORS.teal,
    },
    statusRejected: {
      backgroundColor: COLORS.dangerBg,
    },
    statusRejectedText: {
      color: '#B42318',
    },

    shapeTopLeftLarge: {
      position: 'absolute',
      top: -70,
      left: -95,
      width: 230,
      height: 230,
      borderRadius: 115,
      backgroundColor: COLORS.primary,
      opacity: isDark ? 0.16 : 0.08,
    },
    shapeTopLeftSmall: {
      position: 'absolute',
      top: 40,
      left: -28,
      width: 110,
      height: 110,
      borderRadius: 55,
      backgroundColor: COLORS.teal,
      opacity: isDark ? 0.2 : 0.14,
    },
    shapeBottomRightLarge: {
      position: 'absolute',
      bottom: -90,
      right: -90,
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: COLORS.primary,
      opacity: isDark ? 0.16 : 0.08,
    },
    shapeBottomRightSmall: {
      position: 'absolute',
      bottom: 34,
      right: -18,
      width: 95,
      height: 95,
      borderRadius: 48,
      backgroundColor: COLORS.teal,
      opacity: isDark ? 0.22 : 0.25,
    },
  });
}