import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, spacing } from '@/theme';

export default function ReminderEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  return (
    <>
      <Stack.Screen options={{ title: isNew ? 'New reminder' : 'Edit reminder' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.body}>
        <AppText style={styles.muted}>Title, date, time, repeat and notes go here.</AppText>
        <AppText variant="monoSmall">reminder id · {id}</AppText>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.mdl, gap: spacing.sm },
  muted: { color: colors.textSecondary },
});
