import React, {
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  api,
} from '../../services/api';

import {
  useAuth,
} from '../../contexts/AuthContext';

import {
  CredentialVerificationResult,
  formatCredentialValidity,
  parseCredentialQr,
} from './credentialVerification';


type VerificationState =
  | 'idle'
  | 'loading'
  | 'valid'
  | 'invalid'
  | 'error';


export default function VerificarCredencialScreen() {
  const {
    theme,
  } = useAuth();

  const isDark =
    theme === 'dark';

  const styles =
    getStyles(isDark);

  const colors =
    getColors(isDark);

  const [
    permission,
    requestPermission,
  ] = useCameraPermissions();

  const [
    scanned,
    setScanned,
  ] = useState(false);

  const [
    state,
    setState,
  ] = useState<VerificationState>(
    'idle'
  );

  const [
    result,
    setResult,
  ] =
    useState<CredentialVerificationResult | null>(
      null
    );

  const [
    message,
    setMessage,
  ] = useState(
    'Alinea un QR de credencial SMART RH dentro del marco.'
  );

  const scanLockRef =
    useRef(false);


  function resetScanner() {
    scanLockRef.current =
      false;

    setScanned(false);

    setState(
      'idle'
    );

    setResult(
      null
    );

    setMessage(
      'Alinea un QR de credencial SMART RH dentro del marco.'
    );
  }


  async function handleScanned(
    event: {
      data: string;
    }
  ) {
    if (
      scanLockRef.current
    ) {
      return;
    }

    scanLockRef.current =
      true;

    setScanned(true);

    const payload =
      parseCredentialQr(
        event.data
      );

    if (!payload) {
      setState(
        'invalid'
      );

      setMessage(
        'El código escaneado no corresponde a una credencial SMART RH válida.'
      );

      return;
    }

    try {
      setState(
        'loading'
      );

      setMessage(
        'Consultando vigencia de la credencial...'
      );

      const {
        data,
      } =
        await api.get<CredentialVerificationResult>(
          `/documentos/credenciales/verificar/${encodeURIComponent(
            payload.token
          )}`
        );

      if (
        data?.valida === true
      ) {
        setResult(
          data
        );

        setState(
          'valid'
        );

        setMessage(
          'La credencial está vigente y fue validada por SMART RH.'
        );

        return;
      }

      setResult(
        null
      );

      setState(
        'invalid'
      );

      setMessage(
        'La credencial no es válida, fue reemplazada o ya venció.'
      );

    } catch (error: any) {
      setResult(
        null
      );

      setState(
        'error'
      );

      const backendMessage =
        error?.response?.data?.message;

      if (
        error?.response?.status === 404
      ) {
        setMessage(
          'El servicio de verificación aún no está disponible en el backend configurado.'
        );
      } else {
        setMessage(
          backendMessage ||
          'No fue posible consultar la credencial. Verifica la conexión e inténtalo nuevamente.'
        );
      }
    }
  }


  if (!permission) {
    return (
      <SafeAreaView
        style={
          styles.safeCenter
        }
      >
        <View
          style={
            styles.stateCard
          }
        >
          <ActivityIndicator
            color={
              colors.primary
            }
            size="large"
          />

          <Text
            style={
              styles.stateBrand
            }
          >
            SMART RH
          </Text>

          <Text
            style={
              styles.stateTitle
            }
          >
            Preparando cámara
          </Text>

          <Text
            style={
              styles.stateText
            }
          >
            Estamos comprobando el permiso necesario para verificar credenciales.
          </Text>
        </View>
      </SafeAreaView>
    );
  }


  if (
    !permission.granted
  ) {
    return (
      <SafeAreaView
        style={
          styles.safeCenter
        }
      >
        <View
          style={
            styles.stateCard
          }
        >
          <Text
            style={
              styles.stateBrand
            }
          >
            SMART RH
          </Text>

          <Text
            style={
              styles.stateTitle
            }
          >
            Permiso de cámara requerido
          </Text>

          <Text
            style={
              styles.stateText
            }
          >
            La cámara se utiliza únicamente para leer el QR de la credencial que deseas verificar.
          </Text>

          <Pressable
            style={
              styles.primaryButton
            }
            onPress={
              requestPermission
            }
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              Dar permiso
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }


  const isValid =
    state === 'valid';

  const isInvalid =
    state === 'invalid' ||
    state === 'error';


  return (
    <SafeAreaView
      style={
        styles.safe
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.container
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.hero
          }
        >
          <Text
            style={
              styles.eyebrow
            }
          >
            Validación institucional
          </Text>

          <Text
            style={
              styles.title
            }
          >
            Verificar credencial
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Escanea únicamente el QR incluido en una credencial digital SMART RH.
          </Text>
        </View>


        <View
          style={
            styles.cameraCard
          }
        >
          <CameraView
            style={
              styles.camera
            }
            facing="back"
            onBarcodeScanned={
              !scanned &&
              state !== 'loading'
                ? handleScanned
                : undefined
            }
            barcodeScannerSettings={{
              barcodeTypes: [
                'qr',
              ],
            }}
          />

          <View
            pointerEvents="none"
            style={
              styles.scanOverlay
            }
          >
            <View
              style={
                styles.scanFrame
              }
            >
              <Text
                style={
                  styles.scanLabel
                }
              >
                QR
              </Text>
            </View>
          </View>
        </View>


        <View
          style={[
            styles.resultCard,
            isValid &&
              styles.resultCardValid,
            isInvalid &&
              styles.resultCardInvalid,
          ]}
        >
          <View
            style={
              styles.statusRow
            }
          >
            <View
              style={[
                styles.statusBadge,
                isValid &&
                  styles.statusBadgeValid,
                isInvalid &&
                  styles.statusBadgeInvalid,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  isValid &&
                    styles.statusBadgeTextValid,
                  isInvalid &&
                    styles.statusBadgeTextInvalid,
                ]}
              >
                {state === 'loading'
                  ? 'Validando'
                  : isValid
                  ? 'Vigente'
                  : isInvalid
                  ? 'No válida'
                  : 'En espera'}
              </Text>
            </View>

            <Text
              style={
                styles.statusCode
              }
            >
              ID-CHECK
            </Text>
          </View>


          {state === 'loading' && (
            <View
              style={
                styles.loadingRow
              }
            >
              <ActivityIndicator
                color={
                  colors.primary
                }
              />

              <Text
                style={
                  styles.resultText
                }
              >
                Consultando SMART RH...
              </Text>
            </View>
          )}


          {state !== 'loading' && (
            <Text
              style={
                styles.resultText
              }
            >
              {message}
            </Text>
          )}


          {isValid &&
            result?.empleado && (
              <View
                style={
                  styles.employeeData
                }
              >
                <InfoRow
                  label="Empleado"
                  value={
                    result.empleado.nombre
                  }
                  styles={
                    styles
                  }
                />

                <InfoRow
                  label="Código"
                  value={
                    result.empleado.codigo
                  }
                  styles={
                    styles
                  }
                />

                <InfoRow
                  label="Rol"
                  value={
                    result.empleado.rol
                  }
                  styles={
                    styles
                  }
                />

                <InfoRow
                  label="Vigencia"
                  value={
                    formatCredentialValidity(
                      result.vigencia
                    )
                  }
                  styles={
                    styles
                  }
                />
              </View>
            )}


          {scanned &&
            state !== 'loading' && (
              <Pressable
                style={
                  styles.retryButton
                }
                onPress={
                  resetScanner
                }
              >
                <Text
                  style={
                    styles.retryButtonText
                  }
                >
                  Escanear otra credencial
                </Text>
              </Pressable>
            )}
        </View>


        <View
          style={
            styles.infoCard
          }
        >
          <Text
            style={
              styles.infoTitle
            }
          >
            Verificación independiente
          </Text>

          <Text
            style={
              styles.infoText
            }
          >
            Este escáner no registra entrada ni salida. El QR de asistencia continúa funcionando en su módulo separado.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


function InfoRow({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<
    typeof getStyles
  >;
}) {
  return (
    <View
      style={
        styles.infoRow
      }
    >
      <Text
        style={
          styles.infoLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.infoValue
        }
      >
        {value}
      </Text>
    </View>
  );
}


function getColors(
  isDark: boolean
) {
  return {
    background:
      isDark
        ? '#07111F'
        : '#F4F7FB',

    card:
      isDark
        ? '#0F1B2D'
        : '#FFFFFF',

    cardSoft:
      isDark
        ? '#111F33'
        : '#F9FBFD',

    primary:
      isDark
        ? '#38BDF8'
        : '#0A57A4',

    teal:
      isDark
        ? '#2DD4BF'
        : '#22B8B0',

    text:
      isDark
        ? '#F8FAFC'
        : '#0F172A',

    muted:
      isDark
        ? '#9FB0C4'
        : '#5B6B81',

    border:
      isDark
        ? '#26364D'
        : '#D9E1EC',

    danger:
      isDark
        ? '#FCA5A5'
        : '#B42318',

    successBg:
      isDark
        ? 'rgba(45,212,191,0.13)'
        : 'rgba(34,184,176,0.10)',

    dangerBg:
      isDark
        ? 'rgba(248,113,113,0.12)'
        : 'rgba(180,35,24,0.07)',
  };
}


function getStyles(
  isDark: boolean
) {
  const COLORS =
    getColors(
      isDark
    );

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor:
        COLORS.background,
    },

    safeCenter: {
      flex: 1,
      padding: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        COLORS.background,
    },

    container: {
      padding: 20,
      gap: 16,
      paddingBottom: 40,
    },

    hero: {
      backgroundColor:
        COLORS.primary,
      borderRadius: 28,
      padding: 22,
    },

    eyebrow: {
      color:
        'rgba(255,255,255,0.75)',
      fontWeight: '900',
      textTransform:
        'uppercase',
      letterSpacing: 1,
    },

    title: {
      marginTop: 8,
      color: '#FFFFFF',
      fontWeight: '900',
      fontSize: 29,
    },

    subtitle: {
      marginTop: 10,
      color:
        'rgba(255,255,255,0.82)',
      lineHeight: 21,
    },

    cameraCard: {
      height: 360,
      borderRadius: 26,
      overflow: 'hidden',
      backgroundColor:
        '#000000',
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },

    camera: {
      flex: 1,
    },

    scanOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
    },

    scanFrame: {
      width: 220,
      height: 220,
      borderWidth: 3,
      borderColor:
        '#FFFFFF',
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        'rgba(0,0,0,0.08)',
    },

    scanLabel: {
      color: '#FFFFFF',
      fontWeight: '900',
      fontSize: 20,
      letterSpacing: 2,
    },

    resultCard: {
      backgroundColor:
        COLORS.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },

    resultCardValid: {
      backgroundColor:
        COLORS.successBg,
    },

    resultCardInvalid: {
      backgroundColor:
        COLORS.dangerBg,
    },

    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      gap: 12,
    },

    statusBadge: {
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 6,
      backgroundColor:
        COLORS.cardSoft,
    },

    statusBadgeValid: {
      backgroundColor:
        COLORS.successBg,
    },

    statusBadgeInvalid: {
      backgroundColor:
        COLORS.dangerBg,
    },

    statusBadgeText: {
      color:
        COLORS.muted,
      fontSize: 12,
      fontWeight: '900',
    },

    statusBadgeTextValid: {
      color:
        COLORS.teal,
    },

    statusBadgeTextInvalid: {
      color:
        COLORS.danger,
    },

    statusCode: {
      color:
        COLORS.muted,
      fontWeight: '800',
      fontSize: 12,
    },

    resultText: {
      marginTop: 14,
      color:
        COLORS.text,
      lineHeight: 21,
      fontWeight: '700',
    },

    loadingRow: {
      marginTop: 14,
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
    },

    employeeData: {
      marginTop: 18,
      gap: 10,
    },

    infoRow: {
      borderTopWidth: 1,
      borderTopColor:
        COLORS.border,
      paddingTop: 10,
    },

    infoLabel: {
      color:
        COLORS.muted,
      fontSize: 12,
      fontWeight: '800',
      textTransform:
        'uppercase',
    },

    infoValue: {
      marginTop: 4,
      color:
        COLORS.text,
      fontWeight: '900',
      fontSize: 16,
    },

    retryButton: {
      marginTop: 18,
      backgroundColor:
        COLORS.primary,
      borderRadius: 16,
      padding: 14,
      alignItems: 'center',
    },

    retryButtonText: {
      color: '#FFFFFF',
      fontWeight: '900',
    },

    infoCard: {
      backgroundColor:
        COLORS.card,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },

    infoTitle: {
      color:
        COLORS.text,
      fontWeight: '900',
      fontSize: 16,
    },

    infoText: {
      marginTop: 7,
      color:
        COLORS.muted,
      lineHeight: 20,
    },

    stateCard: {
      width: '100%',
      maxWidth: 380,
      backgroundColor:
        COLORS.card,
      borderRadius: 26,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },

    stateBrand: {
      marginTop: 14,
      color:
        COLORS.primary,
      fontWeight: '900',
      fontSize: 14,
      letterSpacing: 1,
    },

    stateTitle: {
      marginTop: 8,
      color:
        COLORS.text,
      fontWeight: '900',
      fontSize: 22,
      textAlign: 'center',
    },

    stateText: {
      marginTop: 10,
      color:
        COLORS.muted,
      textAlign: 'center',
      lineHeight: 21,
    },

    primaryButton: {
      marginTop: 18,
      width: '100%',
      backgroundColor:
        COLORS.primary,
      borderRadius: 16,
      padding: 14,
      alignItems: 'center',
    },

    primaryButtonText: {
      color: '#FFFFFF',
      fontWeight: '900',
    },
  });
}
