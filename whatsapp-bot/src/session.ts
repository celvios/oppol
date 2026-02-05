import { Session, UserState } from './types';

class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  get(phoneNumber: string): Session | null {
    const session = this.sessions.get(phoneNumber);
    if (!session) return null;

    // Check if session expired
    if (Date.now() - session.lastActivity > this.SESSION_TIMEOUT) {
      this.sessions.delete(phoneNumber);
      return null;
    }

    return session;
  }

  update(phoneNumber: string, updates: Partial<Session>): void {
    const existing = this.get(phoneNumber) || {
      phoneNumber,
      state: UserState.IDLE,
      data: {},
      lastActivity: Date.now()
    };

    this.sessions.set(phoneNumber, {
      ...existing,
      ...updates,
      lastActivity: Date.now()
    });
  }

  clear(phoneNumber: string): void {
    this.sessions.delete(phoneNumber);
  }

  // Cleanup expired sessions every 5 minutes
  startCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [phone, session] of this.sessions.entries()) {
        if (now - session.lastActivity > this.SESSION_TIMEOUT) {
          this.sessions.delete(phone);
        }
      }
    }, 5 * 60 * 1000);
  }
}

export const sessionManager = new SessionManager();
