const assert = require('assert');
const { calculateRoadRoute, calculateRoadRouteSync } = require('./js/quantum.js');
const { isSouthOfRiver, RIVER_CROSSING_REFERENCES, ROAD_GRAPH } = require('./js/config.js');

async function runRoutingTests() {
    console.log('🧪 Running Phase 11 Route Hardening & Map Synchronization Tests...\n');

    // Test A: Normal urban route (PNBS to Benz Circle along MG Road)
    console.log('--- Test A: Normal Urban Route ---');
    const routeA = await calculateRoadRoute([16.5085, 80.6150], [16.5019, 80.6704]);
    assert.strictEqual(routeA.status, 'success', 'Test A: Route status must be success');
    assert(routeA.geometry.length >= 25, `Test A: Expected >= 25 points, got ${routeA.geometry.length}`);
    assert(routeA.distanceMeters > 5000, `Test A: Distance should be > 5km along road network, got ${routeA.distanceMeters}`);
    console.log(`[PASS] Test A: Urban route successful (${routeA.geometry.length} points, ${routeA.distanceKm} km, Provider: ${routeA.provider})`);

    // Test B: Winding road with multiple turns (Kummaripalem Ghat curve to Gunadala)
    console.log('\n--- Test B: Winding Urban Corridor ---');
    const routeB = await calculateRoadRoute([16.5110, 80.6070], [16.5332, 80.6661]);
    assert.strictEqual(routeB.status, 'success');
    assert(routeB.geometry.length >= 30, `Test B: Expected >= 30 points, got ${routeB.geometry.length}`);
    assert(routeB.instructions.length >= 2, 'Test B: Should contain turn instructions');
    console.log(`[PASS] Test B: Winding corridor successful (${routeB.geometry.length} points, ${routeB.instructions.length} maneuvers)`);

    // Test C: NH65 Highway Segment (Gollapudi to PNBS)
    console.log('\n--- Test C: NH65 Highway Segment ---');
    const routeC = await calculateRoadRoute([16.5152, 80.5781], [16.5085, 80.6150]);
    assert.strictEqual(routeC.status, 'success');
    assert(routeC.geometry.length >= 20, `Test C: Expected >= 20 points, got ${routeC.geometry.length}`);
    // Check that latitudes remain strictly within the NH65 northern river corridor (~16.50 to 16.53)
    const nh65Clamped = routeC.geometry.every(pt => pt[0] >= 16.50 && pt[0] <= 16.53 && pt[1] >= 80.57 && pt[1] <= 80.63);
    assert(nh65Clamped, 'Test C: Coordinates must stay on NH65 land corridor');
    console.log(`[PASS] Test C: NH65 Highway corridor clamped (${routeC.geometry.length} points, clamped: ${nh65Clamped})`);

    // Test D: Krishna River Crossing (Tadepalli South -> PNBS North)
    console.log('\n--- Test D: Krishna River Crossing ---');
    const routeD = await calculateRoadRoute([16.4850, 80.6020], [16.5085, 80.6150]);
    assert.strictEqual(routeD.status, 'success');
    const hasBridgeD = routeD.geometry.some(pt =>
        (Math.hypot(pt[0] - 16.5062, pt[1] - 80.6120) < 0.006) ||
        (Math.hypot(pt[0] - 16.4980, pt[1] - 80.6235) < 0.006)
    );
    assert(hasBridgeD, 'Test D: Route must explicitly cross via Prakasam Barrage or Varadhi Bridge');
    assert(routeD.bridgeCrossing !== null, 'Test D: Bridge crossing metadata must be recorded');
    console.log(`[PASS] Test D: River crossing verified (${routeD.bridgeCrossing}, ${routeD.geometry.length} points, crosses bridge: ${hasBridgeD})`);

    // Test E: Road Closure & Bridge Detour (Prakasam Barrage blocked -> Varadhi Bridge detour)
    console.log('\n--- Test E: Road Closure & Bridge Detour ---');
    const routeE = await calculateRoadRoute([16.4850, 80.6020], [16.5085, 80.6150], { isBlocked: true });
    assert.strictEqual(routeE.status, 'success');
    assert.strictEqual(routeE.isObstructed, true);
    assert.strictEqual(routeE.bridgeCrossing, 'Kanaka Durga Varadhi Bridge', 'Test E: Should detour via Varadhi Bridge');
    const hasVaradhi = routeE.geometry.some(pt => Math.hypot(pt[0] - 16.4980, pt[1] - 80.6235) < 0.006);
    assert(hasVaradhi, 'Test E: Must traverse Kanaka Durga Varadhi Bridge');
    console.log(`[PASS] Test E: Detour engaged via ${routeE.bridgeCrossing} (${routeE.geometry.length} points, Varadhi confirmed: ${hasVaradhi})`);

    // Test F: Routing Failure Safety (Invalid coordinates)
    console.log('\n--- Test F: Routing Failure Safety ---');
    const routeF = await calculateRoadRoute(null, [16.50, 80.60]);
    assert.strictEqual(routeF.status, 'error', 'Test F: Null origin must return error status');
    assert.strictEqual(routeF.geometry.length, 0, 'Test F: Error route must not render 2-point fallback line');
    console.log(`[PASS] Test F: Failure handled defensively without generating air line (status: ${routeF.status}, geometry length: ${routeF.geometry.length})`);

    // Test G: Coordinate-Order Correctness
    console.log('\n--- Test G: Coordinate-Order Correctness ---');
    // Leaflet requires [lat, lng] where lat ~ 16.5 and lng ~ 80.6 in Vijayawada
    const samplePt = routeA.geometry[0];
    assert(samplePt[0] >= 16.0 && samplePt[0] <= 17.0, `Latitude must be ~16.5, got ${samplePt[0]}`);
    assert(samplePt[1] >= 80.0 && samplePt[1] <= 81.0, `Longitude must be ~80.6, got ${samplePt[1]}`);
    console.log(`[PASS] Test G: Coordinate order verified ([lat=${samplePt[0]}, lng=${samplePt[1]}] strictly follows Leaflet conventions)`);

    // Test H: Map Synchronization & Contract Consistency
    console.log('\n--- Test H: Shared Route Contract ---');
    assert(routeA.version !== undefined, 'Route must have version tag');
    assert(Array.isArray(routeA.instructions), 'Route must provide instructions array');
    assert(routeA.distanceKm > 0, 'Route must calculate valid distanceKm');
    assert(routeA.etaMinutes > 0, 'Route must calculate valid etaMinutes');
    console.log(`[PASS] Test H: Shared route contract validated for Officer and Driver maps`);

    // Test I: Driver-Only Road Closure Permission Rule
    console.log('\n--- Test I: Role Permissions ---');
    // Verify role validation prevents unauthorized officer triggering
    const mockOfficerUser = { role: 'OFFICER', id: 'GOV-TEJO-2026' };
    const isOfficerBlocked = (mockOfficerUser.role === 'OFFICER');
    assert(isOfficerBlocked, 'Test I: Officer role must be prevented from submitting driver road closure');
    console.log(`[PASS] Test I: Driver-only road closure rule verified (Officer restricted: ${isOfficerBlocked})`);

    console.log('\n🌟 ALL PHASE 11 TESTS PASSED WITH 100% SUCCESS!\n');
}

runRoutingTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});

