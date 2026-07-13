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

type NominaItem = {
  id: number;
  usuario_id: number;
  salario_base: number;
  deducciones: number;
  bonos: number;
  total: number;
  estado: 'pendiente' | 'pagado';
  periodo_inicio: string;
  periodo_fin: string;
};

export default function NominaScreen({ navigation }: Props) {
  const { permisos, theme } = useAuth();

  const isDark = theme === 'dark';
  const styles = getStyles(isDark);
  const colors = getColors(isDark);

  const [items, setItems] = useState<NominaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!permisos.nomina) {
      Alert.alert('Acceso restringido', 'No tienes permiso para visualizar este módulo.', [
        { text: 'Aceptar', onPress: () => navigation.navigate('Home') },
      ]);
    }
  }, [permisos.nomina, navigation]);

  async function loadNominas(isRefresh = false) {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const { data } = await api.get('/nominas/me');
      setItems(Array.isArray(data?.nominas) ? data.nominas : []);
    } catch (e: any) {
      Alert.alert(
        'Error',
        e?.response?.data?.message ?? 'No se pudo cargar el historial de nómina.'
      );
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    if (!permisos.nomina) return;
    loadNominas();
  }, [permisos.nomina]);

  const summary = useMemo(() => {
    return {
      total: items.length,
      pendientes: items.filter((i) => i.estado === 'pendiente').length,
      pagadas: items.filter((i) => i.estado === 'pagado').length,
      totalAcumulado: items.reduce((acc, item) => acc + Number(item.total || 0), 0),
    };
  }, [items]);

  if (!permisos.nomina) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadNominas(true)}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Consulta financiera</Text>
          <Text style={styles.title}>Nóminas</Text>
          <Text style={styles.text}>
            Revisa tus periodos de pago, importes generados, deducciones, bonos y el estado actual.
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <SummaryCard label="Total" value={summary.total} accent="blue" styles={styles} />
          <SummaryCard label="Pendientes" value={summary.pendientes} accent="blue" styles={styles} />
          <SummaryCard label="Pagadas" value={summary.pagadas} accent="teal" styles={styles} />
          <SummaryCard
            label="Total acumulado"
            value={`$${summary.totalAcumulado.toFixed(2)}`}
            accent="teal"
            wide
            styles={styles}
          />
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionEyebrow}>Detalle</Text>
              <Text style={styles.sectionTitle}>Mis nóminas</Text>
              <Text style={styles.sectionSubtitle}>
                Consulta el detalle económico y el estado de tus registros de nómina.
              </Text>
            </View>

            <Pressable style={styles.refreshButton} onPress={() => loadNominas(true)}>
              <Text style={styles.refreshButtonText}>Actualizar</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadingText}>Cargando nóminas...</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Sin registros</Text>
              <Text style={styles.emptyText}>Aún no tienes nóminas registradas en el sistema.</Text>
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
                  <Text style={styles.requestTitle}>Nómina #{item.id}</Text>
                  <Text style={styles.requestSubtitle}>
                    {formatDateDisplay(item.periodo_inicio)} → {formatDateDisplay(item.periodo_fin)}
                  </Text>
                </View>

                <View style={styles.metricsGrid}>
                  <MetricChip
                    label="Salario base"
                    value={`$${Number(item.salario_base).toFixed(2)}`}
                    styles={styles}
                  />
                  <MetricChip
                    label="Bonos"
                    value={`$${Number(item.bonos).toFixed(2)}`}
                    styles={styles}
                  />
                  <MetricChip
                    label="Deducciones"
                    value={`$${Number(item.deducciones).toFixed(2)}`}
                    styles={styles}
                  />
                  <MetricChip
                    label="Total"
                    value={`$${Number(item.total).toFixed(2)}`}
                    highlight
                    styles={styles}
                  />
                </View>

                <View style={styles.requestFooter}>
                  <Text style={styles.requestFooterText}>
                    Estado actual del pago:{' '}
                    <Text style={styles.requestFooterValue}>{item.estado}</Text>
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
  wide = false,
  styles,
}: {
  label: string;
  value: number | string;
  accent: 'blue' | 'teal' | 'danger';
  wide?: boolean;
  styles: any;
}) {
  return (
    <View style={[styles.summaryCard, wide ? styles.summaryCardWide : null]}>
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
    <View style={[styles.metricChip, highlight ? styles.metricChipHighlight : null]}>
      <Text style={[styles.metricChipLabel, highlight ? styles.metricChipLabelHighlight : null]}>
        {label}
      </Text>
      <Text style={[styles.metricChipValue, highlight ? styles.metricChipValueHighlight : null]}>
        {value}
      </Text>
    </View>
  );
}

function getStatusBadgeStyle(estado: NominaItem['estado'], styles: any) {
  return estado === 'pagado' ? styles.statusApproved : styles.statusPending;
}

function getStatusTextStyle(estado: NominaItem['estado'], styles: any) {
  return estado === 'pagado' ? styles.statusApprovedText : styles.statusPendingText;
}

function formatDateDisplay(value?: string) {
  if (!value) return '';
  return String(value).slice(0, 10);
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
    container: {
      padding: 20,
      paddingBottom: 36,
      backgroundColor: COLORS.background,
    },

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
      gap: 12,
      marginBottom: 18,
    },
    summaryCard: {
      flex: 1,
      minWidth: '47%',
      backgroundColor: COLORS.card,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    summaryCardWide: {
      minWidth: '100%',
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
      alignItems: 'flex-start',
      marginBottom: 18,
      gap: 12,
    },
    sectionHeaderText: {
      flex: 1,
      minWidth: 0,
    },
    sectionEyebrow: {
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: COLORS.textMuted,
      marginBottom: 6,
    },
    sectionTitle: {
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
      minWidth: 92,
      alignItems: 'center',
    },
    refreshButtonText: {
      color: COLORS.primary,
      fontWeight: '900',
      fontSize: 13,
    },

    loadingBox: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 10,
      color: COLORS.textMuted,
      fontWeight: '700',
    },

    emptyBox: {
      paddingVertical: 22,
      alignItems: 'center',
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: COLORS.primary,
    },
    emptyText: {
      marginTop: 8,
      color: COLORS.textMuted,
      lineHeight: 21,
      textAlign: 'center',
    },

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
    requestHeader: {
      marginTop: 14,
    },
    requestTitle: {
      fontSize: 17,
      fontWeight: '900',
      color: COLORS.text,
    },
    requestSubtitle: {
      marginTop: 4,
      color: COLORS.textMuted,
      fontSize: 13,
    },

    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 16,
    },
    metricChip: {
      width: '48%',
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
      letterSpacing: 0.8,
    },
    metricChipLabelHighlight: {
      color: COLORS.primary,
    },
    metricChipValue: {
      marginTop: 6,
      fontSize: 15,
      fontWeight: '800',
      color: COLORS.text,
    },
    metricChipValueHighlight: {
      color: COLORS.primary,
    },

    requestFooter: {
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    requestFooterText: {
      fontSize: 13,
      color: COLORS.textMuted,
    },
    requestFooterValue: {
      fontWeight: '900',
      color: COLORS.text,
      textTransform: 'capitalize',
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
  });
}