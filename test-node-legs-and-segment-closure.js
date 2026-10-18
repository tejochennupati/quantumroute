const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const {
    ROAD_NETWORK_NODES,
    ROAD_NETWORK_EDGES,
    ROAD_NODE_NAMES,
    formatRoadEdgeName,
    findNearestRoadEdge,
    findShortestRoadGraphPath,
    getRoadSnappedPath,
    isSouthOfRiver
} = require('./js/config.js');
const { quantumEngine } = require('./js/quantum.js');
const ARTIFACT_DIR = 'C:\\Users\\tejoc\\.gemini\\antigravity\\brain\\030dede3-bd1f-4780-b0f0-7f101ddcb4f9';

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function fetchJson(url, options = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = http.request({
            hostname: u.hostname,
            port: u.port,
            path: u.pathname + u.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });
        req.on('error', reject);
        if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        req.end();
    });
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

async function runAllVerifications() {
    console.log('================================================================');
    console.log('🚀 TESTING NODE-TO-NODE DISTANCES & CLICK-TO-REPORT CLOSED ROAD');
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, desc) {
        if (condition) {
            console.log(`[PASS] ${desc}`);
            passed++;
        } else {
            console.error(`[FAIL] ${desc}`);
            failed++;
        }
    }

    // -------------------------------------------------------------
    // PART 1: Consecutive Emergency Node Road Distances & Separation
    // -------------------------------------------------------------
    console.log('--- 1. Consecutive Node Road Distances & Value Separation ---');

    // Create a 4-destination multi-node test mission
    const driverStart = [16.5062, 80.6120]; // Near Prakasam Barrage North
    const emergencyStops = [
        { seq: 1, name: "Prakasam Barrage Flood Hub", lat: 16.5062, lng: 80.6120 },
        { seq: 2, name: "Tadepalli High Ground Shelter", lat: 16.4850, lng: 80.6020 },
        { seq: 3, name: "Undavalli Relief Center", lat: 16.4975, lng: 80.5815 },
        { seq: 4, name: "Mangalagiri Medical Camp", lat: 16.4350, lng: 80.5600 }
    ];

    const solvedMission = quantumEngine.solveQuantumMultiNodeRoute(driverStart, emergencyStops, false, false);
    assert(solvedMission.legs && solvedMission.legs.length === 4, `4 consecutive legs generated (got ${solvedMission.legs?.length})`);

    // Verify each leg has a distinct positive road distance calculated from real road geometry
    let sumLegDistances = 0;
    solvedMission.legs.forEach((leg, idx) => {
        const d = parseFloat(leg.distanceKm);
        sumLegDistances += d;
        assert(d > 0.5, `Leg ${idx + 1} (${leg.from} → ${leg.to}): ${d} km road distance`);
    });

    // Verify values are strictly separated: active leg, remaining future legs, total remaining, total planned
    const activeLegDistance = parseFloat(solvedMission.legs[0].distanceKm);
    const futureLegsDistance = solvedMission.legs.slice(1).reduce((acc, l) => acc + parseFloat(l.distanceKm), 0);
    const totalRemainingDistance = activeLegDistance + futureLegsDistance;
    const totalPlannedDistance = parseFloat(solvedMission.totalDistanceKm);

    assert(Math.abs(totalRemainingDistance - totalPlannedDistance) < 0.2, `Total remaining (${totalRemainingDistance.toFixed(2)} km) matches planned (${totalPlannedDistance.toFixed(2)} km) at origin`);
    assert(activeLegDistance !== totalRemainingDistance, `Active leg distance (${activeLegDistance} km) strictly separated from total remaining (${totalRemainingDistance.toFixed(2)} km)`);

    // Simulation of vehicle moving forward along active leg:
    // Move vehicle halfway across bridge
    const vehicleAdvancedPos = [16.5010, 80.6070];
    const advancedRoute = quantumEngine.solveQuantumMultiNodeRoute(vehicleAdvancedPos, emergencyStops, false, false);
    const updatedActiveLegDist = parseFloat(advancedRoute.legs[0].distanceKm);

    // Future legs must remain preserved from the approved route plan
    const futureLeg2Dist = parseFloat(advancedRoute.legs[1].distanceKm);
    const plannedLeg2Dist = parseFloat(solvedMission.legs[1].distanceKm);
    assert(Math.abs(futureLeg2Dist - plannedLeg2Dist) < 0.05, `Future leg 2 road distance preserved when vehicle moves (${futureLeg2Dist} km vs planned ${plannedLeg2Dist} km)`);

    // -------------------------------------------------------------
    // PART 2: Road Network Snapping & Graph Edge Identification
    // -------------------------------------------------------------
    console.log('\n--- 2. Road Network Snapping & Edge Identification ---');

    // Click on Prakasam Barrage Deck (lat=16.507, lng=80.615)
    const barrageClick = [16.5072, 80.6155];
    const snappedBarrage = findNearestRoadEdge(barrageClick, 1.0);
    assert(snappedBarrage !== null, 'Barrage road click correctly identified on road graph');
    assert(snappedBarrage.name.includes('Prakasam Barrage'), `Identified road segment name: "${snappedBarrage?.name}"`);
    assert(Array.isArray(snappedBarrage.edge) && snappedBarrage.edge.length === 2, `Identified graph edge nodes: [${snappedBarrage?.edge?.join(', ')}]`);

    // Click far out in the Bay of Bengal / arbitrary coordinate > 5km away
    const offshoreClick = [16.2000, 81.2000];
    const rejectedOffshore = findNearestRoadEdge(offshoreClick, 0.8);
    assert(rejectedOffshore === null, 'Arbitrary click away from road network does not match any road edge');

    // -------------------------------------------------------------
    // PART 3: Road Closure, Live GPS Rerouting & Sequence Invariance
    // -------------------------------------------------------------
    console.log('\n--- 3. Road Closure, Live GPS Rerouting & Sequence Invariance ---');

    // Block the Prakasam Barrage Deck
    const blockedDeckEdge = snappedBarrage.edge; // e.g. ['BARRAGE_NORTH', 'BARRAGE_APPROACH_N']
    console.log(`Simulating road closure on edge: [${blockedDeckEdge.join(', ')}]`);

    const liveGpsDriverPos = [16.5120, 80.6180]; // Driver live position in North Vijayawada
    const reroutedMission = quantumEngine.solveQuantumMultiNodeRoute(
        liveGpsDriverPos,
        emergencyStops,
        true,       // isBlocked = true
        false,      // optimizeTSP = false (Sequence must remain strictly unchanged)
        [blockedDeckEdge] // blockedEdges
    );

    // 1. Reroute must start from LIVE GPS position
    const rerouteStart = reroutedMission.fullPolyline[0];
    const startDistOffset = Math.hypot(rerouteStart[0] - liveGpsDriverPos[0], rerouteStart[1] - liveGpsDriverPos[1]) * 111;
    assert(startDistOffset < 0.05, `Rerouted polyline starts at driver live GPS (${rerouteStart[0].toFixed(4)}, ${rerouteStart[1].toFixed(4)})`);

    // 2. Destination sequence must remain strictly unchanged: 1 -> 2 -> 3 -> 4
    const seqOrder = (reroutedMission.orderedSequence || reroutedMission.routeSequence).map(s => s.seq);
    assert(JSON.stringify(seqOrder) === JSON.stringify([1, 2, 3, 4]), `Destination sequence preserved without skipping or reordering: [${seqOrder.join(', ')}]`);
    assert((reroutedMission.orderedSequence || reroutedMission.routeSequence)[0].name === emergencyStops[0].name, `First target remains SAME active destination: "${(reroutedMission.orderedSequence || reroutedMission.routeSequence)[0].name}"`);

    // 3. Exclude blocked edge: check that route crosses alternative bridge (Varadhi)
    let crossesVaradhi = false;
    reroutedMission.fullPolyline.forEach(([lat, lng]) => {
        // Kanaka Durga Varadhi Bridge spans between (16.500, 80.635) and (16.494, 80.647)
        if (Math.abs(lat - 16.497) < 0.008 && Math.abs(lng - 80.640) < 0.015) {
            crossesVaradhi = true;
        }
    });
    assert(crossesVaradhi, 'Detour successfully diverts traffic over alternative Kanaka Durga Varadhi Bridge');

    // 4. Valid road geometry: Zero illegal water cutting across river polygon
    let invalidWaterCrossings = 0;
    for (let i = 0; i < reroutedMission.fullPolyline.length - 1; i++) {
        const pt1 = reroutedMission.fullPolyline[i];
        const pt2 = reroutedMission.fullPolyline[i + 1];
        const s1 = isSouthOfRiver(pt1);
        const s2 = isSouthOfRiver(pt2);
        if (s1 !== s2) {
            const nearBarrage = Math.hypot(pt1[0] - 16.5062, pt1[1] - 80.6120) < 0.015 || Math.hypot(pt2[0] - 16.5062, pt2[1] - 80.6120) < 0.015;
            const nearVaradhi = Math.hypot(pt1[0] - 16.4980, pt1[1] - 80.6235) < 0.015 || Math.hypot(pt2[0] - 16.4980, pt2[1] - 80.6235) < 0.015;
            if (!nearBarrage && !nearVaradhi) {
                invalidWaterCrossings++;
            }
        }
    }
    assert(invalidWaterCrossings === 0, `New detour route strictly respects road geometry (illegal water crossings: ${invalidWaterCrossings})`);

    // 5. Unreachable corridor safety check: Block ALL bridges across river
    const allBridgesBlocked = [
        ['BARRAGE_NORTH', 'BARRAGE_APPROACH_N'],
        ['BARRAGE_APPROACH_N', 'BARRAGE_MID'],
        ['BARRAGE_MID', 'BARRAGE_SOUTH'],
        ['VARADHI_NORTH', 'VARADHI_MID'],
        ['VARADHI_MID', 'VARADHI_SOUTH']
    ];
    const unreachableCheck = quantumEngine.solveQuantumMultiNodeRoute(
        liveGpsDriverPos,
        emergencyStops,
        true,
        false,
        allBridgesBlocked
    );
    assert(unreachableCheck.status === 'BLOCKED' || unreachableCheck.legs[0].status === 'BLOCKED', 'When all bridge corridors are obstructed, status safely marked as BLOCKED');

    // -------------------------------------------------------------
    // PART 4: Backend API & Real-Time Alert Dispatch
    // -------------------------------------------------------------
    console.log('\n--- 4. Backend API & Officer Alert Verification ---');

    // Fetch initial fleet
    const fleetRes = await fetchJson('http://localhost:3000/api/fleet');
    assert(fleetRes.status === 200 && Array.isArray(fleetRes.body.fleet), 'Fleet endpoint responds HTTP 200');

    // Trigger road obstruction on Driver 1 via POST /api/fleet/1/obstruction
    const obstPayload = {
        blockedEdge: ['BARRAGE_NORTH', 'BARRAGE_APPROACH_N'],
        segmentName: 'Prakasam Barrage Deck',
        role: 'OFFICER',
        isDriverSimulation: true
    };
    const obstRes = await fetchJson('http://localhost:3000/api/fleet/1/obstruction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: obstPayload
    });

    assert(obstRes.status === 200 && obstRes.body.success, 'POST /api/fleet/1/obstruction successfully processed');
    assert(obstRes.body.driver?.isObstructed === true, 'Driver 1 marked isObstructed: true');
    assert(Array.isArray(obstRes.body.driver?.blockedEdges), 'Driver 1 blockedEdges recorded in backend');

    // Fetch alerts to confirm high-priority ROUTE_OBSTRUCTION alert is visible to officers
    const alertsRes = await fetchJson('http://localhost:3000/api/alerts', {
        headers: { 'x-role': 'OFFICER' }
    });
    assert(alertsRes.status === 200 && Array.isArray(alertsRes.body.alerts), 'GET /api/alerts returns alert list');

    const routeAlert = alertsRes.body.alerts.find(a => a.type === 'ROUTE_OBSTRUCTION' && a.driverId === 1);
    assert(routeAlert !== undefined, 'High-priority ROUTE_OBSTRUCTION alert created for Unit #1');
    assert(routeAlert?.severity === 'HIGH', `Alert severity is HIGH (got "${routeAlert?.severity}")`);
    assert(routeAlert?.notes.includes('destination') || !!routeAlert?.destinationNode, `Alert notes specify destination target`);

    // Clean up: Clear obstruction for Driver 1
    const clearRes = await fetchJson('http://localhost:3000/api/fleet/1/clear-obstruction', { method: 'POST' });
    assert(clearRes.status === 200, 'POST /api/fleet/1/clear-obstruction resets driver corridor status');

    // -------------------------------------------------------------
    // PART 5: Browser CDP End-to-End Verification
    // -------------------------------------------------------------
    console.log('\n--- 5. Browser CDP End-to-End Visual Verification ---');
    const tempDir = `C:\\Users\\tejoc\\AppData\\Local\\Temp\\edge-route-verify-${Date.now()}`;
    const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
        '--headless=new',
        '--remote-debugging-port=9227',
        '--window-size=1600,1000',
        `--user-data-dir=${tempDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        'http://localhost:3000/'
    ]);

    await sleep(2500);

    try {
        let page = null;
        for (let i = 0; i < 20; i++) {
            await sleep(500);
            try {
                const list = await getJson('http://127.0.0.1:9227/json/list');
                const p = list.find(t => t.type === 'page' && t.url.includes('localhost:3000'));
                if (p && p.webSocketDebuggerUrl) {
                    page = p;
                    break;
                }
            } catch (e) {}
        }
        if (!page) throw new Error('No Edge page target for localhost:3000 found');

        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise(r => ws.on('open', r));

        let id = 1;
        const send = (method, params = {}) => new Promise((res, rej) => {
            const reqId = id++;
            const handler = (msg) => {
                const data = JSON.parse(msg);
                if (data.id === reqId) {
                    ws.off('message', handler);
                    if (data.error) rej(data.error);
                    else res(data.result);
                }
            };
            ws.on('message', handler);
            ws.send(JSON.stringify({ id: reqId, method, params }));
        });

        const evalCode = async (expr) => {
            const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
            if (res?.exceptionDetails) {
                console.error('JS Eval Exception:', res.exceptionDetails.exception?.description || res.exceptionDetails.text);
            }
            return res?.result?.value;
        };

        await send('Page.enable');
        await send('DOM.enable');

        // Log in as Officer and Open Tactical Map
        await evalCode(`
            loginAsOfficer();
            toggleOfficerTacticalMap();
        `);
        await sleep(2500);

        // Open Route Info Panel for Unit #1
        await evalCode(`
            openRouteInfoPanel(state.fleet.find(d => d.id === 1));
        `);
        await sleep(1000);

        // Verify separated telemetry fields exist and are populated
        const activeDistText = await evalCode(`document.getElementById('route-info-distance-remaining')?.innerText`);
        const totalRemText = await evalCode(`document.getElementById('route-info-total-remaining')?.innerText`);
        const totalPlanText = await evalCode(`document.getElementById('route-info-total-planned')?.innerText`);
        const legsCountText = await evalCode(`document.getElementById('route-info-legs-count-badge')?.innerText`);
        const segmentBoxExists = await evalCode(`!!document.getElementById('route-info-segment-box')`);
        const routeBlockBtnExists = await evalCode(`!!document.getElementById('route-info-block-btn')`);

        assert(!!activeDistText && activeDistText.includes('km'), `Active target distance rendered: "${activeDistText}"`);
        assert(!!totalRemText && totalRemText.includes('km'), `Total remaining distance separated: "${totalRemText}"`);
        assert(!!totalPlanText && totalPlanText.includes('km'), `Total planned route distance separated: "${totalPlanText}"`);
        assert(!!legsCountText && legsCountText.includes('LEGS'), `Consecutive legs breakdown rendered: "${legsCountText}"`);
        assert(segmentBoxExists, 'Selected road segment box rendered in panel');
        assert(routeBlockBtnExists, 'Route Closed block action button present in panel');

        // Capture Route Telemetry Panel Screenshot
        const modalShot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'test-route-telemetry-separated-legs.png'), Buffer.from(modalShot.data, 'base64'));
        console.log('📸 [Artifact Saved] -> test-route-telemetry-separated-legs.png');

        // Close modal and test contextual route segment click
        await evalCode(`
            (() => {
                closeModal('route-info-modal');
                const d1 = state.fleet.find(d => d.id === 1);
                handleRouteSegmentClick(d1, { lat: 16.5072, lng: 80.6155 }, null, state.tacticalMasterMap);
            })()
        `);
        await sleep(1000);

        const popupText = await evalCode(`document.querySelector('.leaflet-popup-content')?.innerText || ''`);
        assert(popupText.includes('ROAD SEGMENT') || popupText.includes('Prakasam Barrage'), 'Map route click opened contextual popup with road identification');
        assert(popupText.includes('Route Closed'), 'Contextual popup has "Route Closed" action button');

        // Capture Map Contextual Popup Screenshot
        const mapShot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'test-map-route-segment-popup.png'), Buffer.from(mapShot.data, 'base64'));
        console.log('📸 [Artifact Saved] -> test-map-route-segment-popup.png');

        // Trigger Route Closed via confirmAndBlockRouteSegment in browser
        console.log('\n--- 6. Browser Click-to-Close & Live Detour Execution ---');
        await evalCode(`
            (() => {
                window.confirm = () => true;
                confirmAndBlockRouteSegment(1);
            })()
        `);
        await sleep(2000);

        const isObstructed = await evalCode(`state.fleet.find(d => d.id === 1)?.isObstructed`);
        const blockedEdges = await evalCode(`state.fleet.find(d => d.id === 1)?.blockedEdges?.length || 0`);
        assert(isObstructed === true, 'Browser fleet state updated: Unit #1 isObstructed = true');
        assert(blockedEdges > 0, `Browser fleet recorded ${blockedEdges} blocked edges for Unit #1`);

        // Capture Map Live Detour Screenshot
        const detourShot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(ARTIFACT_DIR, 'test-map-route-closed-detour-active.png'), Buffer.from(detourShot.data, 'base64'));
        console.log('📸 [Artifact Saved] -> test-map-route-closed-detour-active.png');

        ws.close();
    } catch (e) {
        console.error('Browser CDP verification error:', e);
        failed++;
    } finally {
        edge.kill();
    }

    console.log('\n================================================================');
    console.log(`🏆 SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runAllVerifications().catch(err => {
    console.error('Fatal execution error:', err);
    process.exit(1);
});
