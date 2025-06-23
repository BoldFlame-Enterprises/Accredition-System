// app/(main)/_layout.tsx - Main app layout
import { Stack } from 'expo-router';

export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2563eb',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="qr-display" 
        options={{ 
          title: 'Your QR Code',
          headerLeft: () => null, // Prevent going back
        }} 
      />
    </Stack>
  );
}