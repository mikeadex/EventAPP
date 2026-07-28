import { Tabs } from 'expo-router';
import { FloatingTabBar } from '@/components/floating-tab-bar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {/* Every tab renders its own safe-area header for a consistent look. */}
      <Tabs.Screen name="index" options={{ title: 'Discover' }} />
      <Tabs.Screen name="hosts" options={{ title: 'Hosts' }} />
      <Tabs.Screen name="tickets" options={{ title: 'Tickets' }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
