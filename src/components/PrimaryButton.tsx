import React from 'react';
import { Pressable, Text } from 'react-native';

export default function PrimaryButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: '#1f3cff',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '800', textAlign: 'center' }}>{title}</Text>
    </Pressable>
  );
}
