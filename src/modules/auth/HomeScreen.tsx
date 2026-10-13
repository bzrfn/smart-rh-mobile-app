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
import AnimatedEntrance from '../../components/AnimatedEntrance';
import ConstellationAccent from '../../components/ConstellationAccent';
import { getSmartRhColors, getSmartRhShadow } from '../../design/smartRhTheme';

type Props = {
  navigation: any;
};

type Accent = 'blue' | 'teal' | 'danger' | 'muted' | 'gold';
type ModuleSectionKey = 'admin' | 'trabajo' | 'documentos' | 'cuenta';

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
  const [activeModuleSection, setActiveModuleSection] =
    useState<ModuleSectionKey | null>('trabajo');
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [notificationPreviewItems, setNotificationPreviewItems] = useState<
    Notificacion[]
  >([]);
  const [photoLocalUri, setPhotoLocalUri] = useState('');
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);

  const loadingNotificationsRef = useRef(false);
  const lastNotificationShownRef = useRef<string | null>(null);
  const lastNotificationTimeRef = useRef<number>(0);

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
        key: 'notificaciones',
        title: 'Notificaciones',
        subtitle: 'Avisos, recordatorios y seguimiento.',
        route: 'Notificaciones',
        accent: notificacion ? 'gold' : 'blue',
        code: 'NT',
        badge: notificacion ? 'Nuevo' : undefined,
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
  }, [permisos, hasCredential, isAdmin, notificacion]);

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
  }, [hasProfilePhoto, hasCredential, permisos.asistencia]);

  const firstName = String(user?.nombre || 'Usuario').split(' ')[0] || 'Usuario';

  const pendingCount = pendingItems.length;
  const primaryNextAction = permisos.asistencia
    ? 'Registrar asistencia'
    : 'Revisar expediente';
  const primaryNextDetail = permisos.asistencia
    ? 'Escanea el QR cuando inicies o cierres jornada.'
    : 'Consulta documentos, credencial y soporte disponible.';
  const homeStatus = pendingCount
    ? `${pendingCount} pendiente${pendingCount === 1 ? '' : 's'} por revisar`
    : 'Operación sin alertas críticas';

  const focusItems = useMemo(
    () => [
      {
        key: 'attendance',
        eyebrow: 'Prioridad 01',
        title: permisos.asistencia ? 'Registrar asistencia' : 'Asistencia no habilitada',
        detail: permisos.asistencia
          ? 'Entrada y salida por QR desde el flujo móvil.'
          : 'El acceso depende de permisos administrativos.',
        route: permisos.asistencia ? 'QrScan' : 'Asistencia',
        accent: permisos.asistencia ? ('teal' as Accent) : ('muted' as Accent),
        enabled: Boolean(permisos.asistencia),
      },
      {
        key: 'documents',
        eyebrow: 'Prioridad 02',
        title: hasCredential ? 'Expediente digital listo' : 'Completar expediente',
        detail: hasCredential
          ? 'Credencial y documentos laborales disponibles.'
          : 'Revisa credencial, contrato o archivos pendientes.',
        route: 'Documentos',
        accent: hasCredential ? ('blue' as Accent) : ('gold' as Accent),
        enabled: true,
      },
      {
        key: 'followup',
        eyebrow: 'Prioridad 03',
        title: pendingCount ? 'Dar seguimiento' : 'Mantener seguimiento',
        detail: pendingCount
          ? 'Atiende los puntos pendientes desde tu cuenta.'
          : 'Consulta actividad o soporte cuando necesites contexto.',
        route: pendingCount ? 'Perfil' : 'Actividad',
        accent: pendingCount ? ('gold' as Accent) : ('teal' as Accent),
        enabled: true,
      },
    ],
    [hasCredential, pendingCount, permisos.asistencia]
  );

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
      const unreadList = list
        .filter((item: Notificacion) => !item.leida)
        .slice(0, 3);
      const unread = unreadList[0] || null;

      setNotificacion(unread);
      setNotificationPreviewItems(unreadList);

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
      setNotificationPreviewItems([]);
    } finally {
      loadingNotificationsRef.current = false;
    }
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

  function navigateFromQuickMenu(route: string) {
    closeFloatingPanels();
    navigation.navigate(route);
  }

  function closeFloatingPanels() {
    setQuickMenuOpen(false);
    setNotificationPanelOpen(false);
  }

  async function openNotificationFromPanel(item: Notificacion) {
    const action = getNotificationAction(item);

    closeFloatingPanels();
    setNotificationPreviewItems((current) =>
      current.filter((notification) => notification._id !== item._id)
    );

    if (notificacion?._id === item._id) {
      setNotificacion(null);
    }

    if (item._id) {
      try {
        await api.patch(`/notificaciones/${item._id}/leida`);
      } catch {
        // La navegación no depende de marcar como leída.
      }
    }

    navigation.navigate(action.route);
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

  function toggleModuleSection(section: ModuleSectionKey) {
    setActiveModuleSection((current) => (current === section ? null : section));
  }

  useEffect(() => {
    loadNotificaciones();
    const focusUnsubscribe = navigation.addListener('focus', () => {
      loadNotificaciones();
    });

    const interval = setInterval(() => {
      loadNotificaciones();
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

          <View style={styles.topQuickActionsWrap}>
            <View style={styles.topQuickActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Abrir notificaciones"
                style={({ pressed }) => [
                  styles.topIconButton,
                  notificacion && styles.topIconButtonActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  setQuickMenuOpen(false);
                  setNotificationPanelOpen((current) => !current);
                }}
              >
                <BellGlyph styles={styles} />
                {notificacion ? <View style={styles.topNotificationDot} /> : null}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                style={({ pressed }) => [
                  styles.topIconButton,
                  styles.topIconButtonSoft,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  closeFloatingPanels();
                  toggleTheme();
                }}
              >
                <ThemeGlyph isDark={isDark} styles={styles} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={quickMenuOpen ? 'Cerrar accesos rápidos' : 'Abrir accesos rápidos'}
                style={({ pressed }) => [
                  styles.topIconButton,
                  quickMenuOpen && styles.topIconButtonActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  setNotificationPanelOpen(false);
                  setQuickMenuOpen((current) => !current);
                }}
              >
                <QuickMenuGlyph styles={styles} />
              </Pressable>
            </View>
          </View>
        </View>

        <AnimatedEntrance delay={40}>
          <View style={styles.hero}>
            <View style={styles.heroRail} />
            <View style={styles.heroGlow} />
            <ConstellationAccent
              isDark={isDark}
              style={styles.constellationAccent}
            />

            <Text style={styles.greeting}>Inicio laboral</Text>
            <Text style={styles.userTitle}>{getGreeting()}, {firstName}</Text>
            <Text style={styles.heroSubtitle}>
              Tu panel concentra jornada, expediente y seguimiento para que
              avances con una lectura limpia.
            </Text>

            <View style={styles.heroInsightPanel}>
              <View style={styles.heroInsightPrimary}>
                <Text style={styles.heroInsightLabel}>Siguiente acción</Text>
                <Text style={styles.heroInsightValue}>{primaryNextAction}</Text>
                <Text style={styles.heroInsightDetail}>{primaryNextDetail}</Text>
              </View>

              <View style={styles.heroInsightDivider} />

              <View style={styles.heroInsightSecondary}>
                <Text style={styles.heroInsightLabel}>Estado</Text>
                <Text style={styles.heroInsightStatus}>{homeStatus}</Text>
              </View>
            </View>
          </View>
        </AnimatedEntrance>

        <AnimatedEntrance delay={140}>
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
        </AnimatedEntrance>

        <AnimatedEntrance delay={180}>
          <View style={styles.focusPanel}>
            <View style={styles.focusHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>Seguimiento</Text>
                <Text style={styles.focusTitle}>Prioridad de hoy</Text>
              </View>

              <View style={styles.focusBadge}>
                <Text style={styles.focusBadgeText}>Orden claro</Text>
              </View>
            </View>

            <View style={styles.focusList}>
              {focusItems.map((item, index) => (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir ${item.title}`}
                  style={({ pressed }) => [
                    styles.focusRow,
                    !item.enabled && styles.focusRowDisabled,
                    pressed && item.enabled && styles.pressed,
                  ]}
                  onPress={() => {
                    if (item.enabled) navigation.navigate(item.route);
                  }}
                >
                  <View
                    style={[
                      styles.focusIndex,
                      getAccentBgStyle(item.accent, styles),
                    ]}
                  >
                    <Text
                      style={[
                        styles.focusIndexText,
                        getAccentTextStyle(item.accent, styles),
                      ]}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </Text>
                  </View>

                  <View style={styles.focusCopy}>
                    <Text
                      style={[
                        styles.focusEyebrow,
                        getAccentTextStyle(item.accent, styles),
                      ]}
                    >
                      {item.eyebrow}
                    </Text>
                    <Text style={styles.focusRowTitle}>{item.title}</Text>
                    <Text style={styles.focusRowDetail}>{item.detail}</Text>
                  </View>

                  <View style={styles.focusArrowBox}>
                    <ModuleActionGlyph styles={styles} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </AnimatedEntrance>

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
            sectionKey="admin"
            title="Administración"
            subtitle="Gestión general del sistema."
            modules={adminModules}
            isOpen={activeModuleSection === 'admin'}
            onToggle={toggleModuleSection}
            onPress={goToModule}
            styles={styles}
          />
        )}

        <ModuleSection
          sectionKey="trabajo"
          title="Trabajo"
          subtitle="Operación diaria y solicitudes."
          modules={workModules}
          isOpen={activeModuleSection === 'trabajo'}
          onToggle={toggleModuleSection}
          onPress={goToModule}
          styles={styles}
        />

        <ModuleSection
          sectionKey="documentos"
          title="Documentos"
          subtitle="Expediente laboral e identificación."
          modules={documentModules}
          isOpen={activeModuleSection === 'documentos'}
          onToggle={toggleModuleSection}
          onPress={goToModule}
          styles={styles}
        />

        <ModuleSection
          sectionKey="cuenta"
          title="Cuenta"
          subtitle="Seguimiento, soporte y actividad."
          modules={accountModules}
          isOpen={activeModuleSection === 'cuenta'}
          onToggle={toggleModuleSection}
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

      </ScrollView>

      <Modal
        visible={quickMenuOpen || notificationPanelOpen}
        transparent
        animationType="fade"
        onRequestClose={closeFloatingPanels}
      >
        <SafeAreaView style={styles.floatingOverlayRoot} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar panel flotante"
            style={styles.floatingDismissLayer}
            onPress={closeFloatingPanels}
          />

          {quickMenuOpen ? (
            <View style={styles.quickCascadeMenu} pointerEvents="box-none">
              <QuickCascadeItem
                label="Vacaciones"
                detail="Solicitudes"
                accent="teal"
                styles={styles}
                icon={<PlaneGlyph styles={styles} />}
                onPress={() => navigateFromQuickMenu('Vacaciones')}
              />
              <QuickCascadeItem
                label="Documentos"
                detail="Expediente"
                accent="blue"
                styles={styles}
                icon={<DocumentGlyph styles={styles} />}
                itemStyle={styles.quickCascadeSecond}
                onPress={() => navigateFromQuickMenu('Documentos')}
              />
              <QuickCascadeItem
                label="Calendario"
                detail="Laboral"
                accent="gold"
                styles={styles}
                icon={<CalendarGlyph styles={styles} />}
                itemStyle={styles.quickCascadeThird}
                onPress={() => navigateFromQuickMenu('CalendarioLaboral')}
              />
            </View>
          ) : null}

          {notificationPanelOpen ? (
            <View style={styles.notificationFloatMenu}>
              <View pointerEvents="none" style={styles.notificationFloatBackdrop} />

              <View style={styles.notificationFloatHeader}>
                <View>
                  <Text style={styles.notificationFloatEyebrow}>Centro de avisos</Text>
                  <Text style={styles.notificationFloatTitle}>Notificaciones</Text>
                </View>
                <View style={styles.notificationFloatCount}>
                  <Text style={styles.notificationFloatCountText}>
                    {notificationPreviewItems.length}
                  </Text>
                </View>
              </View>

              {notificationPreviewItems.length ? (
                <View style={styles.notificationFloatList}>
                  {notificationPreviewItems.map((item) => {
                    const action = getNotificationAction(item);

                    return (
                      <Pressable
                        key={item._id}
                        accessibilityRole="button"
                        accessibilityLabel={`Abrir notificación ${item.titulo}`}
                        style={({ pressed }) => [
                          styles.notificationFloatItem,
                          pressed && styles.pressed,
                        ]}
                        onPress={() => openNotificationFromPanel(item)}
                      >
                        <View style={styles.notificationFloatCode}>
                          <Text style={styles.notificationFloatCodeText}>
                            {action.code}
                          </Text>
                        </View>

                        <View style={styles.notificationFloatCopy}>
                          <Text
                            style={styles.notificationFloatItemTitle}
                            numberOfLines={1}
                          >
                            {item.titulo}
                          </Text>
                          <Text
                            style={styles.notificationFloatItemText}
                            numberOfLines={2}
                          >
                            {item.mensaje}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.notificationFloatEmpty}>
                  <View style={styles.notificationFloatEmptyIcon}>
                    <BellGlyph styles={styles} />
                  </View>
                  <Text style={styles.notificationFloatEmptyTitle}>
                    Sin avisos nuevos
                  </Text>
                  <Text style={styles.notificationFloatEmptyText}>
                    Las notificaciones importantes aparecerán aquí como acceso rápido.
                  </Text>
                </View>
              )}
            </View>
          ) : null}
        </SafeAreaView>
      </Modal>

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
  sectionKey,
  title,
  subtitle,
  modules,
  isOpen,
  onToggle,
  onPress,
  styles,
}: {
  sectionKey: ModuleSectionKey;
  title: string;
  subtitle: string;
  modules: ModuleItem[];
  isOpen: boolean;
  onToggle: (section: ModuleSectionKey) => void;
  onPress: (item: ModuleItem) => void;
  styles: any;
}) {
  if (!modules.length) return null;

  const sectionAccent = getSectionAccent(sectionKey);
  const fillWidth = `${Math.min(100, 34 + modules.length * 8)}%`;

  return (
    <View style={styles.section}>
      <View style={styles.moduleSectionFrame}>
        <View style={styles.moduleSectionWash} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${isOpen ? 'Cerrar' : 'Abrir'} sección ${title}`}
          style={({ pressed }) => [
            styles.moduleSectionHeader,
            pressed && styles.pressed,
          ]}
          onPress={() => onToggle(sectionKey)}
        >
          <View style={styles.moduleSectionIdentity}>
            <View style={styles.moduleSectionKickerRow}>
              <View
                style={[
                  styles.moduleSectionDot,
                  getAccentBgStyle(sectionAccent, styles),
                ]}
              />
              <Text
                style={[
                  styles.moduleSectionKicker,
                  getAccentTextStyle(sectionAccent, styles),
                ]}
              >
                {getSectionLabel(sectionKey)}
              </Text>
            </View>

            <View style={styles.moduleSectionCopy}>
              <Text style={styles.moduleSectionTitle}>{title}</Text>
              <Text style={styles.moduleSectionSubtitle}>{subtitle}</Text>
            </View>
          </View>

          <View style={styles.moduleSectionMeta}>
            <View style={styles.moduleSectionCount}>
              <Text style={styles.moduleSectionCountValue}>{modules.length}</Text>
              <Text style={styles.moduleSectionCountLabel}>accesos</Text>
            </View>

            <ModuleSectionChevron isOpen={isOpen} styles={styles} />
          </View>
        </Pressable>

        <View style={styles.moduleSectionTrack}>
          <View
            style={[
              styles.moduleSectionTrackFill,
              getAccentBgStyle(sectionAccent, styles),
              { width: fillWidth },
            ]}
          />
        </View>

        {isOpen ? (
          <View style={styles.moduleList}>
            {modules.map((item, index) => (
              <Pressable
                key={item.key}
                style={({ pressed }) => [
                  styles.moduleRow,
                  index === 0 && styles.moduleRowFirst,
                  index === modules.length - 1 && styles.moduleRowLast,
                  pressed && styles.pressed,
                ]}
                onPress={() => onPress(item)}
              >
                <View
                  style={[
                    styles.moduleLeadingRail,
                    getAccentBgStyle(item.accent, styles),
                  ]}
                />

                <View style={styles.moduleStep}>
                  <Text
                    style={[
                      styles.moduleStepNumber,
                      getAccentTextStyle(item.accent, styles),
                    ]}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                  <View
                    style={[
                      styles.moduleStepLine,
                      getAccentBgStyle(item.accent, styles),
                    ]}
                  />
                </View>

                <View style={styles.moduleTextBlock}>
                  <View style={styles.moduleTitleRow}>
                    <Text style={styles.moduleTitle} numberOfLines={2}>
                      {item.title}
                    </Text>

                    {item.badge ? (
                      <View style={styles.moduleBadge}>
                        <Text style={styles.moduleBadgeText}>{item.badge}</Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.moduleSubtitle} numberOfLines={2}>
                    {item.subtitle}
                  </Text>
                </View>

                <View style={styles.moduleActionPill}>
                  <ModuleActionGlyph styles={styles} />
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

      </View>
    </View>
  );
}

function getSectionAccent(sectionKey: ModuleSectionKey): Accent {
  if (sectionKey === 'trabajo') return 'teal';
  if (sectionKey === 'documentos') return 'blue';
  if (sectionKey === 'cuenta') return 'gold';
  return 'blue';
}

function getSectionLabel(sectionKey: ModuleSectionKey) {
  if (sectionKey === 'trabajo') return 'Ruta de trabajo';
  if (sectionKey === 'documentos') return 'Expediente digital';
  if (sectionKey === 'cuenta') return 'Cuenta y soporte';
  return 'Panel administrador';
}

function ModuleSectionChevron({
  isOpen,
  styles,
}: {
  isOpen: boolean;
  styles: any;
}) {
  return (
    <View
      style={[
        styles.moduleSectionToggle,
        isOpen && styles.moduleSectionToggleOpen,
      ]}
    >
      <View
        style={[
          styles.moduleChevron,
          isOpen ? styles.moduleChevronOpen : styles.moduleChevronClosed,
        ]}
      >
        <View style={[styles.moduleChevronStroke, styles.moduleChevronLeft]} />
        <View style={[styles.moduleChevronStroke, styles.moduleChevronRight]} />
      </View>
    </View>
  );
}

function ModuleActionGlyph({ styles }: { styles: any }) {
  return (
    <View style={styles.moduleActionGlyph}>
      <View style={[styles.moduleActionStroke, styles.moduleActionStrokeTop]} />
      <View style={[styles.moduleActionStroke, styles.moduleActionStrokeBottom]} />
    </View>
  );
}

function QuickCascadeItem({
  label,
  detail,
  accent,
  icon,
  itemStyle,
  styles,
  onPress,
}: {
  label: string;
  detail: string;
  accent: Accent;
  icon: React.ReactNode;
  itemStyle?: any;
  styles: any;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${label}`}
      style={({ pressed }) => [
        styles.quickCascadeItem,
        itemStyle,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.quickCascadeIcon,
          getAccentBgStyle(accent, styles),
          styles.floatingAccentNeutral,
        ]}
      >
        {icon}
      </View>

      <View style={styles.quickCascadeTextBlock}>
        <Text style={styles.quickCascadeLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.quickCascadeDetail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
    </Pressable>
  );
}

function CalendarGlyph({ styles }: { styles: any }) {
  return (
    <View style={styles.calendarGlyph}>
      <View style={styles.calendarBody}>
        <View style={styles.calendarRingLeft} />
        <View style={styles.calendarRingRight} />
        <View style={styles.calendarRule} />
        <View style={styles.calendarDayDot} />
      </View>
    </View>
  );
}

function ThemeGlyph({ isDark, styles }: { isDark: boolean; styles: any }) {
  return (
    <View style={styles.themeDialGlyph}>
      <View style={styles.themeDialRing}>
        <View style={styles.themeDialHalf} />
      </View>
      <View style={[styles.themeDialMark, isDark && styles.themeDialMarkDark]} />
    </View>
  );
}

function QuickMenuGlyph({ styles }: { styles: any }) {
  return (
    <View style={styles.quickMenuGlyph}>
      <View style={[styles.quickMenuTile, styles.quickMenuTileOne]} />
      <View style={[styles.quickMenuTile, styles.quickMenuTileTwo]} />
      <View style={[styles.quickMenuTile, styles.quickMenuTileThree]} />
      <View style={[styles.quickMenuTile, styles.quickMenuTileFour]} />
    </View>
  );
}

function PlaneGlyph({ styles }: { styles: any }) {
  return (
    <View style={styles.planeGlyph}>
      <View style={styles.planeBody} />
      <View style={styles.planeWingTop} />
      <View style={styles.planeWingBottom} />
      <View style={styles.planeTail} />
    </View>
  );
}

function DocumentGlyph({ styles }: { styles: any }) {
  return (
    <View style={styles.documentGlyph}>
      <View style={styles.documentFold} />
      <View style={styles.documentLineOne} />
      <View style={styles.documentLineTwo} />
    </View>
  );
}

function BellGlyph({ styles }: { styles: any }) {
  return (
    <View style={styles.bellGlyph}>
      <View style={styles.bellStem} />
      <View style={styles.bellDome} />
      <View style={styles.bellBase} />
      <View style={styles.bellClapper} />
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
  const colors = getSmartRhColors(isDark);

  return {
    background: colors.background,
    surface: colors.card,
    surfaceSoft: colors.cardSoft,
    surfaceMuted: colors.cardMuted,
    primary: colors.primary,
    primaryText: colors.primary,
    heroSurface: colors.card,
    heroSurfaceSoft: colors.cardSoft,
    heroText: colors.text,
    heroTextMuted: colors.textMuted,
    heroBorder: colors.border,
    heroAccent: colors.primary,
    actionFill: colors.primary,
    actionText: '#FFFFFF',
    primarySoft: colors.primarySoft,
    teal: colors.success,
    tealSoft: colors.successSoft,
    gold: colors.warning,
    goldSoft: colors.warningSoft,
    danger: colors.danger,
    dangerSoft: colors.dangerSoft,
    muted: colors.textSubtle,
    mutedSoft: colors.linkSoft,
    text: colors.text,
    textMuted: colors.textMuted,
    border: colors.border,
    overlay: isDark ? 'rgba(0,0,0,0.76)' : 'rgba(41,40,39,0.32)',
  };
}

function getStyles(isDark: boolean) {
  const C = getColors(isDark);
  const shadow = getSmartRhShadow(isDark);
  const floatingSurface = isDark
    ? 'rgba(15, 23, 42, 0.94)'
    : 'rgba(255, 255, 255, 0.92)';
  const floatingBorder = isDark
    ? 'rgba(125, 178, 216, 0.20)'
    : 'rgba(10, 87, 164, 0.14)';
  const floatingIcon = isDark ? '#A8D4F2' : C.primary;
  const floatingIconSoft = isDark ? '#7BCFC4' : C.teal;

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: C.background,
    },
    container: {
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 132,
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
      opacity: isDark ? 0.12 : 0.08,
    },
    bgCircleTwo: {
      position: 'absolute',
      top: 120,
      left: -90,
      width: 190,
      height: 190,
      borderRadius: 95,
      backgroundColor: C.teal,
      opacity: isDark ? 0.2 : 0.09,
    },
    topHeader: {
      zIndex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
      paddingHorizontal: 2,
      gap: 12,
    },
    topQuickActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    topQuickActionsWrap: {
      position: 'relative',
      zIndex: 50,
      alignItems: 'flex-end',
    },
    topIconButton: {
      position: 'relative',
      width: 44,
      height: 44,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      shadowColor: isDark ? '#000000' : '#0A57A4',
      shadowOpacity: isDark ? 0.18 : 0.07,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    topIconButtonActive: {
      backgroundColor: isDark ? 'rgba(44,83,112,0.36)' : C.primarySoft,
      borderColor: isDark ? 'rgba(124,196,236,0.30)' : 'rgba(10,87,164,0.18)',
    },
    topIconButtonSoft: {
      backgroundColor: isDark ? 'rgba(17,24,39,0.82)' : 'rgba(12,66,67,0.06)',
    },
    topNotificationDot: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 9,
      height: 9,
      borderRadius: 999,
      backgroundColor: C.danger,
      borderWidth: 2,
      borderColor: C.surface,
    },
    floatingOverlayRoot: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    floatingDismissLayer: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: 'transparent',
    },
    quickCascadeMenu: {
      position: 'absolute',
      top: 58,
      right: 18,
      width: 196,
      zIndex: 80,
      elevation: 12,
      alignItems: 'flex-end',
      gap: 8,
    },
    quickCascadeItem: {
      width: 178,
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 19,
      backgroundColor: floatingSurface,
      borderWidth: 1,
      borderColor: floatingBorder,
      shadowColor: isDark ? '#000000' : '#0A57A4',
      shadowOpacity: isDark ? 0.20 : 0.10,
      shadowRadius: isDark ? 15 : 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    quickCascadeSecond: {
      marginRight: 14,
    },
    quickCascadeThird: {
      marginRight: 28,
    },
    quickCascadeIcon: {
      width: 34,
      height: 34,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    floatingAccentNeutral: isDark
      ? {
          backgroundColor: 'rgba(148,163,184,0.12)',
        }
      : {},
    quickCascadeTextBlock: {
      flex: 1,
      minWidth: 0,
    },
    quickCascadeLabel: {
      color: C.text,
      fontSize: 13,
      lineHeight: 16,
      fontWeight: '900',
    },
    quickCascadeDetail: {
      marginTop: 2,
      color: C.textMuted,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    notificationFloatMenu: {
      position: 'absolute',
      top: 58,
      right: 18,
      width: 286,
      padding: 0,
      backgroundColor: 'transparent',
      borderWidth: 0,
      shadowOpacity: 0,
      elevation: 0,
      overflow: 'visible',
    },
    notificationFloatBackdrop: {
      position: 'absolute',
      top: -9,
      right: -9,
      bottom: -9,
      left: -9,
      borderRadius: 30,
      backgroundColor: isDark
        ? 'rgba(6, 14, 25, 0.58)'
        : 'rgba(238, 246, 252, 0.66)',
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(124,196,236,0.12)'
        : 'rgba(10,87,164,0.08)',
      shadowColor: isDark ? '#000000' : '#0A57A4',
      shadowOpacity: isDark ? 0.22 : 0.08,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 3,
    },
    notificationFloatHeader: {
      zIndex: 2,
      alignSelf: 'flex-end',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 9,
      paddingHorizontal: 11,
      marginBottom: 8,
      borderRadius: 20,
      backgroundColor: floatingSurface,
      borderWidth: 1,
      borderColor: floatingBorder,
      shadowColor: isDark ? '#000000' : '#0A57A4',
      shadowOpacity: isDark ? 0.18 : 0.10,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    notificationFloatEyebrow: {
      color: C.textMuted,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    notificationFloatTitle: {
      marginTop: 2,
      color: C.text,
      fontSize: 17,
      lineHeight: 21,
      fontWeight: '900',
    },
    notificationFloatCount: {
      width: 30,
      height: 30,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(148,163,184,0.12)' : C.primarySoft,
      borderWidth: 1,
      borderColor: floatingBorder,
    },
    notificationFloatCountText: {
      color: isDark ? '#D8E2EE' : C.primaryText,
      fontSize: 13,
      fontWeight: '900',
    },
    notificationFloatList: {
      zIndex: 2,
      gap: 8,
    },
    notificationFloatItem: {
      minHeight: 62,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 10,
      borderRadius: 20,
      backgroundColor: floatingSurface,
      borderWidth: 1,
      borderColor: floatingBorder,
      shadowColor: isDark ? '#000000' : '#0A57A4',
      shadowOpacity: isDark ? 0.16 : 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 7 },
      elevation: 4,
    },
    notificationFloatCode: {
      width: 34,
      height: 34,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(148,163,184,0.12)' : C.tealSoft,
    },
    notificationFloatCodeText: {
      color: isDark ? '#CBD5E1' : C.teal,
      fontSize: 11,
      fontWeight: '900',
    },
    notificationFloatCopy: {
      flex: 1,
      minWidth: 0,
    },
    notificationFloatItemTitle: {
      color: C.text,
      fontSize: 13,
      lineHeight: 16,
      fontWeight: '900',
    },
    notificationFloatItemText: {
      marginTop: 3,
      color: C.textMuted,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '700',
    },
    notificationFloatEmpty: {
      zIndex: 2,
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 18,
      borderRadius: 22,
      backgroundColor: floatingSurface,
      borderWidth: 1,
      borderColor: floatingBorder,
      shadowColor: isDark ? '#000000' : '#0A57A4',
      shadowOpacity: isDark ? 0.16 : 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 7 },
      elevation: 4,
    },
    notificationFloatEmptyIcon: {
      width: 44,
      height: 44,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(148,163,184,0.12)' : C.primarySoft,
      borderWidth: 1,
      borderColor: floatingBorder,
      marginBottom: 10,
    },
    notificationFloatEmptyTitle: {
      color: C.text,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '900',
      textAlign: 'center',
    },
    notificationFloatEmptyText: {
      marginTop: 5,
      color: C.textMuted,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: '700',
      textAlign: 'center',
    },
    calendarGlyph: {
      width: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calendarBody: {
      position: 'relative',
      width: 19,
      height: 18,
      borderRadius: 5,
      borderWidth: 1.8,
      borderColor: floatingIcon,
      marginTop: 2,
    },
    calendarRingLeft: {
      position: 'absolute',
      top: -5,
      left: 4,
      width: 3,
      height: 8,
      borderRadius: 999,
      backgroundColor: floatingIcon,
    },
    calendarRingRight: {
      position: 'absolute',
      top: -5,
      right: 4,
      width: 3,
      height: 8,
      borderRadius: 999,
      backgroundColor: floatingIcon,
    },
    calendarRule: {
      position: 'absolute',
      top: 6,
      left: 3,
      right: 3,
      height: 1.8,
      borderRadius: 999,
      backgroundColor: floatingIcon,
      opacity: 0.78,
    },
    calendarDayDot: {
      position: 'absolute',
      right: 4,
      bottom: 4,
      width: 4,
      height: 4,
      borderRadius: 999,
      backgroundColor: floatingIconSoft,
    },
    bellGlyph: {
      position: 'relative',
      width: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bellStem: {
      position: 'absolute',
      top: 2,
      width: 5,
      height: 3,
      borderRadius: 999,
      backgroundColor: floatingIcon,
    },
    bellDome: {
      position: 'absolute',
      top: 5,
      width: 15,
      height: 13,
      borderTopLeftRadius: 9,
      borderTopRightRadius: 9,
      borderWidth: 1.8,
      borderColor: floatingIcon,
      borderBottomWidth: 0,
    },
    bellBase: {
      position: 'absolute',
      bottom: 5,
      width: 19,
      height: 2,
      borderRadius: 999,
      backgroundColor: floatingIcon,
    },
    bellClapper: {
      position: 'absolute',
      bottom: 1,
      width: 5,
      height: 5,
      borderRadius: 999,
      backgroundColor: floatingIconSoft,
    },
    themeDialGlyph: {
      position: 'relative',
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeDialRing: {
      position: 'relative',
      width: 18,
      height: 18,
      borderRadius: 999,
      borderWidth: 1.8,
      borderColor: floatingIcon,
      backgroundColor: isDark ? 'rgba(15,23,42,0.92)' : '#FFFFFF',
      overflow: 'hidden',
    },
    themeDialHalf: {
      position: 'absolute',
      top: -1,
      right: -1,
      bottom: -1,
      width: 10,
      backgroundColor: isDark ? 'rgba(124,196,236,0.62)' : C.primary,
    },
    themeDialMark: {
      position: 'absolute',
      top: 2,
      right: 2,
      width: 4,
      height: 4,
      borderRadius: 999,
      backgroundColor: C.teal,
    },
    themeDialMarkDark: {
      backgroundColor: '#CBD5E1',
    },
    themeSwitchGlyph: {
      width: 25,
      height: 18,
      justifyContent: 'center',
    },
    themeSwitchTrack: {
      width: 25,
      height: 16,
      borderRadius: 999,
      borderWidth: 1.7,
      borderColor: C.primary,
      backgroundColor: isDark
        ? 'rgba(255,255,255,0.05)'
        : 'rgba(10,87,164,0.06)',
      padding: 1.5,
    },
    themeSwitchKnob: {
      width: 11,
      height: 11,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.primary,
    },
    themeSwitchKnobDark: {
      transform: [{ translateX: 9 }],
      backgroundColor: C.teal,
    },
    themeTinySun: {
      width: 5,
      height: 5,
      borderRadius: 999,
      backgroundColor: '#FFFFFF',
    },
    themeTinyMoon: {
      width: 6,
      height: 6,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: '#03111A',
      borderTopColor: 'transparent',
      borderRightColor: 'transparent',
      transform: [{ rotate: '-30deg' }],
    },
    sunGlyph: {
      position: 'relative',
      width: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sunCore: {
      width: 10,
      height: 10,
      borderRadius: 999,
      borderWidth: 1.8,
      borderColor: C.primary,
    },
    sunRay: {
      position: 'absolute',
      width: 2,
      height: 5,
      borderRadius: 999,
      backgroundColor: C.primary,
    },
    sunRayTop: {
      top: 0,
    },
    sunRayRight: {
      right: 0,
      transform: [{ rotate: '90deg' }],
    },
    sunRayBottom: {
      bottom: 0,
    },
    sunRayLeft: {
      left: 0,
      transform: [{ rotate: '90deg' }],
    },
    moonGlyph: {
      position: 'relative',
      width: 18,
      height: 18,
      borderRadius: 999,
      borderWidth: 2,
      borderColor: C.primary,
    },
    moonCutout: {
      position: 'absolute',
      top: -2,
      right: -3,
      width: 13,
      height: 18,
      borderRadius: 999,
      backgroundColor: isDark
        ? 'rgba(12,66,67,0.18)'
        : 'rgba(12,66,67,0.06)',
    },
    quickMenuGlyph: {
      position: 'relative',
      width: 22,
      height: 22,
    },
    quickMenuTile: {
      position: 'absolute',
      width: 8,
      height: 8,
      borderRadius: 3,
      backgroundColor: floatingIcon,
    },
    quickMenuTileOne: {
      top: 2,
      left: 2,
    },
    quickMenuTileTwo: {
      top: 2,
      right: 2,
      backgroundColor: floatingIconSoft,
    },
    quickMenuTileThree: {
      bottom: 2,
      left: 2,
      backgroundColor: floatingIconSoft,
    },
    quickMenuTileFour: {
      bottom: 2,
      right: 2,
    },
    planeGlyph: {
      position: 'relative',
      width: 22,
      height: 22,
      transform: [{ rotate: '-18deg' }],
    },
    planeBody: {
      position: 'absolute',
      top: 9,
      left: 2,
      width: 18,
      height: 3,
      borderRadius: 999,
      backgroundColor: floatingIcon,
    },
    planeWingTop: {
      position: 'absolute',
      top: 4,
      left: 8,
      width: 9,
      height: 3,
      borderRadius: 999,
      backgroundColor: floatingIcon,
      transform: [{ rotate: '38deg' }],
    },
    planeWingBottom: {
      position: 'absolute',
      bottom: 5,
      left: 8,
      width: 9,
      height: 3,
      borderRadius: 999,
      backgroundColor: floatingIconSoft,
      transform: [{ rotate: '-38deg' }],
    },
    planeTail: {
      position: 'absolute',
      top: 6,
      left: 1,
      width: 7,
      height: 3,
      borderRadius: 999,
      backgroundColor: floatingIcon,
      transform: [{ rotate: '-42deg' }],
    },
    documentGlyph: {
      position: 'relative',
      width: 18,
      height: 21,
      borderRadius: 5,
      borderWidth: 1.8,
      borderColor: floatingIcon,
      backgroundColor: 'transparent',
    },
    documentFold: {
      position: 'absolute',
      top: -1,
      right: -1,
      width: 7,
      height: 7,
      borderLeftWidth: 1.8,
      borderBottomWidth: 1.8,
      borderColor: floatingIcon,
      borderBottomLeftRadius: 3,
    },
    documentLineOne: {
      position: 'absolute',
      left: 4,
      right: 4,
      top: 10,
      height: 2,
      borderRadius: 999,
      backgroundColor: floatingIconSoft,
    },
    documentLineTwo: {
      position: 'absolute',
      left: 4,
      right: 7,
      top: 15,
      height: 2,
      borderRadius: 999,
      backgroundColor: floatingIcon,
      opacity: 0.82,
    },
    appName: {
      color: C.primaryText,
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
    hero: {
      zIndex: 2,
      position: 'relative',
      overflow: 'hidden',
      padding: 22,
      paddingTop: 24,
      borderRadius: 34,
      backgroundColor: C.heroSurface,
      borderWidth: 1,
      borderColor: C.heroBorder,
      marginBottom: 14,
      ...shadow,
    },
    heroRail: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 7,
      backgroundColor: C.heroAccent,
    },
    heroGlow: {
      position: 'absolute',
      right: -42,
      top: -28,
      width: 142,
      height: 142,
      borderRadius: 71,
      backgroundColor: isDark ? 'rgba(12,66,67,0.16)' : 'rgba(12,66,67,0.16)',
    },
    constellationAccent: {
      top: 0,
      right: -18,
      opacity: isDark ? 0.38 : 0.38,
    },
    heroTopLine: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      marginBottom: 18,
    },
    heroSystemPill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: C.primarySoft,
      borderWidth: 1,
      borderColor: C.border,
    },
    heroSystemPillText: {
      color: C.heroAccent,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    heroSignal: {
      color: C.heroTextMuted,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    greeting: {
      color: C.primaryText,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    userTitle: {
      marginTop: 7,
      color: C.heroText,
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '900',
    },
    heroSubtitle: {
      marginTop: 10,
      color: C.heroTextMuted,
      fontSize: 14,
      lineHeight: 22,
      fontWeight: '700',
    },
    heroInsightPanel: {
      marginTop: 18,
      padding: 14,
      borderRadius: 24,
      backgroundColor: C.heroSurfaceSoft,
      borderWidth: 1,
      borderColor: C.border,
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 14,
    },
    heroInsightPrimary: {
      flex: 1.35,
      minWidth: 0,
    },
    heroInsightSecondary: {
      flex: 0.9,
      minWidth: 0,
      justifyContent: 'center',
    },
    heroInsightDivider: {
      width: 1,
      alignSelf: 'stretch',
      borderRadius: 999,
      backgroundColor: C.border,
    },
    heroInsightLabel: {
      color: C.heroTextMuted,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.9,
      textTransform: 'uppercase',
    },
    heroInsightValue: {
      marginTop: 6,
      color: C.heroText,
      fontSize: 17,
      lineHeight: 21,
      fontWeight: '900',
    },
    heroInsightDetail: {
      marginTop: 4,
      color: C.heroTextMuted,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: '700',
    },
    heroInsightStatus: {
      marginTop: 6,
      color: C.heroTextMuted,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '900',
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
      backgroundColor: C.heroSurfaceSoft,
      borderWidth: 1,
      borderColor: C.border,
    },
    heroMetaLabel: {
      color: C.heroTextMuted,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    heroMetaValue: {
      marginTop: 2,
      color: C.heroAccent,
      fontSize: 13,
      fontWeight: '900',
      textTransform: 'capitalize',
    },
    wearableCard: {
      zIndex: 2,
      position: 'relative',
      overflow: 'hidden',
      padding: 18,
      paddingTop: 20,
      borderRadius: 28,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(94,234,212,0.36)' : 'rgba(34,184,176,0.20)',
      marginBottom: 16,
      ...shadow,
    },
    wearableTopRule: {
      position: 'absolute',
      left: 18,
      right: 18,
      top: 0,
      height: 3,
      borderRadius: 999,
      backgroundColor: C.teal,
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
      color: C.primaryText,
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
      color: C.primaryText,
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
      ...shadow,
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
      backgroundColor: C.actionFill,
    },
    alertPrimaryButtonText: {
      color: C.actionText,
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
      ...shadow,
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
    focusPanel: {
      zIndex: 2,
      position: 'relative',
      overflow: 'hidden',
      padding: 16,
      borderRadius: 28,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 16,
      ...shadow,
    },
    focusHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 13,
    },
    focusTitle: {
      color: C.text,
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '900',
    },
    focusBadge: {
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: C.primarySoft,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(56,189,248,0.30)' : 'rgba(10,87,164,0.16)',
    },
    focusBadgeText: {
      color: C.primaryText,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    focusList: {
      gap: 10,
    },
    focusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 13,
      paddingHorizontal: 13,
      borderRadius: 22,
      backgroundColor: C.surfaceSoft,
      borderWidth: 1,
      borderColor: C.border,
    },
    focusRowDisabled: {
      opacity: 0.72,
    },
    focusIndex: {
      width: 42,
      height: 42,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    focusIndexText: {
      fontSize: 12,
      fontWeight: '900',
    },
    focusCopy: {
      flex: 1,
      minWidth: 0,
    },
    focusEyebrow: {
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    focusRowTitle: {
      marginTop: 3,
      color: C.text,
      fontSize: 15,
      lineHeight: 19,
      fontWeight: '900',
    },
    focusRowDetail: {
      marginTop: 4,
      color: C.textMuted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '700',
    },
    focusArrowBox: {
      width: 34,
      height: 34,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    statusPanel: {
      zIndex: 2,
      position: 'relative',
      overflow: 'hidden',
      padding: 15,
      borderRadius: 26,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 16,
      ...shadow,
    },
    statusHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 12,
    },
    statusLivePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: C.surfaceSoft,
      borderWidth: 1,
      borderColor: C.border,
    },
    statusLiveDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: C.teal,
    },
    statusLiveText: {
      color: C.textMuted,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    statusCompactCard: {
      position: 'relative',
      overflow: 'hidden',
      padding: 14,
      borderRadius: 22,
      backgroundColor: C.surfaceSoft,
      borderWidth: 1,
      borderColor: C.border,
    },
    statusCompactRail: {
      position: 'absolute',
      left: 0,
      top: 14,
      bottom: 14,
      width: 5,
      borderTopRightRadius: 999,
      borderBottomRightRadius: 999,
      backgroundColor: C.teal,
    },
    statusCompactIntro: {
      paddingLeft: 7,
      marginBottom: 12,
    },
    statusCompactTitle: {
      color: C.text,
      fontSize: 15,
      lineHeight: 19,
      fontWeight: '900',
    },
    statusCompactText: {
      marginTop: 3,
      color: C.textMuted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '700',
    },
    statusCompactGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 9,
    },
    statusCompactItem: {
      width: '48.5%',
      minHeight: 86,
      padding: 11,
      borderRadius: 18,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    statusCompactDot: {
      width: 26,
      height: 5,
      borderRadius: 999,
      marginBottom: 8,
    },
    statusCompactLabel: {
      color: C.textMuted,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    statusCompactValue: {
      marginTop: 3,
      fontSize: 15,
      lineHeight: 19,
      fontWeight: '900',
    },
    statusCompactDetail: {
      marginTop: 2,
      color: C.textMuted,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '700',
    },
    statusCommandCard: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'stretch',
    },
    statusCommandMain: {
      flex: 1.1,
      minHeight: 172,
      padding: 17,
      borderRadius: 26,
      backgroundColor: C.primarySoft,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(94,234,212,0.22)' : 'rgba(10,87,164,0.14)',
      justifyContent: 'space-between',
    },
    statusCommandLabel: {
      color: C.primaryText,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.9,
    },
    statusCommandValue: {
      color: C.text,
      fontSize: 52,
      lineHeight: 56,
      fontWeight: '900',
      letterSpacing: -1,
      marginTop: 8,
    },
    statusCommandText: {
      color: C.textMuted,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '700',
      marginTop: 3,
    },
    statusCommandTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
      marginTop: 13,
    },
    statusCommandTrackFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: C.primary,
    },
    statusMetricRail: {
      flex: 0.9,
      gap: 10,
    },
    statusBottomStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 12,
      padding: 13,
      borderRadius: 22,
      backgroundColor: C.surfaceSoft,
      borderWidth: 1,
      borderColor: C.border,
    },
    statusStripItem: {
      flex: 1,
      minWidth: 0,
    },
    statusStripDivider: {
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: C.border,
    },
    statusStripLabel: {
      color: C.textMuted,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    statusStripValue: {
      color: C.text,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '900',
      marginTop: 3,
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
    statusCard: {
      flex: 1,
      minHeight: 81,
      padding: 12,
      borderRadius: 22,
      backgroundColor: C.surfaceSoft,
      borderWidth: 1,
      borderColor: C.border,
    },
    statusAccentDot: {
      width: 28,
      height: 5,
      borderRadius: 999,
      marginBottom: 8,
    },
    statusValue: {
      color: C.text,
      fontSize: 16,
      fontWeight: '900',
    },
    statusLabel: {
      marginTop: 2,
      color: C.textMuted,
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    statusDetail: {
      marginTop: 4,
      color: C.textMuted,
      fontSize: 10,
      lineHeight: 14,
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
    moduleSectionFrame: {
      position: 'relative',
      overflow: 'hidden',
      padding: 17,
      borderRadius: 30,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      ...shadow,
    },
    moduleSectionWash: {
      position: 'absolute',
      top: -62,
      right: -58,
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: C.primarySoft,
      opacity: isDark ? 0.36 : 0.72,
    },
    moduleSectionHeader: {
      zIndex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
    },
    moduleSectionIdentity: {
      flex: 1,
      minWidth: 0,
    },
    moduleSectionKickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 7,
    },
    moduleSectionDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
    },
    moduleSectionKicker: {
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.9,
    },
    moduleSectionCopy: {
      flex: 1,
      minWidth: 0,
    },
    moduleSectionTitle: {
      color: C.text,
      fontSize: 24,
      lineHeight: 28,
      fontWeight: '900',
      letterSpacing: -0.1,
    },
    moduleSectionSubtitle: {
      marginTop: 4,
      color: C.textMuted,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '700',
    },
    moduleSectionMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    moduleSectionCount: {
      minWidth: 68,
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderRadius: 19,
      backgroundColor: C.surfaceSoft,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
    },
    moduleSectionCountValue: {
      color: C.primary,
      fontSize: 18,
      fontWeight: '900',
    },
    moduleSectionCountLabel: {
      color: C.textMuted,
      fontSize: 9,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    moduleSectionToggle: {
      width: 42,
      height: 42,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.surfaceSoft,
      borderWidth: 1,
      borderColor: C.border,
    },
    moduleSectionToggleOpen: {
      backgroundColor: C.primarySoft,
      borderColor: isDark ? 'rgba(94,234,212,0.24)' : 'rgba(10,87,164,0.14)',
    },
    moduleChevron: {
      width: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moduleChevronOpen: {
      transform: [{ rotate: '0deg' }],
    },
    moduleChevronClosed: {
      transform: [{ rotate: '-90deg' }],
    },
    moduleChevronStroke: {
      position: 'absolute',
      top: 8,
      width: 10,
      height: 3,
      borderRadius: 999,
      backgroundColor: C.primary,
    },
    moduleChevronLeft: {
      left: 2,
      transform: [{ rotate: '45deg' }],
    },
    moduleChevronRight: {
      right: 2,
      transform: [{ rotate: '-45deg' }],
    },
    moduleSectionTrack: {
      zIndex: 1,
      height: 6,
      borderRadius: 999,
      backgroundColor: C.surfaceSoft,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
      marginTop: 14,
    },
    moduleSectionTrackFill: {
      height: '100%',
      borderRadius: 999,
      opacity: isDark ? 0.9 : 1,
    },
    moduleList: {
      zIndex: 1,
      marginTop: 14,
      gap: 10,
    },
    moduleRow: {
      position: 'relative',
      minHeight: 86,
      paddingVertical: 13,
      paddingLeft: 14,
      paddingRight: 10,
      backgroundColor: C.surfaceSoft,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
    },
    moduleRowFirst: {
      paddingTop: 15,
    },
    moduleRowLast: {
      paddingBottom: 15,
    },
    moduleLeadingRail: {
      position: 'absolute',
      left: 0,
      top: 12,
      bottom: 12,
      width: 5,
      borderTopRightRadius: 999,
      borderBottomRightRadius: 999,
    },
    moduleStep: {
      width: 38,
      alignItems: 'center',
      gap: 6,
    },
    moduleStepNumber: {
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: -0.2,
    },
    moduleStepLine: {
      width: 30,
      height: 5,
      borderRadius: 999,
      opacity: 0.72,
    },
    moduleTextBlock: {
      flex: 1,
      minWidth: 0,
    },
    moduleTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
    },
    moduleBadge: {
      flexShrink: 0,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    moduleBadgeText: {
      color: C.textMuted,
      fontSize: 9,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    moduleTitle: {
      flexShrink: 1,
      color: C.text,
      fontSize: 17,
      lineHeight: 21,
      fontWeight: '900',
    },
    moduleSubtitle: {
      color: C.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 6,
      fontWeight: '700',
    },
    moduleActionPill: {
      width: 44,
      height: 44,
      borderRadius: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: C.primarySoft,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(94,234,212,0.24)' : 'rgba(10,87,164,0.14)',
    },
    moduleActionPillText: {
      color: C.primary,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    moduleActionGlyph: {
      width: 12,
      height: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moduleActionStroke: {
      position: 'absolute',
      right: 1,
      width: 8,
      height: 2,
      borderRadius: 999,
      backgroundColor: C.primary,
    },
    moduleActionStrokeTop: {
      top: 3,
      transform: [{ rotate: '45deg' }],
    },
    moduleActionStrokeBottom: {
      bottom: 3,
      transform: [{ rotate: '-45deg' }],
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
      color: C.primaryText,
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
      color: C.primaryText,
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
      color: C.primaryText,
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
