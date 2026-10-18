/**
 * Verification Test Suite:
 * - Driver profile and map synchronization (Units 1, 2, 3 data isolation)
 * - Vehicle movement along sequential road vertices
 * - Reroute persistence without backward teleportation
 * - Strict road adherence and river bridge clamping
 */

const http = require('http');

function apiRequest(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(`http://localhost:3000${path}`);
        const req = http.request(url, {
            method,
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function verifyBridgeCrossing(coords) {
    const barrage = [16.5062, 80.6120];
    const varadhi = [16.4980, 80.6235];
    let crossed = false;
    for (const c of coords) {
        if (Math.hypot(c[0] - barrage[0], c[1] - barrage[1]) < 0.008 ||
            Math.hypot(c[0] - varadhi[0], c[1] - varadhi[1]) < 0.008) {
            crossed = true;
            break;
        }
    }
    return crossed;
}

async function runTests() {
    console.log("🚀 Running QuantumRoute Synchronization & Navigation Verifications...\n");
    let passed = 0;
    let total = 0;

    function assert(cond, name, details = "") {
        total++;
        if (cond) {
            console.log(`[PASS] ${total}. ${name}`);
            passed++;
        } else {
            console.error(`[FAIL] ${total}. ${name} - ${details}`);
            process.exitCode = 1;
        }
    }

    // 1. Fetch fleet and verify isolation between Unit 1, 2, 3
    const fleetRes = await apiRequest('/api/fleet?viewerRole=OFFICER');
    assert(fleetRes.status === 200 && fleetRes.data.fleet.length >= 10, "Fetch full fleet successfully");

    const u1 = fleetRes.data.fleet.find(d => d.id === 1);
    const u2 = fleetRes.data.fleet.find(d => d.id === 2);
    const u3 = fleetRes.data.fleet.find(d => d.id === 3);

    assert(u1 && u2 && u3, "Units 1, 2, and 3 exist in active fleet");
    assert(u1.id !== u2.id && u2.id !== u3.id, "Distinct driver IDs");
    assert(u1.color !== u2.color && u2.color !== u3.color, "Distinct color palettes");
    assert(u1.name !== u2.name && u2.name !== u3.name, "Distinct driver names");
    assert(u1.currentPos[0] !== u2.currentPos[0] || u1.currentPos[1] !== u2.currentPos[1], "Distinct initial GPS positions");

    // 2. Strict road adherence - no direct 2-point polylines
    for (const u of [u1, u2, u3]) {
        assert(u.polyline && u.polyline.length > 20, `Unit #${u.id} has high-density road polyline (${u.polyline.length} vertices)`);
        // Check river crossing bridge clamping if river is crossed
        const startLat = u.currentPos[0];
        const targetLat = u.targetPos[0];
        if ((startLat > 16.505 && targetLat < 16.495) || (startLat < 16.495 && targetLat > 16.505)) {
            assert(verifyBridgeCrossing(u.polyline), `Unit #${u.id} river crossing clamped to land bridge deck`);
        }
    }

    // 3. Dynamic Stop Progression without teleporting
    // Advance Unit 1 to next stop
    const advanceRes = await apiRequest('/api/fleet/1/advance', 'POST');
    assert(advanceRes.status === 200 && advanceRes.data.success, "Advance Unit #1 to Next Stop");
    const advancedU1 = advanceRes.data.driver;
    const completedStops = advancedU1.routeSequence.filter(s => s.status === 'COMPLETED');
    assert(completedStops.length >= 1, `Unit #1 has ${completedStops.length} completed stops`);
    const activeCurrentPos = advancedU1.currentPos;

    // Verify polyline starts at activeCurrentPos
    const firstPolyPt = advancedU1.polyline[0];
    const distFromPos = Math.hypot(firstPolyPt[0] - activeCurrentPos[0], firstPolyPt[1] - activeCurrentPos[1]);
    assert(distFromPos < 0.002, `Unit #1 polyline starts at driver.currentPos (offset: ${distFromPos.toFixed(6)})`);

    // 4. Trigger Road Obstruction & Detour - Verify NO TELEPORTATION back to completed stops
    const obsRes = await apiRequest('/api/fleet/1/obstruction', 'POST');
    assert(obsRes.status === 200 && obsRes.data.success, "Trigger Route Obstruction for Unit #1");
    const detouredU1 = obsRes.data.driver;
    assert(detouredU1.isObstructed === true, "Unit #1 marked as obstructed");

    // The rerouted polyline MUST start at activeCurrentPos and NOT at completedStops[0]
    const rerouteStartPt = detouredU1.polyline[0];
    const rerouteDistFromPos = Math.hypot(rerouteStartPt[0] - activeCurrentPos[0], rerouteStartPt[1] - activeCurrentPos[1]);
    assert(rerouteDistFromPos < 0.002, `Rerouted polyline starts strictly at vehicle currentPos (offset: ${rerouteDistFromPos.toFixed(6)})`);

    // Check that reroute doesn't start from first completed stop
    if (completedStops.length > 0 && (completedStops[0].lat !== activeCurrentPos[0] || completedStops[0].lng !== activeCurrentPos[1])) {
        const distFromCompleted = Math.hypot(rerouteStartPt[0] - completedStops[0].lat, rerouteStartPt[1] - completedStops[0].lng);
        assert(distFromCompleted > 0.005, "Vehicle did NOT teleport back to origin/completed stop upon rerouting");
    }

    // 5. Clear Obstruction and Verify forward continuity
    const clearRes = await apiRequest('/api/fleet/1/clear-obstruction', 'POST');
    assert(clearRes.status === 200 && clearRes.data.success, "Clear Route Obstruction for Unit #1");
    const clearedU1 = clearRes.data.driver;
    assert(clearedU1.isObstructed === false, "Unit #1 corridor reopened");
    const restoredStartPt = clearedU1.polyline[0];
    const restoredDist = Math.hypot(restoredStartPt[0] - activeCurrentPos[0], restoredStartPt[1] - activeCurrentPos[1]);
    assert(restoredDist < 0.002, `Restored polyline starts strictly at current vehicle position`);

    // 6. Real-Time Telemetry Update
    const telRes = await apiRequest('/api/fleet/1/telemetry', 'POST', {
        currentPos: [16.5100, 80.6200],
        speed: 45,
        heading: 90,
        fuelBurnRate: 0.14
    });
    assert(telRes.status === 200 && telRes.data.success, "Submit Real-Time Telemetry Packet");
    assert(telRes.data.driver.currentPos[0] === 16.5100 && telRes.data.driver.currentPos[1] === 80.6200, "Driver currentPos updated");
    assert(telRes.data.driver.heading === 90, "Driver heading updated to 90 degrees");

    console.log(`\n========================================`);
    console.log(`🏆 RESULTS: ${passed}/${total} TESTS PASSED`);
    console.log(`========================================\n`);
}

runTests().catch(err => {
    console.error("Test runner error:", err);
    process.exit(1);
});

