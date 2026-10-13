import React from 'react';
import { StyleSheet, View } from 'react-native';

type Props = {
  color: string;
  hidden?: boolean;
};

export default function PasswordEyeIcon({ color, hidden = false }: Props) {
  return (
    <View style={styles.wrap} accessibilityElementsHidden>
      <View style={[styles.eye, { borderColor: color }]}>
        <View style={[styles.pupil, { backgroundColor: color }]} />
      </View>

      {hidden ? (
        <View style={[styles.slash, { backgroundColor: color }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eye: {
    width: 22,
    height: 14,
    borderWidth: 2,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  pupil: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  slash: {
    position: 'absolute',
    width: 26,
    height: 2,
    borderRadius: 999,
    transform: [{ rotate: '-42deg' }],
  },
});
