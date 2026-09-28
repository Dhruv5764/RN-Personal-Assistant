import { Stack } from 'expo-router';

import { tabStackScreenOptions } from '@/constants/navigation';

export default function FilesStack() {
  return (
    <Stack screenOptions={tabStackScreenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Files' }} />
      <Stack.Screen name="[folder]" />
    </Stack>
  );
}
