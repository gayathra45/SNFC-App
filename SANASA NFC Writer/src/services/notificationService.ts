import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getServerUrl } from "../config/api";

const NOTIFICATIONS_STORAGE_KEY = "@s_nfc_local_notifications";

export interface AppNotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  relatedCardId?: string;
  data?: any;
}

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH
  })
});

class NotificationService {
  private pushToken: string | null = null;
  private listeners: Array<() => void> = [];

  constructor() {
    this.setupAndroidChannels().catch(() => {});
  }

  async setupAndroidChannels() {
    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "S NFC Writer Notifications",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#102A43",
          enableLights: true,
          enableVibrate: true,
          showBadge: true
        });
      }
    } catch (err: any) {
      // In Expo Go on some Android versions, native channel manager can reject safely
      console.warn("[NotificationService] Setup channel notice:", err?.message || err);
    }
  }

  async requestPermissionsAndRegister(staffId?: string, branch?: string): Promise<string | null> {
    try {
      if (!Device.isDevice && Platform.OS !== "android") {
        // Fallback for emulators
        return null;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: undefined // Expo SDK automatically infers from app config
      }).catch(() => null);

      if (tokenData && tokenData.data) {
        this.pushToken = tokenData.data;

        // Register push token with backend if staff/branch is available
        if (staffId || branch) {
          try {
            const baseUrl = await getServerUrl();
            await fetch(`${baseUrl}/api/nfc-card/writer/register-push-token`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                pushToken: this.pushToken,
                staffId,
                branch,
                platform: Platform.OS,
                deviceName: Device.modelName || "Android Device"
              })
            });
          } catch {}
        }
        return this.pushToken;
      }
    } catch (err) {
      console.warn("Notification registration warning:", err);
    }
    return null;
  }

  getPushToken(): string | null {
    return this.pushToken;
  }

  // Local notifications storage & in-app Notification Centre
  async getNotifications(): Promise<AppNotificationItem[]> {
    try {
      const data = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async addNotification(title: string, body: string, relatedCardId?: string, data?: any): Promise<void> {
    try {
      const existing = await this.getNotifications();
      const newItem: AppNotificationItem = {
        id: `NOTIF-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title,
        body,
        timestamp: new Date().toISOString(),
        read: false,
        relatedCardId,
        data
      };

      const updated = [newItem, ...existing].slice(0, 50); // keep last 50
      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));

      // Trigger local OS notification if permission allows
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data: { relatedCardId, ...data },
            sound: true,
            badge: 1
          },
          trigger: null // trigger immediately
        });
      } catch {}

      this.notifyListeners();
    } catch {}
  }

  async markAsRead(id: string): Promise<void> {
    try {
      const existing = await this.getNotifications();
      const updated = existing.map((item) => (item.id === id ? { ...item, read: true } : item));
      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
      this.notifyListeners();
    } catch {}
  }

  async markAllAsRead(): Promise<void> {
    try {
      const existing = await this.getNotifications();
      const updated = existing.map((item) => ({ ...item, read: true }));
      await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
      this.notifyListeners();
    } catch {}
  }

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
      this.notifyListeners();
    } catch {}
  }

  async getUnreadCount(): Promise<number> {
    const list = await this.getNotifications();
    return list.filter((item) => !item.read).length;
  }

  onChange(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((cb) => cb());
  }
}

export const notificationService = new NotificationService();
