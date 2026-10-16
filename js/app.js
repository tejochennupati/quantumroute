/**
 * QUANTUMROUTE: MAIN APPLICATION ORCHESTRATOR
 * Optimized 10-Node Fleet Grid, Live QPU Telemetry, Interactive QUBO Terminal,
 * Glowing Driver Navigation Cues, and Offline-First State Synchronization.
 */

// Application State
const state = {
    user: null, // { role: 'OFFICER' | 'DRIVER', id: string, name: string }
    fleet: [],
    selectedDriverId: 1,
    miniMaps: {},
    fullMap: null,
    fullMapMarker: null,
    fullMapPoly: null,
    driverMap: null,
    driverMarker: null,
    driverPolyline: null,
    driverSequenceMarkers: [],
    driverAnimationId: null,
    tacticalMasterMap: null,
    tacticalMarkers: {},
    tacticalPolylines: {},
    tacticalSequenceMarkers: {},
    clickedCoord: null,
    ws: null,
    wsConnected: false,
    simulatedOffline: false
};

// ==========================================
// 1. INITIALIZATION & DATA HYDRATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 [QuantumRoute] Initializing National Quantum Mission Command HUD...');
    
    // Initialize IndexedDB
    try {
        await offlineStore.initDB();
        let cachedFleet = await offlineStore.getFleet();
        if (cachedFleet && cachedFleet.length >= 10 && cachedFleet[0].polyline && cachedFleet[0].polyline.length > 50) {
            state.fleet = cachedFleet;
            console.log(`📦 Loaded fleet from IndexedDB cache (${cachedFleet.length} units)`);
        } else {
            state.fleet = generateDriverFleet();
            await offlineStore.saveFleet(state.fleet);
            console.log(`⚡ Generated road-clamped ${state.fleet.length}-driver fleet with precision street waypoints`);
        }
    } catch (e) {
        console.warn('IndexedDB initialization fallback:', e);
        state.fleet = generateDriverFleet();
    }

    // Try fetching freshest fleet from backend API
    fetchFleetFromBackend();

    // Connect WebSocket
    connectWebSocket();

    // Start Real-Time Indian Standard Time (IST) Clock
    initClock();

    // Bind all interactive event listeners
    bindAllEventHandlers();

    // Update offline queue UI
    offlineStore.updateQueueCountUI();
});

// Real-Time IST Clock
function initClock() {
    setInterval(() => {
        const d = new Date();
        const options = { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' };
        const istTime = d.toLocaleTimeString('en-US', options) + ' IST';
        const clockEls = document.querySelectorAll('#live-ist-clock');
        clockEls.forEach(el => el.innerText = istTime);
    }, 1000);
}

// ==========================================
// 1.1 BULLETPROOF EVENT LISTENER BINDINGS
// ==========================================
function bindAllEventHandlers() {
    function bind(id, event, handler) {
        const el = document.getElementById(id);
        if (el && !el.dataset.listenerBound) {
            el.addEventListener(event, (e) => {
                handler(e);
            });
            el.dataset.listenerBound = 'true';
        }
    }

    // Portal & Auth Buttons
    bind('init-command-hud-btn', 'click', () => loginAsOfficer());
    bind('access-field-console-btn', 'click', () => loginAsDriver());
    bind('auth-tab-officer', 'click', () => switchAuthTab('officer'));
    bind('auth-tab-driver', 'click', () => switchAuthTab('driver'));
    bind('landing-run-qubo-btn', 'click', () => runLandingQuboSolver());

    // Enter key shortcuts on credentials
    const offPass = document.getElementById('off-pass');
    if (offPass && !offPass.dataset.listenerBound) {
        offPass.addEventListener('keydown', (e) => { if (e.key === 'Enter') loginAsOfficer(); });
        offPass.dataset.listenerBound = 'true';
    }
    const drvPass = document.getElementById('drv-pass');
    if (drvPass && !drvPass.dataset.listenerBound) {
        drvPass.addEventListener('keydown', (e) => { if (e.key === 'Enter') loginAsDriver(); });
        drvPass.dataset.listenerBound = 'true';
    }

    // Officer Command Bar & Header Controls
    bind('officer-map-mode-btn', 'click', () => toggleOfficerTacticalMap());
    bind('qubo-optimize-btn', 'click', () => runQuantumOptimization());
    bind('shift-audit-btn', 'click', () => generateDailyShiftSummary());
    bind('broadcast-directive-btn', 'click', () => triggerOfficerAudioBroadcast());
    bind('text-dispatch-btn', 'click', () => submitTextLocationDispatch());
    bind('onboard-driver-btn', 'click', () => openDriverRegistrationModal());
    bind('sidebar-onboard-btn', 'click', () => openDriverRegistrationModal());
    bind('quick-deploy-btn', 'click', () => deployNewFieldUnit());
    bind('sos-resolve-btn', 'click', () => resolveCrashSOS());
    bind('simulate-offline-btn', 'click', () => toggleSimulateOffline());
    bind('back-grid-btn', 'click', () => backToGrid());
    bind('back-to-grid-btn', 'click', () => backToGrid());
    bind('reassign-mission-role-btn', 'click', () => openRoleAssignmentModal(state.selectedDriverId));

    // Text dispatch input Enter key
    const textInput = document.getElementById('text-dispatch-location');
    if (textInput && !textInput.dataset.listenerBound) {
        textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitTextLocationDispatch();
        });
        textInput.dataset.listenerBound = 'true';
    }

    // Driver Field Interface Controls
    bind('driver-route-block-btn', 'click', () => triggerRouteBlock());
    bind('driver-sos-btn', 'click', () => triggerDriverSOS());
    bind('driver-stock-keypad-btn', 'click', () => openModal('calc-modal'));
    bind('driver-toggle-legs-btn', 'click', () => toggleDriverLegsDrawer());

    // Modal Action Buttons
    bind('btn-re-execute-qaoa', 'click', () => runQuantumOptimization());
    bind('btn-confirm-role', 'click', () => confirmRoleAssignment());
    bind('btn-authorize-restock', 'click', () => executeRestockVerification());
    bind('btn-print-audit', 'click', () => window.print());
    bind('btn-export-csv', 'click', () => exportReportCSV());
    bind('btn-transmit-broadcast', 'click', () => sendOfficerBroadcastDirective());
    bind('btn-execute-node-dispatch', 'click', () => executeNodeDispatchAndReroute());
    bind('btn-submit-driver-registration', 'click', () => submitDriverRegistration());

    // All .qubo-run-btn elements
    document.querySelectorAll('.qubo-run-btn').forEach(btn => {
        if (!btn.dataset.listenerBound) {
            btn.addEventListener('click', () => runQuantumOptimization());
            btn.dataset.listenerBound = 'true';
        }
    });

    // Global Escape Key to close open modals
    if (!window._modalEscBound) {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modals = [
                    'calc-modal', 'quantum-terminal-modal', 'role-assignment-modal',
                    'restock-modal', 'shift-report-modal', 'broadcast-directive-modal',
                    'dispatch-node-modal', 'driver-registration-modal'
                ];
                modals.forEach(mId => closeModal(mId));
            }
        });
        window._modalEscBound = true;
    }
}

// ==========================================
// 2. NETWORK & WEBSOCKET ENGINE
// ==========================================
function connectWebSocket() {
    if (state.simulatedOffline) return;

    try {
        state.ws = new WebSocket(CONFIG.WS_URL);

        state.ws.onopen = () => {
            console.log('🟢 [WebSocket] Connected to QuantumRoute command stream');
            state.wsConnected = true;
            offlineStore.notifyNetworkChange();
            offlineStore.autoSyncQueue();
        };

        state.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleIncomingSocketMessage(data);
            } catch (err) {
                console.error('Error parsing WS message:', err);
            }
        };

        state.ws.onclose = () => {
            state.wsConnected = false;
            offlineStore.notifyNetworkChange();
            setTimeout(() => {
                if (!state.simulatedOffline) connectWebSocket();
            }, 4000);
        };

        state.ws.onerror = () => {
            state.wsConnected = false;
            offlineStore.notifyNetworkChange();
        };
    } catch (e) {
        console.warn('WebSocket connection fallback:', e);
    }
}

function handleIncomingSocketMessage(data) {
    console.log('📩 [WS Event]', data.type);

    if (data.type === 'EMERGENCY_CRASH_DETECTED') {
        const driver = state.fleet.find(d => d.id === data.driverId);
        if (driver) {
            driver.crashSensor = {
                isCrashed: true,
                gForce: data.gForce,
                tiltAngle: data.tiltAngle,
                lastTriggered: data.timestamp
            };
            applyEmergencyCrashUI(driver.id, true);
            showEmergencyBanner(driver);

            let msg = `Emergency SOS! Unit ${driver.name} at ${driver.node} reported vehicle impact of ${data.gForce}G!`;
            if (data.reinforcementPlan) {
                const r = data.reinforcementPlan;
                msg += ` Reinforcement Unit #${r.reinforcementDriverId} (${r.reinforcementDriverName}) quantum-rerouted!`;
                
                const reinfDriver = state.fleet.find(d => d.id === r.reinforcementDriverId);
                if (reinfDriver) {
                    reinfDriver.targetPos = r.crashCoords;
                    if (r.reinforcementPolyline) {
                        reinfDriver.polyline = r.reinforcementPolyline;
                        updateMiniMapPolyline(reinfDriver.id);
                    }
                    updateDriverCardUI(reinfDriver);
                }
            }

            audioEngine.triggerCommandAudioBroadcast(msg);
            showBroadcastToast(msg);
            renderTacticalMasterMapLayers();
        }
    } else if (data.type === 'EMERGENCY_CRASH_RESOLVED') {
        const driver = state.fleet.find(d => d.id === data.driverId);
        if (driver) {
            driver.crashSensor = { isCrashed: false, gForce: 1.0, tiltAngle: 0, lastTriggered: null };
            applyEmergencyCrashUI(driver.id, false);
            hideEmergencyBanner();
            renderTacticalMasterMapLayers();
        }
    } else if (data.type === 'ROLE_UPDATED') {
        const driver = state.fleet.find(d => d.id === data.driverId);
        if (driver) {
            driver.job = data.newRole;
            driver.isRescue = data.isRescue;
            driver.stock = data.stock;
            updateDriverCardUI(driver);
            renderWorkforceList();
            renderTacticalMasterMapLayers();
        }
    } else if (data.type === 'STOCK_UPDATED') {
        const driver = state.fleet.find(d => d.id === data.driverId);
        if (driver) {
            driver.stock = data.remainingStock;
            driver.deliveredTotal = data.deliveredTotal;
            updateDriverCardUI(driver);
        }
    } else if (data.type === 'RESTOCK_COMPLETED') {
        const driver = state.fleet.find(d => d.id === data.driverId);
        if (driver) {
            driver.stock = data.newStock;
            updateDriverCardUI(driver);
        }
    } else if (data.type === 'ROUTE_OBSTRUCTION_REROUTE') {
        const driver = state.fleet.find(d => d.id === data.driverId);
        if (driver) {
            driver.isObstructed = true;
            driver.polyline = data.polyline;
            driver.roadColor = '#ef4444';
            updateMiniMapPolyline(driver.id);
            updateDriverCardUI(driver);
            if (state.selectedDriverId === driver.id && state.driverPolyline) {
                state.driverPolyline.setLatLngs(driver.polyline);
                state.driverPolyline.setStyle({ color: '#ef4444', dashArray: '6, 6' });
                updateDriverNavigationHUD(driver);
            }
            renderTacticalMasterMapLayers();
        }
    } else if (data.type === 'DESTINATION_REASSIGNED') {
        const driver = state.fleet.find(d => d.id === data.driverId);
        if (driver) {
            driver.node = data.nodeName;
            driver.nodeLat = data.nodeLat;
            driver.nodeLng = data.nodeLng;
            driver.targetPos = data.targetPos;
            driver.polyline = data.polyline;
            driver.job = data.job;
            driver.isRescue = data.isRescue;
            if (data.quantumMetrics) driver.quantumMetrics = data.quantumMetrics;
            updateDriverCardUI(driver);
            updateMiniMapPolyline(driver.id);
            if (state.selectedDriverId === driver.id && state.driverPolyline) {
                state.driverPolyline.setLatLngs(driver.polyline);
                renderDriverSequenceMarkers(driver);
                updateDriverNavigationHUD(driver);
            }
            renderWorkforceList();
            renderTacticalMasterMapLayers();
            populateTextDispatchDriverSelect();
        }
    } else if (data.type === 'ROUTE_SEQUENCE_UPDATED') {
        const driver = state.fleet.find(d => d.id === data.driverId);
        if (driver) {
            driver.routeSequence = data.routeSequence;
            driver.polyline = data.polyline;
            driver.legs = data.legs;
            driver.totalEtaMinutes = data.totalEtaMinutes;
            driver.totalFuelBurnLiters = data.totalFuelBurnLiters;
            driver.roadColor = data.roadColor;
            driver.node = data.targetNodeName;
            updateDriverCardUI(driver);
            updateMiniMapPolyline(driver.id);
            if (state.selectedDriverId === driver.id && state.driverPolyline) {
                state.driverPolyline.setLatLngs(driver.polyline);
                state.driverPolyline.setStyle({ color: driver.roadColor || '#10b981' });
                renderDriverSequenceMarkers(driver);
                updateDriverNavigationHUD(driver);
            }
            renderTacticalMasterMapLayers();
        }
    } else if (data.type === 'ROUTE_CLEARED') {
        const driver = state.fleet.find(d => d.id === data.driverId);
        if (driver) {
            driver.routeSequence = [];
            driver.polyline = [driver.currentPos];
            driver.targetPos = [...driver.currentPos];
            driver.legs = [];
            driver.totalEtaMinutes = 0;
            driver.totalFuelBurnLiters = 0;
            driver.isObstructed = false;
            updateDriverCardUI(driver);
            updateMiniMapPolyline(driver.id);
            if (state.tacticalPolylines && state.tacticalPolylines[`poly-${driver.id}`]) {
                state.tacticalPolylines[`poly-${driver.id}`].setLatLngs([driver.currentPos]);
            }
            if (state.selectedDriverId === driver.id) {
                if (state.driverPolyline) state.driverPolyline.setLatLngs([driver.currentPos]);
                if (state.fullMapPoly) state.fullMapPoly.setLatLngs([driver.currentPos]);
                renderDriverSequenceMarkers(driver);
                updateDriverNavigationHUD(driver);
            }
            renderTacticalMasterMapLayers();
        }
    } else if (data.type === 'DRIVER_DEPLOYED' || data.type === 'DRIVER_REGISTERED') {
        const existing = state.fleet.find(d => d.id === data.driver.id);
        if (!existing) {
            state.fleet.push(data.driver);
            offlineStore.saveFleet(state.fleet);
            renderWorkforceList();
            renderGridCards();
            initMiniMapsGrid();
            renderTacticalMasterMapLayers();
            populateTextDispatchDriverSelect();
        }
    } else if (data.type === 'QUANTUM_SOLVER_EXECUTED') {
        audioEngine.playBeep(920, 0.2);
    } else if (data.type === 'AUDIO_EMERGENCY_BROADCAST') {
        audioEngine.triggerCommandAudioBroadcast(data.directive);
        showBroadcastToast(data.directive);
    }
}

async function fetchFleetFromBackend() {
    try {
        const res = await fetch(`${CONFIG.API_URL}/fleet?viewerRole=OFFICER`);
        if (res.ok) {
            const data = await res.json();
            if (data.fleet && data.fleet.length > 0) {
                state.fleet = data.fleet;
                await offlineStore.saveFleet(state.fleet);
                console.log(`✅ Synchronized ${data.fleet.length} fleet units from backend API`);
                renderWorkforceList();
                renderGridCards();
                initMiniMapsGrid();
                renderTacticalMasterMapLayers();
                populateTextDispatchDriverSelect();
            }
        }
    } catch (e) {
        console.warn('Backend API offline, running in resilient local mode.');
    }
}

// ==========================================
// 3. AUTHENTICATION & PORTAL SWITCHING
// ==========================================
function switchAuthTab(role) {
    audioEngine.playBeep(600, 0.08);
    const formOfficer = document.getElementById('form-officer');
    const formDriver = document.getElementById('form-driver');
    const tabOfficer = document.getElementById('auth-tab-officer');
    const tabDriver = document.getElementById('auth-tab-driver');

    if (role === 'officer') {
        formOfficer.classList.remove('hidden');
        formDriver.classList.add('hidden');
        tabOfficer.className = "py-2.5 rounded-lg bg-[#00f0ff] text-black font-extrabold transition shadow-lg shadow-[#00f0ff]/20";
        tabDriver.className = "py-2.5 rounded-lg text-slate-400 hover:text-white transition";
    } else {
        formDriver.classList.remove('hidden');
        formOfficer.classList.add('hidden');
        tabDriver.className = "py-2.5 rounded-lg bg-[#14b8a6] text-black font-extrabold transition shadow-lg shadow-[#14b8a6]/20";
        tabOfficer.className = "py-2.5 rounded-lg text-slate-400 hover:text-white transition";
    }
}

async function loginAsOfficer() {
    audioEngine.playBeep(880, 0.12);
    const offId = (document.getElementById('off-id').value || '').trim();
    const offPass = (document.getElementById('off-pass').value || '').trim();

    try {
        const res = await fetch(`${CONFIG.API_URL}/auth/officer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ officerId: offId, token: offPass })
        });
        if (res.ok) {
            const data = await res.json();
            state.user = { role: 'OFFICER', id: data.officerId, name: data.name };
        } else {
            state.user = { role: 'OFFICER', id: CONFIG.GOV_OFFICER_ID, name: CONFIG.OFFICER_NAME };
        }
    } catch (e) {
        state.user = { role: 'OFFICER', id: CONFIG.GOV_OFFICER_ID, name: CONFIG.OFFICER_NAME };
    }

    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-officer').classList.remove('hidden');
    document.getElementById('app-driver').classList.add('hidden');

    renderWorkforceList();
    initMiniMapsGrid();
    populateTextDispatchDriverSelect();
}

async function loginAsDriver() {
    audioEngine.playBeep(880, 0.12);
    const drvId = (document.getElementById('drv-id').value || 'DRIVER-RAJESH-01').trim();
    const drvPass = (document.getElementById('drv-pass').value || '123456').trim();

    try {
        const res = await fetch(`${CONFIG.API_URL}/auth/driver`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ driverId: drvId, passcode: drvPass })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.driver) {
                const idx = state.fleet.findIndex(d => d.id === data.driver.id);
                if (idx !== -1) state.fleet[idx] = data.driver;
                else state.fleet.push(data.driver);
            }
        }
    } catch (e) {}

    let matchedDriver = state.fleet.find(d => 
        (d.username && d.username.toLowerCase() === drvId.toLowerCase()) ||
        ('DRIVER-' + d.id).toLowerCase() === drvId.toLowerCase() ||
        (d.name && d.name.toLowerCase() === drvId.toLowerCase())
    ) || state.fleet[0];

    state.user = { role: 'DRIVER', ...matchedDriver };
    state.selectedDriverId = matchedDriver.id;

    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-driver').classList.remove('hidden');
    document.getElementById('app-officer').classList.add('hidden');

    initDriverInterface(matchedDriver);
}

// ==========================================
// 4. OFFICER COMMAND HUD & 10-NODE FLEET GRID
// ==========================================
function renderWorkforceList() {
    const container = document.getElementById('employee-list-container');
    if (!container) return;

    container.innerHTML = state.fleet.map(d => `
        <div onclick="expandDriverMap(${d.id})" class="employee-item p-2 bg-[#010409] rounded-lg border border-[#30363d] hover:border-[#00f0ff] flex items-center justify-between cursor-pointer transition text-[11px]" data-name="${d.name.toLowerCase()} ${d.node.toLowerCase()}">
            <div>
                <p class="font-bold text-white">Unit #${d.id}: ${d.name}</p>
                <p class="text-[8px] text-[#00f0ff]">${d.node}</p>
            </div>
            <div class="text-right">
                <span class="text-[9px] text-[#14b8a6] font-bold block">${d.isRescue ? 'Rescue Mode' : `${d.stock} Units`}</span>
                <span class="text-[8px] text-slate-500">${d.hours}h</span>
            </div>
        </div>
    `).join('');
}

function filterUnits() {
    const query = document.getElementById('unit-search').value.toLowerCase();
    const items = document.getElementsByClassName('employee-item');
    for (let item of items) {
        const text = item.getAttribute('data-name') || '';
        item.style.display = text.includes(query) ? "flex" : "none";
    }
}

function renderDriverColorLegends() {
    const bars = [
        document.getElementById('officer-driver-legend-bar'),
        document.getElementById('officer-tactical-driver-legend-bar')
    ];

    const tenDrivers = state.fleet.slice(0, 10);
    const pillsHtml = tenDrivers.map(d => {
        const color = d.color || (typeof DRIVER_COLORS !== 'undefined' ? DRIVER_COLORS[d.id] : '#00f0ff');
        return `
            <div class="driver-legend-pill" onclick="expandDriverMap(${d.id})" title="Unit #${d.id} ${d.name} (${d.colorName || 'Active Vector'})">
                <span class="driver-color-chip" style="background-color: ${color}; box-shadow: 0 0 6px ${color}"></span>
                <span>#${d.id} ${d.name}</span>
            </div>
        `;
    }).join('');

    bars.forEach(bar => {
        if (bar) {
            bar.innerHTML = `
                <span class="text-[9px] font-extrabold text-[#00f0ff] uppercase tracking-wider flex items-center pr-1 border-r border-[#30363d] mr-1">
                    <i class="fa-solid fa-palette mr-1.5"></i> Fleet Color Signature:
                </span>
                ${pillsHtml}
            `;
        }
    });
}

function renderGridCards() {
    const gridContainer = document.getElementById('officer-grid-container');
    if (!gridContainer) return;

    // Restrict active fleet grid display to exactly 10 units (Spec 1)
    const tenDrivers = state.fleet.slice(0, 10);

    // Remove any extra cards if they exist to keep 5x2 uniform layout
    const allCards = gridContainer.querySelectorAll('.map-card');
    allCards.forEach(c => {
        const id = parseInt(c.id.replace('card-', ''));
        if (id > 10) c.remove();
    });

    tenDrivers.forEach(driver => {
        const color = driver.color || (typeof DRIVER_COLORS !== 'undefined' ? DRIVER_COLORS[driver.id] : '#00f0ff');
        let card = document.getElementById('card-' + driver.id);
        if (!card) {
            card = document.createElement('div');
            card.id = `card-${driver.id}`;
            card.className = "map-card rounded-xl p-3 relative flex flex-col justify-between cursor-pointer";
            card.onclick = () => expandDriverMap(driver.id);
            card.innerHTML = `
                <div class="flex items-center justify-between text-[11px] mb-1">
                    <span class="font-bold text-white flex items-center gap-1.5">
                        <span class="driver-color-chip" style="background-color: ${color}; box-shadow: 0 0 6px ${color}"></span>
                        Unit #${driver.id}: ${driver.name}
                    </span>
                    <span id="status-${driver.id}" class="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase" style="background:${color}20; color:${color}; border: 1px solid ${color}40">${driver.isRescue ? 'CAPACITY FULL' : `${driver.stock} UNITS`}</span>
                </div>
                <p class="text-[9px] text-amber-400 mb-1 truncate"><i class="fa-solid fa-location-dot mr-1"></i> ${driver.node}</p>
                <div class="flex-1 w-full bg-[#010409] rounded-lg relative border border-[#30363d] overflow-hidden my-0.5" style="min-height: 120px;">
                    <div id="map-mini-${driver.id}" class="driver-mini-map h-full w-full"></div>
                </div>
                <div class="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                    <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full" style="background:${color}"></span> GPS Active</span>
                    <span class="text-amber-400 font-bold">${driver.fuel}L ⛽</span>
                </div>
            `;
            gridContainer.appendChild(card);
        }
        card.style.borderTop = `3px solid ${color}`;
        card.style.boxShadow = `0 0 10px ${color}20`;
    });

    renderDriverColorLegends();
}

function initMiniMapsGrid() {
    renderDriverColorLegends();
    renderGridCards();
    setTimeout(() => {
        const tenDrivers = state.fleet.slice(0, 10);
        tenDrivers.forEach((driver) => {
            const color = driver.color || (typeof DRIVER_COLORS !== 'undefined' ? DRIVER_COLORS[driver.id] : '#00f0ff');
            const mapContainerId = 'map-mini-' + driver.id;
            const containerEl = document.getElementById(mapContainerId);
            if (containerEl && !state.miniMaps[driver.id]) {
                const [lat, lng] = driver.currentPos;
                const [targetLat, targetLng] = driver.targetPos;

                const m = L.map(mapContainerId, {
                    zoomControl: false,
                    attributionControl: false,
                    dragging: false,
                    scrollWheelZoom: false,
                    doubleClickZoom: false
                }).setView([lat, lng], 13);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(m);

                // Driver Live Location Marker in unique color
                const liveMarker = L.circleMarker([lat, lng], {
                    radius: 6,
                    color: color,
                    fillColor: color,
                    fillOpacity: 1,
                    weight: 2
                }).addTo(m);

                // Target Waypoint Node Marker in unique color
                const targetMarker = L.circleMarker([targetLat, targetLng], {
                    radius: 4,
                    color: color,
                    fillColor: color,
                    fillOpacity: 1
                }).addTo(m);

                // Glowing Active Polyline in unique color
                const poly = L.polyline(driver.polyline || [[lat, lng], [targetLat, targetLng]], {
                    color: driver.isObstructed ? '#ef4444' : color,
                    weight: 3.5,
                    opacity: 0.9,
                    dashArray: driver.isObstructed ? '5, 5' : null
                }).addTo(m);

                state.miniMaps[driver.id] = { map: m, liveMarker, targetMarker, polyline: poly };
            } else if (state.miniMaps[driver.id]) {
                state.miniMaps[driver.id].map.invalidateSize();
            }

            if (driver.crashSensor && driver.crashSensor.isCrashed) {
                applyEmergencyCrashUI(driver.id, true);
            }
        });
    }, 250);
}

function updateMiniMapPolyline(driverId) {
    const driver = state.fleet.find(d => d.id === driverId);
    if (!driver) return;
    const color = driver.color || (typeof DRIVER_COLORS !== 'undefined' ? DRIVER_COLORS[driver.id] : '#00f0ff');
    const mini = state.miniMaps[driverId];
    if (mini && mini.polyline) {
        mini.polyline.setLatLngs(driver.polyline);
        mini.polyline.setStyle({
            color: driver.isObstructed ? '#ef4444' : color,
            dashArray: driver.isObstructed ? '5, 5' : null
        });
    }
}

function updateDriverCardUI(driver) {
    const statusEl = document.getElementById('status-' + driver.id);
    const cardEl = document.getElementById('card-' + driver.id);

    if (statusEl) {
        if (driver.crashSensor && driver.crashSensor.isCrashed) {
            statusEl.className = "px-2 py-0.5 bg-red-600 text-white rounded text-[9px] font-extrabold uppercase animate-bounce";
            statusEl.innerText = "SOS CRASH!";
        } else if (driver.isObstructed) {
            statusEl.className = "px-2 py-0.5 bg-amber-600 text-black rounded text-[9px] font-extrabold uppercase animate-pulse";
            statusEl.innerText = "BLOCKED!";
        } else if (driver.isRescue) {
            statusEl.className = "px-2 py-0.5 badge-rescue rounded text-[9px] font-extrabold uppercase";
            statusEl.innerText = "CAPACITY FULL";
        } else {
            statusEl.className = "px-2 py-0.5 badge-resource rounded text-[9px] font-extrabold uppercase";
            statusEl.innerText = driver.stock + ' UNITS';
        }
    }

    if (cardEl) {
        if (driver.crashSensor && driver.crashSensor.isCrashed) {
            cardEl.classList.add('emergency-blink');
        } else {
            cardEl.classList.remove('emergency-blink');
        }
    }

    if (state.selectedDriverId === driver.id) {
        populateExpandedSidebar(driver);
    }
}

// ==========================================
// 5. LIVE QUANTUM COMPUTING & QAOA SOLVER PANEL
// ==========================================
function toggleOfficerQuantumPanel() {
    audioEngine.playBeep(750, 0.08);
    const panel = document.getElementById('officer-quantum-panel');
    if (panel) {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) {
            panel.scrollIntoView({ behavior: 'smooth' });
        }
    }
}

async function runLandingQuboSolver() {
    audioEngine.playBeep(920, 0.15);
    const terminalEl = document.getElementById('landing-qubo-terminal');
    const runBtn = document.getElementById('landing-run-qubo-btn');
    if (runBtn) {
        runBtn.disabled = true;
        runBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Annealing Matrix...';
    }
    if (terminalEl) {
        await quantumEngine.simulateMatrixConvergenceTerminal(terminalEl, async () => {
            if (runBtn) {
                runBtn.disabled = false;
                runBtn.innerHTML = '<i class="fa-solid fa-check mr-1 text-emerald-400"></i> Ground State Locked';
                setTimeout(() => {
                    runBtn.innerHTML = '<i class="fa-solid fa-atom mr-1"></i> Run QUBO Solver';
                }, 3500);
            }
            const cBar = document.getElementById('landing-carbon-bar');
            if (cBar) cBar.style.width = '21.9%';
            const dBar = document.getElementById('landing-dist-bar');
            if (dBar) dBar.style.width = '18.4%';
        });
    }
}

async function runQuantumOptimization() {
    audioEngine.playBeep(920, 0.15);
    
    // Check if officer inline terminal is visible, else open modal terminal
    let terminalEl = document.getElementById('officer-qubo-terminal');
    const panel = document.getElementById('officer-quantum-panel');
    if (!panel || panel.classList.contains('hidden')) {
        terminalEl = document.getElementById('qubo-terminal-output');
        openModal('quantum-terminal-modal');
    }

    const runBtns = document.querySelectorAll('.qubo-run-btn');
    runBtns.forEach(b => {
        b.disabled = true;
        b.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Annealing Matrix...';
    });

    if (terminalEl) {
        await quantumEngine.simulateMatrixConvergenceTerminal(terminalEl, async () => {
            // Update backend state
            try {
                await fetch(`${CONFIG.API_URL}/quantum-solve`, { method: 'POST' });
            } catch (e) {}

            // Save in IndexedDB
            state.fleet.forEach(d => {
                if (d.routeSequence && d.routeSequence.length > 1) {
                    const multiResult = quantumEngine.solveQuantumMultiNodeRoute(d.currentPos, d.routeSequence, d.isObstructed);
                    d.polyline = multiResult.fullPolyline;
                    d.legs = multiResult.legs;
                    d.totalDistanceKm = multiResult.totalDistanceKm;
                    d.totalFuelBurnLiters = multiResult.totalFuelBurnLiters;
                    d.totalEtaMinutes = multiResult.totalEtaMinutes;
                    d.quantumMetrics = {
                        hamiltonianEnergy: CONFIG.GROUND_STATE_ENERGY_EV,
                        carbonSavedKg: multiResult.totalCarbonSavedKg,
                        distanceSavedKm: Number((multiResult.totalDistanceKm * 0.18).toFixed(1)),
                        qaoaLayers: 4,
                        optimalRouteFound: true
                    };
                } else {
                    const reroute = quantumEngine.solveOptimalRoute(d.currentPos, d.targetPos, d.isObstructed);
                    d.polyline = reroute.path;
                    d.quantumMetrics = {
                        hamiltonianEnergy: CONFIG.GROUND_STATE_ENERGY_EV,
                        carbonSavedKg: reroute.carbonSavedKg,
                        distanceSavedKm: reroute.distanceSavedKm,
                        qaoaLayers: 4,
                        optimalRouteFound: true
                    };
                }
                updateMiniMapPolyline(d.id);
            });
            await offlineStore.saveFleet(state.fleet);

            // Update Progress meters everywhere
            const carbonBars = document.querySelectorAll('.carbon-reduction-bar');
            carbonBars.forEach(b => b.style.width = '21.9%');
            const distBars = document.querySelectorAll('.distance-reduction-bar');
            distBars.forEach(b => b.style.width = '18.4%');

            runBtns.forEach(b => {
                b.disabled = false;
                b.innerHTML = '<i class="fa-solid fa-check mr-1 text-emerald-400"></i> Ground State Locked';
                setTimeout(() => {
                    b.innerHTML = '<i class="fa-solid fa-atom mr-1"></i> Run QUBO Solver';
                }, 3500);
            });
        });
    }
}

// ==========================================
// 6. EXPANDED DRIVER TELEMETRY VIEW
// ==========================================
function expandDriverMap(id) {
    audioEngine.playBeep(700, 0.08);
    state.selectedDriverId = id;
    const driver = state.fleet.find(d => d.id === id) || state.fleet[0];

    document.getElementById('officer-grid-view').classList.add('hidden');
    document.getElementById('officer-expanded-view').classList.remove('hidden');
    document.getElementById('back-grid-btn').classList.remove('hidden');

    populateExpandedSidebar(driver);

    setTimeout(() => {
        const [lat, lng] = driver.currentPos;
        const color = driver.color || (typeof DRIVER_COLORS !== 'undefined' ? DRIVER_COLORS[driver.id] : '#00f0ff');
        const polyColor = driver.isObstructed ? '#ef4444' : color;

        let routeDistKm = driver.totalDistanceKm;
        if (!routeDistKm && driver.polyline && driver.polyline.length > 1) {
            let d = 0;
            for (let i = 0; i < driver.polyline.length - 1; i++) {
                d += Math.hypot(driver.polyline[i+1][0] - driver.polyline[i][0], driver.polyline[i+1][1] - driver.polyline[i][1]) * 111;
            }
            routeDistKm = Number((d * 1.08).toFixed(2));
        }
        const fuelBurnL = driver.totalFuelBurnLiters || Number((routeDistKm * 0.138).toFixed(2));
        const co2SavedKg = Number((routeDistKm * (0.185 - 0.138) * CONFIG.CARBON_COEFF_PER_LITER).toFixed(2));

        const popupContent = `
            <div class="route-popup-card">
                <p class="font-extrabold text-white text-xs mb-1 flex items-center gap-1.5">
                    <span class="driver-color-chip" style="background:${color}; box-shadow: 0 0 6px ${color}"></span>
                    Unit #${driver.id}: ${driver.name} Route
                </p>
                <div class="text-[10px] space-y-0.5 text-slate-300 font-mono my-1.5 bg-[#010409] p-1.5 rounded border border-[#30363d]">
                    <div class="flex justify-between"><span>Distance:</span><span class="text-[#00f0ff] font-bold">${routeDistKm} km</span></div>
                    <div class="flex justify-between"><span>Fuel Burn Req:</span><span class="text-amber-400 font-bold">${fuelBurnL} L</span></div>
                    <div class="flex justify-between"><span>Carbon Saved:</span><span class="text-emerald-400 font-bold">${co2SavedKg} kg CO₂</span></div>
                </div>
                <button onclick="clearDriverRoute(${driver.id})" class="route-clear-btn">
                    <i class="fa-solid fa-xmark"></i> Clear Route
                </button>
            </div>
        `;

        if (!state.fullMap) {
            state.fullMap = L.map('map-full-expanded', { zoomControl: true }).setView([lat, lng], 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(state.fullMap);

            state.fullMapMarker = L.circleMarker([lat, lng], {
                radius: 8,
                color: color,
                fillColor: color,
                fillOpacity: 1
            }).addTo(state.fullMap);

            state.fullMapPoly = L.polyline(driver.polyline, {
                color: polyColor,
                weight: 4.5,
                opacity: 0.95
            }).addTo(state.fullMap);
            state.fullMapPoly.bindPopup(popupContent);
        } else {
            state.fullMap.setView([lat, lng], 14);
            state.fullMapMarker.setLatLng([lat, lng]);
            state.fullMapMarker.setStyle({ color: color, fillColor: color });
            state.fullMapPoly.setLatLngs(driver.polyline);
            state.fullMapPoly.setStyle({ color: polyColor });
            state.fullMapPoly.setPopupContent(popupContent);
            state.fullMap.invalidateSize();
        }

        // Render sequence markers on full expanded map
        if (!state.fullMapSequenceMarkers) state.fullMapSequenceMarkers = [];
        state.fullMapSequenceMarkers.forEach(m => state.fullMap.removeLayer(m));
        state.fullMapSequenceMarkers = [];

        const seqList = (driver.routeSequence && driver.routeSequence.length > 0)
            ? driver.routeSequence
            : [{ seq: 1, name: driver.node, lat: driver.targetPos[0], lng: driver.targetPos[1], color: polyColor }];

        seqList.forEach((stop, sIdx) => {
            const seqNum = stop.seq || (sIdx + 1);
            const badgeColor = stop.color || color;
            const matchingLeg = (driver.legs && driver.legs.length >= seqNum) ? driver.legs[seqNum - 1] : null;
            const legDist = matchingLeg ? matchingLeg.distanceKm : (stop.distanceKm || '1.80');
            const cumulDist = matchingLeg && matchingLeg.cumulativeDistanceKm ? matchingLeg.cumulativeDistanceKm : (stop.cumulativeDistanceKm || legDist);
            const legFuel = matchingLeg ? matchingLeg.fuelBurnLiters : (stop.fuelBurnLiters || '0.25');
            const cumulFuel = matchingLeg && matchingLeg.cumulativeFuelBurnLiters ? matchingLeg.cumulativeFuelBurnLiters : (stop.cumulativeFuelBurnLiters || legFuel);
            const legEta = matchingLeg ? matchingLeg.etaMinutes : (stop.etaMinutes || '4.5');
            const cumulEta = matchingLeg && matchingLeg.cumulativeEtaMinutes ? matchingLeg.cumulativeEtaMinutes : (stop.cumulativeEtaMinutes || legEta);

            const seqIcon = L.divIcon({
                className: 'node-sequence-marker',
                html: `
                    <div class="sequence-badge" style="border-color:${badgeColor}; background:${badgeColor}; box-shadow: 0 0 12px ${badgeColor}">
                        ${seqNum}
                    </div>
                    <div class="sequence-label">${stop.name || ('Stop #' + seqNum)}</div>
                `,
                iconSize: [44, 44],
                iconAnchor: [22, 22]
            });

            const sm = L.marker([stop.lat, stop.lng], { icon: seqIcon, zIndexOffset: 1000 })
                .addTo(state.fullMap)
                .bindPopup(`
                    <div class="tactical-popup p-1.5 text-xs font-sans min-w-[210px]">
                        <div class="flex items-center justify-between pb-1 mb-1 border-b border-slate-700">
                            <span class="font-extrabold text-[#00f0ff]">Stop #${seqNum}: ${stop.name || driver.node}</span>
                            <span class="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-[#00f0ff]/20 text-[#00f0ff]">LEG ${seqNum}</span>
                        </div>
                        <p class="text-[10px] text-white">Assigned: Unit #${driver.id} (${driver.name})</p>
                        <p class="text-[9px] text-slate-300 mt-0.5">Role: ${driver.job} • Stock: ${driver.stock}</p>
                        <div class="text-[9px] space-y-0.5 text-slate-300 font-mono bg-[#010409] p-1.5 rounded border border-[#30363d] mt-1">
                            <div class="flex justify-between"><span>Leg Distance:</span><span class="text-white font-bold">${legDist} km</span></div>
                            <div class="flex justify-between"><span>Cumulative Dist:</span><span class="text-[#00f0ff] font-bold">${cumulDist} km</span></div>
                            <div class="flex justify-between"><span>Leg Fuel:</span><span class="text-white font-bold">${legFuel} L</span></div>
                            <div class="flex justify-between"><span>Cumulative Fuel:</span><span class="text-amber-400 font-bold">${cumulFuel} L</span></div>
                            <div class="flex justify-between"><span>Leg ETA:</span><span class="text-emerald-400 font-bold">${legEta} min</span></div>
                            <div class="flex justify-between"><span>Cumulative ETA:</span><span class="text-emerald-300 font-bold">${cumulEta} min</span></div>
                        </div>
                    </div>
                `);
            state.fullMapSequenceMarkers.push(sm);
        });
    }, 250);
}

function buildLegsHTML(driver) {
    if (!driver || !driver.routeSequence || driver.routeSequence.length === 0) {
        return '<p class="text-[10px] text-slate-500 italic p-2">No active mission stops assigned.</p>';
    }

    const driverColor = driver.color || (typeof DRIVER_COLORS !== 'undefined' ? DRIVER_COLORS[driver.id] : '#00f0ff');
    return driver.routeSequence.map((stop, sIdx) => {
        const seqNum = stop.seq || (sIdx + 1);
        const matchingLeg = (driver.legs && driver.legs.length >= seqNum) ? driver.legs[seqNum - 1] : null;
        const legDist = matchingLeg ? matchingLeg.distanceKm : (stop.distanceKm || '1.80');
        const cumulDist = matchingLeg && matchingLeg.cumulativeDistanceKm ? matchingLeg.cumulativeDistanceKm : (stop.cumulativeDistanceKm || legDist);
        const legFuel = matchingLeg ? matchingLeg.fuelBurnLiters : (stop.fuelBurnLiters || '0.25');
        const cumulFuel = matchingLeg && matchingLeg.cumulativeFuelBurnLiters ? matchingLeg.cumulativeFuelBurnLiters : (stop.cumulativeFuelBurnLiters || legFuel);
        const legEta = matchingLeg ? matchingLeg.etaMinutes : (stop.etaMinutes || '4.5');
        const cumulEta = matchingLeg && matchingLeg.cumulativeEtaMinutes ? matchingLeg.cumulativeEtaMinutes : (stop.cumulativeEtaMinutes || legEta);

        return `
            <div class="p-2 rounded-lg bg-[#161b22]/90 border border-[#30363d] hover:border-[#00f0ff]/50 transition text-[10px]">
                <div class="flex items-center justify-between mb-1">
                    <span class="font-bold text-white flex items-center gap-1.5 truncate">
                        <span class="w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] text-black" style="background:${driverColor}">
                            ${seqNum}
                        </span>
                        <span class="truncate">${stop.name}</span>
                    </span>
                    <span class="text-[8px] font-mono px-1 py-0.5 rounded bg-slate-800 text-slate-300 whitespace-nowrap">
                        ${legEta}m (Σ ${cumulEta}m)
                    </span>
                </div>
                <div class="grid grid-cols-2 gap-1 text-[9px] font-mono text-slate-400 pt-1 border-t border-slate-800">
                    <div>Dist: <span class="text-white font-bold">${legDist}km</span> <span class="text-[#00f0ff] font-bold">(${cumulDist}km)</span></div>
                    <div>Fuel: <span class="text-white font-bold">${legFuel}L</span> <span class="text-amber-400 font-bold">(${cumulFuel}L)</span></div>
                </div>
            </div>
        `;
    }).join('');
}

function renderDriverLegsList(driver) {
    if (!driver) return;
    const count = (driver.routeSequence && driver.routeSequence.length) || 0;
    const badgeText = `${count} STOPS`;
    
    const drvBadge = document.getElementById('drv-sidebar-stops-badge');
    if (drvBadge) drvBadge.innerText = badgeText;

    const drawerBadge = document.getElementById('drv-drawer-badge');
    if (drawerBadge) drawerBadge.innerText = badgeText;

    const html = buildLegsHTML(driver);

    const drvList = document.getElementById('drv-legs-list');
    if (drvList) drvList.innerHTML = html;

    const drawerContent = document.getElementById('drv-legs-drawer-content');
    if (drawerContent) drawerContent.innerHTML = html;
}

function toggleDriverLegsDrawer() {
    audioEngine.playBeep(650, 0.05);
    const drawer = document.getElementById('driver-legs-drawer');
    if (drawer) drawer.classList.toggle('hidden');
}

function populateExpandedSidebar(driver) {
    document.getElementById('exp-profile-name').innerText = `Unit #${driver.id}: Driver ${driver.name}`;
    document.getElementById('side-node-name').innerText = driver.node;
    document.getElementById('side-hours').innerText = `${driver.hours} Hours`;
    
    const initials = driver.name.substring(0, 2).toUpperCase();
    document.getElementById('exp-profile-initials').innerText = initials;
    document.getElementById('side-initials').innerText = initials;

    const carbonSaved = Number((driver.fuel * 0.28 * CONFIG.CARBON_COEFF_PER_LITER).toFixed(2));
    const carbonEl = document.getElementById('side-carbon-saved');
    if (carbonEl) {
        carbonEl.innerText = `${carbonSaved} kg CO₂ (${driver.fuel}L × 2.68 kg CO₂)`;
    }

    const salaryEl = document.getElementById('side-salary');
    if (salaryEl) {
        if (state.user && state.user.role === 'OFFICER') {
            salaryEl.innerHTML = `<span class="text-emerald-400 font-bold">₹${driver.salary.toLocaleString()} / mo</span> <span class="text-[8px] text-slate-500">(Officer View)</span>`;
        } else {
            salaryEl.innerHTML = `<span class="text-slate-400 italic">[PRIVACY SHIELD PROTECTED]</span>`;
        }
    }

    // Populate expanded sidebar mission legs
    const expBadge = document.getElementById('exp-stops-count-badge');
    if (expBadge) {
        const count = (driver.routeSequence && driver.routeSequence.length) || 0;
        expBadge.innerText = `${count} STOPS`;
    }
    const expLegs = document.getElementById('exp-mission-legs');
    if (expLegs) {
        expLegs.innerHTML = buildLegsHTML(driver);
    }
}

function backToGrid() {
    audioEngine.playBeep(650, 0.08);
    document.getElementById('officer-expanded-view').classList.add('hidden');
    document.getElementById('back-grid-btn').classList.add('hidden');
    document.getElementById('officer-grid-view').classList.remove('hidden');
    setTimeout(() => {
        Object.values(state.miniMaps).forEach(item => item.map.invalidateSize());
    }, 250);
}

// ==========================================
// 7. DYNAMIC JOB ROLE ASSIGNMENT
// ==========================================
function openRoleAssignmentModal(driverId) {
    const driver = state.fleet.find(d => d.id === driverId);
    if (!driver) return;
    state.selectedDriverId = driverId;
    document.getElementById('reassign-driver-name').innerText = driver.name;
    document.getElementById('reassign-role-select').value = driver.job;
    openModal('role-assignment-modal');
}

async function confirmRoleAssignment() {
    audioEngine.playBeep(880, 0.1);
    const driverId = state.selectedDriverId;
    const newRole = document.getElementById('reassign-role-select').value;
    const driver = state.fleet.find(d => d.id === driverId);
    if (!driver) return;

    const isRescue = isRescueMission(newRole);
    driver.job = newRole;
    driver.isRescue = isRescue;
    if (isRescue) {
        driver.stock = 0;
    } else if (driver.stock === 0) {
        driver.stock = 200;
    }
    driver.lastUpdated = new Date().toISOString();

    await offlineStore.updateDriver(driver);

    if (state.wsConnected && !state.simulatedOffline) {
        try {
            await fetch(`${CONFIG.API_URL}/fleet/${driverId}/role`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newRole })
            });
        } catch (e) {
            await offlineStore.queueOfflineAction({ type: 'ROLE_CHANGE', driverId, role: newRole });
        }
    } else {
        await offlineStore.queueOfflineAction({ type: 'ROLE_CHANGE', driverId, role: newRole });
    }

    updateDriverCardUI(driver);
    renderWorkforceList();
    closeModal('role-assignment-modal');
    alert(`Mission role for Unit #${driver.id} (${driver.name}) dynamically updated to "${newRole}".`);
}

function toggleOfficerTacticalMap() {
    audioEngine.playBeep(750, 0.08);
    const gridView = document.getElementById('officer-grid-view');
    const tacticalView = document.getElementById('officer-tactical-map-view');
    const expandedView = document.getElementById('officer-expanded-view');
    const modeBtnText = document.getElementById('officer-map-mode-text');

    if (!tacticalView) return;

    if (tacticalView.classList.contains('hidden')) {
        // Switch to Tactical Master Map
        if (gridView) gridView.classList.add('hidden');
        if (expandedView) expandedView.classList.add('hidden');
        tacticalView.classList.remove('hidden');
        if (modeBtnText) modeBtnText.innerText = "Fleet Grid View";
        initTacticalMasterMap();
    } else {
        // Switch back to Grid View
        tacticalView.classList.add('hidden');
        if (gridView) gridView.classList.remove('hidden');
        if (modeBtnText) modeBtnText.innerText = "Tactical Map";
        setTimeout(() => {
            Object.values(state.miniMaps).forEach(item => item.map.invalidateSize());
        }, 200);
    }
}

function initTacticalMasterMap() {
    setTimeout(() => {
        const mapEl = document.getElementById('officer-master-tactical-map');
        if (!mapEl) return;

        if (!state.tacticalMasterMap) {
            state.tacticalMasterMap = L.map('officer-master-tactical-map', {
                zoomControl: true
            }).setView([16.5150, 80.6400], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(state.tacticalMasterMap);

            // Interactive Click to Dispatch / Spawn Node
            state.tacticalMasterMap.on('click', (e) => {
                handleOfficerMapClick(e.latlng.lat, e.latlng.lng);
            });
        }

        renderTacticalMasterMapLayers();
        state.tacticalMasterMap.invalidateSize();
    }, 200);
}

function renderTacticalMasterMapLayers() {
    if (!state.tacticalMasterMap) return;

    if (!state.tacticalMarkers) state.tacticalMarkers = {};
    if (!state.tacticalPolylines) state.tacticalPolylines = {};

    // 1. Render all Disaster Nodes
    const locations = (typeof RESCUE_LOCATIONS !== 'undefined' && RESCUE_LOCATIONS.length > 0) 
        ? RESCUE_LOCATIONS 
        : (typeof RESCUE_LOCATIONS_6 !== 'undefined' ? RESCUE_LOCATIONS_6 : []);

    locations.forEach(loc => {
        const markerKey = `node-${loc.id}`;
        if (!state.tacticalMarkers[markerKey]) {
            const nodeMarker = L.circleMarker([loc.lat, loc.lng], {
                radius: 9,
                color: loc.color || '#00f0ff',
                fillColor: loc.color || '#00f0ff',
                fillOpacity: 0.85,
                weight: 2
            }).addTo(state.tacticalMasterMap);

            nodeMarker.bindPopup(`
                <div class="tactical-popup p-1 font-sans text-xs">
                    <p class="font-extrabold text-white text-xs">${loc.name}</p>
                    <p class="text-[10px] text-amber-400 mt-0.5">Hazard: <b>${loc.hazard}</b> • Rain: ${loc.rain} • Wind: ${loc.wind}</p>
                    <p class="text-[9px] text-slate-400 mt-1 font-mono">${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</p>
                    <button onclick="handleOfficerMapClick(${loc.lat}, ${loc.lng}, '${loc.name.replace(/'/g, "\\'")}')" class="mt-2 w-full py-1 bg-[#00f0ff] hover:bg-[#33f3ff] text-black font-extrabold rounded text-[9px] uppercase">
                        Dispatch / Reroute Unit Here
                    </button>
                </div>
            `);
            state.tacticalMarkers[markerKey] = nodeMarker;
        }
    });

    // 2. Render all active Fleet Units with glowing polylines (Unique Colors & Clear Action - Spec 3 & 4)
    state.fleet.forEach(driver => {
        const driverKey = `driver-${driver.id}`;
        const polyKey = `poly-${driver.id}`;
        const driverColor = driver.color || (typeof DRIVER_COLORS !== 'undefined' ? DRIVER_COLORS[driver.id] : '#00f0ff');

        const [lat, lng] = driver.currentPos;
        const [targetLat, targetLng] = driver.targetPos;

        if (!state.tacticalMarkers[driverKey]) {
            const truckBeacon = L.divIcon({
                className: 'vehicle-beacon-wrapper',
                html: `
                    <div class="vehicle-beacon-container">
                        <div class="vehicle-beacon-pulse" style="background: ${driverColor}40"></div>
                        <div class="vehicle-beacon-dot" style="background: ${driverColor}; box-shadow: 0 0 10px ${driverColor}"></div>
                        <div class="vehicle-beacon-truck">🚚</div>
                    </div>
                `,
                iconSize: [36, 36],
                iconAnchor: [18, 18]
            });

            const truckMarker = L.marker([lat, lng], { icon: truckBeacon }).addTo(state.tacticalMasterMap);
            truckMarker.bindPopup(`
                <div class="tactical-popup p-1 text-xs">
                    <p class="font-bold text-white flex items-center gap-1.5">
                        <span class="driver-color-chip" style="background:${driverColor}; box-shadow: 0 0 6px ${driverColor}"></span>
                        Unit #${driver.id}: ${driver.name}
                    </p>
                    <p class="text-[10px] text-[#00f0ff]">Target: ${driver.node}</p>
                    <p class="text-[9px] text-slate-400 mt-0.5">Role: ${driver.job} • Stock: ${driver.stock} • Fuel: ${driver.fuel}L</p>
                    <button onclick="expandDriverMap(${driver.id})" class="mt-2 w-full py-1 bg-[#161b22] hover:bg-[#21262d] text-white border border-[#30363d] rounded text-[9px] uppercase font-bold">
                        Examine Operative Telemetry
                    </button>
                </div>
            `);
            state.tacticalMarkers[driverKey] = truckMarker;
        } else {
            state.tacticalMarkers[driverKey].setLatLng([lat, lng]);
        }

        const polyColor = driver.isObstructed ? '#ef4444' : driverColor;

        let routeDistKm = driver.totalDistanceKm;
        if (!routeDistKm && driver.polyline && driver.polyline.length > 1) {
            let d = 0;
            for (let i = 0; i < driver.polyline.length - 1; i++) {
                d += Math.hypot(driver.polyline[i+1][0] - driver.polyline[i][0], driver.polyline[i+1][1] - driver.polyline[i][1]) * 111;
            }
            routeDistKm = Number((d * 1.08).toFixed(2));
        }
        const fuelBurnL = driver.totalFuelBurnLiters || Number((routeDistKm * 0.138).toFixed(2));
        const co2SavedKg = Number((routeDistKm * (0.185 - 0.138) * CONFIG.CARBON_COEFF_PER_LITER).toFixed(2));

        const popupContent = `
            <div class="route-popup-card">
                <p class="font-extrabold text-white text-xs mb-1 flex items-center gap-1.5">
                    <span class="driver-color-chip" style="background:${driverColor}; box-shadow: 0 0 6px ${driverColor}"></span>
                    Unit #${driver.id}: ${driver.name} Route
                </p>
                <div class="text-[10px] space-y-0.5 text-slate-300 font-mono my-1.5 bg-[#010409] p-1.5 rounded border border-[#30363d]">
                    <div class="flex justify-between"><span>Distance:</span><span class="text-[#00f0ff] font-bold">${routeDistKm} km</span></div>
                    <div class="flex justify-between"><span>Fuel Burn Req:</span><span class="text-amber-400 font-bold">${fuelBurnL} L</span></div>
                    <div class="flex justify-between"><span>Carbon Saved:</span><span class="text-emerald-400 font-bold">${co2SavedKg} kg CO₂</span></div>
                </div>
                <button onclick="clearDriverRoute(${driver.id})" class="route-clear-btn">
                    <i class="fa-solid fa-xmark"></i> Clear Route
                </button>
            </div>
        `;

        if (!state.tacticalPolylines[polyKey]) {
            const poly = L.polyline(driver.polyline || [[lat, lng], [targetLat, targetLng]], {
                color: polyColor,
                weight: 4,
                opacity: 0.85,
                dashArray: driver.isObstructed ? '6, 6' : null
            }).addTo(state.tacticalMasterMap);
            poly.bindPopup(popupContent);
            poly.on('mouseover', () => poly.setStyle({ weight: 6, opacity: 1 }));
            poly.on('mouseout', () => poly.setStyle({ weight: 4, opacity: 0.85 }));
            state.tacticalPolylines[polyKey] = poly;
        } else {
            state.tacticalPolylines[polyKey].setLatLngs(driver.polyline);
            state.tacticalPolylines[polyKey].setStyle({
                color: polyColor,
                dashArray: driver.isObstructed ? '6, 6' : null
            });
            state.tacticalPolylines[polyKey].setPopupContent(popupContent);
        }

        // 3. Render numbered sequence badges above assigned stops
        const seqList = (driver.routeSequence && driver.routeSequence.length > 0)
            ? driver.routeSequence
            : [{ seq: 1, name: driver.node, lat: targetLat, lng: targetLng, color: polyColor }];

        seqList.forEach((stop, sIdx) => {
            const seqNum = stop.seq || (sIdx + 1);
            const seqKey = `seq-${driver.id}-${seqNum}`;
            const stopLat = stop.lat;
            const stopLng = stop.lng;
            const badgeColor = stop.color || driverColor;

            const matchingLeg = (driver.legs && driver.legs.length >= seqNum) ? driver.legs[seqNum - 1] : null;
            const legDist = matchingLeg ? matchingLeg.distanceKm : (stop.distanceKm || '1.80');
            const cumulDist = matchingLeg && matchingLeg.cumulativeDistanceKm ? matchingLeg.cumulativeDistanceKm : (stop.cumulativeDistanceKm || legDist);
            const legFuel = matchingLeg ? matchingLeg.fuelBurnLiters : (stop.fuelBurnLiters || '0.25');
            const cumulFuel = matchingLeg && matchingLeg.cumulativeFuelBurnLiters ? matchingLeg.cumulativeFuelBurnLiters : (stop.cumulativeFuelBurnLiters || legFuel);
            const legEta = matchingLeg ? matchingLeg.etaMinutes : (stop.etaMinutes || '4.5');
            const cumulEta = matchingLeg && matchingLeg.cumulativeEtaMinutes ? matchingLeg.cumulativeEtaMinutes : (stop.cumulativeEtaMinutes || legEta);

            if (!state.tacticalSequenceMarkers[seqKey]) {
                const seqIcon = L.divIcon({
                    className: 'node-sequence-marker',
                    html: `
                        <div class="sequence-badge" style="border-color:${badgeColor}; background:${badgeColor}; box-shadow: 0 0 12px ${badgeColor}">
                            ${seqNum}
                        </div>
                        <div class="sequence-label">${stop.name || ('Stop #' + seqNum)}</div>
                    `,
                    iconSize: [44, 44],
                    iconAnchor: [22, 22]
                });

                const seqMarker = L.marker([stopLat, stopLng], { icon: seqIcon, zIndexOffset: 1000 }).addTo(state.tacticalMasterMap);
                seqMarker.bindPopup(`
                    <div class="tactical-popup p-1.5 text-xs font-sans min-w-[210px]">
                        <div class="flex items-center justify-between pb-1 mb-1 border-b border-slate-700">
                            <span class="font-extrabold text-[#00f0ff]">Stop #${seqNum}: ${stop.name || driver.node}</span>
                            <span class="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-[#00f0ff]/20 text-[#00f0ff]">LEG ${seqNum}</span>
                        </div>
                        <p class="text-[10px] text-white">Assigned: Unit #${driver.id} (${driver.name})</p>
                        <p class="text-[9px] text-slate-300 mt-0.5">Role: ${driver.job} • Stock: ${driver.stock}</p>
                        <div class="text-[9px] space-y-0.5 text-slate-300 font-mono bg-[#010409] p-1.5 rounded border border-[#30363d] mt-1">
                            <div class="flex justify-between"><span>Leg Distance:</span><span class="text-white font-bold">${legDist} km</span></div>
                            <div class="flex justify-between"><span>Cumulative Dist:</span><span class="text-[#00f0ff] font-bold">${cumulDist} km</span></div>
                            <div class="flex justify-between"><span>Leg Fuel:</span><span class="text-white font-bold">${legFuel} L</span></div>
                            <div class="flex justify-between"><span>Cumulative Fuel:</span><span class="text-amber-400 font-bold">${cumulFuel} L</span></div>
                            <div class="flex justify-between"><span>Leg ETA:</span><span class="text-emerald-400 font-bold">${legEta} min</span></div>
                            <div class="flex justify-between"><span>Cumulative ETA:</span><span class="text-emerald-300 font-bold">${cumulEta} min</span></div>
                        </div>
                    </div>
                `);
                state.tacticalSequenceMarkers[seqKey] = seqMarker;
            } else {
                state.tacticalSequenceMarkers[seqKey].setLatLng([stopLat, stopLng]);
            }
        });
    });

    const badge = document.getElementById('tactical-active-nodes-badge');
    if (badge) {
        badge.innerText = `${locations.length} Active Nodes • ${state.fleet.length} Units`;
    }

    renderDriverColorLegends();
}

/**
 * Interactive Route Line Clearing Action (Spec 4)
 * Resets the assigned route line and stops via POST /api/fleet/:id/clear-route
 */
async function clearDriverRoute(driverId) {
    audioEngine.playBeep(700, 0.1);
    const driver = state.fleet.find(d => d.id === driverId);
    if (!driver) return;

    if (!confirm(`Clear active route sequence and polyline for Unit #${driver.id} (${driver.name})?`)) {
        return;
    }

    if (state.wsConnected && !state.simulatedOffline) {
        try {
            await fetch(`${CONFIG.API_URL}/fleet/${driverId}/clear-route`, { method: 'POST' });
        } catch (e) {
            console.warn('API error during route clearing:', e);
        }
    }

    // Reset local driver route state
    driver.routeSequence = [];
    driver.polyline = [driver.currentPos];
    driver.targetPos = [...driver.currentPos];
    driver.legs = [];
    driver.totalEtaMinutes = 0;
    driver.totalFuelBurnLiters = 0;
    driver.isObstructed = false;
    driver.roadColor = driver.color || '#00f0ff';
    driver.lastUpdated = new Date().toISOString();

    await offlineStore.updateDriver(driver);

    // Update map elements
    updateMiniMapPolyline(driver.id);
    if (state.tacticalPolylines && state.tacticalPolylines[`poly-${driver.id}`]) {
        state.tacticalPolylines[`poly-${driver.id}`].setLatLngs([driver.currentPos]);
        state.tacticalPolylines[`poly-${driver.id}`].closePopup();
    }

    // Remove sequence markers for this driver
    if (state.tacticalSequenceMarkers) {
        Object.keys(state.tacticalSequenceMarkers).forEach(k => {
            if (k.startsWith(`seq-${driver.id}-`)) {
                if (state.tacticalMasterMap) state.tacticalMasterMap.removeLayer(state.tacticalSequenceMarkers[k]);
                delete state.tacticalSequenceMarkers[k];
            }
        });
    }

    if (state.selectedDriverId === driver.id) {
        if (state.driverPolyline) {
            state.driverPolyline.setLatLngs([driver.currentPos]);
        }
        if (state.fullMapPoly) {
            state.fullMapPoly.setLatLngs([driver.currentPos]);
        }
        renderDriverSequenceMarkers(driver);
        updateDriverNavigationHUD(driver);
    }

    audioEngine.triggerCommandAudioBroadcast(`Route vector cleared for Unit #${driver.id} ${driver.name}. Standing by for next dispatch directive.`);
    alert(`❌ Route line for Unit #${driver.id} (${driver.name}) has been cleared.`);
}

function handleOfficerMapClick(lat, lng, optionalName = null) {
    audioEngine.playBeep(850, 0.08);
    state.clickedCoord = [lat, lng];

    const latEl = document.getElementById('dispatch-click-lat');
    const lngEl = document.getElementById('dispatch-click-lng');
    const nameEl = document.getElementById('dispatch-node-name');
    const driverSelect = document.getElementById('dispatch-driver-select');

    if (latEl) latEl.innerText = Number(lat).toFixed(4);
    if (lngEl) lngEl.innerText = Number(lng).toFixed(4);
    if (nameEl) {
        nameEl.value = optionalName || `Emergency Sector (${Number(lat).toFixed(3)}, ${Number(lng).toFixed(3)})`;
    }

    if (driverSelect) {
        driverSelect.innerHTML = `
            <option value="AUTO">⚡ Auto-Assign Optimal Unit via QUBO Solver</option>
            ${state.fleet.map(d => `<option value="${d.id}">Unit #${d.id}: ${d.name} (${d.node} - ${d.job})</option>`).join('')}
        `;
    }

    openModal('dispatch-node-modal');
}

async function executeNodeDispatchAndReroute() {
    audioEngine.playBeep(920, 0.15);
    if (!state.clickedCoord) return;

    const [lat, lng] = state.clickedCoord;
    const nameEl = document.getElementById('dispatch-node-name');
    const urgencyEl = document.getElementById('dispatch-urgency-select');
    const supplyEl = document.getElementById('dispatch-supply-select');
    const driverSelect = document.getElementById('dispatch-driver-select');

    const nodeName = (nameEl ? nameEl.value.trim() : '') || `Emergency Node ${lat.toFixed(3)}`;
    const urgency = urgencyEl ? urgencyEl.value : 'HIGH';
    const supplyType = supplyEl ? supplyEl.value : 'Food Supply';
    const driverVal = driverSelect ? driverSelect.value : 'AUTO';
    const driverId = driverVal === 'AUTO' ? null : parseInt(driverVal);

    closeModal('dispatch-node-modal');

    showBroadcastToast(`⚡ Quantum QUBO routing initiated for "${nodeName}"...`);

    let responseData = null;

    if (state.wsConnected && !state.simulatedOffline) {
        try {
            const res = await fetch(`${CONFIG.API_URL}/nodes/reassign-destination`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nodeName,
                    lat,
                    lng,
                    driverId,
                    supplyType,
                    urgency
                })
            });
            if (res.ok) {
                responseData = await res.json();
            }
        } catch (e) {
            console.warn('API error during node dispatch:', e);
        }
    }

    if (!responseData) {
        let selectedDriver = driverId ? state.fleet.find(d => d.id === driverId) : null;
        if (!selectedDriver) {
            let minDist = Infinity;
            state.fleet.forEach(d => {
                if (!d.crashSensor.isCrashed) {
                    const dist = Math.hypot(d.currentPos[0] - lat, d.currentPos[1] - lng);
                    if (dist < minDist) {
                        minDist = dist;
                        selectedDriver = d;
                    }
                }
            });
        }
        if (!selectedDriver) selectedDriver = state.fleet[0];

        const reroute = quantumEngine.solveOptimalRoute(selectedDriver.currentPos, [lat, lng], false);
        selectedDriver.node = nodeName;
        selectedDriver.nodeLat = lat;
        selectedDriver.nodeLng = lng;
        selectedDriver.targetPos = [lat, lng];
        selectedDriver.polyline = reroute.path;
        selectedDriver.job = supplyType;
        selectedDriver.isRescue = isRescueMission(supplyType);
        selectedDriver.quantumMetrics = {
            hamiltonianEnergy: CONFIG.GROUND_STATE_ENERGY_EV,
            carbonSavedKg: Number((reroute.carbonSavedKg || 16.5).toFixed(2)),
            distanceSavedKm: Number((reroute.distanceSavedKm || 4.8).toFixed(2)),
            qaoaLayers: 4,
            optimalRouteFound: true
        };

        responseData = {
            success: true,
            assignedDriver: selectedDriver,
            quantumMetrics: selectedDriver.quantumMetrics
        };
    } else {
        const assigned = responseData.assignedDriver;
        const idx = state.fleet.findIndex(d => d.id === assigned.id);
        if (idx !== -1) {
            state.fleet[idx] = assigned;
        }
    }

    await offlineStore.saveFleet(state.fleet);

    const driver = responseData.assignedDriver;
    updateDriverCardUI(driver);
    updateMiniMapPolyline(driver.id);
    renderWorkforceList();
    renderTacticalMasterMapLayers();

    audioEngine.triggerCommandAudioBroadcast(`Mission vector updated! Unit #${driver.id} ${driver.name} dispatched to ${nodeName} via QAOA quantum route.`);
    alert(`⚛️ DISPATCH CONFIRMED!\nUnit #${driver.id} (${driver.name}) re-assigned to "${nodeName}".\nQPU Optimization: Ground State E = ${responseData.quantumMetrics.hamiltonianEnergy} eV (Saved ${responseData.quantumMetrics.carbonSavedKg} kg CO₂).`);
}

async function deployNewFieldUnit() {
    audioEngine.playBeep(880, 0.1);
    const name = prompt("Enter New Operative Full Name:", "Kalyan Varma");
    if (!name) return;
    
    let newDriver = null;

    if (state.wsConnected && !state.simulatedOffline) {
        try {
            const res = await fetch(`${CONFIG.API_URL}/fleet/deploy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName: name })
            });
            if (res.ok) {
                const data = await res.json();
                newDriver = data.driver;
            }
        } catch (e) {
            console.warn('Backend deploy error:', e);
        }
    }

    if (!newDriver) {
        const newId = state.fleet.length + 1;
        const locations = (typeof RESCUE_LOCATIONS !== 'undefined' && RESCUE_LOCATIONS.length > 0) ? RESCUE_LOCATIONS : RESCUE_LOCATIONS_6;
        const baseLoc = locations[(newId - 1) % locations.length];
        newDriver = {
            id: newId,
            name: name.split(" ")[0],
            fullName: name,
            username: `DRIVER-${name.replace(/\s+/g, '').toUpperCase()}-${newId}`,
            passcode: '123456',
            job: 'Food Supply',
            isRescue: false,
            node: baseLoc.name,
            nodeLat: baseLoc.lat,
            nodeLng: baseLoc.lng,
            hazardLevel: baseLoc.hazard,
            hazardColor: baseLoc.color,
            rain: baseLoc.rain,
            wind: baseLoc.wind,
            weatherIcon: baseLoc.icon,
            stock: 250,
            maxStock: 500,
            fuel: 20,
            hours: 0,
            salary: 35000,
            deliveredTotal: 0,
            currentPos: [baseLoc.lat, baseLoc.lng],
            targetPos: [baseLoc.lat + 0.005, baseLoc.lng + 0.005],
            polyline: [[baseLoc.lat, baseLoc.lng], [baseLoc.lat + 0.005, baseLoc.lng + 0.005]],
            isObstructed: false,
            crashSensor: { isCrashed: false, gForce: 1.0, tiltAngle: 0, lastTriggered: null },
            quantumMetrics: { hamiltonianEnergy: CONFIG.GROUND_STATE_ENERGY_EV, carbonSavedKg: 15.0, distanceSavedKm: 5.2, qaoaLayers: 4, optimalRouteFound: true },
            lastUpdated: new Date().toISOString()
        };
    }

    state.fleet.push(newDriver);
    await offlineStore.saveFleet(state.fleet);
    renderWorkforceList();
    renderGridCards();
    initMiniMapsGrid();
    renderTacticalMasterMapLayers();
    populateTextDispatchDriverSelect();
    alert(`⚡ Unit #${newDriver.id}: ${newDriver.fullName} deployed to ${newDriver.node} staging bay!`);
}

// ==========================================
// 7B. DYNAMIC DRIVER ONBOARDING & TEXT DISPATCH (SPEC 1 & SPEC 3)
// ==========================================
function openDriverRegistrationModal() {
    audioEngine.playBeep(750, 0.08);
    const nextId = state.fleet.length + 1;
    const nameInput = document.getElementById('reg-driver-fullname');
    const userInput = document.getElementById('reg-driver-username');
    const vehInput = document.getElementById('reg-driver-vehicle-id');

    if (nameInput) nameInput.value = '';
    if (userInput) userInput.value = `DRIVER-OPERATIVE-${nextId}`;
    if (vehInput) vehInput.value = `AP-16-TX-${1000 + nextId}`;

    openModal('driver-registration-modal');
}

async function submitDriverRegistration() {
    audioEngine.playBeep(920, 0.15);
    const fullName = (document.getElementById('reg-driver-fullname').value || '').trim();
    const age = parseInt(document.getElementById('reg-driver-age').value) || 30;
    const salary = parseInt(document.getElementById('reg-driver-salary').value) || 35000;
    const vehicleId = (document.getElementById('reg-driver-vehicle-id').value || '').trim();
    const username = (document.getElementById('reg-driver-username').value || '').trim();
    const passcode = (document.getElementById('reg-driver-passcode').value || '123456').trim();
    const nodeIndex = parseInt(document.getElementById('reg-driver-node').value) || 0;
    const job = document.getElementById('reg-driver-job').value;
    const stock = parseInt(document.getElementById('reg-driver-stock').value) || 250;

    if (!fullName) {
        alert("Please enter driver's full name.");
        return;
    }
    if (!username) {
        alert("Please specify a login username.");
        return;
    }

    let newDriver = null;

    if (state.wsConnected && !state.simulatedOffline) {
        try {
            const res = await fetch(`${CONFIG.API_URL}/fleet/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName,
                    age,
                    salary,
                    vehicleId,
                    username,
                    passcode,
                    nodeIndex,
                    job,
                    stock
                })
            });
            if (res.ok) {
                const data = await res.json();
                newDriver = data.driver;
            }
        } catch (e) {
            console.warn('API error during driver registration:', e);
        }
    }

    if (!newDriver) {
        const locations = (typeof RESCUE_LOCATIONS !== 'undefined' && RESCUE_LOCATIONS.length > 0) ? RESCUE_LOCATIONS : RESCUE_LOCATIONS_6;
        const baseLoc = locations[nodeIndex % locations.length];
        const newId = state.fleet.length + 1;
        const initialSeq = [{
            seq: 1,
            id: baseLoc.id,
            name: baseLoc.name,
            lat: baseLoc.lat,
            lng: baseLoc.lng,
            hazard: baseLoc.hazard,
            rain: baseLoc.rain,
            wind: baseLoc.wind
        }];

        const multiRoute = quantumEngine.solveQuantumMultiNodeRoute([baseLoc.lat, baseLoc.lng], initialSeq, false);

        newDriver = {
            id: newId,
            name: fullName.split(' ')[0],
            fullName,
            age,
            salary,
            vehicleId: vehicleId || `AP-16-TX-${1000 + newId}`,
            username,
            passcode,
            job,
            isRescue: isRescueMission(job),
            node: baseLoc.name,
            nodeLat: baseLoc.lat,
            nodeLng: baseLoc.lng,
            hazardLevel: baseLoc.hazard,
            hazardColor: baseLoc.color,
            rain: baseLoc.rain,
            wind: baseLoc.wind,
            weatherIcon: baseLoc.icon,
            stock,
            maxStock: 500,
            fuel: 22,
            hours: 0,
            deliveredTotal: 0,
            currentPos: [baseLoc.lat, baseLoc.lng],
            targetPos: [baseLoc.lat + 0.005, baseLoc.lng + 0.005],
            polyline: multiRoute.fullPolyline,
            routeSequence: initialSeq,
            legs: multiRoute.legs,
            totalEtaMinutes: multiRoute.totalEtaMinutes,
            totalFuelBurnLiters: multiRoute.totalFuelBurnLiters,
            roadColor: multiRoute.roadColor,
            isObstructed: false,
            crashSensor: { isCrashed: false, gForce: 1.0, tiltAngle: 0, lastTriggered: null },
            quantumMetrics: {
                hamiltonianEnergy: CONFIG.GROUND_STATE_ENERGY_EV,
                carbonSavedKg: 15.0,
                distanceSavedKm: 5.2,
                qaoaLayers: 4,
                optimalRouteFound: true
            },
            lastUpdated: new Date().toISOString()
        };

        await offlineStore.queueOfflineAction({
            type: 'DRIVER_REGISTER',
            driver: newDriver
        });
    }

    state.fleet.push(newDriver);
    await offlineStore.saveFleet(state.fleet);
    closeModal('driver-registration-modal');

    renderWorkforceList();
    renderGridCards();
    initMiniMapsGrid();
    renderTacticalMasterMapLayers();
    populateTextDispatchDriverSelect();

    audioEngine.triggerCommandAudioBroadcast(`Operative ${newDriver.fullName} onboarded. Credentials active for Driver Portal login.`);
    alert(`✅ OPERATIVE ONBOARDING COMPLETE!\n\nDriver: ${newDriver.fullName} (Age: ${newDriver.age})\nVehicle ID: ${newDriver.vehicleId}\nUsername: ${newDriver.username}\nPasscode: ${newDriver.passcode}\nStaging Node: ${newDriver.node}\n\nUnit #${newDriver.id} is live on Officer Command Grid and can immediately log into the Driver Portal!`);
}

function populateTextDispatchDriverSelect() {
    const sel = document.getElementById('text-dispatch-driver-select');
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = `<option value="AUTO">⚡ Auto-Assign (QUBO)</option>` +
        state.fleet.map(d => `<option value="${d.id}">Unit #${d.id}: ${d.name} (${d.node})</option>`).join('');
    if (currentVal) sel.value = currentVal;
}

async function submitTextLocationDispatch() {
    audioEngine.playBeep(920, 0.12);
    const locInput = document.getElementById('text-dispatch-location');
    const driverSelect = document.getElementById('text-dispatch-driver-select');
    const locationName = locInput ? locInput.value.trim() : '';
    if (!locationName) {
        alert("Please enter a location name for emergency node dispatch.");
        return;
    }

    const driverVal = driverSelect ? driverSelect.value : 'AUTO';
    const driverId = driverVal === 'AUTO' ? null : parseInt(driverVal);

    showBroadcastToast(`⚡ Quantum Multi-Node solver dispatching "${locationName}"...`);

    let responseData = null;
    if (state.wsConnected && !state.simulatedOffline) {
        try {
            const res = await fetch(`${CONFIG.API_URL}/nodes/dispatch-text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    locationName,
                    driverId,
                    demand: 120,
                    supplyType: 'Food Supply',
                    urgency: 'HIGH'
                })
            });
            if (res.ok) {
                responseData = await res.json();
            }
        } catch (e) {
            console.warn('API error during text dispatch:', e);
        }
    }

    if (!responseData) {
        // Resilient Offline Local Multi-Node Simulation
        let targetDriver = driverId ? state.fleet.find(d => d.id === driverId) : null;
        if (!targetDriver) {
            targetDriver = state.fleet[0];
        }

        const newStop = {
            id: 100 + (targetDriver.routeSequence ? targetDriver.routeSequence.length : 1),
            seq: (targetDriver.routeSequence ? targetDriver.routeSequence.length : 0) + 1,
            name: locationName,
            lat: targetDriver.targetPos[0] + 0.008,
            lng: targetDriver.targetPos[1] + 0.008,
            demand: 120,
            supplyType: targetDriver.job || 'Food Supply',
            urgency: 'HIGH',
            hazard: 'Moderate Rain Hazard',
            color: '#f59e0b',
            rain: '22mm/h',
            wind: '32 km/h'
        };

        if (!targetDriver.routeSequence) targetDriver.routeSequence = [];
        targetDriver.routeSequence.push(newStop);
        targetDriver.node = locationName;
        targetDriver.nodeLat = newStop.lat;
        targetDriver.nodeLng = newStop.lng;
        targetDriver.targetPos = [newStop.lat, newStop.lng];

        const multiRoute = quantumEngine.solveQuantumMultiNodeRoute(targetDriver.currentPos, targetDriver.routeSequence, targetDriver.isObstructed);
        targetDriver.polyline = multiRoute.fullPolyline;
        targetDriver.legs = multiRoute.legs;
        targetDriver.totalEtaMinutes = multiRoute.totalEtaMinutes;
        targetDriver.totalFuelBurnLiters = multiRoute.totalFuelBurnLiters;
        targetDriver.roadColor = multiRoute.roadColor;

        responseData = {
            success: true,
            driver: targetDriver,
            newStop,
            metrics: {
                totalEtaMinutes: multiRoute.totalEtaMinutes,
                totalFuelBurnLiters: multiRoute.totalFuelBurnLiters,
                totalCarbonSavedKg: multiRoute.totalCarbonSavedKg
            }
        };

        await offlineStore.queueOfflineAction({
            type: 'DISPATCH_TEXT_NODE',
            locationName,
            driverId: targetDriver.id
        });
    } else {
        const assigned = responseData.driver;
        const idx = state.fleet.findIndex(d => d.id === assigned.id);
        if (idx !== -1) {
            state.fleet[idx] = assigned;
        }
    }

    await offlineStore.saveFleet(state.fleet);

    const driver = responseData.driver;
    if (locInput) locInput.value = '';
    updateDriverCardUI(driver);
    updateMiniMapPolyline(driver.id);
    renderWorkforceList();
    renderTacticalMasterMapLayers();

    if (state.selectedDriverId === driver.id && state.driverPolyline) {
        state.driverPolyline.setLatLngs(driver.polyline);
        state.driverPolyline.setStyle({ color: driver.roadColor || '#10b981' });
        renderDriverSequenceMarkers(driver);
        updateDriverNavigationHUD(driver);
    }

    const legCount = driver.routeSequence ? driver.routeSequence.length : 1;
    audioEngine.triggerCommandAudioBroadcast(`New stop ${locationName} added to Unit #${driver.id} route sequence. Total stops: ${legCount}. ETA: ${driver.totalEtaMinutes} minutes.`);
    alert(`📍 LOCATION DISPATCH CONFIRMED!\n"${locationName}" appended as Stop #${legCount} to Unit #${driver.id} (${driver.name}).\nQuantum Multi-Node ETA: ${driver.totalEtaMinutes} mins | Fuel Burn: ${driver.totalFuelBurnLiters}L.`);
}

// ==========================================
// 8. IOT ACCIDENT SENSOR & SOS EMERGENCY
// ==========================================
async function triggerDriverSOS() {
    audioEngine.triggerCommandAudioBroadcast("Warning! Vehicle rollover crash impact detected on Field Unit. Emergency coordinates broadcasted to Command!");
    const driver = state.fleet.find(d => d.id === state.selectedDriverId) || state.fleet[0];
    driver.crashSensor = {
        isCrashed: true,
        gForce: 8.4,
        tiltAngle: 72,
        lastTriggered: new Date().toISOString()
    };

    await offlineStore.updateDriver(driver);

    if (state.wsConnected && !state.simulatedOffline) {
        try {
            await fetch(`${CONFIG.API_URL}/fleet/${driver.id}/sos`, { method: 'POST' });
        } catch (e) {
            await offlineStore.queueOfflineAction({ type: 'SOS_CRASH', driverId: driver.id, gForce: 8.4, tiltAngle: 72 });
        }
    } else {
        await offlineStore.queueOfflineAction({ type: 'SOS_CRASH', driverId: driver.id, gForce: 8.4, tiltAngle: 72 });
    }

    applyEmergencyCrashUI(driver.id, true);
    showEmergencyBanner(driver);
    alert("🚨 EMERGENCY CRASH SENSOR ACTIVATED! Telemetry broadcasted (Impact: 8.4G, Tilt: 72°).");
}

function applyEmergencyCrashUI(driverId, isCrashed) {
    const card = document.getElementById('card-' + driverId);
    const status = document.getElementById('status-' + driverId);
    if (card) {
        if (isCrashed) card.classList.add('emergency-blink');
        else card.classList.remove('emergency-blink');
    }
    if (status) {
        if (isCrashed) {
            status.className = "px-2 py-0.5 bg-red-600 text-white rounded text-[9px] font-extrabold uppercase animate-bounce";
            status.innerText = "SOS CRASH!";
        } else {
            const driver = state.fleet.find(d => d.id === driverId);
            if (driver) updateDriverCardUI(driver);
        }
    }
}

function showEmergencyBanner(driver) {
    const banner = document.getElementById('emergency-sos-banner');
    if (banner) {
        document.getElementById('sos-driver-name').innerText = `${driver.name} (${driver.node})`;
        document.getElementById('sos-driver-coords').innerText = `${driver.currentPos[0]}, ${driver.currentPos[1]} (Impact: ${driver.crashSensor.gForce}G, Roll: ${driver.crashSensor.tiltAngle}°)`;
        banner.classList.remove('hidden');
    }
}

function hideEmergencyBanner() {
    const banner = document.getElementById('emergency-sos-banner');
    if (banner) banner.classList.add('hidden');
}

async function resolveCrashSOS() {
    audioEngine.playBeep(900, 0.1);
    const driver = state.fleet.find(d => d.crashSensor.isCrashed) || state.fleet[0];
    driver.crashSensor = { isCrashed: false, gForce: 1.0, tiltAngle: 0, lastTriggered: null };
    await offlineStore.updateDriver(driver);

    if (state.wsConnected && !state.simulatedOffline) {
        try {
            await fetch(`${CONFIG.API_URL}/fleet/${driver.id}/clear-sos`, { method: 'POST' });
        } catch (e) {}
    }

    applyEmergencyCrashUI(driver.id, false);
    hideEmergencyBanner();
    alert(`Medical & technical interceptor dispatched to ${driver.node}. Crash alert resolved.`);
}

// ==========================================
// 9. ROUTE OBSTRUCTION & QUANTUM DETOUR
// ==========================================
async function triggerRouteBlock() {
    audioEngine.playBeep(440, 0.2);
    alert("⚠️ ROUTE OBSTRUCTION CONFIRMED! Road vector blocked by flood surge. Calculating quantum detour...");
    
    const driver = state.fleet.find(d => d.id === state.selectedDriverId) || state.fleet[0];
    driver.isObstructed = true;

    if (driver.routeSequence && driver.routeSequence.length > 1) {
        const multiResult = quantumEngine.solveQuantumMultiNodeRoute(driver.currentPos, driver.routeSequence, true);
        driver.polyline = multiResult.fullPolyline;
        driver.legs = multiResult.legs;
        driver.totalDistanceKm = multiResult.totalDistanceKm;
        driver.totalFuelBurnLiters = multiResult.totalFuelBurnLiters;
        driver.totalEtaMinutes = multiResult.totalEtaMinutes;
        driver.roadColor = multiResult.roadColor;
    } else {
        const reroute = quantumEngine.solveOptimalRoute(driver.currentPos, driver.targetPos, true);
        driver.polyline = reroute.path;
    }
    driver.fuel += 2.0;
    await offlineStore.updateDriver(driver);

    if (state.wsConnected && !state.simulatedOffline) {
        try {
            await fetch(`${CONFIG.API_URL}/fleet/${driver.id}/obstruction`, { method: 'POST' });
        } catch (e) {}
    }

    if (state.driverPolyline) {
        state.driverPolyline.setLatLngs(driver.polyline);
        state.driverPolyline.setStyle({ color: '#ef4444', dashArray: '6, 6' });
    }
    updateMiniMapPolyline(driver.id);
    updateDriverCardUI(driver);

    // Update navigation cue
    const cueEl = document.getElementById('drv-nav-cue');
    if (cueEl) cueEl.innerText = "DETOUR ENGAGED: Bypassing High Water Inundation via Vector B";
}

/// ==========================================
// 10. DRIVER FIELD CONSOLE WITH NUMBERED SEQUENCES & CLEAN HUD (SPEC 2, 4, 8)
// ==========================================
function updateDriverNavigationHUD(driver) {
    if (state.driverAnimationId) {
        cancelAnimationFrame(state.driverAnimationId);
        state.driverAnimationId = null;
    }

    if (!driver) return;

    if (state.driverMarker && driver.currentPos) {
        state.driverMarker.setLatLng(driver.currentPos);
    }

    const cueEl = document.getElementById('drv-nav-cue');
    if (cueEl) {
        const eta = driver.totalEtaMinutes || 18.5;
        const fuel = driver.totalFuelBurnLiters || 2.8;
        const co2Saved = (driver.quantumMetrics && driver.quantumMetrics.carbonSavedKg) || 16.5;
        const stopsCount = (driver.routeSequence && driver.routeSequence.length) || 1;
        const roadStatus = driver.roadColor === '#ef4444' 
            ? 'HAZARD DETOUR (Red)' 
            : (driver.roadColor === '#f59e0b' ? 'STORM CONGESTION (Orange)' : 'CLEAR VECTOR (Green)');

        cueEl.innerText = `NAV VECTOR ACTIVE: ${stopsCount} Stops | Target: ${driver.node} | ETA: ${eta}m | Fuel: ${fuel}L | CO₂ Saved: ${co2Saved}kg | Road: ${roadStatus}`;
    }
}

// Clean static UI handler for Spec 8
function startDriverMarkerAnimation(driver) {
    updateDriverNavigationHUD(driver);
}

function renderDriverSequenceMarkers(driver) {
    if (!state.driverMap) return;
    if (!state.driverSequenceMarkers) state.driverSequenceMarkers = [];

    // Clear existing sequence markers
    state.driverSequenceMarkers.forEach(m => state.driverMap.removeLayer(m));
    state.driverSequenceMarkers = [];

    const driverColor = driver.color || (typeof DRIVER_COLORS !== 'undefined' ? DRIVER_COLORS[driver.id] : '#00f0ff');
    const polyColor = driver.isObstructed ? '#ef4444' : driverColor;
    const seqList = (driver.routeSequence && driver.routeSequence.length > 0)
        ? driver.routeSequence
        : [{ seq: 1, name: driver.node, lat: driver.targetPos[0], lng: driver.targetPos[1], color: polyColor }];

    seqList.forEach((stop, idx) => {
        const seqNum = stop.seq || (idx + 1);
        const badgeColor = stop.color || driverColor;
        const matchingLeg = (driver.legs && driver.legs.length >= seqNum) ? driver.legs[seqNum - 1] : null;
        const legDist = matchingLeg ? matchingLeg.distanceKm : (stop.distanceKm || '1.80');
        const cumulDist = matchingLeg && matchingLeg.cumulativeDistanceKm ? matchingLeg.cumulativeDistanceKm : (stop.cumulativeDistanceKm || legDist);
        const legFuel = matchingLeg ? matchingLeg.fuelBurnLiters : (stop.fuelBurnLiters || '0.25');
        const cumulFuel = matchingLeg && matchingLeg.cumulativeFuelBurnLiters ? matchingLeg.cumulativeFuelBurnLiters : (stop.cumulativeFuelBurnLiters || legFuel);
        const legEta = matchingLeg ? matchingLeg.etaMinutes : (stop.etaMinutes || '4.5');
        const cumulEta = matchingLeg && matchingLeg.cumulativeEtaMinutes ? matchingLeg.cumulativeEtaMinutes : (stop.cumulativeEtaMinutes || legEta);

        const seqIcon = L.divIcon({
            className: 'node-sequence-marker',
            html: `
                <div class="sequence-badge" style="border-color:${badgeColor}; background:${badgeColor}; box-shadow: 0 0 12px ${badgeColor}">
                    ${seqNum}
                </div>
                <div class="sequence-label">${stop.name || ('Stop #' + seqNum)}</div>
            `,
            iconSize: [44, 44],
            iconAnchor: [22, 22]
        });

        const m = L.marker([stop.lat, stop.lng], { icon: seqIcon, zIndexOffset: 1000 })
            .addTo(state.driverMap)
            .bindPopup(`
                <div class="tactical-popup p-1.5 text-xs font-sans min-w-[210px]">
                    <div class="flex items-center justify-between pb-1 mb-1 border-b border-slate-700">
                        <span class="font-extrabold text-[#00f0ff]">Stop #${seqNum}: ${stop.name || driver.node}</span>
                        <span class="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-[#00f0ff]/20 text-[#00f0ff]">LEG ${seqNum}</span>
                    </div>
                    <p class="text-[10px] text-white">Target Mission: <span class="text-white font-medium">${driver.job}</span></p>
                    <div class="text-[9px] space-y-0.5 text-slate-300 font-mono bg-[#010409] p-1.5 rounded border border-[#30363d] mt-1">
                        <div class="flex justify-between"><span>Leg Distance:</span><span class="text-white font-bold">${legDist} km</span></div>
                        <div class="flex justify-between"><span>Cumulative Dist:</span><span class="text-[#00f0ff] font-bold">${cumulDist} km</span></div>
                        <div class="flex justify-between"><span>Leg Fuel Burn:</span><span class="text-white font-bold">${legFuel} L</span></div>
                        <div class="flex justify-between"><span>Cumulative Fuel:</span><span class="text-amber-400 font-bold">${cumulFuel} L</span></div>
                        <div class="flex justify-between"><span>Leg ETA:</span><span class="text-emerald-400 font-bold">${legEta} min</span></div>
                        <div class="flex justify-between"><span>Cumulative ETA:</span><span class="text-emerald-300 font-bold">${cumulEta} min</span></div>
                    </div>
                </div>
            `);
        state.driverSequenceMarkers.push(m);
    });
}

function initDriverInterface(driver) {
    document.getElementById('drv-profile-name').innerText = `${driver.name} (${driver.node})`;
    document.getElementById('drv-sidebar-name').innerText = driver.fullName || driver.name;
    document.getElementById('drv-sidebar-job').innerText = driver.job;
    document.getElementById('drv-sidebar-hours').innerText = `${driver.hours} Hours`;
    document.getElementById('drv-sidebar-salary').innerText = `₹${driver.salary.toLocaleString()} / mo`;
    
    const initials = driver.name.substring(0, 2).toUpperCase();
    document.getElementById('drv-initials-badge').innerText = initials;
    document.getElementById('drv-side-initials').innerText = initials;

    setTimeout(() => {
        const [lat, lng] = driver.currentPos;
        const [targetLat, targetLng] = driver.targetPos;
        const driverColor = driver.color || (typeof DRIVER_COLORS !== 'undefined' ? DRIVER_COLORS[driver.id] : '#00f0ff');
        const polyColor = driver.isObstructed ? '#ef4444' : driverColor;

        let routeDistKm = driver.totalDistanceKm;
        if (!routeDistKm && driver.polyline && driver.polyline.length > 1) {
            let d = 0;
            for (let i = 0; i < driver.polyline.length - 1; i++) {
                d += Math.hypot(driver.polyline[i+1][0] - driver.polyline[i][0], driver.polyline[i+1][1] - driver.polyline[i][1]) * 111;
            }
            routeDistKm = Number((d * 1.08).toFixed(2));
        }
        const fuelBurnL = driver.totalFuelBurnLiters || Number((routeDistKm * 0.138).toFixed(2));
        const co2SavedKg = Number((routeDistKm * (0.185 - 0.138) * CONFIG.CARBON_COEFF_PER_LITER).toFixed(2));

        const popupContent = `
            <div class="route-popup-card">
                <p class="font-extrabold text-white text-xs mb-1 flex items-center gap-1.5">
                    <span class="driver-color-chip" style="background:${driverColor}; box-shadow: 0 0 6px ${driverColor}"></span>
                    Unit #${driver.id}: ${driver.name} Route
                </p>
                <div class="text-[10px] space-y-0.5 text-slate-300 font-mono my-1.5 bg-[#010409] p-1.5 rounded border border-[#30363d]">
                    <div class="flex justify-between"><span>Distance:</span><span class="text-[#00f0ff] font-bold">${routeDistKm} km</span></div>
                    <div class="flex justify-between"><span>Fuel Burn Req:</span><span class="text-amber-400 font-bold">${fuelBurnL} L</span></div>
                    <div class="flex justify-between"><span>Carbon Saved:</span><span class="text-emerald-400 font-bold">${co2SavedKg} kg CO₂</span></div>
                </div>
                <button onclick="clearDriverRoute(${driver.id})" class="route-clear-btn">
                    <i class="fa-solid fa-xmark"></i> Clear Route
                </button>
            </div>
        `;

        const beaconIcon = L.divIcon({
            className: 'vehicle-beacon-wrapper',
            html: `
                <div class="vehicle-beacon-container">
                    <div class="vehicle-beacon-pulse" style="background: ${driverColor}40"></div>
                    <div class="vehicle-beacon-dot" style="background: ${driverColor}; box-shadow: 0 0 10px ${driverColor}"></div>
                    <div class="vehicle-beacon-truck">🚚</div>
                </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });

        if (!state.driverMap) {
            state.driverMap = L.map('driver-map', { zoomControl: false }).setView([lat, lng], 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(state.driverMap);

            // Static high-contrast vehicle marker
            state.driverMarker = L.marker([lat, lng], { icon: beaconIcon })
                .addTo(state.driverMap)
                .bindPopup(`<b>${driver.name}</b><br>${driver.node}`);

            // Dynamic color polyline
            state.driverPolyline = L.polyline(driver.polyline || [[lat, lng], [targetLat, targetLng]], {
                color: polyColor,
                weight: 5,
                opacity: 0.95,
                dashArray: driver.isObstructed ? '6, 6' : null
            }).addTo(state.driverMap);
            state.driverPolyline.bindPopup(popupContent);
        } else {
            state.driverMap.setView([lat, lng], 14);
            state.driverMarker.setLatLng([lat, lng]);
            state.driverMarker.setIcon(beaconIcon);
            state.driverPolyline.setLatLngs(driver.polyline);
            state.driverPolyline.setStyle({
                color: polyColor,
                dashArray: driver.isObstructed ? '6, 6' : null
            });
            state.driverPolyline.setPopupContent(popupContent);
            state.driverMap.invalidateSize();
        }

        // Render numbered sequence badges above stops
        renderDriverSequenceMarkers(driver);

        // Render mission legs list in driver sidebar & floating drawer
        renderDriverLegsList(driver);

        // Update clean navigation HUD telemetry
        updateDriverNavigationHUD(driver);
    }, 250);
}

function pressNum(n) {
    audioEngine.playBeep(950, 0.05);
    const inp = document.getElementById('calc-input');
    if (inp.value === '200' || inp.value === '0') inp.value = n;
    else inp.value += n;
}

function clearInput() {
    audioEngine.playBeep(450, 0.08);
    document.getElementById('calc-input').value = '0';
}

async function confirmStock() {
    audioEngine.playBeep(880, 0.12);
    const val = parseInt(document.getElementById('calc-input').value) || 0;
    const driver = state.fleet.find(d => d.id === state.selectedDriverId) || state.fleet[0];

    if (driver.isRescue) {
        alert(`Recorded ${val} rescued citizens transferred to safe shelter.`);
        closeModal('calc-modal');
        return;
    }

    if (val > driver.stock) {
        alert(`Delivered count (${val}) exceeds vehicle stock (${driver.stock} units).`);
        return;
    }

    driver.stock = Math.max(0, driver.stock - val);
    driver.deliveredTotal += val;
    driver.lastUpdated = new Date().toISOString();

    await offlineStore.updateDriver(driver);

    if (state.wsConnected && !state.simulatedOffline) {
        try {
            await fetch(`${CONFIG.API_URL}/fleet/${driver.id}/stock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deliveredUnits: val })
            });
        } catch (e) {
            await offlineStore.queueOfflineAction({ type: 'STOCK_DELIVERY', driverId: driver.id, amount: val });
        }
    } else {
        await offlineStore.queueOfflineAction({ type: 'STOCK_DELIVERY', driverId: driver.id, amount: val });
    }

    closeModal('calc-modal');
    alert(`Stock delivery recorded: ${val} packages. Remaining: ${driver.stock} units.`);

    if (driver.stock === 0 && !driver.isRescue) {
        setTimeout(() => triggerRestockPrompt(driver), 500);
    }
}

function triggerRestockPrompt(driver) {
    audioEngine.playBeep(500, 0.2);
    document.getElementById('restock-driver-name').innerText = `${driver.name} (${driver.node})`;
    openModal('restock-modal');
}

async function executeRestockVerification() {
    audioEngine.playBeep(880, 0.15);
    const driver = state.fleet.find(d => d.id === state.selectedDriverId) || state.fleet[0];
    const hub = document.getElementById('restock-hub-select').value;
    const pin = document.getElementById('restock-pin').value;

    if (!pin) {
        alert("Please enter Depot Authorization PIN.");
        return;
    }

    driver.stock = 250;
    driver.lastUpdated = new Date().toISOString();
    await offlineStore.updateDriver(driver);

    if (state.wsConnected && !state.simulatedOffline) {
        try {
            await fetch(`${CONFIG.API_URL}/fleet/${driver.id}/restock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hubCode: hub, units: 250 })
            });
        } catch (e) {
            await offlineStore.queueOfflineAction({ type: 'RESTOCK', driverId: driver.id, units: 250 });
        }
    } else {
        await offlineStore.queueOfflineAction({ type: 'RESTOCK', driverId: driver.id, units: 250 });
    }

    closeModal('restock-modal');
    alert(`Restock verified from ${hub}! +250 units loaded.`);
}

// ==========================================
// 11. DAILY SHIFT SUMMARY REPORT
// ==========================================
async function generateDailyShiftSummary() {
    audioEngine.playBeep(880, 0.1);
    
    let reportData = null;
    try {
        const res = await fetch(`${CONFIG.API_URL}/report/shift-summary`);
        if (res.ok) reportData = await res.json();
    } catch (e) {}

    if (!reportData) {
        const totalHours = state.fleet.reduce((acc, d) => acc + d.hours, 0);
        const totalFuelBurned = state.fleet.reduce((acc, d) => acc + d.fuel, 0);
        const totalPackagesDelivered = state.fleet.reduce((acc, d) => acc + d.deliveredTotal, 0);
        const totalCO2Emitted = Number((totalFuelBurned * CONFIG.CARBON_COEFF_PER_LITER).toFixed(2));
        const classicalEstFuel = Number((totalFuelBurned * 1.28).toFixed(1));
        const classicalCO2Emitted = Number((classicalEstFuel * CONFIG.CARBON_COEFF_PER_LITER).toFixed(2));
        const co2Saved = Number((classicalCO2Emitted - totalCO2Emitted).toFixed(2));
        const savingsPercent = Number(((co2Saved / classicalCO2Emitted) * 100).toFixed(1));

        reportData = {
            reportId: 'QR-10NODE-AUDIT-' + Date.now().toString(36).toUpperCase(),
            generatedAt: new Date().toLocaleString(),
            officerInCharge: CONFIG.OFFICER_NAME,
            officerId: CONFIG.GOV_OFFICER_ID,
            kpis: {
                totalUnits: state.fleet.length,
                totalNodes: 10,
                groundStateEnergy: `${CONFIG.GROUND_STATE_ENERGY_EV} eV`,
                totalHours,
                totalFuelBurned,
                totalPackagesDelivered,
                totalCO2EmittedKg: totalCO2Emitted,
                classicalCO2EmittedKg: classicalCO2Emitted,
                co2SavedKg: co2Saved,
                savingsPercent
            },
            unitBreakdown: state.fleet.map(d => ({
                id: d.id,
                name: d.name,
                node: d.node,
                role: d.job,
                hoursWorked: d.hours,
                fuelBurnedLiters: d.fuel,
                carbonEmittedKg: Number((d.fuel * CONFIG.CARBON_COEFF_PER_LITER).toFixed(2)),
                packagesDelivered: d.deliveredTotal,
                status: d.crashSensor.isCrashed ? 'CRASH_SOS' : d.isObstructed ? 'OBSTRUCTED' : 'ONLINE'
            }))
        };
    }

    renderReportModal(reportData);
}

function renderReportModal(report) {
    document.getElementById('rep-id').innerText = report.reportId;
    document.getElementById('rep-officer').innerText = `${report.officerInCharge} (${report.officerId})`;
    document.getElementById('rep-hours').innerText = `${report.kpis.totalHours} hrs`;
    document.getElementById('rep-fuel').innerText = `${report.kpis.totalFuelBurned} Liters`;
    document.getElementById('rep-packages').innerText = `${report.kpis.totalPackagesDelivered} units`;
    document.getElementById('rep-co2').innerText = `${report.kpis.totalCO2EmittedKg} kg`;
    document.getElementById('rep-saved').innerText = `${report.kpis.co2SavedKg} kg (${report.kpis.savingsPercent}% QAOA saved)`;

    const tbody = document.getElementById('rep-table-body');
    tbody.innerHTML = report.unitBreakdown.map(u => `
        <tr class="border-b border-[#30363d] hover:bg-[#161b22]/50 text-[10px]">
            <td class="p-2 text-white font-bold">#${u.id} ${u.name}</td>
            <td class="p-2 text-amber-400 truncate max-w-[140px]">${u.node}</td>
            <td class="p-2 text-[#00f0ff]">${u.role}</td>
            <td class="p-2 text-right">${u.hoursWorked}h</td>
            <td class="p-2 text-right text-amber-400">${u.fuelBurnedLiters}L</td>
            <td class="p-2 text-right text-emerald-400">${u.packagesDelivered}</td>
            <td class="p-2 text-right">${u.carbonEmittedKg} kg</td>
            <td class="p-2 text-center">
                <span class="px-1.5 py-0.5 rounded text-[8px] font-bold ${u.status === 'CRASH_SOS' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}">${u.status}</span>
            </td>
        </tr>
    `).join('');

    openModal('shift-report-modal');
}

function exportReportCSV() {
    let csv = "Unit ID,Operative Name,Assigned Rescue Node,Role,Hours Worked,Fuel Burned (L),Packages Delivered,Carbon Emitted (kg CO2),Status\n";
    state.fleet.forEach(d => {
        csv += `${d.id},"${d.name}","${d.node}","${d.job}",${d.hours},${d.fuel},${d.deliveredTotal},${(d.fuel * CONFIG.CARBON_COEFF_PER_LITER).toFixed(2)},${d.crashSensor.isCrashed ? 'CRASH' : 'ONLINE'}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QuantumRoute_10Node_Audit_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// ==========================================
// 12. AUDIO EMERGENCY BROADCASTS
// ==========================================
function triggerOfficerAudioBroadcast() {
    openModal('broadcast-directive-modal');
}

async function sendOfficerBroadcastDirective() {
    const text = document.getElementById('broadcast-text-input').value.trim();
    if (!text) {
        alert("Please enter directive text.");
        return;
    }

    audioEngine.triggerCommandAudioBroadcast(text);

    if (state.wsConnected && !state.simulatedOffline) {
        try {
            await fetch(`${CONFIG.API_URL}/broadcast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ directive: text })
            });
        } catch (e) {}
    }

    closeModal('broadcast-directive-modal');
    alert("Audio emergency siren and synthesized voice directive dispatched to all active units!");
}

function showBroadcastToast(text) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-5 right-5 z-[999999] bg-red-600/90 text-white p-4 rounded-xl border border-white/20 shadow-2xl max-w-sm animate-bounce';
    toast.innerHTML = `
        <div class="flex items-center space-x-2 font-bold text-xs uppercase mb-1">
            <i class="fa-solid fa-bullhorn text-sm"></i>
            <span>Emergency Broadcast Alert</span>
        </div>
        <p class="text-[11px] font-medium">${text}</p>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 7000);
}

// ==========================================
// 13. UI CONTROLS & SIDEBARS
// ==========================================
function toggleOfficerSidebar() {
    audioEngine.playBeep(600, 0.05);
    const sidebar = document.getElementById('officer-sidebar');
    const overlay = document.getElementById('officer-sidebar-overlay');
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
}

function toggleDriverSidebar() {
    audioEngine.playBeep(600, 0.05);
    const sidebar = document.getElementById('driver-sidebar');
    const overlay = document.getElementById('driver-sidebar-overlay');
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
}

function toggleExpandedDriverSidebar() {
    audioEngine.playBeep(600, 0.05);
    const sidebar = document.getElementById('expanded-driver-sidebar');
    const overlay = document.getElementById('expanded-sidebar-overlay');
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
}

function openModal(id) {
    audioEngine.playBeep(700, 0.05);
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('hidden');
        el.classList.add('flex');
    }
}

function closeModal(id) {
    audioEngine.playBeep(500, 0.05);
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('flex');
        el.classList.add('hidden');
    }
}

function toggleSimulateOffline() {
    const isNowOffline = offlineStore.toggleSimulateOffline();
    state.simulatedOffline = isNowOffline;
    audioEngine.playBeep(isNowOffline ? 400 : 800, 0.1);
    const btn = document.getElementById('simulate-offline-btn');
    if (btn) {
        if (isNowOffline) {
            btn.className = "px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-xl font-bold flex items-center text-[10px] uppercase";
            btn.innerHTML = `<i class="fa-solid fa-plane-arrival mr-1.5"></i> Simulated Offline: ACTIVE`;
            if (state.ws) state.ws.close();
        } else {
            btn.className = "px-3 py-1 bg-[#161b22] hover:bg-[#21262d] text-slate-300 border border-[#30363d] rounded-xl font-semibold flex items-center text-[10px] uppercase";
            btn.innerHTML = `<i class="fa-solid fa-wifi mr-1.5"></i> Toggle Offline Simulation`;
            connectWebSocket();
        }
    }
}

// ==========================================
// 12. WINDOW EXPOSURES & INTERACTIVE BINDING
// ==========================================
window.switchAuthTab = switchAuthTab;
window.loginAsOfficer = loginAsOfficer;
window.loginAsDriver = loginAsDriver;
window.runLandingQuboSolver = runLandingQuboSolver;
window.toggleOfficerSidebar = toggleOfficerSidebar;
window.toggleDriverSidebar = toggleDriverSidebar;
window.toggleExpandedDriverSidebar = toggleExpandedDriverSidebar;
window.toggleOfficerTacticalMap = toggleOfficerTacticalMap;
window.toggleOfficerQuantumPanel = toggleOfficerQuantumPanel;
window.toggleSimulateOffline = toggleSimulateOffline;
window.runQuantumOptimization = runQuantumOptimization;
window.generateDailyShiftSummary = generateDailyShiftSummary;
window.triggerOfficerAudioBroadcast = triggerOfficerAudioBroadcast;
window.sendOfficerBroadcastDirective = sendOfficerBroadcastDirective;
window.submitTextLocationDispatch = submitTextLocationDispatch;
window.openDriverRegistrationModal = openDriverRegistrationModal;
window.submitDriverRegistration = submitDriverRegistration;
window.deployNewFieldUnit = deployNewFieldUnit;
window.openModal = openModal;
window.closeModal = closeModal;
window.filterUnits = filterUnits;
window.expandDriverMap = expandDriverMap;
window.backToGrid = backToGrid;
window.openRoleAssignmentModal = openRoleAssignmentModal;
window.confirmRoleAssignment = confirmRoleAssignment;
window.executeRestockVerification = executeRestockVerification;
window.resolveCrashSOS = resolveCrashSOS;
window.triggerRouteBlock = triggerRouteBlock;
window.triggerDriverSOS = triggerDriverSOS;
window.pressNum = pressNum;
window.clearInput = clearInput;
window.confirmStock = confirmStock;
window.exportReportCSV = exportReportCSV;
window.executeNodeDispatchAndReroute = executeNodeDispatchAndReroute;
window.clearDriverRoute = clearDriverRoute;
window.toggleDriverLegsDrawer = toggleDriverLegsDrawer;
window.renderDriverLegsList = renderDriverLegsList;
window.bindAllEventHandlers = bindAllEventHandlers;

// Immediate bind check if DOM is already ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    bindAllEventHandlers();
}
