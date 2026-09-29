import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

type UserItem = {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  role: string;
  activo: number;
};

type Permisos = {
  asistencia: boolean;
  contratos: boolean;
  nomina: boolean;
  vacaciones: boolean;
};

const DEFAULT_PERMISOS: Permisos = {
  asistencia: false,
  contratos: false,
  nomina: false,
  vacaciones: false,
};

function getColors(isDark: boolean) {
  return {
    background: isDark ? '#07111F' : '#F4F7FB',
    card: isDark ? '#0F1B2D' : '#FFFFFF',
    cardSoft: isDark ? '#111F33' : '#F9FBFD',
    primary: isDark ? '#38BDF8' : '#0A57A4',
    primarySoft: isDark ? 'rgba(56,189,248,0.14)' : 'rgba(10,87,164,0.10)',
    teal: isDark ? '#2DD4BF' : '#22B8B0',
    tealSoft: isDark ? '#14B8A6' : '#67D5CC',
    tealBg: isDark ? 'rgba(45,212,191,0.14)' : 'rgba(34,184,176,0.12)',
    text: isDark ? '#F8FAFC' : '#0F172A',
    textMuted: isDark ? '#9FB0C4' : '#5B6B81',
    border: isDark ? '#26364D' : '#D9E1EC',
    danger: isDark ? '#FCA5A5' : '#D64545',
    dangerBg: isDark ? 'rgba(248,113,113,0.12)' : 'rgba(214,69,69,0.12)',
  };
}

export default function AdminUsuariosScreen() {
  const { token, user, theme } = useAuth();

  const isDark = theme === 'dark';
  const COLORS = getColors(isDark);
  const styles = getStyles(isDark);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [permisosMap, setPermisosMap] = useState<Record<number, Permisos>>({});
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingPermisosId, setLoadingPermisosId] = useState<number | null>(null);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');

  const isAdmin = user?.role === 'admin';

  const authConfig = useMemo(
    () => ({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
    [token]
  );

  const activeUsers = useMemo(
    () => users.filter((u) => u.activo).length,
    [users]
  );

  const adminUsers = useMemo(
    () => users.filter((u) => u.role === 'admin').length,
    [users]
  );

  const loadUsers = async (isRefresh = false) => {
    if (!token) return;

    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError('');

      const { data } = await api.get('/users', authConfig);
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'No se pudieron cargar los usuarios.');
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !isAdmin) return;
    loadUsers();
  }, [token, isAdmin]);

  const loadPermisos = async (userId: number) => {
    if (!token) return;

    try {
      setLoadingPermisosId(userId);
      setError('');

      const { data } = await api.get(`/permisos/${userId}`, authConfig);
      const permisos = data?.permisos ?? {};

      setPermisosMap((prev) => ({
        ...prev,
        [userId]: {
          asistencia: Boolean(permisos.asistencia),
          contratos: Boolean(permisos.contratos),
          nomina: Boolean(permisos.nomina),
          vacaciones: Boolean(permisos.vacaciones),
        },
      }));
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'No se pudieron cargar los permisos.');
    } finally {
      setLoadingPermisosId(null);
    }
  };

  const toggleExpand = async (userId: number) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }

    setExpandedUserId(userId);

    if (!permisosMap[userId]) {
      await loadPermisos(userId);
    }
  };

  const onToggle = async (userId: number, modulo: keyof Permisos) => {
    if (!token) return;

    const current = permisosMap[userId] ?? DEFAULT_PERMISOS;
    const next = {
      ...current,
      [modulo]: !current[modulo],
    };

    setPermisosMap((prev) => ({
      ...prev,
      [userId]: next,
    }));

    try {
      setSavingKey(`${userId}-${modulo}`);
      setError('');

      await api.put(`/permisos/${userId}`, next, authConfig);
    } catch (e: any) {
      setPermisosMap((prev) => ({
        ...prev,
        [userId]: current,
      }));

      Alert.alert(
        'Error',
        e?.response?.data?.message ?? 'No se pudieron actualizar los permisos.'
      );
    } finally {
      setSavingKey('');
    }
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.blockedWrap}>
          <View style={styles.blockedCard}>
            <Text style={styles.blockedTitle}>Acceso restringido</Text>
            <Text style={styles.blockedText}>
              No tienes permisos para administrar accesos.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadUsers(true)}
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
              <Text style={styles.heroBadgeText}>Admin</Text>
            </View>
          </View>

          <Text style={styles.eyebrow}>Administración móvil</Text>
          <Text style={styles.title}>Usuarios y permisos</Text>
          <Text style={styles.subtitle}>
            Gestiona qué módulos puede visualizar cada usuario dentro de la
            aplicación móvil, con control rápido y validación inmediata.
          </Text>

          <View style={styles.heroStatsGrid}>
            <HeroStatCard value={String(users.length)} label="Usuarios" styles={styles} />
            <HeroStatCard value={String(activeUsers)} label="Activos" styles={styles} />
            <HeroStatCard value={String(adminUsers)} label="Admins" styles={styles} />
            <HeroStatCard value="4" label="Módulos" styles={styles} />
          </View>
        </View>

        {loading && (
          <View style={styles.centerCard}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.centerText}>Cargando usuarios...</Text>
          </View>
        )}

        {!!error && !loading && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading &&
          users.map((u) => {
            const permisos = permisosMap[u.id] ?? DEFAULT_PERMISOS;
            const isExpanded = expandedUserId === u.id;

            return (
              <View key={u.id} style={styles.userCard}>
                <Pressable
                  style={({ pressed }) => [
                    styles.userHeader,
                    pressed && styles.userHeaderPressed,
                  ]}
                  onPress={() => toggleExpand(u.id)}
                >
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>
                      {`${u.nombre?.[0] ?? ''}${u.apellido?.[0] ?? ''}`.toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>
                      {u.nombre} {u.apellido}
                    </Text>
                    <Text style={styles.userEmail}>{u.correo}</Text>

                    <View style={styles.metaRow}>
                      <View
                        style={[
                          styles.pill,
                          u.role === 'admin' ? styles.adminPill : styles.employeePill,
                        ]}
                      >
                        <Text
                          style={[
                            styles.pillText,
                            u.role === 'admin' ? styles.adminPillText : styles.employeePillText,
                          ]}
                        >
                          {u.role}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.pill,
                          u.activo ? styles.activePill : styles.inactivePill,
                        ]}
                      >
                        <Text
                          style={[
                            styles.pillText,
                            u.activo ? styles.activePillText : styles.inactivePillText,
                          ]}
                        >
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.expandBadge}>
                    <Text style={styles.expandBadgeText}>{isExpanded ? '−' : '+'}</Text>
                  </View>
                </Pressable>

                {isExpanded && (
                  <View style={styles.permissionsBox}>
                    <View style={styles.permissionsHeader}>
                      <Text style={styles.permissionsTitle}>Accesos habilitados</Text>
                      <Text style={styles.permissionsSubtitle}>
                        Activa o desactiva los módulos disponibles para este usuario.
                      </Text>
                    </View>

                    {loadingPermisosId === u.id ? (
                      <View style={styles.permissionsLoading}>
                        <ActivityIndicator color={COLORS.primary} />
                        <Text style={styles.centerText}>Cargando permisos...</Text>
                      </View>
                    ) : (
                      <>
                        <PermissionRow
                          label="Asistencia"
                          hint="Control y consulta de asistencia"
                          value={permisos.asistencia}
                          disabled={savingKey === `${u.id}-asistencia`}
                          onValueChange={() => onToggle(u.id, 'asistencia')}
                          styles={styles}
                          colors={COLORS}
                        />

                        <PermissionRow
                          label="Contratos"
                          hint="Información contractual del usuario"
                          value={permisos.contratos}
                          disabled={savingKey === `${u.id}-contratos`}
                          onValueChange={() => onToggle(u.id, 'contratos')}
                          styles={styles}
                          colors={COLORS}
                        />

                        <PermissionRow
                          label="Nómina"
                          hint="Recibos, pagos y periodos"
                          value={permisos.nomina}
                          disabled={savingKey === `${u.id}-nomina`}
                          onValueChange={() => onToggle(u.id, 'nomina')}
                          styles={styles}
                          colors={COLORS}
                        />

                        <PermissionRow
                          label="Vacaciones"
                          hint="Días disponibles y solicitudes"
                          value={permisos.vacaciones}
                          disabled={savingKey === `${u.id}-vacaciones`}
                          onValueChange={() => onToggle(u.id, 'vacaciones')}
                          styles={styles}
                          colors={COLORS}
                        />
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })}
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroStatCard({
  value,
  label,
  styles,
}: {
  value: string;
  label: string;
  styles: any;
}) {
  return (
    <View style={styles.heroStatCard}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function PermissionRow({
  label,
  hint,
  value,
  disabled,
  onValueChange,
  styles,
  colors,
}: {
  label: string;
  hint: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: () => void;
  styles: any;
  colors: ReturnType<typeof getColors>;
}) {
  return (
    <View style={styles.permissionRow}>
      <View style={styles.permissionTextBox}>
        <Text style={styles.permissionLabel}>{label}</Text>
        <Text style={styles.permissionHint}>{hint}</Text>
      </View>

      <View style={styles.permissionSwitchBox}>
        <Text
          style={[
            styles.permissionState,
            value ? styles.permissionStateOn : styles.permissionStateOff,
          ]}
        >
          {value ? 'ON' : 'OFF'}
        </Text>

        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: colors.border, true: colors.teal }}
          thumbColor="#FFFFFF"
        />
      </View>
    </View>
  );
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
    paddingBottom: 36,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
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
    top: 36,
    left: -20,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.teal,
    opacity: isDark ? 0.18 : 0.12,
  },
  shapeBottomRightLarge: {
    position: 'absolute',
    bottom: -90,
    right: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: COLORS.primary,
    opacity: isDark ? 0.14 : 0.07,
  },
  shapeBottomRightSmall: {
    position: 'absolute',
    bottom: 40,
    right: -12,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.tealSoft,
    opacity: isDark ? 0.2 : 0.18,
  },

  heroCard: {
    backgroundColor: COLORS.card,
    borderRadius: 30,
    padding: 24,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.09,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 2,
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
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  eyebrow: {
    marginTop: 18,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.primary,
  },
  subtitle: {
    marginTop: 10,
    color: COLORS.textMuted,
    fontSize: 15,
    lineHeight: 23,
  },

  heroStatsGrid: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  heroStatCard: {
    width: '48%',
    backgroundColor: COLORS.cardSoft,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroStatValue: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primary,
  },
  heroStatLabel: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '700',
  },

  centerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 14,
  },
  centerText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },

  blockedWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  blockedCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primary,
  },
  blockedText: {
    marginTop: 8,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },

  errorCard: {
    backgroundColor: COLORS.dangerBg,
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.danger,
    fontWeight: '700',
  },

  userCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
    zIndex: 2,
  },
  userHeader: {
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  userHeaderPressed: {
    opacity: 0.9,
  },
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.primary,
    fontWeight: '900',
    fontSize: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  userEmail: {
    marginTop: 4,
    color: COLORS.textMuted,
    fontSize: 13,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  adminPill: {
    backgroundColor: COLORS.primarySoft,
  },
  adminPillText: {
    color: COLORS.primary,
  },
  employeePill: {
    backgroundColor: COLORS.tealBg,
  },
  employeePillText: {
    color: COLORS.teal,
  },
  activePill: {
    backgroundColor: COLORS.tealBg,
  },
  activePillText: {
    color: COLORS.teal,
  },
  inactivePill: {
    backgroundColor: COLORS.dangerBg,
  },
  inactivePillText: {
    color: COLORS.danger,
  },

  expandBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandBadgeText: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: '900',
    marginTop: -1,
  },

  permissionsBox: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: COLORS.cardSoft,
  },
  permissionsHeader: {
    marginBottom: 8,
  },
  permissionsTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
  },
  permissionsSubtitle: {
    marginTop: 4,
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  permissionsLoading: {
    paddingVertical: 18,
    alignItems: 'center',
    gap: 8,
  },

  permissionRow: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  permissionTextBox: {
    flex: 1,
  },
  permissionLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  permissionHint: {
    marginTop: 3,
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  permissionSwitchBox: {
    alignItems: 'flex-end',
    gap: 6,
  },
  permissionState: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  permissionStateOn: {
    color: COLORS.teal,
  },
  permissionStateOff: {
    color: COLORS.danger,
  },
  });
}
