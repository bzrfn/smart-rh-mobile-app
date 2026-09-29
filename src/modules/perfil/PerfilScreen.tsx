import React, { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { deletePrivateMedia, downloadPrivateMedia } from '../../services/privateMedia';

type Props = {
  navigation: any;
};

type StatusType = 'complete' | 'pending' | 'neutral';

function formatDate(value?: string | null) {
  if (!value) return 'No registrado';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function getInitials(nombre?: string, apellido?: string) {
  const n = nombre?.trim()?.[0] || '';
  const a = apellido?.trim()?.[0] || '';

  return `${n}${a}`.toUpperCase() || 'SRH';
}

export default function PerfilScreen({ navigation }: Props) {
  const { user, permisos, theme, toggleTheme, logout, token } = useAuth();

  const isDark = theme === 'dark';
  const styles = getStyles(isDark);

  const [photoLocalUri, setPhotoLocalUri] = useState('');
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);

  const hasPhoto = Boolean(user?.foto_perfil_url);

  useEffect(() => {
    let active = true;
    let downloadedUri = '';

    async function loadProfilePhoto() {
      setPhotoLocalUri('');
      setPhotoLoadFailed(false);

      if (!user?.foto_perfil_url || !token) return;

      try {
        downloadedUri = await downloadPrivateMedia(
          user.foto_perfil_url,
          token
        );

        if (active) {
          setPhotoLocalUri(downloadedUri);
        }
      } catch (error) {
        console.log(
          '[SMART RH] No se pudo cargar la foto de perfil.',
          error instanceof Error ? error.message : 'Error desconocido'
        );

        if (active) {
          setPhotoLoadFailed(true);
        }
      }
    }

    loadProfilePhoto();

    return () => {
      active = false;

      if (downloadedUri) {
        deletePrivateMedia(downloadedUri);
      }
    };
  }, [user?.foto_perfil_url, token]);
  const hasCredential = Boolean(user?.credencial_url);
  const vacaciones = Number(user?.dias_vacaciones_disponibles ?? 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            {photoLocalUri && !photoLoadFailed ? (
              <Image
                source={{ uri: photoLocalUri }}
                style={styles.avatarImage}
                onError={() => setPhotoLoadFailed(true)}
              />
            ) : (
              <Text style={styles.avatarText}>
                {getInitials(user?.nombre, user?.apellido)}
              </Text>
            )}
          </View>

          <View style={styles.heroText}>
            <Text style={styles.eyebrow}>Expediente personal</Text>
            <Text style={styles.title}>
              {user?.nombre} {user?.apellido}
            </Text>
            <Text style={styles.subtitle}>{user?.correo}</Text>

            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{user?.role || 'usuario'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatusCard
            title="Foto"
            value={hasPhoto ? 'Lista' : 'Pendiente'}
            detail={hasPhoto ? 'Imagen registrada.' : 'Sin foto de perfil.'}
            status={hasPhoto ? 'complete' : 'pending'}
            styles={styles}
          />

          <StatusCard
            title="Credencial"
            value={hasCredential ? 'Lista' : 'Pendiente'}
            detail={hasCredential ? 'Credencial disponible.' : 'Requiere generación.'}
            status={hasCredential ? 'complete' : 'pending'}
            styles={styles}
          />

          <StatusCard
            title="Vacaciones"
            value={String(vacaciones)}
            detail="Días disponibles."
            status="neutral"
            styles={styles}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Datos personales</Text>
          <Text style={styles.sectionTitle}>Información del empleado</Text>

          <InfoRow label="Nombre completo" value={`${user?.nombre || ''} ${user?.apellido || ''}`} styles={styles} />
          <InfoRow label="Correo electrónico" value={user?.correo || 'No registrado'} styles={styles} />
          <InfoRow label="Rol" value={user?.role || 'No registrado'} styles={styles} />
          <InfoRow label="Teléfono" value={user?.telefono || 'No registrado'} styles={styles} />
          <InfoRow label="Dirección" value={user?.direccion || 'No registrado'} styles={styles} />
          <InfoRow label="Fecha de ingreso" value={formatDate(user?.fecha_ingreso)} styles={styles} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Estado del expediente</Text>
          <Text style={styles.sectionTitle}>Documentación y accesos</Text>

          <DocumentStatus
            title="Foto de perfil"
            detail={hasPhoto ? 'La foto está vinculada al expediente.' : 'La foto aún no está registrada.'}
            status={hasPhoto ? 'complete' : 'pending'}
            styles={styles}
          />

          <DocumentStatus
            title="Credencial digital"
            detail={hasCredential ? 'Existe una credencial digital disponible.' : 'Aún no se detecta credencial digital.'}
            status={hasCredential ? 'complete' : 'pending'}
            styles={styles}
          />

          <DocumentStatus
            title="Asistencia"
            detail={permisos.asistencia ? 'Módulo habilitado para el usuario.' : 'Módulo bloqueado para el usuario.'}
            status={permisos.asistencia ? 'complete' : 'pending'}
            styles={styles}
          />

          <DocumentStatus
            title="Contratos"
            detail={permisos.contratos ? 'Consulta contractual habilitada.' : 'Consulta contractual bloqueada.'}
            status={permisos.contratos ? 'complete' : 'pending'}
            styles={styles}
          />

          <DocumentStatus
            title="Nómina"
            detail={permisos.nomina ? 'Consulta de nómina habilitada.' : 'Consulta de nómina bloqueada.'}
            status={permisos.nomina ? 'complete' : 'pending'}
            styles={styles}
          />

          <DocumentStatus
            title="Vacaciones"
            detail={permisos.vacaciones ? 'Solicitud y consulta habilitada.' : 'Módulo de vacaciones bloqueado.'}
            status={permisos.vacaciones ? 'complete' : 'pending'}
            styles={styles}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Accesos rápidos</Text>
          <Text style={styles.sectionTitle}>Acciones del perfil</Text>

          <View style={styles.actionsGrid}>
            <ActionButton label="Documentos" onPress={() => navigation.navigate('Documentos')} styles={styles} />
            <ActionButton label="Credencial" onPress={() => navigation.navigate('Credencial')} styles={styles} />
            <ActionButton label="Actividad" onPress={() => navigation.navigate('Actividad')} styles={styles} />
            <ActionButton label="Notificaciones" onPress={() => navigation.navigate('Notificaciones')} styles={styles} />
          </View>

          <Pressable style={styles.themeButton} onPress={toggleTheme}>
            <Text style={styles.themeButtonText}>
              {isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            </Text>
          </Pressable>

          <Pressable style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: any;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function StatusCard({
  title,
  value,
  detail,
  status,
  styles,
}: {
  title: string;
  value: string;
  detail: string;
  status: StatusType;
  styles: any;
}) {
  const accentStyle =
    status === 'complete'
      ? styles.accentComplete
      : status === 'pending'
        ? styles.accentPending
        : styles.accentNeutral;

  return (
    <View style={styles.statusCard}>
      <View style={[styles.statusAccent, accentStyle]} />
      <Text style={styles.statusValue}>{value}</Text>
      <Text style={styles.statusTitle}>{title}</Text>
      <Text style={styles.statusDetail}>{detail}</Text>
    </View>
  );
}

function DocumentStatus({
  title,
  detail,
  status,
  styles,
}: {
  title: string;
  detail: string;
  status: StatusType;
  styles: any;
}) {
  const badgeStyle =
    status === 'complete'
      ? styles.documentBadgeComplete
      : status === 'pending'
        ? styles.documentBadgePending
        : styles.documentBadgeNeutral;

  const badgeTextStyle =
    status === 'complete'
      ? styles.documentBadgeTextComplete
      : status === 'pending'
        ? styles.documentBadgeTextPending
        : styles.documentBadgeTextNeutral;

  return (
    <View style={styles.documentItem}>
      <View style={styles.documentText}>
        <Text style={styles.documentTitle}>{title}</Text>
        <Text style={styles.documentDetail}>{detail}</Text>
      </View>

      <View style={[styles.documentBadge, badgeStyle]}>
        <Text style={[styles.documentBadgeText, badgeTextStyle]}>
          {status === 'complete' ? 'OK' : status === 'pending' ? 'Pendiente' : 'Info'}
        </Text>
      </View>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  styles,
}: {
  label: string;
  onPress: () => void;
  styles: any;
}) {
  return (
    <Pressable style={styles.actionButton} onPress={onPress}>
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
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
    danger: '#D64545',
    dangerBg: 'rgba(214,69,69,0.12)',
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
      flexDirection: 'row',
      gap: 16,
      alignItems: 'center',
      elevation: 4,
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 28,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.cardSoft,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    avatarText: {
      color: COLORS.primary,
      fontSize: 26,
      fontWeight: '900',
    },
    heroText: {
      flex: 1,
    },
    eyebrow: {
      color: COLORS.teal,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    title: {
      color: COLORS.primary,
      fontSize: 27,
      fontWeight: '900',
      lineHeight: 32,
    },
    subtitle: {
      color: COLORS.textMuted,
      fontSize: 14,
      marginTop: 6,
      lineHeight: 20,
    },
    roleBadge: {
      alignSelf: 'flex-start',
      marginTop: 12,
      backgroundColor: COLORS.successBg,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    roleBadgeText: {
      color: COLORS.success,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    statsGrid: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 18,
    },
    statusCard: {
      flex: 1,
      minHeight: 126,
      backgroundColor: COLORS.card,
      borderRadius: 22,
      padding: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      elevation: 3,
    },
    statusAccent: {
      width: 38,
      height: 6,
      borderRadius: 999,
      marginBottom: 12,
    },
    accentComplete: {
      backgroundColor: COLORS.teal,
    },
    accentPending: {
      backgroundColor: COLORS.warning,
    },
    accentNeutral: {
      backgroundColor: COLORS.primary,
    },
    statusValue: {
      color: COLORS.text,
      fontSize: 18,
      fontWeight: '900',
    },
    statusTitle: {
      marginTop: 4,
      color: COLORS.textMuted,
      fontSize: 13,
      fontWeight: '900',
    },
    statusDetail: {
      marginTop: 6,
      color: COLORS.textMuted,
      fontSize: 11,
      lineHeight: 16,
    },
    section: {
      backgroundColor: COLORS.card,
      borderRadius: 26,
      padding: 18,
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
      fontSize: 22,
      fontWeight: '900',
      marginBottom: 14,
    },
    infoRow: {
      borderRadius: 18,
      backgroundColor: COLORS.cardSoft,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 14,
      marginBottom: 10,
    },
    infoLabel: {
      color: COLORS.textMuted,
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    infoValue: {
      color: COLORS.text,
      fontSize: 15,
      fontWeight: '800',
      marginTop: 5,
      lineHeight: 21,
    },
    documentItem: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 18,
      backgroundColor: COLORS.cardSoft,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 14,
      marginBottom: 10,
    },
    documentText: {
      flex: 1,
    },
    documentTitle: {
      color: COLORS.text,
      fontSize: 15,
      fontWeight: '900',
    },
    documentDetail: {
      color: COLORS.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 5,
    },
    documentBadge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    documentBadgeComplete: {
      backgroundColor: COLORS.successBg,
    },
    documentBadgePending: {
      backgroundColor: COLORS.warningBg,
    },
    documentBadgeNeutral: {
      backgroundColor: COLORS.card,
    },
    documentBadgeText: {
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    documentBadgeTextComplete: {
      color: COLORS.success,
    },
    documentBadgeTextPending: {
      color: COLORS.warning,
    },
    documentBadgeTextNeutral: {
      color: COLORS.primary,
    },
    actionsGrid: {
      gap: 12,
      marginBottom: 14,
    },
    actionButton: {
      minHeight: 50,
      borderRadius: 16,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '900',
    },
    themeButton: {
      minHeight: 50,
      borderRadius: 16,
      backgroundColor: COLORS.cardSoft,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
      marginTop: 4,
    },
    themeButtonText: {
      color: COLORS.primary,
      fontSize: 15,
      fontWeight: '900',
    },
    logoutButton: {
      minHeight: 50,
      borderRadius: 16,
      backgroundColor: COLORS.dangerBg,
      borderWidth: 1,
      borderColor: COLORS.danger,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
      marginTop: 12,
    },
    logoutButtonText: {
      color: COLORS.danger,
      fontSize: 15,
      fontWeight: '900',
    },
  });
}