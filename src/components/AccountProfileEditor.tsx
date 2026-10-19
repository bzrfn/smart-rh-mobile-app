import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { usePrivateMediaUri } from '../hooks/usePrivateMediaUri';
import { api } from '../services/api';
import {
  getSmartRhColors,
  getSmartRhShadow,
} from '../design/smartRhTheme';

type Props = {
  navigation: any;
  embedded?: boolean;
};

function initials(nombre?: string, apellido?: string) {
  return `${nombre?.trim()?.[0] || ''}${apellido?.trim()?.[0] || ''}`
    .toUpperCase() || 'SRH';
}

export default function AccountProfileEditor({
  navigation,
  embedded = false,
}: Props) {
  const { user, token, theme, updateUser, logout } = useAuth();
  const isDark = theme === 'dark';
  const colors = getSmartRhColors(isDark);
  const styles = getStyles(isDark);
  const { localUri } = usePrivateMediaUri(user?.foto_perfil_url, token);

  const [telefono, setTelefono] = useState(user?.telefono || '');
  const [direccion, setDireccion] = useState(user?.direccion || '');
  const [photoUri, setPhotoUri] = useState('');
  const [photoBase64, setPhotoBase64] = useState('');
  const [photoFilename, setPhotoFilename] = useState('perfil.jpg');
  const [saving, setSaving] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    setTelefono(user?.telefono || '');
    setDireccion(user?.direccion || '');
  }, [user?.id, user?.telefono, user?.direccion]);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permiso requerido',
        'Permite el acceso a tus fotos para actualizar tu imagen de perfil.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.75,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled) return;

    const asset = result.assets[0];

    if (!asset.base64) {
      Alert.alert('Imagen no disponible', 'No fue posible preparar esa imagen.');
      return;
    }

    setPhotoUri(asset.uri);
    setPhotoBase64(`data:image/jpeg;base64,${asset.base64}`);
    setPhotoFilename(asset.fileName || 'perfil.jpg');
  }

  async function saveProfile() {
    if (!user?.id || saving) return;

    try {
      setSaving(true);

      const { data } = await api.patch('/users/me', {
        telefono: telefono.trim() || null,
        direccion: direccion.trim() || null,
      });

      if (!data?.ok || !data?.user) {
        throw new Error(data?.message || 'No se pudo actualizar el perfil.');
      }

      let fotoPerfilUrl = data.user.foto_perfil_url;

      if (photoBase64) {
        const photoResponse = await api.patch(
          `/documentos/usuarios/${user.id}/foto-perfil`,
          {
            base64: photoBase64,
            filename: photoFilename,
          }
        );

        fotoPerfilUrl = photoResponse.data?.foto_perfil_url || fotoPerfilUrl;
      }

      await updateUser({
        ...data.user,
        foto_perfil_url: fotoPerfilUrl,
      });

      setPhotoBase64('');
      setPhotoUri('');
      Alert.alert('Perfil actualizado', 'Tus datos se guardaron correctamente.');
    } catch (error: any) {
      Alert.alert(
        'No se pudo guardar',
        error?.response?.data?.message ||
          error?.message ||
          'Revisa tu conexión e intenta nuevamente.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function requestPasswordCode() {
    if (!user?.correo || sendingCode) return;

    try {
      setSendingCode(true);

      const { data } = await api.post('/auth/forgot-password', {
        correo: user.correo.trim().toLowerCase(),
      });

      if (!data?.ok) {
        throw new Error(data?.message || 'No se pudo enviar el código.');
      }

      Alert.alert(
        'Código enviado',
        'Revisa tu correo. El código temporal se usará para confirmar el cambio de contraseña.',
        [
          {
            text: 'Continuar',
            onPress: () =>
              navigation.navigate('ResetPassword', {
                correo: user.correo,
                fromProfile: true,
              }),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        'No se pudo enviar el código',
        error?.response?.data?.message ||
          error?.message ||
          'Intenta nuevamente.'
      );
    } finally {
      setSendingCode(false);
    }
  }

  function closeDeleteModal() {
    if (deletingAccount) return;
    setDeleteModalOpen(false);
    setDeletePassword('');
    setDeleteConfirmation('');
  }

  async function deleteAccount() {
    if (
      deletingAccount ||
      !deletePassword ||
      deleteConfirmation !== 'CONFIRMAR'
    ) {
      return;
    }

    try {
      setDeletingAccount(true);

      const { data } = await api.delete('/users/me', {
        data: {
          password: deletePassword,
          confirmation: deleteConfirmation,
        },
      });

      if (!data?.ok) {
        throw new Error(data?.message || 'No se pudo eliminar la cuenta.');
      }

      setDeleteModalOpen(false);
      setDeletePassword('');
      setDeleteConfirmation('');
      await logout();

      Alert.alert(
        'Cuenta eliminada',
        'Tu cuenta y tus datos personales fueron eliminados. Ya no puedes iniciar sesión con este correo.'
      );
    } catch (error: any) {
      Alert.alert(
        'No se pudo eliminar la cuenta',
        error?.response?.data?.message ||
          error?.message ||
          'Revisa tu conexión e intenta nuevamente.'
      );
    } finally {
      setDeletingAccount(false);
    }
  }

  const avatarSource = photoUri || localUri;

  return (
    <>
    <View style={[styles.card, embedded ? styles.cardEmbedded : null]}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>Mi cuenta</Text>
          <Text style={styles.title}>Datos de contacto</Text>
          <Text style={styles.description}>
            Mantén actualizados los datos que usa Recursos Humanos para comunicarse contigo.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cambiar foto de perfil"
          style={({ pressed }) => [
            styles.avatarButton,
            pressed ? styles.pressed : null,
          ]}
          onPress={pickPhoto}
        >
          {avatarSource ? (
            <Image source={{ uri: avatarSource }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>
              {initials(user?.nombre, user?.apellido)}
            </Text>
          )}
          <View style={styles.cameraBadge}>
            <Text style={styles.cameraBadgeText}>+</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.photoHint}>
        <View style={styles.hintDot} />
        <Text style={styles.photoHintText}>
          Toca tu foto para elegir una nueva.
        </Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Número de teléfono</Text>
        <TextInput
          value={telefono}
          onChangeText={setTelefono}
          placeholder="55 1234 5678"
          placeholderTextColor={colors.placeholder}
          keyboardType="phone-pad"
          autoCorrect={false}
          maxLength={30}
          style={styles.input}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Dirección</Text>
        <TextInput
          value={direccion}
          onChangeText={setDireccion}
          placeholder="Calle, número, colonia y ciudad"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="sentences"
          maxLength={500}
          multiline
          textAlignVertical="top"
          style={[styles.input, styles.addressInput]}
        />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.saveButton,
          pressed && !saving ? styles.saveButtonPressed : null,
          saving ? styles.disabled : null,
        ]}
        onPress={saveProfile}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.saveButtonText}>Guardar cambios</Text>
        )}
      </Pressable>

      <View style={styles.securityDivider} />

      <View style={styles.securityRow}>
        <View style={styles.securityCopy}>
          <Text style={styles.securityTitle}>Contraseña</Text>
          <Text style={styles.securityText}>
            Enviaremos un código a {user?.correo || 'tu correo'} antes de permitir el cambio.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.codeButton,
            pressed && !sendingCode ? styles.pressed : null,
            sendingCode ? styles.disabled : null,
          ]}
          onPress={requestPasswordCode}
          disabled={sendingCode}
        >
          {sendingCode ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={styles.codeButtonText}>Cambiar</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.securityDivider} />

      <View style={styles.deleteCard}>
        <View style={styles.deleteCopy}>
          <Text style={styles.deleteEyebrow}>Privacidad y cuenta</Text>
          <Text style={styles.deleteTitle}>Eliminar cuenta</Text>
          <Text style={styles.deleteText}>
            Elimina permanentemente tu acceso y tus datos personales de SMART RH.
            Los registros laborales que deban conservarse por obligación legal quedarán sin tu cuenta activa.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Eliminar mi cuenta permanentemente"
          style={({ pressed }) => [
            styles.deleteButton,
            pressed ? styles.pressed : null,
          ]}
          onPress={() => setDeleteModalOpen(true)}
        >
          <Text style={styles.deleteButtonText}>Eliminar mi cuenta</Text>
        </Pressable>
      </View>
    </View>

    <Modal
      visible={deleteModalOpen}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={closeDeleteModal}
    >
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar confirmación"
          style={StyleSheet.absoluteFill}
          onPress={closeDeleteModal}
        />

        <View style={styles.modalCard}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalContent}
          >
            <View style={styles.modalDangerMark}>
              <Text style={styles.modalDangerMarkText}>!</Text>
            </View>

            <Text style={styles.modalEyebrow}>Acción permanente</Text>
            <Text style={styles.modalTitle}>Confirmar eliminación</Text>
            <Text style={styles.modalText}>
              Perderás el acceso a tu cuenta, foto de perfil, documentos generados,
              notificaciones y actividad asociada. Esta acción no se puede deshacer.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Contraseña actual</Text>
              <TextInput
                value={deletePassword}
                onChangeText={setDeletePassword}
                placeholder="Escribe tu contraseña"
                placeholderTextColor={colors.placeholder}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                style={styles.input}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirmación de seguridad</Text>
              <Text style={styles.confirmationLead}>Escribe esta palabra para continuar:</Text>
              <View style={styles.confirmationWord}>
                <Text style={styles.confirmationWordText}>CONFIRMAR</Text>
              </View>
              <TextInput
                value={deleteConfirmation}
                onChangeText={setDeleteConfirmation}
                placeholder="Escribe CONFIRMAR"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={9}
                style={styles.input}
              />
              <Text style={styles.confirmationHint}>
                La palabra debe coincidir exactamente y estar en mayúsculas.
              </Text>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed ? styles.pressed : null,
                ]}
                onPress={closeDeleteModal}
                disabled={deletingAccount}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.confirmDeleteButton,
                  pressed && !deletingAccount ? styles.pressed : null,
                  (!deletePassword ||
                    deleteConfirmation !== 'CONFIRMAR' ||
                    deletingAccount) && styles.disabled,
                ]}
                onPress={deleteAccount}
                disabled={
                  !deletePassword ||
                  deleteConfirmation !== 'CONFIRMAR' ||
                  deletingAccount
                }
              >
                {deletingAccount ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.confirmDeleteButtonText}>
                    Eliminar permanentemente
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </>
  );
}

function getStyles(isDark: boolean) {
  const colors = getSmartRhColors(isDark);
  const shadow = getSmartRhShadow(isDark);

  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 26,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 18,
      ...shadow,
    },
    cardEmbedded: {
      backgroundColor: 'transparent',
      borderRadius: 0,
      borderWidth: 0,
      padding: 0,
      marginBottom: 0,
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    headingRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 16,
    },
    headingCopy: { flex: 1 },
    eyebrow: {
      color: colors.success,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    title: {
      color: colors.text,
      fontSize: 22,
      lineHeight: 27,
      fontWeight: '900',
    },
    description: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 7,
    },
    avatarButton: {
      width: 76,
      height: 76,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      borderRadius: 23,
    },
    avatarText: {
      color: colors.primary,
      fontSize: 23,
      fontWeight: '900',
    },
    cameraBadge: {
      position: 'absolute',
      right: -4,
      bottom: -4,
      width: 27,
      height: 27,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderWidth: 3,
      borderColor: colors.card,
    },
    cameraBadgeText: {
      color: colors.onPrimary,
      fontSize: 17,
      lineHeight: 18,
      fontWeight: '700',
    },
    photoHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 14,
      marginBottom: 18,
    },
    hintDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.success,
    },
    photoHintText: {
      flex: 1,
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    fieldGroup: { marginBottom: 14 },
    label: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 8,
    },
    input: {
      minHeight: 54,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardSoft,
      paddingHorizontal: 16,
      paddingVertical: 13,
      color: colors.text,
      fontSize: 15,
    },
    addressInput: {
      minHeight: 92,
      lineHeight: 21,
    },
    saveButton: {
      minHeight: 56,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 18,
    },
    saveButtonPressed: {
      transform: [{ scale: 0.99 }],
      backgroundColor: colors.primaryDark,
    },
    saveButtonText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '900',
    },
    securityDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 18,
    },
    securityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    securityCopy: { flex: 1 },
    securityTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
    securityText: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 5,
    },
    codeButton: {
      minWidth: 82,
      minHeight: 42,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      paddingHorizontal: 14,
    },
    codeButtonText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '900',
    },
    deleteCard: {
      gap: 15,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: isDark ? '#EF4444' : '#DC2626',
      backgroundColor: isDark ? '#2B1015' : '#FFF1F2',
      padding: 16,
    },
    deleteCopy: { flex: 1 },
    deleteEyebrow: {
      color: isDark ? '#FF6B6B' : '#B91C1C',
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 5,
    },
    deleteTitle: {
      color: isDark ? '#FFF1F2' : '#7F1D1D',
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '900',
    },
    deleteText: {
      color: isDark ? '#F7B4BB' : '#991B1B',
      fontSize: 12,
      lineHeight: 18,
      marginTop: 6,
    },
    deleteButton: {
      minHeight: 46,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark ? '#FF6B6B' : '#B91C1C',
      backgroundColor: isDark ? '#EF4444' : '#DC2626',
      paddingHorizontal: 16,
    },
    deleteButtonText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '900',
    },
    modalBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark
        ? 'rgba(2, 8, 18, 0.82)'
        : 'rgba(15, 23, 42, 0.48)',
      paddingHorizontal: 20,
      paddingVertical: 30,
    },
    modalCard: {
      width: '100%',
      maxWidth: 520,
      maxHeight: '90%',
      borderRadius: 28,
      borderWidth: 2,
      borderColor: isDark ? '#EF4444' : '#DC2626',
      backgroundColor: colors.card,
      overflow: 'hidden',
      ...shadow,
    },
    modalContent: {
      padding: 22,
    },
    modalDangerMark: {
      width: 44,
      height: 44,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#3B1118' : '#FEE2E2',
      borderWidth: 2,
      borderColor: isDark ? '#EF4444' : '#DC2626',
      marginBottom: 16,
    },
    modalDangerMarkText: {
      color: isDark ? '#FF6B6B' : '#B91C1C',
      fontSize: 23,
      lineHeight: 25,
      fontWeight: '900',
    },
    modalEyebrow: {
      color: isDark ? '#FF6B6B' : '#B91C1C',
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '900',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
    },
    modalTitle: {
      color: colors.text,
      fontSize: 23,
      lineHeight: 29,
      fontWeight: '900',
      marginTop: 5,
    },
    modalText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
      marginTop: 9,
      marginBottom: 20,
    },
    confirmationHint: {
      color: colors.textSubtle,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 7,
    },
    confirmationLead: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginBottom: 8,
    },
    confirmationWord: {
      alignSelf: 'flex-start',
      borderRadius: 11,
      borderWidth: 1,
      borderColor: isDark ? '#EF4444' : '#DC2626',
      backgroundColor: isDark ? '#3B1118' : '#FEE2E2',
      paddingHorizontal: 12,
      paddingVertical: 7,
      marginBottom: 10,
    },
    confirmationWordText: {
      color: isDark ? '#FF6B6B' : '#B91C1C',
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '900',
      letterSpacing: 1.2,
    },
    modalActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 8,
    },
    cancelButton: {
      flexGrow: 1,
      minWidth: 112,
      minHeight: 50,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.cardSoft,
      paddingHorizontal: 16,
    },
    cancelButtonText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '900',
    },
    confirmDeleteButton: {
      flexGrow: 2,
      minWidth: 210,
      minHeight: 50,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#EF4444' : '#DC2626',
      paddingHorizontal: 18,
    },
    confirmDeleteButtonText: {
      color: colors.white,
      fontSize: 13,
      fontWeight: '900',
      textAlign: 'center',
    },
    pressed: { opacity: 0.76 },
    disabled: { opacity: 0.62 },
  });
}

