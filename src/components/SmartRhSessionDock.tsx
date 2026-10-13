import React from 'react';
import {
  Image,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { getSmartRhColors, getSmartRhShadow } from '../design/smartRhTheme';

type Props = {
  isDark: boolean;
  avatarUri?: string | null;
  fallbackInitial?: string;
  onHomePress: () => void;
  onProfilePress: () => void;
  onLogoutPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export default function SmartRhSessionDock({
  isDark,
  avatarUri,
  fallbackInitial = 'S',
  onHomePress,
  onProfilePress,
  onLogoutPress,
  style,
}: Props) {
  const styles = getStyles(isDark);
  const shadow = getSmartRhShadow(isDark);

  return (
    <View style={[styles.shell, shadow, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ir al inicio"
        onPress={onHomePress}
        style={({ pressed }) => [
          styles.sideAction,
          styles.sideActionActive,
          pressed && styles.pressed,
        ]}
      >
        <HomeGlyph color={styles.iconColor.color} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir menú de cuenta"
        onPress={onProfilePress}
        style={({ pressed }) => [
          styles.avatarAction,
          shadow,
          pressed && styles.avatarPressed,
        ]}
      >
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarFallback}>{fallbackInitial.slice(0, 1)}</Text>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar sesión"
        onPress={onLogoutPress}
        style={({ pressed }) => [
          styles.sideAction,
          styles.logoutAction,
          pressed && styles.pressed,
        ]}
      >
        <LogoutGlyph color={styles.logoutIconColor.color} />
      </Pressable>
    </View>
  );
}

function HomeGlyph({ color }: { color: string }) {
  return (
    <View style={glyphStyles.homeWrap}>
      <View
        style={[
          glyphStyles.homeRoof,
          {
            borderColor: color,
          },
        ]}
      />
      <View
        style={[
          glyphStyles.homeBody,
          {
            borderColor: color,
          },
        ]}
      />
    </View>
  );
}

function LogoutGlyph({ color }: { color: string }) {
  return (
    <View style={glyphStyles.logoutWrap}>
      <View style={[glyphStyles.logoutDoor, { borderColor: color }]} />
      <View style={[glyphStyles.logoutLine, { backgroundColor: color }]} />
      <View style={[glyphStyles.logoutHeadTop, { backgroundColor: color }]} />
      <View style={[glyphStyles.logoutHeadBottom, { backgroundColor: color }]} />
    </View>
  );
}

function getStyles(isDark: boolean) {
  const colors = getSmartRhColors(isDark);

  return StyleSheet.create({
    shell: {
      position: 'absolute',
      left: 24,
      right: 24,
      bottom: 12,
      height: 76,
      borderRadius: 30,
      paddingHorizontal: 18,
      backgroundColor: isDark ? 'rgba(15,27,45,0.96)' : 'rgba(255,255,255,0.97)',
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 50,
    },
    sideAction: {
      width: 54,
      height: 54,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? colors.cardSoft : colors.backgroundSoft,
    },
    sideActionActive: {
      borderColor: colors.primaryBorder,
      backgroundColor: colors.primarySoft,
    },
    logoutAction: {
      borderColor: colors.danger,
      backgroundColor: colors.dangerSoft,
    },
    avatarAction: {
      width: 68,
      height: 68,
      borderRadius: 27,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderWidth: 3,
      borderColor: colors.primary,
      overflow: 'hidden',
      transform: [{ translateY: -16 }],
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    avatarFallback: {
      color: colors.primary,
      fontSize: 24,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    pressed: {
      opacity: 0.82,
      transform: [{ scale: 0.97 }],
    },
    avatarPressed: {
      opacity: 0.9,
      transform: [{ translateY: -16 }, { scale: 0.98 }],
    },
    iconColor: {
      color: colors.primary,
    },
    logoutIconColor: {
      color: colors.danger,
    },
  });
}

const glyphStyles = StyleSheet.create({
  homeWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeRoof: {
    position: 'absolute',
    top: 4,
    width: 15,
    height: 15,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  homeBody: {
    position: 'absolute',
    bottom: 4,
    width: 18,
    height: 14,
    borderWidth: 3,
    borderTopWidth: 0,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  logoutWrap: {
    width: 30,
    height: 28,
    justifyContent: 'center',
  },
  logoutDoor: {
    position: 'absolute',
    left: 2,
    width: 14,
    height: 20,
    borderLeftWidth: 3,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  logoutLine: {
    position: 'absolute',
    left: 12,
    width: 15,
    height: 3,
    borderRadius: 999,
  },
  logoutHeadTop: {
    position: 'absolute',
    right: 2,
    top: 9,
    width: 10,
    height: 3,
    borderRadius: 999,
    transform: [{ rotate: '45deg' }],
  },
  logoutHeadBottom: {
    position: 'absolute',
    right: 2,
    bottom: 9,
    width: 10,
    height: 3,
    borderRadius: 999,
    transform: [{ rotate: '-45deg' }],
  },
});
