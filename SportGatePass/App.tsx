import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'react-native';
import { DatabaseService } from './src/services/DatabaseService';
import LoginScreen from './src/screens/LoginScreen';
import QRDisplayScreen from './src/screens/QRDisplayScreen';
import { UserProvider } from './src/context/UserContext';

export type RootStackParamList = {
  Login: undefined;
  QRDisplay: { user: any };
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const setupApp = async () => {
      try {        
        // Initialize database
        await DatabaseService.initDatabase();
        
        setIsReady(true);
      } catch (error) {
        console.error('App setup error:', error);
        setIsReady(true); // Continue even if some features fail
      }
    };

    setupApp();
  }, []);

  if (!isReady) {
    return null; // Could add a loading screen here
  }

  return (
    <UserProvider>
      <NavigationContainer>
        <StatusBar barStyle="dark-content" />
        <Stack.Navigator
          initialRouteName="Login"
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
            name="Login" 
            component={LoginScreen}
            options={{ title: 'SportGate Pass Login' }}
          />
          <Stack.Screen 
            name="QRDisplay" 
            component={QRDisplayScreen}
            options={{ 
              title: 'Your QR Code',
              headerLeft: () => null, // Prevent going back
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </UserProvider>
  );
}
