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

async function captureUIVerification() {
    console.log('Capturing UI verification screenshots via Edge CDP...');
    const tempDir = `C:\\Users\\tejoc\\AppData\\Local\\Temp\\edge-verify-${Date.now()}`;
    const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
        '--headless=new',
        '--remote-debugging-port=9225',
        '--window-size=1600,1000',
        `--user-data-dir=${tempDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        'http://localhost:3000/'
    ]);

    await sleep(2500);

    try {
        const list = await getJson('http://127.0.0.1:9225/json/list');
        const page = list.find(t => t.type === 'page');
        if (!page) throw new Error('No page target found');

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
            const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
            return r.result ? r.result.value : null;
        };

        const saveScreenshot = async (name) => {
            const r = await send('Page.captureScreenshot', { format: 'png' });
            const buf = Buffer.from(r.data, 'base64');
            const dest = `C:\\Users\\tejoc\\.gemini\\antigravity\\brain\\030dede3-bd1f-4780-b0f0-7f101ddcb4f9\\${name}`;
            fs.writeFileSync(dest, buf);
            console.log(`Saved screenshot -> ${name}`);
        };

        await sleep(2000);

        // 1. Officer tactical map view
        await evalCode(`
            (() => {
                switchAuthTab('officer');
                document.getElementById('off-id').value = 'GOV-TEJO-2026';
                document.getElementById('off-pass').value = '123456';
                loginAsOfficer();
            })()
        `);
        await sleep(2500);
        await saveScreenshot('ui-verify-officer-tactical-map.png');

        const officerBannerUnit = await evalCode(`document.getElementById('officer-nav-unit')?.innerText;`);
        const officerBannerStep = await evalCode(`document.getElementById('officer-nav-step')?.innerText;`);
        console.log('Officer banner:', { unit: officerBannerUnit, step: officerBannerStep });

        // 2. Driver interface view
        await evalCode(`
            (() => {
                document.getElementById('app-officer').classList.add('hidden');
                document.getElementById('auth-screen').classList.remove('hidden');
                switchAuthTab('driver');
                document.getElementById('drv-id').value = 'DRIVER-RAJESH-01';
                document.getElementById('drv-pass').value = '123456';
                loginAsDriver();
            })()
        `);
        await sleep(2500);
        await saveScreenshot('ui-verify-driver-nav-hud.png');

        const drvCueText = await evalCode(`document.getElementById('drv-nav-cue')?.innerText;`);
        const drvStepText = await evalCode(`document.getElementById('drv-nav-step')?.innerText;`);
        const drvDistText = await evalCode(`document.getElementById('drv-nav-dist')?.innerText;`);
        const drvEtaText = await evalCode(`document.getElementById('drv-nav-eta-badge')?.innerText;`);

        console.log('Driver HUD status:', {
            cue: drvCueText,
            step: drvStepText,
            distance: drvDistText,
            eta: drvEtaText
        });

        ws.close();
    } finally {
        edge.kill();
    }
}

captureUIVerification().catch(err => {
    console.error('Error capturing UI:', err);
    process.exit(1);
});

