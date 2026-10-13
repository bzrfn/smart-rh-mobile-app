import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { usePrivateMediaUri } from '../hooks/usePrivateMediaUri';
import { getSmartRhColors, getSmartRhShadow } from '../design/smartRhTheme';
import SmartRhSessionDock from './SmartRhSessionDock';

type Props = {
  isDark: boolean;
  onNavigate: (route: string) => void;
};

type MenuAction = {
  label: string;
  detail: string;
  code: string;
  route?: string;
  tone: 'primary' | 'teal' | 'gold' | 'danger';
  group: 'access' | 'account' | 'system';
  onPress?: () => void;
};

type WearableDevice = {
  id: number;
  device_id: string;
  usuario_id: number;
  nombre_dispositivo: string;
  modelo?: string | null;
  plataforma?: string | null;
  estado: 'ACTIVO' | 'INACTIVO' | 'SINCRONIZANDO';
  bateria?: number | null;
  ultima_conexion?: string | null;
};

type PairingCodeResponse = {
  codigo: string;
  expiresInMinutes: number;
  fecha_expiracion?: string;
};

function isAdminRole(role?: string | null) {
  return String(role || '').trim().toLowerCase() === 'admin';
}

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

function formatDateTime(value?: string | null) {
  if (!value) return 'Sin registro';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Sin registro';

  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SmartRhSessionLayer({ isDark, onNavigate }: Props) {
  const { user, token, logout, toggleTheme } = useAuth();
  const styles = getStyles(isDark);
  const colors = getSmartRhColors(isDark);
  const isAdmin = isAdminRole(user?.role);
  const [menuVisible, setMenuVisible] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [wearableDevice, setWearableDevice] = useState<WearableDevice | null>(null);
  const [pairingCode, setPairingCode] = useState<PairingCodeResponse | null>(null);
  const [pairingCodeExpiresAt, setPairingCodeExpiresAt] = useState<number | null>(null);
  const [loadingWearable, setLoadingWearable] = useState(false);
  const { localUri: avatarUri } = usePrivateMediaUri(user?.foto_perfil_url, token);
  const hasCredential = Boolean(user?.credencial_url);

  const actions = useMemo<MenuAction[]>(() => {
    const base: MenuAction[] = [
      {
        label: isAdmin ? 'Panel admin' : 'Inicio',
        detail: isAdmin ? 'Volver al centro administrativo.' : 'Volver al resumen laboral.',
        code: 'IN',
        route: isAdmin ? 'AdminDashboard' : 'Home',
        tone: 'primary',
        group: 'access',
      },
      {
        label: isAdmin ? 'Perfil admin' : 'Perfil laboral',
        detail: 'Datos de la cuenta y expediente.',
        code: 'PF',
        route: isAdmin ? 'AdminPerfil' : 'Perfil',
        tone: 'teal',
        group: 'account',
      },
      {
        label: 'Notificaciones',
        detail: 'Avisos, recordatorios y seguimiento.',
        code: 'NT',
        route: 'Notificaciones',
        tone: 'primary',
        group: 'account',
      },
      {
        label: isDark ? 'Modo claro' : 'Modo oscuro',
        detail: 'Cambiar apariencia de SMART RH.',
        code: isDark ? 'CL' : 'OS',
        tone: 'gold',
        group: 'system',
        onPress: toggleTheme,
      },
      {
        label: 'Cerrar sesión',
        detail: 'Salir de esta cuenta.',
        code: 'OUT',
        tone: 'danger',
        group: 'system',
        onPress: confirmLogout,
      },
    ];

    if (!isAdmin) {
      base.splice(2, 0, {
        label: 'Documentos',
        detail: 'Contrato, credencial y archivos laborales.',
        code: 'DC',
        route: 'Documentos',
        tone: 'primary',
        group: 'access',
      });

      base.splice(4, 0, {
        label: 'Soporte',
        detail: 'Tickets y ayuda con contexto.',
        code: 'SP',
        route: 'Soporte',
        tone: 'teal',
        group: 'account',
      });
    }

    if (isAdmin) {
      base.splice(2, 0, {
        label: 'Usuarios',
        detail: 'Administrar accesos y permisos.',
        code: 'US',
        route: 'AdminUsuarios',
        tone: 'primary',
        group: 'access',
      });

      base.splice(3, 0, {
        label: 'Pendientes',
        detail: 'Asistencia e incapacidades por revisar.',
        code: 'RV',
        route: 'AdminAsistenciaPendientes',
        tone: 'gold',
        group: 'access',
      });
    }

    return base;
  }, [isAdmin, isDark, toggleTheme]);

  const actionGroups = useMemo(
    () => [
      {
        key: 'access',
        title: isAdmin ? 'Operación admin' : 'Accesos laborales',
        detail: isAdmin ? 'Herramientas de revisión.' : 'Tu trabajo del día.',
        items: actions.filter((item) => item.group === 'access'),
      },
      {
        key: 'account',
        title: 'Cuenta',
        detail: 'Expediente, avisos y soporte.',
        items: actions.filter((item) => item.group === 'account'),
      },
      {
        key: 'system',
        title: 'Preferencias',
        detail: 'Apariencia y cierre de sesión.',
        items: actions.filter((item) => item.group === 'system'),
      },
    ].filter((group) => group.items.length > 0),
    [actions, isAdmin]
  );

  function go(route?: string) {
    if (!route) return;

    setMenuVisible(false);

    setTimeout(() => {
      onNavigate(route);
    }, 140);
  }

  function handleAction(action: MenuAction) {
    if (action.route) {
      go(action.route);
      return;
    }

    if (action.onPress) {
      setMenuVisible(false);
      setTimeout(action.onPress, 140);
    }
  }

  function clearPairingCode() {
    setPairingCode(null);
    setPairingCodeExpiresAt(null);
  }

  async function loadWearableDevice() {
    if (!token) return;

    try {
      setLoadingWearable(true);

      const { data } = await api.get('/wearables/mis-dispositivos');
      const list = Array.isArray(data?.dispositivos) ? data.dispositivos : [];
      const activeDevice =
        list.find((item: WearableDevice) => item.estado === 'ACTIVO') || null;

      setWearableDevice(activeDevice);

      if (activeDevice) {
        clearPairingCode();
      }
    } catch {
      setWearableDevice(null);
    } finally {
      setLoadingWearable(false);
    }
  }

  async function generatePairingCode() {
    if (wearableDevice) {
      Alert.alert(
        'Ya está enlazado',
        'Para enlazar otro dispositivo, primero quita el enlace actual.'
      );
      return;
    }

    try {
      setLoadingWearable(true);

      const { data } = await api.post('/wearables/pairing-code');

      if (!data?.ok || !data?.codigo) {
        Alert.alert('No se pudo enlazar', data?.message || 'Intenta nuevamente.');
        return;
      }

      const expiresInMinutes = Number(data.expiresInMinutes || 5);

      setPairingCode({
        codigo: data.codigo,
        expiresInMinutes,
        fecha_expiracion: data.fecha_expiracion,
      });
      setPairingCodeExpiresAt(Date.now() + expiresInMinutes * 60 * 1000);
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'No se pudo generar el código de enlace.'
      );
    } finally {
      setLoadingWearable(false);
    }
  }

  function confirmUnpairWearable() {
    if (!wearableDevice?.device_id) {
      Alert.alert('Sin enlace', 'No tienes un dispositivo enlazado.');
      return;
    }

    Alert.alert(
      'Quitar enlace',
      `¿Deseas quitar el enlace de ${
        wearableDevice.nombre_dispositivo || wearableDevice.device_id
      }?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar enlace',
          style: 'destructive',
          onPress: unpairWearable,
        },
      ]
    );
  }

  async function unpairWearable() {
    if (!wearableDevice?.device_id) return;

    try {
      setLoadingWearable(true);

      await api.patch(`/wearables/device/${wearableDevice.device_id}/unpair`);

      setWearableDevice(null);
      clearPairingCode();
      Alert.alert('Listo', 'El enlace fue eliminado correctamente.');
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'No se pudo quitar el enlace.'
      );
    } finally {
      setLoadingWearable(false);
    }
  }

  function confirmLogout() {
    Alert.alert('Cerrar sesión', '¿Deseas salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  }

  useEffect(() => {
    loadWearableDevice();
  }, [token]);

  useEffect(() => {
    if (menuVisible) {
      loadWearableDevice();
    }
  }, [menuVisible]);

  useEffect(() => {
    if (!pairingCode || !pairingCodeExpiresAt) return;

    const remainingTime = pairingCodeExpiresAt - Date.now();

    if (remainingTime <= 0) {
      clearPairingCode();
      return;
    }

    const timeout = setTimeout(() => {
      clearPairingCode();
    }, remainingTime);

    return () => clearTimeout(timeout);
  }, [pairingCode, pairingCodeExpiresAt]);

  return (
    <>
      <SmartRhSessionDock
        isDark={isDark}
        avatarUri={avatarUri && !photoFailed ? avatarUri : null}
        fallbackInitial={user?.nombre?.[0] || 'S'}
        onHomePress={() => onNavigate(isAdmin ? 'AdminDashboard' : 'Home')}
        onProfilePress={() => setMenuVisible(true)}
        onLogoutPress={confirmLogout}
      />

      <Modal
        visible={menuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar menú de cuenta"
            style={styles.backdrop}
            onPress={() => setMenuVisible(false)}
          />

          <SafeAreaView style={styles.panel}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.content}
            >
              <View style={styles.handle} />

              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.eyebrow}>Sesión SMART RH</Text>
                  <Text style={styles.title}>{isAdmin ? 'Menú admin' : 'Menú laboral'}</Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar"
                  style={styles.closeButton}
                  onPress={() => setMenuVisible(false)}
                >
                  <Text style={styles.closeText}>×</Text>
                </Pressable>
              </View>

              <View style={styles.profileCard}>
                <View style={styles.avatar}>
                  {avatarUri && !photoFailed ? (
                    <Image
                      source={{ uri: avatarUri }}
                      style={styles.avatarImage}
                      onError={() => setPhotoFailed(true)}
                    />
                  ) : (
                    <Text style={styles.avatarText}>{user?.nombre?.[0] || 'S'}</Text>
                  )}
                </View>

                <View style={styles.profileCopy}>
                  <Text style={styles.profileName} numberOfLines={2}>
                    {user?.nombre} {user?.apellido}
                  </Text>
                  <Text style={styles.profileEmail} numberOfLines={1}>
                    {user?.correo}
                  </Text>

                  <View style={styles.rolePill}>
                    <Text style={styles.roleText}>{user?.role || 'Usuario'}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.metaGrid}>
                <View style={styles.metaCard}>
                  <Text style={styles.metaLabel}>Ingreso</Text>
                  <Text style={styles.metaValue}>{formatDate(user?.fecha_ingreso)}</Text>
                </View>

                <View style={styles.metaCard}>
                  <Text style={styles.metaLabel}>Credencial</Text>
                  <Text style={styles.metaValue}>
                    {hasCredential ? 'Lista' : 'Pendiente'}
                  </Text>
                </View>
              </View>

              <View style={styles.deviceCard}>
                <View style={styles.deviceHeader}>
                  <View style={styles.deviceGlyph}>
                    <View style={styles.deviceGlyphFace} />
                    <View style={styles.deviceGlyphBandTop} />
                    <View style={styles.deviceGlyphBandBottom} />
                  </View>

                  <View style={styles.deviceCopy}>
                    <Text style={styles.deviceEyebrow}>Dispositivo</Text>
                    <Text style={styles.deviceTitle}>
                      {wearableDevice ? 'Enlace activo' : 'Enlazar'}
                    </Text>
                    <Text style={styles.deviceDetail} numberOfLines={1}>
                      {wearableDevice
                        ? `Última conexión: ${formatDateTime(
                            wearableDevice.ultima_conexion
                          )}`
                        : 'Genera un código para vincular tu reloj compatible.'}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.deviceStatus,
                      wearableDevice ? styles.deviceStatusLinked : styles.deviceStatusIdle,
                    ]}
                  >
                    <Text
                      style={[
                        styles.deviceStatusText,
                        wearableDevice
                          ? styles.deviceStatusTextLinked
                          : styles.deviceStatusTextIdle,
                      ]}
                    >
                      {wearableDevice ? 'Activo' : 'Libre'}
                    </Text>
                  </View>
                </View>

                {pairingCode && !wearableDevice ? (
                  <View style={styles.deviceCodeBox}>
                    <Text style={styles.deviceCodeLabel}>Código de enlace</Text>
                    <Text style={styles.deviceCodeValue}>{pairingCode.codigo}</Text>
                    <Text style={styles.deviceCodeHelp}>
                      Vence en {pairingCode.expiresInMinutes} minutos.
                    </Text>
                  </View>
                ) : null}

                <View style={styles.deviceActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.devicePrimaryButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={wearableDevice ? loadWearableDevice : generatePairingCode}
                    disabled={loadingWearable}
                  >
                    <Text style={styles.devicePrimaryText}>
                      {loadingWearable
                        ? 'Procesando…'
                        : wearableDevice
                          ? 'Actualizar'
                          : 'Enlazar'}
                    </Text>
                  </Pressable>

                  {wearableDevice ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.deviceGhostButton,
                        pressed && styles.pressed,
                      ]}
                      onPress={confirmUnpairWearable}
                      disabled={loadingWearable}
                    >
                      <Text style={styles.deviceGhostText}>Quitar</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <View style={styles.groupStack}>
                {actionGroups.map((group) => (
                  <View key={group.key} style={styles.actionGroup}>
                    <View style={styles.actionGroupHeader}>
                      <View>
                        <Text style={styles.actionGroupTitle}>{group.title}</Text>
                        <Text style={styles.actionGroupDetail}>{group.detail}</Text>
                      </View>
                    </View>

                    <View style={styles.actionList}>
                      {group.items.map((action) => (
                        <Pressable
                          key={action.label}
                          style={({ pressed }) => [
                            styles.actionRow,
                            action.tone === 'danger' && styles.actionDanger,
                            pressed && styles.pressed,
                          ]}
                          onPress={() => handleAction(action)}
                        >
                          <View
                            style={[
                              styles.actionCode,
                              action.tone === 'teal' && styles.actionCodeTeal,
                              action.tone === 'gold' && styles.actionCodeGold,
                              action.tone === 'danger' && styles.actionCodeDanger,
                            ]}
                          >
                            <Text
                              style={[
                                styles.actionCodeText,
                                action.tone === 'teal' && styles.actionTextTeal,
                                action.tone === 'gold' && styles.actionTextGold,
                                action.tone === 'danger' && styles.actionTextDanger,
                              ]}
                            >
                              {action.code}
                            </Text>
                          </View>

                          <View style={styles.actionCopy}>
                            <Text
                              style={[
                                styles.actionTitle,
                                action.tone === 'danger' && styles.actionTitleDanger,
                              ]}
                              numberOfLines={1}
                            >
                              {action.label}
                            </Text>
                            <Text style={styles.actionDetail} numberOfLines={2}>
                              {action.detail}
                            </Text>
                          </View>

                          <Text
                            style={[
                              styles.actionArrow,
                              action.tone === 'danger' && styles.actionTitleDanger,
                            ]}
                          >
                            ›
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

function getStyles(isDark: boolean) {
  const colors = getSmartRhColors(isDark);
  const shadow = getSmartRhShadow(isDark);

  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(15,23,42,0.32)',
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    panel: {
      maxHeight: '86%',
      backgroundColor: colors.background,
      borderTopLeftRadius: 34,
      borderTopRightRadius: 34,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      ...shadow,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 116,
      gap: 14,
    },
    handle: {
      alignSelf: 'center',
      width: 46,
      height: 5,
      borderRadius: 999,
      backgroundColor: colors.borderStrong,
      marginBottom: 4,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    eyebrow: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    title: {
      marginTop: 3,
      color: colors.text,
      fontSize: 24,
      fontWeight: '900',
    },
    closeButton: {
      width: 42,
      height: 42,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    closeText: {
      color: colors.text,
      fontSize: 28,
      lineHeight: 30,
      fontWeight: '700',
    },
    profileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 14,
      borderRadius: 26,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow,
    },
    avatar: {
      width: 70,
      height: 70,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: colors.primarySoft,
      borderWidth: 2,
      borderColor: colors.primaryBorder,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    avatarText: {
      color: colors.primary,
      fontSize: 26,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    profileCopy: {
      flex: 1,
      minWidth: 0,
    },
    profileName: {
      color: colors.text,
      fontSize: 18,
      lineHeight: 22,
      fontWeight: '900',
    },
    profileEmail: {
      marginTop: 4,
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    rolePill: {
      alignSelf: 'flex-start',
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    roleText: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    metaGrid: {
      flexDirection: 'row',
      gap: 10,
    },
    metaCard: {
      flex: 1,
      padding: 13,
      borderRadius: 20,
      backgroundColor: colors.cardMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    metaLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    metaValue: {
      marginTop: 4,
      color: colors.text,
      fontSize: 13,
      fontWeight: '900',
    },
    deviceCard: {
      position: 'relative',
      overflow: 'hidden',
      padding: 11,
      borderRadius: 22,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    deviceHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    deviceGlyph: {
      width: 40,
      height: 46,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.successSoft,
      borderWidth: 1,
      borderColor: colors.success,
    },
    deviceGlyphFace: {
      width: 21,
      height: 25,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.success,
      backgroundColor: isDark ? 'rgba(45,212,191,0.08)' : 'rgba(34,184,176,0.08)',
    },
    deviceGlyphBandTop: {
      position: 'absolute',
      top: 4,
      width: 13,
      height: 5,
      borderRadius: 999,
      backgroundColor: colors.success,
      opacity: 0.36,
    },
    deviceGlyphBandBottom: {
      position: 'absolute',
      bottom: 4,
      width: 13,
      height: 5,
      borderRadius: 999,
      backgroundColor: colors.success,
      opacity: 0.36,
    },
    deviceCopy: {
      flex: 1,
      minWidth: 0,
    },
    deviceEyebrow: {
      color: colors.success,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.9,
      textTransform: 'uppercase',
    },
    deviceTitle: {
      marginTop: 3,
      color: colors.text,
      fontSize: 15,
      lineHeight: 19,
      fontWeight: '900',
    },
    deviceDetail: {
      marginTop: 4,
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '700',
    },
    deviceStatus: {
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
    },
    deviceStatusLinked: {
      backgroundColor: colors.successSoft,
      borderColor: colors.success,
    },
    deviceStatusIdle: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warning,
    },
    deviceStatusText: {
      fontSize: 9,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    deviceStatusTextLinked: {
      color: colors.success,
    },
    deviceStatusTextIdle: {
      color: colors.warning,
    },
    deviceCodeBox: {
      marginTop: 12,
      padding: 11,
      borderRadius: 18,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      alignItems: 'center',
    },
    deviceCodeLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    deviceCodeValue: {
      marginTop: 2,
      color: colors.primary,
      fontSize: 32,
      lineHeight: 37,
      fontWeight: '900',
      letterSpacing: 6,
    },
    deviceCodeHelp: {
      marginTop: 2,
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
    },
    deviceActions: {
      marginTop: 12,
      flexDirection: 'row',
      gap: 8,
    },
    devicePrimaryButton: {
      flex: 1,
      minHeight: 40,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.success,
    },
    devicePrimaryText: {
      color: isDark ? '#041416' : '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
    },
    deviceGhostButton: {
      minWidth: 76,
      minHeight: 40,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    deviceGhostText: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: '900',
    },
    groupStack: {
      gap: 13,
    },
    actionGroup: {
      padding: 12,
      borderRadius: 24,
      backgroundColor: colors.cardMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionGroupHeader: {
      marginBottom: 10,
      paddingHorizontal: 2,
    },
    actionGroupTitle: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 19,
      fontWeight: '900',
    },
    actionGroupDetail: {
      marginTop: 2,
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '700',
    },
    actionList: {
      gap: 10,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 13,
      borderRadius: 22,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionDanger: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
    },
    actionCode: {
      width: 44,
      height: 44,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
    actionCodeTeal: {
      backgroundColor: colors.successSoft,
    },
    actionCodeGold: {
      backgroundColor: colors.warningSoft,
    },
    actionCodeDanger: {
      backgroundColor: colors.dangerSoft,
    },
    actionCodeText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '900',
    },
    actionTextTeal: {
      color: colors.success,
    },
    actionTextGold: {
      color: colors.warning,
    },
    actionTextDanger: {
      color: colors.danger,
    },
    actionCopy: {
      flex: 1,
      minWidth: 0,
    },
    actionTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '900',
    },
    actionTitleDanger: {
      color: colors.danger,
    },
    actionDetail: {
      marginTop: 3,
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '700',
    },
    actionArrow: {
      color: colors.textMuted,
      fontSize: 24,
      fontWeight: '900',
    },
    pressed: {
      transform: [{ scale: 0.985 }],
      opacity: 0.88,
    },
  });
}
