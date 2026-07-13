import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
  Vibration,
  View,
} from 'react-native';
import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from 'expo-camera';
import { Audio } from 'expo-av';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

type Props = {
  navigation: any;
};

type StatusType = 'idle' | 'success' | 'error';

const CORNER_SIZE = 42;
const CORNER_THICKNESS = 5;

export default function QrScanScreen({ navigation }: Props) {
  const { theme } = useAuth();
  const { width, height } = useWindowDimensions();

  const isDark = theme === 'dark';
  const frameSize = Math.min(252, Math.max(220, width - 118));
  const COLORS = getColors(isDark);
  const styles = getStyles(isDark, frameSize);

  const [permission, requestPermission] = useCameraPermissions();

  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);

  const [status, setStatus] = useState('Coloca el código QR dentro del marco.');
  const [statusTitle, setStatusTitle] = useState('Listo para escanear');
  const [statusType, setStatusType] = useState<StatusType>('idle');

  const soundRef = useRef<Audio.Sound | null>(null);
  const scanLockRef = useRef(false);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const successScale = useRef(new Animated.Value(0.7)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loadSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../../../assets/sounds/success.wav')
        );
        soundRef.current = sound;
      } catch (error) {
        console.log('No se pudo cargar el sonido:', error);
      }
    };

    loadSound();

    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
      soundRef.current?.unloadAsync();
    };
  }, []);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [scanLineAnim]);

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [28, frameSize - 34],
  });

  async function playSuccessFeedback() {
    try {
      Vibration.vibrate(180);
      await soundRef.current?.replayAsync();
    } catch (error) {
      console.log('No se pudo reproducir el sonido:', error);
    }
  }

  function runSuccessAnimation() {
    successScale.setValue(0.7);
    successOpacity.setValue(0);
    setSuccessVisible(true);

    Animated.parallel([
      Animated.spring(successScale, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function resetScanState() {
    scanLockRef.current = false;
    setScanned(false);
    setProcessing(false);
    setSuccessVisible(false);
    setStatusType('idle');
    setStatusTitle('Listo para escanear');
    setStatus('Coloca el código QR dentro del marco.');
  }

  function goHomeAfterSuccess() {
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);

    successTimeoutRef.current = setTimeout(() => {
      navigation.navigate('Home');
    }, 2000);
  }

  function scheduleReset(ms = 1800) {
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);

    resetTimeoutRef.current = setTimeout(() => {
      resetScanState();
    }, ms);
  }

  async function onScanned(result: BarcodeScanningResult) {
    if (scanLockRef.current || scanned || processing) return;

    scanLockRef.current = true;
    setScanned(true);
    setProcessing(true);

    const qrToken = result.data?.trim();

    if (!qrToken) {
      setProcessing(false);
      setStatusType('error');
      setStatusTitle('QR inválido');
      setStatus('No se detectó contenido válido en el código QR.');

      Alert.alert('QR inválido', 'No se detectó contenido en el QR.');
      scheduleReset(1500);
      return;
    }

    try {
      setStatusType('idle');
      setStatusTitle('Validando QR');
      setStatus('Procesando registro de asistencia...');

      const { data } = await api.post('/asistencia/scan', {
        token: qrToken,
      });

      if (!data?.ok) {
        throw new Error(data?.message ?? 'No se pudo registrar la asistencia.');
      }

      const tipo = String(data?.tipo ?? '').toLowerCase();
      const isSalida = tipo === 'salida';

      await playSuccessFeedback();

      setProcessing(false);
      setStatusType('success');
      setStatusTitle(isSalida ? 'Salida registrada' : 'Entrada registrada');
      setStatus(
        data?.message ??
          (isSalida
            ? 'Tu salida fue registrada correctamente.'
            : 'Tu entrada fue registrada correctamente.')
      );

      runSuccessAnimation();
      goHomeAfterSuccess();
    } catch (e: any) {
      const message =
        e?.response?.data?.message ??
        e?.message ??
        'Error al validar el código QR.';

      setProcessing(false);
      setStatusType('error');
      setStatusTitle('No se pudo registrar');
      setStatus(message);

      if (e?.response?.status === 401) {
        Alert.alert(
          'Sesión expirada',
          'Tu sesión ya no es válida. Inicia sesión nuevamente.',
          [{ text: 'Aceptar', onPress: () => navigation.navigate('Login') }]
        );
        return;
      }

      Alert.alert('Error', message);
      scheduleReset(1800);
    }
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.safeCenter}>
        <View style={styles.stateCard}>
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text style={styles.stateBrand}>SMART RH</Text>
          <Text style={styles.stateTitle}>Preparando cámara</Text>
          <Text style={styles.stateText}>
            Estamos validando los permisos necesarios para iniciar el escaneo.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safeCenter}>
        <View style={styles.stateCard}>
          <View style={styles.permissionIconWrap}>
            <Text style={styles.permissionIcon}>⌁</Text>
          </View>

          <Text style={styles.stateBrand}>SMART RH</Text>
          <Text style={styles.stateTitle}>Permiso de cámara requerido</Text>
          <Text style={styles.stateText}>
            Necesitamos acceso a la cámara para escanear el código QR de asistencia.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.primaryBtnPressed,
            ]}
            onPress={requestPermission}
          >
            <Text style={styles.primaryBtnText}>Dar permiso</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={!scanned && !processing ? onScanned : undefined}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      <View style={styles.darkLayer} />

      <View style={styles.overlay}>
        <View style={styles.topOverlay}>
          <View style={styles.topMetaRow}>
            <Text style={styles.topEyebrow}>SMART RH</Text>

            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>Activo</Text>
            </View>
          </View>

          <Text style={styles.overlayTitle}>Escáner de asistencia</Text>
          <Text style={styles.overlaySubtitle}>
            Alinea el QR dentro del marco. El sistema detectará si corresponde entrada o salida.
          </Text>
        </View>

        <View style={styles.scanAreaWrapper}>
          <View style={styles.scanGlow} />

          <View style={styles.scanArea}>
            {!processing && !successVisible && (
              <Animated.View
                style={[
                  styles.scanLine,
                  { transform: [{ translateY: scanLineTranslate }] },
                ]}
              />
            )}

            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />

            <View style={styles.centerHint}>
              {!processing && !successVisible && (
                <>
                  <Text style={styles.centerHintIcon}>⌗</Text>
                  <Text style={styles.centerHintText}>QR</Text>
                </>
              )}
            </View>

            {processing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator color={COLORS.white} size="large" />
                <Text style={styles.processingText}>Procesando...</Text>
              </View>
            )}

            {successVisible && (
              <Animated.View
                style={[
                  styles.successOverlay,
                  {
                    opacity: successOpacity,
                    transform: [{ scale: successScale }],
                  },
                ]}
              >
                <View style={styles.successCircle}>
                  <Text style={styles.successIcon}>✓</Text>
                </View>
              </Animated.View>
            )}
          </View>
        </View>

        <View style={styles.bottomPanel}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusPill,
                statusType === 'success'
                  ? styles.statusPillSuccess
                  : statusType === 'error'
                  ? styles.statusPillError
                  : styles.statusPillIdle,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  statusType === 'success'
                    ? styles.statusPillTextSuccess
                    : statusType === 'error'
                    ? styles.statusPillTextError
                    : styles.statusPillTextIdle,
                ]}
              >
                {statusType === 'success'
                  ? 'Éxito'
                  : statusType === 'error'
                  ? 'Error'
                  : 'En espera'}
              </Text>
            </View>

            <Text style={styles.statusCode}>QR-SCAN</Text>
          </View>

          <Text style={styles.bottomTitle}>{statusTitle}</Text>
          <Text style={styles.bottomText}>{status}</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoIconWrap}>
              <Text style={styles.infoIcon}>i</Text>
            </View>

            <View style={styles.infoTextBlock}>
              <Text style={styles.infoCardTitle}>Flujo de asistencia</Text>
              <Text style={styles.infoCardText}>
                El primer escaneo registra entrada. El siguiente escaneo del día registra salida.
              </Text>
            </View>
          </View>

          {!processing && statusType === 'error' && (
            <Pressable
              style={({ pressed }) => [
                styles.retryBtn,
                pressed && styles.retryBtnPressed,
              ]}
              onPress={resetScanState}
            >
              <Text style={styles.retryBtnText}>Escanear de nuevo</Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function getColors(isDark: boolean) {
  return {
    background: isDark ? '#07111F' : '#F4F7FB',
    card: isDark ? '#0F1B2D' : '#FFFFFF',
    cardSoft: isDark ? '#111F33' : '#F9FBFD',
    overlay: isDark ? 'rgba(7,17,31,0.42)' : 'rgba(7,17,31,0.28)',
    panel: isDark ? 'rgba(15,27,45,0.96)' : 'rgba(255,255,255,0.96)',
    panelSoft: isDark ? 'rgba(17,31,51,0.95)' : 'rgba(249,251,253,0.95)',
    primary: isDark ? '#38BDF8' : '#0A57A4',
    primaryDark: isDark ? '#0EA5E9' : '#084785',
    primarySoft: isDark ? 'rgba(56,189,248,0.14)' : 'rgba(10,87,164,0.10)',
    teal: isDark ? '#2DD4BF' : '#22B8B0',
    tealSoft: isDark ? '#14B8A6' : '#67D5CC',
    tealBg: isDark ? 'rgba(45,212,191,0.16)' : 'rgba(34,184,176,0.12)',
    white: '#FFFFFF',
    text: isDark ? '#F8FAFC' : '#0F172A',
    textMuted: isDark ? '#9FB0C4' : '#5B6B81',
    border: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(10,87,164,0.12)',
    success: '#10B981',
    successSoft: 'rgba(16,185,129,0.16)',
    danger: '#EF4444',
    dangerSoft: 'rgba(239,68,68,0.16)',
    shadow: '#000000',
  };
}

function getStyles(isDark: boolean, frameSize: number) {
  const COLORS = getColors(isDark);

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    camera: {
      flex: 1,
    },
    darkLayer: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: COLORS.overlay,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'space-between',
    },

    topOverlay: {
      paddingTop: 22,
      paddingHorizontal: 22,
    },
    topMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    topEyebrow: {
      color: COLORS.teal,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    overlayTitle: {
      marginTop: 14,
      color: COLORS.white,
      fontSize: 28,
      fontWeight: '900',
      lineHeight: 34,
    },
    overlaySubtitle: {
      marginTop: 10,
      color: 'rgba(255,255,255,0.82)',
      fontSize: 14,
      lineHeight: 21,
      maxWidth: 340,
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 999,
      flexShrink: 0,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 99,
      backgroundColor: COLORS.success,
    },
    liveBadgeText: {
      color: COLORS.white,
      fontWeight: '900',
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },

    scanAreaWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      paddingVertical: 10,
    },
    scanGlow: {
      position: 'absolute',
      width: frameSize + 42,
      height: frameSize + 42,
      borderRadius: 42,
      backgroundColor: COLORS.tealBg,
      opacity: 0.5,
    },
    scanArea: {
      width: frameSize,
      height: frameSize,
      borderRadius: 32,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
      overflow: 'hidden',
      position: 'relative',
    },
    scanLine: {
      position: 'absolute',
      left: 22,
      right: 22,
      height: 3,
      borderRadius: 99,
      backgroundColor: COLORS.tealSoft,
      shadowColor: COLORS.teal,
      shadowOpacity: 0.9,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 0 },
      elevation: 8,
    },
    centerHint: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerHintIcon: {
      color: 'rgba(255,255,255,0.34)',
      fontSize: 44,
      fontWeight: '900',
    },
    centerHintText: {
      marginTop: 4,
      color: 'rgba(255,255,255,0.38)',
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 2,
    },

    processingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(7,17,31,0.72)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    processingText: {
      marginTop: 12,
      color: COLORS.white,
      fontSize: 15,
      fontWeight: '900',
    },

    successOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(7,17,31,0.64)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    successCircle: {
      width: 92,
      height: 92,
      borderRadius: 46,
      backgroundColor: COLORS.success,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: COLORS.success,
      shadowOpacity: 0.38,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    successIcon: {
      color: COLORS.white,
      fontSize: 40,
      fontWeight: '900',
    },

    corner: {
      position: 'absolute',
      width: CORNER_SIZE,
      height: CORNER_SIZE,
      borderColor: COLORS.teal,
    },
    cornerTopLeft: {
      top: 0,
      left: 0,
      borderTopWidth: CORNER_THICKNESS,
      borderLeftWidth: CORNER_THICKNESS,
      borderTopLeftRadius: 28,
    },
    cornerTopRight: {
      top: 0,
      right: 0,
      borderTopWidth: CORNER_THICKNESS,
      borderRightWidth: CORNER_THICKNESS,
      borderTopRightRadius: 28,
    },
    cornerBottomLeft: {
      bottom: 0,
      left: 0,
      borderBottomWidth: CORNER_THICKNESS,
      borderLeftWidth: CORNER_THICKNESS,
      borderBottomLeftRadius: 28,
    },
    cornerBottomRight: {
      bottom: 0,
      right: 0,
      borderBottomWidth: CORNER_THICKNESS,
      borderRightWidth: CORNER_THICKNESS,
      borderBottomRightRadius: 28,
    },

    bottomPanel: {
      marginHorizontal: 18,
      marginBottom: 14,
      backgroundColor: COLORS.panel,
      borderRadius: 30,
      padding: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      shadowColor: COLORS.shadow,
      shadowOpacity: isDark ? 0.3 : 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    statusPill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
    },
    statusPillIdle: {
      backgroundColor: COLORS.primarySoft,
    },
    statusPillSuccess: {
      backgroundColor: COLORS.successSoft,
    },
    statusPillError: {
      backgroundColor: COLORS.dangerSoft,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    statusPillTextIdle: {
      color: COLORS.primary,
    },
    statusPillTextSuccess: {
      color: COLORS.success,
    },
    statusPillTextError: {
      color: COLORS.danger,
    },
    statusCode: {
      color: COLORS.textMuted,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1,
    },
    bottomTitle: {
      marginTop: 14,
      color: COLORS.text,
      fontSize: 21,
      fontWeight: '900',
    },
    bottomText: {
      marginTop: 8,
      color: COLORS.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    infoCard: {
      marginTop: 15,
      flexDirection: 'row',
      gap: 12,
      backgroundColor: COLORS.panelSoft,
      borderRadius: 20,
      padding: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    infoIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: COLORS.tealBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoIcon: {
      color: COLORS.teal,
      fontWeight: '900',
      fontSize: 16,
    },
    infoTextBlock: {
      flex: 1,
    },
    infoCardTitle: {
      color: COLORS.text,
      fontSize: 14,
      fontWeight: '900',
    },
    infoCardText: {
      marginTop: 5,
      color: COLORS.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },

    retryBtn: {
      marginTop: 16,
      height: 52,
      borderRadius: 18,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    retryBtnPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.99 }],
    },
    retryBtnText: {
      color: COLORS.white,
      fontSize: 15,
      fontWeight: '900',
    },

    safeCenter: {
      flex: 1,
      backgroundColor: COLORS.background,
      justifyContent: 'center',
      padding: 22,
    },
    stateCard: {
      backgroundColor: COLORS.card,
      borderRadius: 30,
      padding: 24,
      alignItems: 'center',
      shadowColor: COLORS.shadow,
      shadowOpacity: isDark ? 0.26 : 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    permissionIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 24,
      backgroundColor: COLORS.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    permissionIcon: {
      color: COLORS.primary,
      fontSize: 28,
      fontWeight: '900',
    },
    stateBrand: {
      fontSize: 26,
      fontWeight: '900',
      color: COLORS.primary,
      marginTop: 16,
      marginBottom: 10,
    },
    stateTitle: {
      marginTop: 10,
      fontSize: 22,
      fontWeight: '900',
      color: COLORS.text,
      textAlign: 'center',
    },
    stateText: {
      marginTop: 10,
      color: COLORS.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      fontSize: 14,
    },
    primaryBtn: {
      marginTop: 20,
      height: 52,
      minWidth: 170,
      borderRadius: 18,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.99 }],
    },
    primaryBtnText: {
      color: COLORS.white,
      fontSize: 15,
      fontWeight: '900',
    },
  });
}