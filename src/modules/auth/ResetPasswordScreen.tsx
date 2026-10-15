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
import AnimatedEntrance from '../../components/AnimatedEntrance';
import ConstellationAccent from '../../components/ConstellationAccent';
import PasswordEyeIcon from '../../components/PasswordEyeIcon';
import { getSmartRhColors, getSmartRhShadow } from '../../design/smartRhTheme';

type Props = {
  navigation: any;
  route: {
    params?: {
      correo?: string;
      fromProfile?: boolean;
    };
  };
};

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const { theme, logout } = useAuth();

  const isDark = theme === 'dark';
  const COLORS = getColors(isDark);
  const styles = getStyles(COLORS, isDark);

  const correo = route?.params?.correo || '';
  const fromProfile = Boolean(route?.params?.fromProfile);

  const [codigo, setCodigo] = useState('');
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [confirmarContrasena, setConfirmarContrasena] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const onReset = async () => {
    if (loading) return;

    if (!correo.trim() || !codigo.trim() || !nuevaContrasena.trim() || !confirmarContrasena.trim()) {
      Alert.alert('Campos requeridos', 'Falta el correo de recuperación, código o nueva contraseña.');
      return;
    }

    if (nuevaContrasena !== confirmarContrasena) {
      Alert.alert('Contraseñas diferentes', 'La nueva contraseña y la confirmación no coinciden.');
      return;
    }

    try {
      setLoading(true);

      const { data } = await api.post('/auth/reset-password', {
        correo: correo.trim().toLowerCase(),
        codigo: codigo.trim(),
        nuevaContrasena,
      });

      if (!data?.ok) {
        Alert.alert('Error', data?.message ?? 'No se pudo actualizar la contraseña.');
        return;
      }

      Alert.alert(
        'Contraseña actualizada',
        fromProfile
          ? 'La contraseña cambió correctamente. Por seguridad, inicia sesión de nuevo.'
          : data?.message ?? 'Contraseña actualizada correctamente.',
        [
          {
            text: 'Continuar',
            onPress: () => {
              if (fromProfile) {
                logout();
                return;
              }

              navigation.navigate('Login');
            },
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

              <AnimatedEntrance delay={40}>
              <View style={styles.heroCard}>
                <ConstellationAccent isDark={isDark} style={styles.constellation} />
                <View style={styles.heroTopRow}>
                  <View style={styles.heroPill}>
                    <Text style={styles.heroPillText}>SMART RH</Text>
                  </View>

                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>Seguridad</Text>
                  </View>
                </View>

                <Text style={styles.eyebrow}>Restablecimiento</Text>
                <Text style={styles.heroTitle}>Actualiza tu contraseña</Text>
                <Text style={styles.heroSubtitle}>
                  Ingresa el código enviado a tu correo y define una nueva contraseña.
                </Text>

                {!!correo && (
                  <View style={styles.heroInfoCard}>
                    <Text style={styles.heroInfoTitle}>Correo asociado</Text>
                    <Text style={styles.heroInfoText}>{correo}</Text>
                  </View>
                )}
              </View>
              </AnimatedEntrance>

              <AnimatedEntrance delay={140}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Restablecer contraseña</Text>
                <Text style={styles.cardDescription}>
                  Usa el código temporal recibido por email.
                </Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Código</Text>
                  <TextInput
                    value={codigo}
                    onChangeText={(text) => setCodigo(text.replace(/[^0-9]/g, '').slice(0, 6))}
                    placeholder="000000"
                    placeholderTextColor={COLORS.placeholder}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={styles.input}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Nueva contraseña</Text>
                  <View style={styles.passwordInputWrap}>
                    <TextInput
                      value={nuevaContrasena}
                      onChangeText={setNuevaContrasena}
                      placeholder="••••••••"
                      placeholderTextColor={COLORS.placeholder}
                      secureTextEntry={!showNewPassword}
                      autoCorrect={false}
                      style={[styles.input, styles.passwordInput]}
                    />

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        showNewPassword
                          ? 'Ocultar contraseña'
                          : 'Mostrar contraseña'
                      }
                      hitSlop={8}
                      style={styles.passwordToggle}
                      onPress={() => setShowNewPassword((value) => !value)}
                    >
                      <PasswordEyeIcon
                        color={COLORS.primary}
                        hidden={!showNewPassword}
                      />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Confirmar contraseña</Text>
                  <View style={styles.passwordInputWrap}>
                    <TextInput
                      value={confirmarContrasena}
                      onChangeText={setConfirmarContrasena}
                      placeholder="••••••••"
                      placeholderTextColor={COLORS.placeholder}
                      secureTextEntry={!showConfirmPassword}
                      autoCorrect={false}
                      style={[styles.input, styles.passwordInput]}
                    />

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        showConfirmPassword
                          ? 'Ocultar contraseña'
                          : 'Mostrar contraseña'
                      }
                      hitSlop={8}
                      style={styles.passwordToggle}
                      onPress={() => setShowConfirmPassword((value) => !value)}
                    >
                      <PasswordEyeIcon
                        color={COLORS.primary}
                        hidden={!showConfirmPassword}
                      />
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && !loading ? styles.primaryButtonPressed : null,
                    loading ? styles.primaryButtonDisabled : null,
                  ]}
                  onPress={onReset}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryButtonText}>Actualizar contraseña</Text>
                      <View style={styles.primaryButtonIcon}>
                        <Text style={styles.primaryButtonIconText}>✓</Text>
                      </View>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={() =>
                    fromProfile
                      ? navigation.goBack()
                      : navigation.navigate('Login')
                  }
                >
                  <Text style={styles.secondaryAction}>
                    {fromProfile ? 'Cancelar cambio' : 'Volver al login'}
                  </Text>
                </Pressable>
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
    primaryDark: colors.primaryDark,
    primarySoft: colors.primarySoft,
    teal: colors.success,
    tealSoft: colors.success,
    tealBg: colors.successSoft,
    link: colors.link,
    maxAccent: colors.maxAccent,
    text: colors.text,
    textMuted: colors.textMuted,
    border: colors.border,
    placeholder: colors.placeholder,
    onPrimary: colors.onPrimary,
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
      overflow: 'hidden',
      ...shadow,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    constellation: {
      right: -18,
      top: 42,
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
      color: COLORS.link,
      fontSize: 12,
      fontWeight: '700',
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
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    eyebrow: {
      marginTop: 18,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      color: COLORS.textMuted,
      marginBottom: 8,
    },
    heroTitle: {
      fontSize: 30,
      fontWeight: '700',
      color: COLORS.text,
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
      fontWeight: '700',
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
      ...shadow,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    cardTitle: {
      fontSize: 24,
      fontWeight: '700',
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
      color: COLORS.onPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    primaryButtonIcon: {
      position: 'absolute',
      right: 12,
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: COLORS.link,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonIconText: {
      color: COLORS.onPrimary,
      fontSize: 18,
      fontWeight: '700',
      marginTop: -1,
    },
    secondaryAction: {
      marginTop: 18,
      textAlign: 'center',
      color: COLORS.link,
      fontWeight: '700',
      fontSize: 14,
    },
    shapeTopLeftLarge: {
      position: 'absolute',
      top: -70,
      left: -95,
      width: 230,
      height: 230,
      borderRadius: 115,
      backgroundColor: COLORS.link,
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
      opacity: isDark ? 0.26 : 0.35,
    },
  });
}
