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
};

export default function ForgotPasswordScreen({ navigation }: Props) {
  const { theme } = useAuth();

  const isDark = theme === 'dark';
  const COLORS = getColors(isDark);
  const styles = getStyles(COLORS, isDark);

  const [correo, setCorreo] = useState('');
  const [loading, setLoading] = useState(false);

  const onSend = async () => {
    if (loading) return;

    const correoLimpio = correo.trim().toLowerCase();

    if (!correoLimpio) {
      Alert.alert('Campo requerido', 'Ingresa tu correo.');
      return;
    }

    try {
      setLoading(true);

      const { data } = await api.post('/auth/forgot-password', {
        correo: correoLimpio,
      });

      if (!data?.ok) {
        Alert.alert('Error', data?.message ?? 'No se pudo enviar el código.');
        return;
      }

      Alert.alert(
        'Solicitud recibida',
        data?.message ??
          'Si existe una cuenta asociada a ese correo, se enviará un código de recuperación.',
        [
          {
            text: 'Continuar',
            onPress: () =>
              navigation.navigate('ResetPassword', {
                correo: correoLimpio,
              }),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert(
        'Error',
        e?.response?.data?.message ?? e?.message ?? 'Error de conexión'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.container}>
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
                    <Text style={styles.heroBadgeText}>Recuperación</Text>
                  </View>
                </View>

                <Text style={styles.eyebrow}>Recuperación de acceso</Text>
                <Text style={styles.heroTitle}>Código por correo</Text>
                <Text style={styles.heroSubtitle}>
                  Ingresa tu correo electrónico y SMART RH enviará un código temporal
                  para restablecer tu contraseña.
                </Text>

                <View style={styles.heroInfoCard}>
                  <Text style={styles.heroInfoTitle}>Proceso seguro</Text>
                  <Text style={styles.heroInfoText}>
                    El código se enviará únicamente al correo asociado con tu cuenta.
                  </Text>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Recuperar contraseña</Text>
                <Text style={styles.cardDescription}>
                  Captura tu correo para recibir el código de recuperación.
                </Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Correo</Text>
                  <TextInput
                    value={correo}
                    onChangeText={setCorreo}
                    placeholder="usuario@empresa.com"
                    placeholderTextColor={COLORS.placeholder}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                    style={styles.input}
                  />
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && !loading ? styles.primaryButtonPressed : null,
                    loading ? styles.primaryButtonDisabled : null,
                  ]}
                  onPress={onSend}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Enviar código</Text>
                      <View style={styles.primaryButtonIcon}>
                        <Text style={styles.primaryButtonIconText}>→</Text>
                      </View>
                    </>
                  )}
                </Pressable>

                <Pressable onPress={() => navigation.goBack()}>
                  <Text style={styles.secondaryAction}>Volver al login</Text>
                </Pressable>
              </View>
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
    tealSoft: isDark ? '#14B8A6' : '#67D5CC',
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
    scroll: { flex: 1 },
    scrollContent: { flexGrow: 1 },
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
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.28 : 0.09,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
      borderWidth: 1,
      borderColor: COLORS.border,
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
    heroInfoCard: {
      marginTop: 18,
      backgroundColor: COLORS.cardSoft,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    heroInfoTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: COLORS.text,
    },
    heroInfoText: {
      marginTop: 6,
      fontSize: 14,
      color: COLORS.textMuted,
      lineHeight: 21,
    },
    card: {
      zIndex: 2,
      backgroundColor: COLORS.card,
      borderRadius: 28,
      paddingHorizontal: 22,
      paddingVertical: 24,
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
      borderWidth: 1,
      borderColor: COLORS.border,
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
    fieldGroup: { marginBottom: 16 },
    label: {
      marginBottom: 8,
      fontSize: 13,
      fontWeight: '700',
      color: COLORS.textMuted,
    },
    input: {
      height: 56,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.cardSoft,
      paddingHorizontal: 16,
      fontSize: 15,
      color: COLORS.text,
    },
    primaryButton: {
      marginTop: 8,
      height: 58,
      borderRadius: 20,
      backgroundColor: COLORS.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
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
    primaryButtonIcon: {
      position: 'absolute',
      right: 12,
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: COLORS.teal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonIconText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '900',
      marginTop: -1,
    },
    secondaryAction: {
      marginTop: 18,
      textAlign: 'center',
      color: COLORS.teal,
      fontWeight: '800',
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
    shapeTopLeftSmall: {
      position: 'absolute',
      top: 24,
      left: -28,
      width: 110,
      height: 110,
      borderRadius: 55,
      backgroundColor: COLORS.teal,
      opacity: isDark ? 0.22 : 0.18,
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
    shapeBottomRightSmall: {
      position: 'absolute',
      bottom: 34,
      right: -18,
      width: 95,
      height: 95,
      borderRadius: 48,
      backgroundColor: COLORS.tealSoft,
      opacity: isDark ? 0.26 : 0.35,
    },
  });
}