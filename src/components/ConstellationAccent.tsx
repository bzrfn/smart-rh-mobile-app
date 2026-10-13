import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { getSmartRhColors } from '../design/smartRhTheme';

type Props = {
  isDark: boolean;
  style?: StyleProp<ViewStyle>;
};

const POINTS = [
  { left: 18, top: 16, size: 5, role: 'primary' },
  { left: 48, top: 28, size: 3, role: 'spark' },
  { left: 82, top: 14, size: 4, role: 'link' },
  { left: 116, top: 42, size: 6, role: 'success' },
  { left: 26, top: 68, size: 4, role: 'link' },
  { left: 70, top: 78, size: 5, role: 'spark' },
  { left: 128, top: 76, size: 3, role: 'primary' },
];

export default function ConstellationAccent({ isDark, style }: Props) {
  const colors = getSmartRhColors(isDark);

  return (
    <View pointerEvents="none" style={[styles.wrap, style]}>
      <View style={[styles.line, styles.lineOne, { backgroundColor: colors.primaryBorder }]} />
      <View style={[styles.line, styles.lineTwo, { backgroundColor: colors.primaryBorder }]} />
      {POINTS.map((point, index) => {
        const backgroundColor =
          point.role === 'spark'
            ? colors.spark
            : point.role === 'success'
              ? colors.success
              : point.role === 'link'
                ? colors.link
                : colors.primary;

        return (
          <View
            key={`${point.left}-${point.top}-${index}`}
            style={[
              styles.point,
              {
                left: point.left,
                top: point.top,
                width: point.size,
                height: point.size,
                borderRadius: point.size / 2,
                backgroundColor,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    width: 154,
    height: 96,
    opacity: 0.88,
  },
  point: {
    position: 'absolute',
  },
  line: {
    position: 'absolute',
    height: 1,
    opacity: 0.7,
    transform: [{ rotate: '-18deg' }],
  },
  lineOne: {
    left: 28,
    top: 38,
    width: 88,
  },
  lineTwo: {
    left: 40,
    top: 64,
    width: 78,
    transform: [{ rotate: '14deg' }],
  },
});
