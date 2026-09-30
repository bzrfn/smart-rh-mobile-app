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
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  api,
} from '../../services/api';

import {
  useAuth,
} from '../../contexts/AuthContext';


type CalendarioTipo =
  | 'asistencia'
  | 'vacacion'
  | 'incapacidad';


type CalendarioEvento = {
  id: string;
  origen_id: number;
  tipo: CalendarioTipo;
  titulo: string;
  descripcion: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  usuario_id: number;
  empleado_nombre: string;
  empleado_correo?: string | null;
  metadata?: Record<string, any>;
};


type CalendarioResumen = {
  total: number;
  asistencia: number;
  vacacion: number;
  incapacidad: number;
};


type CalendarioScope =
  | 'admin'
  | 'empleado';


const EMPTY_RESUMEN: CalendarioResumen = {
  total: 0,
  asistencia: 0,
  vacacion: 0,
  incapacidad: 0,
};


const WEEKDAYS = [
  'L',
  'M',
  'M',
  'J',
  'V',
  'S',
  'D',
];


function startOfMonth(
  value: Date
) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    1
  );
}


function addMonths(
  value: Date,
  months: number
) {
  return new Date(
    value.getFullYear(),
    value.getMonth() + months,
    1
  );
}


function toApiDate(
  value: Date
) {
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


function parseApiDate(
  value?: string | null
) {
  const clean =
    String(value || '')
      .slice(
        0,
        10
      );

  const parts =
    clean
      .split('-')
      .map(Number);

  if (
    parts.length !== 3 ||
    parts.some(
      (part) =>
        Number.isNaN(part)
    )
  ) {
    return null;
  }

  const [
    year,
    month,
    day,
  ] = parts;

  const date =
    new Date(
      year,
      month - 1,
      day
    );

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}


function getMonthRange(
  monthDate: Date
) {
  const start =
    startOfMonth(
      monthDate
    );

  const end =
    new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      0
    );

  return {
    inicio:
      toApiDate(start),
    fin:
      toApiDate(end),
  };
}


function getMonthCells(
  monthDate: Date
) {
  const first =
    startOfMonth(
      monthDate
    );

  const last =
    new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + 1,
      0
    );

  const firstMondayIndex =
    (
      first.getDay() + 6
    ) % 7;

  const totalCells =
    Math.ceil(
      (
        firstMondayIndex +
        last.getDate()
      ) / 7
    ) * 7;

  return Array.from(
    {
      length:
        totalCells,
    },
    (_, index) => {
      const day =
        index -
        firstMondayIndex +
        1;

      if (
        day < 1 ||
        day > last.getDate()
      ) {
        return null;
      }

      const date =
        new Date(
          monthDate.getFullYear(),
          monthDate.getMonth(),
          day
        );

      return {
        day,
        date:
          toApiDate(date),
      };
    }
  );
}


function getEventDateKeys(
  item: CalendarioEvento
) {
  const start =
    parseApiDate(
      item.fecha_inicio
    );

  const end =
    parseApiDate(
      item.fecha_fin
    ) ||
    start;

  if (
    !start ||
    !end ||
    end.getTime() < start.getTime()
  ) {
    return [
      String(item.fecha_inicio || '')
        .slice(
          0,
          10
        ),
    ].filter(Boolean);
  }

  const keys:
    string[] = [];

  const cursor =
    new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate()
    );

  while (
    cursor.getTime() <=
    end.getTime()
  ) {
    keys.push(
      toApiDate(cursor)
    );

    cursor.setDate(
      cursor.getDate() + 1
    );
  }

  return keys;
}


function formatMonthTitle(
  value: Date
) {
  return value.toLocaleDateString(
    'es-MX',
    {
      month:
        'long',
      year:
        'numeric',
    }
  );
}


function formatDate(
  value?: string | null
) {
  const date =
    parseApiDate(
      value
    );

  if (!date) {
    return 'Sin fecha';
  }

  return date.toLocaleDateString(
    'es-MX',
    {
      day:
        '2-digit',
      month:
        'short',
      year:
        'numeric',
    }
  );
}


function formatDateRange(
  start?: string | null,
  end?: string | null
) {
  const cleanStart =
    String(start || '')
      .slice(
        0,
        10
      );

  const cleanEnd =
    String(end || '')
      .slice(
        0,
        10
      );

  if (
    !cleanEnd ||
    cleanStart === cleanEnd
  ) {
    return formatDate(
      cleanStart
    );
  }

  return `${formatDate(cleanStart)} al ${formatDate(cleanEnd)}`;
}


function getEstadoLabel(
  value?: string | null
) {
  const estado =
    String(value || '')
      .trim()
      .toLowerCase();

  const labels:
    Record<string, string> = {
      aprobada:
        'Aprobada',
      aprobado:
        'Aprobado',
      pendiente:
        'Pendiente',
      rechazada:
        'Rechazada',
      rechazado:
        'Rechazado',
      valida:
        'Válida',
      valido:
        'Válido',
      invalidada:
        'Invalidada',
      invalida:
        'Inválida',
      sin_estado:
        'Sin estado',
    };

  return labels[estado] ||
    estado
      .replace(
        /_/g,
        ' '
      )
      .replace(
        /^\w/,
        (letter) =>
          letter.toUpperCase()
      ) ||
    'Sin estado';
}


function getTipoLabel(
  tipo: CalendarioTipo
) {
  if (
    tipo === 'asistencia'
  ) {
    return 'Asistencia';
  }

  if (
    tipo === 'vacacion'
  ) {
    return 'Vacaciones';
  }

  return 'Incapacidad';
}


function getTipoCode(
  tipo: CalendarioTipo
) {
  if (
    tipo === 'asistencia'
  ) {
    return 'AS';
  }

  if (
    tipo === 'vacacion'
  ) {
    return 'VC';
  }

  return 'IN';
}


export default function CalendarioLaboralScreen() {
  const {
    theme,
    user,
  } = useAuth();

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
    currentMonth,
    setCurrentMonth,
  ] =
    useState(
      startOfMonth(
        new Date()
      )
    );

  const [
    selectedDate,
    setSelectedDate,
  ] =
    useState<string | null>(
      toApiDate(
        new Date()
      )
    );

  const [
    eventos,
    setEventos,
  ] =
    useState<
      CalendarioEvento[]
    >([]);

  const [
    resumen,
    setResumen,
  ] =
    useState<CalendarioResumen>(
      EMPTY_RESUMEN
    );

  const [
    scope,
    setScope,
  ] =
    useState<CalendarioScope>(
      String(user?.role || '').toLowerCase() === 'admin'
        ? 'admin'
        : 'empleado'
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  const range =
    useMemo(
      () =>
        getMonthRange(
          currentMonth
        ),
      [
        currentMonth,
      ]
    );

  const todayKey =
    useMemo(
      () =>
        toApiDate(
          new Date()
        ),
      []
    );

  const loadCalendario =
    useCallback(
      async (
        isRefresh = false
      ) => {
        try {
          if (isRefresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          setError('');

          const {
            data,
          } =
            await api.get(
              '/calendario/laboral',
              {
                params: {
                  inicio:
                    range.inicio,
                  fin:
                    range.fin,
                },
              }
            );

          setEventos(
            Array.isArray(
              data?.eventos
            )
              ? data.eventos
              : []
          );

          setResumen({
            ...EMPTY_RESUMEN,
            ...(data?.resumen || {}),
          });

          if (
            data?.scope === 'admin' ||
            data?.scope === 'empleado'
          ) {
            setScope(
              data.scope
            );
          }
        } catch (e: any) {
          const message =
            e?.response?.data?.message ||
            'No se pudo cargar el calendario laboral.';

          setError(
            message
          );

          if (!isRefresh) {
            Alert.alert(
              'Calendario laboral',
              message
            );
          }
        } finally {
          if (isRefresh) {
            setRefreshing(false);
          } else {
            setLoading(false);
          }
        }
      },
      [
        range.fin,
        range.inicio,
      ]
    );

  useEffect(
    () => {
      loadCalendario();
    },
    [
      loadCalendario,
    ]
  );

  const eventsByDate =
    useMemo(
      () => {
        return eventos.reduce<
          Record<
            string,
            CalendarioEvento[]
          >
        >(
          (acc, item) => {
            getEventDateKeys(
              item
            ).forEach(
              (key) => {
                if (!acc[key]) {
                  acc[key] = [];
                }

                acc[key].push(
                  item
                );
              }
            );

            return acc;
          },
          {}
        );
      },
      [
        eventos,
      ]
    );

  const selectedEvents =
    useMemo(
      () =>
        selectedDate
          ? eventsByDate[selectedDate] || []
          : eventos,
      [
        eventos,
        eventsByDate,
        selectedDate,
      ]
    );

  const monthCells =
    useMemo(
      () =>
        getMonthCells(
          currentMonth
        ),
      [
        currentMonth,
      ]
    );

  function moveMonth(
    direction: number
  ) {
    const next =
      addMonths(
        currentMonth,
        direction
      );

    setCurrentMonth(
      next
    );

    const today =
      new Date();

    const isCurrent =
      next.getFullYear() ===
        today.getFullYear() &&
      next.getMonth() ===
        today.getMonth();

    setSelectedDate(
      isCurrent
        ? toApiDate(today)
        : null
    );
  }

  function goToday() {
    const today =
      new Date();

    setCurrentMonth(
      startOfMonth(
        today
      )
    );

    setSelectedDate(
      toApiDate(
        today
      )
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() =>
              loadCalendario(
                true
              )
            }
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.brandPill}>
              <Text style={styles.brandPillText}>
                SMART RH
              </Text>
            </View>

            <View style={styles.scopePill}>
              <Text style={styles.scopePillText}>
                {scope === 'admin'
                  ? 'Vista admin'
                  : 'Mi calendario'}
              </Text>
            </View>
          </View>

          <Text style={styles.eyebrow}>
            Calendario laboral
          </Text>
          <Text style={styles.title}>
            Agenda del mes
          </Text>
          <Text style={styles.subtitle}>
            Consulta asistencia, vacaciones e incapacidades en una sola vista.
          </Text>
        </View>

        <View style={styles.monthCard}>
          <View style={styles.monthHeader}>
            <Pressable
              style={styles.monthButton}
              onPress={() =>
                moveMonth(
                  -1
                )
              }
            >
              <Text style={styles.monthButtonText}>
                {'<'}
              </Text>
            </Pressable>

            <View style={styles.monthTitleWrap}>
              <Text style={styles.monthTitle}>
                {formatMonthTitle(
                  currentMonth
                )}
              </Text>
              <Text style={styles.monthRange}>
                {formatDateRange(
                  range.inicio,
                  range.fin
                )}
              </Text>
            </View>

            <Pressable
              style={styles.monthButton}
              onPress={() =>
                moveMonth(
                  1
                )
              }
            >
              <Text style={styles.monthButtonText}>
                {'>'}
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.todayButton}
            onPress={goToday}
          >
            <Text style={styles.todayButtonText}>
              Ir a hoy
            </Text>
          </Pressable>

          <View style={styles.weekRow}>
            {WEEKDAYS.map(
              (day, index) => (
                <Text
                  key={`${day}-${index}`}
                  style={styles.weekDay}
                >
                  {day}
                </Text>
              )
            )}
          </View>

          <View style={styles.calendarGrid}>
            {monthCells.map(
              (cell, index) => {
                if (!cell) {
                  return (
                    <View
                      key={`empty-${index}`}
                      style={[
                        styles.dayCell,
                        styles.dayCellEmpty,
                      ]}
                    />
                  );
                }

                const count =
                  eventsByDate[cell.date]?.length || 0;

                const isSelected =
                  selectedDate === cell.date;

                const isToday =
                  todayKey === cell.date;

                return (
                  <Pressable
                    key={cell.date}
                    style={[
                      styles.dayCell,
                      isToday &&
                        styles.dayCellToday,
                      isSelected &&
                        styles.dayCellSelected,
                    ]}
                    onPress={() =>
                      setSelectedDate(
                        cell.date
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        isSelected &&
                          styles.dayNumberSelected,
                      ]}
                    >
                      {cell.day}
                    </Text>

                    {count > 0 ? (
                      <View
                        style={[
                          styles.dayEventBadge,
                          isSelected &&
                            styles.dayEventBadgeSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayEventBadgeText,
                            isSelected &&
                              styles.dayEventBadgeTextSelected,
                          ]}
                        >
                          {count}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              }
            )}
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            label="Eventos"
            value={String(resumen.total)}
            accent="blue"
            styles={styles}
          />
          <StatCard
            label="Asistencia"
            value={String(resumen.asistencia)}
            accent="teal"
            styles={styles}
          />
          <StatCard
            label="Vacaciones"
            value={String(resumen.vacacion)}
            accent="gold"
            styles={styles}
          />
          <StatCard
            label="Incapacidades"
            value={String(resumen.incapacidad)}
            accent="danger"
            styles={styles}
          />
        </View>

        {loading ? (
          <View style={styles.centerCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.centerText}>
              Cargando calendario...
            </Text>
          </View>
        ) : null}

        {!!error && !loading ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              {selectedDate
                ? `Eventos del ${formatDate(selectedDate)}`
                : 'Eventos del mes'}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {selectedEvents.length} registro(s) encontrados.
            </Text>
          </View>

          {selectedDate ? (
            <Pressable
              style={styles.clearSelectionButton}
              onPress={() =>
                setSelectedDate(
                  null
                )
              }
            >
              <Text style={styles.clearSelectionText}>
                Ver mes
              </Text>
            </Pressable>
          ) : null}
        </View>

        {!loading &&
        selectedEvents.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              Sin eventos registrados
            </Text>
            <Text style={styles.emptyText}>
              No hay asistencia, vacaciones o incapacidades para esta selección.
            </Text>
          </View>
        ) : null}

        <View style={styles.eventList}>
          {selectedEvents.map(
            (item) => (
              <EventCard
                key={`${item.id}-${selectedDate || 'month'}`}
                item={item}
                scope={scope}
                styles={styles}
              />
            )
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


function StatCard({
  label,
  value,
  accent,
  styles,
}: {
  label: string;
  value: string;
  accent:
    | 'blue'
    | 'teal'
    | 'gold'
    | 'danger';
  styles: any;
}) {
  return (
    <View
      style={[
        styles.statCard,
        styles[`${accent}Border`],
      ]}
    >
      <Text
        style={[
          styles.statValue,
          styles[`${accent}Text`],
        ]}
      >
        {value}
      </Text>
      <Text style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}


function EventCard({
  item,
  scope,
  styles,
}: {
  item: CalendarioEvento;
  scope: CalendarioScope;
  styles: any;
}) {
  const accent =
    item.tipo === 'asistencia'
      ? 'teal'
      : item.tipo === 'vacacion'
        ? 'gold'
        : 'danger';

  return (
    <View
      style={[
        styles.eventCard,
        styles[`${accent}Border`],
      ]}
    >
      <View style={styles.eventTopRow}>
        <View
          style={[
            styles.eventCode,
            styles[`${accent}Bg`],
          ]}
        >
          <Text
            style={[
              styles.eventCodeText,
              styles[`${accent}Text`],
            ]}
          >
            {getTipoCode(
              item.tipo
            )}
          </Text>
        </View>

        <View style={styles.eventTitleWrap}>
          <Text style={styles.eventType}>
            {getTipoLabel(
              item.tipo
            )}
          </Text>
          <Text style={styles.eventTitle}>
            {item.titulo}
          </Text>
        </View>

        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>
            {getEstadoLabel(
              item.estado
            )}
          </Text>
        </View>
      </View>

      <Text style={styles.eventDate}>
        {formatDateRange(
          item.fecha_inicio,
          item.fecha_fin
        )}
      </Text>

      {scope === 'admin' ? (
        <Text style={styles.eventEmployee}>
          {item.empleado_nombre}
          {item.empleado_correo
            ? ` · ${item.empleado_correo}`
            : ''}
        </Text>
      ) : null}

      <Text style={styles.eventDescription}>
        {item.descripcion}
      </Text>
    </View>
  );
}


function getColors(
  isDark: boolean
) {
  return {
    background:
      isDark ? '#07111F' : '#F4F7FB',
    card:
      isDark ? '#0F1B2D' : '#FFFFFF',
    cardSoft:
      isDark ? '#111F33' : '#F9FBFD',
    primary:
      isDark ? '#38BDF8' : '#0A57A4',
    primarySoft:
      isDark ? 'rgba(56,189,248,0.14)' : 'rgba(10,87,164,0.10)',
    teal:
      isDark ? '#2DD4BF' : '#22B8B0',
    tealBg:
      isDark ? 'rgba(45,212,191,0.14)' : 'rgba(34,184,176,0.12)',
    gold:
      isDark ? '#FACC15' : '#B7791F',
    goldBg:
      isDark ? 'rgba(250,204,21,0.14)' : 'rgba(183,121,31,0.12)',
    danger:
      isDark ? '#FCA5A5' : '#B42318',
    dangerBg:
      isDark ? 'rgba(248,113,113,0.12)' : 'rgba(180,35,24,0.08)',
    text:
      isDark ? '#F8FAFC' : '#0F172A',
    muted:
      isDark ? '#9FB0C4' : '#5B6B81',
    border:
      isDark ? '#26364D' : '#D9E1EC',
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
    container: {
      padding: 20,
      gap: 16,
      paddingBottom: 42,
    },
    hero: {
      backgroundColor:
        COLORS.card,
      borderRadius: 26,
      padding: 22,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      shadowColor:
        '#000',
      shadowOpacity:
        isDark ? 0.26 : 0.08,
      shadowRadius: 16,
      shadowOffset: {
        width: 0,
        height: 8,
      },
      elevation: 5,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      gap: 12,
      marginBottom: 18,
    },
    brandPill: {
      backgroundColor:
        COLORS.primarySoft,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    brandPillText: {
      color:
        COLORS.primary,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    scopePill: {
      backgroundColor:
        COLORS.tealBg,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    scopePillText: {
      color:
        COLORS.teal,
      fontSize: 12,
      fontWeight: '900',
    },
    eyebrow: {
      color:
        COLORS.muted,
      fontSize: 12,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    title: {
      marginTop: 8,
      color:
        COLORS.text,
      fontSize: 28,
      fontWeight: '900',
    },
    subtitle: {
      marginTop: 10,
      color:
        COLORS.muted,
      lineHeight: 22,
      fontSize: 15,
    },
    monthCard: {
      backgroundColor:
        COLORS.card,
      borderRadius: 24,
      padding: 16,
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },
    monthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      gap: 12,
    },
    monthButton: {
      width: 44,
      height: 44,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        COLORS.primarySoft,
    },
    monthButtonText: {
      color:
        COLORS.primary,
      fontSize: 28,
      fontWeight: '900',
      lineHeight: 30,
    },
    monthTitleWrap: {
      flex: 1,
      alignItems: 'center',
    },
    monthTitle: {
      color:
        COLORS.text,
      fontSize: 18,
      fontWeight: '900',
      textTransform: 'capitalize',
    },
    monthRange: {
      marginTop: 4,
      color:
        COLORS.muted,
      fontSize: 12,
      fontWeight: '700',
    },
    todayButton: {
      marginTop: 14,
      alignSelf: 'center',
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor:
        COLORS.cardSoft,
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },
    todayButtonText: {
      color:
        COLORS.primary,
      fontSize: 12,
      fontWeight: '900',
    },
    weekRow: {
      flexDirection: 'row',
      marginTop: 18,
    },
    weekDay: {
      flex: 1,
      textAlign: 'center',
      color:
        COLORS.muted,
      fontSize: 12,
      fontWeight: '900',
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 8,
    },
    dayCell: {
      width: `${100 / 7}%`,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent:
        'center',
      borderWidth: 1,
      borderColor:
        COLORS.border,
      backgroundColor:
        COLORS.cardSoft,
    },
    dayCellEmpty: {
      opacity: 0,
    },
    dayCellToday: {
      borderColor:
        COLORS.primary,
      backgroundColor:
        COLORS.primarySoft,
    },
    dayCellSelected: {
      backgroundColor:
        COLORS.primary,
      borderColor:
        COLORS.primary,
    },
    dayNumber: {
      color:
        COLORS.text,
      fontSize: 13,
      fontWeight: '900',
    },
    dayNumberSelected: {
      color:
        '#FFFFFF',
    },
    dayEventBadge: {
      marginTop: 3,
      minWidth: 18,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        COLORS.tealBg,
      paddingHorizontal: 5,
    },
    dayEventBadgeSelected: {
      backgroundColor:
        'rgba(255,255,255,0.20)',
    },
    dayEventBadgeText: {
      color:
        COLORS.teal,
      fontSize: 10,
      fontWeight: '900',
    },
    dayEventBadgeTextSelected: {
      color:
        '#FFFFFF',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    statCard: {
      width: '48%',
      backgroundColor:
        COLORS.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
    },
    statValue: {
      fontSize: 26,
      fontWeight: '900',
    },
    statLabel: {
      marginTop: 4,
      color:
        COLORS.text,
      fontSize: 13,
      fontWeight: '900',
    },
    centerCard: {
      backgroundColor:
        COLORS.card,
      borderRadius: 20,
      padding: 18,
      alignItems: 'center',
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },
    centerText: {
      marginTop: 8,
      color:
        COLORS.muted,
      fontWeight: '800',
    },
    errorCard: {
      backgroundColor:
        COLORS.dangerBg,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor:
        COLORS.danger,
    },
    errorText: {
      color:
        COLORS.danger,
      fontWeight: '800',
      lineHeight: 20,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      gap: 12,
    },
    sectionTitle: {
      color:
        COLORS.text,
      fontSize: 20,
      fontWeight: '900',
    },
    sectionSubtitle: {
      marginTop: 4,
      color:
        COLORS.muted,
      fontSize: 13,
      fontWeight: '700',
    },
    clearSelectionButton: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor:
        COLORS.primarySoft,
    },
    clearSelectionText: {
      color:
        COLORS.primary,
      fontSize: 12,
      fontWeight: '900',
    },
    emptyCard: {
      backgroundColor:
        COLORS.card,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },
    emptyTitle: {
      color:
        COLORS.text,
      fontSize: 17,
      fontWeight: '900',
    },
    emptyText: {
      marginTop: 6,
      color:
        COLORS.muted,
      lineHeight: 21,
    },
    eventList: {
      gap: 12,
    },
    eventCard: {
      backgroundColor:
        COLORS.card,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
    },
    eventTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    eventCode: {
      width: 42,
      height: 42,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent:
        'center',
    },
    eventCodeText: {
      fontSize: 13,
      fontWeight: '900',
    },
    eventTitleWrap: {
      flex: 1,
    },
    eventType: {
      color:
        COLORS.muted,
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    eventTitle: {
      marginTop: 3,
      color:
        COLORS.text,
      fontSize: 16,
      fontWeight: '900',
    },
    statusPill: {
      borderRadius: 999,
      backgroundColor:
        COLORS.cardSoft,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    statusPillText: {
      color:
        COLORS.muted,
      fontSize: 11,
      fontWeight: '900',
    },
    eventDate: {
      marginTop: 12,
      color:
        COLORS.primary,
      fontSize: 13,
      fontWeight: '900',
    },
    eventEmployee: {
      marginTop: 6,
      color:
        COLORS.text,
      fontSize: 13,
      fontWeight: '800',
      lineHeight: 19,
    },
    eventDescription: {
      marginTop: 8,
      color:
        COLORS.muted,
      fontSize: 13,
      lineHeight: 20,
    },
    blueBorder: {
      borderColor:
        COLORS.primary,
    },
    tealBorder: {
      borderColor:
        COLORS.teal,
    },
    goldBorder: {
      borderColor:
        COLORS.gold,
    },
    dangerBorder: {
      borderColor:
        COLORS.danger,
    },
    blueText: {
      color:
        COLORS.primary,
    },
    tealText: {
      color:
        COLORS.teal,
    },
    goldText: {
      color:
        COLORS.gold,
    },
    dangerText: {
      color:
        COLORS.danger,
    },
    blueBg: {
      backgroundColor:
        COLORS.primarySoft,
    },
    tealBg: {
      backgroundColor:
        COLORS.tealBg,
    },
    goldBg: {
      backgroundColor:
        COLORS.goldBg,
    },
    dangerBg: {
      backgroundColor:
        COLORS.dangerBg,
    },
  });
}
