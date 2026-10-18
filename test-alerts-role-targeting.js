const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = path.resolve('C:/Users/tejoc/.gemini/antigravity/brain/030dede3-bd1f-4780-b0f0-7f101ddcb4f9');

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function getJson(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = http.request({
            hostname: u.hostname,
            port: u.port,
            path: u.pathname + u.search,
            method: 'GET',
            headers
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
        req.end();
    });
}

function postJson(url, body, headers = {}) {
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

async function runRoleTargetingVerification() {
    console.log('====================================================');
    console.log('🚨 QUANTUMROUTE EMERGENCY ALERT ROLE TARGETING VERIFICATION');
    console.log('====================================================\n');

    let allTestsPassed = true;

    // ----------------------------------------------------
    // TEST 1: Direct REST API Authorization & Security
    // ----------------------------------------------------
    console.log('--- TEST 1: REST API SECURITY & ROLE RESTRICTION ---');

    // 1A. Driver calling GET /api/alerts must receive HTTP 403 Forbidden
    const resDriverGet = await getJson('http://127.0.0.1:3000/api/alerts', { 'x-role': 'DRIVER' });
    console.log(`[1A] Driver GET /api/alerts: HTTP ${resDriverGet.status} - ${resDriverGet.body?.message}`);
    if (resDriverGet.status === 403) {
        console.log('  ✅ PASS: Driver access to /api/alerts rejected with HTTP 403 Forbidden');
    } else {
        console.error(`  ❌ FAIL: Expected HTTP 403, got ${resDriverGet.status}`);
        allTestsPassed = false;
    }

    // 1B. Unauthenticated request to /api/alerts must receive HTTP 403 Forbidden
    const resAnonGet = await getJson('http://127.0.0.1:3000/api/alerts');
    console.log(`[1B] Anonymous GET /api/alerts: HTTP ${resAnonGet.status} - ${resAnonGet.body?.message}`);
    if (resAnonGet.status === 403) {
        console.log('  ✅ PASS: Anonymous request to /api/alerts rejected with HTTP 403 Forbidden');
    } else {
        console.error(`  ❌ FAIL: Expected HTTP 403, got ${resAnonGet.status}`);
        allTestsPassed = false;
    }

    // 1C. Spoofed Officer request with invalid token must receive HTTP 403 Forbidden
    const resSpoofGet = await getJson('http://127.0.0.1:3000/api/alerts', {
        'x-role': 'OFFICER',
        'Authorization': 'Bearer INVALID_HACKER_TOKEN'
    });
    console.log(`[1C] Spoofed Officer GET /api/alerts: HTTP ${resSpoofGet.status} - ${resSpoofGet.body?.message}`);
    if (resSpoofGet.status === 403) {
        console.log('  ✅ PASS: Spoofed Officer request rejected with HTTP 403 Forbidden');
    } else {
        console.error(`  ❌ FAIL: Expected HTTP 403, got ${resSpoofGet.status}`);
        allTestsPassed = false;
    }

    // 1D. Authorized Officer request with valid credentials must succeed with HTTP 200 OK
    const resOfficerGet = await getJson('http://127.0.0.1:3000/api/alerts', {
        'x-role': 'OFFICER',
        'Authorization': 'Bearer QUANTUM-ALPHA-2026-TEJO-COMMAND',
        'x-officer-id': 'GOV-TEJO-2026'
    });
    console.log(`[1D] Authorized Officer GET /api/alerts: HTTP ${resOfficerGet.status} (Count: ${resOfficerGet.body?.count})`);
    if (resOfficerGet.status === 200 && resOfficerGet.body?.success) {
        console.log('  ✅ PASS: Authorized Officer successfully fetched active emergency alerts');
    } else {
        console.error(`  ❌ FAIL: Expected HTTP 200, got ${resOfficerGet.status}`);
        allTestsPassed = false;
    }

    // 1E. Driver attempting to acknowledge an alert must receive HTTP 403 Forbidden
    const resDriverAck = await postJson('http://127.0.0.1:3000/api/alerts/TEST-ALERT-1/acknowledge', { role: 'DRIVER' }, { 'x-role': 'DRIVER' });
    console.log(`[1E] Driver POST /api/alerts/:id/acknowledge: HTTP ${resDriverAck.status} - ${resDriverAck.body?.message}`);
    if (resDriverAck.status === 403) {
        console.log('  ✅ PASS: Driver attempt to acknowledge alert rejected with HTTP 403 Forbidden');
    } else {
        console.error(`  ❌ FAIL: Expected HTTP 403, got ${resDriverAck.status}`);
        allTestsPassed = false;
    }

    // ----------------------------------------------------
    // TEST 2: WebSocket Role Isolation & Targeted Delivery
    // ----------------------------------------------------
    console.log('\n--- TEST 2: WEBSOCKET ROLE ISOLATION & ALERT DELIVERY ---');

    const officerMessages = [];
    const driverMessages = [];
    const anonymousMessages = [];

    const wsOfficer = new WebSocket('ws://127.0.0.1:3000');
    const wsDriver = new WebSocket('ws://127.0.0.1:3000');
    const wsAnon = new WebSocket('ws://127.0.0.1:3000');

    await Promise.all([
        new Promise(r => wsOfficer.on('open', r)),
        new Promise(r => wsDriver.on('open', r)),
        new Promise(r => wsAnon.on('open', r))
    ]);

    wsOfficer.on('message', d => {
        try { officerMessages.push(JSON.parse(d)); } catch (e) {}
    });
    wsDriver.on('message', d => {
        try { driverMessages.push(JSON.parse(d)); } catch (e) {}
    });
    wsAnon.on('message', d => {
        try { anonymousMessages.push(JSON.parse(d)); } catch (e) {}
    });

    // Authenticate wsOfficer as Officer
    wsOfficer.send(JSON.stringify({
        type: 'AUTH',
        role: 'OFFICER',
        officerId: 'GOV-TEJO-2026',
        token: 'QUANTUM-ALPHA-2026-TEJO-COMMAND'
    }));

    // Authenticate wsDriver as Driver Unit #1
    wsDriver.send(JSON.stringify({
        type: 'AUTH',
        role: 'DRIVER',
        driverId: 1,
        driverName: 'Rajesh'
    }));

    // Wait for auth processing
    await sleep(500);

    // Verify auth responses
    const offAuthMsg = officerMessages.find(m => m.type === 'AUTH_SUCCESS');
    const drvAuthMsg = driverMessages.find(m => m.type === 'AUTH_SUCCESS');
    console.log(`[2A] Officer WS Auth: ${offAuthMsg ? 'AUTH_SUCCESS (' + offAuthMsg.message + ')' : 'NONE'}`);
    console.log(`[2B] Driver WS Auth: ${drvAuthMsg ? 'AUTH_SUCCESS (' + drvAuthMsg.message + ')' : 'NONE'}`);

    if (offAuthMsg && drvAuthMsg) {
        console.log('  ✅ PASS: Both Officer and Driver WebSockets authenticated to server');
    } else {
        console.error('  ❌ FAIL: WebSocket authentication failed');
        allTestsPassed = false;
    }

    // Clear recorded messages before trigger
    const officerPreCount = officerMessages.length;
    const driverPreCount = driverMessages.length;
    const anonPreCount = anonymousMessages.length;

    // Trigger Emergency Unreachable Report from Driver 1
    console.log('\n[2C] Triggering Emergency Destination Unreachable Report from Driver #1...');
    const unreachableReportRes = await postJson('http://127.0.0.1:3000/api/fleet/1/unreachable-report', {
        role: 'DRIVER',
        driverId: 1,
        destinationNode: 'Ramavarappadu Emergency Junction',
        destinationCoords: [16.5250, 80.6800],
        reason: 'Bridge approach washed away by high storm surge',
        notes: 'Water depth exceeding 1.8 meters, impassable for relief trucks.'
    }, {
        'x-role': 'DRIVER',
        'x-driver-id': '1'
    });

    console.log(`     Report response: HTTP ${unreachableReportRes.status} (Alert ID: ${unreachableReportRes.body?.alert?.id})`);
    const createdAlertId = unreachableReportRes.body?.alert?.id;

    // Wait for WebSocket delivery
    await sleep(800);

    const officerNewMsgs = officerMessages.slice(officerPreCount);
    const driverNewMsgs = driverMessages.slice(driverPreCount);
    const anonNewMsgs = anonymousMessages.slice(anonPreCount);

    const officerAlertMsg = officerNewMsgs.find(m => m.type === 'DESTINATION_UNREACHABLE_REPORT' || m.type === 'SYSTEM_ALERT_CREATED');
    const driverAlertMsg = driverNewMsgs.find(m => m.type === 'DESTINATION_UNREACHABLE_REPORT' || m.type === 'SYSTEM_ALERT_CREATED');
    const anonAlertMsg = anonNewMsgs.find(m => m.type === 'DESTINATION_UNREACHABLE_REPORT' || m.type === 'SYSTEM_ALERT_CREATED');

    console.log(`[2D] Officer WS received alert: ${!!officerAlertMsg} (${officerAlertMsg?.type || 'NONE'})`);
    console.log(`[2E] Driver WS received alert: ${!!driverAlertMsg} (Expected: false)`);
    console.log(`[2F] Anon WS received alert: ${!!anonAlertMsg} (Expected: false)`);

    if (officerAlertMsg && !driverAlertMsg && !anonAlertMsg) {
        console.log('  ✅ PASS: Emergency alert delivered strictly to Officer WS; blocked on Driver & Anon sockets');
    } else {
        console.error('  ❌ FAIL: Alert leaked to Driver/Anon socket or not delivered to Officer');
        allTestsPassed = false;
    }

    // Test Alert Acknowledgment broadcast
    if (createdAlertId) {
        const offAckPreCount = officerMessages.length;
        const drvAckPreCount = driverMessages.length;

        console.log(`\n[2G] Officer acknowledging Alert ${createdAlertId}...`);
        const ackRes = await postJson(`http://127.0.0.1:3000/api/alerts/${createdAlertId}/acknowledge`, {
            role: 'OFFICER',
            officerId: 'GOV-TEJO-2026',
            token: 'QUANTUM-ALPHA-2026-TEJO-COMMAND'
        }, {
            'x-role': 'OFFICER',
            'Authorization': 'Bearer QUANTUM-ALPHA-2026-TEJO-COMMAND',
            'x-officer-id': 'GOV-TEJO-2026'
        });

        console.log(`     Acknowledge response: HTTP ${ackRes.status} (${ackRes.body?.message})`);
        await sleep(500);

        const offAckMsgs = officerMessages.slice(offAckPreCount);
        const drvAckMsgs = driverMessages.slice(drvAckPreCount);

        const offAckReceived = offAckMsgs.some(m => m.type === 'SYSTEM_ALERT_ACKNOWLEDGED');
        const drvAckReceived = drvAckMsgs.some(m => m.type === 'SYSTEM_ALERT_ACKNOWLEDGED');

        console.log(`[2H] Officer received SYSTEM_ALERT_ACKNOWLEDGED: ${offAckReceived}`);
        console.log(`[2I] Driver received SYSTEM_ALERT_ACKNOWLEDGED: ${drvAckReceived} (Expected: false)`);

        if (offAckReceived && !drvAckReceived) {
            console.log('  ✅ PASS: Alert acknowledgment broadcast delivered strictly to Officer');
        } else {
            console.error('  ❌ FAIL: Alert acknowledgment broadcast delivered to Driver or not delivered to Officer');
            allTestsPassed = false;
        }
    }

    // Close test sockets
    wsOfficer.close();
    wsDriver.close();
    wsAnon.close();

    // ----------------------------------------------------
    // TEST 3: Browser UI Verification via Chromium/Edge CDP
    // ----------------------------------------------------
    console.log('\n--- TEST 3: BROWSER CDP MULTI-ROLE CONCURRENT VERIFICATION ---');

    const tempDir = `C:\\Users\\tejoc\\AppData\\Local\\Temp\\edge-role-${Date.now()}`;
    const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
        '--headless=new',
        '--remote-debugging-port=9223',
        `--user-data-dir=${tempDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--disable-gpu',
        '--window-size=1600,1050',
        'http://127.0.0.1:3000'
    ]);

    let wsUrl = null;
    let pageTarget = null;
    for (let i = 0; i < 30; i++) {
        await sleep(500);
        try {
            const res = await getJson('http://127.0.0.1:9223/json/list');
            const list = Array.isArray(res) ? res : (res?.body || []);
            if (Array.isArray(list) && list.length > 0) {
                const p = list.find(t => t.type === 'page' && t.url && t.url.includes('3000'));
                if (p && p.webSocketDebuggerUrl) {
                    pageTarget = p;
                    wsUrl = p.webSocketDebuggerUrl;
                    break;
                }
            }
        } catch (e) {}
    }

    if (!wsUrl) {
        console.error('❌ Failed to connect to browser CDP socket on 127.0.0.1:9223');
        edge.kill();
        process.exit(1);
    }
    console.log(`[3A] Connected to Page Target: "${pageTarget.title}" (${pageTarget.url})`);

    const cdpWs = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
        cdpWs.on('open', resolve);
        cdpWs.on('error', reject);
    });

    let messageId = 1;
    const pendingRequests = new Map();

    cdpWs.on('message', (msg) => {
        const parsed = JSON.parse(msg);
        if (parsed.id && pendingRequests.has(parsed.id)) {
            const { resolve, reject } = pendingRequests.get(parsed.id);
            pendingRequests.delete(parsed.id);
            if (parsed.error) reject(new Error(parsed.error.message));
            else resolve(parsed.result);
        }
    });

    async function sendCdp(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = messageId++;
            pendingRequests.set(id, { resolve, reject });
            cdpWs.send(JSON.stringify({ id, method, params }));
        });
    }

    async function evalCode(expression) {
        const res = await sendCdp('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true
        });
        if (res && res.exceptionDetails) {
            console.error('Eval Exception in [' + expression.slice(0, 80) + ']:', res.exceptionDetails);
            return null;
        }
        return res?.result ? res.result.value : res?.value;
    }

    async function saveScreenshot(filename) {
        const res = await sendCdp('Page.captureScreenshot', { format: 'png' });
        if (res && res.data) {
            fs.writeFileSync(filename, Buffer.from(res.data, 'base64'));
            console.log(`  📸 [Artifact Saved] -> ${filename}`);
        }
    }

    await sendCdp('Page.enable');
    await sendCdp('Runtime.enable');
    await sleep(2000);

    // Step 3B: Login as Officer and verify Tactical Map & Alert Container
    console.log('\n[3B] Phase 1: Logging in as Authorized Command Officer...');
    await evalCode(`
        document.getElementById('off-id').value = 'GOV-TEJO-2026';
        document.getElementById('off-pass').value = 'QUANTUM-ALPHA-2026-TEJO-COMMAND';
        loginAsOfficer();
    `);
    await sleep(1500);

    // Switch to Tactical Map
    await evalCode(`toggleOfficerTacticalMap();`);
    await sleep(1000);

    // Trigger an emergency unreachable report from Driver #2
    console.log('[3C] Submitting destination unreachable report from Unit #2 (Benz Circle)...');
    await postJson('http://127.0.0.1:3000/api/fleet/2/unreachable-report', {
        role: 'DRIVER',
        driverId: 2,
        destinationNode: 'Benz Circle Medical Camp',
        destinationCoords: [16.5019, 80.6704],
        reason: 'Underpass totally flooded - Emergency diversion required',
        notes: 'Water depth 1.4m. Cannot reach delivery zone.'
    }, {
        'x-role': 'DRIVER',
        'x-driver-id': '2'
    });
    await sleep(1200);

    // Verify Officer UI has alert cards in #officer-persistent-alerts
    const officerAlertCount = await evalCode(`
        document.querySelectorAll('#officer-persistent-alerts [id^="alert-card-"]').length;
    `);
    const officerAlertText = await evalCode(`
        (() => {
            const el = document.getElementById('officer-persistent-alerts');
            return el ? el.innerText : '';
        })()
    `);
    console.log(`[3D] Officer Tactical Map alert count: ${officerAlertCount}`);
    console.log(`     Alert text preview: "${(officerAlertText || '').slice(0, 100).replace(/\\n/g, ' ')}..."`);

    if (officerAlertCount > 0) {
        console.log('  ✅ PASS: Command Officer Tactical Map successfully displays persistent emergency alert card');
    } else {
        console.error('  ❌ FAIL: Alert card not found in officer-persistent-alerts');
        allTestsPassed = false;
    }

    const officerShotPath = path.join(ARTIFACT_DIR, 'test-officer-alert-rendered.png');
    await saveScreenshot(officerShotPath);

    // Step 3E: Switch session to Driver Rajesh (DRIVER-RAJESH-01)
    console.log('\n[3E] Phase 2: Switching session to Driver Rajesh (DRIVER-RAJESH-01)...');
    await evalCode(`
        (() => {
            switchAuthTab('driver');
            document.getElementById('drv-id').value = 'DRIVER-RAJESH-01';
            document.getElementById('drv-pass').value = '123456';
            loginAsDriver();
        })()
    `);
    await sleep(2000);

    const isDriverAppVisible = await evalCode(`
        (() => {
            const drv = document.getElementById('app-driver');
            const off = document.getElementById('app-officer');
            return drv && !drv.classList.contains('hidden') && off && off.classList.contains('hidden');
        })()
    `);
    console.log(`[3F] Driver Field Console Active: ${isDriverAppVisible}`);

    // Verify Officer emergency banners and alert cards are absent from Driver view
    const driverAlertsInDom = await evalCode(`
        (() => {
            const alerts = document.getElementById('officer-persistent-alerts');
            return alerts ? alerts.querySelectorAll('[id^="alert-card-"]').length : 0;
        })()
    `);
    const isOfficerBannerVisible = await evalCode(`
        (() => {
            const banner = document.getElementById('emergency-sos-banner');
            return banner ? !banner.classList.contains('hidden') : false;
        })()
    `);
    console.log(`[3G] Alert Cards in Driver View: ${driverAlertsInDom} (Expected: 0)`);
    console.log(`[3H] Officer SOS Banner visible in Driver View: ${isOfficerBannerVisible} (Expected: false)`);

    if (driverAlertsInDom === 0 && !isOfficerBannerVisible) {
        console.log('  ✅ PASS: Driver interface completely clean of Officer emergency alerts and banners');
    } else {
        console.error('  ❌ FAIL: Officer alerts or banners leaked into Driver view');
        allTestsPassed = false;
    }

    // Step 3I: Trigger another emergency alert from Unit #3 while Driver #1 is in session
    console.log('\n[3I] Triggering emergency alert from Unit #3 while Driver Rajesh is active...');
    await postJson('http://127.0.0.1:3000/api/fleet/3/unreachable-report', {
        role: 'DRIVER',
        driverId: 3,
        destinationNode: 'Gunadala Relief Outpost',
        destinationCoords: [16.5332, 80.6661],
        reason: 'Tree fallen across road and high tension wires down',
        notes: 'Corridor impassable.'
    }, {
        'x-role': 'DRIVER',
        'x-driver-id': '3'
    });
    await sleep(1000);

    // Verify Driver screen popped 0 toast alerts about unreachable destination
    const driverToasts = await evalCode(`
        Array.from(document.querySelectorAll('.broadcast-toast, [id^="toast-"]')).map(t => t.innerText).join(' | ');
    `);
    const hasUnreachableToast = (driverToasts || '').includes('UNREACHABLE!') || (driverToasts || '').includes('HIGH PRIORITY');
    console.log(`[3J] Driver Toast content: "${driverToasts || 'NONE'}" (Leaked: ${hasUnreachableToast})`);

    if (!hasUnreachableToast) {
        console.log('  ✅ PASS: Driver received ZERO officer alert toasts or siren sounds');
    } else {
        console.error('  ❌ FAIL: Officer emergency alert toast leaked onto Driver display');
        allTestsPassed = false;
    }

    // Step 3K: Verify Driver navigation, turn-by-turn banner, and live GPS marker are working
    console.log('\n[3K] Verifying Driver navigation non-regression...');
    const driverNavStep = await evalCode(`
        (() => {
            const el = document.getElementById('drv-nav-step');
            return el ? el.innerText : '';
        })()
    `);
    const driverNavDist = await evalCode(`
        (() => {
            const el = document.getElementById('drv-nav-dist');
            return el ? el.innerText : '';
        })()
    `);
    const driverMarkerActive = await evalCode(`
        typeof state !== 'undefined' && !!state.driverMarker;
    `);

    console.log(`[3L] Driver Turn-by-Turn Instruction: "${driverNavStep}"`);
    console.log(`[3M] Driver Distance to Next Turn: "${driverNavDist}"`);
    console.log(`[3N] Driver Live GPS Marker Active: ${driverMarkerActive}`);

    if (driverNavStep && driverMarkerActive) {
        console.log('  ✅ PASS: Driver navigation instructions, turn-by-turn banner, and GPS marker verified intact');
    } else {
        console.error('  ❌ FAIL: Driver navigation or GPS marker regression detected');
        allTestsPassed = false;
    }

    const driverShotPath = path.join(ARTIFACT_DIR, 'test-driver-isolated-hud.png');
    await saveScreenshot(driverShotPath);

    // Clean up
    cdpWs.close();
    edge.kill();

    console.log('\n====================================================');
    if (allTestsPassed) {
        console.log('🎉 ALL EMERGENCY ALERT ROLE TARGETING TESTS PASSED (100%)');
        console.log('====================================================');
        process.exit(0);
    } else {
        console.error('❌ SOME TESTS FAILED. Check log output above.');
        console.log('====================================================');
        process.exit(1);
    }
}

runRoleTargetingVerification().catch(err => {
    console.error('Unhandled verification error:', err);
    process.exit(1);
});
