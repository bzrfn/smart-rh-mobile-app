import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

type AutomaticValidation = {
  estado_validacion?: 'pendiente' | 'consistente' | 'requiere_revision' | string | null;
  analisis_disponible?: boolean | null;
  estado_analisis?: string | null;
  estado_estructura?: string | null;
  puntaje_estructura?: number | null;
  pdf_version?: string | null;
  duplicado_detectado?: boolean | number | null;
  duplicado_de_incapacidad_id?: number | null;
  motivos_revision?: string[] | null;
  analizado_at?: string | null;
};

type IncapacidadAdmin = {
  id: number;
  usuario_id?: number;
  usuario_nombre?: string | null;
  usuario_apellido?: string | null;
  usuario_correo?: string | null;
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
  validacion_automatica?: AutomaticValidation | null;
};

type ReviewDecision = 'aprobada' | 'rechazada';

function formatDate(value?: string | null) {
  if (!value) return 'No registrada';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatScore(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Sin puntaje';
  return `${Math.round(value)}%`;
}

function normalizeLabel(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return 'No registrado';
  return text.replace(/_/g, ' ').toLowerCase();
}

function getEmployeeName(item: IncapacidadAdmin) {
  const userName = `${item.usuario_nombre || ''} ${item.usuario_apellido || ''}`.trim();
  const employeeName = `${item.empleado_nombre || ''} ${item.empleado_apellido || ''}`.trim();
  const fallbackName = `${item.nombre || ''} ${item.apellido || ''}`.trim();

  return userName || employeeName || fallbackName || `Usuario #${item.usuario_id || '-'}`;
}

function getEmployeeDetail(item: IncapacidadAdmin) {
  return item.usuario_correo || `Usuario #${item.usuario_id || '-'}`;
}

function getValidationState(item: IncapacidadAdmin) {
  return String(item.validacion_automatica?.estado_validacion || 'pendiente')
    .trim()
    .toLowerCase();
}

function requiresReview(item: IncapacidadAdmin) {
  const estado = String(item.estado || '').trim().toLowerCase();
  const validation = getValidationState(item);

  return estado === 'pendiente' || validation === 'requiere_revision';
}

function getValidationTitle(value: string) {
  if (value === 'consistente') return 'Validación consistente';
  if (value === 'requiere_revision') return 'Requiere revisión';
  return 'Validación pendiente';
}

function getValidationCopy(item: IncapacidadAdmin) {
  const validation = item.validacion_automatica;

  if (!validation?.analisis_disponible) {
    return 'El análisis automático todavía no está disponible para esta solicitud.';
  }

  if (getValidationState(item) === 'consistente') {
    return 'El archivo no presenta alertas automáticas, pero la decisión final sigue siendo administrativa.';
  }

  const reasons = validation.motivos_revision || [];
  if (reasons.length > 0) {
    return reasons.map(normalizeLabel).join(', ');
  }

  return 'La validación automática marcó esta solicitud para revisión humana.';
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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<ReviewDecision | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  const pendingItems = useMemo(() => items.filter(requiresReview), [items]);
  const automaticReviewCount = useMemo(
    () => pendingItems.filter(item => getValidationState(item) === 'requiere_revision').length,
    [pendingItems]
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

  function openReviewAction(item: IncapacidadAdmin, decision: ReviewDecision) {
    setSelectedId(item.id);
    setSelectedDecision(decision);
    setReviewNote('');
  }

  function closeReviewAction() {
    setSelectedId(null);
    setSelectedDecision(null);
    setReviewNote('');
  }

  async function submitReviewAction(item: IncapacidadAdmin) {
    if (!selectedDecision || selectedId !== item.id) return;

    const note = reviewNote.trim();

    if (selectedDecision === 'rechazada' && !note) {
      Alert.alert(
        'Observación requerida',
        'Agrega el motivo del rechazo antes de continuar.'
      );
      return;
    }

    try {
      setSubmittingId(item.id);

      const { data } = await api.patch(`/incapacidades/${item.id}/revision`, {
        estado: selectedDecision,
        observaciones_admin: note || null,
      });

      closeReviewAction();
      await loadItems(true);

      Alert.alert(
        'Revisión registrada',
        data?.ok
          ? 'La incapacidad se actualizó correctamente.'
          : 'La revisión fue enviada al backend.'
      );
    } catch (e: any) {
      Alert.alert(
        'No se pudo registrar',
        e?.response?.data?.message ||
          'Intenta nuevamente o revisa la conexión con el backend.'
      );
    } finally {
      setSubmittingId(null);
    }
  }

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
            Solicitudes pendientes y documentos marcados por la validación
            inteligente para revisión humana.
          </Text>
        </View>

        <View style={styles.statsRow}>
          <SummaryBox
            label="Por revisar"
            value={String(pendingItems.length)}
            tone={pendingItems.length > 0 ? 'gold' : 'teal'}
            styles={styles}
          />
          <SummaryBox
            label="Con alerta"
            value={String(automaticReviewCount)}
            tone={automaticReviewCount > 0 ? 'danger' : 'teal'}
            styles={styles}
          />
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

        {pendingItems.map(item => {
          const validationState = getValidationState(item);
          const isAutomaticAlert = validationState === 'requiere_revision';
          const validation = item.validacion_automatica;
          const isActionOpen = selectedId === item.id && selectedDecision;
          const isSubmitting = submittingId === item.id;

          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardCode}>
                  <Text style={styles.cardCodeText}>IN</Text>
                </View>
                <View style={styles.cardTitleBox}>
                  <Text style={styles.cardTitle}>{getEmployeeName(item)}</Text>
                  <Text style={styles.cardSubtitle}>{getEmployeeDetail(item)}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    isAutomaticAlert ? styles.dangerBadge : styles.goldBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      isAutomaticAlert ? styles.dangerText : styles.goldText,
                    ]}
                  >
                    {item.estado || 'pendiente'}
                  </Text>
                </View>
              </View>

              <View style={styles.metaGrid}>
                <InfoBox label="Inicio" value={formatDate(item.fecha_inicio)} styles={styles} />
                <InfoBox label="Fin" value={formatDate(item.fecha_fin)} styles={styles} />
                <InfoBox
                  label="Días"
                  value={String(item.dias_calculados ?? '-')}
                  styles={styles}
                />
              </View>

              <View style={styles.reasonBox}>
                <Text style={styles.reasonLabel}>Motivo reportado</Text>
                <Text style={styles.reasonText}>
                  {item.motivo || 'Sin motivo registrado.'}
                </Text>
              </View>

              <View
                style={[
                  styles.reviewBox,
                  isAutomaticAlert ? styles.reviewBoxDanger : styles.reviewBoxNeutral,
                ]}
              >
                <View style={styles.reviewHeader}>
                  <Text
                    style={[
                      styles.reviewTitle,
                      isAutomaticAlert ? styles.dangerText : styles.primaryText,
                    ]}
                  >
                    {getValidationTitle(validationState)}
                  </Text>
                  <Text style={styles.reviewScore}>
                    {formatScore(validation?.puntaje_estructura ?? null)}
                  </Text>
                </View>
                <Text style={styles.reviewText}>{getValidationCopy(item)}</Text>

                <View style={styles.validationGrid}>
                  <SmallPill
                    label="PDF"
                    value={validation?.pdf_version || 'N/D'}
                    styles={styles}
                  />
                  <SmallPill
                    label="Estructura"
                    value={normalizeLabel(validation?.estado_estructura)}
                    styles={styles}
                  />
                  <SmallPill
                    label="Análisis"
                    value={normalizeLabel(validation?.estado_analisis)}
                    styles={styles}
                  />
                </View>
              </View>

              {isActionOpen ? (
                <View style={styles.actionPanel}>
                  <Text style={styles.actionPanelTitle}>
                    {selectedDecision === 'aprobada'
                      ? 'Aprobar incapacidad'
                      : 'Rechazar incapacidad'}
                  </Text>
                  <TextInput
                    value={reviewNote}
                    onChangeText={setReviewNote}
                    placeholder={
                      selectedDecision === 'aprobada'
                        ? 'Observación administrativa opcional'
                        : 'Motivo del rechazo'
                    }
                    placeholderTextColor={colors.muted}
                    multiline
                    style={styles.noteInput}
                    editable={!isSubmitting}
                  />
                  <View style={styles.actionPanelFooter}>
                    <Pressable
                      style={styles.cancelButton}
                      onPress={closeReviewAction}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.cancelButtonText}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.submitButton,
                        selectedDecision === 'rechazada'
                          ? styles.submitDangerButton
                          : styles.submitApproveButton,
                        isSubmitting && styles.disabledButton,
                      ]}
                      onPress={() => submitReviewAction(item)}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.submitButtonText}>
                        {isSubmitting ? 'Guardando...' : 'Confirmar'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => openReviewAction(item, 'aprobada')}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.actionButtonText}>Aprobar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => openReviewAction(item, 'rechazada')}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.actionButtonText}>Rechazar</Text>
                  </Pressable>
                </View>
              )}

              <Text style={styles.cardFooter}>Solicitud #{item.id}</Text>
            </View>
          );
        })}
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
  tone: 'teal' | 'gold' | 'danger';
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

function SmallPill({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: any;
}) {
  return (
    <View style={styles.smallPill}>
      <Text style={styles.smallPillLabel}>{label}</Text>
      <Text style={styles.smallPillValue}>{value}</Text>
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
    tealBorder: { borderColor: COLORS.teal },
    goldBorder: { borderColor: COLORS.gold },
    dangerBorder: { borderColor: COLORS.danger },
    tealText: { color: COLORS.teal },
    goldText: { color: COLORS.gold },
    dangerText: { color: COLORS.danger },
    primaryText: { color: COLORS.primary },
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
      maxWidth: 110,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    goldBadge: { backgroundColor: COLORS.goldBg },
    dangerBadge: { backgroundColor: COLORS.dangerBg },
    statusBadgeText: {
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
    reasonBox: {
      marginTop: 14,
      backgroundColor: COLORS.cardSoft,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    reasonLabel: {
      color: COLORS.muted,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    reasonText: {
      marginTop: 6,
      color: COLORS.text,
      fontSize: 14,
      lineHeight: 21,
    },
    reviewBox: {
      marginTop: 14,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
    },
    reviewBoxNeutral: {
      backgroundColor: COLORS.primarySoft,
      borderColor: COLORS.primary,
    },
    reviewBoxDanger: {
      backgroundColor: COLORS.dangerBg,
      borderColor: COLORS.danger,
    },
    reviewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    reviewTitle: {
      flex: 1,
      fontSize: 13,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    reviewScore: {
      color: COLORS.text,
      fontSize: 13,
      fontWeight: '900',
    },
    reviewText: {
      marginTop: 8,
      color: COLORS.text,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '700',
    },
    validationGrid: {
      marginTop: 12,
      gap: 8,
    },
    smallPill: {
      backgroundColor: COLORS.card,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    smallPillLabel: {
      color: COLORS.muted,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    smallPillValue: {
      marginTop: 2,
      color: COLORS.text,
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'capitalize',
    },
    cardFooter: {
      marginTop: 12,
      color: COLORS.muted,
      fontSize: 12,
      fontWeight: '800',
      textAlign: 'right',
    },
    actionRow: {
      marginTop: 14,
      flexDirection: 'row',
      gap: 10,
    },
    actionButton: {
      flex: 1,
      minHeight: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    approveButton: {
      backgroundColor: COLORS.teal,
    },
    rejectButton: {
      backgroundColor: COLORS.danger,
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '900',
    },
    actionPanel: {
      marginTop: 14,
      backgroundColor: COLORS.cardSoft,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    actionPanelTitle: {
      color: COLORS.text,
      fontSize: 14,
      fontWeight: '900',
      marginBottom: 10,
    },
    noteInput: {
      minHeight: 86,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
      color: COLORS.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      textAlignVertical: 'top',
      fontSize: 14,
      fontWeight: '700',
    },
    actionPanelFooter: {
      marginTop: 10,
      flexDirection: 'row',
      gap: 10,
    },
    cancelButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primarySoft,
    },
    cancelButtonText: {
      color: COLORS.primary,
      fontSize: 13,
      fontWeight: '900',
    },
    submitButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitApproveButton: {
      backgroundColor: COLORS.teal,
    },
    submitDangerButton: {
      backgroundColor: COLORS.danger,
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '900',
    },
    disabledButton: {
      opacity: 0.6,
    },
  });
}
