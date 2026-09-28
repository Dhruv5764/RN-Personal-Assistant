import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, fonts, radius, spacing } from '@/theme';

export function OnDeviceBadge() {
  return (
    <View style={styles.badge} accessibilityLabel="Runs on this device. Nothing is uploaded.">
      <View style={styles.dot} />
      <AppText variant="caption" style={styles.label}>
        On-device · no upload
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
  },
  dot: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: colors.accent },
  label: { fontFamily: fonts.sansMedium, color: colors.accentText, marginLeft: spacing.xs / 2 },
});
