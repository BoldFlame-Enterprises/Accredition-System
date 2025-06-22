import * as SQLite from 'expo-sqlite';
import * as Device from 'expo-device';
import CryptoJS from 'crypto-js';

// Enable debugging

export interface User {
  id: number;
  email: string;
  name: string;
  phone: string;
  access_level: string;
  allowed_areas: string[];
  is_active: boolean;
}

class DatabaseServiceClass {
  private database: SQLite.Database | null = null;

  async initDatabase(): Promise<void> {
    try {
      this.database = SQLite.openDatabase('sportgate_pass.db');
      
      await this.createTables();
      await this.seedSampleData();
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        access_level TEXT NOT NULL,
        allowed_areas TEXT NOT NULL,
        is_active INTEGER DEFAULT 1
      );
    `;

    await this.database.executeSql(createUsersTable);
  }

  private async seedSampleData(): Promise<void> {
    const existingUsers = await this.getAllUsers();
    if (existingUsers.length > 0) {
      return; // Data already seeded
    }

    const sampleUsers: Omit<User, 'id'>[] = [
      {
        email: 'john.athlete@sports.com',
        name: 'John Athlete',
        phone: '+1234567890',
        access_level: 'General',
        allowed_areas: ['Main Arena', 'General Entrance', 'Food Court'],
        is_active: true
      },
      {
        email: 'sarah.vip@company.com',
        name: 'Sarah VIP Guest',
        phone: '+1234567891',
        access_level: 'VIP',
        allowed_areas: ['Main Arena', 'VIP Lounge', 'General Entrance', 'Food Court'],
        is_active: true
      },
      {
        email: 'mike.staff@event.com',
        name: 'Mike Staff Member',
        phone: '+1234567892',
        access_level: 'Staff',
        allowed_areas: ['Main Arena', 'Staff Area', 'General Entrance', 'Food Court'],
        is_active: true
      },
      {
        email: 'emma.security@event.com',
        name: 'Emma Security',
        phone: '+1234567893',
        access_level: 'Security',
        allowed_areas: ['Main Arena', 'Security Zone', 'Staff Area', 'General Entrance'],
        is_active: true
      },
      {
        email: 'david.manager@event.com',
        name: 'David Manager',
        phone: '+1234567894',
        access_level: 'Management',
        allowed_areas: ['Main Arena', 'VIP Lounge', 'Security Zone', 'Staff Area', 'General Entrance'],
        is_active: true
      },
      {
        email: 'lisa.coach@sports.com',
        name: 'Lisa Coach',
        phone: '+1234567895',
        access_level: 'Staff',
        allowed_areas: ['Main Arena', 'Staff Area', 'General Entrance'],
        is_active: true
      },
      {
        email: 'alex.media@news.com',
        name: 'Alex Media',
        phone: '+1234567896',
        access_level: 'General',
        allowed_areas: ['Main Arena', 'General Entrance'],
        is_active: true
      },
      {
        email: 'sophie.sponsor@corp.com',
        name: 'Sophie Sponsor',
        phone: '+1234567897',
        access_level: 'VIP',
        allowed_areas: ['Main Arena', 'VIP Lounge', 'General Entrance', 'Food Court'],
        is_active: true
      },
      {
        email: 'james.volunteer@event.com',
        name: 'James Volunteer',
        phone: '+1234567898',
        access_level: 'Staff',
        allowed_areas: ['General Entrance', 'Food Court'],
        is_active: true
      },
      {
        email: 'maria.official@sports.org',
        name: 'Maria Official',
        phone: '+1234567899',
        access_level: 'Management',
        allowed_areas: ['Main Arena', 'VIP Lounge', 'Security Zone', 'Staff Area', 'General Entrance'],
        is_active: true
      }
    ];

    for (const user of sampleUsers) {
      await this.insertUser(user);
    }
  }

  private async insertUser(user: Omit<User, 'id'>): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const insertQuery = `
      INSERT OR IGNORE INTO users (email, name, phone, access_level, allowed_areas, is_active) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await this.database.executeSql(insertQuery, [
      user.email,
      user.name,
      user.phone,
      user.access_level,
      JSON.stringify(user.allowed_areas),
      user.is_active ? 1 : 0
    ]);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const query = 'SELECT * FROM users WHERE email = ? AND is_active = 1';
    const results = await this.database.executeSql(query, [email]);

    if (results[0].rows.length > 0) {
      const row = results[0].rows.item(0);
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        phone: row.phone,
        access_level: row.access_level,
        allowed_areas: JSON.parse(row.allowed_areas),
        is_active: row.is_active === 1
      };
    }

    return null;
  }

  async getAllUsers(): Promise<User[]> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const query = 'SELECT * FROM users WHERE is_active = 1';
    const results = await this.database.executeSql(query);

    const users: User[] = [];
    for (let i = 0; i < results[0].rows.length; i++) {
      const row = results[0].rows.item(i);
      users.push({
        id: row.id,
        email: row.email,
        name: row.name,
        phone: row.phone,
        access_level: row.access_level,
        allowed_areas: JSON.parse(row.allowed_areas),
        is_active: row.is_active === 1
      });
    }

    return users;
  }

  // Device fingerprinting using expo-device
  async getDeviceFingerprint(): Promise<string> {
    const deviceId = Device.osInternalBuildId ?? Device.osBuildId ?? 'unknown';
    const deviceName = (await Device.getDeviceNameAsync()) ?? 'unknown';
    const systemVersion = Device.osVersion ?? 'unknown';
    
    const fingerprint = `${deviceId}-${deviceName}-${systemVersion}`;
    return CryptoJS.SHA256(fingerprint).toString();
  }

  // Secure QR code generation with HMAC
  async generateSecureQRData(user: User): Promise<string> {
    const deviceFingerprint = await this.getDeviceFingerprint();
    const timestamp = Date.now();
    
    const qrPayload = {
      user_id: user.id,
      email: user.email,
      name: user.name,
      access_level: user.access_level,
      allowed_areas: user.allowed_areas,
      timestamp,
      expires_at: timestamp + (60 * 60 * 1000), // 1 hour expiry
      device_fingerprint: deviceFingerprint,
      version: '2.0'
    };

    const payloadString = JSON.stringify(qrPayload);
    
    // Create HMAC signature for integrity
    const secret = 'event_secret_key_2024';
    const signature = CryptoJS.HmacSHA256(payloadString, secret).toString();

    const securePayload = {
      data: payloadString,
      signature,
      timestamp
    };

    return JSON.stringify(securePayload);
  }

  // Verify QR code integrity
  async verifyQRData(qrData: string): Promise<{ valid: boolean; payload?: any; reason?: string }> {
    try {
      const parsed = JSON.parse(qrData);
      
      if (!parsed.data || !parsed.signature || !parsed.timestamp) {
        return { valid: false, reason: 'Invalid QR format' };
      }

      // Check if QR is too old (older than 24 hours)
      if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
        return { valid: false, reason: 'QR code expired' };
      }

      // Verify signature
      const secret = 'event_secret_key_2024';
      const expectedSignature = CryptoJS.HmacSHA256(parsed.data, secret).toString();

      if (parsed.signature !== expectedSignature) {
        return { valid: false, reason: 'QR code tampered' };
      }

      const payload = JSON.parse(parsed.data);
      
      // Check expiry
      if (payload.expires_at && Date.now() > payload.expires_at) {
        return { valid: false, reason: 'QR code expired' };
      }

      return { valid: true, payload };
    } catch (error) {
      return { valid: false, reason: 'Invalid QR data' };
    }
  }
}

export const DatabaseService = new DatabaseServiceClass();
