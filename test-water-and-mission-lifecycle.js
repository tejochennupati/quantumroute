const assert = require('assert');
const { calculateRoadRouteSync, calculateRoadRoute } = require('./js/quantum.js');
const { isSouthOfRiver, validateDestinationAccessibility, getRoadSnappedPath } = require('./js/config.js');

async function testWaterAndMissionLifecycle() {
    console.log('================================================================');
    console.log('🧪 VERIFYING WATER-AVOIDANCE AND MISSION LIFECYCLE REQUIREMENTS');
    console.log('================================================================\n');

    // 1. Water Coordinate Rejection
    console.log('--- 1. Water Coordinate Validation ---');
    // Test points in the Krishna River at various longitudes:
    // Reservoir / Bhavani island channel (80.590)
    const pWest = [16.5100, 80.5900];
    const accWest = validateDestinationAccessibility(pWest);
    assert.strictEqual(accWest.isAccessible, false, 'West river water must be inaccessible');
    assert.strictEqual(accWest.reason, 'WATER_BODY_UNREACHABLE');
    console.log('[PASS] West river channel rejected:', accWest.reason);

    // River channel between bridges (80.6180)
    const pMid = [16.5020, 80.6180];
    const accMid = validateDestinationAccessibility(pMid);
    assert.strictEqual(accMid.isAccessible, false, 'Mid river water must be inaccessible');
    assert.strictEqual(accMid.reason, 'WATER_BODY_UNREACHABLE');
    console.log('[PASS] Mid river channel rejected:', accMid.reason);

    // River channel east of Varadhi (80.6500)
    const pEast1 = [16.4850, 80.6500];
    const accEast1 = validateDestinationAccessibility(pEast1);
    assert.strictEqual(accEast1.isAccessible, false, 'East river water (80.6500) must be inaccessible');
    assert.strictEqual(accEast1.reason, 'WATER_BODY_UNREACHABLE');
    console.log('[PASS] East river channel (80.6500) rejected:', accEast1.reason);

    // River channel further east near Yanamalakuduru (80.6750)
    const pEast2 = [16.4740, 80.6750];
    const accEast2 = validateDestinationAccessibility(pEast2);
    assert.strictEqual(accEast2.isAccessible, false, 'East river water (80.6750) must be inaccessible');
    assert.strictEqual(accEast2.reason, 'WATER_BODY_UNREACHABLE');
    console.log('[PASS] East river channel (80.6750) rejected:', accEast2.reason);

    // 2. River Bank Classification (isSouthOfRiver)
    console.log('\n--- 2. North vs South River Classification ---');
    // North bank: Benz Circle, Patamata, Autonagar
    assert.strictEqual(isSouthOfRiver([16.5019, 80.6704]), false, 'Benz Circle is North');
    assert.strictEqual(isSouthOfRiver([16.4980, 80.6790]), false, 'Patamata is North');
    assert.strictEqual(isSouthOfRiver([16.4880, 80.7040]), false, 'Autonagar is North');
    // South bank: Tadepalli, Mangalagiri, Gundimeda
    assert.strictEqual(isSouthOfRiver([16.4850, 80.6020]), true, 'Tadepalli is South');
    assert.strictEqual(isSouthOfRiver([16.4300, 80.5500]), true, 'Mangalagiri is South');
    assert.strictEqual(isSouthOfRiver([16.4650, 80.6500]), true, 'Gundimeda / South bank is South');
    console.log('[PASS] All North and South coordinates classified with 100% accuracy');

    // 3. Cross-River Route Bridge Enforcement
    console.log('\n--- 3. Cross-River Route Bridge Clamping ---');
    // Route from North (Benz Circle) to South (Tadepalli)
    const routeCross = await calculateRoadRoute([16.5019, 80.6704], [16.4850, 80.6020]);
    assert.strictEqual(routeCross.status, 'success');
    const crossesBridge = routeCross.geometry.some(pt =>
        (Math.hypot(pt[0] - 16.5062, pt[1] - 80.6120) < 0.006) || // Barrage
        (Math.hypot(pt[0] - 16.4980, pt[1] - 80.6235) < 0.006)    // Varadhi
    );
    assert.strictEqual(crossesBridge, true, 'Cross-river route must traverse a verified bridge');
    console.log(`[PASS] Cross-river route verified through bridge deck (${routeCross.bridgeCrossing}, ${routeCross.geometry.length} vertices)`);

    // Verify no line cuts water outside the bridge corridors
    // For every segment, check if it inappropriately crosses the river boundary far from bridges
    let invalidWaterCrossings = 0;
    for (let i = 0; i < routeCross.geometry.length - 1; i++) {
        const pt1 = routeCross.geometry[i];
        const pt2 = routeCross.geometry[i + 1];
        const s1 = isSouthOfRiver(pt1);
        const s2 = isSouthOfRiver(pt2);
        if (s1 !== s2) {
            // Must be near Barrage or Varadhi
            const nearBarrage = Math.hypot(pt1[0] - 16.5062, pt1[1] - 80.6120) < 0.015 || Math.hypot(pt2[0] - 16.5062, pt2[1] - 80.6120) < 0.015;
            const nearVaradhi = Math.hypot(pt1[0] - 16.4980, pt1[1] - 80.6235) < 0.015 || Math.hypot(pt2[0] - 16.4980, pt2[1] - 80.6235) < 0.015;
            if (!nearBarrage && !nearVaradhi) {
                invalidWaterCrossings++;
            }
        }
    }
    assert.strictEqual(invalidWaterCrossings, 0, 'Zero illegal river crossings outside of bridge corridors');
    console.log('[PASS] ZERO illegal water crossings outside bridge corridors');

    // 4. Mission State Integrity via API
    console.log('\n--- 4. Mission State & Fleet Integrity ---');
    const http = require('http');
    const fleetData = await new Promise((resolve, reject) => {
        http.get('http://localhost:3000/api/fleet?viewerRole=OFFICER', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });

    const driver1 = fleetData.fleet.find(d => d.id === 1);
    assert(driver1, 'Driver 1 must exist');
    console.log(`Driver 1 Mission Status: "${driver1.missionStatus}"`);
    console.log(`Driver 1 Target Node: "${driver1.node}"`);
    console.log(`Driver 1 Stops Count: ${driver1.routeSequence.length}`);

    // Verify it is NOT prematurely DELIVERED
    assert(driver1.missionStatus !== 'DELIVERED', 'Mission must NOT be DELIVERED upon boot or assignment');
    assert(['ROUTE_READY', 'DISPATCHED', 'IN_PROGRESS'].includes(driver1.missionStatus), 'Mission status must be ROUTE_READY, DISPATCHED, or IN_PROGRESS');

    // Verify Stop 1 is IN_PROGRESS and subsequent are PENDING
    assert.strictEqual(driver1.routeSequence[0].status, 'IN_PROGRESS', 'Stop 1 must be IN_PROGRESS');
    for (let s = 1; s < driver1.routeSequence.length; s++) {
        assert(['PENDING', 'SCHEDULED'].includes(driver1.routeSequence[s].status), `Stop ${s + 1} must be PENDING/SCHEDULED`);
    }
    console.log('[PASS] Stop 1 is IN_PROGRESS, stops 2-10 are PENDING/SCHEDULED');

    // Verify polyline exists and is not collapsed
    assert(Array.isArray(driver1.polyline) && driver1.polyline.length >= 20, `Polyline must be dense (>20 pts, got ${driver1.polyline.length})`);
    console.log(`[PASS] Polyline is active and intact (${driver1.polyline.length} coordinates)`);

    // Verify Driver 1 currentPos is not teleported
    const stagingLoc = [16.5062, 80.6120];
    const distFromStaging = Math.hypot(driver1.currentPos[0] - stagingLoc[0], driver1.currentPos[1] - stagingLoc[1]);
    console.log(`Driver 1 currentPos: [${driver1.currentPos[0]}, ${driver1.currentPos[1]}] (offset from staging: ${distFromStaging.toFixed(6)})`);
    assert(distFromStaging < 0.05, 'Driver marker must remain at verified staging location');
    console.log('[PASS] Driver 1 verified at staging position without premature teleportation');

    console.log('\n================================================================');
    console.log('🎉 ALL WATER-AVOIDANCE AND MISSION LIFECYCLE TESTS PASSED 100%!');
    console.log('================================================================\n');
}

testWaterAndMissionLifecycle().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});

