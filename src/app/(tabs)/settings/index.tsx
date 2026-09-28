import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ListRow, ListSection } from '@/components/list-section';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { getVoice } from '@/constants/voices';
import { useSettings } from '@/lib/settings';
import { spacing } from '@/theme';

export default function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const voice = getVoice(settings.voiceId);

  return (
    <Screen>
      <ScreenHeader title="Settings" />
      <ListSection label="Assistant">
        <ListRow title="Name" value={settings.paName} />
        <ListRow title="Voice" value={`${voice.name} · ${voice.description}`} />
        <ListRow title="Run setup again" onPress={() => updateSettings({ onboarded: false })} />
      </ListSection>
      <ListSection label="On-device models">
        <ListRow title="Language" value="llama-3.2 · not installed" mono />
        <ListRow title="Image classifier" value="not installed" mono />
        <ListRow title="Voice engine" value="not installed" mono />
      </ListSection>
      <View style={styles.footer}>
        <AppText variant="caption">Nothing you type, say or store leaves this phone.</AppText>
        <AppText variant="monoSmall">v{Constants.expoConfig?.version ?? '0.0.0'}</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { paddingHorizontal: spacing.mdl, paddingTop: spacing.lg, gap: spacing.xs },
});
