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
import AnimatedEntrance from '../../components/AnimatedEntrance';
import ConstellationAccent from '../../components/ConstellationAccent';
import PasswordEyeIcon from '../../components/PasswordEyeIcon';
import { getSmartRhColors, getSmartRhShadow } from '../../design/smartRhTheme';

type Props = {
  navigation: any;
};

export default function LoginScreen({ navigation }: Props) {
  const { theme, toggleTheme, setAuth } = useAuth();

  const isDark = theme === 'dark';
  const COLORS = getColors(isDark);
  const styles = getStyles(COLORS, isDark);

  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [adminAccessChallengeId, setAdminAccessChallengeId] = useState('');
  const [adminAccessCode, setAdminAccessCode] = useState('');
  const [adminAccessToken, setAdminAccessToken] = useState('');
  const [loadingAdminAccess, setLoadingAdminAccess] = useState(false);

  function isAppReviewAccount(email: string) {
    return [
      'review.admin@smart-rh.com.mx',
      'review.employee@smart-rh.com.mx',
    ].includes(email.trim().toLowerCase());
  }

  async function requestAdminAccess() {
    if (loadingAdminAccess) return;

    try {
      setLoadingAdminAccess(true);
      setAdminAccessToken('');
      setAdminAccessCode('');

      const { data } = await api.post('/auth/admin-access/request');

      if (!data?.accepted || !data?.challengeId) {
        Alert.alert(
          'No se pudo solicitar acceso',
          data?.message || 'Intenta nuevamente.'
        );
        return;
      }

      setAdminAccessChallengeId(data.challengeId);

      Alert.alert(
        'Código solicitado',
        data?.message ||
          'Se envió el código de preautorización al administrador general.'
      );
    } catch (e: any) {
      Alert.alert(
        'Error',
        e?.response?.data?.message ||
          e?.message ||
          'No se pudo solicitar la preautorización administrativa.'
      );
    } finally {
      setLoadingAdminAccess(false);
    }
  }

  async function verifyAdminAccess() {
    if (loadingAdminAccess) return;

    if (!adminAccessChallengeId || !adminAccessCode.trim()) {
      Alert.alert(
        'Código requerido',
        'Solicita el acceso e ingresa el código de preautorización.'
      );
      return;
    }

    try {
      setLoadingAdminAccess(true);

      const { data } = await api.post('/auth/admin-access/verify', {
        challengeId: adminAccessChallengeId,
        codigo: adminAccessCode.trim(),
      });

      if (!data?.authorized || !data?.adminAccessToken) {
        Alert.alert(
          'No autorizado',
          data?.message || 'No se pudo validar la preautorización.'
        );
        return;
      }

      setAdminAccessToken(data.adminAccessToken);

      Alert.alert(
        'Preautorización validada',
        'Ahora ingresa las credenciales administrativas para recibir el código 2FA.'
      );
    } catch (e: any) {
      Alert.alert(
        'Error',
        e?.response?.data?.message ||
          e?.message ||
          'No se pudo validar la preautorización administrativa.'
      );
    } finally {
      setLoadingAdminAccess(false);
    }
  }

  const onLogin = async () => {
    if (loading) return;

    const correoLimpio = correo.trim().toLowerCase();

    if (!correoLimpio || !contrasena.trim()) {
      Alert.alert('Campos requeridos', 'Ingresa correo y contraseña.');
      return;
    }

    try {
      setLoading(true);

      const useAdminEndpoint = adminMode && !isAppReviewAccount(correoLimpio);

      if (useAdminEndpoint && !adminAccessToken) {
        Alert.alert(
          'Preautorización requerida',
          'Valida primero el código administrativo antes de iniciar sesión.'
        );
        return;
      }

      const { data } = await api.post(
        useAdminEndpoint ? '/auth/admin-login' : '/auth/login',
        {
          correo: correoLimpio,
          contrasena,
        },
        useAdminEndpoint
          ? {
              headers: {
                Authorization: `Bearer ${adminAccessToken}`,
              },
            }
          : undefined
      );

      if (!data?.ok) {
        Alert.alert('Error', data?.message ?? 'No se pudo iniciar sesión.');
        return;
      }

      if (data?.token && data?.user) {
        await setAuth(data.token, data.user);
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

              <AnimatedEntrance delay={40}>
              <View style={styles.heroCard}>
                <View style={styles.heroRail} />
                <View style={styles.heroGlow} />
                <ConstellationAccent isDark={isDark} style={styles.constellation} />
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
                    <View style={styles.themeButtonDot} />
                    <Text style={styles.themeButtonText}>
                      {isDark ? 'Claro' : 'Oscuro'}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.accessBadge}>
                  <Text style={styles.accessBadgeText}>Portal móvil</Text>
                </View>

                <Text style={styles.eyebrow}>Bienvenido</Text>
                <Text style={styles.heroTitle}>Inicia sesión</Text>
                <Text style={styles.heroSubtitle}>
                  Ingresa con tu cuenta para continuar a tu panel laboral.
                </Text>
              </View>
              </AnimatedEntrance>

              <AnimatedEntrance delay={140}>
              <View style={styles.card}>
                <View style={styles.formHeaderLine} />
                <Text style={styles.cardTitle}>Acceso a la cuenta</Text>
                <Text style={styles.cardDescription}>
                  Usa tu correo y contraseña para entrar a SMART RH.
                </Text>

                <View style={styles.adminModeCard}>
                  <View style={styles.adminModeHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.adminModeTitle}>
                        Acceso administrador
                      </Text>
                      <Text style={styles.adminModeText}>
                        Actívalo solo para cuentas administrativas con preautorización.
                      </Text>
                    </View>

                    <Pressable
                      style={[
                        styles.adminModeToggle,
                        adminMode && styles.adminModeToggleActive,
                      ]}
                      onPress={() => {
                        setAdminMode((value) => !value);
                        setAdminAccessChallengeId('');
                        setAdminAccessCode('');
                        setAdminAccessToken('');
                      }}
                    >
                      <Text
                        style={[
                          styles.adminModeToggleText,
                          adminMode && styles.adminModeToggleTextActive,
                        ]}
                      >
                        {adminMode ? 'Activo' : 'Inactivo'}
                      </Text>
                    </Pressable>
                  </View>

                  {adminMode ? (
                    <View style={styles.adminAccessBox}>
                      <Pressable
                        style={[
                          styles.adminAccessButton,
                          loadingAdminAccess && styles.adminAccessButtonDisabled,
                        ]}
                        onPress={requestAdminAccess}
                        disabled={loadingAdminAccess}
                      >
                        <Text style={styles.adminAccessButtonText}>
                          {adminAccessChallengeId
                            ? 'Solicitar nuevo código'
                            : 'Solicitar código admin'}
                        </Text>
                      </Pressable>

                      {adminAccessChallengeId ? (
                        <View style={styles.fieldGroup}>
                          <Text style={styles.label}>Código admin</Text>
                          <TextInput
                            value={adminAccessCode}
                            onChangeText={(text) =>
                              setAdminAccessCode(
                                text.replace(/[^0-9]/g, '').slice(0, 6)
                              )
                            }
                            placeholder="000000"
                            placeholderTextColor={COLORS.placeholder}
                            keyboardType="number-pad"
                            maxLength={6}
                            style={styles.input}
                          />

                          <Pressable
                            style={[
                              styles.adminVerifyButton,
                              loadingAdminAccess &&
                                styles.adminAccessButtonDisabled,
                            ]}
                            onPress={verifyAdminAccess}
                            disabled={loadingAdminAccess}
                          >
                            <Text style={styles.adminVerifyButtonText}>
                              {adminAccessToken
                                ? 'Preautorización lista'
                                : 'Validar preautorización'}
                            </Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>

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
                  <View style={styles.passwordInputWrap}>
                    <TextInput
                      value={contrasena}
                      onChangeText={setContrasena}
                      placeholder="C o n t r a s e ñ a"
                      placeholderTextColor={COLORS.placeholder}
                      secureTextEntry={!showPassword}
                      autoCorrect={false}
                      style={[styles.input, styles.passwordInput]}
                    />

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword
                          ? 'Ocultar contraseña'
                          : 'Mostrar contraseña'
                      }
                      hitSlop={8}
                      style={styles.passwordToggle}
                      onPress={() => setShowPassword((value) => !value)}
                    >
                      <PasswordEyeIcon
                        color={COLORS.primaryText}
                        hidden={!showPassword}
                      />
                    </Pressable>
                  </View>
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
              </AnimatedEntrance>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getColors(isDark: boolean) {
  const colors = getSmartRhColors(isDark);

  return {
    background: colors.background,
    card: colors.card,
    cardSoft: colors.cardSoft,
    primary: colors.primary,
    primaryText: colors.primary,
    heroCard: colors.card,
    heroCardSoft: colors.cardSoft,
    heroText: colors.text,
    heroMuted: colors.textMuted,
    heroAccent: colors.primary,
    onAccent: '#FFFFFF',
    primaryDark: colors.primaryDark,
    primarySoft: colors.primarySoft,
    teal: colors.success,
    tealSoft: colors.success,
    tealBg: colors.successSoft,
    link: colors.link,
    linkSoft: colors.linkSoft,
    maxAccent: colors.maxAccent,
    maxAccentSoft: colors.maxAccentSoft,
    spark: colors.spark,
    text: colors.text,
    textMuted: colors.textMuted,
    border: colors.border,
    placeholder: colors.placeholder,
    onPrimary: '#FFFFFF',
  };
}

function getStyles(COLORS: ReturnType<typeof getColors>, isDark: boolean) {
  const shadow = getSmartRhShadow(isDark);

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    keyboard: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { flexGrow: 1 },
    container: {
      flexGrow: 1,
      paddingHorizontal: 22,
      paddingTop: 22,
      paddingBottom: 36,
      backgroundColor: COLORS.background,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    heroCard: {
      zIndex: 2,
      position: 'relative',
      backgroundColor: COLORS.heroCard,
      borderRadius: 30,
      padding: 20,
      marginBottom: 12,
      overflow: 'hidden',
      ...shadow,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    heroRail: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 7,
      backgroundColor: COLORS.heroAccent,
    },
    heroGlow: {
      position: 'absolute',
      right: -44,
      top: -34,
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: COLORS.primarySoft,
    },
    constellation: {
      right: -16,
      top: 46,
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
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    heroPillText: {
      color: COLORS.heroAccent,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    themeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: COLORS.heroCardSoft,
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
    themeButtonDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: COLORS.teal,
    },
    themeButtonText: {
      color: COLORS.heroText,
      fontWeight: '700',
      fontSize: 12,
    },
    accessBadge: {
      alignSelf: 'flex-start',
      marginTop: 14,
      backgroundColor: COLORS.tealBg,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
    },
    accessBadgeText: {
      color: COLORS.teal,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    eyebrow: {
      marginTop: 13,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      color: COLORS.heroMuted,
      marginBottom: 8,
    },
    heroTitle: {
      fontSize: 29,
      fontWeight: '700',
      color: COLORS.heroText,
    },
    heroSubtitle: {
      marginTop: 8,
      marginBottom: 2,
      fontSize: 15,
      color: COLORS.heroMuted,
      lineHeight: 21,
    },
    card: {
      zIndex: 2,
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: COLORS.card,
      borderRadius: 30,
      paddingHorizontal: 22,
      paddingTop: 28,
      paddingBottom: 24,
      ...shadow,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    formHeaderLine: {
      position: 'absolute',
      top: 0,
      left: 22,
      right: 22,
      height: 3,
      borderRadius: 999,
      backgroundColor: COLORS.primary,
    },
    cardTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: COLORS.text,
      textAlign: 'left',
    },
    cardDescription: {
      marginTop: 8,
      marginBottom: 20,
      fontSize: 14,
      color: COLORS.textMuted,
      textAlign: 'left',
      lineHeight: 21,
    },
    adminModeCard: {
      marginBottom: 18,
      backgroundColor: COLORS.cardSoft,
      borderRadius: 20,
      padding: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    adminModeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    adminModeTitle: {
      color: COLORS.text,
      fontSize: 15,
      fontWeight: '700',
    },
    adminModeText: {
      marginTop: 4,
      color: COLORS.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    adminModeToggle: {
      minWidth: 82,
      alignItems: 'center',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 9,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    adminModeToggleActive: {
      backgroundColor: COLORS.tealBg,
      borderColor: COLORS.teal,
    },
    adminModeToggleText: {
      color: COLORS.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    adminModeToggleTextActive: {
      color: COLORS.teal,
    },
    adminAccessBox: {
      marginTop: 14,
      gap: 12,
    },
    adminAccessButton: {
      minHeight: 46,
      borderRadius: 16,
      backgroundColor: COLORS.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.primary,
    },
    adminAccessButtonDisabled: {
      opacity: 0.65,
    },
    adminAccessButtonText: {
      color: COLORS.primaryText,
      fontWeight: '700',
      fontSize: 13,
    },
    adminVerifyButton: {
      marginTop: 10,
      minHeight: 46,
      borderRadius: 16,
      backgroundColor: COLORS.tealBg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.teal,
    },
    adminVerifyButtonText: {
      color: COLORS.teal,
      fontWeight: '700',
      fontSize: 13,
    },
    fieldGroup: { marginBottom: 16 },
    label: {
      marginBottom: 8,
      fontSize: 13,
      fontWeight: '600',
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
    passwordInputWrap: {
      position: 'relative',
      justifyContent: 'center',
    },
    passwordInput: {
      paddingRight: 66,
    },
    passwordToggle: {
      position: 'absolute',
      right: 12,
      width: 42,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primarySoft,
      borderWidth: 1,
      borderColor: COLORS.border,
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
      color: COLORS.onPrimary,
      fontSize: 16,
      fontWeight: '700',
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
      color: COLORS.onPrimary,
      fontSize: 18,
      fontWeight: '700',
      marginTop: -1,
    },
    actionsBlock: {
      marginTop: 18,
      paddingBottom: 2,
    },
    primaryAction: {
      textAlign: 'center',
      color: COLORS.primary,
      fontWeight: '700',
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
      opacity: isDark ? 0.12 : 0.08,
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
