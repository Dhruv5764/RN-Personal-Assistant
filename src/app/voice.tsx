import { useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { VoiceOrb, type OrbPhase } from '@/components/voice-orb';
import { useSettings } from '@/lib/settings';
import { useVoiceConversation, type VoicePhase } from '@/lib/voice/use-voice-conversation';
import { colors, hitTarget, radius, spacing } from '@/theme';

export default function VoiceScreen() {
  const router = useRouter();
  const { settings } = useSettings();
  const voice = useVoiceConversation({ voiceId: settings.voiceId, paName: settings.paName });
  const [captions, setCaptions] = useState(true);
  const elapsed = useElapsed();
  const scroll = useRef<ScrollView>(null);

  const status = describe(voice.phase, voice.muted, settings.paName, voice.error);
  const orbPhase: OrbPhase =
    voice.phase === 'listening' || voice.phase === 'thinking' || voice.phase === 'speaking' ? voice.phase : 'idle';
  const canInterrupt = voice.phase === 'speaking' || voice.phase === 'thinking';
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <IconButton icon={{ ios: 'chevron.left', android: 'chevron_left' }} label="Back to chat" onPress={leave} />
        <View style={styles.titles}>
          <AppText variant="headline" accessibilityRole="header" style={styles.title}>
            Voice with {settings.paName}
          </AppText>
          <AppText variant="monoSmall">on-device · {elapsed}</AppText>
        </View>
        <IconButton
          icon={{ ios: 'captions.bubble', android: 'closed_caption' }}
          label={captions ? 'Hide transcript' : 'Show transcript'}
          selected={captions}
          onPress={() => setCaptions((on) => !on)}
        />
      </View>

      <ScrollView
        ref={scroll}
        style={styles.transcript}
        contentContainerStyle={styles.transcriptContent}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        {captions ? (
          <View accessibilityLiveRegion="polite" style={styles.turns}>
            {voice.turns.map((turn, index) => {
              const recent = index >= voice.turns.length - 2;
              return (
                <View key={turn.id} style={[styles.turn, !recent && styles.turnOld]}>
                  <AppText variant="monoSmall" style={turn.role === 'assistant' && styles.assistantLabel}>
                    {turn.role === 'user' ? 'YOU' : settings.paName.toUpperCase()}
                  </AppText>
                  <AppText>{turn.text}</AppText>
                </View>
              );
            })}
            {voice.phase === 'listening' && !voice.muted && voice.partial ? (
              <View style={styles.turn}>
                <AppText variant="monoSmall">YOU · LIVE</AppText>
                <AppText style={styles.live}>
                  {voice.partial}
                  <AppText style={styles.caret}> ▍</AppText>
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.center}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={canInterrupt ? `Interrupt ${settings.paName}` : status.label}
          accessibilityState={{ disabled: !canInterrupt }}
          onPress={canInterrupt ? voice.interrupt : undefined}>
          <VoiceOrb phase={orbPhase} muted={voice.muted} level={voice.level} />
        </Pressable>
        <View accessibilityRole="text" accessibilityLiveRegion="polite" style={styles.status}>
          <AppText variant="sectionLabel" style={{ color: status.color }}>
            {status.label}
          </AppText>
          <AppText variant="caption" style={styles.hint}>
            {status.hint}
          </AppText>
          {voice.phase === 'error' ? <Button title="Try again" variant="secondary" onPress={voice.retry} /> : null}
          {voice.phase === 'no-permission' ? (
            <Button title="Open Settings" variant="secondary" onPress={() => Linking.openSettings()} />
          ) : null}
        </View>
      </View>

      <View style={styles.controls}>
        <Control
          icon={voice.muted ? { ios: 'mic.slash.fill', android: 'mic_off' } : { ios: 'mic.fill', android: 'mic' }}
          label={voice.muted ? 'Unmute' : 'Mute'}
          accessibilityLabel={voice.muted ? 'Unmute microphone' : 'Mute microphone'}
          inverted={voice.muted}
          disabled={voice.phase === 'loading' || voice.phase === 'no-permission' || voice.phase === 'error'}
          onPress={voice.toggleMute}
        />
        <Control
          icon={{ ios: 'xmark', android: 'close' }}
          label="End"
          accessibilityLabel="End voice conversation"
          danger
          onPress={leave}
        />
        <Control
          icon={{ ios: 'keyboard', android: 'keyboard' }}
          label="Type"
          accessibilityLabel="Switch to typing"
          onPress={leave}
        />
      </View>
    </SafeAreaView>
  );
}

function describe(phase: VoicePhase, muted: boolean, paName: string, error: string | null) {
  if (phase === 'no-permission') {
    return { label: 'MIC BLOCKED', hint: 'Allow microphone access in Settings to talk.', color: colors.danger };
  }
  if (phase === 'error') {
    return { label: 'SOMETHING WENT WRONG', hint: error ?? 'Voice stopped unexpectedly.', color: colors.danger };
  }
  if (phase === 'loading') {
    return { label: 'GETTING READY', hint: 'Loading speech and language models on this phone', color: colors.textSecondary };
  }
  if (muted) {
    return { label: 'MIC OFF', hint: `${paName} can’t hear you. Tap the mic to unmute.`, color: colors.textSecondary };
  }
  if (phase === 'thinking') return { label: 'THINKING', hint: 'Working it out on this phone. Tap to cancel.', color: colors.accentText };
  if (phase === 'speaking') return { label: 'SPEAKING', hint: 'Tap the orb to interrupt', color: colors.text };
  return { label: 'LISTENING', hint: 'Speak naturally. Pause to send.', color: colors.accentText };
}

/** mm:ss since the screen opened. */
function useElapsed() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

type IconName = SymbolViewProps['name'];

function IconButton({
  icon,
  label,
  selected,
  onPress,
}: {
  icon: IconName;
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, selected && styles.iconButtonOn, pressed && styles.pressed]}>
      <SymbolView name={icon} size={20} tintColor={colors.text} />
    </Pressable>
  );
}

function Control({
  icon,
  label,
  accessibilityLabel,
  inverted,
  danger,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  accessibilityLabel: string;
  inverted?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const tint = danger || inverted ? colors.onTint : colors.text;
  return (
    <View style={styles.control}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!disabled, selected: inverted }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.controlButton,
          danger && styles.controlDanger,
          inverted && styles.controlInverted,
          disabled && styles.disabled,
          pressed && styles.pressed,
        ]}>
        <SymbolView name={icon} size={danger ? 26 : 22} tintColor={tint} />
      </Pressable>
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.smd,
    paddingVertical: spacing.sm,
  },
  titles: { flex: 1, alignItems: 'center', gap: 2 },
  title: { fontSize: 17 },
  iconButton: {
    width: hitTarget,
    height: hitTarget,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonOn: { backgroundColor: colors.accentSoft },
  transcript: { flex: 1 },
  transcriptContent: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: spacing.mdl, paddingTop: spacing.xs },
  turns: { gap: spacing.smd },
  turn: { gap: 3 },
  turnOld: { opacity: 0.6 },
  assistantLabel: { color: colors.accentText },
  live: { fontSize: 17, lineHeight: 24, color: colors.textSecondary },
  caret: { color: colors.accent },
  center: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  status: { alignItems: 'center', gap: 3, paddingHorizontal: spacing.mdl, minHeight: 40 },
  hint: { textAlign: 'center', fontSize: 13, lineHeight: 18 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  control: { alignItems: 'center', gap: 6, minWidth: 64 },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlDanger: { width: 72, height: 72, borderWidth: 0, backgroundColor: colors.danger },
  controlInverted: { backgroundColor: colors.text, borderColor: colors.text },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
});
