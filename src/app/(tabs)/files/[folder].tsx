import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { getCategoryName } from '@/constants/categories';
import { colors, spacing } from '@/theme';

export default function FolderScreen() {
  const { folder } = useLocalSearchParams<{ folder: string }>();

  return (
    <>
      <Stack.Screen options={{ title: getCategoryName(folder) }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.body}>
        <AppText style={styles.muted}>No files in this folder yet.</AppText>
        <AppText variant="monoSmall">rename · move · change category · delete come next</AppText>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.mdl, gap: spacing.sm },
  muted: { color: colors.textSecondary },
});
