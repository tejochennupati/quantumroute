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
    simulatedOffline: false,
    driverMapOrientation: 'NORTH_UP',
    driverHitPolyline: null,
    pendingUnreachableTarget: null,
    systemAlerts: [],
    multiNodeSelectionMode: false,
    pendingMissionNodes: [],
    pendingMissionMarkers: {}
};
window.state = state;

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
            if (data.legs) driver.legs = data.legs;
            if (data.driver) Object.assign(driver, data.driver);
            driver.roadColor = '#ef4444';
            updateMiniMapPolyline(driver.id);
            updateDriverCardUI(driver);
            renderTacticalMasterMapLayers();
            if (state.selectedDriverId === driver.id) {
                if (state.fullMap) expandDriverMap(driver.id);
                if (state.driverPolyline) {
                    state.driverPolyline.setLatLngs(driver.polyline);
                    state.driverPolyline.setStyle({ color: '#ef4444', dashArray: '8, 12' });
                }
                updateDriverNavigationHUD(driver);
            }
            if (state.user && state.user.role === 'DRIVER' && state.user.id === driver.id) {
                initDriverInterface(driver);
            }
        }
    } else if (data.type === 'ROUTE_OBSTRUCTION_CLEARED') {
        const driver = state.fleet.find(d => d.id === data.driverId);
        if (driver) {
            driver.isObstructed = false;
            if (data.polyline) driver.polyline = data.polyline;
            if (data.legs) driver.legs = data.legs;
            if (data.driver) Object.assign(driver, data.driver);
            driver.roadColor = driver.color || '#00f0ff';
            updateMiniMapPolyline(driver.id);
            updateDriverCardUI(driver);
            renderTacticalMasterMapLayers();
            if (state.selectedDriverId === driver.id) {
                if (state.fullMap) expandDriverMap(driver.id);
                if (state.driverPolyline) {
                    state.driverPolyline.setStyle({ color: driver.color || '#00f0ff', dashArray: '8, 12' });
                }
                updateDriverNavigationHUD(driver);
            }
            if (state.user && state.user.role === 'DRIVER' && state.user.id === driver.id) {
                initDriverInterface(driver);
            }
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
    } else if (data.type === 'MISSION_ASSIGNED') {
        const dId = data.driverId || (data.driver && data.driver.id);
        const driver = state.fleet.find(d => d.id === dId);
        if (driver) {
            if (data.driver) Object.assign(driver, data.driver);
            if (data.routeSequence) driver.routeSequence = data.routeSequence;
            if (data.polyline) driver.polyline = data.polyline;
            if (data.legs) driver.legs = data.legs;
            if (data.totalDistanceKm !== undefined) driver.totalDistanceKm = data.totalDistanceKm;
            if (data.totalEtaMinutes !== undefined) driver.totalEtaMinutes = data.totalEtaMinutes;
            if (data.totalFuelBurnLiters !== undefined) driver.totalFuelBurnLiters = data.totalFuelBurnLiters;
            if (data.roadColor) driver.roadColor = data.roadColor;
            if (data.node) driver.node = data.node;
            if (data.targetPos) driver.targetPos = data.targetPos;

            offlineStore.saveFleet(state.fleet);
            updateDriverCardUI(driver);
            updateMiniMapPolyline(driver.id);
            renderTacticalMasterMapLayers();

            if (state.selectedDriverId === driver.id) {
                if (state.driverPolyline) {
                    state.driverPolyline.setLatLngs(driver.polyline);
                    state.driverPolyline.setStyle({ color: driver.roadColor || '#10b981' });
                }
                renderDriverSequenceMarkers(driver);
                updateDriverNavigationHUD(driver);
                renderDriverLegsList(driver);
            }
            if (state.user && state.user.role === 'DRIVER' && state.user.id === driver.id) {
                initDriverInterface(driver);
            }
            updateTurnByTurnNavBanner(driver);
            audioEngine.playBeep(980, 0.2);
            showBroadcastToast(`⚡ Mission Assigned: Unit #${driver.id} (${driver.name}) deployed with ${driver.routeSequence ? driver.routeSequence.length : 1} quantum stops.`);
        }
    } else if (data.type === 'ROUTE_SEQUENCE_UPDATED') {
        const dId = data.driverId || (data.driver && data.driver.id);
        const driver = state.fleet.find(d => d.id === dId);
        if (driver) {
            if (data.driver) {
                Object.assign(driver, data.driver);
            }
            if (data.routeSequence) driver.routeSequence = data.routeSequence;
            if (data.polyline) driver.polyline = data.polyline;
            if (data.legs) driver.legs = data.legs;
            if (data.totalEtaMinutes !== undefined) driver.totalEtaMinutes = data.totalEtaMinutes;
            if (data.totalFuelBurnLiters !== undefined) driver.totalFuelBurnLiters = data.totalFuelBurnLiters;
            if (data.roadColor) driver.roadColor = data.roadColor;
            if (data.targetNodeName) driver.node = data.targetNodeName;

            updateDriverCardUI(driver);
            updateMiniMapPolyline(driver.id);
            if (state.selectedDriverId === driver.id && state.driverPolyline) {
                state.driverPolyline.setLatLngs(driver.polyline);
                state.driverPolyline.setStyle({ color: driver.roadColor || '#10b981' });
                renderDriverSequenceMarkers(driver);
                updateDriverNavigationHUD(driver);
            }
            if (state.user && state.user.role === 'DRIVER' && state.user.id === driver.id) {
                initDriverInterface(driver);
            }
            updateTurnByTurnNavBanner(driver);
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
    } else if (data.type === 'STOP_CLEARED') {
        const driver = state.fleet.find(d => d.id === data.driverId);
        if (driver) {
            Object.assign(driver, data.driver);
            offlineStore.saveFleet(state.fleet);
            updateDriverCardUI(driver);
            updateMiniMapPolyline(driver.id);
            if (state.selectedDriverId === driver.id) {
                populateExpandedSidebar(driver);
                renderDriverSequenceMarkers(driver);
                updateDriverNavigationHUD(driver);
                renderDriverLegsList(driver);
            }
            if (state.user && state.user.role === 'DRIVER' && state.user.id === driver.id) {
                initDriverInterface(driver);
            }
            updateTurnByTurnNavBanner(driver);
            renderTacticalMasterMapLayers();
            audioEngine.playBeep(880, 0.15);
            showBroadcastToast(`Operative ${driver.name} reached and cleared stop! Next vector engaged.`);
        }
    } else if (data.type === 'AUDIO_EMERGENCY_BROADCAST') {
        audioEngine.triggerCommandAudioBroadcast(data.directive);
        showBroadcastToast(data.directive);
    } else if (data.type === 'VEHICLE_TELEMETRY_UPDATE') {
        const driver = state.fleet.find(d => d.id === data.driverId);
        if (driver) {
            driver.currentPos = data.currentPos;
            driver.speed = data.speed;
            driver.fuelBurnRate = data.fuelBurnRate;
            driver.heading = data.heading;
            if (data.crashSensor) driver.crashSensor = data.crashSensor;
            driver.lastUpdated = data.timestamp || new Date().toISOString();

            updateTacticalDriverMarker(driver);
            updateMiniMapPolyline(driver.id);
            if (state.selectedDriverId === driver.id) {
                if (state.fullMapMarker) state.fullMapMarker.setLatLng(driver.currentPos);
                updateTurnByTurnNavBanner(driver);
            }
            if (state.user && state.user.role === 'DRIVER' && state.user.id === driver.id) {
                if (state.driverMarker) {
                    state.driverMarker.setLatLng(driver.currentPos);
                }
                updateTurnByTurnNavBanner(driver);
                if (state.driverMapOrientation === 'DIRECTION_UP') {
                    applyDriverMapOrientation();
                }
            }

            document.querySelectorAll(`.heading-arrow-${driver.id}`).forEach(el => {
                if (driver.heading !== undefined) {
                    el.style.transform = `rotate(${driver.heading}deg)`;
                }
            });
        }
    } else if (data.type === 'DESTINATION_UNREACHABLE_REPORT' || data.type === 'SYSTEM_ALERT_CREATED') {
        // STRICT ROLE ISOLATION: Emergency alerts are strictly for Command Officers
        if (!state.user || state.user.role !== 'OFFICER') {
            console.warn('⛔ [Alert Guard] Suppressed officer emergency alert on non-officer client');
            return;
        }
        if (typeof fetchAndRenderOfficerAlerts === 'function') {
            fetchAndRenderOfficerAlerts();
        }
        audioEngine.playBeep(450, 0.3);
        const report = data.alert || data.report;
        if (report) {
            showBroadcastToast(`⚠️ HIGH PRIORITY: ${report.driverName} reported Destination "${report.destinationNode}" UNREACHABLE! (${report.reason})`);
        }
    } else if (data.type === 'SYSTEM_ALERT_ACKNOWLEDGED') {
        // STRICT ROLE ISOLATION: Alert acknowledgments are strictly for Command Officers
        if (!state.user || state.user.role !== 'OFFICER') {
            return;
        }
        if (typeof fetchAndRenderOfficerAlerts === 'function') {
            fetchAndRenderOfficerAlerts();
        }
    }
}

async function fetchFleetFromBackend() {
    try {
        const res = await fetch(`${CONFIG.API_URL}/fleet`);
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
            state.user = { role: 'OFFICER', id: data.officerId, name: data.name, token: data.token };
            state.officerToken = data.token;
        } else {
            state.user = { role: 'OFFICER', id: CONFIG.GOV_OFFICER_ID, name: CONFIG.OFFICER_NAME, token: 'QUANTUM-ALPHA-2026-TEJO-COMMAND' };
            state.officerToken = 'QUANTUM-ALPHA-2026-TEJO-COMMAND';
        }
    } catch (e) {
        state.user = { role: 'OFFICER', id: CONFIG.GOV_OFFICER_ID, name: CONFIG.OFFICER_NAME, token: 'QUANTUM-ALPHA-2026-TEJO-COMMAND' };
        state.officerToken = 'QUANTUM-ALPHA-2026-TEJO-COMMAND';
    }

    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-officer').classList.remove('hidden');
    document.getElementById('app-driver').classList.add('hidden');

    renderWorkforceList();
    initMiniMapsGrid();
    populateTextDispatchDriverSelect();
    fetchAndRenderOfficerAlerts();
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
    state.systemAlerts = [];
    const officerAlertsEl = document.getElementById('officer-persistent-alerts');
    if (officerAlertsEl) officerAlertsEl.innerHTML = '';
    const officerSosBanner = document.getElementById('emergency-sos-banner');
    if (officerSosBanner) officerSosBanner.classList.add('hidden');
    document.querySelectorAll('.fixed.bottom-5.right-5, .broadcast-toast, [id^="toast-"]').forEach(t => t.remove());

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

// 10 Pastel Tint Palettes for Completed Route Segments (Spec 2)
const DRIVER_PASTEL_COLORS = {
    1: '#67e8f9',  // Unit 1 (Cyan pastel)
    2: '#fde047',  // Unit 2 (Yellow pastel)
    3: '#d8b4fe',  // Unit 3 (Purple pastel)
    4: '#86efac',  // Unit 4 (Lime green pastel)
    5: '#fdba74',  // Unit 5 (Orange pastel)
    6: '#f472b6',  // Unit 6 (Hot pink pastel)
    7: '#99f6e4',  // Unit 7 (Turquoise pastel)
    8: '#fca5a5',  // Unit 8 (Coral pastel)
    9: '#f0abfc',  // Unit 9 (Magenta pastel)
    10: '#a7f3d0'  // Unit 10 (Spring green pastel)
};

function getDriverPastelColor(color, driverId) {
    if (driverId && DRIVER_PASTEL_COLORS[driverId]) {
        return DRIVER_PASTEL_COLORS[driverId];
    }
    return '#94a3b8';
}

// ==========================================
// 1.2 WHATSAPP-STYLE LIVE PROFILE MARKER & HEADING (SPEC 1)
// ==========================================
function calculateHeading(fromCoord, toCoord) {
    if (!fromCoord || !toCoord) return 0;
    const lat1 = fromCoord[0] * Math.PI / 180;
    const lat2 = toCoord[0] * Math.PI / 180;
    const dLng = (toCoord[1] - fromCoord[1]) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const deg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    return Math.round(deg);
}

function calculateRoadHeading(driver) {
    if (!driver || !driver.currentPos) return 0;
    if (driver.heading !== undefined && driver.heading !== null) {
        return driver.heading;
    }
    // Compute heading toward the immediate next road point in polyline or next active node
    if (driver.polyline && driver.polyline.length > 1) {
        let nearestIdx = 0;
        let minDist = Infinity;
        for (let i = 0; i < driver.polyline.length; i++) {
            const d = Math.hypot(driver.polyline[i][0] - driver.currentPos[0], driver.polyline[i][1] - driver.currentPos[1]);
            if (d < minDist) {
                minDist = d;
                nearestIdx = i;
            }
        }
        if (nearestIdx < driver.polyline.length - 1) {
            return calculateHeading(driver.currentPos, driver.polyline[nearestIdx + 1]);
        }
    }
    const nextStop = (driver.routeSequence && driver.routeSequence.find(s => s.status !== 'COMPLETED')) || { lat: driver.targetPos[0], lng: driver.targetPos[1] };
    if (nextStop && nextStop.lat) {
        return calculateHeading(driver.currentPos, [nextStop.lat, nextStop.lng]);
    }
    return 0;
}

function createLiveProfileMarkerIcon(driver, headingDeg = null) {
    const color = driver.color || (typeof DRIVER_COLORS !== 'undefined' ? DRIVER_COLORS[driver.id] : '#00f0ff');
    const initials = (driver.name || 'Unit').substring(0, 2).toUpperCase();
    
    let heading = headingDeg;
    if (heading === null || heading === undefined) {
        heading = calculateRoadHeading(driver);
    }

    return L.divIcon({
        className: 'whatsapp-live-marker-wrapper',
        html: `
            <div class="whatsapp-live-beacon" id="beacon-${driver.id}">
                <div class="whatsapp-heading-arrow heading-arrow-${driver.id}" id="heading-arrow-${driver.id}" style="transform: rotate(${heading}deg);">
                    <div class="whatsapp-arrow-tip" style="border-bottom-color: ${color}; color: ${color}; filter: drop-shadow(0 0 6px ${color});"></div>
                </div>
                <div class="whatsapp-avatar-frame" style="border-color: ${color}; box-shadow: 0 0 14px ${color}80;">
                    <span>${initials}</span>
                    <span class="whatsapp-unit-badge" style="color: ${color}; border-color: ${color};">#${driver.id}</span>
                </div>
                <div class="whatsapp-live-pulse" style="border-color: ${color};"></div>
            </div>
        `,
        iconSize: [46, 46],
        iconAnchor: [23, 23]
    });
}

function updateTacticalDriverMarker(driver) {
    if (!state.tacticalMasterMap) return;
    const driverKey = `driver-${driver.id}`;
    let marker = state.tacticalMarkers[driverKey];
    const heading = (driver.heading !== undefined) ? driver.heading : calculateRoadHeading(driver);

    if (marker && driver.currentPos) {
        marker.setLatLng(driver.currentPos);
    } else if (!marker && driver.currentPos) {
        const truckBeacon = createLiveProfileMarkerIcon(driver, heading);
        marker = L.marker(driver.currentPos, { icon: truckBeacon }).addTo(state.tacticalMasterMap);
        marker.on('click', () => {
            state.selectedDriverId = driver.id;
            updateTurnByTurnNavBanner(driver);
        });
        state.tacticalMarkers[driverKey] = marker;
    }

    // Update all matching heading arrows directly
    document.querySelectorAll(`.heading-arrow-${driver.id}`).forEach(el => {
        el.style.transform = `rotate(${heading}deg)`;
    });

    // Update tactical map polyline segments in-place
    const polyKey = `poly-${driver.id}`;
    const compPolyKey = `poly-${driver.id}-completed`;
    const { completedCoords, activeCoords } = splitRouteSegments(driver);

    if (state.tacticalPolylines && state.tacticalPolylines[polyKey]) {
        state.tacticalPolylines[polyKey].setLatLngs(activeCoords.length > 0 ? activeCoords : (driver.polyline || []));
    }
    if (state.tacticalPolylines && state.tacticalPolylines[compPolyKey]) {
        state.tacticalPolylines[compPolyKey].setLatLngs(completedCoords);
    }

    if (state.selectedDriverId === driver.id) {
        updateTurnByTurnNavBanner(driver);
    }
}

// ==========================================
// 1.3 GOOGLE MAPS-STYLE TURN-BY-TURN DIRECTIONS (SPEC 2 & SPEC 4)
// ==========================================
function computeTurnByTurnInstructions(driver) {
    if (!driver) return {
        icon: 'fa-diamond-turn-right',
        distanceText: '0 m',
        instruction: 'Standby for Dispatch Directive',
        subInstruction: 'Awaiting route allocation from Command Center',
        etaMinutes: 0,
        distanceKm: 0,
        maneuverType: 'STANDBY',
        totalStops: 1,
        completedStops: 0,
        remainingStops: 1,
        seqNum: 1
    };

    const routeSeq = driver.routeSequence || [];
    const totalStops = routeSeq.length || 1;
    const completedStops = routeSeq.filter(s => s.status === 'COMPLETED').length;
    const activeStop = routeSeq.find(s => s.status !== 'COMPLETED') || routeSeq[0];
    const seqNum = activeStop ? (activeStop.seq || (completedStops + 1)) : 1;
    const remainingStops = Math.max(0, totalStops - completedStops);
    const targetName = (activeStop && activeStop.name) ? activeStop.name : (driver.node || 'Target Emergency Sector');

    // Active leg or full polyline forward from current vehicle position
    const activeLeg = (driver.legs && driver.legs.find(l => l.status !== 'COMPLETED')) || (driver.legs && driver.legs[0]);
    const legPath = (activeLeg && activeLeg.path && activeLeg.path.length > 1) 
        ? activeLeg.path 
        : (driver.polyline && driver.polyline.length > 1 ? driver.polyline : []);

    // Find nearest point index on active path to driver's current position
    let currIdx = 0;
    if (driver.currentPos && legPath.length > 1) {
        let minDist = Infinity;
        for (let p = 0; p < legPath.length; p++) {
            const d = Math.hypot(legPath[p][0] - driver.currentPos[0], legPath[p][1] - driver.currentPos[1]);
            if (d < minDist) {
                minDist = d;
                currIdx = p;
            }
        }
    }

    // 1. Calculate remaining road distance from current position to end of leg
    let remainingDistKm = 0;
    if (currIdx < legPath.length - 1) {
        for (let p = currIdx; p < legPath.length - 1; p++) {
            remainingDistKm += Math.hypot(legPath[p+1][0] - legPath[p][0], legPath[p+1][1] - legPath[p][1]) * 111.0;
        }
    } else {
        remainingDistKm = activeLeg ? activeLeg.distanceKm : (driver.totalDistanceKm || 0.5);
    }
    remainingDistKm = Number(Math.max(0.1, remainingDistKm).toFixed(2));

    const speed = driver.speed || (driver.isObstructed ? 24 : 40);
    const etaMins = Number(((remainingDistKm / speed) * 60).toFixed(1));

    // 2. Identify the Next Turn Maneuver along the upcoming path
    let nextManeuverIdx = -1;
    let turnAngle = 0;
    let distToManeuverKm = 0;

    const calcBearing = (p1, p2) => {
        const dLng = (p2[1] - p1[1]) * Math.PI / 180;
        const lat1 = p1[0] * Math.PI / 180;
        const lat2 = p2[0] * Math.PI / 180;
        const y = Math.sin(dLng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        let b = Math.atan2(y, x) * 180 / Math.PI;
        return (b + 360) % 360;
    };

    if (currIdx < legPath.length - 2) {
        let runningDist = 0;
        for (let p = currIdx; p < legPath.length - 2; p++) {
            const segDist = Math.hypot(legPath[p+1][0] - legPath[p][0], legPath[p+1][1] - legPath[p][1]) * 111.0;
            runningDist += segDist;

            const b1 = calcBearing(legPath[p], legPath[p+1]);
            const b2 = calcBearing(legPath[p+1], legPath[p+2]);
            let diff = b2 - b1;
            while (diff > 180) diff -= 360;
            while (diff < -180) diff += 360;

            if (Math.abs(diff) >= 25) {
                nextManeuverIdx = p + 1;
                turnAngle = diff;
                distToManeuverKm = runningDist;
                break;
            }
        }
    }

    let maneuverType = 'STRAIGHT';
    let icon = 'fa-arrow-up';
    let maneuverText = '';

    const allStopsCompleted = routeSeq.length > 0 && routeSeq.every(s => s.status === 'COMPLETED');
    if (driver.missionStatus === 'DELIVERED' && allStopsCompleted) {
        maneuverType = 'DELIVERED';
        icon = 'fa-circle-check';
        maneuverText = `Mission Completed: All ${totalStops} emergency nodes delivered`;
    } else if (remainingDistKm < 0.08 && completedStops >= totalStops - 1) {
        maneuverType = 'ARRIVE';
        icon = 'fa-location-dot';
        maneuverText = `Arriving at Final Node ${seqNum}: ${targetName}`;
    } else if (remainingDistKm < 0.08) {
        maneuverType = 'ARRIVE';
        icon = 'fa-location-dot';
        maneuverText = `Arriving at Node ${seqNum}: ${targetName}`;
    } else if (driver.isObstructed) {
        maneuverType = 'DETOUR';
        icon = 'fa-triangle-exclamation';
        maneuverText = `DETOUR ACTIVE: Alternative corridor engaged`;
    } else if (nextManeuverIdx !== -1) {
        if (turnAngle >= 60 && turnAngle <= 135) {
            maneuverType = 'RIGHT';
            icon = 'fa-arrow-turn-right';
            maneuverText = 'Turn right';
        } else if (turnAngle > 25 && turnAngle < 60) {
            maneuverType = 'SLIGHT_RIGHT';
            icon = 'fa-arrow-turn-right';
            maneuverText = 'Bear slight right';
        } else if (turnAngle <= -60 && turnAngle >= -135) {
            maneuverType = 'LEFT';
            icon = 'fa-arrow-turn-left';
            maneuverText = 'Turn left';
        } else if (turnAngle < -25 && turnAngle > -60) {
            maneuverType = 'SLIGHT_LEFT';
            icon = 'fa-arrow-turn-left';
            maneuverText = 'Bear slight left';
        } else if (Math.abs(turnAngle) > 135) {
            maneuverType = 'U_TURN';
            icon = 'fa-arrows-rotate';
            maneuverText = 'Make a U-turn';
        } else {
            maneuverType = 'STRAIGHT';
            icon = 'fa-arrow-up';
            maneuverText = 'Continue straight';
        }
    } else {
        maneuverType = 'STRAIGHT';
        icon = 'fa-arrow-up';
        maneuverText = 'Continue straight';
        distToManeuverKm = remainingDistKm;
    }

    // Distance to next maneuver format (calculated separately from remaining destination distance)
    const distToManeuverM = Math.round(distToManeuverKm * 1000);
    const maneuverDistText = distToManeuverM < 1000 ? `${distToManeuverM} m` : `${distToManeuverKm.toFixed(1)} km`;
    const remainingDistText = remainingDistKm < 1.0 ? `${Math.round(remainingDistKm * 1000)} m` : `${remainingDistKm} km`;

    // Road landmark cues
    let roadCue = 'Municipal Road Corridor';
    if (targetName.toLowerCase().includes('barrage') || (driver.currentPos && Math.hypot(driver.currentPos[0] - 16.5062, driver.currentPos[1] - 80.6120) < 0.015)) {
        roadCue = 'Prakasam Barrage Bridge Deck';
        icon = 'fa-bridge';
    } else if (targetName.toLowerCase().includes('varadhi') || (driver.currentPos && Math.hypot(driver.currentPos[0] - 16.4980, driver.currentPos[1] - 80.6235) < 0.015)) {
        roadCue = 'Kanaka Durga Varadhi NH-16 Deck';
        icon = 'fa-bridge';
    } else if (targetName.toLowerCase().includes('benz')) {
        roadCue = 'MG Road / Bandar Road Junction';
    } else if (targetName.toLowerCase().includes('tadepalli')) {
        roadCue = 'Old Toll Gate / NH-65 South Corridor';
    } else if (targetName.toLowerCase().includes('eluru')) {
        roadCue = 'Karl Marx Road (Eluru Road)';
    }

    const instruction = (maneuverType === 'DELIVERED' || maneuverType === 'ARRIVE')
        ? maneuverText
        : `NEXT: ${maneuverText} onto ${roadCue}`;

    const subInstruction = `TARGET: NODE ${seqNum} OF ${totalStops} • ${targetName} (Remaining: ${remainingDistText})`;

    return {
        icon,
        distanceText: maneuverDistText,
        instruction,
        subInstruction,
        etaMinutes: etaMins,
        distanceKm: remainingDistKm,
        maneuverType,
        seqNum,
        totalStops,
        completedStops,
        remainingStops,
        roadCue,
        targetName
    };
}

function updateTurnByTurnNavBanner(driver) {
    if (!driver) return;
    const nav = computeTurnByTurnInstructions(driver);

    // 1. Driver GPS HUD Banner
    const drvIcon = document.getElementById('drv-nav-icon');
    const drvDist = document.getElementById('drv-nav-dist');
    const drvStep = document.getElementById('drv-nav-step');
    const drvSub = document.getElementById('drv-nav-sub');
    const drvEta = document.getElementById('drv-nav-eta-badge');
    const drvDistBadge = document.getElementById('drv-nav-dist-badge');
    const drvCue = document.getElementById('drv-nav-cue');

    if (drvIcon) drvIcon.className = `fa-solid ${nav.icon} text-emerald-400 text-xl`;
    if (drvDist) drvDist.innerText = nav.distanceText;
    if (drvStep) drvStep.innerText = nav.instruction;
    if (drvSub) drvSub.innerText = nav.subInstruction;
    if (drvEta) drvEta.innerText = `${Math.round(nav.etaMinutes)} MIN`;
    if (drvDistBadge) drvDistBadge.innerText = `${nav.distanceKm} km`;

    if (drvCue) {
        const allCompleted = nav.totalStops > 0 && nav.completedStops >= nav.totalStops;
        if (driver.missionStatus === 'DELIVERED' && allCompleted) {
            drvCue.innerText = `MISSION COMPLETED: All ${nav.totalStops} emergency nodes delivered. Unit online.`;
        } else if (driver.isObstructed) {
            drvCue.innerText = `REROUTING ACTIVE: Tunneling detour around corridor obstruction.`;
        } else {
            const statusLabel = driver.missionStatus === 'ROUTE_READY' ? 'ROUTE READY' : 'GPS: ACTIVE';
            drvCue.innerText = `CURRENT TARGET: NODE ${nav.seqNum} OF ${nav.totalStops} • COMPLETED: ${nav.completedStops} | REMAINING: ${nav.remainingStops} • ${statusLabel} (${driver.speed || 38} km/h)`;
        }
    }

    // 2. Officer Tactical Monitor Banner
    const offUnit = document.getElementById('officer-nav-unit');
    const offDist = document.getElementById('officer-nav-dist');
    const offStep = document.getElementById('officer-nav-step');
    const offIcon = document.getElementById('officer-nav-icon');

    if (offUnit) offUnit.innerText = `Unit #${driver.id}: ${driver.name}`;
    if (offDist) offDist.innerText = nav.distanceText;
    if (offStep) offStep.innerText = nav.instruction;
    if (offIcon) offIcon.className = `fa-solid ${nav.icon} text-emerald-400`;
}

// ==========================================
// 1.4 PRODUCTION INTERACTIVE ROUTE & DESTINATION PANELS
// ==========================================

/**
 * Open Dedicated Route Information Panel (Requirement 1 & 2)
 * Shows distance remaining along real road geometry, estimated fuel burn, ETA, route status, and navigation details.
 */
function openRouteInfoPanel(driver, selectedSegment) {
    if (!driver) return;
    audioEngine.playBeep(780, 0.08);

    const color = driver.color || (typeof DRIVER_COLORS !== 'undefined' ? DRIVER_COLORS[driver.id] : '#00f0ff');
    const titleEl = document.getElementById('route-info-title');
    const nameEl = document.getElementById('route-info-driver-name');
    const colorChip = document.getElementById('route-info-driver-color');
    const statusBadge = document.getElementById('route-info-status-badge');
    const originEl = document.getElementById('route-info-origin');
    const destEl = document.getElementById('route-info-destination');
    const distRemEl = document.getElementById('route-info-distance-remaining');
    const totalRemEl = document.getElementById('route-info-total-remaining');
    const totalPlannedEl = document.getElementById('route-info-total-planned');
    const fuelBurnEl = document.getElementById('route-info-fuel-burn');
    const etaEl = document.getElementById('route-info-eta');
    const maneuverEl = document.getElementById('route-info-maneuver');
    const maneuverSubEl = document.getElementById('route-info-maneuver-sub');
    const curCoordsEl = document.getElementById('route-info-coords-cur');
    const tgtCoordsEl = document.getElementById('route-info-coords-tgt');
    const legsListEl = document.getElementById('route-info-legs-breakdown');
    const legsCountBadge = document.getElementById('route-info-legs-count-badge');
    const segNameEl = document.getElementById('route-info-segment-name');

    if (titleEl) titleEl.innerText = `Route Telemetry • Unit #${driver.id}`;
    if (nameEl) nameEl.innerText = `Unit #${driver.id}: ${driver.name}`;
    if (colorChip) {
        colorChip.style.backgroundColor = color;
        colorChip.style.boxShadow = `0 0 8px ${color}`;
    }

    if (statusBadge) {
        const allCompleted = driver.routeSequence && driver.routeSequence.length > 0 && driver.routeSequence.every(s => s.status === 'COMPLETED');
        if (driver.isObstructed) {
            statusBadge.innerText = 'OBSTRUCTED / DETOUR ENGAGED';
            statusBadge.className = 'px-2.5 py-0.5 rounded text-[9px] font-mono font-extrabold uppercase bg-red-500/20 text-red-400 border border-red-500/40';
        } else if (driver.missionStatus === 'DELIVERED' && allCompleted) {
            statusBadge.innerText = 'MISSION COMPLETED';
            statusBadge.className = 'px-2.5 py-0.5 rounded text-[9px] font-mono font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
        } else if (driver.missionStatus === 'ROUTE_READY') {
            statusBadge.innerText = 'ROUTE READY';
            statusBadge.className = 'px-2.5 py-0.5 rounded text-[9px] font-mono font-extrabold uppercase bg-cyan-500/20 text-[#00f0ff] border border-cyan-500/40';
        } else {
            statusBadge.innerText = 'ON ACTIVE CORRIDOR';
            statusBadge.className = 'px-2.5 py-0.5 rounded text-[9px] font-mono font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
        }
    }

    // Determine current active destination node
    const activeStop = (driver.routeSequence || []).find(s => s.status !== 'COMPLETED') || driver.routeSequence[0] || { name: driver.node, seq: 1, lat: driver.targetPos[0], lng: driver.targetPos[1] };
    const startNode = (driver.routeSequence && driver.routeSequence.length > 0) ? driver.routeSequence[0].name : 'Vijayawada Central Staging';
    if (originEl) originEl.innerText = `Driver Live GPS (${driver.currentPos ? `${driver.currentPos[0].toFixed(4)}, ${driver.currentPos[1].toFixed(4)}` : startNode})`;
    if (destEl) destEl.innerText = `Node ${activeStop.seq || 1}: ${activeStop.name || driver.node}`;

    // 1. Calculate road distance from driver's current position to active node along active road geometry (Requirement 2 & 8)
    let activeLegDistKm = 0;
    const { activeCoords } = splitRouteSegments(driver);
    if (activeCoords && activeCoords.length > 1) {
        for (let i = 0; i < activeCoords.length - 1; i++) {
            activeLegDistKm += Math.hypot(activeCoords[i+1][0] - activeCoords[i][0], activeCoords[i+1][1] - activeCoords[i][1]) * 111;
        }
    }
    if (activeLegDistKm <= 0.05 && driver.legs && driver.legs.length > 0) {
        const activeLeg = driver.legs.find(l => l.status === 'IN_PROGRESS') || driver.legs.find(l => l.status !== 'COMPLETED');
        if (activeLeg) activeLegDistKm = parseFloat(activeLeg.distanceKm) || 1.8;
    }
    activeLegDistKm = Number(Math.max(0.1, activeLegDistKm).toFixed(2));

    // 2. Calculate remaining consecutive node-to-node legs
    let futureLegsDistKm = 0;
    let totalPlannedDistKm = 0;
    const legBreakdownItems = [];

    (driver.routeSequence || []).forEach((stop, sIdx) => {
        const seqNum = stop.seq || (sIdx + 1);
        const leg = (driver.legs && driver.legs.length >= seqNum) ? driver.legs[seqNum - 1] : null;
        const plannedDist = leg ? parseFloat(leg.distanceKm) : (parseFloat(stop.distanceKm) || 1.8);
        totalPlannedDistKm += plannedDist;

        const fromName = sIdx === 0 ? "Driver Live Location" : `Node ${sIdx} (${driver.routeSequence[sIdx - 1].name})`;
        const toName = `Node ${seqNum}: ${stop.name}`;
        const isCompleted = stop.status === 'COMPLETED' || (leg && leg.status === 'COMPLETED');
        const isActive = !isCompleted && stop.id === activeStop.id;
        const isBlocked = stop.status === 'BLOCKED' || (leg && leg.status === 'BLOCKED');

        if (isActive) {
            legBreakdownItems.push({
                seq: seqNum,
                from: "Driver (Live GPS)",
                to: `Node ${seqNum}: ${stop.name}`,
                roadDist: activeLegDistKm,
                plannedDist: Number(plannedDist.toFixed(2)),
                status: isBlocked ? 'BLOCKED' : 'ACTIVE',
                etaMins: Math.max(1, Math.round((activeLegDistKm / (driver.speed || 38)) * 60))
            });
        } else if (!isCompleted) {
            futureLegsDistKm += plannedDist;
            legBreakdownItems.push({
                seq: seqNum,
                from: `Node ${seqNum - 1} (${driver.routeSequence[sIdx - 1].name})`,
                to: `Node ${seqNum}: ${stop.name}`,
                roadDist: Number(plannedDist.toFixed(2)),
                plannedDist: Number(plannedDist.toFixed(2)),
                status: isBlocked ? 'BLOCKED' : 'PENDING',
                etaMins: Math.max(1, Math.round((plannedDist / (driver.speed || 38)) * 60))
            });
        } else {
            legBreakdownItems.push({
                seq: seqNum,
                from: fromName,
                to: `Node ${seqNum}: ${stop.name}`,
                roadDist: Number(plannedDist.toFixed(2)),
                plannedDist: Number(plannedDist.toFixed(2)),
                status: 'COMPLETED',
                etaMins: 0
            });
        }
    });

    // 3. Keep values strictly separated: active leg distance, remaining total, and total planned
    const totalRemainingKm = Number((activeLegDistKm + futureLegsDistKm).toFixed(2));
    totalPlannedDistKm = Number(Math.max(totalRemainingKm, totalPlannedDistKm).toFixed(2));

    if (distRemEl) distRemEl.innerText = `${activeLegDistKm} km`;
    if (totalRemEl) totalRemEl.innerText = `${totalRemainingKm} km`;
    if (totalPlannedEl) totalPlannedEl.innerText = `${totalPlannedDistKm} km`;

    const fuelLiters = Number((totalRemainingKm * 0.138).toFixed(2));
    const speed = driver.speed || 38;
    const etaMins = Math.max(1, Math.round((totalRemainingKm / speed) * 60));

    if (fuelBurnEl) fuelBurnEl.innerText = `${fuelLiters} L`;
    if (etaEl) etaEl.innerText = `${etaMins} MIN`;

    const nav = computeTurnByTurnInstructions(driver);
    if (maneuverEl) maneuverEl.innerText = nav.instruction;
    if (maneuverSubEl) maneuverSubEl.innerText = nav.subInstruction;

    if (curCoordsEl && driver.currentPos) {
        curCoordsEl.innerText = `${driver.currentPos[0].toFixed(4)}, ${driver.currentPos[1].toFixed(4)}`;
    }
    if (tgtCoordsEl && activeStop) {
        tgtCoordsEl.innerText = `${(activeStop.lat || driver.targetPos[0]).toFixed(4)}, ${(activeStop.lng || driver.targetPos[1]).toFixed(4)}`;
    }

    // Render consecutive node legs breakdown
    if (legsCountBadge) legsCountBadge.innerText = `${legBreakdownItems.length} LEGS`;
    if (legsListEl) {
        legsListEl.innerHTML = legBreakdownItems.map(item => {
            if (item.status === 'ACTIVE') {
                return `
                    <div class="p-2.5 rounded-xl bg-cyan-950/40 border border-[#00f0ff]/50 font-mono text-[10px] space-y-1">
                        <div class="flex items-center justify-between">
                            <span class="font-bold text-[#00f0ff] flex items-center gap-1.5 truncate">
                                <span class="w-4 h-4 rounded-full bg-[#00f0ff] text-black font-extrabold flex items-center justify-center text-[9px]">${item.seq}</span>
                                <span class="truncate">${item.from} → ${item.to}</span>
                            </span>
                            <span class="px-1.5 py-0.2 bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 rounded text-[8px] font-extrabold uppercase">
                                ACTIVE LEG
                            </span>
                        </div>
                        <div class="flex items-center justify-between text-[9px] text-slate-300 pt-1 border-t border-cyan-800/40">
                            <span>Remaining Road Dist: <b class="text-white">${item.roadDist} km</b></span>
                            <span class="text-slate-400">Planned: ${item.plannedDist} km • ETA: ${item.etaMins}m</span>
                        </div>
                    </div>
                `;
            } else if (item.status === 'BLOCKED') {
                return `
                    <div class="p-2 rounded-xl bg-red-950/30 border border-red-500/40 font-mono text-[10px] space-y-0.5">
                        <div class="flex items-center justify-between">
                            <span class="font-bold text-red-300 flex items-center gap-1.5 truncate">
                                <span class="w-4 h-4 rounded-full bg-red-600 text-white font-extrabold flex items-center justify-center text-[9px]">${item.seq}</span>
                                <span class="truncate">${item.from} → ${item.to}</span>
                            </span>
                            <span class="px-1.5 py-0.2 bg-red-500/20 text-red-400 border border-red-500/40 rounded text-[8px] font-bold uppercase">
                                BLOCKED
                            </span>
                        </div>
                        <div class="text-[8px] text-red-400">No verified road alternative available. Corridor obstructed.</div>
                    </div>
                `;
            } else if (item.status === 'PENDING') {
                return `
                    <div class="p-2 rounded-xl bg-[#010409] border border-[#30363d] font-mono text-[10px] space-y-1">
                        <div class="flex items-center justify-between">
                            <span class="font-bold text-white flex items-center gap-1.5 truncate">
                                <span class="w-4 h-4 rounded-full bg-slate-800 text-slate-300 font-extrabold flex items-center justify-center text-[9px]">${item.seq}</span>
                                <span class="truncate">${item.from} → ${item.to}</span>
                            </span>
                            <span class="px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded text-[8px] font-bold uppercase">
                                PENDING
                            </span>
                        </div>
                        <div class="flex items-center justify-between text-[9px] text-slate-400 pt-1 border-t border-slate-800">
                            <span>Road Distance: <b class="text-white">${item.roadDist} km</b></span>
                            <span>ETA: ${item.etaMins}m</span>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="p-2 rounded-xl bg-emerald-950/20 border border-emerald-500/20 font-mono text-[10px]">
                        <div class="flex items-center justify-between">
                            <span class="text-emerald-400/80 flex items-center gap-1.5 truncate">
                                <span class="w-4 h-4 rounded-full bg-emerald-600/60 text-black font-extrabold flex items-center justify-center text-[9px]">✓</span>
                                <span class="truncate">${item.to}</span>
                            </span>
                            <span class="text-[8px] font-bold text-emerald-400">CLEARED (${item.roadDist} km)</span>
                        </div>
                    </div>
                `;
            }
        }).join('');
    }

    // Set selected road segment context
    const seg = selectedSegment || state.selectedRoadSegment;
    if (seg && seg.name) {
        state.selectedRoadSegment = seg;
        if (segNameEl) segNameEl.innerText = seg.name;
    } else {
        const nearestEdge = (typeof findNearestRoadEdge === 'function') ? findNearestRoadEdge(driver.currentPos, 1.2) : null;
        const defaultName = nearestEdge ? nearestEdge.name : 'Prakasam Barrage Deck (BARRAGE_NORTH ↔ BARRAGE_APPROACH_N)';
        state.selectedRoadSegment = {
            driverId: driver.id,
            driverName: driver.name,
            edge: nearestEdge ? nearestEdge.edge : ['BARRAGE_NORTH', 'BARRAGE_APPROACH_N'],
            name: defaultName
        };
        if (segNameEl) segNameEl.innerText = defaultName;
    }

    openModal('route-info-modal');
}

/**
 * Open Destination Details & Unreachable Report Dialog (Requirement 2 & 4)
 */
function openDestinationInfoModal(driver, stop) {
    if (!driver) return;
    audioEngine.playBeep(750, 0.08);

    const targetName = stop?.name || driver.node || 'Assigned Destination';
    const targetCoords = [stop?.lat || driver.targetPos[0], stop?.lng || driver.targetPos[1]];

    state.pendingUnreachableTarget = {
        driverId: driver.id,
        driverName: driver.name,
        destinationNode: targetName,
        destinationCoords: targetCoords
    };

    const modalTitle = document.getElementById('dest-modal-title');
    const nodeNameEl = document.getElementById('dest-modal-node-name');
    const coordsEl = document.getElementById('dest-modal-coords');
    const roleEl = document.getElementById('dest-modal-role');
    const distRemEl = document.getElementById('dest-modal-dist-rem');

    if (modalTitle) modalTitle.innerText = `Target: ${targetName}`;
    if (nodeNameEl) nodeNameEl.innerText = targetName;
    if (coordsEl) coordsEl.innerText = `${targetCoords[0].toFixed(4)}, ${targetCoords[1].toFixed(4)}`;
    if (roleEl) roleEl.innerText = driver.job || 'Relief Logistics';

    let remKm = 0;
    if (driver.currentPos && targetCoords) {
        remKm = Math.hypot(driver.currentPos[0] - targetCoords[0], driver.currentPos[1] - targetCoords[1]) * 111 * 1.08;
    }
    if (stop && stop.distanceKm) {
        remKm = parseFloat(stop.distanceKm);
    }
    remKm = Number((remKm || 1.85).toFixed(2));
    if (distRemEl) distRemEl.innerText = `${remKm} km`;

    openModal('destination-info-modal');
}

/**
 * Submit Driver Destination Unreachable Report (Requirement 3 & 5)
 */
async function submitDestinationUnreachableReport() {
    const activeDriver = (state.user && state.user.role === 'DRIVER')
        ? state.fleet.find(d => d.id === state.user.id)
        : (state.fleet.find(d => d.id === state.pendingUnreachableTarget?.driverId) || state.fleet[0]);

    if (!activeDriver) return;

    const targetInfo = state.pendingUnreachableTarget || {
        driverId: activeDriver.id,
        destinationNode: activeDriver.node,
        destinationCoords: activeDriver.targetPos
    };

    const reasonEl = document.getElementById('dest-unreachable-reason');
    const notesEl = document.getElementById('dest-unreachable-notes');
    const reason = reasonEl ? reasonEl.value : 'Severe Flooding / Bridge Deck Submerged';
    const notes = notesEl ? notesEl.value : '';

    try {
        const payload = {
            role: 'DRIVER',
            destinationNode: targetInfo.destinationNode,
            destinationCoords: targetInfo.destinationCoords,
            reason: reason,
            notes: notes
        };

        const res = await fetch(`${CONFIG.API_URL}/fleet/${activeDriver.id}/unreachable-report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-role': 'DRIVER' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
            closeModal('destination-info-modal');
            audioEngine.playBeep(440, 0.25);
            showBroadcastToast(`⚠️ Destination Unreachable Report submitted for "${targetInfo.destinationNode}". Officer alerted.`);
            if (state.user && state.user.role === 'OFFICER' && typeof fetchAndRenderOfficerAlerts === 'function') {
                fetchAndRenderOfficerAlerts();
            }
        } else {
            alert(data.message || 'Error submitting unreachable report');
        }
    } catch (err) {
        console.error('Error submitting unreachable report:', err);
        closeModal('destination-info-modal');
        showBroadcastToast(`⚠️ Destination Unreachable logged (offline queued).`);
    }
}

/**
 * Fetch and Render Persistent Alerts for Command Officer
 */
async function fetchAndRenderOfficerAlerts() {
    try {
        if (!state.user || state.user.role !== 'OFFICER') return;
        const res = await fetch(`${CONFIG.API_URL}/alerts`);
        if (!res.ok) return;
        const data = await res.json();
        state.systemAlerts = data.alerts || [];
        renderOfficerAlertsList(state.systemAlerts);
    } catch (e) {
        console.error('Failed to fetch alerts:', e);
    }
}

function renderOfficerAlertsList(alerts) {
    const container = document.getElementById('officer-persistent-alerts');
    if (!container) return;

    if (!alerts || alerts.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = alerts.map(a => `
        <div class="pointer-events-auto bg-[#0d1117]/95 border border-red-500/70 p-3 rounded-xl shadow-2xl backdrop-blur-xl space-y-1.5 transition" id="alert-card-${a.id}">
            <div class="flex items-center justify-between">
                <span class="px-2 py-0.5 bg-red-600/30 text-red-400 border border-red-500/50 rounded font-bold text-[9px] uppercase font-hud flex items-center gap-1">
                    <i class="fa-solid fa-triangle-exclamation"></i> DESTINATION UNREACHABLE
                </span>
                <span class="text-[9px] font-mono text-slate-400">${new Date(a.timestamp).toLocaleTimeString()}</span>
            </div>
            <p class="text-xs font-bold text-white flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full inline-block" style="background:${a.driverColor || '#00f0ff'}; box-shadow: 0 0 6px ${a.driverColor || '#00f0ff'}"></span>
                Operative ${a.driverName} (Unit #${a.driverId})
            </p>
            <p class="text-[10px] text-amber-300 font-semibold">Destination: <span class="text-white">${a.destinationNode}</span></p>
            <p class="text-[10px] text-red-300">Reason: ${a.reason}</p>
            ${a.notes ? `<p class="text-[9px] text-slate-400 italic">"${a.notes}"</p>` : ''}
            <div class="pt-1 flex items-center justify-end space-x-2">
                <button onclick="acknowledgeOfficerAlert('${a.id}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[9px] font-bold uppercase transition shadow">
                    <i class="fa-solid fa-check mr-1"></i> Acknowledge
                </button>
            </div>
        </div>
    `).join('');
}

async function acknowledgeOfficerAlert(alertId) {
    try {
        if (!state.user || state.user.role !== 'OFFICER') return;
        const res = await fetch(`${CONFIG.API_URL}/alerts/${alertId}/acknowledge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-role': 'OFFICER'
            },
            body: JSON.stringify({ role: 'OFFICER' })
        });
        const data = await res.json();
        if (data.success) {
            audioEngine.playBeep(880, 0.1);
            showBroadcastToast(`Alert ${alertId} acknowledged.`);
            fetchAndRenderOfficerAlerts();
        }
    } catch (e) {
        console.error('Failed to acknowledge alert:', e);
    }
}

/**
 * Toggle Driver Map Orientation between North Up and Direction Up (Requirement 6)
 */
function toggleDriverMapOrientation() {
    audioEngine.playBeep(800, 0.08);
    if (state.driverMapOrientation === 'DIRECTION_UP') {
        state.driverMapOrientation = 'NORTH_UP';
    } else {
        state.driverMapOrientation = 'DIRECTION_UP';
    }
    applyDriverMapOrientation();
}

function applyDriverMapOrientation() {
    if (!state.driverMap) return;
    const modeSpan = document.getElementById('driver-orientation-mode');
    const needle = document.getElementById('driver-compass-needle');
    const activeDriver = (state.user && state.user.role === 'DRIVER')
        ? state.fleet.find(d => d.id === state.user.id)
        : (state.fleet.find(d => d.id === state.selectedDriverId) || state.fleet[0]);
    const heading = activeDriver?.heading || 0;

    if (state.driverMapOrientation === 'DIRECTION_UP') {
        if (modeSpan) modeSpan.innerText = 'DIRECTION UP';
        if (typeof state.driverMap.setBearing === 'function') {
            state.driverMap.setBearing(-heading);
        }
        if (needle) {
            needle.style.transform = `rotate(${-heading}deg)`;
            needle.classList.remove('text-emerald-400');
            needle.classList.add('text-[#00f0ff]');
        }
    } else {
        if (modeSpan) modeSpan.innerText = 'NORTH UP';
        if (typeof state.driverMap.setBearing === 'function') {
            state.driverMap.setBearing(0);
        }
        if (needle) {
            needle.style.transform = `rotate(0deg)`;
            needle.classList.remove('text-[#00f0ff]');
            needle.classList.add('text-emerald-400');
        }
    }
}

function startDriverTelemetryStream(driver) {
    if (state.driverTelemetryInterval) clearInterval(state.driverTelemetryInterval);
    state.driverTelemetryInterval = setInterval(() => {
        if (state.wsConnected && state.ws && state.ws.readyState === WebSocket.OPEN) {
            state.ws.send(JSON.stringify({
                type: 'VEHICLE_TELEMETRY',
                driverId: driver.id,
                currentPos: driver.currentPos,
                speed: driver.speed || 38,
                heading: driver.heading || 0,
                fuelBurnRate: 0.138,
                crashSensor: driver.crashSensor
            }));
        }
    }, 2500);
}

function splitRouteSegments(driver) {
    const completedCoords = [];
    const activeCoords = [];
    const upcomingCoords = [];

    if (!driver) return { completedCoords, activeCoords, upcomingCoords };

    if (driver.legs && driver.legs.length > 0) {
        let activeIdx = driver.legs.findIndex(l => l.status === 'IN_PROGRESS');
        if (activeIdx === -1) {
            activeIdx = driver.legs.findIndex(l => l.status !== 'COMPLETED');
        }
        const hasPendingStops = driver.routeSequence && driver.routeSequence.some(s => s.status !== 'COMPLETED');
        if (activeIdx === -1 && hasPendingStops) {
            activeIdx = 0;
        }

        driver.legs.forEach((leg, idx) => {
            if (!leg.path || leg.path.length === 0) return;
            if (leg.status === 'COMPLETED' || (activeIdx !== -1 && idx < activeIdx)) {
                // Completed past segment (faded pastel)
                if (completedCoords.length > 0) {
                    for (let p = 1; p < leg.path.length; p++) completedCoords.push(leg.path[p]);
                } else {
                    completedCoords.push(...leg.path);
                }
            } else if (idx === activeIdx && leg.status !== 'COMPLETED') {
                // Current active segment: split at vehicle's current road position
                let nearestIdx = 0;
                if (driver.currentPos && leg.path.length > 1) {
                    let minDist = Infinity;
                    for (let p = 0; p < leg.path.length; p++) {
                        const d = Math.hypot(leg.path[p][0] - driver.currentPos[0], leg.path[p][1] - driver.currentPos[1]);
                        if (d < minDist) {
                            minDist = d;
                            nearestIdx = p;
                        }
                    }
                }

                // Past points in this leg are completed
                if (nearestIdx > 0) {
                    const pastPortion = leg.path.slice(0, nearestIdx + 1);
                    if (completedCoords.length > 0) {
                        for (let p = 1; p < pastPortion.length; p++) completedCoords.push(pastPortion[p]);
                    } else {
                        completedCoords.push(...pastPortion);
                    }
                }

                // Active points start strictly at driver.currentPos and continue forward to target
                const futurePortion = leg.path.slice(nearestIdx);
                if (driver.currentPos) {
                    activeCoords.push(driver.currentPos);
                    const startP = (futurePortion.length > 0 && Math.hypot(futurePortion[0][0] - driver.currentPos[0], futurePortion[0][1] - driver.currentPos[1]) < 0.0005) ? 1 : 0;
                    for (let p = startP; p < futurePortion.length; p++) {
                        activeCoords.push(futurePortion[p]);
                    }
                } else {
                    activeCoords.push(...futurePortion);
                }
            } else {
                // Upcoming future segments (vibrant solid line)
                if (upcomingCoords.length > 0) {
                    for (let p = 1; p < leg.path.length; p++) upcomingCoords.push(leg.path[p]);
                } else {
                    upcomingCoords.push(...leg.path);
                }
            }
        });
    }

    if (completedCoords.length === 0 && activeCoords.length === 0 && upcomingCoords.length === 0) {
        if (driver.polyline && driver.polyline.length > 0) {
            const allCompleted = driver.routeSequence && driver.routeSequence.length > 0 && driver.routeSequence.every(s => s.status === 'COMPLETED');
            if (allCompleted) {
                completedCoords.push(...driver.polyline);
            } else {
                let nearestIdx = 0;
                if (driver.currentPos && driver.polyline.length > 1) {
                    let minDist = Infinity;
                    for (let p = 0; p < driver.polyline.length; p++) {
                        const d = Math.hypot(driver.polyline[p][0] - driver.currentPos[0], driver.polyline[p][1] - driver.currentPos[1]);
                        if (d < minDist) {
                            minDist = d;
                            nearestIdx = p;
                        }
                    }
                }
                if (nearestIdx > 0) {
                    completedCoords.push(...driver.polyline.slice(0, nearestIdx + 1));
                }
                const forwardPortion = driver.polyline.slice(nearestIdx);
                if (driver.currentPos) {
                    activeCoords.push(driver.currentPos);
                    const startP = (forwardPortion.length > 0 && Math.hypot(forwardPortion[0][0] - driver.currentPos[0], forwardPortion[0][1] - driver.currentPos[1]) < 0.0005) ? 1 : 0;
                    for (let p = startP; p < forwardPortion.length; p++) {
                        activeCoords.push(forwardPortion[p]);
                    }
                } else {
                    activeCoords.push(...forwardPortion);
                }
            }
        }
    }

    return { completedCoords, activeCoords, upcomingCoords };
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

                // Multi-stage 3-tier route rendering: pastel completed + dashed active + vibrant upcoming
                const { completedCoords, activeCoords, upcomingCoords } = splitRouteSegments(driver);
                const pastel = getDriverPastelColor(color, driver.id);

                const compPoly = L.polyline(completedCoords, {
                    color: pastel,
                    weight: 3.0,
                    opacity: 0.60
                }).addTo(m);

                const activePoly = L.polyline(activeCoords.length > 0 ? activeCoords : (completedCoords.length > 0 ? [] : ((driver.polyline && driver.polyline.length > 1) ? driver.polyline : (typeof getRoadSnappedPath === 'function' ? getRoadSnappedPath([lat, lng], [targetLat, targetLng]) : []))), {
                    color: driver.isObstructed ? '#ef4444' : color,
                    weight: 3.5,
                    opacity: 0.95,
                    dashArray: '8, 12',
                    className: 'pulsing-route-vector'
                }).addTo(m);

                const upcomingPoly = L.polyline(upcomingCoords, {
                    color: color,
                    weight: 3.0,
                    opacity: 0.85
                }).addTo(m);

                state.miniMaps[driver.id] = { map: m, liveMarker, targetMarker, polyline: activePoly, completedPolyline: compPoly, activePolyline: activePoly, upcomingPolyline: upcomingPoly };
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
    const pastel = getDriverPastelColor(color, driver.id);
    const mini = state.miniMaps[driverId];
    if (mini) {
        const { completedCoords, activeCoords, upcomingCoords } = splitRouteSegments(driver);
        if (mini.completedPolyline) {
            mini.completedPolyline.setLatLngs(completedCoords);
            mini.completedPolyline.setStyle({ color: pastel, weight: 3.0, opacity: 0.60 });
        }
        const activeLayer = mini.activePolyline || mini.polyline;
        if (activeLayer) {
            activeLayer.setLatLngs(activeCoords.length > 0 ? activeCoords : (completedCoords.length > 0 ? [] : (driver.polyline || [])));
            activeLayer.setStyle({
                color: driver.isObstructed ? '#ef4444' : color,
                dashArray: '8, 12',
                className: 'pulsing-route-vector'
            });
        }
        if (mini.upcomingPolyline) {
            mini.upcomingPolyline.setLatLngs(upcomingCoords);
            mini.upcomingPolyline.setStyle({ color: color, weight: 3.0, opacity: 0.85 });
        } else if (upcomingCoords.length > 0 && mini.map) {
            mini.upcomingPolyline = L.polyline(upcomingCoords, {
                color: color,
                weight: 3.0,
                opacity: 0.85
            }).addTo(mini.map);
        }
        if (mini.liveMarker && driver.currentPos) {
            mini.liveMarker.setLatLng(driver.currentPos);
        }
        if (mini.targetMarker && driver.targetPos) {
            mini.targetMarker.setLatLng(driver.targetPos);
        }
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
    updateTurnByTurnNavBanner(driver);

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

        const obstructionActionBtn = driver.isObstructed ? `
            <button onclick="clearDriverObstruction(${driver.id})" class="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold mt-1.5 w-full flex items-center justify-center gap-1.5 shadow">
                <i class="fa-solid fa-road"></i> Reopen Corridor / Clear Blockade
            </button>
        ` : '';

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
                ${obstructionActionBtn}
                <button onclick="advanceDriverLeg(${driver.id})" class="route-advance-btn">
                    <i class="fa-solid fa-forward-step"></i> Advance to Next Stop
                </button>
                <button onclick="clearDriverRoute(${driver.id})" class="route-clear-btn">
                    <i class="fa-solid fa-xmark"></i> Clear Route
                </button>
            </div>
        `;

        const { completedCoords, activeCoords, upcomingCoords } = splitRouteSegments(driver);
        const pastel = getDriverPastelColor(color, driver.id);

        const heading = (driver.heading !== undefined) ? driver.heading : calculateRoadHeading(driver);
        const beaconIcon = createLiveProfileMarkerIcon(driver, heading);

        const activeLineCoords = activeCoords.length > 0 ? activeCoords : (completedCoords.length > 0 ? [] : ((driver.polyline && driver.polyline.length > 1) ? driver.polyline : (typeof getRoadSnappedPath === 'function' ? getRoadSnappedPath([lat, lng], [targetLat, targetLng]) : [])));

        const onFullMapRouteClick = (e) => {
            if (e && e.originalEvent) L.DomEvent.stopPropagation(e);
            else if (e && e.stopPropagation) e.stopPropagation();
            handleRouteSegmentClick(driver, e ? e.latlng : null, e, state.fullMap);
        };

        if (!state.fullMap) {
            state.fullMap = L.map('map-full-expanded', { zoomControl: true }).setView([lat, lng], 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(state.fullMap);

            state.fullMapMarker = L.marker([lat, lng], { icon: beaconIcon })
                .addTo(state.fullMap)
                .bindPopup(`<b>Unit #${driver.id}: ${driver.name}</b><br>${driver.node}`);

            state.fullMapCompletedPoly = L.polyline(completedCoords, {
                color: pastel,
                weight: 3.5,
                opacity: 0.60
            }).addTo(state.fullMap);
            state.fullMapCompletedPoly.on('click', onFullMapRouteClick);

            state.fullMapPoly = L.polyline(activeLineCoords, {
                color: polyColor,
                weight: 4.8,
                opacity: 0.95,
                dashArray: '8, 12',
                className: 'pulsing-route-vector'
            }).addTo(state.fullMap);
            state.fullMapPoly.on('click', onFullMapRouteClick);

            state.fullMapUpcomingPoly = L.polyline(upcomingCoords, {
                color: polyColor,
                weight: 3.8,
                opacity: 0.85
            }).addTo(state.fullMap);
            state.fullMapUpcomingPoly.on('click', onFullMapRouteClick);
        } else {
            state.fullMapMarker.setLatLng([lat, lng]);
            state.fullMapMarker.setIcon(beaconIcon);
            state.fullMapMarker.setPopupContent(`<b>Unit #${driver.id}: ${driver.name}</b><br>${driver.node}`);

            if (activeLineCoords && activeLineCoords.length > 1) {
                state.fullMap.fitBounds(L.latLngBounds(activeLineCoords), { padding: [40, 40], maxZoom: 15 });
            } else {
                state.fullMap.setView([lat, lng], 14);
            }

            if (!state.fullMapCompletedPoly) {
                state.fullMapCompletedPoly = L.polyline(completedCoords, {
                    color: pastel,
                    weight: 3.5,
                    opacity: 0.60
                }).addTo(state.fullMap);
                state.fullMapCompletedPoly.on('click', onFullMapRouteClick);
            } else {
                state.fullMapCompletedPoly.setLatLngs(completedCoords);
                state.fullMapCompletedPoly.setStyle({ color: pastel, weight: 3.5, opacity: 0.60 });
            }
            state.fullMapPoly.setLatLngs(activeLineCoords);
            state.fullMapPoly.setStyle({
                color: polyColor,
                weight: 4.8,
                opacity: 0.95,
                dashArray: '8, 12',
                className: 'pulsing-route-vector'
            });

            if (!state.fullMapUpcomingPoly) {
                state.fullMapUpcomingPoly = L.polyline(upcomingCoords, {
                    color: polyColor,
                    weight: 3.8,
                    opacity: 0.85
                }).addTo(state.fullMap);
                state.fullMapUpcomingPoly.on('click', onFullMapRouteClick);
            } else {
                state.fullMapUpcomingPoly.setLatLngs(upcomingCoords);
                state.fullMapUpcomingPoly.setStyle({ color: polyColor, weight: 3.8, opacity: 0.85 });
            }
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

            const isCompleted = stop.status === 'COMPLETED';
            const isCurrentTarget = !isCompleted && (seqList.find(s => s.status !== 'COMPLETED') === stop);
            const badgeClasses = `sequence-badge ${isCompleted ? 'sequence-badge-completed' : ''} ${isCurrentTarget ? 'badge-current-target' : ''}`;
            const badgeContent = isCompleted ? '✓' : seqNum;

            const seqIcon = L.divIcon({
                className: 'node-sequence-marker',
                html: `
                    <div class="${badgeClasses}" style="border-color:${isCompleted ? '#10b981' : badgeColor}; background:${isCompleted ? '#0d1117' : badgeColor}; box-shadow: 0 0 12px ${isCompleted ? '#10b981' : badgeColor}">
                        ${badgeContent}
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
    const activeIdx = driver.routeSequence.findIndex(s => s.status !== 'COMPLETED');

    const { activeCoords } = splitRouteSegments(driver);
    let liveRemKm = 0;
    if (activeCoords && activeCoords.length > 1) {
        for (let i = 0; i < activeCoords.length - 1; i++) {
            liveRemKm += Math.hypot(activeCoords[i+1][0] - activeCoords[i][0], activeCoords[i+1][1] - activeCoords[i][1]) * 111;
        }
    }
    if (liveRemKm <= 0.05 && driver.legs && driver.legs.length > 0) {
        const al = driver.legs.find(l => l.status === 'IN_PROGRESS') || driver.legs.find(l => l.status !== 'COMPLETED');
        if (al) liveRemKm = parseFloat(al.distanceKm) || 1.8;
    }
    liveRemKm = Number(Math.max(0.1, liveRemKm).toFixed(2));

    return driver.routeSequence.map((stop, sIdx) => {
        const seqNum = stop.seq || (sIdx + 1);
        const matchingLeg = (driver.legs && driver.legs.length >= seqNum) ? driver.legs[seqNum - 1] : null;
        const legDist = matchingLeg ? matchingLeg.distanceKm : (stop.distanceKm || '1.80');
        const cumulDist = matchingLeg && matchingLeg.cumulativeDistanceKm ? matchingLeg.cumulativeDistanceKm : (stop.cumulativeDistanceKm || legDist);
        const legFuel = matchingLeg ? matchingLeg.fuelBurnLiters : (stop.fuelBurnLiters || '0.25');
        const cumulFuel = matchingLeg && matchingLeg.cumulativeFuelBurnLiters ? matchingLeg.cumulativeFuelBurnLiters : (stop.cumulativeFuelBurnLiters || legFuel);
        const legEta = matchingLeg ? matchingLeg.etaMinutes : (stop.etaMinutes || '4.5');
        const cumulEta = matchingLeg && matchingLeg.cumulativeEtaMinutes ? matchingLeg.cumulativeEtaMinutes : (stop.cumulativeEtaMinutes || legEta);
        const isCompleted = stop.status === 'COMPLETED' || (matchingLeg && matchingLeg.status === 'COMPLETED');
        const isActive = !isCompleted && sIdx === activeIdx;
        const isBlocked = stop.status === 'BLOCKED' || (matchingLeg && matchingLeg.status === 'BLOCKED');

        const fromLabel = sIdx === 0 ? "Driver Live GPS" : `Node ${sIdx} (${driver.routeSequence[sIdx - 1].name})`;
        const toLabel = `Node ${seqNum}: ${stop.name}`;

        const cardClass = isCompleted ? 'leg-status-completed' : (isBlocked ? 'border-red-500/50 bg-red-950/20' : (isActive ? 'leg-status-active ring-1 ring-[#00f0ff]/50' : 'leg-status-pending'));

        return `
            <div class="p-2.5 rounded-lg bg-[#161b22]/90 border border-[#30363d] hover:border-[#00f0ff]/50 transition text-[10px] ${cardClass}">
                <div class="flex items-center justify-between mb-1">
                    <span class="font-bold text-white flex items-center gap-1.5 truncate">
                        <span class="w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] text-black" style="background:${isCompleted ? '#10b981' : (isBlocked ? '#ef4444' : driverColor)}">
                            ${isCompleted ? '✓' : seqNum}
                        </span>
                        <span class="truncate">${toLabel}</span>
                    </span>
                    <span class="text-[8px] font-mono px-1.5 py-0.5 rounded ${isCompleted ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : (isBlocked ? 'bg-red-950 text-red-400 border border-red-500/30' : (isActive ? 'bg-cyan-950 text-[#00f0ff] border border-cyan-500/40 font-bold' : 'bg-slate-800 text-slate-300'))} whitespace-nowrap">
                        ${isCompleted ? 'CLEARED' : (isBlocked ? 'BLOCKED' : (isActive ? `ACTIVE • ${legEta}m` : `${legEta}m (Σ ${cumulEta}m)`))}
                    </span>
                </div>
                <div class="text-[9px] text-slate-400 mb-1 flex items-center gap-1 truncate font-sans">
                    <span class="text-slate-500">From:</span>
                    <span class="text-slate-300 truncate">${fromLabel}</span>
                </div>
                <div class="grid grid-cols-2 gap-1 text-[9px] font-mono text-slate-400 pt-1 border-t border-slate-800">
                    <div>${isActive ? 'Remaining:' : 'Road Dist:'} <span class="${isActive ? 'text-[#00f0ff] font-extrabold' : 'text-white font-bold'}">${isActive ? liveRemKm : legDist}km</span> ${isActive ? `<span class="text-slate-500">(${legDist}km plan)</span>` : `<span class="text-[#00f0ff]">(${cumulDist}km)</span>`}</div>
                    <div>Fuel: <span class="text-white font-bold">${legFuel}L</span> <span class="text-amber-400 font-bold">(${cumulFuel}L)</span></div>
                </div>
                ${(!isCompleted && !isBlocked) ? `
                <button onclick="advanceDriverLeg(${driver.id})" class="route-advance-btn mt-1.5">
                    <i class="fa-solid fa-check"></i> Mark Reached & Cleared
                </button>
                ` : ''}
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
    const color = driver.color || (typeof DRIVER_COLORS !== 'undefined' ? DRIVER_COLORS[driver.id] : '#00f0ff');
    const expInitialsEl = document.getElementById('exp-profile-initials');
    const sideInitialsEl = document.getElementById('side-initials');
    if (expInitialsEl) {
        expInitialsEl.innerText = initials;
        expInitialsEl.style.backgroundColor = color;
    }
    if (sideInitialsEl) {
        sideInitialsEl.innerText = initials;
        sideInitialsEl.style.backgroundColor = color;
    }

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

let _lastTacticalToggleTime = 0;
function toggleOfficerTacticalMap() {
    const now = Date.now();
    if (now - _lastTacticalToggleTime < 300) return;
    _lastTacticalToggleTime = now;

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
        tacticalView.classList.add('flex', 'flex-col', 'h-full');
        if (modeBtnText) modeBtnText.innerText = "Fleet Grid View";
        initTacticalMasterMap();
    } else {
        // Switch back to Grid View
        tacticalView.classList.add('hidden');
        tacticalView.classList.remove('flex', 'flex-col', 'h-full');
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

            // Interactive Click to Dispatch / Spawn Node (Normal Single-Node Mode)
            state.tacticalMasterMap.on('click', (e) => {
                if (state.multiNodeSelectionMode) return;
                handleOfficerMapClick(e.latlng.lat, e.latlng.lng);
            });

            // Interactive Double Click for Emergency Multi-Node Mode (Spec 4 & Test A)
            state.tacticalMasterMap.on('dblclick', (e) => {
                if (state.multiNodeSelectionMode) {
                    if (e && e.originalEvent) L.DomEvent.stopPropagation(e);
                    handleOfficerMapDoubleClick(e.latlng.lat, e.latlng.lng);
                }
            });
        }

        renderTacticalMasterMapLayers();
        if (state.tacticalMasterMap) {
            state.tacticalMasterMap.invalidateSize();
        }

        // Update Turn-by-Turn Nav Banner on Tactical View
        const activeDriver = state.fleet.find(d => d.id === state.selectedDriverId) || state.fleet[0];
        if (activeDriver && typeof updateTurnByTurnNavBanner === 'function') {
            updateTurnByTurnNavBanner(activeDriver);
        }
    }, 150);
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
            nodeMarker.on('dblclick', (e) => {
                if (state.multiNodeSelectionMode) {
                    if (e && e.originalEvent) L.DomEvent.stopPropagation(e);
                    handleOfficerMapDoubleClick(e.latlng.lat, e.latlng.lng);
                }
            });
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

        const heading = calculateHeading(driver.currentPos, (driver.polyline && driver.polyline.length > 1) ? driver.polyline[1] : driver.targetPos);

        if (!state.tacticalMarkers[driverKey]) {
            const truckBeacon = createLiveProfileMarkerIcon(driver, heading);

            const truckMarker = L.marker([lat, lng], { icon: truckBeacon }).addTo(state.tacticalMasterMap);
            truckMarker.on('click', () => {
                state.selectedDriverId = driver.id;
                updateTurnByTurnNavBanner(driver);
            });
            truckMarker.on('dblclick', (e) => {
                if (state.multiNodeSelectionMode) {
                    if (e && e.originalEvent) L.DomEvent.stopPropagation(e);
                    handleOfficerMapDoubleClick(e.latlng.lat, e.latlng.lng);
                }
            });
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
            const truckBeacon = createLiveProfileMarkerIcon(driver, heading);
            state.tacticalMarkers[driverKey].setIcon(truckBeacon);
            const arrowEl = document.getElementById(`heading-arrow-${driver.id}`);
            if (arrowEl && heading !== undefined) {
                arrowEl.style.transform = `rotate(${heading}deg)`;
            }
        }

        const polyColor = driver.isObstructed ? '#ef4444' : driverColor;
        const pastelColor = getDriverPastelColor(driverColor, driver.id);
        const { completedCoords, activeCoords, upcomingCoords } = splitRouteSegments(driver);
        const activeLineCoords = activeCoords.length > 0 ? activeCoords : (completedCoords.length > 0 ? [] : ((driver.polyline && driver.polyline.length > 1) ? driver.polyline : (typeof getRoadSnappedPath === 'function' ? getRoadSnappedPath([lat, lng], [targetLat, targetLng]) : [])));

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

        const obstructionActionBtn = driver.isObstructed ? `
            <button onclick="clearDriverObstruction(${driver.id})" class="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold mt-1.5 w-full flex items-center justify-center gap-1.5 shadow">
                <i class="fa-solid fa-road"></i> Reopen Corridor / Clear Blockade
            </button>
        ` : '';

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
                ${obstructionActionBtn}
                <button onclick="advanceDriverLeg(${driver.id})" class="route-advance-btn">
                    <i class="fa-solid fa-forward-step"></i> Advance to Next Stop
                </button>
                <button onclick="clearDriverRoute(${driver.id})" class="route-clear-btn">
                    <i class="fa-solid fa-xmark"></i> Clear Route
                </button>
            </div>
        `;

        const onRouteClick = (e) => {
            if (state.multiNodeSelectionMode) return;
            if (e && e.originalEvent) L.DomEvent.stopPropagation(e);
            else if (e && e.stopPropagation) e.stopPropagation();
            handleRouteSegmentClick(driver, e ? e.latlng : null, e, state.tacticalMasterMap);
        };

        const onRouteDblClick = (e) => {
            if (state.multiNodeSelectionMode) {
                if (e && e.originalEvent) L.DomEvent.stopPropagation(e);
                handleOfficerMapDoubleClick(e.latlng.lat, e.latlng.lng);
            }
        };

        // 0. Invisible Hit Target for effortless clicking
        const hitPolyKey = `poly-${driver.id}-hit`;
        const fullHitCoords = (driver.polyline && driver.polyline.length > 1) ? driver.polyline : (activeLineCoords.length > 0 ? activeLineCoords : []);
        if (!state.tacticalPolylines[hitPolyKey]) {
            const hitPoly = L.polyline(fullHitCoords, {
                color: '#000000',
                weight: 24,
                opacity: 0,
                interactive: true
            }).addTo(state.tacticalMasterMap);
            hitPoly.on('click', onRouteClick);
            hitPoly.on('dblclick', onRouteDblClick);
            state.tacticalPolylines[hitPolyKey] = hitPoly;
        } else {
            state.tacticalPolylines[hitPolyKey].setLatLngs(fullHitCoords);
        }

        // 1. Completed segment in pastel tint
        const compPolyKey = `poly-${driver.id}-completed`;
        if (!state.tacticalPolylines[compPolyKey]) {
            const compPoly = L.polyline(completedCoords, {
                color: pastelColor,
                weight: 3.5,
                opacity: 0.60
            }).addTo(state.tacticalMasterMap);
            compPoly.on('click', onRouteClick);
            compPoly.on('dblclick', onRouteDblClick);
            state.tacticalPolylines[compPolyKey] = compPoly;
        } else {
            state.tacticalPolylines[compPolyKey].setLatLngs(completedCoords);
            state.tacticalPolylines[compPolyKey].setStyle({
                color: pastelColor,
                weight: 3.5,
                opacity: 0.60
            });
        }

        // 2. Active segment in vibrant dashed pulsing line
        if (!state.tacticalPolylines[polyKey]) {
            const poly = L.polyline(activeLineCoords, {
                color: polyColor,
                weight: 4.8,
                opacity: 0.95,
                dashArray: '8, 12',
                className: 'pulsing-route-vector'
            }).addTo(state.tacticalMasterMap);
            poly.on('click', onRouteClick);
            poly.on('dblclick', onRouteDblClick);
            poly.on('mouseover', () => poly.setStyle({ weight: 6, opacity: 1 }));
            poly.on('mouseout', () => poly.setStyle({ weight: 4.8, opacity: 0.95 }));
            state.tacticalPolylines[polyKey] = poly;
        } else {
            state.tacticalPolylines[polyKey].setLatLngs(activeLineCoords);
            state.tacticalPolylines[polyKey].setStyle({
                color: polyColor,
                weight: 4.8,
                opacity: 0.95,
                dashArray: '8, 12',
                className: 'pulsing-route-vector'
            });
        }

        // 3. Upcoming segments in vibrant solid line
        const upcomingPolyKey = `poly-${driver.id}-upcoming`;
        if (!state.tacticalPolylines[upcomingPolyKey]) {
            const upPoly = L.polyline(upcomingCoords, {
                color: polyColor,
                weight: 3.8,
                opacity: 0.85
            }).addTo(state.tacticalMasterMap);
            upPoly.on('click', onRouteClick);
            upPoly.on('dblclick', onRouteDblClick);
            state.tacticalPolylines[upcomingPolyKey] = upPoly;
        } else {
            state.tacticalPolylines[upcomingPolyKey].setLatLngs(upcomingCoords);
            state.tacticalPolylines[upcomingPolyKey].setStyle({
                color: polyColor,
                weight: 3.8,
                opacity: 0.85
            });
        }

        // 4. Render numbered sequence badges above assigned stops
        const seqList = (driver.routeSequence && driver.routeSequence.length > 0)
            ? driver.routeSequence
            : [{ seq: 1, name: driver.node, lat: targetLat, lng: targetLng, color: polyColor }];

        // Clean up stale sequence markers for this driver beyond current sequence count
        if (state.tacticalSequenceMarkers) {
            Object.keys(state.tacticalSequenceMarkers).forEach(key => {
                if (key.startsWith(`seq-${driver.id}-`)) {
                    const sNum = parseInt(key.replace(`seq-${driver.id}-`, ''));
                    if (sNum > seqList.length) {
                        state.tacticalMasterMap.removeLayer(state.tacticalSequenceMarkers[key]);
                        delete state.tacticalSequenceMarkers[key];
                    }
                }
            });
        }

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

            const isCompleted = stop.status === 'COMPLETED';
            const isCurrentTarget = !isCompleted && (seqList.find(s => s.status !== 'COMPLETED') === stop);
            const badgeClasses = `sequence-badge ${isCompleted ? 'sequence-badge-completed' : ''} ${isCurrentTarget ? 'badge-current-target' : ''}`;
            const badgeContent = isCompleted ? '✓' : seqNum;

            const seqIcon = L.divIcon({
                className: 'node-sequence-marker',
                html: `
                    <div class="${badgeClasses}" style="border-color:${isCompleted ? '#10b981' : badgeColor}; background:${isCompleted ? '#0d1117' : badgeColor}; box-shadow: 0 0 12px ${isCompleted ? '#10b981' : badgeColor}">
                        ${badgeContent}
                    </div>
                    <div class="sequence-label">${stop.name || ('Stop #' + seqNum)}</div>
                `,
                iconSize: [44, 44],
                iconAnchor: [22, 22]
            });

            if (!state.tacticalSequenceMarkers[seqKey]) {
                const seqMarker = L.marker([stopLat, stopLng], { icon: seqIcon, zIndexOffset: 1000 }).addTo(state.tacticalMasterMap);
                seqMarker.on('click', (e) => {
                    if (state.multiNodeSelectionMode) return;
                    if (e && e.originalEvent) L.DomEvent.stopPropagation(e);
                    else if (e && e.stopPropagation) e.stopPropagation();
                    openDestinationInfoModal(driver, stop);
                });
                seqMarker.on('dblclick', (e) => {
                    if (state.multiNodeSelectionMode) {
                        if (e && e.originalEvent) L.DomEvent.stopPropagation(e);
                        handleOfficerMapDoubleClick(e.latlng.lat, e.latlng.lng);
                    }
                });
                state.tacticalSequenceMarkers[seqKey] = seqMarker;
            } else {
                state.tacticalSequenceMarkers[seqKey].setLatLng([stopLat, stopLng]);
                state.tacticalSequenceMarkers[seqKey].setIcon(seqIcon);
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
    if (state.tacticalPolylines) {
        if (state.tacticalPolylines[`poly-${driver.id}`]) {
            state.tacticalPolylines[`poly-${driver.id}`].setLatLngs([driver.currentPos]);
            state.tacticalPolylines[`poly-${driver.id}`].closePopup();
        }
        if (state.tacticalPolylines[`poly-${driver.id}-completed`]) {
            state.tacticalPolylines[`poly-${driver.id}-completed`].setLatLngs([]);
        }
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
        if (state.driverCompletedPolyline) {
            state.driverCompletedPolyline.setLatLngs([]);
        }
        if (state.fullMapPoly) {
            state.fullMapPoly.setLatLngs([driver.currentPos]);
        }
        if (state.fullMapCompletedPoly) {
            state.fullMapCompletedPoly.setLatLngs([]);
        }
        renderDriverSequenceMarkers(driver);
        updateDriverNavigationHUD(driver);
        renderDriverLegsList(driver);
    }

    audioEngine.triggerCommandAudioBroadcast(`Route vector cleared for Unit #${driver.id} ${driver.name}. Standing by for next dispatch directive.`);
    alert(`❌ Route line for Unit #${driver.id} (${driver.name}) has been cleared.`);
}

/**
 * Dynamic Leg Progression (Spec 2)
 * Advances operative to next stop, toggling completed leg into pastel and active into dashed flow
 */
async function advanceDriverLeg(driverId) {
    audioEngine.playBeep(880, 0.12);
    const driver = state.fleet.find(d => d.id === driverId);
    if (!driver) return;

    if (!driver.routeSequence || driver.routeSequence.length === 0) {
        alert("No active route sequence found for this operative.");
        return;
    }

    let responseData = null;
    if (state.wsConnected && !state.simulatedOffline) {
        try {
            const res = await fetch(`${CONFIG.API_URL}/fleet/${driverId}/advance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                responseData = await res.json();
            }
        } catch (e) {
            console.warn('API advance failed, falling back to offline progression:', e);
        }
    }

    if (responseData && responseData.driver) {
        const assigned = responseData.driver;
        const idx = state.fleet.findIndex(d => d.id === assigned.id);
        if (idx !== -1) {
            state.fleet[idx] = assigned;
        }
    } else {
        // Offline progression simulation
        const stopIdx = driver.routeSequence.findIndex(s => s.status !== 'COMPLETED');
        if (stopIdx === -1) {
            alert(`All stops for Unit #${driver.id} are already completed!`);
            return;
        }
        const clearedStop = driver.routeSequence[stopIdx];
        clearedStop.status = 'COMPLETED';
        driver.currentPos = [clearedStop.lat, clearedStop.lng];
        if (driver.legs && driver.legs[stopIdx]) {
            driver.legs[stopIdx].status = 'COMPLETED';
        }
        if (!driver.isRescue && driver.stock > 0) {
            const deliverCount = Math.min(driver.stock, clearedStop.demand || 25);
            driver.stock = Math.max(0, driver.stock - deliverCount);
            driver.deliveredTotal = (driver.deliveredTotal || 0) + deliverCount;
        }
        const nextStop = driver.routeSequence.find(s => s.status !== 'COMPLETED');
        if (nextStop) {
            nextStop.status = 'IN_PROGRESS';
            driver.node = nextStop.name;
            driver.targetPos = [nextStop.lat, nextStop.lng];
            if (driver.legs) {
                const nextLeg = driver.legs.find(l => l.status !== 'COMPLETED');
                if (nextLeg) nextLeg.status = 'IN_PROGRESS';
            }
        } else {
            driver.missionStatus = 'DELIVERED';
            driver.node = `Delivered: ${clearedStop.name}`;
        }
        driver.lastUpdated = new Date().toISOString();
        await offlineStore.updateDriver(driver);
    }

    await offlineStore.saveFleet(state.fleet);
    const updated = state.fleet.find(d => d.id === driverId);

    // Update all UI components
    updateDriverCardUI(updated);
    updateMiniMapPolyline(updated.id);
    renderTacticalMasterMapLayers();
    if (state.selectedDriverId === updated.id) {
        populateExpandedSidebar(updated);
        renderDriverSequenceMarkers(updated);
        updateDriverNavigationHUD(updated);
        renderDriverLegsList(updated);
    }
    if (state.user && state.user.role === 'DRIVER' && state.user.id === updated.id) {
        initDriverInterface(updated);
    }
    updateTurnByTurnNavBanner(updated);

    audioEngine.triggerCommandAudioBroadcast(`Operative ${updated.name} cleared stop and advanced to next sector.`);
    showBroadcastToast(`Operative ${updated.name} reached and cleared stop! Next vector engaged.`);
}

// ==========================================
// 8B. EMERGENCY MULTI-NODE DISPATCH WORKFLOW (SPEC 4, 5, 6, 7 & TESTS A-E)
// ==========================================

function toggleMultiNodeSelectionMode(forceState = null) {
    if (forceState !== null) {
        state.multiNodeSelectionMode = !!forceState;
    } else {
        state.multiNodeSelectionMode = !state.multiNodeSelectionMode;
    }

    const btn = document.getElementById('btn-toggle-multi-node-mode');
    const label = document.getElementById('multi-node-btn-label');
    const drawer = document.getElementById('officer-pending-mission-drawer');

    if (state.multiNodeSelectionMode) {
        audioEngine.playBeep(920, 0.15);
        if (state.tacticalMasterMap) {
            state.tacticalMasterMap.doubleClickZoom.disable();
        }
        if (btn) {
            btn.className = "px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border-2 border-amber-400 text-amber-300 font-extrabold rounded-xl text-xs transition flex items-center space-x-2 shadow-[0_0_15px_rgba(245,158,11,0.5)] cursor-pointer";
        }
        if (label) {
            label.innerHTML = `⚡ Multi-Node Mode: <span class="text-white font-extrabold underline">ACTIVE</span>`;
        }
        if (drawer) {
            drawer.classList.remove('hidden');
            drawer.classList.add('flex');
        }
        populatePendingMissionDrivers();
        renderPendingMissionNodes();
        renderPendingMissionMarkers();
        showBroadcastToast('⚡ Emergency Multi-Node Mode ACTIVE: Double-click map to place stops. Double-click zoom disabled.');
    } else {
        audioEngine.playBeep(640, 0.1);
        if (state.tacticalMasterMap) {
            state.tacticalMasterMap.doubleClickZoom.enable();
        }
        if (btn) {
            btn.className = "px-3 py-1.5 bg-[#161b22] hover:bg-[#21262d] border border-amber-400/50 text-amber-400 font-bold rounded-xl text-xs transition flex items-center space-x-2 shadow-lg cursor-pointer";
        }
        if (label) {
            label.innerText = `⚡ Multi-Node Mode: OFF`;
        }
        if (drawer) {
            drawer.classList.add('hidden');
            drawer.classList.remove('flex');
        }
        clearAllPendingMissionMarkers();
        state.pendingMissionNodes = [];
        showBroadcastToast('Multi-Node Mode deactivated. Standard map controls restored.');
    }
}

function populatePendingMissionDrivers() {
    const select = document.getElementById('pending-mission-driver-select');
    if (!select) return;
    select.innerHTML = state.fleet.map(d => {
        const isSel = (d.id === state.selectedDriverId) ? 'selected' : '';
        return `<option value="${d.id}" ${isSel}>Unit #${d.id}: ${d.name} (${d.node || 'Base'} - ${d.job || 'Relief'})</option>`;
    }).join('');
}

function handleOfficerMapDoubleClick(lat, lng) {
    audioEngine.playBeep(880, 0.1);

    // Prevent duplicate clicks within 50m (~0.00045 deg)
    const isDuplicate = state.pendingMissionNodes.some(n => Math.hypot(n.lat - lat, n.lng - lng) < 0.00045);
    if (isDuplicate) {
        audioEngine.playBeep(440, 0.15);
        showBroadcastToast('⚠️ Duplicate location ignored: Location is within 50m of an existing emergency node.');
        return;
    }

    // Rigorous accessibility & water boundary check
    const accessFn = (typeof validateDestinationAccessibility === 'function')
        ? validateDestinationAccessibility
        : (typeof window !== 'undefined' && window.validateDestinationAccessibility);
    const access = accessFn ? accessFn([lat, lng]) : { isAccessible: true, message: 'Verified' };

    const nodeNum = state.pendingMissionNodes.length + 1;
    const tempId = `pending-${Date.now()}-${nodeNum}`;
    const pendingNode = {
        tempId,
        name: `Emergency Node ${nodeNum}`,
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        seq: nodeNum,
        isAccessible: access.isAccessible,
        accessReason: access.reason || (access.isAccessible ? 'ROAD_CONNECTED' : 'UNREACHABLE'),
        roadAccessPoint: access.roadAccessPoint || [lat, lng],
        distanceToRoadMeters: access.distanceToRoadMeters || 0,
        message: access.message || ''
    };

    state.pendingMissionNodes.push(pendingNode);

    if (!access.isAccessible) {
        audioEngine.playEmergencySiren();
        showBroadcastToast(`⚠️ Destination UNREACHABLE: ${access.message}`);
    } else {
        showBroadcastToast(`📍 Added Pending Node ${nodeNum} at [${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
    }

    previewPendingMissionQuantumOrder();
}

function renderPendingMissionMarkers() {
    if (!state.tacticalMasterMap) return;
    if (!state.pendingMissionMarkers) state.pendingMissionMarkers = {};

    // Remove markers that are no longer in state.pendingMissionNodes
    const currentIds = new Set(state.pendingMissionNodes.map(n => n.tempId));
    Object.keys(state.pendingMissionMarkers).forEach(id => {
        if (!currentIds.has(id)) {
            state.tacticalMasterMap.removeLayer(state.pendingMissionMarkers[id]);
            delete state.pendingMissionMarkers[id];
        }
    });

    // Add or update markers
    state.pendingMissionNodes.forEach(node => {
        const badgeClass = !node.isAccessible ? 'badge-unreachable' : 'badge-accessible';
        const badgeBorder = !node.isAccessible ? '#ef4444' : '#f59e0b';
        const badgeBg = !node.isAccessible ? '#450a0a' : '#0d1117';

        const icon = L.divIcon({
            className: 'pending-node-marker',
            html: `
                <div class="pending-node-badge ${badgeClass}" style="border-color:${badgeBorder}; background:${badgeBg};">
                    ${node.seq || '!'}
                </div>
                <div class="pending-node-label">${node.name}</div>
            `,
            iconSize: [36, 48],
            iconAnchor: [18, 24]
        });

        if (!state.pendingMissionMarkers[node.tempId]) {
            const marker = L.marker([node.lat, node.lng], {
                icon,
                draggable: true,
                zIndexOffset: 2000
            }).addTo(state.tacticalMasterMap);

            marker.on('dragend', (e) => {
                const pos = marker.getLatLng();
                node.lat = Number(pos.lat.toFixed(6));
                node.lng = Number(pos.lng.toFixed(6));
                const accessFn = (typeof validateDestinationAccessibility === 'function')
                    ? validateDestinationAccessibility
                    : (typeof window !== 'undefined' && window.validateDestinationAccessibility);
                const access = accessFn ? accessFn([node.lat, node.lng]) : { isAccessible: true };
                node.isAccessible = access.isAccessible;
                node.accessReason = access.reason;
                node.message = access.message;
                node.roadAccessPoint = access.roadAccessPoint || [node.lat, node.lng];
                previewPendingMissionQuantumOrder();
            });

            marker.bindPopup(`
                <div class="p-2 font-sans text-xs space-y-1.5">
                    <p class="font-extrabold text-white text-xs">${node.name}</p>
                    <p class="text-[10px] ${node.isAccessible ? 'text-emerald-400' : 'text-red-400'} font-bold">
                        Status: ${node.isAccessible ? 'ROAD ACCESSIBLE' : 'UNREACHABLE'}
                    </p>
                    <p class="text-[9px] text-slate-400 font-mono">${node.lat.toFixed(4)}, ${node.lng.toFixed(4)}</p>
                    ${!node.isAccessible ? `<p class="text-[9px] text-red-300 italic">${node.message}</p>` : ''}
                    <button onclick="removePendingMissionNode('${node.tempId}')" class="w-full mt-1.5 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-[9px] uppercase">
                        Remove Node
                    </button>
                </div>
            `);

            state.pendingMissionMarkers[node.tempId] = marker;
        } else {
            state.pendingMissionMarkers[node.tempId].setLatLng([node.lat, node.lng]);
            state.pendingMissionMarkers[node.tempId].setIcon(icon);
        }
    });
}

function renderPendingMissionNodes() {
    const listEl = document.getElementById('pending-nodes-list');
    const countEl = document.getElementById('pending-nodes-count');
    if (countEl) countEl.innerText = state.pendingMissionNodes.length;

    if (!listEl) return;
    if (state.pendingMissionNodes.length === 0) {
        listEl.innerHTML = `<p class="text-center py-4 text-xs text-slate-500 italic">Double-click on the map to add destinations.</p>`;
        return;
    }

    listEl.innerHTML = state.pendingMissionNodes.map((n, idx) => {
        const isAcc = n.isAccessible;
        return `
            <div class="p-2 bg-[#010409] rounded-xl border ${isAcc ? 'border-[#30363d]' : 'border-red-500/80 bg-red-950/20'} flex items-center justify-between text-xs">
                <div class="flex items-center space-x-2">
                    <span class="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${isAcc ? 'bg-[#00f0ff] text-black' : 'bg-red-600 text-white'}">
                        ${n.seq || (idx + 1)}
                    </span>
                    <div>
                        <p class="font-bold text-white text-xs leading-none">${n.name}</p>
                        <p class="text-[9px] font-mono ${isAcc ? 'text-slate-400' : 'text-red-400 font-bold'}">
                            ${n.lat.toFixed(4)}, ${n.lng.toFixed(4)} • ${isAcc ? 'ROAD OK' : 'UNREACHABLE'}
                        </p>
                    </div>
                </div>
                <button onclick="removePendingMissionNode('${n.tempId}')" class="text-slate-400 hover:text-red-400 p-1 text-xs">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');
}

function removePendingMissionNode(tempId) {
    audioEngine.playBeep(600, 0.08);
    if (state.pendingMissionMarkers && state.pendingMissionMarkers[tempId]) {
        state.tacticalMasterMap.removeLayer(state.pendingMissionMarkers[tempId]);
        delete state.pendingMissionMarkers[tempId];
    }
    state.pendingMissionNodes = state.pendingMissionNodes.filter(n => n.tempId !== tempId);
    previewPendingMissionQuantumOrder();
}

function clearAllPendingMissionMarkers() {
    if (state.pendingMissionMarkers) {
        Object.keys(state.pendingMissionMarkers).forEach(id => {
            if (state.tacticalMasterMap && state.pendingMissionMarkers[id]) {
                state.tacticalMasterMap.removeLayer(state.pendingMissionMarkers[id]);
            }
        });
        state.pendingMissionMarkers = {};
    }
}

function previewPendingMissionQuantumOrder() {
    const drvSelect = document.getElementById('pending-mission-driver-select');
    const drvId = drvSelect ? parseInt(drvSelect.value) : (state.selectedDriverId || 1);
    const driver = state.fleet.find(d => d.id === drvId) || state.fleet[0];

    if (!driver || state.pendingMissionNodes.length === 0) {
        renderPendingMissionNodes();
        renderPendingMissionMarkers();
        const distEl = document.getElementById('pending-metric-dist');
        const etaEl = document.getElementById('pending-metric-eta');
        const fuelEl = document.getElementById('pending-metric-fuel');
        if (distEl) distEl.innerText = '0.0 km';
        if (etaEl) etaEl.innerText = '0.0 min';
        if (fuelEl) fuelEl.innerText = '0.0 L';
        return;
    }

    if (state.pendingMissionNodes.length === 1) {
        state.pendingMissionNodes[0].seq = 1;
        const route = (typeof calculateRoadRouteSync === 'function')
            ? calculateRoadRouteSync(driver.currentPos, [state.pendingMissionNodes[0].lat, state.pendingMissionNodes[0].lng])
            : { distanceKm: 2.4, etaMinutes: 4.8 };
        const dist = route.distanceKm || 2.4;
        const eta = route.etaMinutes || 4.8;
        const fuel = Number((dist * 0.138).toFixed(2));
        const distEl = document.getElementById('pending-metric-dist');
        const etaEl = document.getElementById('pending-metric-eta');
        const fuelEl = document.getElementById('pending-metric-fuel');
        if (distEl) distEl.innerText = `${dist} km`;
        if (etaEl) etaEl.innerText = `${eta} min`;
        if (fuelEl) fuelEl.innerText = `${fuel} L`;
        renderPendingMissionNodes();
        renderPendingMissionMarkers();
        return;
    }

    // Execute Quantum TSP Optimization starting from driver.currentPos
    const tspFn = (typeof solveQuantumTSP === 'function')
        ? solveQuantumTSP
        : (typeof quantumEngine !== 'undefined' ? (s, st, b) => quantumEngine.solveQuantumTSP(s, st, b) : null);

    if (tspFn) {
        const optimized = tspFn(driver.currentPos, state.pendingMissionNodes, driver.isObstructed);
        // Map optimized order back to state.pendingMissionNodes
        optimized.forEach(optStop => {
            const match = state.pendingMissionNodes.find(n => n.tempId === optStop.tempId);
            if (match) {
                match.seq = optStop.seq;
            }
        });
        // Sort in order of sequence 1, 2, 3...
        state.pendingMissionNodes.sort((a, b) => (a.seq || 0) - (b.seq || 0));
    }

    // Compute route metrics across optimized sequential stops
    const multiFn = (typeof solveQuantumMultiNodeRoute === 'function')
        ? solveQuantumMultiNodeRoute
        : (typeof quantumEngine !== 'undefined' ? (s, seq, b) => quantumEngine.solveQuantumMultiNodeRoute(s, seq, b, false) : null);

    if (multiFn) {
        const multi = multiFn(driver.currentPos, state.pendingMissionNodes, driver.isObstructed, false);
        const distEl = document.getElementById('pending-metric-dist');
        const etaEl = document.getElementById('pending-metric-eta');
        const fuelEl = document.getElementById('pending-metric-fuel');
        if (distEl) distEl.innerText = `${multi.totalDistanceKm} km`;
        if (etaEl) etaEl.innerText = `${multi.totalEtaMinutes} min`;
        if (fuelEl) fuelEl.innerText = `${multi.totalFuelBurnLiters} L`;
    }

    renderPendingMissionNodes();
    renderPendingMissionMarkers();
}

async function confirmAndAssignMission() {
    audioEngine.playBeep(980, 0.2);

    // Security check: Only Officers can assign missions
    if (state.user && state.user.role === 'DRIVER') {
        alert('Access Denied: Only Command Officers are authorized to assign emergency missions.');
        return;
    }

    if (!state.pendingMissionNodes || state.pendingMissionNodes.length === 0) {
        alert('Please double-click the tactical map to select at least 1 emergency destination node.');
        return;
    }

    // Check if any destination is unreachable
    const unreachable = state.pendingMissionNodes.find(n => !n.isAccessible);
    if (unreachable) {
        audioEngine.playEmergencySiren();
        alert(`❌ CANNOT DISPATCH MISSION:\n\nDestination "${unreachable.name}" is unreachable: ${unreachable.message}\n\nPlease drag the marker to an accessible road or remove it before confirming assignment.`);
        return;
    }

    const drvSelect = document.getElementById('pending-mission-driver-select');
    const drvId = drvSelect ? parseInt(drvSelect.value) : (state.selectedDriverId || 1);
    const driver = state.fleet.find(d => d.id === drvId) || state.fleet[0];

    const missionPayload = {
        destinations: state.pendingMissionNodes.map(n => ({
            id: n.tempId,
            name: n.name,
            lat: n.lat,
            lng: n.lng,
            demand: 50,
            supplyType: driver.job || 'Relief Supplies'
        })),
        optimizeOrder: true
    };

    try {
        const res = await fetch(`${CONFIG.API_URL}/fleet/${driver.id}/mission`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-role': 'OFFICER'
            },
            body: JSON.stringify(missionPayload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            alert(`Mission Assignment Failed: ${data.message || 'Server error'}`);
            return;
        }

        // Update driver state in local fleet
        const dIdx = state.fleet.findIndex(d => d.id === driver.id);
        if (dIdx !== -1 && data.driver) {
            state.fleet[dIdx] = data.driver;
            await offlineStore.updateDriver(data.driver);
        }

        // Clean up pending mission markers and drawer
        clearAllPendingMissionMarkers();
        state.pendingMissionNodes = [];
        toggleMultiNodeSelectionMode(false);

        // Re-render tactical layers and HUD
        renderTacticalMasterMapLayers();
        updateMiniMapPolyline(driver.id);
        updateDriverCardUI(data.driver || driver);

        if (state.selectedDriverId === driver.id) {
            populateExpandedSidebar(data.driver || driver);
            renderDriverSequenceMarkers(data.driver || driver);
            updateDriverNavigationHUD(data.driver || driver);
            renderDriverLegsList(data.driver || driver);
        }
        if (state.user && state.user.role === 'DRIVER' && state.user.id === driver.id) {
            initDriverInterface(data.driver || driver);
        }
        updateTurnByTurnNavBanner(data.driver || driver);

        audioEngine.triggerCommandAudioBroadcast(`Mission assigned to Unit #${driver.id} ${driver.name}. ${data.optimizedSequence.length} sequential sectors locked via Quantum QAOA.`);
        showBroadcastToast(`✅ Mission Assigned! ${data.optimizedSequence.length} stops deployed to Unit #${driver.id} (${driver.name}) via Quantum QAOA tour!`);
    } catch (err) {
        console.error('Error dispatching mission:', err);
        alert(`Failed to dispatch mission to Unit #${driver.id}. Check server connection.`);
    }
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
            polyline: (typeof getRoadSnappedPath === 'function')
                ? getRoadSnappedPath([baseLoc.lat, baseLoc.lng], [baseLoc.lat + 0.005, baseLoc.lng + 0.005], false)
                : [[baseLoc.lat, baseLoc.lng], [baseLoc.lat + 0.005, baseLoc.lng + 0.005]],
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

        const cleanName = locationName.trim();
        const resolvedCoord = (typeof resolveStreetLocation === 'function') 
            ? resolveStreetLocation(cleanName) 
            : (typeof findNearestRoadNode === 'function' ? findNearestRoadNode([16.5062, 80.6120]) : [16.5062, 80.6120]);

        const newStop = {
            id: 100 + (targetDriver.routeSequence ? targetDriver.routeSequence.length : 1),
            seq: (targetDriver.routeSequence ? targetDriver.routeSequence.length : 0) + 1,
            name: cleanName,
            lat: resolvedCoord[0],
            lng: resolvedCoord[1],
            demand: 120,
            supplyType: targetDriver.job || 'Food Supply',
            urgency: 'HIGH',
            hazard: 'Moderate Rain Hazard',
            color: '#f59e0b',
            rain: '22mm/h',
            wind: '32 km/h',
            status: "PENDING"
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
    const addedStop = responseData.newStop || (driver && driver.routeSequence && driver.routeSequence[driver.routeSequence.length - 1]);
    if (addedStop && typeof RESCUE_LOCATIONS !== 'undefined') {
        const existingNode = RESCUE_LOCATIONS.find(l => l.name.toLowerCase() === addedStop.name.toLowerCase() || (Math.hypot(l.lat - addedStop.lat, l.lng - addedStop.lng) < 0.002));
        if (!existingNode) {
            RESCUE_LOCATIONS.push({
                id: addedStop.id || (RESCUE_LOCATIONS.length + 1),
                name: addedStop.name,
                lat: addedStop.lat,
                lng: addedStop.lng,
                demand: addedStop.demand || 100,
                hazard: addedStop.hazard || 'Moderate Rain Hazard',
                rain: addedStop.rain || '20mm/h',
                wind: addedStop.wind || '25 km/h'
            });
        }
    }

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
// 9. ROUTE OBSTRUCTION & QUANTUM DETOUR (SPEC 4 & CLICK-TO-REPORT CLOSED ROAD)
// ==========================================

/**
 * Handle Route Segment Click (Requirement 3)
 * Snaps click coordinate to underlying road network edge, identifies road name,
 * and presents contextual Route Closed action and route telemetry.
 */
function handleRouteSegmentClick(driver, clickLatLng, event, map) {
    if (!driver) return;
    audioEngine.playBeep(780, 0.08);

    const targetMap = map || state.tacticalMasterMap || state.driverMap || state.fullMap;
    const clickCoords = (clickLatLng && clickLatLng.lat !== undefined)
        ? [clickLatLng.lat, clickLatLng.lng]
        : (Array.isArray(clickLatLng) ? clickLatLng : (driver.currentPos || [16.5062, 80.6120]));

    // Snap to real road network edge in Vijayawada
    let nearestEdge = null;
    if (typeof findNearestRoadEdge === 'function') {
        nearestEdge = findNearestRoadEdge(clickCoords, 1.2);
    }

    if (!nearestEdge && typeof findNearestRoadEdge === 'function' && driver.currentPos) {
        nearestEdge = findNearestRoadEdge(driver.currentPos, 1.5);
    }

    const roadName = nearestEdge ? nearestEdge.name : 'Prakasam Barrage Deck (BARRAGE_NORTH ↔ BARRAGE_APPROACH_N)';
    const edgeTuple = nearestEdge ? nearestEdge.edge : ['BARRAGE_NORTH', 'BARRAGE_APPROACH_N'];

    const selectedSegment = {
        driverId: driver.id,
        driverName: driver.name,
        edge: edgeTuple,
        name: roadName,
        latlng: (clickLatLng && clickLatLng.lat !== undefined) ? clickLatLng : { lat: clickCoords[0], lng: clickCoords[1] }
    };
    state.selectedRoadSegment = selectedSegment;

    // Update Route Info modal segment box in case user opens panel
    const segNameEl = document.getElementById('route-info-segment-name');
    if (segNameEl) segNameEl.innerText = roadName;

    // Open contextual action popup on map at clicked coordinates
    if (targetMap && typeof targetMap.openPopup === 'function' && selectedSegment.latlng) {
        const popupContent = `
            <div class="tactical-popup p-2.5 text-xs font-sans min-w-[220px]">
                <div class="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-700">
                    <span class="font-extrabold text-amber-400 flex items-center gap-1.5 truncate">
                        <i class="fa-solid fa-road"></i>
                        <span class="truncate">${roadName}</span>
                    </span>
                    <span class="text-[8px] px-1.5 py-0.2 rounded font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">ROAD SEGMENT</span>
                </div>
                <p class="text-[10px] text-white">Assigned: Unit #${driver.id} (${driver.name})</p>
                <p class="text-[9px] text-slate-300 mt-0.5">Active Target: ${driver.node}</p>
                <div class="mt-2 space-y-1.5">
                    <button onclick="confirmAndBlockRouteSegment(${driver.id})" class="w-full py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-bold flex items-center justify-center gap-1.5 shadow transition">
                        <i class="fa-solid fa-road-barrier"></i> Route Closed
                    </button>
                    <button onclick="openRouteInfoPanel(state.fleet.find(d => d.id === ${driver.id}), state.selectedRoadSegment)" class="w-full py-1 bg-[#161b22] hover:bg-[#21262d] text-slate-300 border border-[#30363d] rounded text-[9px] font-bold flex items-center justify-center gap-1.5 transition">
                        <i class="fa-solid fa-route text-[#00f0ff]"></i> Open Route Telemetry
                    </button>
                </div>
            </div>
        `;
        L.popup({ offset: [0, -10], closeButton: true })
            .setLatLng([selectedSegment.latlng.lat, selectedSegment.latlng.lng])
            .setContent(popupContent)
            .openOn(targetMap);
    } else {
        openRouteInfoPanel(driver, selectedSegment);
    }
}

/**
 * Confirm and Block Route Segment (Requirement 3)
 * Prompts "Report [Road Name] closed?", marks edge blocked, reroutes driver from LIVE GPS
 * to the SAME destination, preserves sequence order strictly without reordering/skipping.
 */
async function confirmAndBlockRouteSegment(driverId) {
    const id = driverId || state.selectedRoadSegment?.driverId || state.selectedDriverId || (state.fleet[0] ? state.fleet[0].id : 1);
    const driver = state.fleet.find(d => d.id === id) || state.fleet[0];
    if (!driver) return;

    const segment = state.selectedRoadSegment || (typeof findNearestRoadEdge === 'function' ? findNearestRoadEdge(driver.currentPos, 1.5) : null);
    const segmentName = segment ? (segment.name || (segment.edge ? formatRoadEdgeName(segment.edge[0], segment.edge[1]) : 'Prakasam Barrage Deck')) : 'Prakasam Barrage Deck';
    const edge = segment ? (segment.edge || ['BARRAGE_NORTH', 'BARRAGE_APPROACH_N']) : ['BARRAGE_NORTH', 'BARRAGE_APPROACH_N'];

    // Confirmation Prompt
    const confirmed = confirm(`Report ${segmentName} closed?`);
    if (!confirmed) return;

    audioEngine.playBeep(440, 0.25);
    driver.isObstructed = true;

    // Record blocked edge on driver
    driver.blockedEdges = driver.blockedEdges || [];
    const edgeExists = driver.blockedEdges.some(e => (e[0] === edge[0] && e[1] === edge[1]) || (e[0] === edge[1] && e[1] === edge[0]));
    if (!edgeExists) {
        driver.blockedEdges.push(edge);
    }

    // Recalculate route strictly from LIVE GPS position to SAME destination
    // optimizeTSP is set to FALSE to preserve sequence order strictly
    if (driver.routeSequence && driver.routeSequence.length > 1) {
        const multiResult = quantumEngine.solveQuantumMultiNodeRoute(driver.currentPos, driver.routeSequence, true, false, driver.blockedEdges);
        driver.polyline = multiResult.fullPolyline;
        driver.legs = multiResult.legs;
        driver.totalDistanceKm = multiResult.totalDistanceKm;
        driver.totalFuelBurnLiters = multiResult.totalFuelBurnLiters;
        driver.totalEtaMinutes = multiResult.totalEtaMinutes;
        driver.roadColor = multiResult.roadColor;
    } else {
        const reroute = quantumEngine.solveOptimalRoute(driver.currentPos, driver.targetPos, true, driver.blockedEdges);
        driver.polyline = reroute.path;
        driver.totalDistanceKm = reroute.distanceKm;
        driver.totalFuelBurnLiters = reroute.quantumFuelLiters;
    }
    driver.fuel += 2.0;
    driver.lastUpdated = new Date().toISOString();

    await offlineStore.updateDriver(driver);
    await offlineStore.saveFleet(state.fleet);

    // Close any open popups or modals
    if (state.tacticalMasterMap) state.tacticalMasterMap.closePopup();
    if (state.driverMap) state.driverMap.closePopup();
    if (state.fullMap) state.fullMap.closePopup();
    closeModal('route-info-modal');

    // Send to backend obstruction endpoint
    if (state.wsConnected && !state.simulatedOffline) {
        try {
            await fetch(`${CONFIG.API_URL}/fleet/${driver.id}/obstruction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    blockedEdge: edge,
                    segmentName,
                    role: state.user?.role || 'DRIVER',
                    isDriverSimulation: true
                })
            });
        } catch (e) {
            console.warn('Backend obstruction notification fallback:', e);
            await offlineStore.queueOfflineAction({ type: 'ROUTE_OBSTRUCTION', driverId: driver.id, blockedEdge: edge, segmentName });
        }
    } else {
        await offlineStore.queueOfflineAction({ type: 'ROUTE_OBSTRUCTION', driverId: driver.id, blockedEdge: edge, segmentName });
    }

    // Refresh UI
    updateDriverCardUI(driver);
    updateMiniMapPolyline(driver.id);
    renderTacticalMasterMapLayers();
    if (state.selectedDriverId === driver.id) {
        populateExpandedSidebar(driver);
        renderDriverSequenceMarkers(driver);
        updateDriverNavigationHUD(driver);
        renderDriverLegsList(driver);
    }
    if (state.user && state.user.role === 'DRIVER') {
        initDriverInterface(driver);
    }
    updateTurnByTurnNavBanner(driver);

    // Audio & Toast Alert
    audioEngine.triggerCommandAudioBroadcast(`Tactical corridor closed for Operative ${driver.name}. Detour engaged around ${segmentName}.`);
    showBroadcastToast(`⚠️ Route Closed: ${segmentName} reported closed. Quantum detour engaged.`);

    const cueEl = document.getElementById('drv-nav-cue');
    if (cueEl) cueEl.innerText = "DETOUR ENGAGED: Corridor Obstructed - Quantum Bypassing Active";
}

function triggerRouteBlockForSelectedSegment() {
    confirmAndBlockRouteSegment(state.selectedRoadSegment?.driverId || state.selectedDriverId);
}

async function triggerRouteClosedFromDriver(driverId) {
    await confirmAndBlockRouteSegment(driverId);
}

async function triggerRouteBlock() {
    await confirmAndBlockRouteSegment(state.selectedDriverId);
}

async function clearDriverObstruction(driverId) {
    const id = driverId || state.selectedDriverId || (state.fleet[0] ? state.fleet[0].id : 1);
    const driver = state.fleet.find(d => d.id === id) || state.fleet[0];
    if (!driver) return;

    audioEngine.playBeep(780, 0.15);
    driver.isObstructed = false;
    driver.blockedEdges = [];

    // Normal quantum road route restoration
    if (driver.routeSequence && driver.routeSequence.length > 1) {
        const multiResult = quantumEngine.solveQuantumMultiNodeRoute(driver.currentPos, driver.routeSequence, false, false, []);
        driver.polyline = multiResult.fullPolyline;
        driver.legs = multiResult.legs;
        driver.totalDistanceKm = multiResult.totalDistanceKm;
        driver.totalFuelBurnLiters = multiResult.totalFuelBurnLiters;
        driver.totalEtaMinutes = multiResult.totalEtaMinutes;
        driver.roadColor = multiResult.roadColor;
    } else {
        const reroute = quantumEngine.solveOptimalRoute(driver.currentPos, driver.targetPos, false, []);
        driver.polyline = reroute.path;
        driver.totalDistanceKm = reroute.distanceKm;
        driver.totalFuelBurnLiters = reroute.quantumFuelLiters;
    }
    driver.lastUpdated = new Date().toISOString();

    await offlineStore.updateDriver(driver);
    await offlineStore.saveFleet(state.fleet);

    if (state.wsConnected && !state.simulatedOffline) {
        try {
            await fetch(`${CONFIG.API_URL}/fleet/${driver.id}/clear-obstruction`, { method: 'POST' });
        } catch (e) {
            console.warn('Backend clear-obstruction notification fallback:', e);
        }
    }

    // Update UI components
    updateDriverCardUI(driver);
    updateMiniMapPolyline(driver.id);
    renderTacticalMasterMapLayers();
    if (state.fullMap && state.selectedDriverId === driver.id) {
        expandDriverMap(driver.id);
    }
    if (state.user && state.user.role === 'DRIVER') {
        initDriverInterface(driver);
    }

    audioEngine.triggerCommandAudioBroadcast(`Corridor reopened for Operative ${driver.name}. Normal quantum vector restored.`);
    showBroadcastToast(`✅ Corridor Reopened: Blockade cleared by Command Officer.`);

    const cueEl = document.getElementById('drv-nav-cue');
    if (cueEl) cueEl.innerText = "NAVIGATION ACTIVE: Proceed along optimal road corridor";
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

        const isCompleted = stop.status === 'COMPLETED';
        const isCurrentTarget = !isCompleted && (seqList.find(s => s.status !== 'COMPLETED') === stop);
        const badgeClasses = `sequence-badge ${isCompleted ? 'sequence-badge-completed' : ''} ${isCurrentTarget ? 'badge-current-target' : ''}`;
        const badgeContent = isCompleted ? '✓' : seqNum;

        const seqIcon = L.divIcon({
            className: 'node-sequence-marker',
            html: `
                <div class="${badgeClasses}" style="border-color:${isCompleted ? '#10b981' : badgeColor}; background:${isCompleted ? '#0d1117' : badgeColor}; box-shadow: 0 0 12px ${isCompleted ? '#10b981' : badgeColor}">
                    ${badgeContent}
                </div>
                <div class="sequence-label">${stop.name || ('Stop #' + seqNum)}</div>
            `,
            iconSize: [44, 44],
            iconAnchor: [22, 22]
        });

        const m = L.marker([stop.lat, stop.lng], { icon: seqIcon, zIndexOffset: 1000 })
            .addTo(state.driverMap);
        m.on('click', (e) => {
            if (e && e.originalEvent) L.DomEvent.stopPropagation(e);
            else if (e && e.stopPropagation) e.stopPropagation();
            openDestinationInfoModal(driver, stop);
        });
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
    const color = driver.color || (typeof DRIVER_COLORS !== 'undefined' ? DRIVER_COLORS[driver.id] : '#00f0ff');
    const drvInitBadge = document.getElementById('drv-initials-badge');
    const drvSideInit = document.getElementById('drv-side-initials');
    if (drvInitBadge) {
        drvInitBadge.innerText = initials;
        drvInitBadge.style.backgroundColor = color;
    }
    if (drvSideInit) {
        drvSideInit.innerText = initials;
        drvSideInit.style.backgroundColor = color;
    }

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
                <button onclick="triggerRouteClosedFromDriver(${driver.id})" class="route-closed-btn">
                    <i class="fa-solid fa-ban"></i> ❌ Route Closed
                </button>
                <button onclick="advanceDriverLeg(${driver.id})" class="route-advance-btn">
                    <i class="fa-solid fa-forward-step"></i> Advance to Next Stop
                </button>
                <button onclick="clearDriverRoute(${driver.id})" class="route-clear-btn">
                    <i class="fa-solid fa-xmark"></i> Clear Route
                </button>
            </div>
        `;

        const { completedCoords, activeCoords, upcomingCoords } = splitRouteSegments(driver);
        const pastel = getDriverPastelColor(driverColor, driver.id);

        const heading = calculateHeading(driver.currentPos, (driver.polyline && driver.polyline.length > 1) ? driver.polyline[1] : driver.targetPos);
        const beaconIcon = createLiveProfileMarkerIcon(driver, heading);

        const onDriverRouteClick = (e) => {
            if (e && e.originalEvent) L.DomEvent.stopPropagation(e);
            else if (e && e.stopPropagation) e.stopPropagation();
            handleRouteSegmentClick(driver, e ? e.latlng : null, e, state.driverMap);
        };

        if (!state.driverMap) {
            state.driverMap = L.map('driver-map', { zoomControl: false, rotate: true, touchRotate: true }).setView([lat, lng], 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(state.driverMap);

            // Static high-contrast vehicle marker
            state.driverMarker = L.marker([lat, lng], { icon: beaconIcon })
                .addTo(state.driverMap)
                .bindPopup(`<b>${driver.name}</b><br>${driver.node}`);

            // Completed segment in pastel
            state.driverCompletedPolyline = L.polyline(completedCoords, {
                color: pastel,
                weight: 3.5,
                opacity: 0.60
            }).addTo(state.driverMap);
            state.driverCompletedPolyline.on('click', onDriverRouteClick);

            // Active segment in dashed pulsing vibrant line
            const allStopsDone = driver.routeSequence && driver.routeSequence.length > 0 && driver.routeSequence.every(s => s.status === 'COMPLETED');
            const activeLineCoords = allStopsDone ? [] : (activeCoords.length > 0 ? activeCoords : (upcomingCoords.length > 0 ? upcomingCoords : ((driver.polyline && driver.polyline.length > 1) ? driver.polyline : (typeof getRoadSnappedPath === 'function' ? getRoadSnappedPath([lat, lng], [targetLat, targetLng]) : []))));
            state.driverPolyline = L.polyline(activeLineCoords, {
                color: polyColor,
                weight: 4.8,
                opacity: 0.95,
                dashArray: '8, 12',
                className: 'pulsing-route-vector'
            }).addTo(state.driverMap);
            state.driverPolyline.on('click', onDriverRouteClick);

            // Upcoming segments in solid line
            state.driverUpcomingPolyline = L.polyline(upcomingCoords, {
                color: polyColor,
                weight: 3.8,
                opacity: 0.85
            }).addTo(state.driverMap);
            state.driverUpcomingPolyline.on('click', onDriverRouteClick);

            // Invisible hit target
            const fullDriverRoute = (driver.polyline && driver.polyline.length > 1) ? driver.polyline : activeLineCoords;
            state.driverHitPolyline = L.polyline(fullDriverRoute, {
                color: '#000000',
                weight: 24,
                opacity: 0,
                interactive: true
            }).addTo(state.driverMap);
            state.driverHitPolyline.on('click', onDriverRouteClick);
        } else {
            state.driverMap.setView([lat, lng], 14);
            state.driverMarker.setLatLng([lat, lng]);
            state.driverMarker.setIcon(beaconIcon);
            state.driverMarker.setPopupContent(`<b>${driver.name}</b><br>${driver.node}`);
            const arrowEl = document.getElementById(`heading-arrow-${driver.id}`);
            if (arrowEl && heading !== undefined) {
                arrowEl.style.transform = `rotate(${heading}deg)`;
            }
            if (!state.driverCompletedPolyline) {
                state.driverCompletedPolyline = L.polyline(completedCoords, {
                    color: pastel,
                    weight: 3.5,
                    opacity: 0.60
                }).addTo(state.driverMap);
                state.driverCompletedPolyline.on('click', onDriverRouteClick);
            } else {
                state.driverCompletedPolyline.setLatLngs(completedCoords);
                state.driverCompletedPolyline.setStyle({ color: pastel, weight: 3.5, opacity: 0.60 });
            }
            const allStopsDone = driver.routeSequence && driver.routeSequence.length > 0 && driver.routeSequence.every(s => s.status === 'COMPLETED');
            const activeLineCoords = allStopsDone ? [] : (activeCoords.length > 0 ? activeCoords : (upcomingCoords.length > 0 ? upcomingCoords : ((driver.polyline && driver.polyline.length > 1) ? driver.polyline : (typeof getRoadSnappedPath === 'function' ? getRoadSnappedPath([lat, lng], [targetLat, targetLng]) : []))));
            state.driverPolyline.setLatLngs(activeLineCoords);
            state.driverPolyline.setStyle({
                color: polyColor,
                weight: 4.8,
                opacity: 0.95,
                dashArray: '8, 12',
                className: 'pulsing-route-vector'
            });

            if (!state.driverUpcomingPolyline) {
                state.driverUpcomingPolyline = L.polyline(upcomingCoords, {
                    color: polyColor,
                    weight: 3.8,
                    opacity: 0.85
                }).addTo(state.driverMap);
                state.driverUpcomingPolyline.on('click', onDriverRouteClick);
            } else {
                state.driverUpcomingPolyline.setLatLngs(upcomingCoords);
                state.driverUpcomingPolyline.setStyle({ color: polyColor, weight: 3.8, opacity: 0.85 });
            }

            const fullDriverRoute = (driver.polyline && driver.polyline.length > 1) ? driver.polyline : activeLineCoords;
            if (!state.driverHitPolyline) {
                state.driverHitPolyline = L.polyline(fullDriverRoute, {
                    color: '#000000',
                    weight: 24,
                    opacity: 0,
                    interactive: true
                }).addTo(state.driverMap);
                state.driverHitPolyline.on('click', onDriverRouteClick);
            } else {
                state.driverHitPolyline.setLatLngs(fullDriverRoute);
            }
            state.driverMap.invalidateSize();
        }

        applyDriverMapOrientation();

        // Render numbered sequence badges above stops
        renderDriverSequenceMarkers(driver);

        // Render mission legs list in driver sidebar & floating drawer
        renderDriverLegsList(driver);

        // Update clean navigation HUD telemetry
        updateDriverNavigationHUD(driver);

        // Update Turn-by-Turn Navigation Banner
        updateTurnByTurnNavBanner(driver);

        // Start continuous live telemetry stream
        startDriverTelemetryStream(driver);
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
window.triggerRouteClosedFromDriver = triggerRouteClosedFromDriver;
window.clearDriverObstruction = clearDriverObstruction;
window.triggerDriverSOS = triggerDriverSOS;
window.pressNum = pressNum;
window.clearInput = clearInput;
window.confirmStock = confirmStock;
window.exportReportCSV = exportReportCSV;
window.executeNodeDispatchAndReroute = executeNodeDispatchAndReroute;
window.clearDriverRoute = clearDriverRoute;
window.advanceDriverLeg = advanceDriverLeg;
window.toggleDriverLegsDrawer = toggleDriverLegsDrawer;
window.renderDriverLegsList = renderDriverLegsList;
window.bindAllEventHandlers = bindAllEventHandlers;
window.calculateHeading = calculateHeading;
window.calculateRoadHeading = calculateRoadHeading;
window.createLiveProfileMarkerIcon = createLiveProfileMarkerIcon;
window.updateTacticalDriverMarker = updateTacticalDriverMarker;
window.computeTurnByTurnInstructions = computeTurnByTurnInstructions;
window.updateTurnByTurnNavBanner = updateTurnByTurnNavBanner;
window.startDriverTelemetryStream = startDriverTelemetryStream;
window.openRouteInfoPanel = openRouteInfoPanel;
window.handleRouteSegmentClick = handleRouteSegmentClick;
window.confirmAndBlockRouteSegment = confirmAndBlockRouteSegment;
window.triggerRouteBlockForSelectedSegment = triggerRouteBlockForSelectedSegment;
window.openDestinationInfoModal = openDestinationInfoModal;
window.submitDestinationUnreachableReport = submitDestinationUnreachableReport;
window.fetchAndRenderOfficerAlerts = fetchAndRenderOfficerAlerts;
window.renderOfficerAlertsList = renderOfficerAlertsList;
window.acknowledgeOfficerAlert = acknowledgeOfficerAlert;
window.toggleDriverMapOrientation = toggleDriverMapOrientation;
window.applyDriverMapOrientation = applyDriverMapOrientation;
window.toggleMultiNodeSelectionMode = toggleMultiNodeSelectionMode;
window.handleOfficerMapDoubleClick = handleOfficerMapDoubleClick;
window.renderPendingMissionMarkers = renderPendingMissionMarkers;
window.renderPendingMissionNodes = renderPendingMissionNodes;
window.removePendingMissionNode = removePendingMissionNode;
window.clearAllPendingMissionMarkers = clearAllPendingMissionMarkers;
window.previewPendingMissionQuantumOrder = previewPendingMissionQuantumOrder;
window.confirmAndAssignMission = confirmAndAssignMission;

// Immediate bind check if DOM is already ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    bindAllEventHandlers();
}
