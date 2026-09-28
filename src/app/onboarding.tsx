import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { OnDeviceBadge } from '@/components/on-device-badge';
import { VOICES, type VoiceId } from '@/constants/voices';
import { useSettings } from '@/lib/settings';
import { speak, stopSpeaking } from '@/lib/voice/tts';
import { colors, fonts, radius, spacing } from '@/theme';

/** Name the assistant and pick (and hear) its voice. Runs after the first-launch downloads. */
export default function OnboardingScreen() {
  const { settings, updateSettings } = useSettings();
  const [name, setName] = useState(settings.paName);
  const [voiceId, setVoiceId] = useState<VoiceId>(settings.voiceId);
  const trimmedName = name.trim();
  const preview = useVoicePreview();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <View style={styles.badgeRow}>
            <OnDeviceBadge />
          </View>
          <AppText variant="display" accessibilityRole="header">
            Set up your assistant
          </AppText>
          <AppText style={styles.muted}>
            Everything runs on this phone. Nothing you type, say or store is uploaded.
          </AppText>
        </View>

        <View style={styles.field}>
          <AppText variant="label" nativeID="pa-name-label">
            Assistant name
          </AppText>
          <TextInput
            value={name}
            onChangeText={setName}
            accessibilityLabelledBy="pa-name-label"
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={24}
            returnKeyType="done"
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <AppText variant="label">Voice</AppText>
          <View style={styles.voiceGroup} accessibilityRole="radiogroup">
            {VOICES.map((voice, index) => {
              const selected = voice.id === voiceId;
              const status = preview.statusOf(voice.id);
              return (
                <View
                  key={voice.id}
                  style={[styles.voiceRow, index > 0 && styles.voiceDivider, selected && styles.voiceSelected]}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`${voice.name}, ${voice.description}`}
                    onPress={() => {
                      if (voice.id === voiceId) return;
                      setVoiceId(voice.id);
                      preview.play(voice.id, trimmedName || 'Aria');
                    }}
                    style={({ pressed }) => [styles.voiceChoice, pressed && styles.voicePressed]}>
                    <View style={[styles.radio, selected && styles.radioOn]}>
                      {selected ? <View style={styles.radioDot} /> : null}
                    </View>
                    <View style={styles.voiceText}>
                      <AppText style={styles.voiceName}>{voice.name}</AppText>
                      <AppText variant="caption">{voice.description}</AppText>
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={status === 'idle' ? `Preview ${voice.name}` : `Stop preview of ${voice.name}`}
                    accessibilityState={{ busy: status === 'loading' }}
                    onPress={() => {
                      setVoiceId(voice.id);
                      preview.toggle(voice.id, trimmedName || 'Aria');
                    }}
                    style={({ pressed }) => [
                      styles.previewButton,
                      status !== 'idle' && styles.previewButtonActive,
                      pressed && { opacity: 0.7 },
                    ]}>
                    {status === 'loading' ? (
                      <ActivityIndicator size="small" color={colors.onTint} />
                    ) : (
                      <SymbolView
                        name={status === 'playing' ? { ios: 'stop.fill', android: 'stop' } : { ios: 'play.fill', android: 'play_arrow' }}
                        size={16}
                        tintColor={status === 'idle' ? colors.text : colors.onTint}
                      />
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>
          {preview.error ? (
            <AppText variant="caption" style={styles.error}>
              Couldn’t play the preview: {preview.error}
            </AppText>
          ) : (
            <AppText variant="monoSmall">piper · onnx · 4 voices on this phone</AppText>
          )}
        </View>

        <View style={styles.footer}>
          <Button
            title="Continue"
            size="lg"
            disabled={!trimmedName}
            onPress={() => {
              stopSpeaking();
              updateSettings({ paName: trimmedName, voiceId, onboarded: true });
            }}
          />
          <AppText variant="caption" style={styles.center}>
            You can change the name and voice later in Settings.
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type PreviewStatus = 'idle' | 'loading' | 'playing';

/** Plays a short sample in one voice at a time; tapping the playing voice stops it. */
function useVoicePreview() {
  const [current, setCurrent] = useState<{ voiceId: VoiceId; status: PreviewStatus } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  useEffect(() => () => void stopSpeaking(), []);

  const play = async (voiceId: VoiceId, paName: string) => {
    const id = ++request.current;
    setError(null);
    setCurrent({ voiceId, status: 'loading' });
    try {
      const speech = await speak(voiceId, `Hey, I'm ${paName}, your personal assistant. Nice to meet you!`);
      if (id !== request.current) return;
      setCurrent({ voiceId, status: 'playing' });
      await speech.finished;
    } catch (e) {
      if (id === request.current) setError(e instanceof Error ? e.message : String(e));
    }
    if (id === request.current) setCurrent(null);
  };

  const toggle = async (voiceId: VoiceId, paName: string) => {
    if (current?.voiceId !== voiceId) return play(voiceId, paName);
    request.current++;
    setCurrent(null);
    await stopSpeaking();
  };

  return {
    play,
    toggle,
    error,
    statusOf: (voiceId: VoiceId): PreviewStatus => (current?.voiceId === voiceId ? current.status : 'idle'),
  };
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.mdl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.xl,
  },
  intro: { gap: spacing.smd },
  badgeRow: { flexDirection: 'row' },
  muted: { color: colors.textSecondary },
  field: { gap: spacing.sm },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    fontFamily: fonts.sans,
    fontSize: 17,
    color: colors.text,
  },
  voiceGroup: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  voiceChoice: {
    flex: 1,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smd,
    paddingLeft: 14,
  },
  previewButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButtonActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  error: { color: colors.danger },
  voiceDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  voiceSelected: { backgroundColor: '#F2F7F6' }, // accent at ~4% on white; only used here
  voicePressed: { backgroundColor: colors.surfaceMuted },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.textDisabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: radius.full, backgroundColor: colors.accent },
  voiceText: { flex: 1, gap: 2 },
  voiceName: { fontFamily: fonts.sansMedium },
  footer: { marginTop: 'auto', gap: spacing.smd },
  center: { textAlign: 'center' },
});
