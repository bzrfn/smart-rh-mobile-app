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

const MAX_MOBILE_HISTORY_KEY = 'smart-rh:max:mobile-history:v1';
const MAX_MOBILE_SESSIONS_KEY = 'smart-rh:max:mobile-sessions:v1';
const MAX_MOBILE_HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CHAT_HISTORY_LIMIT = 12;

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

type MaxChatSession = {
  id: string;
  title: string;
  savedAt: number;
  messages: Message[];
};

type FloatingPosition = {
  x: number;
  y: number;
};

const POSITION_STORAGE_KEY = 'smart_rh_max_mobile_position';
const MAX_ICON = require('../../../assets/max-touch-icon.png');
const FLOATING_SIZE = 64;
const EDGE_GAP = 16;

function buildId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildWelcomeMessage(): Message {
  return {
    id: buildId(),
    author: 'assistant',
    text:
      'Hola, soy Max. Cuéntame qué necesitas resolver en SMART RH y lo revisamos paso a paso.',
  };
}

function buildChatTitle(messages: Message[]) {
  const firstQuestion = messages.find((item) => item.author === 'user')?.text;
  const title = String(firstQuestion || 'Nuevo chat').trim();

  return title.length > 48 ? `${title.slice(0, 45)}...` : title;
}

function buildChatSession(messages: Message[] = [buildWelcomeMessage()]): MaxChatSession {
  return {
    id: buildId(),
    title: buildChatTitle(messages),
    savedAt: Date.now(),
    messages,
  };
}

function isFreshSession(session: MaxChatSession) {
  return Date.now() - Number(session.savedAt || 0) <= MAX_MOBILE_HISTORY_TTL_MS;
}

async function persistChatSessions(
  activeSessionId: string,
  sessions: MaxChatSession[]
) {
  await AsyncStorage.setItem(
    MAX_MOBILE_SESSIONS_KEY,
    JSON.stringify({ activeSessionId, sessions })
  );
  await AsyncStorage.removeItem(MAX_MOBILE_HISTORY_KEY);
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

function isCreateTicketAction(action: ChatbotAction) {
  const label = action.label.toLowerCase();

  return label.includes('crear') && label.includes('ticket');
}

function isTicketConfirmation(text: string) {
  return /cree el ticket con folio|creé el ticket con folio|envie la consulta a soporte|envié la consulta a soporte/i.test(
    text
  );
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
  const [messages, setMessages] = useState<Message[]>(() => [
    buildWelcomeMessage(),
  ]);
  const [activeSessionId, setActiveSessionId] = useState(() => buildId());
  const [chatSessions, setChatSessions] = useState<MaxChatSession[]>([]);
  const [maxHistoryReady, setMaxHistoryReady] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  useEffect(() => {
    if (maxHistoryReady) return;

    AsyncStorage.getItem(MAX_MOBILE_HISTORY_KEY)
      .then(async (raw) => {
        const sessionsRaw = await AsyncStorage.getItem(MAX_MOBILE_SESSIONS_KEY);
        if (sessionsRaw) {
          const payload = JSON.parse(sessionsRaw) as {
            activeSessionId?: string;
            sessions?: MaxChatSession[];
          };
          const sessions = Array.isArray(payload.sessions)
            ? payload.sessions.filter(isFreshSession).slice(0, MAX_CHAT_HISTORY_LIMIT)
            : [];

          if (sessions.length > 0) {
            const activeSession =
              sessions.find((item) => item.id === payload.activeSessionId) ||
              sessions[0];

            setChatSessions(sessions);
            setActiveSessionId(activeSession.id);
            setMessages(activeSession.messages);
            return;
          }
        }

        if (!raw) return;

        const payload = JSON.parse(raw) as { savedAt?: number; messages?: unknown[] };
        const isFresh = typeof payload.savedAt === 'number' && Date.now() - payload.savedAt <= MAX_MOBILE_HISTORY_TTL_MS;

        if (isFresh && Array.isArray(payload.messages) && payload.messages.length > 0) {
          const migratedSession = buildChatSession(payload.messages as Message[]);
          setChatSessions([migratedSession]);
          setActiveSessionId(migratedSession.id);
          setMessages(migratedSession.messages);
        } else {
          void AsyncStorage.removeItem(MAX_MOBILE_HISTORY_KEY);
        }
      })
      .catch(() => {
        void AsyncStorage.removeItem(MAX_MOBILE_HISTORY_KEY);
        void AsyncStorage.removeItem(MAX_MOBILE_SESSIONS_KEY);
      })
      .finally(() => {
        setMaxHistoryReady(true);
      });
  }, [maxHistoryReady]);

  useEffect(() => {
    if (!maxHistoryReady) return;

    const currentSession: MaxChatSession = {
      id: activeSessionId,
      title: buildChatTitle(messages),
      savedAt: Date.now(),
      messages,
    };
    const nextSessions = [
      currentSession,
      ...chatSessions.filter((item) => item.id !== activeSessionId),
    ]
      .filter(isFreshSession)
      .slice(0, MAX_CHAT_HISTORY_LIMIT);

    setChatSessions(nextSessions);
    void persistChatSessions(activeSessionId, nextSessions).catch(() => {
      // El historial local no debe bloquear el chat.
    });
  }, [activeSessionId, maxHistoryReady, messages]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
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

  const hasCreatedTicket = useMemo(
    () =>
      messages.some(
        (item) => item.author === 'assistant' && isTicketConfirmation(item.text)
      ),
    [messages]
  );

  const canCreateContextTicket = useMemo(() => {
    const latestAssistant = [...messages]
      .reverse()
      .find((item) => item.author === 'assistant' && item.response);

    return Boolean(
      lastQuestion &&
        !hasCreatedTicket &&
        latestAssistant?.response?.requiere_escalamiento
    );
  }, [hasCreatedTicket, lastQuestion, messages]);

  const maxHistorySelectors = chatSessions.filter((session) =>
    session.messages.some((item) => item.author === 'user') ||
    session.id === activeSessionId
  );
  const selectedHistorySession = selectedHistoryId
    ? chatSessions.find((session) => session.id === selectedHistoryId) || null
    : null;
  const maxHistoryPreview = selectedHistorySession?.messages || [];

  const resetComposerState = () => {
    setMessage('');
    setLastQuestion('');
    setError('');
    setShowSuggestions(true);
    setSelectedHistoryId(null);
  };

  const startNewChat = () => {
    const session = buildChatSession();

    setActiveSessionId(session.id);
    setMessages(session.messages);
    setChatSessions((current) => [session, ...current].slice(0, MAX_CHAT_HISTORY_LIMIT));
    resetComposerState();
    setHistoryOpen(false);
  };

  const openChatSession = (session: MaxChatSession) => {
    setActiveSessionId(session.id);
    setMessages(session.messages);
    setSelectedHistoryId(session.id);
    setMessage('');
    setLastQuestion('');
    setError('');
    setShowSuggestions(false);
  };

  const deleteChatSession = (sessionId: string) => {
    const remainingSessions = chatSessions.filter((session) => session.id !== sessionId);
    const fallbackSession = remainingSessions[0] || buildChatSession();
    const nextSessions = remainingSessions.length ? remainingSessions : [fallbackSession];
    const nextActiveId = activeSessionId === sessionId ? fallbackSession.id : activeSessionId;

    setChatSessions(nextSessions);
    if (activeSessionId === sessionId) {
      setActiveSessionId(fallbackSession.id);
      setMessages(fallbackSession.messages);
      resetComposerState();
    }

    void persistChatSessions(nextActiveId, nextSessions).catch(() => {
      // El historial local no debe bloquear el chat.
    });

    if (selectedHistoryId === sessionId) {
      setSelectedHistoryId(null);
    }
  };

  const clearAllChatSessions = () => {
    const session = buildChatSession();

    void AsyncStorage.removeItem(MAX_MOBILE_HISTORY_KEY);
    void AsyncStorage.removeItem(MAX_MOBILE_SESSIONS_KEY);
    setChatSessions([session]);
    setActiveSessionId(session.id);
    setMessages(session.messages);
    void persistChatSessions(session.id, [session]).catch(() => {
      // El historial local no debe bloquear el chat.
    });
    resetComposerState();
  };

  async function loadSuggestions() {
    try {
      const { data } = await api.get('/chatbot/sugerencias');
      setSuggestions(Array.isArray(data?.sugerencias) ? data.sugerencias : []);
      setShowSuggestions(true);
    } catch {
      setSuggestions([
        'Tengo un problema',
        'Revisar mi calendario',
        'Ayuda con asistencia',
      ]);
      setShowSuggestions(true);
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

    const isQuickSuggestion = Boolean(nextMessage) && suggestions.some(
      (item) => item.trim().toLowerCase() === cleanMessage.toLowerCase()
    );

    setOpen(true);
    setMessage('');
    setError('');
    setShowSuggestions(isQuickSuggestion);
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
        canal: 'mobile',
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

      if (isQuickSuggestion && Array.isArray(response?.sugerencias)) {
        setSuggestions(response.sugerencias);
      } else if (!isQuickSuggestion) {
        setSuggestions([]);
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
        canal: 'mobile',
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
      setLastQuestion('');
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
          <View style={styles.floatingLogoShell}>
            <Image source={MAX_ICON} style={styles.floatingLogoImage} />
          </View>
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

                    {item.response?.acciones?.some((action) =>
                      isMobileAction(action) &&
                      !(hasCreatedTicket && isCreateTicketAction(action))
                    ) ? (
                      <View style={styles.actionWrap}>
                        {item.response.acciones
                          .filter(
                            (action) =>
                              isMobileAction(action) &&
                              !(hasCreatedTicket && isCreateTicketAction(action))
                          )
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

              {historyOpen ? (
                <View style={styles.historyPanel}>
                  <View style={styles.historyHeader}>
                    <Pressable
                      style={styles.historyBackButton}
                      onPress={() => {
                        if (selectedHistoryId !== null) {
                          setSelectedHistoryId(null);
                          return;
                        }

                        setHistoryOpen(false);
                      }}
                    >
                      <Text style={styles.historyBackText}>
                        {selectedHistoryId === null ? 'Cerrar' : 'Volver'}
                      </Text>
                    </Pressable>
                    <Text style={styles.historyTitle}>
                      {selectedHistoryId === null ? 'Historial' : 'Conversación'}
                    </Text>
                    <Text style={styles.historyBadge}>7 días</Text>
                  </View>

                  {selectedHistoryId === null ? (
                    <ScrollView
                      style={styles.historyScroll}
                      contentContainerStyle={styles.historyContent}
                      showsVerticalScrollIndicator={false}
                    >
                      {maxHistorySelectors.length ? (
                        maxHistorySelectors.map((session) => (
                          <View style={styles.historySelectorRow} key={session.id}>
                            <Pressable
                              style={styles.historySelector}
                              onPress={() => openChatSession(session)}
                            >
                              <Text style={styles.historySelectorMeta}>
                                {session.id === activeSessionId
                                  ? 'Chat actual'
                                  : 'Chat guardado'}
                              </Text>
                              <Text style={styles.historySelectorText} numberOfLines={2}>
                                {session.title}
                              </Text>
                              <Text style={styles.historySelectorAction}>
                                Ver conversación
                              </Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Eliminar ${session.title}`}
                              style={styles.historyDeleteButton}
                              onPress={() => deleteChatSession(session.id)}
                            >
                              <Text style={styles.historyDeleteText}>⌫</Text>
                            </Pressable>
                          </View>
                        ))
                      ) : (
                        <View style={styles.historyEmpty}>
                          <Text style={styles.historyEmptyText}>
                            Aún no hay consultas para mostrar.
                          </Text>
                        </View>
                      )}

                      {maxHistorySelectors.length ? (
                        <Pressable
                          style={styles.historyClearButton}
                          onPress={clearAllChatSessions}
                        >
                          <Text style={styles.historyClearText}>Borrar historial</Text>
                        </Pressable>
                      ) : null}
                    </ScrollView>
                  ) : (
                    <ScrollView
                      style={styles.historyScroll}
                      contentContainerStyle={styles.historyContent}
                      showsVerticalScrollIndicator={false}
                    >
                      {maxHistoryPreview.length ? (
                        maxHistoryPreview.map((item) => (
                          <View
                            key={item.id}
                            style={[
                              styles.historyMessageItem,
                              item.author === 'user'
                                ? styles.historyMessageUser
                                : styles.historyMessageAssistant,
                            ]}
                          >
                            <Text style={styles.historySelectorMeta}>
                              {item.author === 'user' ? 'Tú' : 'Max'}
                            </Text>
                            <Text style={styles.historyMessageText}>{item.text}</Text>
                          </View>
                        ))
                      ) : (
                        <View style={styles.historyEmpty}>
                          <Text style={styles.historyEmptyText}>
                            Sin mensajes recientes.
                          </Text>
                        </View>
                      )}
                    </ScrollView>
                  )}
                </View>
              ) : null}

              {error ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.composer}>
                {showSuggestions && suggestions.length ? (
                  <View style={styles.suggestionSection}>
                    <Text style={styles.suggestionLabel}>Sugerencias</Text>
                    <View style={styles.suggestionGrid}>
                      {suggestions.slice(0, 3).map((item) => (
                        <Pressable
                          key={item}
                          style={styles.suggestionButton}
                          onPress={() => sendMessage(item)}
                        >
                          <Text style={styles.suggestionText}>
                            {item}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}

                <View style={styles.inputRow}>
                  <View style={styles.composerActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Nuevo chat"
                      style={styles.toolButton}
                      onPress={startNewChat}
                    >
                      <Text style={styles.toolButtonText}>+</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Abrir historial"
                      style={[
                        styles.toolButton,
                        historyOpen && styles.toolButtonActive,
                      ]}
                      onPress={() => {
                        setSelectedHistoryId(null);
                        setHistoryOpen((value) => !value);
                      }}
                    >
                      <Text style={styles.toolButtonText}>↺</Text>
                    </Pressable>
                  </View>

                  <TextInput
                    style={styles.input}
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Pregúntame..."
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
                    <Text style={styles.sendButtonText}>→</Text>
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
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: isDark ? 0.28 : 0.22,
      shadowRadius: 20,
      elevation: 14,
      zIndex: 50,
    },
    floatingButtonDragging: {
      transform: [{ scale: 0.98 }],
      opacity: 0.92,
    },
    floatingLogoImage: {
      width: 50,
      height: 50,
      borderRadius: 999,
      resizeMode: 'contain',
    },
    floatingLogoShell: {
      width: FLOATING_SIZE,
      height: FLOATING_SIZE,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#EAF9FF' : '#F5FCFF',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(56, 189, 248, 0.48)' : 'rgba(10, 87, 164, 0.22)',
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
      height: '86%',
      maxHeight: '90%',
      borderRadius: 28,
      overflow: 'hidden',
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      position: 'relative',
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
      minHeight: 92,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(120, 197, 255, 0.18)' : 'rgba(10, 87, 164, 0.14)',
      backgroundColor: COLORS.primaryStrong,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      shadowColor: '#021225',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
      elevation: 8,
    },
    avatarImage: {
      width: 39,
      height: 39,
      borderRadius: 999,
      resizeMode: 'contain',
    },
    headerCopy: {
      flex: 1,
    },
    kicker: {
      color: 'rgba(237, 250, 255, 0.82)',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    title: {
      color: COLORS.white,
      fontSize: 20,
      fontWeight: '900',
    },
    subtitle: {
      color: 'rgba(237, 250, 255, 0.78)',
      fontSize: 11,
      fontWeight: '700',
    },
    closeButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.14)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.22)',
    },
    closeText: {
      color: COLORS.white,
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
      gap: 12,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 14,
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
    historyPanel: {
      position: 'absolute',
      left: 14,
      right: 14,
      top: 106,
      bottom: 118,
      zIndex: 24,
      overflow: 'hidden',
      borderRadius: 22,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(122, 202, 255, 0.26)' : 'rgba(10, 87, 164, 0.18)',
      backgroundColor: isDark ? 'rgba(7, 17, 31, 0.98)' : 'rgba(247, 250, 252, 0.98)',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.28,
      shadowRadius: 28,
      elevation: 20,
    },
    historyHeader: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      backgroundColor: COLORS.card,
    },
    historyBackButton: {
      minWidth: 70,
      minHeight: 34,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
      backgroundColor: COLORS.cardSoft,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    historyBackText: {
      color: COLORS.text,
      fontSize: 11,
      fontWeight: '900',
    },
    historyTitle: {
      flex: 1,
      color: COLORS.text,
      fontSize: 14,
      fontWeight: '900',
      textAlign: 'center',
    },
    historyBadge: {
      minWidth: 54,
      overflow: 'hidden',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 7,
      color: COLORS.primary,
      backgroundColor: COLORS.primarySoft,
      fontSize: 10,
      fontWeight: '900',
      textAlign: 'center',
    },
    historyScroll: {
      flex: 1,
    },
    historyContent: {
      gap: 10,
      padding: 12,
      paddingBottom: 14,
    },
    historySelectorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
    },
    historySelector: {
      flex: 1,
      gap: 5,
    },
    historySelectorMeta: {
      color: COLORS.primary,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    historySelectorText: {
      color: COLORS.text,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '800',
    },
    historySelectorAction: {
      color: COLORS.muted,
      fontSize: 11,
      fontWeight: '800',
    },
    historyDeleteButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.cardSoft,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    historyDeleteText: {
      color: COLORS.danger,
      fontSize: 18,
      fontWeight: '900',
      lineHeight: 20,
    },
    historyClearButton: {
      minHeight: 40,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.cardSoft,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    historyClearText: {
      color: COLORS.text,
      fontSize: 12,
      fontWeight: '900',
    },
    historyMessageItem: {
      maxWidth: '92%',
      gap: 5,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: COLORS.card,
    },
    historyMessageUser: {
      alignSelf: 'flex-end',
      borderColor: COLORS.primary,
      backgroundColor: COLORS.primarySoft,
    },
    historyMessageAssistant: {
      alignSelf: 'flex-start',
    },
    historyMessageText: {
      color: COLORS.text,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '700',
    },
    historyEmpty: {
      minHeight: 140,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: COLORS.border,
      backgroundColor: COLORS.card,
      padding: 16,
    },
    historyEmptyText: {
      color: COLORS.muted,
      fontSize: 12,
      fontWeight: '800',
      textAlign: 'center',
    },
    suggestionSection: {
      gap: 9,
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
      minHeight: 40,
      minWidth: '47%',
      flexGrow: 1,
      flexShrink: 1,
      justifyContent: 'center',
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 9,
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
      gap: 9,
      borderWidth: 0,
      borderRadius: 0,
      padding: 0,
      backgroundColor: 'transparent',
    },
    composerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    toolButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.cardSoft,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    toolButtonActive: {
      backgroundColor: COLORS.primarySoft,
      borderColor: COLORS.primary,
    },
    toolButtonText: {
      color: COLORS.text,
      fontSize: 18,
      fontWeight: '900',
      lineHeight: 20,
    },
    input: {
      flex: 1,
      maxHeight: 84,
      minHeight: 40,
      color: COLORS.text,
      fontSize: 13,
      textAlignVertical: 'top',
      backgroundColor: COLORS.cardSoft,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primaryStrong,
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.24,
      shadowRadius: 12,
      elevation: 4,
    },
    sendButtonText: {
      color: COLORS.white,
      fontSize: 19,
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
