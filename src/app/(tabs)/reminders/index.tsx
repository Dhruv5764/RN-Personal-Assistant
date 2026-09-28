import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { colors, spacing } from '@/theme';

export default function RemindersScreen() {
  return (
    <Screen>
      <ScreenHeader
        title="Reminders"
        accessory={<Button title="New" onPress={() => router.push('/reminders/new')} />}
      />
      <View style={styles.body}>
        <AppText style={styles.muted}>No reminders yet.</AppText>
        <AppText variant="caption">Delivered as local notifications. No account, no server.</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.mdl, gap: spacing.sm },
  muted: { color: colors.textSecondary },
});
