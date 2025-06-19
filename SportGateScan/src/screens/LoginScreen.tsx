import React, { useState } from 'react';
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
} from 'react-native';
import { DatabaseService } from '../services/DatabaseService';
import { useScanner } from '../context/ScannerContext';

interface LoginScreenProps {
  navigation: any;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setScannerUser } = useScanner();

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setIsLoading(true);

    try {
      const scannerUser = await DatabaseService.getScannerUserByEmail(email.toLowerCase().trim());
      
      if (scannerUser) {
        setScannerUser(scannerUser);
        navigation.navigate('Scanner', { scannerUser });
      } else {
        Alert.alert(
          'Login Failed', 
          'Scanner account not found. Please check your email address.\n\nDemo scanner accounts:\n• scanner1@event.com\n• scanner2@event.com\n• security@event.com\n• admin@event.com'
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Login failed. Please try again.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const showDemoAccounts = () => {
    Alert.alert(
      'Demo Scanner Accounts',
      'Available scanner accounts:\n\n' +
      '• scanner1@event.com (Volunteer)\n' +
      '• scanner2@event.com (Volunteer)\n' +
      '• security@event.com (Security)\n' +
      '• admin@event.com (Admin)\n\n' +
      'These accounts can scan QR codes from the SportGate Pass app.',
      [{ text: 'OK' }]
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>SportGate Scan</Text>
          <Text style={styles.subtitle}>Professional Access Control</Text>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Scanner Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your scanner email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              <Text style={styles.loginButtonText}>
                {isLoading ? 'Logging in...' : 'Start Scanning'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.demoButton}
              onPress={showDemoAccounts}
            >
              <Text style={styles.demoButtonText}>View Demo Accounts</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>📱 How to Use</Text>
            <Text style={styles.infoText}>
              1. Login with your scanner account
            </Text>
            <Text style={styles.infoText}>
              2. Select the area you're scanning for
            </Text>
            <Text style={styles.infoText}>
              3. Point camera at QR codes to verify access
            </Text>
            <Text style={styles.infoText}>
              4. Green = Access granted, Red = Access denied
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Offline QR Verification
            </Text>
            <Text style={styles.footerSubtext}>
              Works without internet connection
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0fdf4',
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
    color: '#065f46',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: '#059669',
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
    marginBottom: 20,
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
  loginButton: {
    backgroundColor: '#059669',
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
    borderColor: '#059669',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  demoButtonText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '500',
  },
  infoContainer: {
    backgroundColor: '#f0f9ff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#0369a1',
    marginBottom: 6,
  },
  footer: {
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

export default LoginScreen;
