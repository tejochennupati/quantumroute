const { handler } = require('./netlify/functions/api.js');

async function testNetlifyFunction() {
    console.log('Testing Netlify Serverless Function Handler Locally...\n');

    // Test 1: GET /api/fleet
    const eventFleet = {
        httpMethod: 'GET',
        path: '/api/fleet',
        headers: {},
        queryStringParameters: {}
    };
    const resFleet = await handler(eventFleet, {});
    console.log(`[Test 1: GET /api/fleet] Status: ${resFleet.statusCode}`);
    const bodyFleet = JSON.parse(resFleet.body);
    console.log(`  Fleet Count: ${bodyFleet.count}, Success: ${bodyFleet.success}`);
    if (resFleet.statusCode !== 200 || !bodyFleet.success) {
        throw new Error('GET /api/fleet failed in Netlify function');
    }

    // Test 1B: GET /api (System Health)
    const eventApi = {
        httpMethod: 'GET',
        path: '/api',
        headers: {},
        queryStringParameters: {}
    };
    const resApi = await handler(eventApi, {});
    console.log(`[Test 1B: GET /api] Status: ${resApi.statusCode}`);
    const bodyApi = JSON.parse(resApi.body);
    console.log(`  System: ${bodyApi.system}, Status: ${bodyApi.status}`);
    if (resApi.statusCode !== 200 || bodyApi.status !== 'ONLINE') {
        throw new Error('GET /api failed in Netlify function');
    }

    // Test 2: POST /api/auth/officer
    const eventLogin = {
        httpMethod: 'POST',
        path: '/api/auth/officer',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            officerId: 'GOV-TEJO-2026',
            token: '123456'
        })
    };
    const resLogin = await handler(eventLogin, {});
    console.log(`\n[Test 2: POST /api/auth/officer] Status: ${resLogin.statusCode}`);
    const bodyLogin = JSON.parse(resLogin.body);
    console.log(`  Officer: ${bodyLogin.name}, Success: ${bodyLogin.success}`);
    if (resLogin.statusCode !== 200 || !bodyLogin.success) {
        throw new Error('POST /api/auth/officer failed in Netlify function');
    }

    // Test 2B: POST /api/auth/driver
    const eventDriver = {
        httpMethod: 'POST',
        path: '/api/auth/driver',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            driverId: 'DRIVER-RAJESH-01',
            passcode: '123456'
        })
    };
    const resDriver = await handler(eventDriver, {});
    console.log(`\n[Test 2B: POST /api/auth/driver] Status: ${resDriver.statusCode}`);
    const bodyDriver = JSON.parse(resDriver.body);
    console.log(`  Driver: ${bodyDriver.driver?.name}, Success: ${bodyDriver.success}`);
    if (resDriver.statusCode !== 200 || !bodyDriver.success) {
        throw new Error('POST /api/auth/driver failed in Netlify function');
    }

    // Test 3: Path Normalization (/.netlify/functions/api/fleet)
    const eventNormalized = {
        httpMethod: 'GET',
        path: '/.netlify/functions/api/fleet',
        headers: {},
        queryStringParameters: {}
    };
    const resNormalized = await handler(eventNormalized, {});
    console.log(`\n[Test 3: Path Normalization] Status: ${resNormalized.statusCode}`);
    if (resNormalized.statusCode !== 200) {
        throw new Error('Normalized path resolution failed in Netlify function');
    }

    console.log('\n🎉 ALL NETLIFY SERVERLESS FUNCTION TESTS PASSED 100%!');
}

testNetlifyFunction().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
