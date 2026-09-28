import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, spacing } from '@/theme';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  accessory?: ReactNode;
  divider?: boolean;
};

export function ScreenHeader({ title, subtitle, accessory, divider = false }: ScreenHeaderProps) {
  return (
    <View style={[styles.container, divider && styles.divider]}>
      <View style={styles.titles}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? <AppText variant="monoSmall">{subtitle}</AppText> : null}
      </View>
      {accessory}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.smd,
    paddingHorizontal: spacing.mdl,
    paddingTop: spacing.md,
    paddingBottom: spacing.smd,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  titles: { flexShrink: 1, gap: 2 },
});
