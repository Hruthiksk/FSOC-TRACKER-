import { SessionMeta, FrameRecord, TrackerEvent, MetricsSummary } from "../types";

const DB_NAME = "fsoc-tracker";
const DB_VERSION = 1;

export class AppIndexedDb {
  private db: IDBDatabase | null = null;

  async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB not available in this environment"));
        return;
      }

      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (evt) => {
        const db = (evt.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains("sessions")) {
          const sStore = db.createObjectStore("sessions", { keyPath: "sessionId" });
          sStore.createIndex("createdIso", "createdIso", { unique: false });
          sStore.createIndex("source", "source", { unique: false });
        }

        if (!db.objectStoreNames.contains("frames")) {
          const fStore = db.createObjectStore("frames", { keyPath: ["sessionId", "frameIndex"] });
          fStore.createIndex("sessionId", "sessionId", { unique: false });
        }

        if (!db.objectStoreNames.contains("events")) {
          const eStore = db.createObjectStore("events", { keyPath: "id" });
          eStore.createIndex("sessionId", "sessionId", { unique: false });
        }

        if (!db.objectStoreNames.contains("reports")) {
          db.createObjectStore("reports", { keyPath: "sessionId" });
        }
      };

      req.onsuccess = () => {
        this.db = req.result;
        resolve(this.db);
      };

      req.onerror = () => {
        reject(req.error);
      };
    });
  }

  async saveSession(
    meta: SessionMeta,
    frames: FrameRecord[],
    events: TrackerEvent[],
    reportHtml?: string
  ): Promise<void> {
    try {
      const db = await this.open();
      const tx = db.transaction(["sessions", "frames", "events", "reports"], "readwrite");

      // Save Session
      tx.objectStore("sessions").put(meta);

      // Save Frames in batch
      const framesStore = tx.objectStore("frames");
      for (const f of frames) {
        framesStore.put({
          sessionId: meta.sessionId,
          ...f,
        });
      }

      // Save Events
      const eventsStore = tx.objectStore("events");
      for (const e of events) {
        eventsStore.put(e);
      }

      // Save Report if present
      if (reportHtml && meta.summary) {
        tx.objectStore("reports").put({
          sessionId: meta.sessionId,
          html: reportHtml,
          generatedIso: new Date().toISOString(),
          summary: meta.summary,
        });
      }

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(new Error("Transaction aborted"));
      });
    } catch (err) {
      console.warn("IndexedDB save failed (continuing safely):", err);
    }
  }

  async listSessions(): Promise<SessionMeta[]> {
    try {
      const db = await this.open();
      const tx = db.transaction("sessions", "readonly");
      const store = tx.objectStore("sessions");
      const req = store.getAll();

      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("Failed to list sessions:", err);
      return [];
    }
  }

  async getSession(sessionId: string): Promise<{
    meta: SessionMeta | null;
    frames: FrameRecord[];
    events: TrackerEvent[];
    report: { html: string; generatedIso: string; summary: MetricsSummary } | null;
  }> {
    try {
      const db = await this.open();
      const tx = db.transaction(["sessions", "frames", "events", "reports"], "readonly");

      const sReq = tx.objectStore("sessions").get(sessionId);
      const fReq = tx.objectStore("frames").index("sessionId").getAll(sessionId);
      const eReq = tx.objectStore("events").index("sessionId").getAll(sessionId);
      const rReq = tx.objectStore("reports").get(sessionId);

      return new Promise((resolve) => {
        tx.oncomplete = () => {
          resolve({
            meta: sReq.result || null,
            frames: (fReq.result || []).sort((a: FrameRecord, b: FrameRecord) => a.frameIndex - b.frameIndex),
            events: (eReq.result || []).sort((a: TrackerEvent, b: TrackerEvent) => a.tS - b.tS),
            report: rReq.result || null,
          });
        };
        tx.onerror = () => {
          resolve({ meta: null, frames: [], events: [], report: null });
        };
      });
    } catch (err) {
      console.warn("Failed to get session:", err);
      return { meta: null, frames: [], events: [], report: null };
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const db = await this.open();
      const tx = db.transaction(["sessions", "frames", "events", "reports"], "readwrite");

      tx.objectStore("sessions").delete(sessionId);
      tx.objectStore("reports").delete(sessionId);

      const fStore = tx.objectStore("frames");
      const fIndex = fStore.index("sessionId");
      const fReq = fIndex.getAllKeys(sessionId);
      fReq.onsuccess = () => {
        for (const key of fReq.result) {
          fStore.delete(key);
        }
      };

      const eStore = tx.objectStore("events");
      const eIndex = eStore.index("sessionId");
      const eReq = eIndex.getAllKeys(sessionId);
      eReq.onsuccess = () => {
        for (const key of eReq.result) {
          eStore.delete(key);
        }
      };

      return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch (err) {
      console.warn("Failed to delete session:", err);
    }
  }

  async clearAllData(): Promise<void> {
    try {
      const db = await this.open();
      const tx = db.transaction(["sessions", "frames", "events", "reports"], "readwrite");
      tx.objectStore("sessions").clear();
      tx.objectStore("frames").clear();
      tx.objectStore("events").clear();
      tx.objectStore("reports").clear();
      return new Promise((resolve) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch (err) {
      console.warn("Failed to clear IndexedDB:", err);
    }
  }
}

export const appDb = new AppIndexedDb();
