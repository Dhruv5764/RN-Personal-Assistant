import { Stack } from 'expo-router';

import { tabStackScreenOptions } from '@/constants/navigation';

export default function AssistantStack() {
  return (
    <Stack screenOptions={tabStackScreenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
