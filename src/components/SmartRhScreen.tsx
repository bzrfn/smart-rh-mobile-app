import React, { forwardRef } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { SafeAreaView, type SafeAreaViewProps } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { screenSafeAreaEdges } from '../design/screenLayout';

export function SmartRhScreen({ edges, ...props }: SafeAreaViewProps) {
  const { token } = useAuth();
  const route = useRoute();
  return <SafeAreaView {...props} edges={edges ?? screenSafeAreaEdges(Boolean(token), route.name)} />;
}

export const SmartRhScrollView = forwardRef<ScrollView, ScrollViewProps>(function SmartRhScrollView(props, ref) {
  const { token } = useAuth();
  return <ScrollView {...props} ref={ref}
    contentInsetAdjustmentBehavior={token ? 'never' : props.contentInsetAdjustmentBehavior}
    automaticallyAdjustContentInsets={token ? false : props.automaticallyAdjustContentInsets} />;
});
