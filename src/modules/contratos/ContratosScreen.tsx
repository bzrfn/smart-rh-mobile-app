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
import { sharePrivateMedia } from '../../services/privateMedia';

type Props = {
  navigation: any;
};

type ContratoItem = {
  id: number;
  usuario_id: number;
  nombre?: string;
  apellido?: string;
  correo?: string;
  tipo_contrato: string;
  salario_base: number;
  fecha_inicio: string;
  fecha_fin?: string | null;
  estado: 'activo' | 'inactivo' | 'finalizado';
  contrato_pdf_url?: string | null;
};

export default function ContratosScreen({ navigation }: Props) {
  const { permisos, user, theme, token } = useAuth();

  const isDark = theme === 'dark';
  const styles = getStyles(isDark);
  const colors = getColors(isDark);

  const [items, setItems] = useState<ContratoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingId, setGeneratingId] = useState<number | null>(null);

  useEffect(() => {
    if (!permisos.contratos) {
      Alert.alert('Acceso restringido', 'No tienes permiso para visualizar este módulo.', [
        { text: 'Aceptar', onPress: () => navigation.navigate('Home') },
      ]);
    }
  }, [permisos.contratos, navigation]);

  async function loadContratos(isRefresh = false) {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const { data } = await api.get('/contratos/me');
      setItems(Array.isArray(data?.contratos) ? data.contratos : []);
    } catch (e: any) {
      Alert.alert(
        'Error',
        e?.response?.data?.message ?? 'No se pudo cargar la información contractual.'
      );
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    if (!permisos.contratos) return;
    loadContratos();
  }, [permisos.contratos]);

  const summary = useMemo(() => {
    return {
      total: items.length,
      activos: items.filter((i) => i.estado === 'activo').length,
      inactivos: items.filter((i) => i.estado === 'inactivo').length,
      finalizados: items.filter((i) => i.estado === 'finalizado').length,
    };
  }, [items]);

  async function openContract(url?: string | null) {
    if (!url) {
      Alert.alert(
        'Contrato no disponible',
        'Este contrato todavía no tiene PDF generado.'
      );
      return;
    }

    try {
      await sharePrivateMedia(
        url,
        token,
        'SMART RH - Contrato laboral'
      );
    } catch (error) {
      Alert.alert(
        'No se pudo abrir',
        error instanceof Error
          ? error.message
          : 'No se pudo abrir el contrato.'
      );
    }
  }

  async function generateContractPdf(item: ContratoItem) {
    if (!user?.id) return;

    try {
      setGeneratingId(item.id);

      const { data } = await api.post(`/documentos/usuarios/${user.id}/contrato-pdf`);

      if (data?.contrato_pdf_url) {
        setItems((prev) =>
          prev.map((c) =>
            c.id === item.id ? { ...c, contrato_pdf_url: data.contrato_pdf_url } : c
          )
        );
      }

      await loadContratos(true);
      Alert.alert('Contrato generado', 'El PDF del contrato se generó correctamente.');
    } catch (e: any) {
      Alert.alert(
        'No se pudo generar',
        e?.response?.data?.message ?? 'Valida que exista un contrato registrado.'
      );
    } finally {
      setGeneratingId(null);
    }
  }

  if (!permisos.contratos) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadContratos(true)}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Consulta contractual</Text>
          <Text style={styles.title}>Contratos</Text>
          <Text style={styles.text}>
            Revisa tu historial contractual, vigencia, estado, salario base y contrato PDF generado.
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <SummaryCard label="Total" value={summary.total} accent="blue" styles={styles} />
          <SummaryCard label="Activos" value={summary.activos} accent="teal" styles={styles} />
          <SummaryCard label="Inactivos" value={summary.inactivos} accent="blue" styles={styles} />
          <SummaryCard label="Finalizados" value={summary.finalizados} accent="danger" styles={styles} />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionEyebrow}>Historial</Text>
              <Text style={styles.sectionTitle}>Mis contratos</Text>
              <Text style={styles.sectionSubtitle}>
                Consulta contratos registrados y abre el PDF generado.
              </Text>
            </View>

            <Pressable style={styles.refreshButton} onPress={() => loadContratos(true)}>
              <Text style={styles.refreshButtonText}>Actualizar</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>Cargando contratos...</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Sin registros</Text>
              <Text style={styles.emptyText}>Aún no tienes contratos registrados.</Text>
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

                <Text style={styles.requestTitle}>Contrato #{item.id}</Text>

                <Text style={styles.requestSubtitle}>
                  {formatDateDisplay(item.fecha_inicio)} →{' '}
                  {item.fecha_fin ? formatDateDisplay(item.fecha_fin) : 'Sin fecha fin'}
                </Text>

                <View style={styles.metricsRow}>
                  <MetricChip label="Tipo" value={capitalizeText(item.tipo_contrato)} styles={styles} />
                  <MetricChip label="Estado" value={capitalizeText(item.estado)} styles={styles} />
                </View>

                <View style={styles.metricsRow}>
                  <MetricChip
                    label="Salario base"
                    value={`$${Number(item.salario_base).toFixed(2)}`}
                    highlight
                    styles={styles}
                  />

                  <MetricChip
                    label="PDF"
                    value={item.contrato_pdf_url ? 'Disponible' : 'Pendiente'}
                    styles={styles}
                  />
                </View>

                <View style={styles.actionsRow}>
                  <Pressable
                    style={[
                      styles.actionButton,
                      !item.contrato_pdf_url && styles.actionButtonDisabled,
                    ]}
                    disabled={!item.contrato_pdf_url}
                    onPress={() => openContract(item.contrato_pdf_url)}
                  >
                    <Text style={styles.actionButtonText}>Visualizar contrato</Text>
                  </Pressable>

                  <Pressable
                    style={styles.actionButtonSecondary}
                    disabled={generatingId === item.id}
                    onPress={() => generateContractPdf(item)}
                  >
                    <Text style={styles.actionButtonSecondaryText}>
                      {generatingId === item.id
                        ? 'Generando...'
                        : item.contrato_pdf_url
                        ? 'Generar nuevo PDF'
                        : 'Generar PDF'}
                    </Text>
                  </Pressable>
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

function MetricChip({
  label,
  value,
  highlight = false,
  styles,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  styles: any;
}) {
  return (
    <View style={[styles.metricChip, highlight && styles.metricChipHighlight]}>
      <Text style={[styles.metricChipLabel, highlight && styles.metricChipLabelHighlight]}>
        {label}
      </Text>
      <Text style={[styles.metricChipValue, highlight && styles.metricChipValueHighlight]}>
        {value}
      </Text>
    </View>
  );
}

function getStatusBadgeStyle(estado: ContratoItem['estado'], styles: any) {
  if (estado === 'activo') return styles.statusApproved;
  if (estado === 'finalizado') return styles.statusRejected;
  return styles.statusPending;
}

function getStatusTextStyle(estado: ContratoItem['estado'], styles: any) {
  if (estado === 'activo') return styles.statusApprovedText;
  if (estado === 'finalizado') return styles.statusRejectedText;
  return styles.statusPendingText;
}

function formatDateDisplay(value?: string | null) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function capitalizeText(value?: string | null) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getColors(isDark: boolean) {
  return {
    background: isDark ? '#07111F' : '#F4F7FB',
    card: isDark ? '#0F1B2D' : '#FFFFFF',
    cardSoft: isDark ? '#111F33' : '#F9FBFD',
    requestCard: isDark ? '#111F33' : '#FBFCFE',
    primary: isDark ? '#38BDF8' : '#0A57A4',
    primarySoft: isDark ? 'rgba(56,189,248,0.14)' : 'rgba(10,87,164,0.10)',
    teal: isDark ? '#2DD4BF' : '#22B8B0',
    tealBg: isDark ? 'rgba(45,212,191,0.14)' : 'rgba(34,184,176,0.12)',
    text: isDark ? '#F8FAFC' : '#0F172A',
    textMuted: isDark ? '#9FB0C4' : '#5B6B81',
    border: isDark ? '#26364D' : '#D9E1EC',
    danger: '#D64545',
    dangerBg: 'rgba(214,69,69,0.12)',
  };
}

function getStyles(isDark: boolean) {
  const COLORS = getColors(isDark);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    container: { padding: 20, paddingBottom: 36, backgroundColor: COLORS.background },

    heroCard: {
      backgroundColor: isDark ? '#0A57A4' : COLORS.primary,
      borderRadius: 30,
      padding: 24,
      marginBottom: 18,
    },
    eyebrow: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    title: {
      marginTop: 8,
      fontSize: 30,
      fontWeight: '900',
      color: '#FFFFFF',
    },
    text: {
      marginTop: 10,
      fontSize: 15,
      color: 'rgba(255,255,255,0.82)',
      lineHeight: 24,
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
    summaryAccent: { width: 42, height: 6, borderRadius: 999, marginBottom: 12 },
    summaryAccentBlue: { backgroundColor: COLORS.primary },
    summaryAccentTeal: { backgroundColor: COLORS.teal },
    summaryAccentDanger: { backgroundColor: COLORS.danger },
    summaryValue: { fontSize: 22, fontWeight: '900', color: COLORS.text },
    summaryLabel: { marginTop: 4, fontSize: 13, color: COLORS.textMuted, fontWeight: '700' },

    sectionCard: {
      backgroundColor: COLORS.card,
      borderRadius: 26,
      padding: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 18,
    },
    sectionHeaderText: { flex: 1 },
    sectionEyebrow: {
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: COLORS.textMuted,
    },
    sectionTitle: {
      marginTop: 6,
      fontSize: 22,
      fontWeight: '900',
      color: COLORS.text,
    },
    sectionSubtitle: {
      marginTop: 6,
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
    refreshButtonText: { color: COLORS.primary, fontWeight: '900', fontSize: 13 },

    loadingBox: { paddingVertical: 24, alignItems: 'center' },
    loadingText: { marginTop: 10, color: COLORS.textMuted, fontWeight: '700' },

    emptyBox: { paddingVertical: 24, alignItems: 'center' },
    emptyTitle: { fontSize: 18, fontWeight: '900', color: COLORS.primary },
    emptyText: { marginTop: 8, color: COLORS.textMuted, textAlign: 'center' },

    requestCard: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 22,
      padding: 16,
      marginBottom: 14,
      backgroundColor: COLORS.requestCard,
    },
    requestTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    requestAccent: {
      width: 52,
      height: 6,
      borderRadius: 999,
      backgroundColor: COLORS.primary,
    },
    requestTitle: {
      marginTop: 14,
      fontSize: 18,
      fontWeight: '900',
      color: COLORS.text,
    },
    requestSubtitle: {
      marginTop: 4,
      color: COLORS.textMuted,
      fontSize: 13,
    },

    metricsRow: {
      flexDirection: 'row',
      marginTop: 14,
      justifyContent: 'space-between',
    },
    metricChip: {
      width: '48.5%',
      backgroundColor: COLORS.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    metricChipHighlight: {
      backgroundColor: COLORS.primarySoft,
      borderColor: COLORS.primary,
    },
    metricChipLabel: {
      fontSize: 12,
      fontWeight: '900',
      color: COLORS.textMuted,
      textTransform: 'uppercase',
    },
    metricChipLabelHighlight: { color: COLORS.primary },
    metricChipValue: {
      marginTop: 6,
      fontSize: 15,
      fontWeight: '800',
      color: COLORS.text,
    },
    metricChipValueHighlight: { color: COLORS.primary },

    actionsRow: {
      marginTop: 16,
      gap: 10,
    },
    actionButton: {
      backgroundColor: COLORS.primary,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
    },
    actionButtonDisabled: {
      opacity: 0.5,
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontWeight: '900',
    },
    actionButtonSecondary: {
      backgroundColor: COLORS.primarySoft,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
    },
    actionButtonSecondaryText: {
      color: COLORS.primary,
      fontWeight: '900',
    },

    statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
    statusBadgeText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
    statusPending: { backgroundColor: COLORS.primarySoft },
    statusPendingText: { color: COLORS.primary },
    statusApproved: { backgroundColor: COLORS.tealBg },
    statusApprovedText: { color: COLORS.teal },
    statusRejected: { backgroundColor: COLORS.dangerBg },
    statusRejectedText: { color: '#FF8A8A' },
  });
}