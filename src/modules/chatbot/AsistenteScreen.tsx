import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

type Props = {
  navigation: any;
};

type ChatbotAction = {
  label: string;
  target: string;
  scope: 'web' | 'mobile' | 'both';
};

type ChatbotResponse = {
  categoria: string;
  titulo: string;
  respuesta: string;
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

function buildId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getColors(isDark: boolean) {
  return {
    background: isDark ? '#0B1628' : '#F4F7FB',
    card: isDark ? '#132238' : '#FFFFFF',
    cardSoft: isDark ? '#1A2A42' : '#F9FBFD',
    primary: isDark ? '#60A5FA' : '#0A57A4',
    primarySoft: isDark ? 'rgba(96,165,250,0.14)' : 'rgba(10,87,164,0.10)',
    teal: isDark ? '#45D6C6' : '#22B8B0',
    tealBg: isDark ? 'rgba(69,214,198,0.13)' : 'rgba(34,184,176,0.12)',
    danger: isDark ? '#FDA4AF' : '#B42318',
    dangerBg: isDark ? 'rgba(253,164,175,0.12)' : 'rgba(180,35,24,0.08)',
    text: isDark ? '#F8FAFC' : '#0F172A',
    muted: isDark ? '#B8C4D6' : '#5B6B81',
    border: isDark ? '#30435F' : '#D9E1EC',
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

export default function AsistenteScreen({ navigation }: Props) {
  const { user, theme } = useAuth();
  const isDark = theme === 'dark';
  const colors = getColors(isDark);
  const styles = getStyles(isDark);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: buildId(),
      author: 'assistant',
      text:
        'Hola. Soy el asistente de SMART RH. Puedo orientarte sobre asistencia, calendario, incapacidades, documentos, nomina, soporte y herramientas administrativas.',
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

  async function loadSuggestions() {
    try {
      const { data } = await api.get('/chatbot/sugerencias');
      setSuggestions(Array.isArray(data?.sugerencias) ? data.sugerencias : []);
    } catch {
      setSuggestions([
        '¿Cómo reviso mi asistencia?',
        '¿Dónde consulto mi calendario laboral?',
        '¿Cómo levanto un ticket de soporte?',
      ]);
    }
  }

  useEffect(() => {
    loadSuggestions();
  }, []);

  async function sendMessage(nextMessage?: string) {
    const cleanMessage = String(nextMessage || message).trim();

    if (!cleanMessage || loading) return;

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
      });

      const response = data?.respuesta as ChatbotResponse;

      setMessages((current) => [
        ...current,
        {
          id: buildId(),
          author: 'assistant',
          text: response?.respuesta || 'No pude generar una respuesta segura.',
          response,
        },
      ]);

      if (Array.isArray(response?.sugerencias)) {
        setSuggestions(response.sugerencias);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          'No se pudo contactar al asistente SMART RH.'
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
        crear_ticket: true,
      });

      const ticketId = data?.ticket?._id;

      Alert.alert(
        'Ticket creado',
        ticketId
          ? `Folio: ${ticketId}. Puedes darle seguimiento desde Soporte.`
          : 'La consulta fue enviada a soporte.'
      );
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.response?.data?.message ||
          'No se pudo crear el ticket de soporte.'
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
        'Esta accion se realiza desde el portal web.'
      );
      return;
    }

    navigation.navigate(route);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.brandPill}>
            <Text style={styles.brandPillText}>Cambio #6</Text>
          </View>
          <Text style={styles.title}>Asistente SMART RH</Text>
          <Text style={styles.subtitle}>
            Ayuda guiada por rol, respuestas seguras y escalamiento a soporte.
          </Text>
          <Text style={styles.sessionText}>
            Sesion: {userName || 'Usuario SMART RH'} · {user?.role || 'empleado'}
          </Text>
        </View>

        <View style={styles.chatCard}>
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
              <Text style={styles.loadingText}>
                Consultando SMART RH...
              </Text>
            </View>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.inputCard}>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preguntas sugeridas</Text>
          <View style={styles.suggestionWrap}>
            {suggestions.map((item) => (
              <Pressable
                key={item}
                style={styles.suggestionButton}
                onPress={() => sendMessage(item)}
              >
                <Text style={styles.suggestionText}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.ticketCard}>
          <Text style={styles.ticketTitle}>Escalar a soporte</Text>
          <Text style={styles.ticketText}>
            Si la respuesta no resuelve el caso, crea un ticket con el contexto
            de la consulta.
          </Text>
          <Pressable
            style={[
              styles.ticketButton,
              (!lastQuestion || ticketLoading) && styles.disabledButton,
            ]}
            disabled={!lastQuestion || ticketLoading}
            onPress={createTicket}
          >
            <Text style={styles.ticketButtonText}>
              {ticketLoading ? 'Creando...' : 'Crear ticket'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(isDark: boolean) {
  const COLORS = getColors(isDark);

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    container: {
      padding: 18,
      gap: 16,
      paddingBottom: 42,
    },
    hero: {
      backgroundColor: COLORS.card,
      borderRadius: 26,
      padding: 22,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 10,
    },
    brandPill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: COLORS.primarySoft,
    },
    brandPillText: {
      color: COLORS.primary,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    title: {
      color: COLORS.text,
      fontSize: 28,
      fontWeight: '900',
    },
    subtitle: {
      color: COLORS.muted,
      fontSize: 15,
      lineHeight: 22,
    },
    sessionText: {
      color: COLORS.teal,
      fontSize: 12,
      fontWeight: '800',
    },
    chatCard: {
      gap: 12,
    },
    messageBubble: {
      maxWidth: '92%',
      borderRadius: 20,
      padding: 15,
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
      borderRadius: 18,
      padding: 14,
      backgroundColor: COLORS.dangerBg,
      borderWidth: 1,
      borderColor: COLORS.danger,
    },
    errorText: {
      color: COLORS.danger,
      fontWeight: '800',
      lineHeight: 20,
    },
    inputCard: {
      backgroundColor: COLORS.card,
      borderRadius: 22,
      padding: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 10,
    },
    input: {
      minHeight: 92,
      color: COLORS.text,
      fontSize: 15,
      textAlignVertical: 'top',
      backgroundColor: COLORS.cardSoft,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    sendButton: {
      borderRadius: 18,
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: COLORS.primary,
    },
    sendButtonText: {
      color: COLORS.white,
      fontSize: 14,
      fontWeight: '900',
    },
    disabledButton: {
      opacity: 0.55,
    },
    section: {
      backgroundColor: COLORS.card,
      borderRadius: 22,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 12,
    },
    sectionTitle: {
      color: COLORS.text,
      fontSize: 18,
      fontWeight: '900',
    },
    suggestionWrap: {
      gap: 10,
    },
    suggestionButton: {
      borderRadius: 16,
      padding: 14,
      backgroundColor: COLORS.cardSoft,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    suggestionText: {
      color: COLORS.text,
      fontWeight: '800',
      lineHeight: 20,
    },
    ticketCard: {
      backgroundColor: COLORS.tealBg,
      borderRadius: 22,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      gap: 8,
    },
    ticketTitle: {
      color: COLORS.text,
      fontSize: 18,
      fontWeight: '900',
    },
    ticketText: {
      color: COLORS.muted,
      lineHeight: 21,
      fontWeight: '700',
    },
    ticketButton: {
      marginTop: 6,
      borderRadius: 16,
      paddingVertical: 13,
      alignItems: 'center',
      backgroundColor: COLORS.teal,
    },
    ticketButtonText: {
      color: COLORS.white,
      fontWeight: '900',
    },
  });
}
