# 🚀 QuantumRoute: Disaster Relief & Emergency Logistics Management System

Production-ready, offline-first command & fleet intelligence platform built for mission-critical disaster relief operations (Krishna Delta / Vijayawada Flood Relief Zone).

---

## 🏛️ System Architecture Overview

```
                      [ Government Authority ]
                                 │
                   [ Administrative Command HUD ]
                 Officer: Tejo Vardhan Chennupati
                        (GOV-TEJO-2026)
                                 │
        ┌────────────────────────┴────────────────────────┐
        ▼                                                 ▼
[ 10-Node Grid Fleet Console ]                 [ Field Driver Consoles ]
10 Active Leaflet Units                       Mobile App & IoT Telemetry
QUBO Routing / Siren Alert                    Stock Keypad / Restock Loop
        │                                                 │
        └─────────────────┬───────────────────────────────┘
                          ▼
             [ Dual Synchronization Layer ]
       ├── REST API & WebSocket Real-time Stream
       └── IndexedDB Offline-First Local Store & Queue
```

---

## 🔑 Dual Role-Based Login Credentials

### 1. Authorized Officer Portal
* **Government Unique ID**: `GOV-TEJO-2026`
* **Secure Access Token**: `QUANTUM-ALPHA-2026` (or `********`)
* **Officer Name**: **Tejo Vardhan Chennupati**
* **Privileges**: Full Command Center HUD, 10-node multi-driver live map grid, dynamic daily job role adaptation, audio siren & voice directive broadcast, emergency accident clearance, shift audit reporting, live Quantum Engine panel.

### 2. Field Driver Portal
* **Driver Username**: `DRIVER-RAJESH-01` (Units `DRIVER-RAJESH-01` through `DRIVER-PRASAD-10`)
* **Passcode**: `123456` (or `********`)
* **Privileges**: Dedicated field mobile interface, active Leaflet navigation with glowing polyline, driver personal profile with private salary view, interactive stock delivery keypad, route obstruction trigger, IoT crash simulation.

---

## 🛠️ Key Capabilities & Production Features

1. **Dual Login Portals**: Role-based access control with top-down authority hierarchy (`Government Authority` → `Administrative Officer` → `Field Drivers`).
2. **Slide-Out Command Sidebar**: Officer profile, unit deployment, live workforce filter, and shift reporting.
3. **Dynamic Job Role Adaptation**:
   - Reassign roles on the fly: *Food Supply*, *Medical Supplies*, *Water Supply*, *Shelter Kits*, *Clothing Shelter*, *Power Units*, *Human Rescue*, *Evacuation*.
   - Resource roles display live numeric stock counters; rescue roles automatically adapt to **"Capacity Full (Rescue Mode)"**.
4. **Driver Profile & Privacy Permission System**:
   - Drivers can inspect their own monthly compensation (`₹35,000 / mo`) in their private console.
   - When viewing fleet or peer cards, sensitive personal data like salary is masked by a **Privacy Shield** (`[PRIVACY SHIELD RESTRICTED]`).
5. **IoT Impact Sensors & Crash Detection**:
   - Simulates vehicle rollover impact (e.g. 8.4G impact, 72° tilt).
   - Instantly fires Web Audio synthesized siren warble, flashes pulsing red `emergency-blink` on grid card, and generates an emergency warning banner with exact GPS coordinates.
6. **5x4 Live Multi-Driver Map Grid**:
   - High-density tactical layout fits all 20 mini-maps on a single desktop viewport without scrolling.
   - Active Leaflet polylines connect live GPS markers to waypoint targets.
   - Dynamic weather hazard styling:
     - 🔴 Cyclone Heavy Rain / Flood Lv 3 (`#ef4444`)
     - 🟠 Severe Waterlogging / Risk Lv 2 (`#f59e0b`)
     - 🟣 Gale Wind Storm (`#a855f7`)
     - 🔵 Clear Transit Vector (`#00f0ff`)
   - Hover-to-zoom (`transform: scale(1.04)`) and click-to-expand.
7. **Quantum Live Routing (QUBO / QAOA Engine)**:
   - Formulates route cost Hamiltonian:
     $$H(x) = \sum C_{ij} x_i x_j + \lambda \sum P_i x_i$$
   - Optimizes low-latency detours and computes carbon emissions:
     $$\text{Fuel Burn Liters} \times 2.68\text{ kg CO}_2$$
   - Real-time road obstruction bypass via quantum tunneling detour.
8. **Field Driver Mobile App & Interactive Stock Calculator**:
   - Floating action button opens numeric delivery keypad (0-9, Clear, Confirm).
   - Verified Restock Loop: When inventory reaches 0, prompts depot hub authorization workflow (+250 units).
9. **Offline-First Resilience (IndexedDB)**:
   - Zero-crash fallback when offline in remote disaster zones.
   - Stores actions in `offline_queue` and reconciles via `/api/sync` upon reconnection.
   - Includes UI **"Toggle Offline Simulation"** button for instant validation.
10. **Bonus Features**:
    - **Audio Emergency Broadcasts**: Web Audio API dual-tone siren synthesizer + Web Speech API vocal orders.
    - **Daily Shift Summary Audit Generator**: Modal with KPI analytics, unit breakdown table, CSV download, and print view.

---

## 🚀 Running the Project

### Option A: Node.js Full-Stack Server (Recommended)
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Option B: Zero-Dependency Standalone Mode
Double-click `index.html` in your file explorer or open directly via `file://`. The offline-first IndexedDB engine and client-side Quantum simulator run seamlessly with zero crashes!

---

## 🧪 Integration Testing
Run the automated test suite verifying all 10 endpoints and backend subsystems:
```bash
node test-system.js
```

