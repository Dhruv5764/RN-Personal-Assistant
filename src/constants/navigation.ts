import { colors, fonts } from '@/theme';

// Shared options for the stack inside each tab. Tab roots draw their own ScreenHeader;
// pushed screens (edit reminder, folder) use the native header styled to the theme.
export const tabStackScreenOptions = {
  contentStyle: { backgroundColor: colors.background },
  headerStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
  headerTintColor: colors.accent,
  headerTitleStyle: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.text },
  headerBackTitleStyle: { fontFamily: fonts.sans },
} as const;
