const http = require('http');
const WebSocket = require('ws');

async function check() {
    let targets = null;
    try {
        targets = await new Promise((resolve, reject) => {
            http.get('http://localhost:9222/json/list', r => {
                let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(JSON.parse(d)));
            }).on('error', reject);
        });
    } catch (e) {
        console.error('CDP on port 9222 is not currently running. Will check via HTTP API directly.');
        return;
    }

    const page = targets.find(t => t.type === 'page' && t.url.includes('localhost:3000')) || targets[0];
    if (!page) {
        console.log('No page target found');
        return;
    }

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.on('open', r));

    let msgId = 1;
    function send(method, params = {}) {
        return new Promise(res => {
            const id = msgId++;
            const handler = data => {
                const m = JSON.parse(data);
                if (m.id === id) {
                    ws.off('message', handler);
                    res(m.result);
                }
            };
            ws.on('message', handler);
            ws.send(JSON.stringify({ id, method, params }));
        });
    }

    const evalRes = await send('Runtime.evaluate', {
        expression: `(() => {
            const s = window.state || (typeof state !== 'undefined' ? state : null);
            if (!s) return JSON.stringify({ error: 'state not found' });
            const d1 = s.fleet.find(d => d.id === 1);
            
            // Check tacticalPolylines
            const tacPolys = {};
            if (s.tacticalPolylines) {
                for (const [k, poly] of Object.entries(s.tacticalPolylines)) {
                    const lls = poly.getLatLngs();
                    tacPolys[k] = {
                        len: Array.isArray(lls) ? lls.length : 0,
                        sample: Array.isArray(lls) ? lls.slice(0, 5).map(pt => [pt.lat, pt.lng]) : []
                    };
                }
            }

            // Check d1 legs
            const legsSample = (d1?.legs || []).map(l => ({
                from: l.from,
                to: l.to,
                pathLen: l.path ? l.path.length : 0,
                pathFirst3: l.path ? l.path.slice(0, 3) : [],
                pathLast3: l.path ? l.path.slice(-3) : []
            }));

            // Check d1 polyline
            const polyLen = d1?.polyline ? d1.polyline.length : 0;
            const polyFirst5 = d1?.polyline ? d1.polyline.slice(0, 5) : [];

            // Check splitRouteSegments
            const split = typeof splitRouteSegments === 'function' ? splitRouteSegments(d1) : null;

            return JSON.stringify({
                d1CurrentPos: d1?.currentPos,
                d1TargetPos: d1?.targetPos,
                d1RouteSeqLen: d1?.routeSequence ? d1.routeSequence.length : 0,
                legsSample,
                polyLen,
                polyFirst5,
                splitCounts: split ? {
                    completed: split.completedCoords.length,
                    active: split.activeCoords.length,
                    upcoming: split.upcomingCoords.length
                } : null,
                splitActiveSample: split ? split.activeCoords.slice(0, 5) : null,
                tacPolys
            });
        })()`,
        returnByValue: true
    });

    console.log(JSON.stringify(JSON.parse(evalRes.result.value), null, 2));
    ws.close();
}
check();

