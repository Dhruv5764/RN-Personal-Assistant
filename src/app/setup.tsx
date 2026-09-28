import { useKeepAwake } from 'expo-keep-awake';
import { SymbolView } from 'expo-symbols';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { OnDeviceBadge } from '@/components/on-device-badge';
import { formatBytes } from '@/lib/llm/models';
import { SETUP_ASSETS, type SetupAsset } from '@/lib/setup/assets';
import { isAssetReady, setupDownloads, useSetupDownloads, type SetupState } from '@/lib/setup/downloads';
import { colors, fonts, radius, spacing } from '@/theme';

/**
 * First launch: download the speech recognizer, the voices and the language model once.
 * The root layout shows this screen until everything is on the phone.
 */
export default function SetupScreen() {
  const state = useSetupDownloads();
  const total = setupDownloads.totalBytes;
  const fraction = Math.min(1, state.received / total);
  const busy = state.status === 'downloading' || state.status === 'unpacking';

  // Starting is the whole point of this screen; the user can pause right away if needed.
  useEffect(() => {
    if (setupDownloads.getState().status === 'idle') setupDownloads.start();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      {busy ? <KeepAwake /> : null}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <View style={styles.badgeRow}>
            <OnDeviceBadge />
          </View>
          <AppText variant="display" accessibilityRole="header">
            Getting your assistant ready
          </AppText>
          <AppText style={styles.muted}>
            Speech, voices and the language model are downloaded once and stored on this phone, so
            everything works offline afterwards. Use Wi-Fi: it’s {formatBytes(total)}.
          </AppText>
        </View>

        <View style={styles.summary}>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}>
            {/* Absolutely positioned and childless, so resizing it never re-lays-out siblings. */}
            <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
          </View>
          <AppText variant="mono">
            {formatBytes(state.received)} of {formatBytes(total)} · {Math.floor(fraction * 100)}%
          </AppText>
          <AppText variant="caption">{describe(state)}</AppText>
        </View>

        <View style={styles.list}>
          {SETUP_ASSETS.map((asset, index) => (
            <AssetRow key={asset.id} asset={asset} state={state} divider={index > 0} />
          ))}
        </View>

        <View style={styles.footer}>
          <Action state={state} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AssetRow({ asset, state, divider }: { asset: SetupAsset; state: SetupState; divider: boolean }) {
  const isCurrent = state.current?.id === asset.id;
  const done = state.status === 'ready' || (!isCurrent && isAssetReady(asset));

  let status: ReactNode = <AppText variant="monoSmall">{formatBytes(asset.bytes)}</AppText>;
  if (done) {
    status = <SymbolView name={{ ios: 'checkmark', android: 'check' }} size={18} tintColor={colors.accent} />;
  } else if (isCurrent && (state.status === 'downloading' || state.status === 'unpacking')) {
    status = (
      <View style={styles.rowStatus}>
        <ActivityIndicator size="small" color={colors.accent} />
        <AppText variant="monoSmall">{state.status === 'unpacking' ? 'unpacking' : 'downloading'}</AppText>
      </View>
    );
  }

  return (
    <View style={[styles.row, divider && styles.divider]} accessible accessibilityLabel={`${asset.label}, ${done ? 'done' : isCurrent ? state.status : 'waiting'}`}>
      <View style={styles.rowText}>
        <AppText style={styles.rowLabel}>{asset.label}</AppText>
        <AppText variant="monoSmall">{asset.detail}</AppText>
      </View>
      {status}
    </View>
  );
}

function Action({ state }: { state: SetupState }) {
  switch (state.status) {
    case 'downloading':
      return <Button title="Pause" variant="secondary" size="lg" onPress={setupDownloads.pause} />;
    case 'unpacking':
      return <Button title="Unpacking…" variant="secondary" size="lg" disabled />;
    case 'paused':
      return <Button title="Resume" size="lg" onPress={setupDownloads.start} />;
    case 'error':
      return <Button title="Try again" size="lg" onPress={setupDownloads.start} />;
    case 'idle':
      return <Button title={`Download ${formatBytes(setupDownloads.totalBytes)}`} size="lg" onPress={setupDownloads.start} />;
    default:
      return null;
  }
}

function describe(state: SetupState) {
  switch (state.status) {
    case 'downloading':
      return `Downloading ${state.current.label.toLowerCase()}. Keep the app open; if you leave, it pauses and continues when you come back.`;
    case 'unpacking':
      return `Unpacking ${state.current.label.toLowerCase()}…`;
    case 'paused':
      return 'Paused. Your progress is saved.';
    case 'error':
      return `Download stopped: ${state.message}`;
    case 'ready':
      return 'All set.';
    default:
      return 'Waiting to start.';
  }
}

/** Keeps the screen on while mounted, so a long download isn't cut off by auto-lock. */
function KeepAwake() {
  useKeepAwake();
  return null;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.mdl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  intro: { gap: spacing.smd },
  badgeRow: { flexDirection: 'row' },
  muted: { color: colors.textSecondary },
  summary: { gap: spacing.sm },
  track: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  list: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smd,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontFamily: fonts.sansMedium },
  rowStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: { marginTop: 'auto' },
});
