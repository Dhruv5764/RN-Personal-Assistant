import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { OnDeviceBadge } from '@/components/on-device-badge';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { LLM_ASSET } from '@/lib/setup/assets';
import { useSettings } from '@/lib/settings';
import { colors, hitTarget, radius, spacing } from '@/theme';

export default function AssistantScreen() {
  const { settings } = useSettings();
  const router = useRouter();

  return (
    <Screen>
      <ScreenHeader
        title={settings.paName}
        subtitle={`${LLM_ASSET.detail} · ready`}
        accessory={
          <View style={styles.accessory}>
            <OnDeviceBadge />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Talk to ${settings.paName}`}
              onPress={() => router.push('/voice')}
              style={({ pressed }) => [styles.voiceButton, pressed && { opacity: 0.75 }]}>
              <SymbolView name={{ ios: 'mic.fill', android: 'mic' }} size={20} tintColor={colors.onTint} />
            </Pressable>
          </View>
        }
        divider
      />
      <View style={styles.body}>
        <AppText style={styles.muted}>
          Ask a question, or tell {settings.paName} to manage your calendar and files.
        </AppText>
        <AppText variant="monoSmall">tap the mic to talk · text chat comes next</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.mdl, gap: spacing.sm },
  muted: { color: colors.textSecondary },
  accessory: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  voiceButton: {
    width: hitTarget,
    height: hitTarget,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
