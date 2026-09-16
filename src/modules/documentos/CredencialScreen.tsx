import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../services/api';
import { usePrivateMediaUri } from '../../hooks/usePrivateMediaUri';
import { sharePrivateMedia } from '../../services/privateMedia';
import { useAuth } from '../../contexts/AuthContext';

export default function CredencialScreen() {
  const { user, updateUser, theme, token } = useAuth();

  const isDark = theme === 'dark';
  const styles = getStyles(isDark);
  const colors = getColors(isDark);

  const [loading, setLoading] = useState(false);
  const [credencialUrl, setCredencialUrl] = useState(user?.credencial_url || '');

  const finalCredencialUrl =
    credencialUrl || user?.credencial_url || '';

  const { localUri: fotoLocalUri } = usePrivateMediaUri(
    user?.foto_perfil_url,
    token
  );

  const {
    localUri: credencialLocalUri,
    loading: loadingCredencialPreview,
  } = usePrivateMediaUri(
    finalCredencialUrl,
    token
  );

  useEffect(() => {
    setCredencialUrl(user?.credencial_url || '');
  }, [user?.credencial_url]);

  async function generateCredential() {
    if (!user?.id) return;

    try {
      setLoading(true);

      const { data } = await api.post(`/documentos/usuarios/${user.id}/credencial-imagen`);
      const url = data?.credencial_url || '';

      if (url) {
        setCredencialUrl(url);
        await updateUser({ credencial_url: url });
      }

      Alert.alert('Credencial generada', 'La credencial digital se generó correctamente.');
    } catch (e: any) {
      Alert.alert(
        'No se pudo generar',
        e?.response?.data?.message || 'Valida que el usuario tenga contrato registrado.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function openCredential() {
    if (!finalCredencialUrl) {
      Alert.alert(
        'Sin credencial',
        'Este usuario aún no tiene credencial generada.'
      );
      return;
    }

    try {
      await sharePrivateMedia(
        finalCredencialUrl,
        token,
        'SMART RH - Credencial'
      );
    } catch (error) {
      Alert.alert(
        'No se pudo abrir',
        error instanceof Error
          ? error.message
          : 'No se pudo abrir la credencial.'
      );
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Identificación digital</Text>
          <Text style={styles.title}>Credencial del empleado</Text>
          <Text style={styles.subtitle}>
            Consulta tu credencial generada desde SMART RH o genera una nueva versión actualizada.
          </Text>
        </View>

        <View style={styles.employeeCard}>
          <View style={styles.avatar}>
            {fotoLocalUri ? (
              <Image source={{ uri: fotoLocalUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{user?.nombre?.[0]?.toUpperCase() || 'S'}</Text>
            )}
          </View>

          <View style={styles.employeeInfo}>
            <Text style={styles.name}>
              {user?.nombre} {user?.apellido}
            </Text>
            <Text style={styles.meta}>{user?.correo}</Text>
            <Text style={styles.meta}>Rol: {user?.role}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Credencial generada</Text>
              <Text style={styles.cardText}>
                Archivo de identificación digital vinculado al usuario.
              </Text>
            </View>

            <View style={finalCredencialUrl ? styles.statusOk : styles.statusPending}>
              <Text style={finalCredencialUrl ? styles.statusOkText : styles.statusPendingText}>
                {finalCredencialUrl ? 'Disponible' : 'Pendiente'}
              </Text>
            </View>
          </View>

          {finalCredencialUrl ? (
            <View style={styles.previewBox}>
              {loadingCredencialPreview ? (
                <ActivityIndicator color={colors.primary} />
              ) : credencialLocalUri ? (
                <Image
                  source={{ uri: credencialLocalUri }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.emptyText}>
                  No se pudo cargar la vista previa.
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No hay credencial generada para este usuario.</Text>
            </View>
          )}

          <View style={styles.actions}>
            <Pressable style={styles.button} onPress={generateCredential} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>
                  {finalCredencialUrl ? 'Generar nueva credencial' : 'Generar credencial'}
                </Text>
              )}
            </Pressable>

            <Pressable
              style={[styles.buttonSecondary, !finalCredencialUrl && styles.buttonDisabled]}
              onPress={openCredential}
              disabled={!finalCredencialUrl}
            >
              <Text style={styles.buttonSecondaryText}>Ver credencial</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    muted: isDark ? '#9FB0C4' : '#5B6B81',
    border: isDark ? '#26364D' : '#D9E1EC',
  };
}

function getStyles(isDark: boolean) {
  const COLORS = getColors(isDark);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    container: { padding: 20, gap: 16, paddingBottom: 40, backgroundColor: COLORS.background },

    hero: {
      backgroundColor: isDark ? '#0A57A4' : COLORS.primary,
      borderRadius: 30,
      padding: 24,
    },
    eyebrow: {
      color: 'rgba(255,255,255,0.78)',
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    title: {
      marginTop: 8,
      color: '#FFFFFF',
      fontWeight: '900',
      fontSize: 30,
    },
    subtitle: {
      marginTop: 10,
      color: 'rgba(255,255,255,0.82)',
      lineHeight: 22,
    },

    employeeCard: {
      backgroundColor: COLORS.card,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    avatar: {
      width: 76,
      height: 76,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(45,212,191,0.14)' : 'rgba(34,184,176,0.14)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarText: {
      color: COLORS.teal,
      fontWeight: '900',
      fontSize: 30,
    },
    employeeInfo: { flex: 1 },
    name: { color: COLORS.text, fontWeight: '900', fontSize: 18 },
    meta: { marginTop: 5, color: COLORS.muted, fontWeight: '600' },

    card: {
      backgroundColor: COLORS.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      alignItems: 'flex-start',
    },
    cardTitle: { color: COLORS.text, fontWeight: '900', fontSize: 20 },
    cardText: { marginTop: 8, color: COLORS.muted, lineHeight: 22, maxWidth: 250 },

    statusOk: {
      backgroundColor: isDark ? 'rgba(45,212,191,0.14)' : 'rgba(34,184,176,0.14)',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    statusOkText: { color: COLORS.teal, fontWeight: '900', fontSize: 12 },
    statusPending: {
      backgroundColor: isDark ? 'rgba(159,176,196,0.12)' : 'rgba(91,107,129,0.12)',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    statusPendingText: { color: COLORS.muted, fontWeight: '900', fontSize: 12 },

    previewBox: {
      marginTop: 18,
      backgroundColor: COLORS.cardSoft,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 12,
      height: 420,
    },
    previewImage: {
      width: '100%',
      height: '100%',
    },
    emptyBox: {
      marginTop: 18,
      backgroundColor: COLORS.cardSoft,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    emptyText: {
      color: COLORS.muted,
      fontWeight: '700',
      textAlign: 'center',
    },

    actions: { marginTop: 18, gap: 12 },
    button: {
      backgroundColor: COLORS.primary,
      borderRadius: 16,
      padding: 15,
      alignItems: 'center',
    },
    buttonText: { color: '#FFF', fontWeight: '900' },
    buttonSecondary: {
      backgroundColor: isDark ? 'rgba(56,189,248,0.14)' : 'rgba(10,87,164,0.10)',
      borderRadius: 16,
      padding: 15,
      alignItems: 'center',
    },
    buttonSecondaryText: { color: COLORS.primary, fontWeight: '900' },
    buttonDisabled: { opacity: 0.5 },
  });
}