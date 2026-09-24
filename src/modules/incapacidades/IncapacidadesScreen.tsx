import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import DateTimePicker from '@react-native-community/datetimepicker';

import * as ImagePicker from 'expo-image-picker';

import {
  api,
} from '../../services/api';

import {
  sharePrivateMedia,
} from '../../services/privateMedia';

import {
  useAuth,
} from '../../contexts/AuthContext';


type EstadoIncapacidad =
  | 'pendiente'
  | 'aprobada'
  | 'rechazada';


type Incapacidad = {
  id: number;
  usuario_id: number;

  fecha_inicio: string;
  fecha_fin: string;
  dias_calculados: number;

  motivo: string;

  estado:
    EstadoIncapacidad;

  comprobante_key?:
    string | null;

  comprobante_nombre?:
    string | null;

  comprobante_mime?:
    string | null;

  comprobante_tamano?:
    number | null;

  observaciones_admin?:
    string | null;

  revisado_por_admin_id?:
    number | null;

  revisado_at?:
    string | null;

  admin_nombre?:
    string | null;

  admin_apellido?:
    string | null;

  created_at?:
    string | null;
};


type ProofDraft = {
  base64: string;
  filename: string;
  mime:
    | 'image/jpeg'
    | 'image/png';
  size:
    number | null;
};


const MAX_PROOF_BYTES =
  5 * 1024 * 1024;


function dateToApi(
  value: Date
): string {
  const year =
    value.getFullYear();

  const month =
    String(
      value.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  const day =
    String(
      value.getDate()
    ).padStart(
      2,
      '0'
    );

  return `${year}-${month}-${day}`;
}


function formatDate(
  value?: string | null
): string {
  if (!value) {
    return '—';
  }

  const clean =
    String(value)
      .slice(
        0,
        10
      );

  const parts =
    clean.split('-');

  if (
    parts.length === 3
  ) {
    return (
      `${parts[2]}/${parts[1]}/${parts[0]}`
    );
  }

  return clean;
}


function calculateInclusiveDays(
  start: Date,
  end: Date
): number {
  const startUtc =
    Date.UTC(
      start.getFullYear(),
      start.getMonth(),
      start.getDate()
    );

  const endUtc =
    Date.UTC(
      end.getFullYear(),
      end.getMonth(),
      end.getDate()
    );

  if (
    endUtc <
    startUtc
  ) {
    return 0;
  }

  return (
    Math.floor(
      (
        endUtc -
        startUtc
      ) /
      86_400_000
    ) + 1
  );
}


function statusLabel(
  estado: EstadoIncapacidad
): string {
  if (
    estado ===
    'aprobada'
  ) {
    return 'Aprobada';
  }

  if (
    estado ===
    'rechazada'
  ) {
    return 'Rechazada';
  }

  return 'Pendiente';
}


function proofUrl(
  item: Incapacidad
): string | null {
  const key =
    String(
      item.comprobante_key ||
      ''
    )
      .trim()
      .replace(
        /^\/+/,
        ''
      );

  if (!key) {
    return null;
  }

  if (
    key.startsWith(
      'uploads/'
    )
  ) {
    return `/${key}`;
  }

  return `/uploads/${key}`;
}


function normalizeCreated(
  data: any
): Incapacidad | null {
  if (
    data?.incapacidad &&
    typeof data.incapacidad ===
      'object'
  ) {
    return data.incapacidad;
  }

  if (
    data?.data &&
    typeof data.data ===
      'object'
  ) {
    return data.data;
  }

  if (
    data &&
    typeof data ===
      'object' &&
    Number(data.id) > 0
  ) {
    return data;
  }

  return null;
}


export default function IncapacidadesScreen() {
  const {
    theme,
    token,
  } =
    useAuth();

  const isDark =
    theme === 'dark';

  const colors =
    getColors(
      isDark
    );

  const styles =
    getStyles(
      isDark
    );

  const [
    items,
    setItems,
  ] =
    useState<Incapacidad[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false
    );

  const [
    submitting,
    setSubmitting,
  ] =
    useState(
      false
    );

  const [
    attachingId,
    setAttachingId,
  ] =
    useState<number | null>(
      null
    );

  const [
    detailLoadingId,
    setDetailLoadingId,
  ] =
    useState<number | null>(
      null
    );

  const [
    selected,
    setSelected,
  ] =
    useState<Incapacidad | null>(
      null
    );

  const [
    startDate,
    setStartDate,
  ] =
    useState(
      new Date()
    );

  const [
    endDate,
    setEndDate,
  ] =
    useState(
      new Date()
    );

  const [
    showStartPicker,
    setShowStartPicker,
  ] =
    useState(
      false
    );

  const [
    showEndPicker,
    setShowEndPicker,
  ] =
    useState(
      false
    );

  const [
    motivo,
    setMotivo,
  ] =
    useState(
      ''
    );

  const [
    proof,
    setProof,
  ] =
    useState<ProofDraft | null>(
      null
    );


  const load =
    useCallback(
      async (
        refresh = false
      ) => {
        try {
          if (refresh) {
            setRefreshing(
              true
            );
          } else {
            setLoading(
              true
            );
          }

          const {
            data,
          } =
            await api.get(
              '/incapacidades/mias'
            );

          const list =
            Array.isArray(
              data?.incapacidades
            )
              ? data.incapacidades
              : [];

          setItems(
            list
          );
        } catch (error: any) {
          Alert.alert(
            'No se pudo consultar',
            error?.response?.data?.message ||
              'No se pudieron cargar tus incapacidades.'
          );
        } finally {
          setLoading(
            false
          );

          setRefreshing(
            false
          );
        }
      },
      []
    );


  useEffect(
    () => {
      load();
    },
    [load]
  );


  const summary =
    useMemo(
      () => ({
        total:
          items.length,

        pendientes:
          items.filter(
            item =>
              item.estado ===
              'pendiente'
          ).length,

        aprobadas:
          items.filter(
            item =>
              item.estado ===
              'aprobada'
          ).length,

        rechazadas:
          items.filter(
            item =>
              item.estado ===
              'rechazada'
          ).length,
      }),
      [items]
    );


  const previewDays =
    useMemo(
      () =>
        calculateInclusiveDays(
          startDate,
          endDate
        ),
      [
        startDate,
        endDate,
      ]
    );


  async function pickProof():
    Promise<ProofDraft | null> {
    const permission =
      await ImagePicker
        .requestMediaLibraryPermissionsAsync();

    if (
      !permission.granted
    ) {
      Alert.alert(
        'Permiso requerido',
        'SMART RH necesita acceso a tus fotos para seleccionar el comprobante médico.'
      );

      return null;
    }

    const result =
      await ImagePicker
        .launchImageLibraryAsync({
          allowsEditing: false,
          base64: true,
          quality: 0.85,
        });

    if (
      result.canceled ||
      !result.assets?.length
    ) {
      return null;
    }

    const asset =
      result.assets[0];

    const mime =
      String(
        asset.mimeType ||
        ''
      ).toLowerCase();

    if (
      mime !==
        'image/jpeg' &&
      mime !==
        'image/png'
    ) {
      Alert.alert(
        'Formato no permitido',
        'Selecciona una imagen JPG o PNG.'
      );

      return null;
    }

    if (
      !asset.base64
    ) {
      Alert.alert(
        'Archivo inválido',
        'No fue posible leer el comprobante seleccionado.'
      );

      return null;
    }

    const size =
      typeof asset.fileSize ===
      'number'
        ? asset.fileSize
        : null;

    if (
      size !== null &&
      size >
        MAX_PROOF_BYTES
    ) {
      Alert.alert(
        'Archivo demasiado grande',
        'El comprobante debe pesar como máximo 5 MB.'
      );

      return null;
    }

    const extension =
      mime ===
        'image/png'
        ? 'png'
        : 'jpg';

    const filename =
      asset.fileName?.trim() ||
      `comprobante.${extension}`;

    return {
      base64:
        asset.base64,

      filename,

      mime,

      size,
    };
  }


  async function chooseProof() {
    try {
      const picked =
        await pickProof();

      if (picked) {
        setProof(
          picked
        );
      }
    } catch (error) {
      Alert.alert(
        'No se pudo seleccionar',
        error instanceof Error
          ? error.message
          : 'No fue posible seleccionar el comprobante.'
      );
    }
  }


  async function uploadProof(
    incapacidadId: number,
    file: ProofDraft
  ) {
    await api.patch(
      `/incapacidades/${incapacidadId}/comprobante`,
      {
        base64:
          file.base64,

        filename:
          file.filename,
      }
    );
  }


  async function submit() {
    if (submitting) {
      return;
    }

    const normalizedMotivo =
      motivo.trim();

    if (
      !normalizedMotivo
    ) {
      Alert.alert(
        'Motivo requerido',
        'Describe el motivo de la incapacidad.'
      );

      return;
    }

    if (
      previewDays <= 0
    ) {
      Alert.alert(
        'Fechas inválidas',
        'La fecha final no puede ser anterior a la fecha inicial.'
      );

      return;
    }

    try {
      setSubmitting(
        true
      );

      const {
        data,
      } =
        await api.post(
          '/incapacidades',
          {
            fecha_inicio:
              dateToApi(
                startDate
              ),

            fecha_fin:
              dateToApi(
                endDate
              ),

            motivo:
              normalizedMotivo,
          }
        );

      const created =
        normalizeCreated(
          data
        );

      if (
        !created?.id
      ) {
        throw new Error(
          'El backend no devolvió la incapacidad registrada.'
        );
      }

      if (proof) {
        try {
          await uploadProof(
            Number(
              created.id
            ),
            proof
          );
        } catch (error: any) {
          await load();

          setMotivo(
            ''
          );

          setProof(
            null
          );

          setStartDate(
            new Date()
          );

          setEndDate(
            new Date()
          );

          Alert.alert(
            'Solicitud registrada',
            error?.response?.data?.message
              ? (
                  'La incapacidad se registró, pero el comprobante no pudo adjuntarse. ' +
                  'Puedes volver a adjuntarlo desde la solicitud pendiente.'
                )
              : (
                  'La incapacidad se registró, pero el comprobante no pudo adjuntarse. ' +
                  'Puedes volver a intentarlo desde la solicitud pendiente.'
                )
          );

          return;
        }
      }

      setMotivo(
        ''
      );

      setProof(
        null
      );

      setStartDate(
        new Date()
      );

      setEndDate(
        new Date()
      );

      await load();

      Alert.alert(
        'Solicitud registrada',
        proof
          ? 'La incapacidad y su comprobante se registraron correctamente.'
          : 'La incapacidad se registró correctamente.'
      );
    } catch (error: any) {
      Alert.alert(
        'No se pudo registrar',
        error?.response?.data?.message ||
          (
            error instanceof Error
              ? error.message
              : 'No fue posible registrar la incapacidad.'
          )
      );
    } finally {
      setSubmitting(
        false
      );
    }
  }


  async function attachToExisting(
    id: number
  ) {
    if (
      attachingId !==
      null
    ) {
      return;
    }

    try {
      const picked =
        await pickProof();

      if (!picked) {
        return;
      }

      setAttachingId(
        id
      );

      await uploadProof(
        id,
        picked
      );

      await load();

      if (
        selected?.id ===
        id
      ) {
        await openDetail(
          id
        );
      }

      Alert.alert(
        'Comprobante adjuntado',
        'El comprobante médico se agregó correctamente.'
      );
    } catch (error: any) {
      Alert.alert(
        'No se pudo adjuntar',
        error?.response?.data?.message ||
          'No fue posible adjuntar el comprobante.'
      );
    } finally {
      setAttachingId(
        null
      );
    }
  }


  async function openDetail(
    id: number
  ) {
    try {
      setDetailLoadingId(
        id
      );

      const {
        data,
      } =
        await api.get(
          `/incapacidades/${id}`
        );

      const detail =
        data?.incapacidad;

      if (!detail) {
        throw new Error(
          'Detalle no disponible.'
        );
      }

      setSelected(
        detail
      );
    } catch (error: any) {
      Alert.alert(
        'No se pudo consultar',
        error?.response?.data?.message ||
          'No se pudo obtener el detalle de la incapacidad.'
      );
    } finally {
      setDetailLoadingId(
        null
      );
    }
  }


  async function openProof(
    item: Incapacidad
  ) {
    const url =
      proofUrl(
        item
      );

    if (!url) {
      Alert.alert(
        'Sin comprobante',
        'Esta incapacidad todavía no tiene comprobante.'
      );

      return;
    }

    try {
      await sharePrivateMedia(
        url,
        token,
        'SMART RH - Comprobante médico'
      );
    } catch (error) {
      Alert.alert(
        'No se pudo abrir',
        error instanceof Error
          ? error.message
          : 'No fue posible abrir el comprobante.'
      );
    }
  }


  return (
    <SafeAreaView
      style={styles.safe}
    >
      <ScrollView
        contentContainerStyle={
          styles.container
        }
        showsVerticalScrollIndicator={
          false
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={
              () =>
                load(
                  true
                )
            }
            tintColor={
              colors.primary
            }
          />
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
            Salud laboral
          </Text>

          <Text
            style={
              styles.title
            }
          >
            Incapacidades
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Registra una incapacidad médica,
            adjunta tu comprobante y consulta
            la resolución de Recursos Humanos.
          </Text>
        </View>

        <View
          style={
            styles.statsGrid
          }
        >
          <StatCard
            label="Total"
            value={
              summary.total
            }
            styles={
              styles
            }
          />

          <StatCard
            label="Pendientes"
            value={
              summary.pendientes
            }
            styles={
              styles
            }
          />

          <StatCard
            label="Aprobadas"
            value={
              summary.aprobadas
            }
            styles={
              styles
            }
          />

          <StatCard
            label="Rechazadas"
            value={
              summary.rechazadas
            }
            styles={
              styles
            }
          />
        </View>

        <View
          style={
            styles.card
          }
        >
          <Text
            style={
              styles.sectionEyebrow
            }
          >
            Nueva solicitud
          </Text>

          <Text
            style={
              styles.sectionTitle
            }
          >
            Registrar incapacidad
          </Text>

          <Text
            style={
              styles.sectionText
            }
          >
            Selecciona el periodo indicado
            por el documento médico. SMART RH
            calculará los días de forma
            automática en el servidor.
          </Text>

          <Text
            style={
              styles.label
            }
          >
            Fecha inicial
          </Text>

          <Pressable
            style={
              styles.dateButton
            }
            onPress={
              () =>
                setShowStartPicker(
                  true
                )
            }
          >
            <Text
              style={
                styles.dateButtonText
              }
            >
              {formatDate(
                dateToApi(
                  startDate
                )
              )}
            </Text>
          </Pressable>

          {showStartPicker && (
            <DateTimePicker
              value={
                startDate
              }
              mode="date"
              maximumDate={
                endDate
              }
              onChange={
                (
                  _event,
                  value
                ) => {
                  setShowStartPicker(
                    false
                  );

                  if (value) {
                    setStartDate(
                      value
                    );
                  }
                }
              }
            />
          )}

          <Text
            style={
              styles.label
            }
          >
            Fecha final
          </Text>

          <Pressable
            style={
              styles.dateButton
            }
            onPress={
              () =>
                setShowEndPicker(
                  true
                )
            }
          >
            <Text
              style={
                styles.dateButtonText
              }
            >
              {formatDate(
                dateToApi(
                  endDate
                )
              )}
            </Text>
          </Pressable>

          {showEndPicker && (
            <DateTimePicker
              value={
                endDate
              }
              mode="date"
              minimumDate={
                startDate
              }
              onChange={
                (
                  _event,
                  value
                ) => {
                  setShowEndPicker(
                    false
                  );

                  if (value) {
                    setEndDate(
                      value
                    );
                  }
                }
              }
            />
          )}

          <View
            style={
              styles.daysPreview
            }
          >
            <Text
              style={
                styles.daysPreviewLabel
              }
            >
              Duración estimada
            </Text>

            <Text
              style={
                styles.daysPreviewValue
              }
            >
              {previewDays > 0
                ? `${previewDays} día${previewDays === 1 ? '' : 's'}`
                : 'Revisa las fechas'}
            </Text>
          </View>

          <Text
            style={
              styles.label
            }
          >
            Motivo
          </Text>

          <TextInput
            value={
              motivo
            }
            onChangeText={
              setMotivo
            }
            multiline
            textAlignVertical="top"
            placeholder="Describe brevemente la incapacidad o indicación médica."
            placeholderTextColor={
              colors.muted
            }
            style={[
              styles.input,
              styles.textarea,
            ]}
          />

          <Text
            style={
              styles.label
            }
          >
            Comprobante médico
          </Text>

          <Pressable
            style={
              styles.secondaryButton
            }
            onPress={
              chooseProof
            }
          >
            <Text
              style={
                styles.secondaryButtonText
              }
            >
              {proof
                ? 'Cambiar comprobante'
                : 'Seleccionar JPG o PNG'}
            </Text>
          </Pressable>

          {proof && (
            <View
              style={
                styles.fileCard
              }
            >
              <Text
                style={
                  styles.fileName
                }
              >
                {proof.filename}
              </Text>

              <Text
                style={
                  styles.fileMeta
                }
              >
                {proof.mime}
                {proof.size
                  ? ` · ${(proof.size / 1024 / 1024).toFixed(2)} MB`
                  : ''}
              </Text>

              <Pressable
                onPress={
                  () =>
                    setProof(
                      null
                    )
                }
              >
                <Text
                  style={
                    styles.removeText
                  }
                >
                  Quitar archivo
                </Text>
              </Pressable>
            </View>
          )}

          <Pressable
            style={[
              styles.primaryButton,
              submitting &&
                styles.buttonDisabled,
            ]}
            disabled={
              submitting
            }
            onPress={
              submit
            }
          >
            <Text
              style={
                styles.primaryButtonText
              }
            >
              {submitting
                ? 'Registrando...'
                : 'Registrar incapacidad'}
            </Text>
          </Pressable>
        </View>

        <View
          style={
            styles.card
          }
        >
          <View
            style={
              styles.sectionHeader
            }
          >
            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.sectionEyebrow
                }
              >
                Seguimiento
              </Text>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                Mis incapacidades
              </Text>
            </View>

            <Pressable
              style={
                styles.refreshButton
              }
              onPress={
                () =>
                  load(
                    true
                  )
              }
            >
              <Text
                style={
                  styles.refreshButtonText
                }
              >
                Actualizar
              </Text>
            </Pressable>
          </View>

          {loading ? (
            <View
              style={
                styles.loadingBox
              }
            >
              <ActivityIndicator
                color={
                  colors.primary
                }
              />

              <Text
                style={
                  styles.sectionText
                }
              >
                Consultando solicitudes...
              </Text>
            </View>
          ) : items.length ===
            0 ? (
            <View
              style={
                styles.emptyBox
              }
            >
              <Text
                style={
                  styles.emptyTitle
                }
              >
                Sin incapacidades
              </Text>

              <Text
                style={
                  styles.sectionText
                }
              >
                Tus solicitudes aparecerán
                aquí después de registrarlas.
              </Text>
            </View>
          ) : (
            items.map(
              item => (
                <View
                  key={
                    item.id
                  }
                  style={
                    styles.requestCard
                  }
                >
                  <View
                    style={
                      styles.requestHeader
                    }
                  >
                    <View
                      style={{
                        flex: 1,
                      }}
                    >
                      <Text
                        style={
                          styles.requestTitle
                        }
                      >
                        Incapacidad #{item.id}
                      </Text>

                      <Text
                        style={
                          styles.requestPeriod
                        }
                      >
                        {formatDate(
                          item.fecha_inicio
                        )}
                        {' → '}
                        {formatDate(
                          item.fecha_fin
                        )}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        item.estado ===
                          'aprobada'
                          ? styles.statusApproved
                          : item.estado ===
                              'rechazada'
                            ? styles.statusRejected
                            : styles.statusPending,
                      ]}
                    >
                      <Text
                        style={
                          styles.statusText
                        }
                      >
                        {statusLabel(
                          item.estado
                        )}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={
                      styles.requestText
                    }
                  >
                    {item.motivo}
                  </Text>

                  <View
                    style={
                      styles.metricRow
                    }
                  >
                    <Metric
                      label="Días"
                      value={
                        String(
                          item.dias_calculados
                        )
                      }
                      styles={
                        styles
                      }
                    />

                    <Metric
                      label="Comprobante"
                      value={
                        item.comprobante_key
                          ? 'Adjunto'
                          : 'Pendiente'
                      }
                      styles={
                        styles
                      }
                    />
                  </View>

                  <View
                    style={
                      styles.actionRow
                    }
                  >
                    <Pressable
                      style={
                        styles.smallButton
                      }
                      disabled={
                        detailLoadingId ===
                        item.id
                      }
                      onPress={
                        () =>
                          openDetail(
                            item.id
                          )
                      }
                    >
                      <Text
                        style={
                          styles.smallButtonText
                        }
                      >
                        {detailLoadingId ===
                        item.id
                          ? 'Consultando...'
                          : 'Ver detalle'}
                      </Text>
                    </Pressable>

                    {item.comprobante_key && (
                      <Pressable
                        style={
                          styles.smallButtonSecondary
                        }
                        onPress={
                          () =>
                            openProof(
                              item
                            )
                        }
                      >
                        <Text
                          style={
                            styles.smallButtonSecondaryText
                          }
                        >
                          Ver comprobante
                        </Text>
                      </Pressable>
                    )}

                    {item.estado ===
                      'pendiente' &&
                      !item.comprobante_key && (
                        <Pressable
                          style={
                            styles.smallButtonSecondary
                          }
                          disabled={
                            attachingId ===
                            item.id
                          }
                          onPress={
                            () =>
                              attachToExisting(
                                item.id
                              )
                          }
                        >
                          <Text
                            style={
                              styles.smallButtonSecondaryText
                            }
                          >
                            {attachingId ===
                            item.id
                              ? 'Adjuntando...'
                              : 'Adjuntar comprobante'}
                          </Text>
                        </Pressable>
                      )}
                  </View>
                </View>
              )
            )
          )}
        </View>

        {selected && (
          <View
            style={
              styles.card
            }
          >
            <View
              style={
                styles.sectionHeader
              }
            >
              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    styles.sectionEyebrow
                  }
                >
                  Detalle
                </Text>

                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Incapacidad #{selected.id}
                </Text>
              </View>

              <Pressable
                style={
                  styles.refreshButton
                }
                onPress={
                  () =>
                    setSelected(
                      null
                    )
                }
              >
                <Text
                  style={
                    styles.refreshButtonText
                  }
                >
                  Cerrar
                </Text>
              </Pressable>
            </View>

            <DetailRow
              label="Estado"
              value={
                statusLabel(
                  selected.estado
                )
              }
              styles={
                styles
              }
            />

            <DetailRow
              label="Periodo"
              value={
                `${formatDate(
                  selected.fecha_inicio
                )} → ${formatDate(
                  selected.fecha_fin
                )}`
              }
              styles={
                styles
              }
            />

            <DetailRow
              label="Días"
              value={
                String(
                  selected.dias_calculados
                )
              }
              styles={
                styles
              }
            />

            <DetailRow
              label="Motivo"
              value={
                selected.motivo
              }
              styles={
                styles
              }
            />

            <DetailRow
              label="Resolución de RH"
              value={
                selected.observaciones_admin ||
                (
                  selected.estado ===
                  'pendiente'
                    ? 'Pendiente de revisión.'
                    : 'Sin observaciones.'
                )
              }
              styles={
                styles
              }
            />

            {selected.comprobante_key && (
              <Pressable
                style={
                  styles.secondaryButton
                }
                onPress={
                  () =>
                    openProof(
                      selected
                    )
                }
              >
                <Text
                  style={
                    styles.secondaryButtonText
                  }
                >
                  Abrir comprobante médico
                </Text>
              </Pressable>
            )}

            {selected.estado ===
              'pendiente' &&
              !selected.comprobante_key && (
                <Pressable
                  style={
                    styles.secondaryButton
                  }
                  disabled={
                    attachingId ===
                    selected.id
                  }
                  onPress={
                    () =>
                      attachToExisting(
                        selected.id
                      )
                  }
                >
                  <Text
                    style={
                      styles.secondaryButtonText
                    }
                  >
                    {attachingId ===
                    selected.id
                      ? 'Adjuntando...'
                      : 'Adjuntar comprobante'}
                  </Text>
                </Pressable>
              )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}


function StatCard({
  label,
  value,
  styles,
}: {
  label: string;
  value: number;
  styles: any;
}) {
  return (
    <View
      style={
        styles.statCard
      }
    >
      <Text
        style={
          styles.statValue
        }
      >
        {value}
      </Text>

      <Text
        style={
          styles.statLabel
        }
      >
        {label}
      </Text>
    </View>
  );
}


function Metric({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: any;
}) {
  return (
    <View
      style={
        styles.metric
      }
    >
      <Text
        style={
          styles.metricLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.metricValue
        }
      >
        {value}
      </Text>
    </View>
  );
}


function DetailRow({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: any;
}) {
  return (
    <View
      style={
        styles.detailRow
      }
    >
      <Text
        style={
          styles.detailLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.detailValue
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

    primarySoft:
      isDark
        ? '#0C2B45'
        : '#E8F1FA',

    teal:
      isDark
        ? '#2DD4BF'
        : '#0F9F93',

    tealSoft:
      isDark
        ? '#123A38'
        : '#E5F8F4',

    danger:
      isDark
        ? '#FF8A8A'
        : '#C93D4B',

    dangerSoft:
      isDark
        ? '#431D28'
        : '#FDECEE',

    warning:
      isDark
        ? '#F5C96A'
        : '#9A6500',

    warningSoft:
      isDark
        ? '#43341C'
        : '#FFF5D8',

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
  };
}


function getStyles(
  isDark: boolean
) {
  const C =
    getColors(
      isDark
    );

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor:
        C.background,
    },

    container: {
      padding: 20,
      paddingBottom: 48,
      gap: 16,
      backgroundColor:
        C.background,
    },

    hero: {
      padding: 24,
      borderRadius: 28,
      backgroundColor:
        C.primary,
    },

    eyebrow: {
      color:
        'rgba(255,255,255,0.78)',
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform:
        'uppercase',
    },

    title: {
      marginTop: 8,
      color: '#FFFFFF',
      fontSize: 30,
      fontWeight: '900',
    },

    subtitle: {
      marginTop: 10,
      color:
        'rgba(255,255,255,0.88)',
      lineHeight: 22,
    },

    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },

    statCard: {
      width: '48%',
      flexGrow: 1,
      padding: 16,
      borderWidth: 1,
      borderColor:
        C.border,
      borderRadius: 20,
      backgroundColor:
        C.card,
    },

    statValue: {
      color: C.primary,
      fontSize: 26,
      fontWeight: '900',
    },

    statLabel: {
      marginTop: 4,
      color: C.muted,
      fontWeight: '700',
    },

    card: {
      padding: 18,
      borderWidth: 1,
      borderColor:
        C.border,
      borderRadius: 24,
      backgroundColor:
        C.card,
      gap: 12,
    },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },

    sectionEyebrow: {
      color: C.primary,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform:
        'uppercase',
    },

    sectionTitle: {
      marginTop: 3,
      color: C.text,
      fontSize: 21,
      fontWeight: '900',
    },

    sectionText: {
      color: C.muted,
      lineHeight: 21,
    },

    label: {
      marginTop: 4,
      color: C.text,
      fontWeight: '800',
    },

    input: {
      minHeight: 48,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: C.text,
      borderWidth: 1,
      borderColor:
        C.border,
      borderRadius: 15,
      backgroundColor:
        C.cardSoft,
    },

    textarea: {
      minHeight: 110,
    },

    dateButton: {
      padding: 14,
      borderWidth: 1,
      borderColor:
        C.border,
      borderRadius: 15,
      backgroundColor:
        C.cardSoft,
    },

    dateButtonText: {
      color: C.text,
      fontWeight: '800',
    },

    daysPreview: {
      padding: 14,
      borderRadius: 16,
      backgroundColor:
        C.primarySoft,
    },

    daysPreviewLabel: {
      color: C.muted,
      fontSize: 12,
      fontWeight: '700',
    },

    daysPreviewValue: {
      marginTop: 3,
      color: C.primary,
      fontSize: 20,
      fontWeight: '900',
    },

    primaryButton: {
      marginTop: 4,
      paddingVertical: 15,
      paddingHorizontal: 18,
      alignItems: 'center',
      borderRadius: 16,
      backgroundColor:
        C.primary,
    },

    primaryButtonText: {
      color: '#FFFFFF',
      fontWeight: '900',
    },

    secondaryButton: {
      paddingVertical: 13,
      paddingHorizontal: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor:
        C.primary,
      borderRadius: 15,
      backgroundColor:
        C.primarySoft,
    },

    secondaryButtonText: {
      color: C.primary,
      fontWeight: '900',
    },

    buttonDisabled: {
      opacity: 0.55,
    },

    fileCard: {
      padding: 14,
      borderWidth: 1,
      borderColor:
        C.border,
      borderRadius: 16,
      backgroundColor:
        C.cardSoft,
    },

    fileName: {
      color: C.text,
      fontWeight: '800',
    },

    fileMeta: {
      marginTop: 4,
      color: C.muted,
      fontSize: 12,
    },

    removeText: {
      marginTop: 10,
      color: C.danger,
      fontWeight: '800',
    },

    refreshButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor:
        C.primarySoft,
    },

    refreshButtonText: {
      color: C.primary,
      fontSize: 12,
      fontWeight: '900',
    },

    loadingBox: {
      minHeight: 100,
      alignItems: 'center',
      justifyContent:
        'center',
      gap: 10,
    },

    emptyBox: {
      paddingVertical: 24,
      alignItems: 'center',
    },

    emptyTitle: {
      color: C.text,
      fontSize: 18,
      fontWeight: '900',
    },

    requestCard: {
      padding: 15,
      borderWidth: 1,
      borderColor:
        C.border,
      borderRadius: 18,
      backgroundColor:
        C.cardSoft,
      gap: 12,
    },

    requestHeader: {
      flexDirection: 'row',
      alignItems:
        'flex-start',
      gap: 10,
    },

    requestTitle: {
      color: C.text,
      fontSize: 16,
      fontWeight: '900',
    },

    requestPeriod: {
      marginTop: 4,
      color: C.muted,
      fontSize: 12,
    },

    requestText: {
      color: C.text,
      lineHeight: 20,
    },

    statusBadge: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
    },

    statusPending: {
      backgroundColor:
        C.warningSoft,
    },

    statusApproved: {
      backgroundColor:
        C.tealSoft,
    },

    statusRejected: {
      backgroundColor:
        C.dangerSoft,
    },

    statusText: {
      color: C.text,
      fontSize: 10,
      fontWeight: '900',
      textTransform:
        'uppercase',
    },

    metricRow: {
      flexDirection: 'row',
      gap: 10,
    },

    metric: {
      flex: 1,
      padding: 11,
      borderRadius: 13,
      backgroundColor:
        C.card,
    },

    metricLabel: {
      color: C.muted,
      fontSize: 11,
      fontWeight: '700',
    },

    metricValue: {
      marginTop: 3,
      color: C.text,
      fontWeight: '900',
    },

    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },

    smallButton: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor:
        C.primary,
    },

    smallButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
    },

    smallButtonSecondary: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor:
        C.primary,
      borderRadius: 12,
      backgroundColor:
        C.primarySoft,
    },

    smallButtonSecondaryText: {
      color: C.primary,
      fontSize: 12,
      fontWeight: '900',
    },

    detailRow: {
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor:
        C.border,
    },

    detailLabel: {
      color: C.muted,
      fontSize: 12,
      fontWeight: '700',
    },

    detailValue: {
      marginTop: 4,
      color: C.text,
      lineHeight: 20,
      fontWeight: '700',
    },
  });
}
