import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Dimensions,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import { useScanner } from '../context/ScannerContext';
import { DatabaseService } from '../services/DatabaseService';

interface ScannerScreenProps {
  route: any;
  navigation: any;
}

const { width } = Dimensions.get('window');

const ScannerScreen: React.FC<ScannerScreenProps> = ({ route, navigation }) => {
  const { scannerUser, selectedArea, setSelectedArea } = useScanner();
  const [hasPermission, setHasPermission] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [lastScanResult, setLastScanResult] = useState<{
    success: boolean;
    message: string;
    userName?: string;
    timestamp: Date;
  } | null>(null);

  const device = useCameraDevice('back');
  const areas = DatabaseService.getAvailableAreas();

  useEffect(() => {
    requestCameraPermission();
  }, []);

  const requestCameraPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'SportGate Scan needs camera access to scan QR codes',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
      } else {
        const cameraPermission = await Camera.requestCameraPermission();
        setHasPermission(cameraPermission === 'granted');
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      setHasPermission(false);
    }
  };

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13'],
    onCodeScanned: (codes) => {
      if (codes.length > 0 && isScanning) {
        handleQRCodeScanned(codes[0].value || '');
      }
    }
  });

  const handleQRCodeScanned = async (data: string) => {
    if (!isScanning) return;
    
    setIsScanning(false);
    
    try {
      const verification = await DatabaseService.verifyQRCode(data, selectedArea);
      const currentUser = scannerUser || route.params?.scannerUser;
      
      // Log the scan attempt
      if (verification.user) {
        await DatabaseService.logScan({
          user_id: verification.user.id,
          user_name: verification.user.name,
          area: selectedArea,
          access_granted: verification.success,
          failure_reason: verification.success ? undefined : verification.reason,
          scanned_at: new Date().toISOString(),
          scanner_user: currentUser?.name || 'Unknown Scanner'
        });
      }

      setLastScanResult({
        success: verification.success,
        message: verification.success 
          ? `Access GRANTED for ${verification.user?.name}` 
          : `Access DENIED: ${verification.reason}`,
        userName: verification.user?.name,
        timestamp: new Date()
      });

      // Show result for 2 seconds, then resume scanning
      setTimeout(() => {
        setLastScanResult(null);
        setIsScanning(true);
      }, 2000);

    } catch (error) {
      console.error('QR verification failed:', error);
      setLastScanResult({
        success: false,
        message: 'QR verification failed',
        timestamp: new Date()
      });
      
      setTimeout(() => {
        setLastScanResult(null);
        setIsScanning(true);
      }, 2000);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            navigation.navigate('Login');
          },
        },
      ]
    );
  };

  const currentUser = scannerUser || route.params?.scannerUser;

  if (!hasPermission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionText}>
          SportGate Scan needs camera access to scan QR codes for access control.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestCameraPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No camera device found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <Camera
          style={styles.camera}
          device={device}
          isActive={isScanning}
          codeScanner={codeScanner}
        />
        
        {/* Scan Overlay */}
        <View style={styles.overlay}>
          <View style={styles.scanArea} />
          <Text style={styles.scanInstructions}>
            Point camera at QR code
          </Text>
        </View>

        {/* Scan Result Overlay */}
        {lastScanResult && (
          <View style={[
            styles.resultOverlay,
            { backgroundColor: lastScanResult.success ? '#059669' : '#dc2626' }
          ]}>
            <Text style={styles.resultText}>
              {lastScanResult.success ? '✅ ACCESS GRANTED' : '❌ ACCESS DENIED'}
            </Text>
            {lastScanResult.userName && (
              <Text style={styles.resultUserText}>
                {lastScanResult.userName}
              </Text>
            )}
            <Text style={styles.resultMessage}>
              {lastScanResult.message}
            </Text>
          </View>
        )}
      </View>

      {/* Controls Panel */}
      <View style={styles.controlsPanel}>
        <ScrollView style={styles.controlsContent}>
          {/* Scanner Info */}
          <View style={styles.infoCard}>
            <Text style={styles.scannerName}>
              {currentUser?.name || 'Unknown Scanner'}
            </Text>
            <Text style={styles.scannerRole}>
              Role: {currentUser?.role || 'Unknown'}
            </Text>
          </View>

          {/* Area Selection */}
          <View style={styles.areaCard}>
            <Text style={styles.areaLabel}>Scanning Area:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedArea}
                onValueChange={setSelectedArea}
                style={styles.picker}
                mode="dropdown"
              >
                {areas.map((area) => (
                  <Picker.Item key={area} label={area} value={area} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.scanButton]} 
              onPress={() => setIsScanning(!isScanning)}
            >
              <Text style={styles.actionButtonText}>
                {isScanning ? 'Pause Scanning' : 'Resume Scanning'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.logoutButton]} 
              onPress={handleLogout}
            >
              <Text style={styles.actionButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>

          {/* Instructions */}
          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>Instructions:</Text>
            <Text style={styles.instructionText}>
              • Hold device steady and point camera at QR code
            </Text>
            <Text style={styles.instructionText}>
              • Green result = Access granted
            </Text>
            <Text style={styles.instructionText}>
              • Red result = Access denied
            </Text>
            <Text style={styles.instructionText}>
              • All scans are automatically logged
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraContainer: {
    flex: 0.6,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: width * 0.7,
    height: width * 0.7,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  scanInstructions: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 8,
  },
  resultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.95,
  },
  resultText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultUserText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  resultMessage: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  controlsPanel: {
    flex: 0.4,
    backgroundColor: '#f8fafc',
  },
  controlsContent: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scannerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#065f46',
    marginBottom: 4,
  },
  scannerRole: {
    fontSize: 14,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  areaCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  areaLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  scanButton: {
    backgroundColor: '#059669',
  },
  logoutButton: {
    backgroundColor: '#dc2626',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  instructionsCard: {
    backgroundColor: '#f0f9ff',
    padding: 16,
    borderRadius: 12,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#0369a1',
    marginBottom: 4,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  errorText: {
    fontSize: 18,
    color: '#dc2626',
    textAlign: 'center',
  },
});

export default ScannerScreen;
