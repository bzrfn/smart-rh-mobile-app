import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import {
  deletePrivateMedia,
  downloadPrivateMedia,
} from '../../services/privateMedia';
import {
  configureNotifications,
  showLocalNotificationOnce,
} from '../../services/notifications';

type Props = {
  navigation: any;
};

type Accent = 'blue' | 'teal' | 'danger' | 'muted' | 'gold';

type Notificacion = {
  _id: string;
  usuario_id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  metadata?: Record<string, any>;
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

type NotificationAction = {
  label: string;
  route: string;
  code: string;
};

type ModuleItem = {
  key: string;
  title: string;
  subtitle: string;
  route: string;
  accent: Accent;
  code: string;
  badge?: string;
  enabled: boolean;
  group: 'trabajo' | 'documentos' | 'cuenta' | 'admin';
  lockedReason?: string;
};

type SheetAction = {
  label: string;
  detail: string;
  route?: string;
  code: string;
  accent: Accent;
  onPress?: () => void;
};

const NOTIFICATION_REPEAT_MS = 5 * 60 * 1000;

function normalizeText(value?: string) {
  return String(value || '').trim().toUpperCase();
}

function getTodayLabel() {
  return new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
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

function getNotificationAction(item?: Notificacion | null): NotificationAction {
  const tipo = normalizeText(item?.tipo);
  const origen = normalizeText(item?.metadata?.origen);
  const modulo = normalizeText(item?.metadata?.modulo);
  const categoria = normalizeText(item?.metadata?.categoria);

  if (
    origen === 'SOPORTE' ||
    modulo === 'SOPORTE' ||
    tipo.includes('SOPORTE') ||
    tipo.includes('TICKET')
  ) {
    return {
      label: 'Ver seguimiento',
      route: 'Soporte',
      code: 'SP',
    };
  }

  if (tipo === 'RECORDATORIO_ENTRADA' || tipo === 'RECORDATORIO_SALIDA') {
    return {
      label: 'Registrar asistencia',
      route: 'QrScan',
      code: 'QR',
    };
  }

  if (
    tipo === 'DIA_COMPLETO' ||
    tipo.includes('ASISTENCIA') ||
    tipo.includes('ENTRADA') ||
    tipo.includes('SALIDA') ||
    categoria.includes('ASISTENCIA')
  ) {
    return {
      label: 'Ver asistencia',
      route: 'Asistencia',
      code: 'AS',
    };
  }

  if (tipo.includes('CONTRATO') || categoria.includes('CONTRATO')) {
    return {
      label: 'Ver documentos',
      route: 'Documentos',
      code: 'DC',
    };
  }

  if (tipo.includes('CREDENCIAL') || categoria.includes('CREDENCIAL')) {
    return {
      label: 'Ver credencial',
      route: 'Credencial',
      code: 'ID',
    };
  }

  if (tipo.includes('DOCUMENTO') || categoria.includes('DOCUMENTO')) {
    return {
      label: 'Ver documentos',
      route: 'Documentos',
      code: 'DC',
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
      code: 'VC',
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
      code: 'NM',
    };
  }

  if (tipo.includes('PERFIL')) {
    return {
      label: 'Ver perfil',
      route: 'Perfil',
      code: 'PF',
    };
  }

  if (tipo.includes('ACTIVIDAD')) {
    return {
      label: 'Ver actividad',
      route: 'Actividad',
      code: 'AC',
    };
  }

  return {
    label: 'Ver notificación',
    route: 'Notificaciones',
    code: 'NT',
  };
}

function getNotificationAccent(item?: Notificacion | null): Accent {
  const tipo = normalizeText(item?.tipo);

  if (tipo.includes('SOPORTE') || tipo.includes('TICKET')) return 'teal';
  if (tipo.includes('RESUELTO') || tipo.includes('CERRADO')) return 'teal';
  if (tipo.includes('RECORDATORIO') || tipo.includes('PENDIENTE')) return 'gold';

  return 'blue';
}

export default function HomeScreen({ navigation }: Props) {
  const { user, permisos, logout, theme, toggleTheme, token } = useAuth();

  const isDark = theme === 'dark';
  const styles = getStyles(isDark);

  const [notificacion, setNotificacion] = useState<Notificacion | null>(null);
  const [accountSheetVisible, setAccountSheetVisible] = useState(false);
  const [wearableDevice, setWearableDevice] = useState<WearableDevice | null>(null);
  const [pairingCode, setPairingCode] = useState<PairingCodeResponse | null>(null);
  const [pairingCodeExpiresAt, setPairingCodeExpiresAt] = useState<number | null>(null);
  const [loadingWearable, setLoadingWearable] = useState(false);
  const [photoLocalUri, setPhotoLocalUri] = useState('');
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);

  const loadingNotificationsRef = useRef(false);
  const lastNotificationShownRef = useRef<string | null>(null);
  const lastNotificationTimeRef = useRef<number>(0);
  const dismissedNotificationIdRef = useRef<string | null>(null);

  const hasProfilePhoto = Boolean(user?.foto_perfil_url);
  const hasCredential = Boolean(user?.credencial_url);
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';

  useEffect(() => {
    let cancelled = false;
    let localUri = '';

    setPhotoLocalUri('');
    setPhotoLoadFailed(false);

    async function loadProfilePhoto() {
      if (!user?.foto_perfil_url || !token) return;

      try {
        const downloadedUri = await downloadPrivateMedia(
          user.foto_perfil_url,
          token
        );

        if (cancelled) {
          await deletePrivateMedia(downloadedUri);
          return;
        }

        localUri = downloadedUri;
        setPhotoLocalUri(downloadedUri);
      } catch (error) {
        console.log(
          '[SMART RH] No se pudo cargar la foto en Home:',
          error instanceof Error ? error.message : 'Error desconocido'
        );

        if (!cancelled) {
          setPhotoLoadFailed(true);
        }
      }
    }

    loadProfilePhoto();

    return () => {
      cancelled = true;

      if (localUri) {
        deletePrivateMedia(localUri);
      }
    };
  }, [user?.foto_perfil_url, token]);

  const notificationAction = useMemo(
    () => getNotificationAction(notificacion),
    [notificacion]
  );

  const notificationAccent = useMemo(
    () => getNotificationAccent(notificacion),
    [notificacion]
  );

  const modules = useMemo<ModuleItem[]>(() => {
    return [
      {
        key: 'qr',
        title: 'Registrar asistencia',
        subtitle: 'Escanea el QR de entrada o salida.',
        route: 'QrScan',
        accent: 'teal',
        code: 'QR',
        badge: 'Rápido',
        enabled: Boolean(permisos.asistencia),
        group: 'trabajo',
        lockedReason: 'Asistencia no habilitada.',
      },
      {
        key: 'asistencia',
        title: 'Mi asistencia',
        subtitle: 'Historial, jornada y registros.',
        route: 'Asistencia',
        accent: 'blue',
        code: 'AS',
        enabled: Boolean(permisos.asistencia),
        group: 'trabajo',
        lockedReason: 'Asistencia no habilitada.',
      },
      {
        key: 'vacaciones',
        title: 'Vacaciones',
        subtitle: 'Solicitudes y días disponibles.',
        route: 'Vacaciones',
        accent: 'blue',
        code: 'VC',
        enabled: Boolean(permisos.vacaciones),
        group: 'trabajo',
        lockedReason: 'Vacaciones no habilitadas.',
      },
      {
        key: 'incapacidades',
        title: 'Incapacidades',
        subtitle: 'Solicitudes médicas y seguimiento.',
        route: 'Incapacidades',
        accent: 'teal',
        code: 'IN',
        badge: 'Nuevo',
        enabled: true,
        group: 'trabajo',
      },
      {
        key: 'nomina',
        title: 'Nómina',
        subtitle: 'Pagos, periodos y registros.',
        route: 'Nomina',
        accent: 'teal',
        code: 'NM',
        enabled: Boolean(permisos.nomina),
        group: 'trabajo',
        lockedReason: 'Nómina no habilitada.',
      },
      {
        key: 'documentos',
        title: 'Documentos',
        subtitle: 'Expediente, contrato y archivos.',
        route: 'Documentos',
        accent: 'blue',
        code: 'DC',
        badge: 'Digital',
        enabled: true,
        group: 'documentos',
      },
      {
        key: 'credencial',
        title: 'Credencial',
        subtitle: 'Identificación institucional.',
        route: 'Credencial',
        accent: 'teal',
        code: 'ID',
        badge: hasCredential ? 'Lista' : 'Pendiente',
        enabled: true,
        group: 'documentos',
      },
      {
        key: 'contratos',
        title: 'Contratos',
        subtitle: 'Información contractual.',
        route: 'Contratos',
        accent: 'blue',
        code: 'CT',
        enabled: Boolean(permisos.contratos),
        group: 'documentos',
        lockedReason: 'Contratos no habilitados.',
      },
      {
        key: 'perfil',
        title: 'Perfil',
        subtitle: 'Datos personales y expediente.',
        route: 'Perfil',
        accent: 'teal',
        code: 'PF',
        enabled: true,
        group: 'cuenta',
      },
      {
        key: 'notificaciones',
        title: 'Notificaciones',
        subtitle: 'Avisos y seguimiento.',
        route: 'Notificaciones',
        accent: notificacion ? 'gold' : 'blue',
        code: 'NT',
        badge: notificacion ? 'Pendiente' : 'Avisos',
        enabled: true,
        group: 'cuenta',
      },
      {
        key: 'actividad',
        title: 'Actividad',
        subtitle: 'Bitácora personal reciente.',
        route: 'Actividad',
        accent: 'blue',
        code: 'AC',
        enabled: true,
        group: 'cuenta',
      },
      {
        key: 'soporte',
        title: 'Soporte',
        subtitle: 'Tickets, respuestas y seguimiento.',
        route: 'Soporte',
        accent: 'teal',
        code: 'SP',
        badge: 'Ayuda',
        enabled: true,
        group: 'cuenta',
      },
      {
        key: 'admin',
        title: 'Administración',
        subtitle: 'Usuarios, accesos y permisos.',
        route: 'AdminUsuarios',
        accent: 'blue',
        code: 'AD',
        badge: 'Admin',
        enabled: isAdmin,
        group: 'admin',
        lockedReason: 'Solo para administradores.',
      },
    ];
  }, [permisos, hasCredential, notificacion, isAdmin]);

  const enabledModules = useMemo(
    () => modules.filter((item) => item.enabled),
    [modules]
  );

  const lockedModules = useMemo(
    () => modules.filter((item) => !item.enabled && item.key !== 'admin'),
    [modules]
  );

  const workModules = useMemo(
    () => enabledModules.filter((item) => item.group === 'trabajo'),
    [enabledModules]
  );

  const documentModules = useMemo(
    () => enabledModules.filter((item) => item.group === 'documentos'),
    [enabledModules]
  );

  const accountModules = useMemo(
    () => enabledModules.filter((item) => item.group === 'cuenta'),
    [enabledModules]
  );

  const adminModules = useMemo(
    () => enabledModules.filter((item) => item.group === 'admin'),
    [enabledModules]
  );

  const pendingItems = useMemo(() => {
    const items: { title: string; detail: string; accent: Accent }[] = [];

    if (notificacion) {
      items.push({
        title: notificacion.titulo,
        detail: notificacion.mensaje,
        accent: notificationAccent,
      });
    }

    if (!hasProfilePhoto) {
      items.push({
        title: 'Foto pendiente',
        detail: 'Actualiza tu foto para completar tu expediente.',
        accent: 'gold',
      });
    }

    if (!hasCredential) {
      items.push({
        title: 'Credencial pendiente',
        detail: 'Aún no se detecta credencial digital vinculada.',
        accent: 'gold',
      });
    }

    if (!permisos.asistencia) {
      items.push({
        title: 'Asistencia bloqueada',
        detail: 'El módulo de asistencia no está habilitado.',
        accent: 'muted',
      });
    }

    return items.slice(0, 3);
  }, [
    notificacion,
    hasProfilePhoto,
    hasCredential,
    permisos.asistencia,
    notificationAccent,
  ]);

  const mainActions = useMemo(() => {
    const actions: ModuleItem[] = [];

    if (permisos.asistencia) {
      actions.push({
        key: 'main-qr',
        title: 'Escanear QR',
        subtitle: 'Registrar entrada o salida',
        route: 'QrScan',
        accent: 'teal',
        code: 'QR',
        enabled: true,
        group: 'trabajo',
      });
    }

    actions.push({
      key: 'main-docs',
      title: 'Documentos',
      subtitle: 'Contrato y credencial',
      route: 'Documentos',
      accent: 'blue',
      code: 'DC',
      enabled: true,
      group: 'documentos',
    });

    return actions;
  }, [permisos.asistencia]);

  const sheetActions = useMemo<SheetAction[]>(() => {
    const actions: SheetAction[] = [
      {
        label: 'Ver perfil',
        detail: 'Datos personales y expediente',
        route: 'Perfil',
        code: 'PF',
        accent: 'teal',
      },
      {
        label: 'Documentos',
        detail: 'Contrato, credencial y archivos',
        route: 'Documentos',
        code: 'DC',
        accent: 'blue',
      },
      {
        label: 'Notificaciones',
        detail: 'Avisos y recordatorios',
        route: 'Notificaciones',
        code: 'NT',
        accent: notificacion ? 'gold' : 'blue',
      },
      {
        label: 'Soporte',
        detail: 'Tickets y seguimiento',
        route: 'Soporte',
        code: 'SP',
        accent: 'teal',
      },
      {
        label: isDark ? 'Cambiar a claro' : 'Cambiar a oscuro',
        detail: 'Personaliza la apariencia',
        code: isDark ? 'CL' : 'OS',
        accent: 'blue',
        onPress: toggleTheme,
      },
      {
        label: 'Cerrar sesión',
        detail: 'Salir de la cuenta actual',
        code: 'OUT',
        accent: 'danger',
        onPress: onLogout,
      },
    ];

    if (isAdmin) {
      actions.splice(4, 0, {
        label: 'Administración',
        detail: 'Usuarios y permisos',
        route: 'AdminUsuarios',
        code: 'AD',
        accent: 'blue',
      });
    }

    return actions;
  }, [isDark, isAdmin, notificacion, toggleTheme]);

  function limpiarCodigoWearable() {
    setPairingCode(null);
    setPairingCodeExpiresAt(null);
  }

  async function loadWearableDevice() {
    try {
      setLoadingWearable(true);

      const { data } = await api.get('/wearables/mis-dispositivos');
      const list = Array.isArray(data?.dispositivos) ? data.dispositivos : [];

      const activeDevice =
        list.find((item: WearableDevice) => item.estado === 'ACTIVO') || null;

      setWearableDevice(activeDevice);

      if (activeDevice) {
        limpiarCodigoWearable();
      }
    } catch {
      setWearableDevice(null);
    } finally {
      setLoadingWearable(false);
    }
  }

  async function generarCodigoWearable() {
    if (wearableDevice) {
      Alert.alert(
        'Reloj ya vinculado',
        'Ya tienes un reloj vinculado. Para vincular otro, primero desvincula el dispositivo actual.'
      );
      return;
    }

    try {
      setLoadingWearable(true);

      const { data } = await api.post('/wearables/pairing-code');

      if (!data?.ok || !data?.codigo) {
        Alert.alert('No se pudo generar', data?.message || 'Intenta nuevamente.');
        return;
      }

      const expiresInMinutes = Number(data.expiresInMinutes || 5);
      const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;

      setPairingCode({
        codigo: data.codigo,
        expiresInMinutes,
        fecha_expiracion: data.fecha_expiracion,
      });

      setPairingCodeExpiresAt(expiresAt);

      Alert.alert(
        'Código generado',
        `Escribe este código en tu reloj:\n\n${data.codigo}\n\nVence en ${expiresInMinutes} minutos.`
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'No se pudo generar el código del reloj.'
      );
    } finally {
      setLoadingWearable(false);
    }
  }

  function confirmarDesvincularWearable() {
    if (!wearableDevice?.device_id) {
      Alert.alert('Sin dispositivo', 'No tienes un reloj vinculado.');
      return;
    }

    Alert.alert(
      'Desvincular reloj',
      `¿Deseas desvincular ${
        wearableDevice.nombre_dispositivo || wearableDevice.device_id
      }?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: desvincularWearable,
        },
      ]
    );
  }

  async function desvincularWearable() {
    if (!wearableDevice?.device_id) return;

    try {
      setLoadingWearable(true);

      await api.patch(`/wearables/device/${wearableDevice.device_id}/unpair`);

      setWearableDevice(null);
      limpiarCodigoWearable();

      Alert.alert('Listo', 'El reloj fue desvinculado correctamente.');
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.response?.data?.message || 'No se pudo desvincular el reloj.'
      );
    } finally {
      setLoadingWearable(false);
    }
  }

  async function loadNotificaciones() {
    if (loadingNotificationsRef.current) return;

    try {
      loadingNotificationsRef.current = true;

      const { data } = await api.get('/notificaciones/mis-notificaciones');
      const list = Array.isArray(data?.notificaciones) ? data.notificaciones : [];
      const unread = list.find((item: Notificacion) => !item.leida) || null;

      if (unread?._id && unread._id === dismissedNotificationIdRef.current) {
        setNotificacion(null);
        return;
      }

      setNotificacion(unread);

      if (!unread) {
        lastNotificationShownRef.current = null;
        lastNotificationTimeRef.current = 0;
        return;
      }

      const notificationKey = `${unread.usuario_id}-${unread.tipo}-${unread._id}`;
      const now = Date.now();
      const sameNotification = lastNotificationShownRef.current === notificationKey;
      const insideCooldown =
        now - lastNotificationTimeRef.current < NOTIFICATION_REPEAT_MS;

      if (sameNotification && insideCooldown) return;

      const allowed = await configureNotifications();
      if (!allowed) return;

      await showLocalNotificationOnce({
        id: notificationKey,
        title: unread.titulo,
        body: unread.mensaje,
        data: {
          tipo: unread.tipo,
          notificacion_id: unread._id,
          route: getNotificationAction(unread).route,
        },
        cooldownMs: NOTIFICATION_REPEAT_MS,
      });

      lastNotificationShownRef.current = notificationKey;
      lastNotificationTimeRef.current = now;
    } catch {
      setNotificacion(null);
    } finally {
      loadingNotificationsRef.current = false;
    }
  }

  async function marcarLeida(id?: string) {
    if (!id) return;

    try {
      await api.patch(`/notificaciones/${id}/leida`);
    } catch {
      // No bloquea navegación ni experiencia visual.
    } finally {
      setNotificacion(null);
      lastNotificationShownRef.current = null;
      lastNotificationTimeRef.current = 0;
      dismissedNotificationIdRef.current = null;
    }
  }

  function cerrarBannerNotificacion(id?: string) {
    if (id) dismissedNotificationIdRef.current = id;
    setNotificacion(null);
  }

  async function abrirNotificacionActual() {
    const current = notificacion;
    if (!current) return;

    const action = getNotificationAction(current);

    setNotificacion(null);
    dismissedNotificationIdRef.current = null;

    if (current._id) {
      await marcarLeida(current._id);
    }

    navigation.navigate(action.route);
  }

  function goToModule(module: ModuleItem) {
    if (!module.enabled) return;
    navigation.navigate(module.route);
  }

  function navigateFromSheet(route?: string) {
    if (!route) return;

    setAccountSheetVisible(false);

    setTimeout(() => {
      navigation.navigate(route);
    }, 180);
  }

  function handleSheetAction(item: SheetAction) {
    if (item.route) {
      navigateFromSheet(item.route);
      return;
    }

    if (item.onPress) {
      if (item.label === 'Cerrar sesión') {
        setAccountSheetVisible(false);

        setTimeout(() => {
          item.onPress?.();
        }, 180);

        return;
      }

      item.onPress();
    }
  }

  function onLogout() {
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
    loadNotificaciones();
    loadWearableDevice();

    const focusUnsubscribe = navigation.addListener('focus', () => {
      loadNotificaciones();
      loadWearableDevice();
    });

    const interval = setInterval(() => {
      loadNotificaciones();
      loadWearableDevice();
    }, NOTIFICATION_REPEAT_MS);

    return () => {
      focusUnsubscribe();
      clearInterval(interval);
    };
  }, [navigation]);

  useEffect(() => {
    if (!pairingCode || !pairingCodeExpiresAt) return;

    const remainingTime = pairingCodeExpiresAt - Date.now();

    if (remainingTime <= 0) {
      limpiarCodigoWearable();
      return;
    }

    const timeout = setTimeout(() => {
      limpiarCodigoWearable();
    }, remainingTime);

    return () => clearTimeout(timeout);
  }, [pairingCode, pairingCodeExpiresAt]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.bgCircleOne} />
        <View style={styles.bgCircleTwo} />

        <View style={styles.topHeader}>
          <View>
            <Text style={styles.appName}>SMART RH</Text>
            <Text style={styles.dateText}>{getTodayLabel()}</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.accountButton,
              pressed && styles.pressed,
            ]}
            onPress={() => setAccountSheetVisible(true)}
          >
            <View style={styles.accountAvatar}>
              {photoLocalUri && !photoLoadFailed ? (
                <Image
                  source={{ uri: photoLocalUri }}
                  style={styles.accountAvatarImage}
                  onError={() => setPhotoLoadFailed(true)}
                />
              ) : (
                <Text style={styles.accountAvatarText}>
                  {user?.nombre?.[0] || 'S'}
                </Text>
              )}
            </View>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.userTitle}>{user?.nombre || 'Usuario'}</Text>
          <Text style={styles.heroSubtitle}>
            Tu centro de control para asistencia, documentos, soporte y actividad laboral.
          </Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaChip}>
              <Text style={styles.heroMetaLabel}>Rol</Text>
              <Text style={styles.heroMetaValue}>{user?.role || 'Usuario'}</Text>
            </View>

            <View style={styles.heroMetaChip}>
              <Text style={styles.heroMetaLabel}>Módulos</Text>
              <Text style={styles.heroMetaValue}>{enabledModules.length}</Text>
            </View>

            <View style={styles.heroMetaChip}>
              <Text style={styles.heroMetaLabel}>Credencial</Text>
              <Text style={styles.heroMetaValue}>
                {hasCredential ? 'Lista' : 'Pendiente'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.wearableCard}>
          <View style={styles.wearableHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Dispositivo inteligente</Text>
              <Text style={styles.wearableTitle}>Mi reloj SMART RH</Text>
            </View>

            <View
              style={[
                styles.wearableStatusBadge,
                wearableDevice ? styles.bgTeal : styles.bgGold,
              ]}
            >
              <Text
                style={[
                  styles.wearableStatusText,
                  wearableDevice ? styles.textTeal : styles.textGold,
                ]}
              >
                {wearableDevice ? 'Vinculado' : 'Sin vincular'}
              </Text>
            </View>
          </View>

          <Text style={styles.wearableDescription}>
            {wearableDevice
              ? 'Tu reloj puede registrar entrada, salida y sincronizar datos con SMART RH.'
              : 'Genera un código y escríbelo en tu reloj para vincularlo con tu cuenta.'}
          </Text>

          {wearableDevice ? (
            <View style={styles.wearableInfoGrid}>
              <InfoBox
                label="Dispositivo"
                value={wearableDevice.device_id}
                styles={styles}
              />

              <InfoBox
                label="Batería"
                value={`${wearableDevice.bateria ?? 0}%`}
                styles={styles}
              />

              <InfoBox
                label="Estado"
                value={wearableDevice.estado || 'ACTIVO'}
                styles={styles}
              />

              <InfoBox
                label="Conexión"
                value={formatDateTime(wearableDevice.ultima_conexion)}
                styles={styles}
              />
            </View>
          ) : null}

          {pairingCode && !wearableDevice ? (
            <View style={styles.pairingCodeBox}>
              <Text style={styles.pairingCodeLabel}>Código para reloj</Text>
              <Text style={styles.pairingCodeValue}>{pairingCode.codigo}</Text>
              <Text style={styles.pairingCodeHelp}>
                Escríbelo en SMART RH Wear. Vence en {pairingCode.expiresInMinutes}{' '}
                minutos.
              </Text>
            </View>
          ) : null}

          <View style={styles.wearableActions}>
            {!wearableDevice ? (
              <Pressable
                style={({ pressed }) => [
                  styles.wearablePrimaryButton,
                  pressed && styles.pressed,
                ]}
                onPress={generarCodigoWearable}
                disabled={loadingWearable}
              >
                <Text style={styles.wearablePrimaryButtonText}>
                  {loadingWearable ? 'Procesando...' : 'Generar código'}
                </Text>
              </Pressable>
            ) : null}

            {wearableDevice ? (
              <Pressable
                style={({ pressed }) => [
                  styles.wearableDangerButton,
                  pressed && styles.pressed,
                ]}
                onPress={confirmarDesvincularWearable}
                disabled={loadingWearable}
              >
                <Text style={styles.wearableDangerButtonText}>Desvincular</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.wearableGhostButton,
                pressed && styles.pressed,
              ]}
              onPress={loadWearableDevice}
              disabled={loadingWearable}
            >
              <Text style={styles.wearableGhostButtonText}>Actualizar</Text>
            </Pressable>
          </View>
        </View>

        {notificacion && (
          <Pressable
            style={({ pressed }) => [
              styles.alertCard,
              getAccentBorderStyle(notificationAccent, styles),
              pressed && styles.pressed,
            ]}
            onPress={abrirNotificacionActual}
          >
            <View style={styles.alertTop}>
              <View style={[styles.alertCode, getAccentBgStyle(notificationAccent, styles)]}>
                <Text
                  style={[
                    styles.alertCodeText,
                    getAccentTextStyle(notificationAccent, styles),
                  ]}
                >
                  {notificationAction.code}
                </Text>
              </View>

              <View style={styles.alertBody}>
                <View style={styles.alertTitleRow}>
                  <Text style={styles.alertTitle} numberOfLines={1}>
                    {notificacion.titulo}
                  </Text>

                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>Nuevo</Text>
                  </View>
                </View>

                <Text style={styles.alertText} numberOfLines={2}>
                  {notificacion.mensaje}
                </Text>
              </View>
            </View>

            <View style={styles.alertActions}>
              <Pressable style={styles.alertPrimaryButton} onPress={abrirNotificacionActual}>
                <Text style={styles.alertPrimaryButtonText}>
                  {notificationAction.label}
                </Text>
              </Pressable>

              <Pressable
                style={styles.alertGhostButton}
                onPress={(event) => {
                  event.stopPropagation();
                  navigation.navigate('Notificaciones');
                }}
              >
                <Text style={styles.alertGhostButtonText}>Ver todas</Text>
              </Pressable>

              <Pressable
                style={styles.alertGhostButton}
                onPress={(event) => {
                  event.stopPropagation();
                  cerrarBannerNotificacion(notificacion._id);
                }}
              >
                <Text style={styles.alertGhostButtonText}>Cerrar</Text>
              </Pressable>
            </View>
          </Pressable>
        )}

        <View style={styles.mainActionsGrid}>
          {mainActions.map((item) => (
            <Pressable
              key={item.key}
              style={({ pressed }) => [
                styles.mainActionCard,
                getAccentBorderStyle(item.accent, styles),
                pressed && styles.pressed,
              ]}
              onPress={() => goToModule(item)}
            >
              <View style={[styles.mainActionCode, getAccentBgStyle(item.accent, styles)]}>
                <Text
                  style={[
                    styles.mainActionCodeText,
                    getAccentTextStyle(item.accent, styles),
                  ]}
                >
                  {item.code}
                </Text>
              </View>

              <Text style={styles.mainActionTitle}>{item.title}</Text>
              <Text style={styles.mainActionSubtitle}>{item.subtitle}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.statusPanel}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionEyebrow}>Resumen</Text>
              <Text style={styles.sectionTitle}>Estado de hoy</Text>
            </View>

            <Text style={styles.sectionHint}>Actualizado</Text>
          </View>

          <View style={styles.statusGrid}>
            <StatusCard
              label="Jornada"
              value={permisos.asistencia ? 'Disponible' : 'Bloqueada'}
              detail={permisos.asistencia ? 'Puedes registrar asistencia.' : 'Sin permiso activo.'}
              accent={permisos.asistencia ? 'teal' : 'muted'}
              styles={styles}
            />

            <StatusCard
              label="Credencial"
              value={hasCredential ? 'Lista' : 'Pendiente'}
              detail={hasCredential ? 'Disponible en documentos.' : 'Aún no generada.'}
              accent={hasCredential ? 'teal' : 'gold'}
              styles={styles}
            />

            <StatusCard
              label="Avisos"
              value={String(pendingItems.length)}
              detail={pendingItems.length ? 'Requieren revisión.' : 'Sin pendientes.'}
              accent={pendingItems.length ? 'gold' : 'teal'}
              styles={styles}
            />

            <StatusCard
              label="Accesos"
              value={String(enabledModules.length)}
              detail="Módulos habilitados."
              accent="blue"
              styles={styles}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionEyebrow}>Pendientes</Text>
              <Text style={styles.sectionTitle}>Atención rápida</Text>
            </View>
          </View>

          {pendingItems.length ? (
            <View style={styles.pendingList}>
              {pendingItems.map((item, index) => (
                <View key={`${item.title}-${index}`} style={styles.pendingItem}>
                  <View style={[styles.pendingLine, getAccentBgStyle(item.accent, styles)]} />
                  <View style={styles.pendingContent}>
                    <Text style={styles.pendingTitle}>{item.title}</Text>
                    <Text style={styles.pendingDetail}>{item.detail}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Sin pendientes importantes</Text>
              <Text style={styles.emptyText}>
                Tu cuenta no presenta alertas críticas por el momento.
              </Text>
            </View>
          )}
        </View>

        {adminModules.length > 0 && (
          <ModuleSection
            title="Administración"
            subtitle="Gestión general del sistema."
            modules={adminModules}
            onPress={goToModule}
            styles={styles}
          />
        )}

        <ModuleSection
          title="Trabajo"
          subtitle="Operación diaria y solicitudes."
          modules={workModules}
          onPress={goToModule}
          styles={styles}
        />

        <ModuleSection
          title="Documentos"
          subtitle="Expediente laboral e identificación."
          modules={documentModules}
          onPress={goToModule}
          styles={styles}
        />

        <ModuleSection
          title="Cuenta"
          subtitle="Seguimiento, soporte y actividad."
          modules={accountModules}
          onPress={goToModule}
          styles={styles}
        />

        {lockedModules.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>No disponibles</Text>
            <Text style={styles.sectionSubtitle}>
              Estos módulos aparecerán cuando sean habilitados desde el portal.
            </Text>

            <View style={styles.lockedList}>
              {lockedModules.map((item) => (
                <View key={item.key} style={styles.lockedItem}>
                  <Text style={styles.lockedTitle}>{item.title}</Text>
                  <Text style={styles.lockedDetail}>
                    {item.lockedReason || item.subtitle}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.sessionSection}>
          <Pressable style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={accountSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAccountSheetVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setAccountSheetVisible(false)}
          />

          <SafeAreaView style={styles.sheetPanel}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetContent}
            >
              <View style={styles.sheetHandle} />

              <View style={styles.sheetTopRow}>
                <View>
                  <Text style={styles.sheetEyebrow}>Mi cuenta</Text>
                  <Text style={styles.sheetTitle}>Perfil laboral</Text>
                </View>

                <Pressable
                  style={styles.sheetCloseButton}
                  onPress={() => setAccountSheetVisible(false)}
                >
                  <Text style={styles.sheetCloseText}>×</Text>
                </Pressable>
              </View>

              <View style={styles.profileSheetCard}>
                <View style={styles.sheetAvatar}>
                  {photoLocalUri && !photoLoadFailed ? (
                    <Image
                      source={{ uri: photoLocalUri }}
                      style={styles.sheetAvatarImage}
                      onError={() => setPhotoLoadFailed(true)}
                    />
                  ) : (
                    <Text style={styles.sheetAvatarText}>
                      {user?.nombre?.[0] || 'S'}
                    </Text>
                  )}
                </View>

                <View style={styles.sheetProfileText}>
                  <Text style={styles.sheetName} numberOfLines={2}>
                    {user?.nombre} {user?.apellido}
                  </Text>
                  <Text style={styles.sheetEmail} numberOfLines={1}>
                    {user?.correo}
                  </Text>

                  <View style={styles.sheetRolePill}>
                    <Text style={styles.sheetRoleText}>{user?.role || 'Usuario'}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.sheetInfoGrid}>
                <InfoBox label="Ingreso" value={formatDate(user?.fecha_ingreso)} styles={styles} />
                <InfoBox
                  label="Vacaciones"
                  value={`${user?.dias_vacaciones_disponibles ?? 0} días`}
                  styles={styles}
                />
                <InfoBox label="Credencial" value={hasCredential ? 'Disponible' : 'Pendiente'} styles={styles} />
                <InfoBox label="Módulos" value={String(enabledModules.length)} styles={styles} />
              </View>

              <View style={styles.sheetStatusCard}>
                <View style={styles.sheetStatusHeader}>
                  <Text style={styles.sheetStatusTitle}>Expediente digital</Text>
                  <View
                    style={[
                      styles.sheetStatusBadge,
                      hasProfilePhoto && hasCredential ? styles.bgTeal : styles.bgGold,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sheetStatusBadgeText,
                        hasProfilePhoto && hasCredential ? styles.textTeal : styles.textGold,
                      ]}
                    >
                      {hasProfilePhoto && hasCredential ? 'Completo' : 'Pendiente'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.sheetStatusText}>
                  {hasProfilePhoto && hasCredential
                    ? 'Tu expediente móvil cuenta con foto y credencial activa.'
                    : 'Tu expediente aún tiene elementos pendientes por completar.'}
                </Text>

                <View style={styles.sheetStatusLine}>
                  <View style={[styles.sheetStatusDot, hasProfilePhoto ? styles.bgTeal : styles.bgGold]} />
                  <Text style={styles.sheetStatusLabel}>
                    Foto: {hasProfilePhoto ? 'registrada' : 'pendiente'}
                  </Text>
                </View>

                <View style={styles.sheetStatusLine}>
                  <View style={[styles.sheetStatusDot, hasCredential ? styles.bgTeal : styles.bgGold]} />
                  <Text style={styles.sheetStatusLabel}>
                    Credencial: {hasCredential ? 'disponible' : 'pendiente'}
                  </Text>
                </View>
              </View>

              <Text style={styles.sheetSectionTitle}>Acciones rápidas</Text>

              <View style={styles.sheetActionGrid}>
                {sheetActions.map((item) => (
                  <Pressable
                    key={item.label}
                    style={({ pressed }) => [
                      styles.sheetActionItem,
                      item.accent === 'danger' && styles.sheetActionDanger,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleSheetAction(item)}
                  >
                    <View style={[styles.sheetActionCode, getAccentBgStyle(item.accent, styles)]}>
                      <Text
                        style={[
                          styles.sheetActionCodeText,
                          getAccentTextStyle(item.accent, styles),
                        ]}
                      >
                        {item.code}
                      </Text>
                    </View>

                    <View style={styles.sheetActionTextBlock}>
                      <Text
                        style={[
                          styles.sheetActionLabel,
                          item.accent === 'danger' && styles.sheetActionLabelDanger,
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                      <Text style={styles.sheetActionDetail} numberOfLines={2}>
                        {item.detail}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
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
    <View style={styles.sheetInfoBox}>
      <Text style={styles.sheetInfoLabel}>{label}</Text>
      <Text style={styles.sheetInfoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ModuleSection({
  title,
  subtitle,
  modules,
  onPress,
  styles,
}: {
  title: string;
  subtitle: string;
  modules: ModuleItem[];
  onPress: (item: ModuleItem) => void;
  styles: any;
}) {
  if (!modules.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.moduleGrid}>
        {modules.map((item) => (
          <Pressable
            key={item.key}
            style={({ pressed }) => [
              styles.moduleCard,
              getAccentBorderStyle(item.accent, styles),
              pressed && styles.pressed,
            ]}
            onPress={() => onPress(item)}
          >
            <View style={styles.moduleCardTop}>
              <View style={[styles.moduleCode, getAccentBgStyle(item.accent, styles)]}>
                <Text style={[styles.moduleCodeText, getAccentTextStyle(item.accent, styles)]}>
                  {item.code}
                </Text>
              </View>

              {item.badge ? (
                <View style={styles.moduleBadge}>
                  <Text style={styles.moduleBadgeText}>{item.badge}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.moduleTitle}>{item.title}</Text>
            <Text style={styles.moduleSubtitle}>{item.subtitle}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function StatusCard({
  label,
  value,
  detail,
  accent,
  styles,
}: {
  label: string;
  value: string;
  detail: string;
  accent: Accent;
  styles: any;
}) {
  return (
    <View style={[styles.statusCard, getAccentBorderStyle(accent, styles)]}>
      <View style={[styles.statusAccentDot, getAccentBgStyle(accent, styles)]} />
      <Text style={styles.statusValue}>{value}</Text>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusDetail}>{detail}</Text>
    </View>
  );
}

function getAccentBorderStyle(accent: Accent, styles: any) {
  if (accent === 'teal') return styles.borderTeal;
  if (accent === 'danger') return styles.borderDanger;
  if (accent === 'muted') return styles.borderMuted;
  if (accent === 'gold') return styles.borderGold;
  return styles.borderBlue;
}

function getAccentBgStyle(accent: Accent, styles: any) {
  if (accent === 'teal') return styles.bgTeal;
  if (accent === 'danger') return styles.bgDanger;
  if (accent === 'muted') return styles.bgMuted;
  if (accent === 'gold') return styles.bgGold;
  return styles.bgBlue;
}

function getAccentTextStyle(accent: Accent, styles: any) {
  if (accent === 'teal') return styles.textTeal;
  if (accent === 'danger') return styles.textDanger;
  if (accent === 'muted') return styles.textMutedStrong;
  if (accent === 'gold') return styles.textGold;
  return styles.textBlue;
}

function getColors(isDark: boolean) {
  return {
    background: isDark ? '#07111F' : '#F4F7FB',
    surface: isDark ? '#0F1B2D' : '#FFFFFF',
    surfaceSoft: isDark ? '#111F33' : '#F9FBFD',
    surfaceMuted: isDark ? '#17263D' : '#EEF4FA',
    primary: isDark ? '#38BDF8' : '#0A57A4',
    primarySoft: isDark ? 'rgba(56,189,248,0.14)' : 'rgba(10,87,164,0.10)',
    teal: isDark ? '#2DD4BF' : '#22B8B0',
    tealSoft: isDark ? 'rgba(45,212,191,0.14)' : 'rgba(34,184,176,0.12)',
    gold: isDark ? '#FACC15' : '#B45309',
    goldSoft: isDark ? 'rgba(250,204,21,0.13)' : 'rgba(245,158,11,0.14)',
    danger: '#D64545',
    dangerSoft: 'rgba(214,69,69,0.12)',
    muted: isDark ? '#64748B' : '#94A3B8',
    mutedSoft: isDark ? 'rgba(100,116,139,0.14)' : 'rgba(148,163,184,0.14)',
    text: isDark ? '#F8FAFC' : '#0F172A',
    textMuted: isDark ? '#9FB0C4' : '#5B6B81',
    border: isDark ? '#26364D' : '#D9E1EC',
    overlay: isDark ? 'rgba(2,6,23,0.72)' : 'rgba(15,23,42,0.32)',
  };
}

function getStyles(isDark: boolean) {
  const C = getColors(isDark);

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: C.background,
    },
    container: {
      padding: 20,
      paddingBottom: 46,
      backgroundColor: C.background,
      overflow: 'hidden',
    },
    bgCircleOne: {
      position: 'absolute',
      top: -110,
      right: -120,
      width: 280,
      height: 280,
      borderRadius: 140,
      backgroundColor: C.primary,
      opacity: isDark ? 0.15 : 0.08,
    },
    bgCircleTwo: {
      position: 'absolute',
      top: 120,
      left: -90,
      width: 190,
      height: 190,
      borderRadius: 95,
      backgroundColor: C.teal,
      opacity: isDark ? 0.14 : 0.09,
    },
    topHeader: {
      zIndex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18,
      gap: 12,
    },
    appName: {
      color: C.primary,
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    dateText: {
      marginTop: 3,
      color: C.textMuted,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'capitalize',
    },
    accountButton: {
      width: 48,
      height: 48,
      borderRadius: 18,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 3,
    },
    accountAvatar: {
      width: 38,
      height: 38,
      borderRadius: 15,
      overflow: 'hidden',
      backgroundColor: C.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accountAvatarImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    accountAvatarText: {
      color: C.primary,
      fontSize: 16,
      fontWeight: '900',
    },
    hero: {
      zIndex: 2,
      padding: 22,
      borderRadius: 32,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      elevation: 5,
      marginBottom: 16,
    },
    greeting: {
      color: C.textMuted,
      fontSize: 14,
      fontWeight: '800',
    },
    userTitle: {
      marginTop: 3,
      color: C.text,
      fontSize: 32,
      lineHeight: 38,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    heroSubtitle: {
      marginTop: 8,
      color: C.textMuted,
      fontSize: 14,
      lineHeight: 21,
      fontWeight: '700',
    },
    heroMetaRow: {
      marginTop: 16,
      flexDirection: 'row',
      gap: 10,
      flexWrap: 'wrap',
    },
    heroMetaChip: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 16,
      backgroundColor: C.surfaceSoft,
      borderWidth: 1,
      borderColor: C.border,
    },
    heroMetaLabel: {
      color: C.textMuted,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    heroMetaValue: {
      marginTop: 2,
      color: C.primary,
      fontSize: 13,
      fontWeight: '900',
      textTransform: 'capitalize',
    },
    wearableCard: {
      zIndex: 2,
      padding: 18,
      borderRadius: 28,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(45,212,191,0.28)' : 'rgba(34,184,176,0.20)',
      elevation: 4,
      marginBottom: 16,
    },
    wearableHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
    },
    wearableTitle: {
      color: C.text,
      fontSize: 21,
      fontWeight: '900',
    },
    wearableStatusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
    },
    wearableStatusText: {
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    wearableDescription: {
      color: C.textMuted,
      fontSize: 13,
      lineHeight: 20,
      fontWeight: '700',
      marginTop: 10,
    },
    wearableInfoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 14,
      marginBottom: 2,
    },
    pairingCodeBox: {
      marginTop: 14,
      padding: 16,
      borderRadius: 22,
      backgroundColor: C.primarySoft,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(56,189,248,0.30)' : 'rgba(10,87,164,0.18)',
      alignItems: 'center',
    },
    pairingCodeLabel: {
      color: C.textMuted,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    pairingCodeValue: {
      color: C.primary,
      fontSize: 38,
      fontWeight: '900',
      letterSpacing: 7,
      marginTop: 4,
    },
    pairingCodeHelp: {
      color: C.textMuted,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: 4,
    },
    wearableActions: {
      marginTop: 14,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    wearablePrimaryButton: {
      flexGrow: 1,
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: 16,
      backgroundColor: C.teal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wearablePrimaryButtonText: {
      color: '#03111A',
      fontSize: 13,
      fontWeight: '900',
    },
    wearableDangerButton: {
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: 16,
      backgroundColor: C.dangerSoft,
      borderWidth: 1,
      borderColor: C.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wearableDangerButtonText: {
      color: C.danger,
      fontSize: 13,
      fontWeight: '900',
    },
    wearableGhostButton: {
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: 16,
      backgroundColor: C.surfaceSoft,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wearableGhostButtonText: {
      color: C.primary,
      fontSize: 13,
      fontWeight: '900',
    },
    alertCard: {
      zIndex: 2,
      padding: 14,
      borderRadius: 24,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 16,
      elevation: 3,
    },
    alertTop: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
    },
    alertCode: {
      width: 42,
      height: 42,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    alertCodeText: {
      fontSize: 12,
      fontWeight: '900',
    },
    alertBody: {
      flex: 1,
    },
    alertTitleRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    alertTitle: {
      flex: 1,
      color: C.text,
      fontSize: 15,
      fontWeight: '900',
    },
    newBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: C.tealSoft,
    },
    newBadgeText: {
      color: C.teal,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    alertText: {
      marginTop: 4,
      color: C.textMuted,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '700',
    },
    alertActions: {
      marginTop: 12,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      alignItems: 'center',
    },
    alertPrimaryButton: {
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: 14,
      backgroundColor: C.primary,
    },
    alertPrimaryButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
    },
    alertGhostButton: {
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderRadius: 12,
    },
    alertGhostButtonText: {
      color: C.textMuted,
      fontSize: 12,
      fontWeight: '900',
    },
    mainActionsGrid: {
      zIndex: 2,
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    mainActionCard: {
      flex: 1,
      minHeight: 146,
      padding: 16,
      borderRadius: 26,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      elevation: 3,
    },
    mainActionCode: {
      width: 46,
      height: 46,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 13,
    },
    mainActionCodeText: {
      fontSize: 13,
      fontWeight: '900',
    },
    mainActionTitle: {
      color: C.text,
      fontSize: 17,
      lineHeight: 21,
      fontWeight: '900',
    },
    mainActionSubtitle: {
      marginTop: 6,
      color: C.textMuted,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '700',
    },
    statusPanel: {
      zIndex: 2,
      padding: 18,
      borderRadius: 28,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      elevation: 3,
      marginBottom: 16,
    },
    section: {
      zIndex: 2,
      marginBottom: 18,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 14,
    },
    sectionEyebrow: {
      color: C.teal,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    sectionTitle: {
      color: C.text,
      fontSize: 21,
      fontWeight: '900',
    },
    sectionSubtitle: {
      color: C.textMuted,
      fontSize: 13,
      lineHeight: 20,
      marginTop: 5,
      fontWeight: '700',
    },
    sectionHint: {
      color: C.textMuted,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    statusGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    statusCard: {
      width: '48%',
      minHeight: 126,
      padding: 14,
      borderRadius: 22,
      backgroundColor: C.surfaceSoft,
      borderWidth: 1,
      borderColor: C.border,
    },
    statusAccentDot: {
      width: 36,
      height: 6,
      borderRadius: 999,
      marginBottom: 10,
    },
    statusValue: {
      color: C.text,
      fontSize: 19,
      fontWeight: '900',
    },
    statusLabel: {
      marginTop: 2,
      color: C.textMuted,
      fontSize: 12,
      fontWeight: '900',
    },
    statusDetail: {
      marginTop: 6,
      color: C.textMuted,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: '700',
    },
    pendingList: {
      gap: 10,
    },
    pendingItem: {
      flexDirection: 'row',
      gap: 12,
      padding: 14,
      borderRadius: 20,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    pendingLine: {
      width: 7,
      borderRadius: 999,
    },
    pendingContent: {
      flex: 1,
    },
    pendingTitle: {
      color: C.text,
      fontSize: 15,
      fontWeight: '900',
    },
    pendingDetail: {
      marginTop: 5,
      color: C.textMuted,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '700',
    },
    emptyCard: {
      padding: 16,
      borderRadius: 20,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    emptyTitle: {
      color: C.text,
      fontSize: 15,
      fontWeight: '900',
    },
    emptyText: {
      color: C.textMuted,
      marginTop: 5,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '700',
    },
    moduleGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    moduleCard: {
      width: '48%',
      minHeight: 154,
      padding: 15,
      borderRadius: 24,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      elevation: 3,
    },
    moduleCardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 13,
      gap: 8,
    },
    moduleCode: {
      width: 43,
      height: 43,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moduleCodeText: {
      fontSize: 12,
      fontWeight: '900',
    },
    moduleBadge: {
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: C.surfaceSoft,
      borderWidth: 1,
      borderColor: C.border,
    },
    moduleBadgeText: {
      color: C.textMuted,
      fontSize: 9,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    moduleTitle: {
      color: C.text,
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '900',
    },
    moduleSubtitle: {
      color: C.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 6,
      fontWeight: '700',
    },
    lockedList: {
      gap: 10,
      marginTop: 12,
    },
    lockedItem: {
      padding: 13,
      borderRadius: 18,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      opacity: 0.8,
    },
    lockedTitle: {
      color: C.text,
      fontSize: 14,
      fontWeight: '900',
    },
    lockedDetail: {
      color: C.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 4,
    },
    sessionSection: {
      zIndex: 2,
      marginTop: 4,
    },
    logoutButton: {
      minHeight: 54,
      borderRadius: 18,
      backgroundColor: C.dangerSoft,
      borderWidth: 1,
      borderColor: C.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoutButtonText: {
      color: C.danger,
      fontSize: 14,
      fontWeight: '900',
    },
    sheetOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: C.overlay,
    },
    sheetBackdrop: {
      flex: 1,
    },
    sheetPanel: {
      maxHeight: '88%',
      backgroundColor: C.background,
      borderTopLeftRadius: 34,
      borderTopRightRadius: 34,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
    },
    sheetContent: {
      padding: 20,
      paddingBottom: 34,
    },
    sheetHandle: {
      width: 44,
      height: 5,
      borderRadius: 999,
      backgroundColor: C.border,
      alignSelf: 'center',
      marginBottom: 16,
    },
    sheetTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    sheetEyebrow: {
      color: C.teal,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    sheetTitle: {
      color: C.text,
      fontSize: 22,
      fontWeight: '900',
      marginTop: 3,
    },
    sheetCloseButton: {
      width: 38,
      height: 38,
      borderRadius: 15,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetCloseText: {
      color: C.primary,
      fontSize: 24,
      fontWeight: '900',
      marginTop: -2,
    },
    profileSheetCard: {
      flexDirection: 'row',
      gap: 14,
      alignItems: 'center',
      backgroundColor: C.surface,
      borderRadius: 26,
      padding: 16,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 14,
    },
    sheetAvatar: {
      width: 78,
      height: 78,
      borderRadius: 28,
      overflow: 'hidden',
      backgroundColor: C.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: C.border,
    },
    sheetAvatarImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    sheetAvatarText: {
      color: C.primary,
      fontSize: 32,
      fontWeight: '900',
    },
    sheetProfileText: {
      flex: 1,
    },
    sheetName: {
      color: C.text,
      fontSize: 20,
      lineHeight: 25,
      fontWeight: '900',
    },
    sheetEmail: {
      color: C.textMuted,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 4,
    },
    sheetRolePill: {
      alignSelf: 'flex-start',
      marginTop: 10,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: C.tealSoft,
    },
    sheetRoleText: {
      color: C.teal,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    sheetInfoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 14,
    },
    sheetInfoBox: {
      width: '48%',
      minHeight: 72,
      padding: 12,
      borderRadius: 18,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    sheetInfoLabel: {
      color: C.textMuted,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 5,
    },
    sheetInfoValue: {
      color: C.text,
      fontSize: 14,
      fontWeight: '900',
    },
    sheetStatusCard: {
      padding: 15,
      borderRadius: 22,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 16,
    },
    sheetStatusHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    sheetStatusTitle: {
      color: C.text,
      fontSize: 16,
      fontWeight: '900',
    },
    sheetStatusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    sheetStatusBadgeText: {
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    sheetStatusText: {
      color: C.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 8,
      marginBottom: 10,
      fontWeight: '700',
    },
    sheetStatusLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      marginTop: 7,
    },
    sheetStatusDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
    },
    sheetStatusLabel: {
      color: C.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    sheetSectionTitle: {
      color: C.text,
      fontSize: 18,
      fontWeight: '900',
      marginBottom: 12,
    },
    sheetActionGrid: {
      gap: 10,
    },
    sheetActionItem: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
      padding: 13,
      borderRadius: 20,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    sheetActionDanger: {
      borderColor: 'rgba(214,69,69,0.35)',
      backgroundColor: C.dangerSoft,
    },
    sheetActionCode: {
      width: 42,
      height: 42,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetActionCodeText: {
      fontSize: 11,
      fontWeight: '900',
    },
    sheetActionTextBlock: {
      flex: 1,
    },
    sheetActionLabel: {
      color: C.text,
      fontSize: 14,
      fontWeight: '900',
    },
    sheetActionLabelDanger: {
      color: C.danger,
    },
    sheetActionDetail: {
      color: C.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 3,
      fontWeight: '700',
    },
    pressed: {
      transform: [{ scale: 0.985 }],
    },
    borderBlue: {
      borderColor: isDark ? 'rgba(56,189,248,0.30)' : 'rgba(10,87,164,0.18)',
    },
    borderTeal: {
      borderColor: isDark ? 'rgba(45,212,191,0.32)' : 'rgba(34,184,176,0.22)',
    },
    borderDanger: {
      borderColor: 'rgba(214,69,69,0.35)',
    },
    borderMuted: {
      borderColor: C.border,
    },
    borderGold: {
      borderColor: isDark ? 'rgba(250,204,21,0.35)' : 'rgba(180,83,9,0.22)',
    },
    bgBlue: {
      backgroundColor: C.primarySoft,
    },
    bgTeal: {
      backgroundColor: C.tealSoft,
    },
    bgDanger: {
      backgroundColor: C.dangerSoft,
    },
    bgMuted: {
      backgroundColor: C.mutedSoft,
    },
    bgGold: {
      backgroundColor: C.goldSoft,
    },
    textBlue: {
      color: C.primary,
    },
    textTeal: {
      color: C.teal,
    },
    textDanger: {
      color: C.danger,
    },
    textGold: {
      color: C.gold,
    },
    textMutedStrong: {
      color: C.muted,
    },
  });
}