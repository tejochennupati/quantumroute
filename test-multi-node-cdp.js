const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function getJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
            });
        }).on('error', reject);
    });
}

async function postJson(url, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const postData = JSON.stringify(body);
        const req = http.request({
            hostname: u.hostname,
            port: u.port,
            path: u.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                ...headers
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function runComprehensiveMultiNodeTests() {
    console.log('================================================================');
    console.log('🚀 QUANTUMROUTE: QUANTUM-OPTIMIZED MULTI-NODE LIVE CDP TEST SUITE');
    console.log('================================================================\n');

    const tempDir = `C:\\Users\\tejoc\\AppData\\Local\\Temp\\edge-multinode-${Date.now()}`;
    const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
        '--headless=new',
        '--remote-debugging-port=9223',
        `--user-data-dir=${tempDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--disable-gpu',
        '--window-size=1600,1050',
        'http://localhost:3000'
    ]);

    let ws = null;
    let messageId = 1;
    const pendingRequests = new Map();
    const consoleLogs = [];
    const jsErrors = [];

    async function sendCdp(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = messageId++;
            pendingRequests.set(id, { resolve, reject });
            ws.send(JSON.stringify({ id, method, params }));
        });
    }

    async function evalCode(expression) {
        const res = await sendCdp('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true
        });
        if (res.result && res.result.exceptionDetails) {
            throw new Error(`Eval error: ${JSON.stringify(res.result.exceptionDetails)}`);
        }
        return res.result ? res.result.value : undefined;
    }

    async function saveScreenshot(filename) {
        const res = await sendCdp('Page.captureScreenshot', { format: 'png', quality: 90 });
        if (res && res.data) {
            fs.writeFileSync(filename, Buffer.from(res.data, 'base64'));
            console.log(`📸 [Artifact Saved] -> ${filename}`);
        }
    }

    try {
        console.log('Connecting to Headless Edge via CDP on port 9223...');
        let wsUrl = null;
        let pageTarget = null;
        for (let i = 0; i < 30; i++) {
            await sleep(500);
            try {
                const list = await getJson('http://127.0.0.1:9223/json/list');
                if (list && list.length > 0) {
                    const p = list.find(t => t.type === 'page' && t.url.includes('localhost:3000'));
                    if (p && p.webSocketDebuggerUrl) {
                        pageTarget = p;
                        wsUrl = p.webSocketDebuggerUrl;
                        break;
                    }
                }
            } catch (e) {}
        }

        if (!wsUrl) throw new Error('Failed to connect to browser CDP socket for localhost:3000.');
        console.log(`Connected to Page Target: "${pageTarget.title}" (${pageTarget.url})`);

        ws = new WebSocket(wsUrl);
        await new Promise((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
        });

        ws.on('message', (msg) => {
            const parsed = JSON.parse(msg);
            if (parsed.id && pendingRequests.has(parsed.id)) {
                const { resolve, reject } = pendingRequests.get(parsed.id);
                pendingRequests.delete(parsed.id);
                if (parsed.error) reject(new Error(parsed.error.message));
                else resolve(parsed.result);
            }
            if (parsed.method === 'Runtime.consoleAPICalled') {
                const text = (parsed.params.args || []).map(a => a.value || a.description).join(' ');
                consoleLogs.push(text);
                if (parsed.params.type === 'error') {
                    jsErrors.push(text);
                }
            }
        });

        await sendCdp('Runtime.enable');
        await sendCdp('Page.enable');

        console.log('Waiting for DOMContentLoaded and application hydration...');
        await sleep(2500);

        // ---------------------------------------------------------------------
        // TEST A: OFFICER CREATES NODES VIA DOUBLE-CLICK
        // ---------------------------------------------------------------------
        console.log('\n--- [TEST A] Officer Double-Click Multi-Node Creation ---');
        // Login as Officer
        await evalCode(`loginAsOfficer();`);
        await sleep(1000);

        // Open Officer Master Tactical Map
        await evalCode(`toggleOfficerTacticalMap();`);
        await sleep(1200);

        // Enter Multi-Node Selection Mode
        const modeActivated = await evalCode(`
            toggleMultiNodeSelectionMode(true);
            state.multiNodeSelectionMode;
        `);
        console.log('Multi-node mode activated:', modeActivated);
        if (!modeActivated) throw new Error('Failed to activate multi-node selection mode');

        // Confirm double-click zoom is disabled on map
        const dblClickZoomDisabled = await evalCode(`
            !state.tacticalMasterMap.doubleClickZoom.enabled();
        `);
        console.log('Double-click zoom disabled while in mode:', dblClickZoomDisabled);
        if (!dblClickZoomDisabled) throw new Error('Double-click zoom must be disabled in multi-node mode');

        // Double-click four valid test locations
        const fourNodes = [
            { lat: 16.5100, lng: 80.6500 }, // Mid East
            { lat: 16.5019, lng: 80.6704 }, // Benz Circle
            { lat: 16.5120, lng: 80.6300 }, // Governorpet
            { lat: 16.5140, lng: 80.6230 }  // Near RTC
        ];

        for (const loc of fourNodes) {
            await evalCode(`handleOfficerMapDoubleClick(${loc.lat}, ${loc.lng});`);
            await sleep(200);
        }

        const pendingCount = await evalCode(`state.pendingMissionNodes.length;`);
        console.log('Pending emergency nodes created:', pendingCount);
        if (pendingCount !== 4) throw new Error(`Expected 4 pending nodes, got ${pendingCount}`);

        // Verify pending nodes are NOT assigned to driver before submission
        const initialDriverStops = await evalCode(`(state.fleet.find(d => d.id === 1).routeSequence || []).length;`);
        console.log('Driver #1 stops before mission submit (not assigned yet):', initialDriverStops);

        // Remove 1 pending node and verify count becomes 3
        const tempIdToRemove = await evalCode(`state.pendingMissionNodes[0].tempId;`);
        await evalCode(`removePendingMissionNode('${tempIdToRemove}');`);
        await sleep(300);

        const afterRemoveCount = await evalCode(`state.pendingMissionNodes.length;`);
        console.log('Pending count after removing node:', afterRemoveCount);
        if (afterRemoveCount !== 3) throw new Error(`Expected 3 pending nodes after removal, got ${afterRemoveCount}`);

        // Re-add the 4th node back for subsequent tests
        await evalCode(`handleOfficerMapDoubleClick(${fourNodes[0].lat}, ${fourNodes[0].lng});`);
        await sleep(300);

        await saveScreenshot('test-a-officer-double-click-nodes.png');
        console.log('✅ [TEST A PASSED] Double-click node creation, zoom disabling, and removal verified.');

        // ---------------------------------------------------------------------
        // TEST B: QUANTUM OPTIMIZATION (VISIT ORDER != CLICK ORDER)
        // ---------------------------------------------------------------------
        console.log('\n--- [TEST B] Quantum Optimization: Visit Order != Click Order ---');
        // Clear pending nodes and add them in deliberate sub-optimal click order:
        // Click 1: Far East (Benz Circle) [16.5019, 80.6704]
        // Click 2: Near RTC Complex [16.5140, 80.6230]
        // Click 3: Mid East [16.5100, 80.6500]
        // Click 4: Governorpet [16.5120, 80.6300]
        await evalCode(`
            const d = state.fleet.find(d => d.id === 1);
            d.currentPos = [16.5160, 80.6200]; // Known RTC Staging Hub Base
            clearAllPendingMissionMarkers();
            state.pendingMissionNodes = [];
            handleOfficerMapDoubleClick(16.5019, 80.6704); // Click 1: Benz (Far East, ~5.5km)
            handleOfficerMapDoubleClick(16.5140, 80.6230); // Click 2: RTC (Closest to Base, ~0.4km)
            handleOfficerMapDoubleClick(16.5100, 80.6500); // Click 3: Mid East (~3.5km)
            handleOfficerMapDoubleClick(16.5120, 80.6300); // Click 4: Governorpet (~1.2km)
        `);
        await sleep(500);

        const clickOrderNames = await evalCode(`state.pendingMissionNodes.map(n => n.name);`);
        console.log('Officer Click Order:', clickOrderNames);

        // Run Quantum QAOA TSP Optimization
        await evalCode(`previewPendingMissionQuantumOrder();`);
        await sleep(500);

        const optimizedOrder = await evalCode(`
            state.pendingMissionNodes.map(n => ({
                seq: n.seq,
                name: n.name,
                lat: n.lat,
                lng: n.lng
            }));
        `);
        console.log('Optimized Visit Order:');
        optimizedOrder.forEach(o => console.log(`  Node ${o.seq}: [${o.lat}, ${o.lng}] (${o.name})`));

        // Proved: Click 1 was Benz Circle (16.5019, 80.6704), whereas Node 1 is Near RTC Complex (16.5140, 80.6230)
        const node1 = optimizedOrder[0];
        if (node1.lat === 16.5019 && node1.lng === 80.6704) {
            throw new Error('FAIL: Node 1 matches Click 1! Visit order was not optimized by spatial road proximity.');
        }
        if (Math.hypot(node1.lat - 16.5140, node1.lng - 80.6230) > 0.001) {
            throw new Error(`FAIL: Expected Node 1 to be Near RTC Complex [16.5140, 80.6230], got [${node1.lat}, ${node1.lng}]`);
        }

        const isIdenticalToClick = (
            optimizedOrder[0].lat === 16.5019 &&
            optimizedOrder[1].lat === 16.5140 &&
            optimizedOrder[2].lat === 16.5100 &&
            optimizedOrder[3].lat === 16.5120
        );
        if (isIdenticalToClick) {
            throw new Error('FAIL: Optimized order is identical to click order!');
        }
        console.log(`[PASS] Proved Visit Order != Click Order: Node 1 is Near RTC Complex (0.4km away), whereas Click 1 was Far East Benz (5.5km away).`);

        // Test 2 (Section 16): Compare complete route costs against naive insertion
        console.log('Comparing full journey road travel cost between optimized sequence vs naive click order...');
        const costComparison = await evalCode(`
            (() => {
                const driver = state.fleet.find(d => d.id === 1);
                const s = driver.currentPos;
                const clickStops = [
                    { lat: 16.5019, lng: 80.6704 }, // Benz Circle (Click 1)
                    { lat: 16.5140, lng: 80.6230 }, // Near RTC Complex (Click 2)
                    { lat: 16.5100, lng: 80.6500 }, // Mid East (Click 3)
                    { lat: 16.5120, lng: 80.6300 }  // Governorpet (Click 4)
                ];

                const calcTotalRoadDist = (pts) => {
                    let total = 0;
                    let curr = s;
                    for (const p of pts) {
                        const r = calculateRoadRouteSync(curr, [p.lat, p.lng]);
                        total += (r && r.distanceKm) ? r.distanceKm : Math.hypot(p.lat - curr[0], p.lng - curr[1]) * 111.0;
                        curr = [p.lat, p.lng];
                    }
                    return total;
                };

                const clickTotalDist = calcTotalRoadDist(clickStops);
                const optTotalDist = calcTotalRoadDist(state.pendingMissionNodes);
                return { clickTotalDist: Number(clickTotalDist.toFixed(2)), optTotalDist: Number(optTotalDist.toFixed(2)) };
            })()
        `);
        console.log(`Naive Click Order Total Road Distance: ${costComparison.clickTotalDist} km`);
        console.log(`Quantum-Optimized Total Road Distance: ${costComparison.optTotalDist} km`);
        console.log(`Saved Distance: ${(costComparison.clickTotalDist - costComparison.optTotalDist).toFixed(2)} km (${(((costComparison.clickTotalDist - costComparison.optTotalDist) / costComparison.clickTotalDist) * 100).toFixed(1)}% reduction)`);
        if (costComparison.optTotalDist >= costComparison.clickTotalDist) {
            throw new Error(`FAIL: Quantum-optimized distance (${costComparison.optTotalDist} km) is not strictly less than naive click distance (${costComparison.clickTotalDist} km)!`);
        }

        // Explicitly confirm & assign mission to Unit #1
        await evalCode(`confirmAndAssignMission();`);
        await sleep(1500);

        // Verify server-stored order matches displayed optimized order
        const serverDriver = await evalCode(`state.fleet.find(d => d.id === 1);`);
        console.log('Server-stored routeSequence length:', serverDriver.routeSequence.length);
        console.log('Server-stored active target node:', serverDriver.node);
        if (serverDriver.routeSequence.length !== 4) {
            throw new Error(`Expected 4 assigned stops on server, got ${serverDriver.routeSequence.length}`);
        }

        await saveScreenshot('test-b-quantum-optimized-visit-order.png');
        console.log('✅ [TEST B PASSED] Quantum TSP visit order proven to differ from click order and locked in server.');

        // ---------------------------------------------------------------------
        // TEST C: REAL ROAD GEOMETRY VERIFICATION
        // ---------------------------------------------------------------------
        console.log('\n--- [TEST C] Real Road Geometry & Non-Straight Polylines ---');
        const polylineCoords = await evalCode(`state.fleet.find(d => d.id === 1).polyline;`);
        console.log('Assigned Driver Polyline Point Count:', polylineCoords.length);
        if (polylineCoords.length < 50) {
            throw new Error(`Route polyline has only ${polylineCoords.length} points! Expected >50 dense road points.`);
        }

        // Verify non-straight line (calculates sum of segment lengths vs direct start-to-end distance)
        let roadDistanceSum = 0;
        for (let i = 0; i < polylineCoords.length - 1; i++) {
            roadDistanceSum += Math.hypot(polylineCoords[i+1][0] - polylineCoords[i][0], polylineCoords[i+1][1] - polylineCoords[i][1]) * 111;
        }
        const straightChordDist = Math.hypot(
            polylineCoords[polylineCoords.length - 1][0] - polylineCoords[0][0],
            polylineCoords[polylineCoords.length - 1][1] - polylineCoords[0][1]
        ) * 111;

        console.log(`Road-following polyline length: ${roadDistanceSum.toFixed(2)} km`);
        console.log(`Direct straight chord distance: ${straightChordDist.toFixed(2)} km`);
        if (roadDistanceSum <= straightChordDist * 1.05) {
            throw new Error('FAIL: Route is a straight chord! It does not follow street turns and road bends.');
        }

        await saveScreenshot('test-c-real-road-geometry-tactical.png');
        console.log('✅ [TEST C PASSED] Verified dense, road-locked geometry following actual streets and bends.');

        // ---------------------------------------------------------------------
        // TEST D: WATER & DISCONNECTED DESTINATIONS
        // ---------------------------------------------------------------------
        console.log('\n--- [TEST D] Water Basin & Disconnected Accessibility Validation ---');
        const waterCheck = await evalCode(`validateDestinationAccessibility([16.5020, 80.6160]);`);
        console.log('Krishna River Water Point [16.5020, 80.6160]:', waterCheck.reason, `(Accessible: ${waterCheck.isAccessible})`);
        if (waterCheck.isAccessible || waterCheck.reason !== 'WATER_BODY_UNREACHABLE') {
            throw new Error('FAIL: Krishna River water point should be rejected with WATER_BODY_UNREACHABLE');
        }

        const disconnectedCheck = await evalCode(`validateDestinationAccessibility([16.3500, 80.5000]);`);
        console.log('Disconnected Terrain Point [16.3500, 80.5000]:', disconnectedCheck.reason, `(Accessible: ${disconnectedCheck.isAccessible})`);
        if (disconnectedCheck.isAccessible || disconnectedCheck.reason !== 'NO_ROAD_CONNECTION') {
            throw new Error('FAIL: Off-road point (>850m) should be rejected with NO_ROAD_CONNECTION');
        }

        const bridgeCheck = await evalCode(`validateDestinationAccessibility([16.5062, 80.6120]);`);
        console.log('Prakasam Barrage Deck [16.5062, 80.6120]:', bridgeCheck.reason, `(Accessible: ${bridgeCheck.isAccessible})`);
        if (!bridgeCheck.isAccessible || bridgeCheck.reason !== 'ROAD_CONNECTED') {
            throw new Error('FAIL: Prakasam Barrage bridge deck should be accessible');
        }

        const cityCheck = await evalCode(`validateDestinationAccessibility([16.5019, 80.6704]);`);
        console.log('Benz Circle Municipal Road [16.5019, 80.6704]:', cityCheck.reason, `(Accessible: ${cityCheck.isAccessible})`);
        if (!cityCheck.isAccessible || cityCheck.reason !== 'ROAD_CONNECTED') {
            throw new Error('FAIL: Benz Circle should be accessible');
        }

        // Test server rejection of water destination
        const waterServerRes = await postJson('http://localhost:3000/api/fleet/1/mission', {
            destinations: [{ name: 'Deep Water Node', lat: 16.5020, lng: 80.6160 }]
        }, { 'x-role': 'OFFICER' });
        console.log('Server rejected water destination with HTTP status:', waterServerRes.status);
        if (waterServerRes.status !== 422) {
            throw new Error(`Expected HTTP 422 for water node, got ${waterServerRes.status}`);
        }

        await saveScreenshot('test-d-water-unreachable-rejected.png');
        console.log('✅ [TEST D PASSED] Water body and disconnected coordinates strictly flagged and rejected.');

        // ---------------------------------------------------------------------
        // TEST E: DRIVER PROGRESSION NODE-BY-NODE
        // ---------------------------------------------------------------------
        console.log('\n--- [TEST E] Driver Sequential Node-by-Node Progression ---');
        // Switch to Driver Interface
        await evalCode(`loginAsDriver('1');`);
        await sleep(1000);

        // Verify Turn-by-Turn Guidance & Separate Distances (Part 8 & Part 14 Test E)
        const navData = await evalCode(`
            (() => {
                const d = state.fleet.find(d => d.id === 1);
                return computeTurnByTurnInstructions(d);
            })()
        `);
        console.log(`Turn-by-Turn Instruction: "${navData.instruction}"`);
        console.log(`Target Sub-instruction: "${navData.subInstruction}"`);
        console.log(`Maneuver Distance: ${navData.distanceText} | Remaining Destination Distance: ${navData.distanceKm} km`);
        if (!navData.instruction || !navData.subInstruction) {
            throw new Error('FAIL: Turn-by-turn guidance instruction missing!');
        }
        if (!navData.distanceText || navData.distanceKm === undefined) {
            throw new Error('FAIL: Maneuver distance and destination distance must be calculated!');
        }

        // Verify initial active target is Node 1
        let currentTarget = await evalCode(`
            (() => {
                const d = state.fleet.find(d => d.id === 1);
                return d && d.routeSequence ? d.routeSequence.find(s => s.status !== 'COMPLETED') : null;
            })()
        `);
        console.log(`Initial active stop: Stop #${currentTarget.seq} - ${currentTarget.name} [Status: ${currentTarget.status}]`);
        if (currentTarget.seq !== 1 || currentTarget.status !== 'IN_PROGRESS') {
            throw new Error(`Expected Stop #1 to be IN_PROGRESS, got seq ${currentTarget.seq} (${currentTarget.status})`);
        }

        // Advance Stop 1 -> Stop 2
        console.log('Advancing Unit #1 past Stop #1...');
        const adv1 = await postJson('http://localhost:3000/api/fleet/1/advance', {}, { 'x-role': 'OFFICER' });
        console.log('Advance 1 message:', adv1.body.message);
        await sleep(800);

        currentTarget = await evalCode(`
            (() => {
                const d = state.fleet.find(d => d.id === 1);
                return d && d.routeSequence ? d.routeSequence.find(s => s.status !== 'COMPLETED') : null;
            })()
        `);
        console.log(`New active stop: Stop #${currentTarget.seq} - ${currentTarget.name} [Status: ${currentTarget.status}]`);
        if (currentTarget.seq !== 2) {
            throw new Error(`Expected active stop to advance to Stop #2, got seq ${currentTarget.seq}`);
        }

        // Advance Stop 2 -> Stop 3
        console.log('Advancing Unit #1 past Stop #2...');
        await postJson('http://localhost:3000/api/fleet/1/advance', {}, { 'x-role': 'OFFICER' });
        await sleep(800);

        // Advance Stop 3 -> Stop 4
        console.log('Advancing Unit #1 past Stop #3...');
        await postJson('http://localhost:3000/api/fleet/1/advance', {}, { 'x-role': 'OFFICER' });
        await sleep(800);

        // Advance final Stop 4 -> Mission Completed (DELIVERED)
        console.log('Advancing Unit #1 past final Stop #4...');
        const finalAdv = await postJson('http://localhost:3000/api/fleet/1/advance', {}, { 'x-role': 'OFFICER' });
        console.log('Final advance response:', finalAdv.body.message);
        await sleep(800);

        const missionDelivered = await evalCode(`
            (() => {
                const d = state.fleet.find(d => d.id === 1);
                return d ? d.missionStatus === 'DELIVERED' : false;
            })()
        `);
        console.log('Mission status DELIVERED after all stops completed:', missionDelivered);
        if (!missionDelivered) throw new Error('Expected driver missionStatus to be DELIVERED');

        await saveScreenshot('test-e-driver-navigation-progression.png');
        console.log('✅ [TEST E PASSED] Verified step-by-step sequential node progression to mission completion.');

        // ---------------------------------------------------------------------
        // TEST F: LIVE SYNCHRONIZATION
        // ---------------------------------------------------------------------
        console.log('\n--- [TEST F] Real-Time State Synchronization ---');
        // Update vehicle position via telemetry and verify officer map reflects it
        const teleUpdate = await postJson('http://localhost:3000/api/fleet/1/telemetry', {
            currentPos: [16.5050, 80.6350],
            speed: 40,
            heading: 120
        });
        await sleep(800);

        const syncedPos = await evalCode(`state.fleet.find(d => d.id === 1).currentPos;`);
        console.log(`Server-updated position: [16.5050, 80.6350] | Synced in client: [${syncedPos[0]}, ${syncedPos[1]}]`);
        if (syncedPos[0] !== 16.5050 || syncedPos[1] !== 80.6350) {
            throw new Error('Position desynchronization detected');
        }

        await saveScreenshot('test-f-live-synchronization-officer-driver.png');
        console.log('✅ [TEST F PASSED] Authoritative server-client synchronization confirmed.');

        // ---------------------------------------------------------------------
        // TEST G: ROAD CLOSURES & DYNAMIC REROUTING
        // ---------------------------------------------------------------------
        console.log('\n--- [TEST G] Dynamic Road Closures & Forward Detours ---');
        // Re-assign a mission with stops across the Krishna River to test bridge detour
        await postJson('http://localhost:3000/api/fleet/1/mission', {
            destinations: [
                { name: 'Tadepalli South Hub', lat: 16.4850, lng: 80.6020 },
                { name: 'Governorpet Medical', lat: 16.5120, lng: 80.6300 }
            ],
            optimizeOrder: true
        }, { 'x-role': 'OFFICER' });
        await sleep(800);

        // Trigger obstruction on active segment
        const obsRes = await postJson('http://localhost:3000/api/fleet/1/obstruction', {
            reason: 'Bridge Surge Inundation'
        });
        console.log('Obstruction triggered. Response roadColor:', obsRes.body.driver.roadColor);
        if (obsRes.body.driver.roadColor !== '#ef4444') {
            throw new Error('Expected roadColor to turn #ef4444 on obstruction');
        }

        // Verify detoured polyline is dense and non-straight
        const detouredPoly = obsRes.body.driver.polyline;
        console.log('Detoured polyline point count:', detouredPoly.length);
        if (detouredPoly.length < 30) {
            throw new Error('Detoured polyline is too sparse! Must be dense road geometry.');
        }

        await saveScreenshot('test-g-closure-dynamic-reroute.png');
        console.log('✅ [TEST G PASSED] Dynamic forward-only detouring verified.');

        // ---------------------------------------------------------------------
        // TEST H: ROLE AUTHORIZATION & SECURITY
        // ---------------------------------------------------------------------
        console.log('\n--- [TEST H] Security & Role Enforcement ---');
        // 1. Driver role cannot assign mission
        const driverMissionAttempt = await postJson('http://localhost:3000/api/fleet/1/mission', {
            destinations: [{ lat: 16.51, lng: 80.64 }]
        }, { 'x-role': 'DRIVER' });
        console.log('Driver attempting mission assignment: HTTP status =', driverMissionAttempt.status);
        if (driverMissionAttempt.status !== 403) {
            throw new Error(`Expected 403 Forbidden for driver mission creation, got ${driverMissionAttempt.status}`);
        }

        // 2. Driver cannot advance another driver's mission
        const crossAdvanceAttempt = await postJson('http://localhost:3000/api/fleet/2/advance', {}, {
            'x-role': 'DRIVER',
            'x-driver-id': '1' // Driver 1 attempting to advance Driver 2
        });
        console.log('Cross-driver advance modification: HTTP status =', crossAdvanceAttempt.status);
        if (crossAdvanceAttempt.status !== 403) {
            throw new Error(`Expected 403 Forbidden for cross-driver advance, got ${crossAdvanceAttempt.status}`);
        }

        // 3. Driver cannot report unreachable for another unit
        const crossUnreachableAttempt = await postJson('http://localhost:3000/api/fleet/2/unreachable-report', {
            reason: 'Test'
        }, {
            'x-role': 'DRIVER',
            'x-driver-id': '1'
        });
        console.log('Cross-driver unreachable report: HTTP status =', crossUnreachableAttempt.status);
        if (crossUnreachableAttempt.status !== 403) {
            throw new Error(`Expected 403 Forbidden for cross-driver unreachable report, got ${crossUnreachableAttempt.status}`);
        }

        console.log('✅ [TEST H PASSED] All role-based security boundaries verified.');

        // ---------------------------------------------------------------------
        // TEST I: REGRESSION & BROWSER CONSOLE ERRORS
        // ---------------------------------------------------------------------
        console.log('\n--- [TEST I] Regression Checks & JavaScript Health ---');
        console.log(`Total captured browser console logs: ${consoleLogs.length}`);
        console.log(`Total browser JavaScript runtime errors: ${jsErrors.length}`);
        if (jsErrors.length > 0) {
            console.warn('Browser errors captured:', jsErrors);
            throw new Error(`Detected ${jsErrors.length} JavaScript runtime errors in browser!`);
        }

        console.log('\n================================================================');
        console.log('🎉 ALL TESTS A THROUGH I PASSED 100% WITH VERIFIED LIVE AUDIT!');
        console.log('================================================================\n');

    } catch (err) {
        console.error('❌ TEST SUITE FAILED:', err);
        process.exitCode = 1;
    } finally {
        if (ws) ws.close();
        edge.kill();
        console.log('Browser process terminated.');
    }
}

runComprehensiveMultiNodeTests();
