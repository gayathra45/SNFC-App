import { io, Socket } from "socket.io-client";
import { getServerUrl } from "../config/api";
import { getStoredStaff, getStoredPairing, StaffUser } from "./storageService";

export interface TransferJobPayload {
  jobId: string;
  orderId: string;
  orderNumber: string;
  cardId: string;
  cardUrl: string;
  policyHolderName: string;
  vehiclePlate?: string;
  branch: string;
  staffId: string;
  staffName: string;
  status: string;
  expiresAt: string;
}

type TransferJobCallback = (job: TransferJobPayload) => void;
type PairingCallback = (pairing: any) => void;
type ConnectionCallback = (connected: boolean) => void;

class SocketService {
  private socket: Socket | null = null;
  private jobListeners: TransferJobCallback[] = [];
  private pairingListeners: PairingCallback[] = [];
  private connectionListeners: ConnectionCallback[] = [];
  private isConnecting = false;

  async connect(): Promise<Socket | null> {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    if (this.isConnecting) return null;
    this.isConnecting = true;

    try {
      const staff: StaffUser | null = await getStoredStaff();
      const pairing = await getStoredPairing();
      const baseUrl = await getServerUrl();

      const socketUrl = baseUrl.replace(/\/api\/?$/, "");

      this.socket = io(socketUrl, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        timeout: 10000,
        auth: {
          userId: staff?._id || pairing?.staffId || "nfc-writer",
          userType: "OfficeStaff",
          name: staff?.name || pairing?.staffName || "NFC Writer App",
          branch: staff?.branch || pairing?.branch || "Galle"
        }
      });

      this.socket.on("connect", () => {
        console.log(`[SocketService] Connected to ${socketUrl}`);
        this.notifyConnection(true);

        const targetBranch = staff?.branch || pairing?.branch;
        if (targetBranch) {
          this.socket?.emit("join:branch", { branch: targetBranch });
        }
      });

      this.socket.on("disconnect", (reason) => {
        console.log(`[SocketService] Disconnected: ${reason}`);
        this.notifyConnection(false);
      });

      this.socket.on("connect_error", (err) => {
        console.warn(`[SocketService] Connect error:`, err.message);
        this.notifyConnection(false);
      });

      // Transfer Job from website
      this.socket.on("nfc:transfer-job:new", (data: TransferJobPayload) => {
        console.log(`[SocketService] Received transfer job for card:`, data.cardId);
        this.jobListeners.forEach((fn) => fn(data));
      });

      // Pairing update
      this.socket.on("nfc:pairing-updated", (data: any) => {
        console.log(`[SocketService] Pairing updated:`, data.status);
        this.pairingListeners.forEach((fn) => fn(data));
      });

      return this.socket;
    } catch (err: any) {
      console.warn("[SocketService] Connect error:", err.message);
      this.notifyConnection(false);
      return null;
    } finally {
      this.isConnecting = false;
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.notifyConnection(false);
  }

  isConnected(): boolean {
    return Boolean(this.socket && this.socket.connected);
  }

  // Subscribe to new transfer jobs
  onTransferJob(fn: TransferJobCallback): () => void {
    this.jobListeners.push(fn);
    return () => {
      this.jobListeners = this.jobListeners.filter((l) => l !== fn);
    };
  }

  // Subscribe to pairing events
  onPairingUpdate(fn: PairingCallback): () => void {
    this.pairingListeners.push(fn);
    return () => {
      this.pairingListeners = this.pairingListeners.filter((l) => l !== fn);
    };
  }

  // Subscribe to connection state changes
  onConnectionChange(fn: ConnectionCallback): () => void {
    this.connectionListeners.push(fn);
    fn(this.isConnected());
    return () => {
      this.connectionListeners = this.connectionListeners.filter((l) => l !== fn);
    };
  }

  private notifyConnection(connected: boolean): void {
    this.connectionListeners.forEach((fn) => fn(connected));
  }

  // Report status back through socket/api
  async reportJobStatus(jobId: string, status: string, errorMessage?: string): Promise<void> {
    try {
      const baseUrl = await getServerUrl();
      await fetch(`${baseUrl}/api/nfc-card/writer/job-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, status, errorMessage })
      });
    } catch (err: any) {
      console.warn("[SocketService] Report job status error:", err.message);
    }
  }
}

export const socketService = new SocketService();
export default socketService;
