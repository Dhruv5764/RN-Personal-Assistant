import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { useSettings } from '@/lib/settings';
import { colors, spacing } from '@/theme';

export default function CalendarScreen() {
  const { settings } = useSettings();

  return (
    <Screen>
      <ScreenHeader title="Calendar" />
      <View style={styles.body}>
        <AppText style={styles.muted}>
          View only. Ask {settings.paName} to add, move or delete events.
        </AppText>
        <AppText variant="monoSmall">month / list view + expo-calendar come next</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.mdl, gap: spacing.sm },
  muted: { color: colors.textSecondary },
});
