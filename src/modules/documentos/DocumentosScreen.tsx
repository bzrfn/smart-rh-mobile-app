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

type Contrato = {
  id: number;
  usuario_id: number;
  contrato_pdf_url?: string | null;
  tipo_contrato?: string;
  salario_base?: number;
  fecha_inicio?: string;
  fecha_fin?: string | null;
  estado?: string;
};

export default function DocumentosScreen() {
  const { user, updateUser, theme, token } = useAuth();

  const isDark = theme === 'dark';
  const styles = getStyles(isDark);
  const colors = getColors(isDark);

  const [loadingContrato, setLoadingContrato] = useState(false);
  const [loadingCredencial, setLoadingCredencial] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [contratoUrl, setContratoUrl] = useState('');
  const [credencialUrl, setCredencialUrl] = useState(user?.credencial_url || '');

  const { localUri: fotoPerfilLocalUri } = usePrivateMediaUri(
    user?.foto_perfil_url,
    token
  );

  async function loadContrato() {
    try {
      setLoadingData(true);

      const { data } = await api.get('/contratos/me');
      const list = Array.isArray(data?.contratos) ? data.contratos : [];

      const latest = [...list].sort(
        (a: Contrato, b: Contrato) => Number(b.id) - Number(a.id)
      )[0];

      setContrato(latest || null);
      setContratoUrl(latest?.contrato_pdf_url || '');
    } catch {
      setContrato(null);
      setContratoUrl('');
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    loadContrato();
  }, []);

  useEffect(() => {
    setCredencialUrl(user?.credencial_url || '');
  }, [user?.credencial_url]);

  async function generateContract() {
    if (!user?.id) return;

    try {
      setLoadingContrato(true);

      const { data } = await api.post(`/documentos/usuarios/${user.id}/contrato-pdf`);
      const url = data?.contrato_pdf_url || '';

      if (url) setContratoUrl(url);
      await loadContrato();

      Alert.alert('Contrato generado', 'El contrato PDF se generó correctamente.');
    } catch (e: any) {
      Alert.alert(
        'Contrato pendiente',
        e?.response?.data?.message || 'Primero debe existir un contrato registrado.'
      );
    } finally {
      setLoadingContrato(false);
    }
  }

  async function generateCredential() {
    if (!user?.id) return;

    try {
      setLoadingCredencial(true);

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
      setLoadingCredencial(false);
    }
  }

  async function openUrl(url?: string | null, emptyMessage?: string) {
    if (!url) {
      Alert.alert('Sin documento', emptyMessage || 'Documento no disponible.');
      return;
    }

    try {
      await sharePrivateMedia(
        url,
        token,
        'SMART RH - Documento'
      );
    } catch (error) {
      Alert.alert(
        'No se pudo abrir',
        error instanceof Error
          ? error.message
          : 'No se pudo abrir el documento.'
      );
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Expediente digital</Text>
          <Text style={styles.title}>Documentación laboral</Text>
          <Text style={styles.subtitle}>
            Consulta y genera documentos vinculados a tu perfil laboral dentro de SMART RH.
          </Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            {fotoPerfilLocalUri ? (
              <Image source={{ uri: fotoPerfilLocalUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {user?.nombre?.[0]?.toUpperCase() || 'S'}
              </Text>
            )}
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {user?.nombre} {user?.apellido}
            </Text>
            <Text style={styles.profileMeta}>{user?.correo}</Text>
            <Text style={styles.profileMeta}>Rol: {user?.role}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Contrato laboral</Text>
              <Text style={styles.cardText}>
                PDF membretado generado desde backend con trazabilidad en MongoDB.
              </Text>
            </View>

            <StatusBadge available={Boolean(contratoUrl)} styles={styles} />
          </View>

          {loadingData ? (
            <LoadingBox text="Consultando contrato..." styles={styles} colors={colors} />
          ) : (
            <>
              <View style={styles.infoGrid}>
                <Info styles={styles} label="Tipo" value={contrato?.tipo_contrato || 'No registrado'} />
                <Info
                  styles={styles}
                  label="Salario"
                  value={
                    contrato?.salario_base
                      ? `$${Number(contrato.salario_base).toFixed(2)}`
                      : 'No registrado'
                  }
                />
                <Info styles={styles} label="Estado" value={contrato?.estado || 'No registrado'} />
                <Info styles={styles} label="Inicio" value={formatDate(contrato?.fecha_inicio)} />
              </View>

              <View style={styles.actions}>
                <Pressable style={styles.button} onPress={generateContract} disabled={loadingContrato}>
                  <Text style={styles.buttonText}>
                    {loadingContrato
                      ? 'Generando...'
                      : contratoUrl
                      ? 'Generar nuevo contrato'
                      : 'Generar contrato PDF'}
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.buttonSecondary, !contratoUrl && styles.buttonDisabled]}
                  onPress={() =>
                    openUrl(contratoUrl, 'Este usuario aún no tiene contrato PDF generado.')
                  }
                  disabled={!contratoUrl}
                >
                  <Text style={styles.buttonSecondaryText}>Ver contrato generado</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Credencial digital</Text>
              <Text style={styles.cardText}>
                Imagen institucional del empleado generada desde el backend.
              </Text>
            </View>

            <StatusBadge available={Boolean(credencialUrl)} styles={styles} />
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.button} onPress={generateCredential} disabled={loadingCredencial}>
              <Text style={styles.buttonText}>
                {loadingCredencial
                  ? 'Generando...'
                  : credencialUrl
                  ? 'Generar nueva credencial'
                  : 'Generar credencial'}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.buttonSecondary, !credencialUrl && styles.buttonDisabled]}
              onPress={() =>
                openUrl(credencialUrl, 'Este usuario aún no tiene credencial generada.')
              }
              disabled={!credencialUrl}
            >
              <Text style={styles.buttonSecondaryText}>Ver credencial generada</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusBadge({ available, styles }: { available: boolean; styles: any }) {
  return (
    <View style={available ? styles.statusOk : styles.statusPending}>
      <Text style={available ? styles.statusOkText : styles.statusPendingText}>
        {available ? 'Disponible' : 'Pendiente'}
      </Text>
    </View>
  );
}

function LoadingBox({ text, styles, colors }: { text: string; styles: any; colors: any }) {
  return (
    <View style={styles.loadingBox}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.loadingText}>{text}</Text>
    </View>
  );
}

function Info({ label, value, styles }: { label: string; value: string; styles: any }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function formatDate(value?: string | null) {
  if (!value) return 'No registrada';
  return String(value).slice(0, 10);
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

    profileCard: {
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
      width: 74,
      height: 74,
      borderRadius: 24,
      backgroundColor: isDark ? 'rgba(45,212,191,0.14)' : 'rgba(34,184,176,0.14)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
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
    profileInfo: { flex: 1 },
    profileName: { color: COLORS.text, fontWeight: '900', fontSize: 18 },
    profileMeta: { marginTop: 5, color: COLORS.muted, fontWeight: '600' },

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
    cardText: { marginTop: 8, color: COLORS.muted, lineHeight: 22 },

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

    loadingBox: {
      marginTop: 18,
      padding: 18,
      borderRadius: 18,
      backgroundColor: COLORS.cardSoft,
      alignItems: 'center',
    },
    loadingText: { marginTop: 8, color: COLORS.muted, fontWeight: '700' },

    infoGrid: {
      marginTop: 18,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    infoBox: {
      width: '48%',
      backgroundColor: COLORS.cardSoft,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 12,
    },
    infoLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '900' },
    infoValue: { marginTop: 5, color: COLORS.text, fontWeight: '800' },

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