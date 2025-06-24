// app/index.tsx - Landing/redirect page
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useUser } from '@/context/UserContext';

export default function Index() {
  const { user } = useUser();

  // Show loading while determining where to redirect
  if (user === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // Redirect based on authentication state
  if (user) {
    return <Redirect href="/(main)/qr-display" />;
  } else {
    return <Redirect href="/(auth)/login" />;
  }
}