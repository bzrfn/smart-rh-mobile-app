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
const MAX_ICON = require('../../../assets/max-touch-icon.png');
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

function snapPositionToSide(
  position: FloatingPosition,
  size = Dimensions.get('window')
) {
  const leftX = EDGE_GAP;
  const rightX = Math.max(EDGE_GAP, size.width - FLOATING_SIZE - EDGE_GAP);
  const centerX = position.x + FLOATING_SIZE / 2;

  return clampPosition(
    {
      ...position,
      x: centerX < size.width / 2 ? leftX : rightX,
    },
    size
  );
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
        'Hola, soy Max. Cuéntame qué necesitas resolver en SMART RH y lo revisamos paso a paso.',
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

  const canCreateContextTicket = useMemo(() => {
    const latestAssistant = [...messages]
      .reverse()
      .find((item) => item.author === 'assistant' && item.response);

    return Boolean(
      lastQuestion &&
        latestAssistant?.response?.requiere_escalamiento
    );
  }, [lastQuestion, messages]);

  async function loadSuggestions() {
    try {
      const { data } = await api.get('/chatbot/sugerencias');
      setSuggestions(Array.isArray(data?.sugerencias) ? data.sugerencias : []);
    } catch {
      setSuggestions([
        'Tengo un problema',
        'Revisar mi calendario',
        'Ayuda con asistencia',
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
        createdAt: Date.now(),
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
          createdAt: Date.now(),
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
          createdAt: Date.now(),
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
          panStartRef.current = positionRef.current;
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
          const clampedPosition = clampPosition(positionRef.current, screenSize);
          const next = movedRef.current
            ? snapPositionToSide(clampedPosition, screenSize)
            : clampedPosition;

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
    [screenSize]
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

              <View style={styles.composer}>
                {suggestions.length ? (
                  <View style={styles.suggestionSection}>
                    <Text style={styles.suggestionLabel}>Sugerencias</Text>
                    <View style={styles.suggestionGrid}>
                      {suggestions.slice(0, 3).map((item) => (
                        <Pressable
                          key={item}
                          style={styles.suggestionButton}
                          onPress={() => sendMessage(item)}
                        >
                          <Text style={styles.suggestionText} numberOfLines={2}>
                            {item}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}

                <View style={styles.inputRow}>
<TextInput
                    style={styles.input}
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Pregúntame"
                    placeholderTextColor={colors.muted}
                    multiline
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Enviar mensaje a Max"
                    style={[
                      styles.sendButton,
                      (!message.trim() || loading) && styles.disabledButton,
                    ]}
                    disabled={!message.trim() || loading}
                    onPress={() => sendMessage()}
                  >
                    <Text style={styles.sendButtonText}>↑</Text>
                  </Pressable>
                </View>

                {canCreateContextTicket ? (
                  <Pressable
                    style={[
                      styles.ticketButton,
                      ticketLoading && styles.disabledButton,
                    ]}
                    disabled={ticketLoading}
                    onPress={createTicket}
                  >
                    <Text style={styles.ticketButtonText}>
                      {ticketLoading ? 'Creando ticket...' : 'Crear ticket con contexto'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
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
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      shadowColor: '#FACC15',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: isDark ? 0.22 : 0.18,
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
      borderRadius: 999,
    },
    modalRoot: {
      flex: 1,
    },
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: COLORS.backdrop,
      paddingHorizontal: 10,
      paddingTop: 38,
      paddingBottom: 10,
    },
    panel: {
      height: '88%',
      maxHeight: '90%',
      borderRadius: 26,
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
      gap: 11,
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      backgroundColor: COLORS.cardSoft,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      shadowColor: '#FACC15',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.18 : 0.12,
      shadowRadius: 14,
      elevation: 8,
    },
    avatarImage: {
      width: 48,
      height: 48,
      borderRadius: 999,
    },
    headerCopy: {
      flex: 1,
    },
    kicker: {
      color: COLORS.teal,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    title: {
      color: COLORS.text,
      fontSize: 20,
      fontWeight: '900',
    },
    subtitle: {
      color: COLORS.muted,
      fontSize: 11,
      fontWeight: '700',
    },
    closeButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
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
      flex: 1,
      minHeight: 0,
      backgroundColor: COLORS.background,
    },
    messagesContent: {
      gap: 8,
      padding: 12,
      paddingBottom: 16,
    },
    messageBubble: {
      maxWidth: '88%',
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 10,
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
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '600',
    },
    userMessageText: {
      color: COLORS.white,
    },
    stepsWrap: {
      gap: 5,
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    stepText: {
      color: COLORS.muted,
      fontSize: 11,
      lineHeight: 16,
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
    composer: {
      gap: 10,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 12,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      backgroundColor: COLORS.card,
    },
    errorCard: {
      marginHorizontal: 12,
      marginTop: 8,
      borderRadius: 16,
      padding: 10,
      backgroundColor: COLORS.dangerBg,
      borderWidth: 1,
      borderColor: COLORS.danger,
    },
    errorText: {
      color: COLORS.danger,
      fontWeight: '800',
      fontSize: 12,
      lineHeight: 17,
    },
    suggestionSection: {
      gap: 8,
    },
    suggestionLabel: {
      color: COLORS.muted,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    suggestionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    suggestionButton: {
      minHeight: 42,
      width: '48%',
      justifyContent: 'center',
      borderRadius: 16,
      paddingHorizontal: 11,
      paddingVertical: 8,
      backgroundColor: COLORS.cardSoft,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    suggestionText: {
      color: COLORS.text,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '800',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 24,
      paddingVertical: 6,
      paddingLeft: 14,
      paddingRight: 6,
      backgroundColor: COLORS.cardSoft,
    },
    input: {
      flex: 1,
      maxHeight: 84,
      minHeight: 36,
      color: COLORS.text,
      fontSize: 13,
      textAlignVertical: 'top',
      backgroundColor: 'transparent',
      paddingHorizontal: 4,
      paddingVertical: 8,
    },
    sendButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primary,
    },
    sendButtonText: {
      color: COLORS.white,
      fontSize: 20,
      fontWeight: '900',
      lineHeight: 22,
    },
    ticketButton: {
      borderRadius: 16,
      paddingVertical: 10,
      alignItems: 'center',
      backgroundColor: COLORS.tealSoft,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    ticketButtonText: {
      color: COLORS.teal,
      fontSize: 12,
      fontWeight: '900',
    },
    disabledButton: {
      opacity: 0.55,
    },
  });
}
