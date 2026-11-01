import { getServerUrl } from "../config/api";
import { StaffUser, storeStaff, clearStoredStaff, clearStoredPairing } from "./storageService";

export interface LoginResult {
  success: boolean;
  user?: StaffUser;
  error?: string;
}

export async function loginStaff(loginId: string, password: string): Promise<LoginResult> {
  try {
    const baseUrl = await getServerUrl();
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "SANASA-NFC-Writer-Android/1.0"
      },
      body: JSON.stringify({
        loginId: loginId.trim(),
        password: password.trim(),
        device: "NFC Writer Mobile App"
      })
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.error || "Authentication failed." };
    }

    // Role check: Only OfficeStaff and Admin can use the NFC Writer
    if (data.role !== "office_staff" && data.role !== "admin") {
      return {
        success: false,
        error: "Access Denied: Only authorized SANASA Branch Office staff and administrators can access the NFC Writer tool."
      };
    }

    const rawUser = data.staff || data.admin || {};
    const staffUser: StaffUser = {
      _id: rawUser._id || "",
      name: rawUser.name || "Branch Staff",
      email: rawUser.email || "",
      mobile: rawUser.mobile || "",
      branch: rawUser.branch || (data.role === "admin" ? "Head Office" : "Galle"),
      role: data.role,
      sessionStartedAt: data.sessionStartedAt || new Date().toISOString()
    };

    await storeStaff(staffUser);
    return { success: true, user: staffUser };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Network error: Unable to connect to SANASA Insurance server."
    };
  }
}

export async function logoutStaff(): Promise<void> {
  await clearStoredStaff();
  await clearStoredPairing();
}
