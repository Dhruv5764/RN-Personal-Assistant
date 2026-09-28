import { Stack } from 'expo-router';

import { tabStackScreenOptions } from '@/constants/navigation';

export default function CalendarStack() {
  return (
    <Stack screenOptions={tabStackScreenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
