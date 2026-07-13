import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

type Props = { navigation: any };

export default function RegisterScreen({ navigation }: Props) {
  const { setAuth, theme } = useAuth();

  const isDark = theme === 'dark';
  const COLORS = getColors(isDark);
  const styles = getStyles(COLORS, isDark);

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState('');
  const [fotoBase64, setFotoBase64] = useState('');
  const [fotoUri, setFotoUri] = useState('');
  const [loading, setLoading] = useState(false);

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

    if (!nombre.trim() || !apellido.trim() || !correoLimpio || !contrasena.trim()) {
      Alert.alert('Campos requeridos', 'Completa nombre, apellido, correo y contraseña.');
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

      if (data?.token && data?.user) {
        const user = {
          ...data.user,
          foto_perfil_url: data?.foto_perfil_url || data?.user?.foto_perfil_url,
        };

        await setAuth(data.token, user);
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
            <View style={styles.heroCard}>
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
              <Input styles={styles} colors={COLORS} label="Contraseña" value={contrasena} onChangeText={setContrasena} placeholder="••••••••" secureTextEntry />
              <Input styles={styles} colors={COLORS} label="Teléfono" value={telefono} onChangeText={setTelefono} placeholder="55 1234 5678" />
              <Input styles={styles} colors={COLORS} label="Dirección" value={direccion} onChangeText={setDireccion} placeholder="Dirección del empleado" />
              <Input styles={styles} colors={COLORS} label="Fecha de ingreso" value={fechaIngreso} onChangeText={setFechaIngreso} placeholder="YYYY-MM-DD" />

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
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Input({ styles, colors, label, ...props }: any) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
    </View>
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
      marginBottom: 18,
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
    heroTitle: {
      fontSize: 32,
      fontWeight: '900',
      color: COLORS.primary,
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
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.3 : 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
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
      fontWeight: '900',
      color: COLORS.primary,
    },
    photoTextBox: { flex: 1 },
    photoTitle: {
      fontSize: 15,
      fontWeight: '900',
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
      fontWeight: '800',
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
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '900',
      textAlign: 'center',
    },
    secondaryAction: {
      marginTop: 18,
      textAlign: 'center',
      color: COLORS.teal,
      fontWeight: '900',
    },
  });
}