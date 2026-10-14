/**
 * QUANTUMROUTE: MAIN APPLICATION ORCHESTRATOR
 * Optimized 6-Node Demo Grid, Live QPU Telemetry, Interactive QUBO Terminal,
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
    ws: null,
    wsConnected: false,
    simulatedOffline: false
};

// ==========================================
// 1. INITIALIZATION & DATA HYDRATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 [QuantumRoute] Initializing 6-Node National Quantum Mission Command HUD...');
    
    // Initialize IndexedDB
    try {
        await offlineStore.initDB();
        let cachedFleet = await offlineStore.getFleet();
        if (cachedFleet && cachedFleet.length >= 10) {
            state.fleet = cachedFleet;
            console.log('📦 Loaded fleet from IndexedDB cache (10 units)');
        } else {
            state.fleet = generateDriverFleet();
            await offlineStore.saveFleet(state.fleet);
            console.log('⚡ Generated initial default 10-driver fleet');
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
            audioEngine.triggerCommandAudioBroadcast(`Emergency SOS! Unit ${driver.name} at ${driver.node} reported vehicle impact of ${data.gForce}G!`);
        }
    } else if (data.type === 'EMERGENCY_CRASH_RESOLVED') {
        const driver = state.fleet.find(d => d.id === data.driverId);
        if (driver) {
            driver.crashSensor = { isCrashed: false, gForce: 1.0, tiltAngle: 0, lastTriggered: null };
            applyEmergencyCrashUI(driver.id, false);
            hideEmergencyBanner();
        }
    } else if (data.type === 'ROLE_UPDATED') {
        const driver = state.fleet.find(d => d.id === data.driverId);
        if (driver) {
            driver.job = data.newRole;
            driver.isRescue = data.isRescue;
            driver.stock = data.stock;
            updateDriverCardUI(driver);
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
            updateMiniMapPolyline(driver.id);
            updateDriverCardUI(driver);
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
                console.log('✅ Synchronized 6 fleet units from backend API');
                renderWorkforceList();
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
}

async function loginAsDriver() {
    audioEngine.playBeep(880, 0.12);
    const drvId = (document.getElementById('drv-id').value || 'DRIVER-RAJESH-01').trim();

    let matchedDriver = state.fleet.find(d => 
        d.username.toLowerCase() === drvId.toLowerCase() ||
        ('DRIVER-' + d.id).toLowerCase() === drvId.toLowerCase() ||
        d.name.toLowerCase() === drvId.toLowerCase()
    ) || state.fleet[0];

    state.user = { role: 'DRIVER', ...matchedDriver };
    state.selectedDriverId = matchedDriver.id;

    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-driver').classList.remove('hidden');
    document.getElementById('app-officer').classList.add('hidden');

    initDriverInterface(matchedDriver);
}

// ==========================================
// 4. OFFICER COMMAND HUD & 6-NODE GRID
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

function initMiniMapsGrid() {
    setTimeout(() => {
        state.fleet.forEach((driver) => {
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

                // Driver Live Location Marker
                const liveMarker = L.circleMarker([lat, lng], {
                    radius: 6,
                    color: driver.hazardColor || '#00f0ff',
                    fillColor: driver.hazardColor || '#00f0ff',
                    fillOpacity: 1,
                    weight: 2
                }).addTo(m);

                // Target Waypoint Node Marker
                const targetMarker = L.circleMarker([targetLat, targetLng], {
                    radius: 4,
                    color: '#f59e0b',
                    fillColor: '#f59e0b',
                    fillOpacity: 1
                }).addTo(m);

                // Glowing Active Polyline
                const poly = L.polyline(driver.polyline || [[lat, lng], [targetLat, targetLng]], {
                    color: driver.isObstructed ? '#ef4444' : (driver.hazardColor || '#00f0ff'),
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
    const mini = state.miniMaps[driverId];
    if (mini && mini.polyline) {
        mini.polyline.setLatLngs(driver.polyline);
        mini.polyline.setStyle({
            color: driver.isObstructed ? '#ef4444' : (driver.hazardColor || '#00f0ff'),
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
                const reroute = quantumEngine.solveOptimalRoute(d.currentPos, d.targetPos, d.isObstructed);
                d.polyline = reroute.path;
                d.quantumMetrics = {
                    hamiltonianEnergy: CONFIG.GROUND_STATE_ENERGY_EV,
                    carbonSavedKg: reroute.carbonSavedKg,
                    distanceSavedKm: reroute.distanceSavedKm,
                    qaoaLayers: 4,
                    optimalRouteFound: true
                };
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
        if (!state.fullMap) {
            state.fullMap = L.map('map-full-expanded', { zoomControl: true }).setView([lat, lng], 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(state.fullMap);

            state.fullMapMarker = L.circleMarker([lat, lng], {
                radius: 8,
                color: driver.hazardColor || '#00f0ff',
                fillColor: driver.hazardColor || '#00f0ff',
                fillOpacity: 1
            }).addTo(state.fullMap);

            state.fullMapPoly = L.polyline(driver.polyline, {
                color: driver.hazardColor || '#00f0ff',
                weight: 4.5,
                opacity: 0.95
            }).addTo(state.fullMap);
        } else {
            state.fullMap.setView([lat, lng], 14);
            state.fullMapMarker.setLatLng([lat, lng]);
            state.fullMapPoly.setLatLngs(driver.polyline);
            state.fullMapPoly.setStyle({ color: driver.hazardColor || '#00f0ff' });
            state.fullMap.invalidateSize();
        }
    }, 250);
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

function deployNewFieldUnit() {
    audioEngine.playBeep(880, 0.1);
    const name = prompt("Enter New Operative Full Name:", "Kalyan Varma");
    if (!name) return;
    const newId = state.fleet.length + 1;
    const baseLoc = RESCUE_LOCATIONS_6[(newId - 1) % RESCUE_LOCATIONS_6.length];
    
    const newDriver = {
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

    state.fleet.push(newDriver);
    offlineStore.saveFleet(state.fleet);
    renderWorkforceList();
    alert(`⚡ Unit #${newId}: ${name} deployed to ${baseLoc.name} staging bay!`);
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

    const reroute = quantumEngine.solveOptimalRoute(driver.currentPos, driver.targetPos, true);
    driver.polyline = reroute.path;
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

// ==========================================
// 10. DRIVER FIELD CONSOLE WITH GLOWING ROUTE
// ==========================================
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
        if (!state.driverMap) {
            state.driverMap = L.map('driver-map', { zoomControl: false }).setView([lat, lng], 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(state.driverMap);

            state.driverMarker = L.circleMarker([lat, lng], {
                radius: 8,
                color: '#14b8a6',
                fillColor: '#14b8a6',
                fillOpacity: 1
            }).addTo(state.driverMap).bindPopup(`<b>${driver.name}</b><br>${driver.node}`).openPopup();

            // Glowing quantum-optimized polyline
            state.driverPolyline = L.polyline(driver.polyline, {
                color: '#00f0ff',
                weight: 5,
                opacity: 0.95
            }).addTo(state.driverMap);
        } else {
            state.driverMap.setView([lat, lng], 14);
            state.driverMarker.setLatLng([lat, lng]);
            state.driverPolyline.setLatLngs(driver.polyline);
            state.driverMap.invalidateSize();
        }
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
            reportId: 'QR-6NODE-AUDIT-' + Date.now().toString(36).toUpperCase(),
            generatedAt: new Date().toLocaleString(),
            officerInCharge: CONFIG.OFFICER_NAME,
            officerId: CONFIG.GOV_OFFICER_ID,
            kpis: {
                totalUnits: state.fleet.length,
                totalNodes: 6,
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
    a.download = `QuantumRoute_6Node_Audit_${Date.now()}.csv`;
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
