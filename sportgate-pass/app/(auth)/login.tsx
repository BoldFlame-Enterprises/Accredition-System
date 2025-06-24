// app/(auth)/login.tsx - Login screen
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { DatabaseService } from '@/services/DatabaseService';
import { useUser } from '@/context/UserContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { setUser } = useUser();

  const handleAutoLogin = useCallback(async (storedEmail: string) => {
    try {
      const user = await DatabaseService.getUserByEmail(storedEmail.toLowerCase().trim());
      if (user) {
        setUser(user);
        router.replace('/(main)/qr-display');
      }
    } catch (error) {
      console.error('Auto-login failed:', error);
    }
  }, [setUser]);

  const loadStoredCredentials = useCallback(async () => {
    try {
      const storedEmail = await DatabaseService.getStoredEmail();
      const isRecent = await DatabaseService.isLoginRecent();
      
      if (storedEmail && isRecent) {
        setEmail(storedEmail);
        setRememberMe(true);
        
        // Auto-login if credentials are recent (within 24 hours)
        await handleAutoLogin(storedEmail);
      } else if (storedEmail) {
        setEmail(storedEmail);
        setRememberMe(true);
      }
    } catch (error) {
      console.error('Error loading stored credentials:', error);
    }
  }, [handleAutoLogin]);

  // Load stored email on component mount
  useEffect(() => {
    loadStoredCredentials();
  }, [loadStoredCredentials]);

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setIsLoading(true);

    try {
      const user = await DatabaseService.getUserByEmail(email.toLowerCase().trim());
      
      if (user) {
        // Store credentials if remember me is enabled
        if (rememberMe) {
          await DatabaseService.storeUserCredentials(email.toLowerCase().trim(), true);
        } else {
          await DatabaseService.clearStoredCredentials();
        }
        
        setUser(user);
        router.replace('/(main)/qr-display');
      } else {
        Alert.alert(
          'Login Failed', 
          'User not found. Please check your email address.\n\nDemo users:\n• john.athlete@sports.com\n• sarah.vip@company.com\n• mike.staff@event.com'
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Login failed. Please try again.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const showDemoUsers = async () => {
    try {
      const demoUsers = await DatabaseService.getDemoUsers();
      
      if (demoUsers.length === 0) {
        Alert.alert('Demo Users', 'No demo users found in database.');
        return;
      }

      const userList = demoUsers
        .map(user => `• ${user.email} (${user.access_level})`)
        .join('\n');

      Alert.alert(
        'Demo Users',
        'Available demo accounts:\n\n' + userList + '\n\nAll users are stored in encrypted SQLite database.',
        [
          { text: 'Reset Demo Data', style: 'destructive', onPress: resetDemoData },
          { text: 'OK', style: 'default' }
        ]
      );
    } catch (error) {
      console.error('Error loading demo users:', error);
      Alert.alert('Error', 'Failed to load demo users from database.');
    }
  };

  const resetDemoData = async () => {
    Alert.alert(
      'Reset Demo Data',
      'This will reset all demo users in the database. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.resetDemoData();
              Alert.alert('Success', 'Demo data has been reset.');
            } catch {
              Alert.alert('Error', 'Failed to reset demo data.');
            }
          }
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>SportGate Pass</Text>
          <Text style={styles.subtitle}>Secure Digital Access</Text>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />

            <View style={styles.rememberMeContainer}>
              <Switch
                value={rememberMe}
                onValueChange={setRememberMe}
                trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                thumbColor={rememberMe ? '#2563eb' : '#f4f3f4'}
              />
              <Text style={styles.rememberMeText}>Remember me</Text>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              <Text style={styles.loginButtonText}>
                {isLoading ? 'Logging in...' : 'Login'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.demoButton}
              onPress={showDemoUsers}
            >
              <Text style={styles.demoButtonText}>View Demo Users</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Secure QR Code Generation
            </Text>
            <Text style={styles.footerSubtext}>
              Anti-screenshot protection enabled
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: '#64748b',
    marginBottom: 40,
  },
  formContainer: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
    marginBottom: 20,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  rememberMeText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#374151',
  },
  loginButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  demoButton: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  demoButtonText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
});