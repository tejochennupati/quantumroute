/**
 * QUANTUMROUTE: OFFLINE-FIRST INDEXEDDB ENGINE & SYNC QUEUE
 * Seamless local persistence for disaster zones with intermittent connectivity.
 */

class QuantumOfflineStore {
    constructor() {
        this.dbName = 'QuantumRouteDB';
        this.version = 1;
        this.db = null;
        this.isOnline = navigator.onLine;
        this.simulatedOffline = false;
        this.syncInProgress = false;

        this.initListeners();
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;

                // Fleet store: indexed by driver ID
                if (!db.objectStoreNames.contains('fleet')) {
                    db.createObjectStore('fleet', { keyPath: 'id' });
                }

                // Offline sync queue: chronological queue of actions taken during outages
                if (!db.objectStoreNames.contains('offline_queue')) {
                    db.createObjectStore('offline_queue', { keyPath: 'queueId', autoIncrement: true });
                }

                // Shift reports store
                if (!db.objectStoreNames.contains('reports')) {
                    db.createObjectStore('reports', { keyPath: 'reportId' });
                }

                // Meta store (tokens, session info)
                if (!db.objectStoreNames.contains('meta')) {
                    db.createObjectStore('meta', { keyPath: 'key' });
                }
            };

            request.onsuccess = (e) => {
                this.db = e.target.result;
                console.log('📦 [IndexedDB] QuantumRouteDB initialized successfully.');
                resolve(this.db);
            };

            request.onerror = (e) => {
                console.error('❌ [IndexedDB] Failed to open database:', e.target.error);
                reject(e.target.error);
            };
        });
    }

    initListeners() {
        window.addEventListener('online', () => {
            console.log('🌐 [Network] Connectivity restored.');
            this.isOnline = true;
            this.notifyNetworkChange();
            this.autoSyncQueue();
        });

        window.addEventListener('offline', () => {
            console.warn('⚠️ [Network] Connectivity lost! Switching to IndexedDB Local-First mode.');
            this.isOnline = false;
            this.notifyNetworkChange();
        });
    }

    notifyNetworkChange() {
        const badge = document.getElementById('network-status-badge');
        const text = document.getElementById('network-status-text');
        const effectiveOnline = this.isOnline && !this.simulatedOffline;

        if (badge && text) {
            if (effectiveOnline) {
                badge.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-1.5';
                text.innerText = 'ONLINE (CLOUD SYNCED)';
                text.className = 'text-emerald-400 font-bold';
            } else {
                badge.className = 'w-2 h-2 rounded-full bg-amber-400 mr-1.5';
                text.innerText = this.simulatedOffline ? 'OFFLINE (SIMULATION MODE)' : 'OFFLINE (INDEXEDDB CACHE)';
                text.className = 'text-amber-400 font-bold';
            }
        }
    }

    toggleSimulateOffline() {
        this.simulatedOffline = !this.simulatedOffline;
        this.notifyNetworkChange();
        if (!this.simulatedOffline && this.isOnline) {
            this.autoSyncQueue();
        }
        return this.simulatedOffline;
    }

    async saveFleet(fleetList) {
        if (!this.db) await this.initDB();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('fleet', 'readwrite');
            const store = tx.objectStore('fleet');
            fleetList.forEach(driver => store.put(driver));
            tx.oncomplete = () => resolve(true);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async getFleet() {
        if (!this.db) await this.initDB();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('fleet', 'readonly');
            const store = tx.objectStore('fleet');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async updateDriver(driver) {
        if (!this.db) await this.initDB();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('fleet', 'readwrite');
            const store = tx.objectStore('fleet');
            const req = store.put(driver);
            req.onsuccess = () => resolve(true);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async queueOfflineAction(action) {
        if (!this.db) await this.initDB();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('offline_queue', 'readwrite');
            const store = tx.objectStore('offline_queue');
            const entry = {
                ...action,
                timestamp: new Date().toISOString()
            };
            const req = store.add(entry);
            req.onsuccess = () => {
                console.log('📥 [IndexedDB Queue] Queued offline action:', action.type);
                this.updateQueueCountUI();
                resolve(true);
            };
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async getQueue() {
        if (!this.db) await this.initDB();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('offline_queue', 'readonly');
            const store = tx.objectStore('offline_queue');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async clearQueue() {
        if (!this.db) await this.initDB();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('offline_queue', 'readwrite');
            const store = tx.objectStore('offline_queue');
            const req = store.clear();
            req.onsuccess = () => {
                this.updateQueueCountUI();
                resolve(true);
            };
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async updateQueueCountUI() {
        const queue = await this.getQueue();
        const badge = document.getElementById('offline-queue-badge');
        if (badge) {
            if (queue.length > 0) {
                badge.innerText = `${queue.length} PENDING SYNC`;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    }

    async autoSyncQueue() {
        if (this.syncInProgress || this.simulatedOffline || !this.isOnline) return;
        const queue = await this.getQueue();
        if (queue.length === 0) return;

        this.syncInProgress = true;
        console.log(`🔄 [Offline Sync] Reconciling ${queue.length} offline events with backend...`);

        try {
            const res = await fetch(`${CONFIG.API_URL}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ offlineEvents: queue })
            });

            if (res.ok) {
                const data = await res.json();
                console.log(`✅ [Offline Sync] Successfully synced ${data.processedEvents} events.`);
                await this.clearQueue();
                if (data.latestFleet) {
                    await this.saveFleet(data.latestFleet);
                }
            }
        } catch (err) {
            console.warn('⚠️ [Offline Sync] Backend unreachable, retaining IndexedDB queue.', err.message);
        } finally {
            this.syncInProgress = false;
        }
    }
}

// Global instance
const offlineStore = new QuantumOfflineStore();

