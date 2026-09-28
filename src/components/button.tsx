import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, fonts, radius, spacing } from '@/theme';

const variants = {
  primary: { backgroundColor: colors.accent, borderColor: colors.accent, color: colors.onTint },
  secondary: { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
  danger: { backgroundColor: colors.danger, borderColor: colors.danger, color: colors.onTint },
  dangerOutline: { backgroundColor: colors.surface, borderColor: colors.dangerBorder, color: colors.danger },
} as const;

const sizes = {
  md: { minHeight: 44, paddingHorizontal: spacing.md, fontSize: 14 },
  lg: { minHeight: 52, paddingHorizontal: spacing.mdl, fontSize: 16 },
} as const;

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  style,
}: ButtonProps) {
  const { color, ...surface } = variants[variant];
  const { fontSize, ...box } = sizes[size];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        surface,
        box,
        { opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <AppText style={{ color, fontSize, fontFamily: fonts.sansMedium }}>{title}</AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    borderCurve: 'continuous',
  },
});
