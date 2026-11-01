import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import Constants from "expo-constants";

export const DEFAULT_DEV_IP = "192.168.42.36"; // LAN IP of current machine
export const PORT = "5000";

// Key for stored custom backend URL
const SERVER_URL_STORAGE_KEY = "sanasa_nfc_writer_server_url";

let cachedServerUrl: string | null = null;

export const getDefaultServerUrl = (): string => {
  // If hostUri is available from Expo Metro
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(":")[0];
    return `http://${ip}:${PORT}`;
  }

  // Android emulator loopback to host
  if (Platform.OS === "android" && !Constants.isDevice) {
    return `http://10.0.2.2:${PORT}`;
  }

  // Physical Android device fallback
  return `http://${DEFAULT_DEV_IP}:${PORT}`;
};

export const getServerUrl = async (): Promise<string> => {
  if (cachedServerUrl) return cachedServerUrl;
  try {
    const saved = await AsyncStorage.getItem(SERVER_URL_STORAGE_KEY);
    if (saved && saved.trim()) {
      cachedServerUrl = saved.trim().replace(/\/+$/, "");
      return cachedServerUrl;
    }
  } catch {
    // fallback
  }

  cachedServerUrl = getDefaultServerUrl();
  return cachedServerUrl;
};

export const setCustomServerUrl = async (url: string): Promise<void> => {
  const clean = url.trim().replace(/\/+$/, "");
  cachedServerUrl = clean;
  await AsyncStorage.setItem(SERVER_URL_STORAGE_KEY, clean);
};

export const resetServerUrl = async (): Promise<string> => {
  await AsyncStorage.removeItem(SERVER_URL_STORAGE_KEY);
  cachedServerUrl = getDefaultServerUrl();
  return cachedServerUrl;
};
