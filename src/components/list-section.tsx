import { Children, Fragment, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, spacing } from '@/theme';

type ListSectionProps = PropsWithChildren<{ label: string; hint?: string }>;

/** Full-width grouped list with hairline dividers (no cards), per the design. */
export function ListSection({ label, hint, children }: ListSectionProps) {
  const rows = Children.toArray(children);
  return (
    <View style={styles.section}>
      <View style={styles.labelRow}>
        <AppText variant="sectionLabel">{label.toUpperCase()}</AppText>
        {hint ? <AppText variant="monoSmall">{hint}</AppText> : null}
      </View>
      <View style={styles.group}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <View style={styles.divider} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

type ListRowProps = {
  title: string;
  value?: string;
  mono?: boolean;
  accessory?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
};

export function ListRow({ title, value, mono, accessory, onPress, destructive }: ListRowProps) {
  const content = (
    <>
      <AppText style={[styles.title, destructive && styles.destructive]}>{title}</AppText>
      {value ? (
        <AppText variant={mono ? 'monoSmall' : 'body'} style={!mono && styles.value}>
          {value}
        </AppText>
      ) : null}
      {accessory}
      {onPress && !destructive ? <AppText style={styles.chevron}>›</AppText> : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: spacing.md, gap: 6 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.mdl,
  },
  group: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
    marginLeft: spacing.mdl,
  },
  row: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.mdl,
    paddingVertical: spacing.sm,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  title: { flex: 1 },
  value: { color: colors.textSecondary },
  chevron: { color: colors.textDisabled, fontSize: 20, lineHeight: 22 },
  destructive: { color: colors.danger },
});
