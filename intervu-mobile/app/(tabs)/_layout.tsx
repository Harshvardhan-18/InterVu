import { Stack } from 'expo-router';

export default function TabsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="new-interview" />
      <Stack.Screen name="interview/[id]" />
      <Stack.Screen name="report/[id]" />
    </Stack>
  );
}
