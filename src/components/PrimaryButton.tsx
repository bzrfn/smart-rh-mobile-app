import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getSmartRhColors } from '../design/smartRhTheme';
import { useAuth } from '../contexts/AuthContext';

export default function PrimaryButton({ title, onPress }: { title: string; onPress: () => void }) {
  const { theme } = useAuth();
  const isDark = theme === 'dark';
  const colors = getSmartRhColors(isDark);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed ? colors.primaryDark : colors.primary,
          shadowColor: colors.primary,
          shadowOpacity: isDark ? 0.18 : 0.24,
        },
        pressed && styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          {
            color: colors.onPrimary,
          },
        ]}
      >
        {title}
      </Text>

      <View style={styles.actionOrb}>
        <View style={styles.actionGlyph}>
          <View style={[styles.actionStroke, styles.actionStrokeTop]} />
          <View style={[styles.actionStroke, styles.actionStrokeBottom]} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
    elevation: 5,
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.35,
    paddingHorizontal: 32,
  },
  actionOrb: {
    position: 'absolute',
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  actionGlyph: {
    width: 15,
    height: 15,
  },
  actionStroke: {
    position: 'absolute',
    right: 2,
    width: 10,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  actionStrokeTop: {
    top: 4,
    transform: [{ rotate: '45deg' }],
  },
  actionStrokeBottom: {
    bottom: 3,
    transform: [{ rotate: '-45deg' }],
  },
});
