import { Text, type TextProps } from 'react-native';

import { type } from '@/theme';

export type AppTextProps = TextProps & { variant?: keyof typeof type };

export function AppText({ variant = 'body', style, ...props }: AppTextProps) {
  return <Text style={[type[variant], style]} {...props} />;
}
