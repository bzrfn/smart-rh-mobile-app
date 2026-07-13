import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

type Props = {
  navigation: any;
  route: {
    params?: {
      correo?: string;
    };
  };
};

export default function VerifyAccountScreen({ navigation, route }: Props) {
  const { setAuth, theme } = useAuth();

  const correo = route?.params?.correo || '';
  const isDark = theme === 'dark';
  const COLORS = getColors(isDark);
  const styles = getStyles(COLORS, isDark);

  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);

  async function onVerifyAccount() {
    if (loading) return;

    if (!correo || !codigo.trim()) {
      Alert.alert('Código requerido', 'Ingresa el código enviado a tu correo.');
      return;
    }

    try {
      setLoading(true);

      const { data } = await api.post('/auth/verify-account', {
        correo,
        codigo: codigo.trim(),
      });

      if (!data?.ok || !data?.token || !data?.user) {
        Alert.alert('Error', data?.message ?? 'No se pudo confirmar la cuenta.');
        return;
      }

      Alert.alert('Cuenta confirmada', data?.message ?? 'Tu cuenta fue activada correctamente.');
      await setAuth(data.token, data.user);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? e?.message ?? 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <View style={styles.shapeTopLeftLarge} />
            <View style={styles.shapeBottomRightLarge} />

            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>SMART RH</Text>
                </View>

                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>Confirmación</Text>
                </View>
              </View>

              <Text style={styles.eyebrow}>Cuenta nueva</Text>
              <Text style={styles.heroTitle}>Confirma tu correo</Text>
              <Text style={styles.heroSubtitle}>
                Enviamos un código de verificación a tu email. Escríbelo para activar tu cuenta.
              </Text>

              <View style={styles.emailBox}>
                <Text style={styles.emailText}>{correo || 'correo@empresa.com'}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Código de confirmación</Text>
              <Text style={styles.cardDescription}>
                Ingresa el código de 6 dígitos para activar tu cuenta.
              </Text>

              <TextInput
                value={codigo}
                onChangeText={(text) => setCodigo(text.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="000000"
                placeholderTextColor={COLORS.placeholder}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.codeInput}
              />

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && !loading ? styles.primaryButtonPressed : null,
                  loading ? styles.primaryButtonDisabled : null,
                ]}
                onPress={onVerifyAccount}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Confirmar cuenta</Text>
                )}
              </Pressable>

              <Pressable onPress={() => navigation.navigate('Login')}>
                <Text style={styles.secondaryAction}>Volver al login</Text>
              </Pressable>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getColors(isDark: boolean) {
  return {
    background: isDark ? '#07111F' : '#F4F7FB',
    card: isDark ? '#0F1B2D' : '#FFFFFF',
    cardSoft: isDark ? '#111F33' : '#F9FBFD',
    primary: isDark ? '#38BDF8' : '#0A57A4',
    primaryDark: isDark ? '#0EA5E9' : '#084785',
    primarySoft: isDark ? 'rgba(56,189,248,0.14)' : 'rgba(10,87,164,0.10)',
    teal: isDark ? '#2DD4BF' : '#22B8B0',
    tealBg: isDark ? 'rgba(45,212,191,0.14)' : 'rgba(34,184,176,0.12)',
    text: isDark ? '#F8FAFC' : '#0F172A',
    textMuted: isDark ? '#9FB0C4' : '#5B6B81',
    border: isDark ? '#26364D' : '#D9E1EC',
    placeholder: isDark ? '#71839B' : '#8B9AAF',
  };
}

function getStyles(COLORS: ReturnType<typeof getColors>, isDark: boolean) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    keyboard: { flex: 1 },
    container: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 22,
      paddingTop: 28,
      paddingBottom: 36,
      backgroundColor: COLORS.background,
      overflow: 'hidden',
    },
    heroCard: {
      zIndex: 2,
      backgroundColor: COLORS.card,
      borderRadius: 30,
      padding: 24,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.28 : 0.09,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
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
    heroTitle: {
      fontSize: 30,
      fontWeight: '900',
      color: COLORS.primary,
    },
    heroSubtitle: {
      marginTop: 12,
      fontSize: 15,
      color: COLORS.textMuted,
      lineHeight: 24,
    },
    emailBox: {
      marginTop: 16,
      padding: 14,
      borderRadius: 18,
      backgroundColor: COLORS.cardSoft,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    emailText: {
      color: COLORS.text,
      fontSize: 14,
      fontWeight: '900',
    },
    card: {
      zIndex: 2,
      backgroundColor: COLORS.card,
      borderRadius: 28,
      paddingHorizontal: 22,
      paddingVertical: 24,
      borderWidth: 1,
      borderColor: COLORS.border,
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    cardTitle: {
      fontSize: 24,
      fontWeight: '900',
      color: COLORS.text,
      textAlign: 'center',
    },
    cardDescription: {
      marginTop: 8,
      marginBottom: 20,
      fontSize: 14,
      color: COLORS.textMuted,
      textAlign: 'center',
      lineHeight: 21,
    },
    codeInput: {
      height: 66,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.cardSoft,
      paddingHorizontal: 16,
      fontSize: 28,
      fontWeight: '900',
      color: COLORS.text,
      textAlign: 'center',
      letterSpacing: 8,
      marginBottom: 16,
    },
    primaryButton: {
      height: 58,
      borderRadius: 20,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: COLORS.primary,
      shadowOpacity: 0.28,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    primaryButtonPressed: {
      transform: [{ scale: 0.99 }],
      backgroundColor: COLORS.primaryDark,
    },
    primaryButtonDisabled: { opacity: 0.85 },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '900',
    },
    secondaryAction: {
      marginTop: 18,
      textAlign: 'center',
      color: COLORS.teal,
      fontWeight: '900',
      fontSize: 14,
    },
    shapeTopLeftLarge: {
      position: 'absolute',
      top: -70,
      left: -95,
      width: 230,
      height: 230,
      borderRadius: 115,
      backgroundColor: COLORS.primary,
      opacity: isDark ? 0.16 : 0.12,
    },
    shapeBottomRightLarge: {
      position: 'absolute',
      bottom: -90,
      right: -90,
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: COLORS.primary,
      opacity: isDark ? 0.16 : 0.12,
    },
  });
}