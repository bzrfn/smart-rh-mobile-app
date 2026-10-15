import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
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
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import AnimatedEntrance from '../../components/AnimatedEntrance';
import ConstellationAccent from '../../components/ConstellationAccent';
import PasswordEyeIcon from '../../components/PasswordEyeIcon';
import { getSmartRhColors, getSmartRhShadow } from '../../design/smartRhTheme';

type Props = { navigation: any };

export default function RegisterScreen({ navigation }: Props) {
  const { theme } = useAuth();

  const isDark = theme === 'dark';
  const COLORS = getColors(isDark);
  const styles = getStyles(COLORS, isDark);

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmarContrasena, setConfirmarContrasena] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [draftEntryDate, setDraftEntryDate] = useState(new Date());
  const [fotoBase64, setFotoBase64] = useState('');
  const [fotoUri, setFotoUri] = useState('');
  const [loading, setLoading] = useState(false);

  function onEntryDateChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type !== 'dismissed' && date) {
        setFechaIngreso(formatLocalDate(date));
      }
      return;
    }

    if (event.type === 'dismissed' || !date) return;
    setDraftEntryDate(date);
  }

  function openEntryDatePicker() {
    Keyboard.dismiss();
    setDraftEntryDate(parseLocalDate(fechaIngreso) || new Date());
    setShowDatePicker(true);
  }

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permiso requerido',
        'Permite el acceso a tus fotos para seleccionar una imagen.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled) return;

    const asset = result.assets[0];

    setFotoUri(asset.uri);
    setFotoBase64(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : '');
  }

  async function onRegister() {
    if (loading) return;

    const correoLimpio = correo.trim().toLowerCase();

    if (
      !nombre.trim() ||
      !apellido.trim() ||
      !correoLimpio ||
      !contrasena ||
      !confirmarContrasena
    ) {
      Alert.alert(
        'Campos requeridos',
        'Completa nombre, apellido, correo, contraseña y confirmación.'
      );
      return;
    }

    if (contrasena.length < 8) {
      Alert.alert(
        'Contraseña muy corta',
        'La contraseña debe tener al menos 8 caracteres.'
      );
      return;
    }

    if (contrasena !== confirmarContrasena) {
      Alert.alert(
        'Las contraseñas no coinciden',
        'Revisa ambos campos antes de crear la cuenta.'
      );
      return;
    }

    try {
      setLoading(true);

      const { data } = await api.post('/auth/register', {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        correo: correoLimpio,
        contrasena,
        rol_id: 2,
        telefono: telefono.trim() || null,
        direccion: direccion.trim() || null,
        fecha_ingreso: fechaIngreso || null,
        dias_vacaciones_disponibles: 12,
        foto_perfil_base64: fotoBase64 || undefined,
        foto_perfil_filename: fotoBase64 ? 'perfil.jpg' : undefined,
      });

      if (!data?.ok) {
        Alert.alert('Error', data?.message ?? 'No se pudo registrar la cuenta.');
        return;
      }

      if (data?.requiresEmailVerification) {
        Alert.alert(
          'Código enviado',
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

      if (data?.token || data?.user) {
        Alert.alert(
          'Cuenta creada',
          'La cuenta fue creada. Inicia sesión para completar el código 2FA antes de entrar.',
          [
            {
              text: 'Ir al login',
              onPress: () => navigation.navigate('Login'),
            },
          ]
        );
        return;
      }

      Alert.alert('Cuenta creada', 'Revisa tu correo para confirmar la cuenta.');
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
          <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            <AnimatedEntrance delay={40}>
            <View style={styles.heroCard}>
              <ConstellationAccent isDark={isDark} style={styles.constellation} />
              <View style={styles.heroTopRow}>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>SMART RH</Text>
                </View>

                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>Registro</Text>
                </View>
              </View>

              <Text style={styles.heroTitle}>Crear acceso</Text>
              <Text style={styles.heroSubtitle}>
                Registra tu cuenta. Al finalizar recibirás un código de confirmación por correo.
              </Text>
            </View>
            </AnimatedEntrance>

            <AnimatedEntrance delay={140}>
            <View style={styles.card}>
              <Pressable style={styles.photoBox} onPress={pickImage}>
                <View style={styles.photoPreview}>
                  {fotoUri ? (
                    <Image source={{ uri: fotoUri }} style={styles.photoImage} />
                  ) : (
                    <Text style={styles.photoInitial}>
                      {nombre?.[0]?.toUpperCase() || 'S'}
                    </Text>
                  )}
                </View>

                <View style={styles.photoTextBox}>
                  <Text style={styles.photoTitle}>Foto de perfil</Text>
                  <Text style={styles.photoText}>
                    {fotoUri
                      ? 'Imagen seleccionada correctamente'
                      : 'Toca para seleccionar una imagen'}
                  </Text>
                </View>
              </Pressable>

              <Input styles={styles} colors={COLORS} label="Nombre" value={nombre} onChangeText={setNombre} placeholder="Juan" />
              <Input styles={styles} colors={COLORS} label="Apellido" value={apellido} onChangeText={setApellido} placeholder="Pérez" />
              <Input styles={styles} colors={COLORS} label="Correo" value={correo} onChangeText={setCorreo} placeholder="usuario@empresa.com" keyboardType="email-address" />
              <Input
                styles={styles}
                colors={COLORS}
                label="Contraseña"
                value={contrasena}
                onChangeText={setContrasena}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                secureToggle
                secureVisible={showPassword}
                onToggleSecure={() => setShowPassword((value) => !value)}
              />
              <Text style={styles.passwordHint}>
                Usa al menos 8 caracteres.
              </Text>
              <Input
                styles={styles}
                colors={COLORS}
                label="Confirmar contraseña"
                value={confirmarContrasena}
                onChangeText={setConfirmarContrasena}
                placeholder="••••••••"
                secureTextEntry={!showConfirmPassword}
                secureToggle
                secureVisible={showConfirmPassword}
                onToggleSecure={() =>
                  setShowConfirmPassword((value) => !value)
                }
              />
              <Input styles={styles} colors={COLORS} label="Teléfono" value={telefono} onChangeText={setTelefono} placeholder="55 1234 5678" />
              <Input styles={styles} colors={COLORS} label="Dirección" value={direccion} onChangeText={setDireccion} placeholder="Dirección del empleado" />
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Fecha de ingreso</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Seleccionar fecha de ingreso"
                  accessibilityHint="Abre el calendario"
                  style={({ pressed }) => [
                    styles.dateField,
                    pressed ? styles.dateFieldPressed : null,
                  ]}
                  onPress={openEntryDatePicker}
                >
                  <View style={styles.dateFieldCopy}>
                    <Text
                      style={[
                        styles.dateValue,
                        !fechaIngreso ? styles.datePlaceholder : null,
                      ]}
                    >
                      {fechaIngreso
                        ? formatDisplayDate(parseLocalDate(fechaIngreso) || new Date())
                        : 'Selecciona una fecha'}
                    </Text>
                    <Text style={styles.dateHelper}>
                      Se guardará como fecha de ingreso laboral.
                    </Text>
                  </View>

                  <View style={styles.dateAction}>
                    <Text style={styles.dateActionText}>
                      {fechaIngreso ? 'Cambiar' : 'Elegir'}
                    </Text>
                  </View>
                </Pressable>

                {Platform.OS === 'android' && showDatePicker ? (
                  <DateTimePicker
                    value={draftEntryDate}
                    mode="date"
                    display="default"
                    onChange={onEntryDateChange}
                  />
                ) : null}
              </View>

              <Modal
                visible={Platform.OS === 'ios' && showDatePicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDatePicker(false)}
              >
                <View style={styles.dateModalRoot}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar selector de fecha"
                    style={StyleSheet.absoluteFill}
                    onPress={() => setShowDatePicker(false)}
                  />

                  <View style={styles.dateModalPanel}>
                    <View style={styles.dateModalHeader}>
                      <Pressable
                        style={styles.dateModalHeaderButton}
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={styles.dateModalCancelText}>Cancelar</Text>
                      </Pressable>

                      <View style={styles.dateModalHeading}>
                        <Text style={styles.dateModalEyebrow}>Fecha de ingreso</Text>
                        <Text style={styles.dateModalTitle}>
                          Selecciona la fecha
                        </Text>
                      </View>

                      <Pressable
                        style={styles.dateModalHeaderButton}
                        onPress={() => {
                          setFechaIngreso(formatLocalDate(draftEntryDate));
                          setShowDatePicker(false);
                        }}
                      >
                        <Text style={styles.dateModalDoneText}>Listo</Text>
                      </Pressable>
                    </View>

                    <DateTimePicker
                      value={draftEntryDate}
                      mode="date"
                      display="spinner"
                      onChange={onEntryDateChange}
                      locale="es-MX"
                      themeVariant={isDark ? 'dark' : 'light'}
                      accentColor={COLORS.primary}
                      style={styles.systemDatePicker}
                    />
                  </View>
                </View>
              </Modal>

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && !loading ? styles.primaryButtonPressed : null,
                  loading ? styles.primaryButtonDisabled : null,
                ]}
                onPress={onRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Crear cuenta y enviar código</Text>
                )}
              </Pressable>

              <Pressable onPress={() => navigation.goBack()}>
                <Text style={styles.secondaryAction}>Volver al login</Text>
              </Pressable>
            </View>
            </AnimatedEntrance>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Input({
  styles,
  colors,
  label,
  secureToggle,
  secureVisible,
  onToggleSecure,
  ...props
}: any) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      {secureToggle ? (
        <View style={styles.passwordInputWrap}>
          <TextInput
            {...props}
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, styles.passwordInput]}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              secureVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'
            }
            hitSlop={8}
            style={styles.passwordToggle}
            onPress={onToggleSecure}
          >
            <PasswordEyeIcon
              color={colors.primary}
              hidden={!secureVisible}
            />
          </Pressable>
        </View>
      ) : (
        <TextInput
          {...props}
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
      )}
    </View>
  );
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const parsed = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDisplayDate(date: Date) {
  return date.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
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
    container: {
      padding: 22,
      paddingBottom: 36,
      backgroundColor: COLORS.background,
    },
    heroCard: {
      backgroundColor: COLORS.card,
      borderRadius: 30,
      padding: 24,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      overflow: 'hidden',
      ...shadow,
    },
    constellation: {
      right: -18,
      top: 38,
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 18,
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
    heroTitle: {
      fontSize: 32,
      fontWeight: '700',
      color: COLORS.text,
    },
    heroSubtitle: {
      marginTop: 10,
      color: COLORS.textMuted,
      fontSize: 15,
      lineHeight: 23,
    },
    card: {
      backgroundColor: COLORS.card,
      borderRadius: 28,
      padding: 22,
      borderWidth: 1,
      borderColor: COLORS.border,
      ...shadow,
    },
    photoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 14,
      marginBottom: 18,
      borderRadius: 22,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: COLORS.border,
      backgroundColor: COLORS.cardSoft,
    },
    photoPreview: {
      width: 82,
      height: 82,
      borderRadius: 24,
      backgroundColor: COLORS.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    photoImage: { width: '100%', height: '100%' },
    photoInitial: {
      fontSize: 32,
      fontWeight: '700',
      color: COLORS.link,
    },
    photoTextBox: { flex: 1 },
    photoTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: COLORS.text,
    },
    photoText: {
      marginTop: 5,
      fontSize: 13,
      color: COLORS.textMuted,
      lineHeight: 19,
    },
    fieldGroup: { marginBottom: 14 },
    label: {
      marginBottom: 8,
      fontSize: 13,
      fontWeight: '600',
      color: COLORS.textMuted,
    },
    input: {
      height: 54,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.cardSoft,
      paddingHorizontal: 16,
      fontSize: 15,
      color: COLORS.text,
    },
    dateField: {
      minHeight: 74,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.cardSoft,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    dateFieldPressed: { opacity: 0.78 },
    dateFieldCopy: { flex: 1 },
    dateValue: {
      color: COLORS.text,
      fontSize: 15,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    datePlaceholder: {
      color: COLORS.placeholder,
      fontWeight: '600',
    },
    dateHelper: {
      color: COLORS.textMuted,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 4,
    },
    dateAction: {
      minWidth: 68,
      minHeight: 38,
      borderRadius: 14,
      backgroundColor: COLORS.primarySoft,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    dateActionText: {
      color: COLORS.primary,
      fontSize: 12,
      fontWeight: '800',
    },
    dateModalRoot: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: isDark
        ? 'rgba(1,8,18,0.76)'
        : 'rgba(15,23,42,0.34)',
      padding: 14,
    },
    dateModalPanel: {
      borderRadius: 28,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: 16,
      paddingBottom: 22,
      ...shadow,
    },
    dateModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingBottom: 8,
    },
    dateModalHeaderButton: {
      minWidth: 66,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateModalHeading: {
      flex: 1,
      alignItems: 'center',
    },
    dateModalEyebrow: {
      color: COLORS.textMuted,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    dateModalTitle: {
      color: COLORS.text,
      fontSize: 16,
      fontWeight: '800',
      marginTop: 3,
    },
    dateModalCancelText: {
      color: COLORS.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    dateModalDoneText: {
      color: COLORS.primary,
      fontSize: 13,
      fontWeight: '900',
    },
    systemDatePicker: {
      height: 190,
    },
    passwordInputWrap: {
      position: 'relative',
      justifyContent: 'center',
    },
    passwordInput: {
      paddingRight: 64,
    },
    passwordToggle: {
      position: 'absolute',
      right: 12,
      width: 40,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primarySoft,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    passwordHint: {
      color: COLORS.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: -6,
      marginBottom: 14,
    },
    primaryButton: {
      marginTop: 8,
      minHeight: 58,
      borderRadius: 20,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
    },
    primaryButtonPressed: {
      transform: [{ scale: 0.99 }],
      backgroundColor: COLORS.primaryDark,
    },
    primaryButtonDisabled: { opacity: 0.85 },
    primaryButtonText: {
      color: COLORS.onPrimary,
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
    },
    secondaryAction: {
      marginTop: 18,
      textAlign: 'center',
      color: COLORS.link,
      fontWeight: '700',
    },
  });
}

