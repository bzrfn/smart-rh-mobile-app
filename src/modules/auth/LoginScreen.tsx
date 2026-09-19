import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

type Props = {
  navigation: any;
};

export default function LoginScreen({ navigation }: Props) {
  const { setAuth, theme, toggleTheme } = useAuth();

  const isDark = theme === 'dark';
  const COLORS = getColors(isDark);
  const styles = getStyles(COLORS, isDark);

  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (loading) return;

    const correoLimpio = correo.trim().toLowerCase();

    if (!correoLimpio || !contrasena.trim()) {
      Alert.alert('Campos requeridos', 'Ingresa correo y contraseña.');
      return;
    }

    try {
      setLoading(true);

      const { data } = await api.post('/auth/login', {
        correo: correoLimpio,
        contrasena,
      });

      if (!data?.ok) {
        Alert.alert('Error', data?.message ?? 'No se pudo iniciar sesión.');
        return;
      }

      if (data?.requiresEmailVerification) {
        Alert.alert(
          'Verificación requerida',
          data?.message ?? 'Se envió un código de confirmación a tu correo.',
          [
            {
              text: 'Continuar',
              onPress: () =>
                navigation.navigate('VerifyAccount', {
                  correo: data?.correo || correoLimpio,
                }),
            },
          ]
        );
        return;
      }

      if (data?.requires2FA) {
        if (!data?.challengeId) {
          Alert.alert(
            'Error',
            'No se recibió el identificador de seguridad del segundo factor.'
          );
          return;
        }

        Alert.alert(
          'Código enviado',
          data?.message ?? 'Se envió un código de acceso a tu correo.',
          [
            {
              text: 'Continuar',
              onPress: () =>
                navigation.navigate('VerifyLoginCode', {
                  correo: data?.correo || correoLimpio,
                  challengeId: data.challengeId,
                }),
            },
          ]
        );
        return;
      }

      if (data?.token && data?.user) {
        await setAuth(data.token, data.user);
        return;
      }

      Alert.alert('Validación pendiente', 'No se recibió token. Revisa tu correo para continuar.');
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

                  <Pressable
                    onPress={toggleTheme}
                    style={({ pressed }) => [
                      styles.themeButton,
                      pressed ? styles.themeButtonPressed : null,
                    ]}
                  >
                    <Text style={styles.themeButtonIcon}>
                      {isDark ? '☀️' : '🌙'}
                    </Text>
                    <Text style={styles.themeButtonText}>
                      {isDark ? 'Claro' : 'Oscuro'}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.accessBadge}>
                  <Text style={styles.accessBadgeText}>Acceso seguro</Text>
                </View>

                <Text style={styles.eyebrow}>Bienvenido</Text>
                <Text style={styles.heroTitle}>Inicia sesión</Text>
                <Text style={styles.heroSubtitle}>
                  Ingresa tus credenciales. SMART RH enviará un código de un solo uso
                  a tu correo para completar el acceso.
                </Text>

                <View style={styles.heroInfoCard}>
                  <Text style={styles.heroInfoTitle}>Autenticación por correo</Text>
                  <Text style={styles.heroInfoText}>
                    Tu cuenta está protegida con verificación 2FA. El acceso se confirma
                    mediante un código temporal enviado a tu email.
                  </Text>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Acceso a la cuenta</Text>
                <Text style={styles.cardDescription}>
                  Ingresa tus credenciales para recibir el código de verificación.
                </Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Correo</Text>
                  <TextInput
                    value={correo}
                    onChangeText={setCorreo}
                    placeholder="Email"
                    placeholderTextColor={COLORS.placeholder}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                    style={styles.input}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Contraseña</Text>
                  <TextInput
                    value={contrasena}
                    onChangeText={setContrasena}
                    placeholder="C o n t r a s e ñ a"
                    placeholderTextColor={COLORS.placeholder}
                    secureTextEntry
                    autoCorrect={false}
                    style={styles.input}
                  />
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.loginButton,
                    pressed && !loading ? styles.loginButtonPressed : null,
                    loading ? styles.loginButtonDisabled : null,
                  ]}
                  onPress={onLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.loginButtonText}>Enviar código</Text>
                      <View style={styles.loginButtonIcon}>
                        <Text style={styles.loginButtonIconText}>→</Text>
                      </View>
                    </>
                  )}
                </Pressable>

                <View style={styles.actionsBlock}>
                  <Pressable onPress={() => navigation.navigate('Register')}>
                    <Text style={styles.primaryAction}>Crear cuenta</Text>
                  </Pressable>

                  <Pressable onPress={() => navigation.navigate('ForgotPassword')}>
                    <Text style={styles.secondaryAction}>
                      ¿Olvidaste tu contraseña?
                    </Text>
                  </Pressable>
                </View>
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
      paddingHorizontal: 22,
      paddingTop: 28,
      paddingBottom: 36,
      backgroundColor: COLORS.background,
      overflow: 'hidden',
      justifyContent: 'center',
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
      gap: 12,
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
    themeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: COLORS.cardSoft,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    themeButtonPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.97 }],
    },
    themeButtonIcon: { fontSize: 14 },
    themeButtonText: {
      color: COLORS.primary,
      fontWeight: '900',
      fontSize: 12,
    },
    accessBadge: {
      alignSelf: 'flex-start',
      marginTop: 18,
      backgroundColor: COLORS.tealBg,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
    },
    accessBadgeText: {
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
    loginButton: {
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
    loginButtonPressed: {
      transform: [{ scale: 0.99 }],
      backgroundColor: COLORS.primaryDark,
    },
    loginButtonDisabled: { opacity: 0.85 },
    loginButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '900',
    },
    loginButtonIcon: {
      position: 'absolute',
      right: 12,
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: COLORS.teal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loginButtonIconText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '900',
      marginTop: -1,
    },
    actionsBlock: {
      marginTop: 18,
      paddingBottom: 2,
    },
    primaryAction: {
      textAlign: 'center',
      color: COLORS.teal,
      fontWeight: '800',
      fontSize: 14,
    },
    secondaryAction: {
      marginTop: 12,
      textAlign: 'center',
      color: COLORS.textMuted,
      fontWeight: '600',
      fontSize: 13,
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
      opacity: isDark ? 0.22 : 0.35,
    },
  });
}