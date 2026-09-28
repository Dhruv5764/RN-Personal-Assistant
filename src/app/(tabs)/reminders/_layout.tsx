import { Stack } from 'expo-router';

import { tabStackScreenOptions } from '@/constants/navigation';

export default function RemindersStack() {
  return (
    <Stack screenOptions={tabStackScreenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Reminders' }} />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
