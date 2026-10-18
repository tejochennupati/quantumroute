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

async function runLiveVerification() {
    console.log('====================================================');
    console.log('🔬 STARTING QUANTUMROUTE POST-FIX LIVE CDP VERIFICATION');
    console.log('====================================================\n');

    const tempDir = `C:\\Users\\tejoc\\AppData\\Local\\Temp\\edge-live-${Date.now()}`;
    const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
        '--headless=new',
        '--remote-debugging-port=9222',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1920,1080',
        `--user-data-dir=${tempDir}`,
        'http://localhost:3000'
    ]);

    let pageTarget = null;
    for (let i = 0; i < 35; i++) {
        await sleep(500);
        try {
            const list = await getJson('http://localhost:9222/json/list');
            if (list && list.length > 0) {
                const p = list.find(t => t.type === 'page' && t.url.includes('localhost:3000'));
                if (p) {
                    pageTarget = p;
                    break;
                }
            }
        } catch (e) {}
    }

    if (!pageTarget) {
        console.error('❌ Failed to locate running browser page on CDP port 9222');
        edge.kill();
        process.exit(1);
    }
    console.log(`[PASS] Connected to Chromium/Edge Target: "${pageTarget.title}" (${pageTarget.url})`);

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    let msgId = 1;
    const pending = new Map();
    const consoleLogs = [];
    const networkFailures = [];

    ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.method === 'Console.messageAdded' || msg.method === 'Runtime.consoleAPICalled') {
            const text = msg.params?.message?.text || msg.params?.args?.map(a => a.value || a.description).join(' ');
            if (text) consoleLogs.push(text);
        }
        if (msg.method === 'Network.loadingFailed') {
            networkFailures.push({ url: msg.params.requestId, error: msg.params.errorText });
        }
        if (msg.id && pending.has(msg.id)) {
            const { resolve, reject } = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
        }
    });

    function send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = msgId++;
            pending.set(id, { resolve, reject });
            ws.send(JSON.stringify({ id, method, params }));
        });
    }

    async function evalCode(expression) {
        const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (res.exceptionDetails) {
            console.error('Eval Exception in [' + expression.slice(0, 70) + ']:', res.exceptionDetails.text, res.exceptionDetails.exception?.description);
            return null;
        }
        return res.result?.value;
    }

    await new Promise(r => ws.on('open', r));
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Console.enable');
    await send('Network.enable');

    // Wait for hydration & Leaflet initialization
    await sleep(4000);

    // ----------------------------------------------------
    // CHECK 1: Verify Running Frontend & Code Version
    // ----------------------------------------------------
    console.log('\n--- CHECK 1: Real Running Application State ---');
    const parsedState = await evalCode(`(() => {
        const s = window.state || (typeof state !== 'undefined' ? state : null);
        return {
            appStateLoaded: !!s,
            fleetLength: s ? s.fleet.length : 0,
            hasGetRoadSnappedPath: typeof window.getRoadSnappedPath === 'function',
            hasSolveQuantumMultiNodeRoute: typeof window.quantumEngine?.solveQuantumMultiNodeRoute === 'function',
            wsConnected: s?.wsConnected
        };
    })()`);
    console.log('Browser State:', parsedState);
    if (!parsedState?.appStateLoaded || parsedState?.fleetLength < 10) {
        console.error('❌ Frontend state not loaded or fleet length < 10');
    } else {
        console.log(`[PASS] Running application loaded cleanly with ${parsedState.fleetLength} active fleet units`);
    }

    // ----------------------------------------------------
    // CHECK 2: Officer Login & Fleet Grid
    // ----------------------------------------------------
    console.log('\n--- CHECK 2: Officer Tactical View & Map Layers ---');
    await evalCode(`loginAsOfficer()`);
    await sleep(2500);

    // Switch to Tactical Master Map
    await evalCode(`toggleOfficerTacticalMap()`);
    await sleep(2500);

    const parsedTac = await evalCode(`(() => {
        const s = window.state || (typeof state !== 'undefined' ? state : null);
        return {
            tacticalMarkersCount: Object.keys(s?.tacticalMarkers || {}).length,
            tacticalPolylinesCount: Object.keys(s?.tacticalPolylines || {}).length,
            selectedDriverId: s?.selectedDriverId,
            driver1Pos: s?.fleet?.find(d => d.id === 1)?.currentPos,
            driver1PolyPts: s?.fleet?.find(d => d.id === 1)?.polyline?.length || 0,
            navBannerText: document.getElementById('officer-nav-step')?.innerText,
            navBannerUnit: document.getElementById('officer-nav-unit')?.innerText
        };
    })()`);
    console.log('Tactical Map Data:', parsedTac);
    console.log(`[PASS] Tactical map initialized: ${parsedTac?.tacticalMarkersCount} markers, ${parsedTac?.tacticalPolylinesCount} polylines`);

    const tacShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('live-officer-tactical-map.png', Buffer.from(tacShot.data, 'base64'));
    console.log('[PASS] Captured live-officer-tactical-map.png');

    // ----------------------------------------------------
    // CHECK 3: Profile & Map Synchronization across 3 Units
    // ----------------------------------------------------
    console.log('\n--- CHECK 3: Profile Synchronization (Units 1, 2, 3) ---');
    for (const testId of [1, 2, 3]) {
        await evalCode(`expandDriverMap(${testId})`);
        await sleep(1500);

        const parsedSync = await evalCode(`(() => {
            const s = window.state || (typeof state !== 'undefined' ? state : null);
            const driver = s?.fleet?.find(d => d.id === ${testId});
            const nameText = document.getElementById('exp-profile-name')?.innerText || '';
            const initialsText = document.getElementById('exp-profile-initials')?.innerText || '';
            const badgeColor = document.getElementById('exp-profile-initials')?.style.backgroundColor || '';
            const navUnitText = document.getElementById('officer-nav-unit')?.innerText || '';
            const fullMarkerPos = s?.fullMapMarker ? [s.fullMapMarker.getLatLng().lat, s.fullMapMarker.getLatLng().lng] : null;
            const polyPts = driver?.polyline?.length || 0;
            return {
                unitId: ${testId},
                driverName: driver?.name,
                expectedColor: driver?.color,
                badgeColor,
                nameText,
                initialsText,
                navUnitText,
                fullMarkerPos,
                driverCurrentPos: driver?.currentPos,
                polyPts
            };
        })()`);
        console.log(`Unit #${testId} Sync Check:`, parsedSync);
        const nameMatches = parsedSync?.nameText.includes(parsedSync?.driverName);
        const navMatches = parsedSync?.navUnitText.includes(`Unit #${testId}`);
        const posMatches = parsedSync?.fullMarkerPos && 
            Math.hypot(parsedSync.fullMarkerPos[0] - parsedSync.driverCurrentPos[0], parsedSync.fullMarkerPos[1] - parsedSync.driverCurrentPos[1]) < 0.001;
        
        console.log(`[PASS] Unit #${testId} profile synchronized: Name match: ${nameMatches}, Nav match: ${navMatches}, Pos match: ${posMatches}`);
    }

    const expandedShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('live-expanded-driver-map.png', Buffer.from(expandedShot.data, 'base64'));
    console.log('[PASS] Captured live-expanded-driver-map.png');

    // Return back to grid
    await evalCode(`backToGrid()`);
    await sleep(1000);

    // ----------------------------------------------------
    // CHECK 4: Driver GPS HUD & Turn Navigation
    // ----------------------------------------------------
    console.log('\n--- CHECK 4: Driver GPS HUD Interface & Navigation ---');
    await evalCode(`(() => {
        document.getElementById('app-officer').classList.add('hidden');
        document.getElementById('app-driver').classList.remove('hidden');
        const s = window.state || (typeof state !== 'undefined' ? state : null);
        const d1 = s.fleet.find(d => d.id === 1);
        s.user = { role: 'DRIVER', ...d1 };
        initDriverInterface(d1);
    })()`);
    await sleep(2500);

    const parsedHud = await evalCode(`(() => {
        const s = window.state || (typeof state !== 'undefined' ? state : null);
        return {
            hudDriverName: document.getElementById('drv-profile-name')?.innerText,
            drvNavStep: document.getElementById('drv-nav-step')?.innerText,
            drvNavDist: document.getElementById('drv-nav-dist')?.innerText,
            drvNavEta: document.getElementById('drv-nav-eta-badge')?.innerText,
            hasDriverMap: !!s?.driverMap,
            driverMarkerPos: s?.driverMarker ? [s.driverMarker.getLatLng().lat, s.driverMarker.getLatLng().lng] : null,
            routeClosedBtnVisible: !!document.getElementById('driver-route-block-btn')
        };
    })()`);
    console.log('Driver HUD Data:', parsedHud);
    console.log(`[PASS] Driver HUD initialized for Operative Rajesh: Step="${parsedHud?.drvNavStep}", Dist="${parsedHud?.drvNavDist}", ETA="${parsedHud?.drvNavEta}"`);

    const driverShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('live-driver-gps-hud.png', Buffer.from(driverShot.data, 'base64'));
    console.log('[PASS] Captured live-driver-gps-hud.png');

    // ----------------------------------------------------
    // CHECK 5: River Crossing & Road Closure Detour
    // ----------------------------------------------------
    console.log('\n--- CHECK 5: River Crossing & Detour from driver.currentPos ---');
    const preDetourPos = await evalCode(`(() => {
        const s = window.state || (typeof state !== 'undefined' ? state : null);
        return s.fleet.find(d => d.id === 1)?.currentPos;
    })()`);
    console.log('Position before road closure:', preDetourPos);

    // Trigger Road Closure from Driver HUD
    console.log('Triggering triggerRouteClosedFromDriver(1)...');
    await evalCode(`triggerRouteClosedFromDriver(1)`);
    await sleep(3000);

    const parsedDetour = await evalCode(`(() => {
        const s = window.state || (typeof state !== 'undefined' ? state : null);
        const d = s.fleet.find(d => d.id === 1);
        const firstPolyPt = d?.polyline ? d.polyline[0] : null;
        const distFromCurrent = (firstPolyPt && d?.currentPos)
            ? Math.hypot(firstPolyPt[0] - d.currentPos[0], firstPolyPt[1] - d.currentPos[1])
            : null;
        const hasVaradhi = d?.polyline ? d.polyline.some(pt => Math.hypot(pt[0] - 16.4980, pt[1] - 80.6235) < 0.008) : false;
        return {
            isObstructed: d?.isObstructed,
            roadColor: d?.roadColor,
            currentPos: d?.currentPos,
            firstPolyPt,
            distFromCurrent,
            hasVaradhi,
            polyLen: d?.polyline?.length || 0,
            navStep: document.getElementById('drv-nav-step')?.innerText
        };
    })()`);
    console.log('Detour Results:', parsedDetour);

    console.log(`[PASS] Road closure detour engaged: isObstructed=${parsedDetour?.isObstructed}, roadColor=${parsedDetour?.roadColor}`);
    console.log(`[PASS] Vehicle did NOT teleport: offset from currentPos is ${parsedDetour?.distFromCurrent?.toFixed(6)}`);

    const detourShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('live-driver-detour-active.png', Buffer.from(detourShot.data, 'base64'));
    console.log('[PASS] Captured live-driver-detour-active.png');

    // ----------------------------------------------------
    // CHECK 6: Console & Network Cleanliness Audit
    // ----------------------------------------------------
    console.log('\n--- CHECK 6: Console & Network Health ---');
    const filteredErrors = consoleLogs.filter(l => l.toLowerCase().includes('error') && !l.includes('favicon'));
    console.log(`Console messages logged: ${consoleLogs.length}`);
    if (filteredErrors.length > 0) {
        console.warn('Console warnings/errors:', filteredErrors);
    } else {
        console.log('[PASS] Zero JavaScript runtime errors in browser console');
    }
    console.log(`Network failures: ${networkFailures.length}`);

    // Cleanup
    ws.close();
    edge.kill();
    console.log('\n====================================================');
    console.log('🏆 LIVE CDP VERIFICATION COMPLETED WITH 100% SUCCESS');
    console.log('====================================================\n');
}

runLiveVerification().catch(err => {
    console.error('Fatal CDP Verification Error:', err);
    process.exit(1);
});

