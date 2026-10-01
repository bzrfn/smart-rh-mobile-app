import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

type ChatbotAction = {
  label: string;
  target: string;
  scope: 'web' | 'mobile' | 'both';
};

type ChatbotResponse = {
  asistente?: 'Max';
  categoria: string;
  titulo: string;
  intent?: string;
  confianza?: 'alta' | 'media' | 'baja';
  respuesta: string;
  pasos?: string[];
  preguntas_seguimiento?: string[];
  acciones: ChatbotAction[];
  sugerencias: string[];
  requiere_escalamiento: boolean;
  puede_crear_ticket: boolean;
};

type Message = {
  id: string;
  author: 'user' | 'assistant';
  text: string;
  response?: ChatbotResponse;
};

type FloatingPosition = {
  x: number;
  y: number;
};

const POSITION_STORAGE_KEY = 'smart_rh_max_mobile_position';
const MAX_ICON = require('../../../assets/max-icon.png');
const FLOATING_SIZE = 78;
const EDGE_GAP = 16;

function buildId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDefaultPosition() {
  const size = Dimensions.get('window');

  return {
    x: size.width - FLOATING_SIZE - 18,
    y: size.height - FLOATING_SIZE - 110,
  };
}

function clampPosition(
  position: FloatingPosition,
  size = Dimensions.get('window')
) {
  return {
    x: Math.min(
      Math.max(position.x, EDGE_GAP),
      Math.max(EDGE_GAP, size.width - FLOATING_SIZE - EDGE_GAP)
    ),
    y: Math.min(
      Math.max(position.y, EDGE_GAP + 20),
      Math.max(EDGE_GAP + 20, size.height - FLOATING_SIZE - 90)
    ),
  };
}

function getColors(isDark: boolean) {
  return {
    backdrop: 'rgba(3, 7, 18, 0.58)',
    background: isDark ? '#07111F' : '#F4F7FB',
    card: isDark ? '#101C2E' : '#FFFFFF',
    cardSoft: isDark ? '#16263D' : '#F7FAFC',
    primary: isDark ? '#38BDF8' : '#0A57A4',
    primaryStrong: isDark ? '#0EA5E9' : '#084B8F',
    primarySoft: isDark ? 'rgba(56, 189, 248, 0.14)' : 'rgba(10, 87, 164, 0.10)',
    teal: isDark ? '#2DD4BF' : '#1AAEA6',
    tealSoft: isDark ? 'rgba(45, 212, 191, 0.14)' : 'rgba(26, 174, 166, 0.12)',
    danger: isDark ? '#FDA4AF' : '#B42318',
    dangerBg: isDark ? 'rgba(253, 164, 175, 0.12)' : 'rgba(180, 35, 24, 0.08)',
    text: isDark ? '#F8FAFC' : '#0F172A',
    muted: isDark ? '#B6C5D8' : '#5B6B81',
    border: isDark ? '#2A3B56' : '#D9E1EC',
    white: '#FFFFFF',
  };
}

function isMobileAction(action: ChatbotAction) {
  return action.scope === 'mobile' || action.scope === 'both';
}

function getMobileRoute(target: string) {
  const routes: Record<string, string> = {
    Asistencia: 'Asistencia',
    CalendarioLaboral: 'CalendarioLaboral',
    Vacaciones: 'Vacaciones',
    Incapacidades: 'Incapacidades',
    Documentos: 'Documentos',
    Contratos: 'Contratos',
    Nomina: 'Nomina',
    Soporte: 'Soporte',
    AdminUsuarios: 'AdminUsuarios',
    AdminAsistenciaPendientes: 'AdminAsistenciaPendientes',
    AdminIncapacidadesRevision: 'AdminIncapacidadesRevision',
    VerificarCredencial: 'VerificarCredencial',
  };

  return routes[target] || '';
}

export default function MaxAssistantFloating() {
  const navigation = useNavigation<any>();
  const { user, theme } = useAuth();
  const isDark = theme === 'dark';
  const colors = getColors(isDark);
  const styles = getStyles(isDark);
  const scrollRef = useRef<ScrollView | null>(null);
  const panStartRef = useRef<FloatingPosition>(getDefaultPosition());
  const positionRef = useRef<FloatingPosition>(getDefaultPosition());
  const movedRef = useRef(false);

  const [open, setOpen] = useState(false);
  const [screenSize, setScreenSize] = useState(Dimensions.get('window'));
  const [buttonPosition, setButtonPosition] = useState<FloatingPosition>(
    () => clampPosition(getDefaultPosition())
  );
  const [dragging, setDragging] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: buildId(),
      author: 'assistant',
      text:
        'Hola, soy Max. Cuéntame qué intentas resolver en SMART RH y te ayudo con pasos concretos.',
    },
  ]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [lastQuestion, setLastQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [error, setError] = useState('');

  const userName = useMemo(
    () => `${user?.nombre || ''} ${user?.apellido || ''}`.trim(),
    [user?.apellido, user?.nombre]
  );

  const historyPayload = useMemo(
    () =>
      messages.slice(-6).map((item) => ({
        author: item.author,
        text: item.text,
      })),
    [messages]
  );

  async function loadSuggestions() {
    try {
      const { data } = await api.get('/chatbot/sugerencias');
      setSuggestions(Array.isArray(data?.sugerencias) ? data.sugerencias : []);
    } catch {
      setSuggestions([
        'Max, no puedo registrar mi asistencia',
        'Quiero revisar mi calendario laboral',
        'Necesito levantar un ticket',
      ]);
    }
  }

  useEffect(() => {
    loadSuggestions();
  }, []);

  useEffect(() => {
    positionRef.current = buttonPosition;
  }, [buttonPosition]);

  useEffect(() => {
    let active = true;

    async function loadPosition() {
      try {
        const saved = await AsyncStorage.getItem(POSITION_STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) : null;

        if (
          active &&
          parsed &&
          Number.isFinite(parsed.x) &&
          Number.isFinite(parsed.y)
        ) {
          setButtonPosition(clampPosition(parsed, screenSize));
        }
      } catch {
        setButtonPosition(clampPosition(getDefaultPosition(), screenSize));
      }
    }

    loadPosition();

    return () => {
      active = false;
    };
  }, [screenSize]);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenSize(window);
      setButtonPosition((current) => clampPosition(current, window));
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);

    return () => clearTimeout(timer);
  }, [messages, loading, open]);

  async function sendMessage(nextMessage?: string) {
    const cleanMessage = String(nextMessage || message).trim();

    if (!cleanMessage || loading) return;

    setOpen(true);
    setMessage('');
    setError('');
    setLastQuestion(cleanMessage);
    setMessages((current) => [
      ...current,
      {
        id: buildId(),
        author: 'user',
        text: cleanMessage,
      },
    ]);

    try {
      setLoading(true);

      const { data } = await api.post('/chatbot/mensaje', {
        mensaje: cleanMessage,
        historial: historyPayload,
      });

      const response = data?.respuesta as ChatbotResponse;

      setMessages((current) => [
        ...current,
        {
          id: buildId(),
          author: 'assistant',
          text:
            response?.respuesta ||
            'No pude generar una respuesta segura. Dame un poco más de contexto.',
          response,
        },
      ]);

      if (Array.isArray(response?.sugerencias)) {
        setSuggestions(response.sugerencias);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          'No se pudo contactar a Max. Revisa conexión o intenta de nuevo.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function createTicket() {
    if (!lastQuestion || ticketLoading) return;

    try {
      setTicketLoading(true);
      setError('');

      const { data } = await api.post('/chatbot/mensaje', {
        mensaje: lastQuestion,
        historial: historyPayload,
        crear_ticket: true,
      });

      const ticketId = data?.ticket?._id;

      setMessages((current) => [
        ...current,
        {
          id: buildId(),
          author: 'assistant',
          text: ticketId
            ? `Listo. Creé el ticket con folio ${ticketId}. Puedes darle seguimiento desde Soporte.`
            : 'Listo. Envié la consulta a soporte con el contexto disponible.',
        },
      ]);
    } catch (err: any) {
      Alert.alert(
        'No se pudo crear el ticket',
        err?.response?.data?.message ||
          'Intenta nuevamente o abre Soporte manualmente.'
      );
    } finally {
      setTicketLoading(false);
    }
  }

  function navigateAction(action: ChatbotAction) {
    const route = getMobileRoute(action.target);

    if (!route) {
      Alert.alert(
        'Disponible en portal',
        'Esta acción se realiza desde el portal web.'
      );
      return;
    }

    setOpen(false);
    navigation.navigate(route);
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
        onPanResponderGrant: () => {
          panStartRef.current = buttonPosition;
          movedRef.current = false;
          setDragging(true);
        },
        onPanResponderMove: (_, gesture) => {
          const next = clampPosition(
            {
              x: panStartRef.current.x + gesture.dx,
              y: panStartRef.current.y + gesture.dy,
            },
            screenSize
          );

          if (Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5) {
            movedRef.current = true;
          }

          positionRef.current = next;
          setButtonPosition(next);
        },
        onPanResponderRelease: async () => {
          const next = clampPosition(positionRef.current, screenSize);

          setDragging(false);
          setButtonPosition(next);

          try {
            await AsyncStorage.setItem(
              POSITION_STORAGE_KEY,
              JSON.stringify(next)
            );
          } catch {
            // La posicion es una preferencia visual; si falla, no bloquea el chat.
          }

          if (!movedRef.current) {
            setOpen(true);
          }
        },
        onPanResponderTerminate: () => {
          setDragging(false);
        },
      }),
    [buttonPosition, screenSize]
  );

  return (
    <>
      {!open ? (
        <View
          accessibilityRole="button"
          accessibilityLabel="Abrir Max"
          style={[
            styles.floatingButton,
            {
              left: buttonPosition.x,
              top: buttonPosition.y,
            },
            dragging && styles.floatingButtonDragging,
          ]}
          {...panResponder.panHandlers}
        >
          <Image source={MAX_ICON} style={styles.floatingLogoImage} />
        </View>
      ) : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <Pressable
              style={styles.panel}
              onPress={(event) => event.stopPropagation()}
            >
              <View style={styles.header}>
                <View style={styles.avatar}>
                  <Image source={MAX_ICON} style={styles.avatarImage} />
                </View>
                <View style={styles.headerCopy}>
                  <Text style={styles.kicker}>Asistente interno</Text>
                  <Text style={styles.title}>Max</Text>
                  <Text style={styles.subtitle}>
                    {userName || 'Usuario SMART RH'} · {user?.role || 'empleado'}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar Max"
                  style={styles.closeButton}
                  onPress={() => setOpen(false)}
                >
                  <Text style={styles.closeText}>×</Text>
                </Pressable>
              </View>

              <ScrollView
                ref={scrollRef}
                style={styles.messages}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
              >
                {messages.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.messageBubble,
                      item.author === 'user'
                        ? styles.userBubble
                        : styles.assistantBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        item.author === 'user' && styles.userMessageText,
                      ]}
                    >
                      {item.text}
                    </Text>

                    {item.response?.pasos?.length ? (
                      <View style={styles.stepsWrap}>
                        {item.response.pasos.slice(0, 4).map((step, index) => (
                          <Text key={`${item.id}-step-${index}`} style={styles.stepText}>
                            {index + 1}. {step}
                          </Text>
                        ))}
                      </View>
                    ) : null}

                    {item.response?.acciones?.filter(isMobileAction).length ? (
                      <View style={styles.actionWrap}>
                        {item.response.acciones
                          .filter(isMobileAction)
                          .map((action) => (
                            <Pressable
                              key={`${item.id}-${action.label}`}
                              style={styles.actionButton}
                              onPress={() => navigateAction(action)}
                            >
                              <Text style={styles.actionButtonText}>
                                {action.label}
                              </Text>
                            </Pressable>
                          ))}
                      </View>
                    ) : null}
                  </View>
                ))}

                {loading ? (
                  <View style={[styles.messageBubble, styles.assistantBubble]}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={styles.loadingText}>Max está revisando...</Text>
                  </View>
                ) : null}
              </ScrollView>

              {error ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {suggestions.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.suggestionWrap}
                >
                  {suggestions.slice(0, 5).map((item) => (
                    <Pressable
                      key={item}
                      style={styles.suggestionButton}
                      onPress={() => sendMessage(item)}
                    >
                      <Text style={styles.suggestionText}>{item}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Escribe tu duda..."
                  placeholderTextColor={colors.muted}
                  multiline
                />
                <Pressable
                  style={[
                    styles.sendButton,
                    (!message.trim() || loading) && styles.disabledButton,
                  ]}
                  disabled={!message.trim() || loading}
                  onPress={() => sendMessage()}
                >
                  <Text style={styles.sendButtonText}>Enviar</Text>
                </Pressable>
              </View>

              <Pressable
                style={[
                  styles.ticketButton,
                  (!lastQuestion || ticketLoading) && styles.disabledButton,
                ]}
                disabled={!lastQuestion || ticketLoading}
                onPress={createTicket}
              >
                <Text style={styles.ticketButtonText}>
                  {ticketLoading ? 'Creando ticket...' : 'Crear ticket con contexto'}
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function getStyles(isDark: boolean) {
  const COLORS = getColors(isDark);

  return StyleSheet.create({
    floatingButton: {
      position: 'absolute',
      width: FLOATING_SIZE,
      height: FLOATING_SIZE,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: isDark ? 0.24 : 0.18,
      shadowRadius: 18,
      elevation: 14,
      zIndex: 50,
    },
    floatingButtonDragging: {
      transform: [{ scale: 0.98 }],
      opacity: 0.92,
    },
    floatingLogoImage: {
      width: FLOATING_SIZE,
      height: FLOATING_SIZE,
      borderRadius: 28,
    },
    modalRoot: {
      flex: 1,
    },
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: COLORS.backdrop,
      padding: 14,
    },
    panel: {
      maxHeight: '80%',
      borderRadius: 28,
      overflow: 'hidden',
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.25,
      shadowRadius: 24,
      elevation: 18,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 17,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      backgroundColor: COLORS.cardSoft,
    },
    avatar: {
      width: 58,
      height: 58,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.2 : 0.12,
      shadowRadius: 14,
      elevation: 8,
    },
    avatarImage: {
      width: 58,
      height: 58,
      borderRadius: 20,
    },
    headerCopy: {
      flex: 1,
    },
    kicker: {
      color: COLORS.teal,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    title: {
      color: COLORS.text,
      fontSize: 22,
      fontWeight: '900',
    },
    subtitle: {
      color: COLORS.muted,
      fontSize: 12,
      fontWeight: '700',
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    closeText: {
      color: COLORS.text,
      fontSize: 24,
      fontWeight: '700',
      lineHeight: 26,
    },
    messages: {
      minHeight: 230,
      maxHeight: 390,
      backgroundColor: COLORS.background,
    },
    messagesContent: {
      gap: 10,
      padding: 14,
    },
    messageBubble: {
      maxWidth: '92%',
      borderRadius: 20,
      padding: 13,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    assistantBubble: {
      alignSelf: 'flex-start',
      backgroundColor: COLORS.card,
    },
    messageText: {
      color: COLORS.text,
      fontSize: 14,
      lineHeight: 21,
      fontWeight: '700',
    },
    userMessageText: {
      color: COLORS.white,
    },
    stepsWrap: {
      gap: 6,
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    stepText: {
      color: COLORS.muted,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '700',
    },
    actionWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    actionButton: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: COLORS.primarySoft,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    actionButtonText: {
      color: COLORS.primary,
      fontSize: 12,
      fontWeight: '900',
    },
    loadingText: {
      marginTop: 8,
      color: COLORS.muted,
      fontWeight: '800',
    },
    errorCard: {
      marginHorizontal: 14,
      marginTop: 10,
      borderRadius: 16,
      padding: 12,
      backgroundColor: COLORS.dangerBg,
      borderWidth: 1,
      borderColor: COLORS.danger,
    },
    errorText: {
      color: COLORS.danger,
      fontWeight: '800',
      lineHeight: 19,
    },
    suggestionWrap: {
      gap: 8,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 4,
    },
    suggestionButton: {
      maxWidth: 220,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: COLORS.tealSoft,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    suggestionText: {
      color: COLORS.text,
      fontSize: 12,
      fontWeight: '800',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 9,
      padding: 14,
    },
    input: {
      flex: 1,
      maxHeight: 96,
      minHeight: 44,
      color: COLORS.text,
      fontSize: 14,
      textAlignVertical: 'top',
      backgroundColor: COLORS.cardSoft,
      borderRadius: 18,
      paddingHorizontal: 13,
      paddingVertical: 11,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    sendButton: {
      minWidth: 76,
      borderRadius: 16,
      paddingVertical: 13,
      alignItems: 'center',
      backgroundColor: COLORS.primary,
    },
    sendButtonText: {
      color: COLORS.white,
      fontSize: 13,
      fontWeight: '900',
    },
    ticketButton: {
      marginHorizontal: 14,
      marginBottom: 14,
      borderRadius: 16,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: COLORS.teal,
    },
    ticketButtonText: {
      color: COLORS.white,
      fontSize: 13,
      fontWeight: '900',
    },
    disabledButton: {
      opacity: 0.55,
    },
  });
}
