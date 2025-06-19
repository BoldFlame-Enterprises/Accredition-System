import SQLite from 'react-native-sqlite-storage';
import CryptoJS from 'crypto-js';

// Enable debugging
SQLite.DEBUG(false);
SQLite.enablePromise(true);

export interface User {
  id: number;
  email: string;
  name: string;
  phone: string;
  access_level: string;
  allowed_areas: string[];
  is_active: boolean;
}

export interface ScannerUser {
  id: number;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
}

export interface ScanLog {
  id?: number;
  user_id: number;
  user_name: string;
  area: string;
  access_granted: boolean;
  failure_reason?: string;
  scanned_at: string;
  scanner_user: string;
}

class DatabaseServiceClass {
  private database: SQLite.SQLiteDatabase | null = null;

  async initDatabase(): Promise<void> {
    try {
      this.database = await SQLite.openDatabase({
        name: 'sportgate_scan.db',
        location: 'default',
        createFromLocation: '~sportgate_scan.db',
      });
      
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

    // Users table (copied from QR Generator for verification)
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

    // Scanner users table
    const createScannerUsersTable = `
      CREATE TABLE IF NOT EXISTS scanner_users (
        id INTEGER PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        is_active INTEGER DEFAULT 1
      );
    `;

    // Scan logs table
    const createScanLogsTable = `
      CREATE TABLE IF NOT EXISTS scan_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        user_name TEXT NOT NULL,
        area TEXT NOT NULL,
        access_granted INTEGER NOT NULL,
        failure_reason TEXT,
        scanned_at TEXT NOT NULL,
        scanner_user TEXT NOT NULL
      );
    `;

    await this.database.executeSql(createUsersTable);
    await this.database.executeSql(createScannerUsersTable);
    await this.database.executeSql(createScanLogsTable);
  }

  private async seedSampleData(): Promise<void> {
    const existingUsers = await this.getAllUsers();
    if (existingUsers.length > 0) {
      return; // Data already seeded
    }

    // Sample users (identical to QR Generator for compatibility)
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

    // Scanner users
    const scannerUsers: Omit<ScannerUser, 'id'>[] = [
      { email: 'scanner1@event.com', name: 'Scanner Volunteer 1', role: 'volunteer', is_active: true },
      { email: 'scanner2@event.com', name: 'Scanner Volunteer 2', role: 'volunteer', is_active: true },
      { email: 'security@event.com', name: 'Security Scanner', role: 'security', is_active: true },
      { email: 'admin@event.com', name: 'Admin Scanner', role: 'admin', is_active: true }
    ];

    for (const user of sampleUsers) {
      await this.insertUser(user);
    }

    for (const scannerUser of scannerUsers) {
      await this.insertScannerUser(scannerUser);
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

  private async insertScannerUser(scannerUser: Omit<ScannerUser, 'id'>): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const insertQuery = `
      INSERT OR IGNORE INTO scanner_users (email, name, role, is_active) 
      VALUES (?, ?, ?, ?)
    `;

    await this.database.executeSql(insertQuery, [
      scannerUser.email,
      scannerUser.name,
      scannerUser.role,
      scannerUser.is_active ? 1 : 0
    ]);
  }

  async getScannerUserByEmail(email: string): Promise<ScannerUser | null> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const query = 'SELECT * FROM scanner_users WHERE email = ? AND is_active = 1';
    const results = await this.database.executeSql(query, [email]);

    if (results[0].rows.length > 0) {
      const row = results[0].rows.item(0);
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        is_active: row.is_active === 1
      };
    }

    return null;
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

  async logScan(scanLog: Omit<ScanLog, 'id'>): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const insertQuery = `
      INSERT INTO scan_logs (user_id, user_name, area, access_granted, failure_reason, scanned_at, scanner_user) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await this.database.executeSql(insertQuery, [
      scanLog.user_id,
      scanLog.user_name,
      scanLog.area,
      scanLog.access_granted ? 1 : 0,
      scanLog.failure_reason || null,
      scanLog.scanned_at,
      scanLog.scanner_user
    ]);
  }

  async getScanLogs(limit: number = 50): Promise<ScanLog[]> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    const query = 'SELECT * FROM scan_logs ORDER BY scanned_at DESC LIMIT ?';
    const results = await this.database.executeSql(query, [limit]);

    const logs: ScanLog[] = [];
    for (let i = 0; i < results[0].rows.length; i++) {
      const row = results[0].rows.item(i);
      logs.push({
        id: row.id,
        user_id: row.user_id,
        user_name: row.user_name,
        area: row.area,
        access_granted: row.access_granted === 1,
        failure_reason: row.failure_reason,
        scanned_at: row.scanned_at,
        scanner_user: row.scanner_user
      });
    }

    return logs;
  }

  // QR code verification with cryptographic validation
  async verifyQRCode(qrData: string, area: string): Promise<{ success: boolean; user?: User; reason?: string }> {
    try {
      // First, try to verify if it's a secure QR code (new format from SportGate Pass)
      const secureVerification = await this.verifySecureQRCode(qrData);
      
      if (secureVerification.valid && secureVerification.payload) {
        const parsedData = secureVerification.payload;
        
        // Get user from database to verify access
        const user = await this.getUserByEmail(parsedData.email);
        if (!user) {
          return { success: false, reason: 'User not found in system' };
        }

        // Check if user has access to the requested area
        if (!user.allowed_areas.includes(area)) {
          return { success: false, reason: `No access to ${area}` };
        }

        // Validate device fingerprint (basic check)
        if (!parsedData.device_fingerprint) {
          return { success: false, reason: 'Invalid device binding' };
        }

        return { success: true, user };
      }

      // Fallback to old format for backward compatibility
      const parsedData = JSON.parse(qrData);
      
      // Basic validation
      if (!parsedData.user_id || !parsedData.name || !parsedData.access_level) {
        return { success: false, reason: 'Invalid QR code format' };
      }

      // Check expiration
      if (parsedData.expires_at && Date.now() > parsedData.expires_at) {
        return { success: false, reason: 'QR code has expired' };
      }

      // Get user from database to verify access
      const user = await this.getUserByEmail(parsedData.email);
      if (!user) {
        return { success: false, reason: 'User not found in system' };
      }

      // Check if user has access to the requested area
      if (!user.allowed_areas.includes(area)) {
        return { success: false, reason: `No access to ${area}` };
      }

      return { success: true, user };
    } catch (error) {
      return { success: false, reason: 'Invalid QR code data' };
    }
  }

  // Verify secure QR code with proper cryptographic validation
  async verifySecureQRCode(qrData: string): Promise<{ valid: boolean; payload?: any; reason?: string }> {
    try {
      const parsed = JSON.parse(qrData);
      
      if (!parsed.data || !parsed.signature || !parsed.timestamp) {
        return { valid: false, reason: 'Invalid secure QR format' };
      }

      // Check if QR is too old (older than 24 hours)
      if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
        return { valid: false, reason: 'QR code expired' };
      }

      // Verify signature using same secret as QR Generator
      const secret = 'event_secret_key_2024';
      const expectedSignature = CryptoJS.HmacSHA256(parsed.data, secret).toString();

      if (parsed.signature !== expectedSignature) {
        return { valid: false, reason: 'QR code tampered or invalid' };
      }

      const payload = JSON.parse(parsed.data);
      
      // Check payload expiry
      if (payload.expires_at && Date.now() > payload.expires_at) {
        return { valid: false, reason: 'QR code expired' };
      }

      return { valid: true, payload };
    } catch (error) {
      return { valid: false, reason: 'Invalid QR data format' };
    }
  }

  // Get available scanning areas
  getAvailableAreas(): string[] {
    return [
      'Main Arena',
      'VIP Lounge', 
      'Staff Area',
      'Security Zone',
      'General Entrance',
      'Food Court'
    ];
  }
}

export const DatabaseService = new DatabaseServiceClass();
