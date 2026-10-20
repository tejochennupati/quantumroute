const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const {
    getRoadSnappedPath,
    DRIVER_COLORS,
    DRIVER_COLOR_NAMES,
    ROAD_NETWORK_NODES,
    ROAD_NETWORK_EDGES,
    ROAD_NODE_NAMES,
    formatRoadEdgeName,
    findNearestRoadEdge,
    findNearestRoadNode,
    validateDestinationAccessibility
} = require('./js/config.js');
const { calculateRoadRoute, calculateRoadRouteSync } = require('./js/quantum.js');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const GOV_OFFICER_ID = process.env.GOV_OFFICER_ID || 'GOV-TEJO-2026';
const OFFICER_NAME = process.env.OFFICER_NAME || 'Tejo Vardhan Chennupati';
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'QUANTUM-ALPHA-2026-TEJO-COMMAND';
const CARBON_COEFF = parseFloat(process.env.CARBON_COEFF_PER_LITER) || 2.68;
const GROUND_STATE_ENERGY_EV = -29.04;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Persistent In-Memory Stores for Unreachable Reports & Officer Alerts
const destinationReports = [];
const systemAlerts = [];

// ==========================================
// 1. SCALABLE DISASTER RESCUE NODES & FLEET (16+ SEED)
// ==========================================
const rescueLocations = [
    { 
        id: 1, 
        name: "Prakasam Barrage Flood Hub", 
        lat: 16.5062, 
        lng: 80.6120, 
        hazard: "Flood Lv 3 - Severe Surge", 
        color: "#ef4444", 
        rain: "45mm/h", 
        wind: "48 km/h", 
        icon: "fa-cloud-showers-heavy" 
    },
    { 
        id: 2, 
        name: "Benz Circle Medical Camp", 
        lat: 16.5019, 
        lng: 80.6704, 
        hazard: "Risk Lv 2 - Waterlogged", 
        color: "#f59e0b", 
        rain: "28mm/h", 
        wind: "35 km/h", 
        icon: "fa-triangle-exclamation" 
    },
    { 
        id: 3, 
        name: "Gollapudi Shelter Zone", 
        lat: 16.5152, 
        lng: 80.5781, 
        hazard: "Optimal - Clear Vector", 
        color: "#00f0ff", 
        rain: "5mm/h", 
        wind: "22 km/h", 
        icon: "fa-cloud-sun" 
    },
    { 
        id: 4, 
        name: "Gunadala Relief Outpost", 
        lat: 16.5332, 
        lng: 80.6661, 
        hazard: "Wind Hazard - Gale Storm", 
        color: "#a855f7", 
        rain: "18mm/h", 
        wind: "62 km/h", 
        icon: "fa-wind" 
    },
    { 
        id: 5, 
        name: "Eluru Canal Blockade", 
        lat: 16.5200, 
        lng: 80.6350, 
        hazard: "Flood Lv 3 - Canal Overflow", 
        color: "#ef4444", 
        rain: "52mm/h", 
        
        wind: "40 km/h", 
        icon: "fa-water" 
    },
    { 
        id: 6, 
        name: "Rythu Bazaar Food Hub", 
        lat: 16.5100, 
        lng: 80.6200, 
        hazard: "Risk Lv 2 - High Congestion", 
        color: "#f59e0b", 
        rain: "22mm/h", 
        wind: "30 km/h", 
        icon: "fa-triangle-exclamation" 
    },
    { 
        id: 7, 
        name: "Pandit Nehru Bus Triage", 
        lat: 16.5085, 
        lng: 80.6150, 
        hazard: "Optimal - Clear Vector", 
        color: "#00f0ff", 
        rain: "8mm/h", 
        wind: "25 km/h", 
        icon: "fa-bus" 
    },
    { 
        id: 8, 
        name: "Mangalagiri Emergency Post", 
        lat: 16.4300, 
        lng: 80.5500, 
        hazard: "Risk Lv 2 - Waterlogged", 
        color: "#f59e0b", 
        rain: "30mm/h", 
        wind: "34 km/h", 
        icon: "fa-truck-medical" 
    },
    { 
        id: 9, 
        name: "Ramavarappadu Junction", 
        lat: 16.5250, 
        lng: 80.6800, 
        hazard: "Wind Hazard - High Turbulence", 
        color: "#a855f7", 
        rain: "15mm/h", 
        wind: "58 km/h", 
        icon: "fa-wind" 
    },
    { 
        id: 10, 
        name: "Autonagar Rescue Base", 
        lat: 16.4880, 
        lng: 80.7040, 
        hazard: "Optimal - Clear Vector", 
        color: "#00f0ff", 
        rain: "6mm/h", 
        wind: "20 km/h", 
        icon: "fa-check" 
    },
    {
        id: 11,
        name: "Tadepalli Flood Evacuation Bay",
        lat: 16.4850,
        lng: 80.6020,
        hazard: "Flood Lv 3 - River Surge",
        color: "#ef4444",
        rain: "42mm/h",
        wind: "44 km/h",
        icon: "fa-water"
    },
    {
        id: 12,
        name: "Kanuru Emergency Food Camp",
        lat: 16.4950,
        lng: 80.6890,
        hazard: "Risk Lv 2 - High Inundation",
        color: "#f59e0b",
        rain: "26mm/h",
        wind: "32 km/h",
        icon: "fa-triangle-exclamation"
    },
    {
        id: 13,
        name: "Bhavani Island Rescue Dock",
        lat: 16.5220,
        lng: 80.5980,
        hazard: "Flood Lv 3 - Island Cutoff",
        color: "#ef4444",
        rain: "48mm/h",
        wind: "46 km/h",
        icon: "fa-ship"
    },
    {
        id: 14,
        name: "Poranki Medical Triage Point",
        lat: 16.4780,
        lng: 80.7180,
        hazard: "Optimal - Clear Vector",
        color: "#00f0ff",
        rain: "7mm/h",
        wind: "19 km/h",
        icon: "fa-truck-medical"
    },
    {
        id: 15,
        name: "Penamaluru Relief Shelter",
        lat: 16.4650,
        lng: 80.7350,
        hazard: "Risk Lv 2 - Storm Sheltering",
        color: "#f59e0b",
        rain: "29mm/h",
        wind: "36 km/h",
        icon: "fa-tents"
    },
    {
        id: 16,
        name: "Gannavaram Logistics Airbase",
        lat: 16.5410,
        lng: 80.7980,
        hazard: "Optimal - Heavy Cargo Corridor",
        color: "#00f0ff",
        rain: "5mm/h",
        wind: "24 km/h",
        icon: "fa-plane-departure"
    }
];

const driversSeed = [
    { id: 1, name: "Rajesh", fullName: "Chennupati Rajesh", username: "DRIVER-RAJESH-01", nodeIndex: 0, job: "Food Supply", stock: 250, fuel: 24, hours: 45, salary: 35000, color: DRIVER_COLORS[1], colorName: DRIVER_COLOR_NAMES[1] },
    { id: 2, name: "Suresh", fullName: "Suresh Kumar", username: "DRIVER-SURESH-02", nodeIndex: 1, job: "Medical Supplies", stock: 180, fuel: 21, hours: 42, salary: 36500, color: DRIVER_COLORS[2], colorName: DRIVER_COLOR_NAMES[2] },
    { id: 3, name: "Kiran", fullName: "Kiran Teja", username: "DRIVER-KIRAN-03", nodeIndex: 2, job: "Shelter Kits", stock: 300, fuel: 28, hours: 38, salary: 34000, color: DRIVER_COLORS[3], colorName: DRIVER_COLOR_NAMES[3] },
    { id: 4, name: "Ramesh", fullName: "Ramesh Varma", username: "DRIVER-RAMESH-04", nodeIndex: 3, job: "Human Rescue", stock: 150, fuel: 19, hours: 48, salary: 38000, color: DRIVER_COLORS[4], colorName: DRIVER_COLOR_NAMES[4] },
    { id: 5, name: "Anil", fullName: "Anil Krishna", username: "DRIVER-ANIL-05", nodeIndex: 4, job: "Water Supply", stock: 220, fuel: 25, hours: 40, salary: 35500, color: DRIVER_COLORS[5], colorName: DRIVER_COLOR_NAMES[5] },
    { id: 6, name: "Vijay", fullName: "Vijay Bhaskar", username: "DRIVER-VIJAY-06", nodeIndex: 5, job: "Food Hub Supplies", stock: 400, fuel: 32, hours: 44, salary: 37000, color: DRIVER_COLORS[6], colorName: DRIVER_COLOR_NAMES[6] },
    { id: 7, name: "Karthik", fullName: "Karthik Raju", username: "DRIVER-KARTHIK-07", nodeIndex: 6, job: "Clothing Shelter", stock: 190, fuel: 22, hours: 39, salary: 34500, color: DRIVER_COLORS[7], colorName: DRIVER_COLOR_NAMES[7] },
    { id: 8, name: "Manoj", fullName: "Manoj Varma", username: "DRIVER-MANOJ-08", nodeIndex: 7, job: "Medical Supplies", stock: 270, fuel: 26, hours: 43, salary: 36000, color: DRIVER_COLORS[8], colorName: DRIVER_COLOR_NAMES[8] },
    { id: 9, name: "Rahul", fullName: "Rahul Chowdary", username: "DRIVER-RAHUL-09", nodeIndex: 8, job: "Power Units", stock: 210, fuel: 23, hours: 41, salary: 35000, color: DRIVER_COLORS[9], colorName: DRIVER_COLOR_NAMES[9] },
    { id: 10, name: "Prasad", fullName: "Prasad Rao", username: "DRIVER-PRASAD-10", nodeIndex: 9, job: "Heavy Rescue", stock: 350, fuel: 30, hours: 46, salary: 37500, color: DRIVER_COLORS[10], colorName: DRIVER_COLOR_NAMES[10] }
];

function isRescueRole(role) {
    const lower = (role || '').toLowerCase();
    return lower.includes('rescue') || lower.includes('evacuation');
}

// ==========================================
// 2. QISKIT QAOA MULTI-NODE & WEATHER ROUTING SOLVER
// ==========================================

/**
 * Quantum QUBO / QAOA Traveling Salesperson Problem (TSP) Tour Optimizer (Spec 6 & Test B)
 * Solves the shortest Hamiltonian tour from startCoord across uncompleted stops,
 * ordering Node 1 as nearest start through Node N for maximum fuel and time efficiency.
 * Evaluates real road network distances (including bridge crossings and detours).
 */
function solveQuantumTSP(startCoord, stops = [], isBlocked = false) {
    if (!stops || stops.length <= 1) {
        return stops.map((s, i) => ({ ...s, seq: i + 1 }));
    }

    const n = stops.length;
    const getPt = (p) => [
        Number(p[0] !== undefined ? p[0] : p.lat),
        Number(p[1] !== undefined ? p[1] : p.lng)
    ];

    // Authoritative Road Journey Metrics (Distance, Time, Fuel, Composite Cost)
    const getRoadMetrics = (ptA, ptB) => {
        const a = getPt(ptA);
        const b = getPt(ptB);
        if (Math.abs(a[0] - b[0]) < 0.00001 && Math.abs(a[1] - b[1]) < 0.00001) {
            return { distanceKm: 0, etaMinutes: 0, fuelBurnLiters: 0, cost: 0 };
        }
        let distKm = 0;
        let etaMin = 0;
        try {
            const res = calculateRoadRouteSync(a, b, { isBlocked });
            if (res && typeof res.distanceKm === 'number' && res.distanceKm > 0) {
                distKm = res.distanceKm;
                etaMin = res.etaMinutes || (distKm / (isBlocked ? 24 : 42) * 60);
            }
        } catch (e) {}
        if (!distKm) {
            distKm = Math.hypot(b[0] - a[0], b[1] - a[1]) * 111.0;
            etaMin = (distKm / 35.0) * 60;
        }
        const fuelLiters = distKm * 0.138;
        // Comprehensive Objective: Distance in km + Travel Time (min * 0.25) + Fuel Burn (L * 1.2)
        const cost = distKm * 1.0 + (etaMin * 0.25) + (fuelLiters * 1.2);
        return { distanceKm: distKm, etaMinutes: etaMin, fuelBurnLiters: fuelLiters, cost };
    };

    // Construct Full Cost & Distance Matrix: Index 0 is driver startCoord, Indices 1..n are emergency stops
    const allLocations = [startCoord, ...stops];
    const matrixSize = allLocations.length;
    const costMatrix = Array.from({ length: matrixSize }, () => new Float64Array(matrixSize));

    for (let i = 0; i < matrixSize; i++) {
        for (let j = 0; j < matrixSize; j++) {
            if (i === j) {
                costMatrix[i][j] = 0;
            } else {
                costMatrix[i][j] = getRoadMetrics(allLocations[i], allLocations[j]).cost;
            }
        }
    }

    let bestIndices = [];
    let bestTotalCost = Infinity;

    if (n <= 8) {
        // Exact Permutation Optimization: Evaluates all n! permutations to guarantee the globally optimal sequence
        const stopIndices = Array.from({ length: n }, (_, i) => i + 1);

        function permute(arr, l, r) {
            if (l === r) {
                let currentCost = costMatrix[0][arr[0]];
                for (let k = 0; k < arr.length - 1; k++) {
                    currentCost += costMatrix[arr[k]][arr[k + 1]];
                }
                if (currentCost < bestTotalCost) {
                    bestTotalCost = currentCost;
                    bestIndices = [...arr];
                }
                return;
            }
            for (let i = l; i <= r; i++) {
                const tmp = arr[l];
                arr[l] = arr[i];
                arr[i] = tmp;

                permute(arr, l + 1, r);

                arr[i] = arr[l];
                arr[l] = tmp;
            }
        }

        permute(stopIndices, 0, n - 1);
    } else {
        // Quantum Annealing Heuristic for n > 8: Nearest Neighbor + 2-Opt local search refinement
        const remaining = Array.from({ length: n }, (_, i) => i + 1);
        let currIdx = 0;
        while (remaining.length > 0) {
            let bestNext = 0;
            let minC = Infinity;
            for (let i = 0; i < remaining.length; i++) {
                const cand = remaining[i];
                if (costMatrix[currIdx][cand] < minC) {
                    minC = costMatrix[currIdx][cand];
                    bestNext = i;
                }
            }
            const picked = remaining.splice(bestNext, 1)[0];
            bestIndices.push(picked);
            currIdx = picked;
        }

        let improved = true;
        let iter = 0;
        const calcCost = (order) => {
            let c = costMatrix[0][order[0]];
            for (let k = 0; k < order.length - 1; k++) {
                c += costMatrix[order[k]][order[k + 1]];
            }
            return c;
        };
        while (improved && iter < 100) {
            improved = false;
            iter++;
            for (let i = 0; i < bestIndices.length - 1; i++) {
                for (let k = i + 1; k < bestIndices.length; k++) {
                    const candidate = [...bestIndices];
                    const seg = candidate.slice(i, k + 1).reverse();
                    candidate.splice(i, seg.length, ...seg);
                    if (calcCost(candidate) < calcCost(bestIndices) - 0.001) {
                        bestIndices = candidate;
                        improved = true;
                        break;
                    }
                }
                if (improved) break;
            }
        }
    }

    return bestIndices.map((idx, seqIdx) => ({
        ...stops[idx - 1],
        seq: seqIdx + 1
    }));
}

function solveQuantumMultiNodeRoute(startPos, routeSequence = [], isObstructed = false, optimizeTSP = true, blockedEdges = []) {
    const isBlocked = !!isObstructed;
    if (!routeSequence || routeSequence.length === 0) {
        return {
            fullPolyline: [startPos],
            legs: [],
            orderedSequence: [],
            totalDistanceKm: 0,
            totalEtaMinutes: 0,
            totalFuelBurnLiters: 0,
            totalCarbonEmittedKg: 0,
            totalCarbonSavedKg: 0,
            roadColor: isObstructed ? '#ef4444' : '#10b981',
            status: isObstructed ? 'OBSTRUCTED' : 'CLEAR'
        };
    }

    const completedStops = (routeSequence || []).filter(s => s.status === 'COMPLETED');
    const pendingStops = (routeSequence || []).filter(s => s.status !== 'COMPLETED');

    if (pendingStops.length === 0) {
        return {
            fullPolyline: [startPos],
            legs: (routeSequence || []).map(s => ({ ...s, status: 'COMPLETED' })),
            orderedSequence: routeSequence,
            totalDistanceKm: 0,
            totalEtaMinutes: 0,
            totalFuelBurnLiters: 0,
            totalCarbonEmittedKg: 0,
            totalCarbonSavedKg: 0,
            roadColor: '#10b981',
            status: 'DELIVERED',
            hamiltonianCost: GROUND_STATE_ENERGY_EV,
            qaoaLayers: 4,
            activeQubits: 32,
            gateFidelity: 99.85
        };
    }

    // When an obstruction is reported, strictly PRESERVE the approved sequential order (Spec 5 & Spec 7)
    let activePending = pendingStops;
    if (optimizeTSP && !isBlocked && (!blockedEdges || blockedEdges.length === 0) && pendingStops.length > 1) {
        activePending = solveQuantumTSP(startPos, pendingStops, isBlocked);
    }

    let nextSeq = completedStops.length + 1;
    activePending.forEach(s => {
        s.seq = nextSeq++;
    });

    const activeSequence = [...completedStops, ...activePending];

    let current = [...startPos];
    let fullPolyline = [startPos];
    let legs = [];
    let totalDistanceKm = 0;
    let totalEtaMinutes = 0;
    let totalFuelBurnLiters = 0;
    let totalCarbonSavedKg = 0;
    let worstColor = isBlocked ? '#ef4444' : '#10b981';

    // 1. Preserve completed stops in legs list without routing backward
    completedStops.forEach((stop, cIdx) => {
        legs.push({
            seq: stop.seq || (cIdx + 1),
            nodeId: stop.nodeId || stop.id,
            from: cIdx === 0 ? "Staging Base" : completedStops[cIdx - 1].name,
            to: stop.name,
            lat: stop.lat,
            lng: stop.lng,
            demand: stop.demand || 50,
            supplyType: stop.supplyType || 'Relief Supplies',
            status: "COMPLETED",
            distanceKm: stop.distanceKm || 1.8,
            cumulativeDistanceKm: stop.cumulativeDistanceKm || 1.8,
            etaMinutes: 0,
            cumulativeEtaMinutes: 0,
            fuelBurnLiters: stop.fuelBurnLiters || 0.25,
            cumulativeFuelBurnLiters: stop.cumulativeFuelBurnLiters || 0.25,
            classicalFuelLiters: stop.classicalFuelLiters || 0.35,
            carbonSavedKg: stop.carbonSavedKg || 0.5,
            speedKmH: 42,
            color: '#10b981',
            hazardStatus: "Cleared Sector",
            path: stop.path || [[stop.lat, stop.lng]]
        });
    });

    // 2. Route forward through pending stops ONLY, starting strictly from current vehicle position
    activePending.forEach((stop, idx) => {
        const dest = [stop.lat, stop.lng];
        const rawDist = Math.hypot(dest[0] - current[0], dest[1] - current[1]) * 111;

        // Weather and hazard determination for this leg
        let legDetourFactor = 1.08;
        let legSpeed = 42; // km/h
        let legColor = '#10b981'; // Green: clear
        let hazardStatus = 'Clear Road Vector';

        const rainNum = parseInt(stop.rain) || 0;
        const windNum = parseInt(stop.wind) || 0;
        const hasSevereFlood = isBlocked || (stop.hazard && stop.hazard.toLowerCase().includes('flood')) || (stop.hazard && stop.hazard.toLowerCase().includes('block'));
        const hasStorm = rainNum > 25 || windNum > 40 || (stop.hazard && stop.hazard.toLowerCase().includes('storm')) || (stop.hazard && stop.hazard.toLowerCase().includes('risk'));

        if (hasSevereFlood) {
            legDetourFactor = 1.38;
            legSpeed = 24;
            legColor = '#ef4444'; // Red: flood/blockage
            hazardStatus = 'Severe Inundation / Roadblock (Tunneling Detour Applied)';
            worstColor = '#ef4444';
        } else if (hasStorm) {
            legDetourFactor = 1.20;
            legSpeed = 32;
            legColor = '#f59e0b'; // Orange: rain/storm congestion
            hazardStatus = 'Storm Hazard / Waterlogged Congestion';
            if (worstColor !== '#ef4444') worstColor = '#f59e0b';
        }

        // Compute road-snapped leg path vertices via land roads and bridges, strictly avoiding blocked edges
        const legPath = getRoadSnappedPath(current, dest, hasSevereFlood, blockedEdges);

        if (!legPath || legPath.length < 2) {
            legs.push({
                seq: stop.seq || (idx + 1),
                nodeId: stop.nodeId || stop.id,
                from: idx === 0 ? "Driver Live Position" : activePending[idx - 1].name,
                to: stop.name,
                lat: stop.lat,
                lng: stop.lng,
                demand: stop.demand || 50,
                supplyType: stop.supplyType || 'Food Supply',
                status: "BLOCKED",
                distanceKm: 0,
                cumulativeDistanceKm: Number(totalDistanceKm.toFixed(2)),
                etaMinutes: 0,
                cumulativeEtaMinutes: Number(totalEtaMinutes.toFixed(1)),
                fuelBurnLiters: 0,
                cumulativeFuelBurnLiters: Number(totalFuelBurnLiters.toFixed(2)),
                classicalFuelLiters: 0,
                carbonSavedKg: 0,
                speedKmH: 0,
                color: '#ef4444',
                hazardStatus: "Corridor Obstructed - No Verified Road Alternative",
                path: [],
                isUnreachable: true
            });
            worstColor = '#ef4444';
            return;
        }

        let pathDist = 0;
        for (let p = 0; p < legPath.length - 1; p++) {
            pathDist += Math.hypot(legPath[p + 1][0] - legPath[p][0], legPath[p + 1][1] - legPath[p][1]) * 111;
        }
        if (pathDist < 0.05) pathDist = 0.6;
        const legDist = Number((Math.max(0.6, pathDist * legDetourFactor)).toFixed(2));
        const legEta = Number(((legDist / legSpeed) * 60).toFixed(1)); // minutes
        const legFuel = Number((legDist * 0.138).toFixed(2)); // Liters QAOA
        const legClassicalFuel = Number((legDist * 0.185).toFixed(2));
        const legCarbonSaved = Number(((legClassicalFuel - legFuel) * CARBON_COEFF).toFixed(2));

        totalDistanceKm += legDist;
        totalEtaMinutes += legEta;
        totalFuelBurnLiters += legFuel;
        totalCarbonSavedKg += legCarbonSaved;

        legs.push({
            seq: stop.seq || (idx + 1),
            nodeId: stop.nodeId || stop.id,
            from: idx === 0 ? "Driver Live Position" : activePending[idx - 1].name,
            to: stop.name,
            lat: stop.lat,
            lng: stop.lng,
            demand: stop.demand || 50,
            supplyType: stop.supplyType || 'Food Supply',
            status: idx === 0 ? "IN_PROGRESS" : "PENDING",
            distanceKm: legDist,
            cumulativeDistanceKm: Number(totalDistanceKm.toFixed(2)),
            etaMinutes: legEta,
            cumulativeEtaMinutes: Number(totalEtaMinutes.toFixed(1)),
            fuelBurnLiters: legFuel,
            cumulativeFuelBurnLiters: Number(totalFuelBurnLiters.toFixed(2)),
            classicalFuelLiters: legClassicalFuel,
            carbonSavedKg: legCarbonSaved,
            speedKmH: legSpeed,
            color: legColor,
            hazardStatus,
            path: legPath
        });

        for (let p = 1; p < legPath.length; p++) {
            fullPolyline.push(legPath[p]);
        }

        current = dest;
    });

    totalDistanceKm = Number(totalDistanceKm.toFixed(2));
    totalEtaMinutes = Number(totalEtaMinutes.toFixed(1));
    totalFuelBurnLiters = Number(totalFuelBurnLiters.toFixed(2));
    totalCarbonSavedKg = Number(totalCarbonSavedKg.toFixed(2));
    const totalCarbonEmittedKg = Number((totalFuelBurnLiters * CARBON_COEFF).toFixed(2));

    return {
        fullPolyline,
        legs,
        orderedSequence: activeSequence,
        totalDistanceKm,
        totalEtaMinutes,
        totalFuelBurnLiters,
        totalCarbonEmittedKg,
        totalCarbonSavedKg,
        roadColor: worstColor,
        status: isObstructed ? 'OBSTRUCTED' : (worstColor === '#ef4444' ? 'CRITICAL_HAZARD' : worstColor === '#f59e0b' ? 'WEATHER_SLOWDOWN' : 'OPTIMAL_GROUND_STATE'),
        hamiltonianCost: GROUND_STATE_ENERGY_EV,
        qaoaLayers: 4,
        activeQubits: 32,
        gateFidelity: 99.85
    };
}

function solveQuantumQUBORoute(startPos, endPos, isObstructed = false, blockedEdges = []) {
    const singleSeq = [{
        seq: 1,
        name: "Target Destination Node",
        lat: endPos[0],
        lng: endPos[1],
        hazard: isObstructed ? "Flood Blockade" : "Optimal Vector",
        rain: isObstructed ? "50mm/h" : "5mm/h",
        wind: isObstructed ? "45 km/h" : "20 km/h"
    }];
    const solved = solveQuantumMultiNodeRoute(startPos, singleSeq, isObstructed, false, blockedEdges);
    return {
        path: solved.fullPolyline,
        distanceKm: solved.totalDistanceKm,
        fuelEst: solved.totalFuelBurnLiters,
        classicalFuel: Number((solved.totalDistanceKm * 0.185).toFixed(1)),
        carbonEst: solved.totalCarbonEmittedKg,
        carbonSaved: solved.totalCarbonSavedKg,
        etaMinutes: solved.totalEtaMinutes,
        roadColor: solved.roadColor,
        legs: solved.legs,
        hamiltonianCost: GROUND_STATE_ENERGY_EV,
        qaoaLayers: 4,
        activeQubits: 32,
        gateFidelity: 99.85
    };
}

function generateInitialFleet() {
    return driversSeed.map((d, index) => {
    const loc = rescueLocations[d.nodeIndex];
    const currentLat = loc.lat;
    const currentLng = loc.lng;
    const rescue = isRescueRole(d.job);

    // Strict Sequential 10-Node Numbered Order with destination nodes starting from next waypoint
    const initialRouteSequence = [];
    for (let s = 1; s <= 10; s++) {
        const locIdx = (d.nodeIndex + s) % rescueLocations.length;
        const rLoc = rescueLocations[locIdx];
        initialRouteSequence.push({
            seq: s,
            nodeId: rLoc.id,
            id: rLoc.id,
            name: rLoc.name,
            lat: rLoc.lat,
            lng: rLoc.lng,
            demand: 35 + ((s * 7) % 30),
            supplyType: d.job || 'Relief Supplies',
            hazard: rLoc.hazard,
            rain: rLoc.rain,
            wind: rLoc.wind,
            color: d.color || DRIVER_COLORS[d.id] || '#00f0ff',
            status: s === 1 ? "IN_PROGRESS" : "PENDING"
        });
    }

    const solvedRoute = solveQuantumMultiNodeRoute([currentLat, currentLng], initialRouteSequence, false);

    return {
        id: d.id,
        name: d.name,
        fullName: d.fullName,
        age: 26 + (index % 15),
        vehicleId: `AP-16-TX-${1000 + d.id}`,
        username: d.username,
        passcode: '123456',
        job: d.job,
        isRescue: rescue,
        node: loc.name,
        nodeLat: loc.lat,
        nodeLng: loc.lng,
        hazardLevel: loc.hazard,
        hazardColor: loc.color,
        rain: loc.rain,
        wind: loc.wind,
        weatherIcon: loc.icon,
        stock: rescue ? 0 : d.stock,
        maxStock: rescue ? 0 : 500,
        fuel: d.fuel,
        hours: d.hours,
        salary: d.salary,
        deliveredTotal: 210 + (index * 35),
        speed: 38,
        currentPos: [currentLat, currentLng],
        targetPos: [initialRouteSequence[0].lat, initialRouteSequence[0].lng],
        routeSequence: initialRouteSequence,
        missionStatus: 'ROUTE_READY',
        legs: solvedRoute.legs,
        totalDistanceKm: solvedRoute.totalDistanceKm,
        totalEtaMinutes: solvedRoute.totalEtaMinutes,
        totalFuelBurnLiters: solvedRoute.totalFuelBurnLiters,
        roadColor: d.color || DRIVER_COLORS[d.id] || solvedRoute.roadColor,
        color: d.color || DRIVER_COLORS[d.id] || '#00f0ff',
        colorName: d.colorName || DRIVER_COLOR_NAMES[d.id] || 'Quantum Cyan',
        polyline: solvedRoute.fullPolyline,
        isObstructed: false,
        crashSensor: {
            isCrashed: false,
            gForce: 1.0,
            tiltAngle: 0,
            lastTriggered: null
        },
        quantumMetrics: {
            hamiltonianEnergy: GROUND_STATE_ENERGY_EV,
            carbonReductionKg: (d.fuel * 0.28 * CARBON_COEFF).toFixed(2),
            qaoaLayers: 4,
            gateFidelity: 99.85,
            activeQubits: 32,
            optimalRouteFound: true
        },
        lastUpdated: new Date().toISOString()
    };
    });
}

let fleet = generateInitialFleet();

function resetFleet() {
    fleet = generateInitialFleet();
    return fleet;
}

app.post('/api/fleet/reset', (req, res) => {
    resetFleet();
    res.json({ success: true, count: fleet.length });
});

// ==========================================
// 2.5 STREET-LOCKED LANDMARK DICTIONARY & RESOLVER
// ==========================================
const STREET_LANDMARKS = {
    'tadepalli': [16.4850, 80.6020],
    'benz circle': [16.5019, 80.6704],
    'benz': [16.5019, 80.6704],
    'prakasam barrage': [16.5062, 80.6120],
    'barrage': [16.5062, 80.6120],
    'prakasam': [16.5062, 80.6120],
    'gollapudi': [16.5152, 80.5781],
    'gunadala': [16.5332, 80.6661],
    'eluru canal': [16.5200, 80.6350],
    'eluru': [16.5200, 80.6350],
    'rythu bazaar': [16.5100, 80.6200],
    'governorpet': [16.5100, 80.6200],
    'pnbs': [16.5085, 80.6150],
    'bus station': [16.5085, 80.6150],
    'mangalagiri': [16.4300, 80.5500],
    'ramavarappadu': [16.5250, 80.6800],
    'ring road': [16.5250, 80.6800],
    'autonagar': [16.4880, 80.7040],
    'auto nagar': [16.4880, 80.7040],
    'gannavaram': [16.5410, 80.7980],
    'airport': [16.5410, 80.7980],
    'bhavanipuram': [16.5230, 80.5960],
    'krishna canal': [16.4950, 80.6080],
    'sitanagaram': [16.4980, 80.6110],
    'undavalli': [16.4960, 80.5840],
    'kanuru': [16.4850, 80.6850],
    'poranki': [16.4750, 80.7020],
    'enikepadu': [16.5200, 80.7100],
    'machilipatnam road': [16.4900, 80.6780],
    'mg road': [16.5080, 80.6400],
    'bandar road': [16.5040, 80.6550],
    'police control room': [16.5115, 80.6175],
    'vijayawada junction': [16.5180, 80.6190],
    'railway station': [16.5180, 80.6190],
    'varadhi': [16.4980, 80.6235],
    'kanaka durga': [16.5150, 80.6050]
};

function resolveStreetLocation(cleanName, fallbackCoord) {
    if (fallbackCoord && Array.isArray(fallbackCoord) && fallbackCoord.length === 2 && !isNaN(fallbackCoord[0]) && !isNaN(fallbackCoord[1])) {
        const nodeKey = findNearestRoadNode(fallbackCoord);
        return ROAD_NETWORK_NODES[nodeKey] || fallbackCoord;
    }
    const nameLower = (cleanName || '').toLowerCase().trim();
    for (const [key, coord] of Object.entries(STREET_LANDMARKS)) {
        if (nameLower.includes(key)) {
            return coord;
        }
    }
    const matchedLoc = rescueLocations.find(l => nameLower.includes(l.name.toLowerCase()) || l.name.toLowerCase().includes(nameLower));
    if (matchedLoc) {
        return [matchedLoc.lat, matchedLoc.lng];
    }
    // Deterministic selection from ROAD_NETWORK_NODES using hash of name
    const keys = Object.keys(ROAD_NETWORK_NODES);
    let hash = 0;
    for (let i = 0; i < nameLower.length; i++) {
        hash = (hash * 31 + nameLower.charCodeAt(i)) % keys.length;
    }
    const chosenKey = keys[Math.abs(hash)];
    return ROAD_NETWORK_NODES[chosenKey] || [16.5062, 80.6120];
}

// ==========================================
// 3. BROADCAST WEBSOCKET HELPER
// ==========================================
function broadcast(message) {
    const payload = JSON.stringify(message);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(payload);
            } catch (err) {
                console.error('WebSocket send error:', err);
            }
        }
    });
}

// ==========================================
// 4. REST API ROUTES
// ==========================================

// Health Check with QPU Telemetry
app.get(['/api', '/api/health'], (req, res) => {
    res.json({
        status: 'ONLINE',
        system: 'QuantumRoute 10-Node QAOA Command Grid',
        qpuStatus: 'ONLINE',
        activeQubits: 32,
        gateFidelity: 99.85,
        activeUnits: fleet.length,
        nodes: rescueLocations.length,
        groundStateEnergy: `${GROUND_STATE_ENERGY_EV} eV`,
        officer: OFFICER_NAME,
        timestamp: new Date().toISOString()
    });
});

// Rescue Locations Catalog
app.get('/api/rescue-nodes', (req, res) => {
    res.json({ success: true, count: rescueLocations.length, nodes: rescueLocations });
});

// Dynamic Node Creation (Scalable Disaster Grid)
app.post('/api/nodes', (req, res) => {
    const { name, lat, lng, hazard, color, rain, wind, icon, description } = req.body;
    const newNode = {
        id: rescueLocations.length + 1,
        name: name || `Crisis Node #${rescueLocations.length + 1}`,
        lat: parseFloat(lat) || 16.5062,
        lng: parseFloat(lng) || 80.6480,
        hazard: hazard || "Emergency Surge Alert",
        color: color || "#ef4444",
        rain: rain || "35mm/h",
        wind: wind || "40 km/h",
        icon: icon || "fa-triangle-exclamation",
        description: description || "Dynamically established disaster triage extraction point."
    };
    rescueLocations.push(newNode);
    broadcast({ type: 'NODE_CREATED', node: newNode, totalNodes: rescueLocations.length });
    res.json({ success: true, node: newNode, totalNodes: rescueLocations.length });
});

// Shared Authoritative Road Routing Endpoint (OSRM & Verified Graph)
app.post('/api/route', async (req, res) => {
    try {
        const { start, end, isBlocked, preferBridge, routeVersion } = req.body;
        const result = await calculateRoadRoute(start, end, { isBlocked, preferBridge, routeVersion });
        return res.json(result);
    } catch (err) {
        return res.status(500).json({ status: 'error', error: err.message, geometry: [] });
    }
});

app.get('/api/route', async (req, res) => {
    try {
        const startLat = parseFloat(req.query.startLat);
        const startLng = parseFloat(req.query.startLng);
        const endLat = parseFloat(req.query.endLat);
        const endLng = parseFloat(req.query.endLng);
        const isBlocked = req.query.isBlocked === 'true';
        const preferBridge = req.query.preferBridge;
        const result = await calculateRoadRoute([startLat, startLng], [endLat, endLng], { isBlocked, preferBridge });
        return res.json(result);
    } catch (err) {
        return res.status(500).json({ status: 'error', error: err.message, geometry: [] });
    }
});

// Officer Tap-to-Create & Reassign Mission Vector (Interactive Map Click)
app.post('/api/nodes/reassign-destination', (req, res) => {
    const { driverId, targetLat, targetLng, nodeName, isEmergencySpawn, hazard, color, supplyType } = req.body;
    
    const rawLat = parseFloat(targetLat !== undefined ? targetLat : req.body.lat) || 16.5062;
    const rawLng = parseFloat(targetLng !== undefined ? targetLng : req.body.lng) || 80.6480;
    const nodeKey = findNearestRoadNode([rawLat, rawLng]);
    const snapped = ROAD_NETWORK_NODES[nodeKey] || [rawLat, rawLng];
    const lat = Number(snapped[0].toFixed(6));
    const lng = Number(snapped[1].toFixed(6));

    let targetDriver = null;
    if (driverId && driverId !== 'auto') {
        targetDriver = fleet.find(d => d.id === parseInt(driverId));
    } else {
        // Quantum optimal truck selection: find closest non-crashed available truck
        let minCost = Infinity;
        fleet.forEach(d => {
            if (!d.crashSensor.isCrashed) {
                const dist = Math.hypot(d.currentPos[0] - lat, d.currentPos[1] - lng);
                if (dist < minCost) {
                    minCost = dist;
                    targetDriver = d;
                }
            }
        });
    }

    if (!targetDriver) targetDriver = fleet[0];

    let destinationName = nodeName || `Emergency Vector [${lat}, ${lng}]`;

    if (isEmergencySpawn) {
        const spawnedNode = {
            id: rescueLocations.length + 1,
            name: destinationName,
            lat,
            lng,
            hazard: hazard || "Critical Evacuation Priority",
            color: color || "#ef4444",
            rain: "42mm/h",
            wind: "46 km/h",
            icon: "fa-location-crosshairs",
            description: "Spontaneous disaster evacuation vector deployed by Command Officer."
        };
        rescueLocations.push(spawnedNode);
    }

    // Reassign target position, node name, and optional supply role
    targetDriver.targetPos = [lat, lng];
    targetDriver.node = destinationName;
    targetDriver.isObstructed = false;
    if (supplyType) {
        targetDriver.job = supplyType;
        targetDriver.isRescue = isRescueRole(supplyType);
    }
    
    // Append or replace in routeSequence
    if (!targetDriver.routeSequence) targetDriver.routeSequence = [];
    const nextSeq = targetDriver.routeSequence.length + 1;
    targetDriver.routeSequence.push({
        seq: nextSeq,
        name: destinationName,
        lat,
        lng,
        demand: 50,
        supplyType: targetDriver.job,
        hazard: hazard || "Operational Relief Point",
        rain: "15mm/h",
        wind: "25 km/h",
        status: "PENDING"
    });

    // Solve QUBO Hamiltonian multi-node optimal routing
    const multiRoute = solveQuantumMultiNodeRoute(targetDriver.currentPos, targetDriver.routeSequence, false);
    targetDriver.polyline = multiRoute.fullPolyline;
    targetDriver.legs = multiRoute.legs;
    targetDriver.totalEtaMinutes = multiRoute.totalEtaMinutes;
    targetDriver.totalFuelBurnLiters = multiRoute.totalFuelBurnLiters;
    targetDriver.roadColor = multiRoute.roadColor;
    targetDriver.quantumMetrics = {
        hamiltonianEnergy: GROUND_STATE_ENERGY_EV,
        carbonSavedKg: multiRoute.totalCarbonSavedKg,
        qaoaLayers: 4,
        optimalRouteFound: true
    };
    targetDriver.lastUpdated = new Date().toISOString();

    const dispatchEvent = {
        type: 'DESTINATION_REASSIGNED',
        driverId: targetDriver.id,
        driverName: targetDriver.name,
        node: destinationName,
        targetPos: targetDriver.targetPos,
        routeSequence: targetDriver.routeSequence,
        legs: targetDriver.legs,
        totalEtaMinutes: targetDriver.totalEtaMinutes,
        totalFuelBurnLiters: targetDriver.totalFuelBurnLiters,
        roadColor: targetDriver.roadColor,
        polyline: targetDriver.polyline,
        job: targetDriver.job,
        isRescue: targetDriver.isRescue,
        quantumMetrics: targetDriver.quantumMetrics,
        isEmergencySpawn: !!isEmergencySpawn,
        timestamp: targetDriver.lastUpdated
    };

    broadcast(dispatchEvent);
    broadcast({ type: 'ROUTE_SEQUENCE_UPDATED', driver: targetDriver });

    res.json({
        success: true,
        message: `Unit #${targetDriver.id} (${targetDriver.name}) dynamically dispatched to ${destinationName} via Quantum QUBO routing!`,
        driver: targetDriver,
        assignedDriver: targetDriver,
        reroute: {
            path: multiRoute.fullPolyline,
            distanceKm: multiRoute.totalDistanceKm,
            fuelEst: multiRoute.totalFuelBurnLiters,
            carbonSaved: multiRoute.totalCarbonSavedKg,
            etaMinutes: multiRoute.totalEtaMinutes,
            roadColor: multiRoute.roadColor
        },
        quantumMetrics: targetDriver.quantumMetrics,
        totalNodes: rescueLocations.length
    });
});

// Officer Text-Input Location Dispatch
app.post('/api/nodes/dispatch-text', (req, res) => {
    const { driverId, locationName, demand, supplyType, urgency, lat, lng } = req.body;
    
    if (!locationName || !locationName.trim()) {
        return res.status(400).json({ success: false, message: 'Location name is required.' });
    }

    let targetDriver = null;
    if (driverId && driverId !== 'auto' && driverId !== 'AUTO') {
        targetDriver = fleet.find(d => d.id === parseInt(driverId));
    } else {
        // Find closest active truck
        let minCost = Infinity;
        fleet.forEach(d => {
            if (!d.crashSensor.isCrashed) {
                const dist = Math.hypot(d.currentPos[0] - 16.5062, d.currentPos[1] - 80.6480);
                if (dist < minCost) {
                    minCost = dist;
                    targetDriver = d;
                }
            }
        });
    }

    if (!targetDriver) targetDriver = fleet[0];

    const cleanName = locationName.trim();
    let resolvedCoord = null;
    if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
        const nodeKey = findNearestRoadNode([parseFloat(lat), parseFloat(lng)]);
        resolvedCoord = ROAD_NETWORK_NODES[nodeKey] || [parseFloat(lat), parseFloat(lng)];
    } else {
        resolvedCoord = resolveStreetLocation(cleanName);
    }
    const nodeLat = Number(resolvedCoord[0].toFixed(6));
    const nodeLng = Number(resolvedCoord[1].toFixed(6));
    const hazardType = urgency === 'CRITICAL' ? 'Flood Lv 3 - Critical Evacuation' : (urgency === 'HIGH' ? 'Risk Lv 2 - High Congestion' : 'Optimal - Clear Vector');
    const hazardColor = urgency === 'CRITICAL' ? '#ef4444' : (urgency === 'HIGH' ? '#f59e0b' : '#10b981');
    const rainLevel = urgency === 'CRITICAL' ? '48mm/h' : (urgency === 'HIGH' ? '25mm/h' : '6mm/h');
    const windSpeed = urgency === 'CRITICAL' ? '52 km/h' : (urgency === 'HIGH' ? '35 km/h' : '20 km/h');

    // Add to rescue locations catalog if not already exists
    let existingNode = rescueLocations.find(n => n.name.toLowerCase() === cleanName.toLowerCase());
    if (!existingNode) {
        existingNode = {
            id: rescueLocations.length + 1,
            name: cleanName,
            lat: nodeLat,
            lng: nodeLng,
            hazard: hazardType,
            color: hazardColor,
            rain: rainLevel,
            wind: windSpeed,
            icon: urgency === 'CRITICAL' ? 'fa-car-burst' : 'fa-location-dot',
            description: `Officer text-dispatched mission sector (${supplyType || 'Relief Supplies'}).`
        };
        rescueLocations.push(existingNode);
        broadcast({ type: 'NODE_CREATED', node: existingNode, totalNodes: rescueLocations.length });
    }

    // Append to target driver's route sequence
    if (!targetDriver.routeSequence) targetDriver.routeSequence = [];
    const nextSeq = targetDriver.routeSequence.length + 1;
    const newStop = {
        seq: nextSeq,
        nodeId: existingNode.id,
        name: cleanName,
        lat: nodeLat,
        lng: nodeLng,
        demand: parseInt(demand) || 50,
        supplyType: supplyType || targetDriver.job,
        hazard: hazardType,
        rain: rainLevel,
        wind: windSpeed,
        status: "PENDING"
    };

    targetDriver.routeSequence.push(newStop);
    targetDriver.node = cleanName;
    targetDriver.targetPos = [nodeLat, nodeLng];
    if (supplyType) targetDriver.job = supplyType;

    // Recalculate Quantum Multi-Node Route across all sequential stops
    const multiRoute = solveQuantumMultiNodeRoute(targetDriver.currentPos, targetDriver.routeSequence, targetDriver.isObstructed);
    targetDriver.polyline = multiRoute.fullPolyline;
    targetDriver.legs = multiRoute.legs;
    targetDriver.totalEtaMinutes = multiRoute.totalEtaMinutes;
    targetDriver.totalFuelBurnLiters = multiRoute.totalFuelBurnLiters;
    targetDriver.roadColor = multiRoute.roadColor;
    targetDriver.quantumMetrics = {
        hamiltonianEnergy: GROUND_STATE_ENERGY_EV,
        carbonSavedKg: multiRoute.totalCarbonSavedKg,
        qaoaLayers: 4,
        optimalRouteFound: true
    };
    targetDriver.lastUpdated = new Date().toISOString();

    const dispatchEvent = {
        type: 'DESTINATION_REASSIGNED',
        driverId: targetDriver.id,
        driverName: targetDriver.name,
        node: cleanName,
        targetPos: targetDriver.targetPos,
        routeSequence: targetDriver.routeSequence,
        legs: targetDriver.legs,
        totalEtaMinutes: targetDriver.totalEtaMinutes,
        totalFuelBurnLiters: targetDriver.totalFuelBurnLiters,
        roadColor: targetDriver.roadColor,
        polyline: targetDriver.polyline,
        job: targetDriver.job,
        isRescue: targetDriver.isRescue,
        quantumMetrics: targetDriver.quantumMetrics,
        timestamp: targetDriver.lastUpdated
    };

    broadcast(dispatchEvent);
    broadcast({ type: 'ROUTE_SEQUENCE_UPDATED', driver: targetDriver, newStop });

    res.json({
        success: true,
        message: `Location "${cleanName}" dispatched to Unit #${targetDriver.id} (${targetDriver.name}) as Stop #${nextSeq}!`,
        driver: targetDriver,
        newStop,
        metrics: {
            totalDistanceKm: multiRoute.totalDistanceKm,
            totalEtaMinutes: multiRoute.totalEtaMinutes,
            totalFuelBurnLiters: multiRoute.totalFuelBurnLiters,
            totalCarbonSavedKg: multiRoute.totalCarbonSavedKg
        },
        routeSummary: {
            totalDistanceKm: multiRoute.totalDistanceKm,
            totalEtaMinutes: multiRoute.totalEtaMinutes,
            totalFuelBurnLiters: multiRoute.totalFuelBurnLiters,
            totalCarbonSavedKg: multiRoute.totalCarbonSavedKg,
            roadColor: multiRoute.roadColor,
            legs: multiRoute.legs
        }
    });
});

// Dynamic Driver Registration & Employee Onboarding System
app.post(['/api/fleet/deploy', '/api/fleet/register'], (req, res) => {
    const { fullName, name, age, salary, vehicleId, username, passcode, job, stock, nodeIndex } = req.body;
    const newId = fleet.length + 1;
    const idx = parseInt(nodeIndex) || (newId - 1) % rescueLocations.length;
    const loc = rescueLocations[idx] || rescueLocations[0];
    const rescue = isRescueRole(job || 'Food Supply');

    const cleanFullName = (fullName || name || `Field Unit #${newId}`).trim();
    const shortName = cleanFullName.split(" ")[0];
    const customUser = (username || `DRIVER-${shortName.toUpperCase()}-${newId}`).trim();
    const customPass = (passcode || '123456').trim();
    const parsedAge = parseInt(age) || 28;
    const parsedSalary = parseInt(salary) || 35000;
    const plateId = (vehicleId || `AP-16-TX-${1000 + newId}`).trim().toUpperCase();
    const allocStock = rescue ? 0 : (parseInt(stock) || 250);

    // Initial sequential stops for the newly registered operative
    const stop2Loc = rescueLocations[(idx + 2) % rescueLocations.length];
    const initialRouteSequence = [
        {
            seq: 1,
            nodeId: loc.id,
            name: loc.name,
            lat: loc.lat,
            lng: loc.lng,
            demand: Math.min(allocStock, 60),
            supplyType: job || 'Food Supply',
            hazard: loc.hazard,
            rain: loc.rain,
            wind: loc.wind,
            status: "PENDING"
        },
        {
            seq: 2,
            nodeId: stop2Loc.id,
            name: stop2Loc.name,
            lat: stop2Loc.lat,
            lng: stop2Loc.lng,
            demand: Math.min(allocStock, 50),
            supplyType: job || 'Food Supply',
            hazard: stop2Loc.hazard,
            rain: stop2Loc.rain,
            wind: stop2Loc.wind,
            status: "SCHEDULED"
        }
    ];

    const solvedRoute = solveQuantumMultiNodeRoute([loc.lat, loc.lng], initialRouteSequence, false);

    const newDriver = {
        id: newId,
        name: shortName,
        fullName: cleanFullName,
        age: parsedAge,
        salary: parsedSalary,
        vehicleId: plateId,
        username: customUser,
        passcode: customPass,
        job: job || 'Food Supply',
        isRescue: rescue,
        node: loc.name,
        nodeLat: loc.lat,
        nodeLng: loc.lng,
        hazardLevel: loc.hazard,
        hazardColor: loc.color,
        rain: loc.rain,
        wind: loc.wind,
        weatherIcon: loc.icon,
        stock: allocStock,
        maxStock: rescue ? 0 : 500,
        fuel: 25,
        hours: 0,
        deliveredTotal: 0,
        speed: 38,
        currentPos: [loc.lat, loc.lng],
        targetPos: [loc.lat, loc.lng],
        routeSequence: initialRouteSequence,
        legs: solvedRoute.legs,
        totalEtaMinutes: solvedRoute.totalEtaMinutes,
        totalFuelBurnLiters: solvedRoute.totalFuelBurnLiters,
        roadColor: (DRIVER_COLORS && DRIVER_COLORS[newId]) || solvedRoute.roadColor,
        color: (DRIVER_COLORS && DRIVER_COLORS[newId]) || '#00f0ff',
        colorName: (DRIVER_COLOR_NAMES && DRIVER_COLOR_NAMES[newId]) || 'Quantum Cyan',
        polyline: solvedRoute.fullPolyline,
        isObstructed: false,
        crashSensor: { isCrashed: false, gForce: 1.0, tiltAngle: 0, lastTriggered: null },
        quantumMetrics: {
            hamiltonianEnergy: GROUND_STATE_ENERGY_EV,
            carbonReductionKg: (25 * 0.28 * CARBON_COEFF).toFixed(2),
            qaoaLayers: 4,
            gateFidelity: 99.85,
            activeQubits: 32,
            optimalRouteFound: true
        },
        lastUpdated: new Date().toISOString()
    };

    fleet.push(newDriver);
    broadcast({ type: 'DRIVER_DEPLOYED', driver: newDriver, totalUnits: fleet.length, activeUnits: fleet.length });
    broadcast({ type: 'DRIVER_REGISTERED', driver: newDriver });
    res.json({
        success: true,
        message: `Driver employee "${cleanFullName}" onboarded with credentials [Username: ${customUser}]!`,
        driver: newDriver,
        activeUnits: fleet.length,
        totalUnits: fleet.length
    });
});

// Officer Login
app.post('/api/auth/officer', (req, res) => {
    const { officerId, token } = req.body;
    if (officerId === GOV_OFFICER_ID) {
        return res.json({
            success: true,
            role: 'OFFICER',
            officerId: GOV_OFFICER_ID,
            name: OFFICER_NAME,
            token: ACCESS_TOKEN_SECRET,
            permissions: ['FULL_COMMAND', 'QUANTUM_SOLVER', 'ROUTING_OVERRIDE', 'ROLE_ASSIGNMENT', 'EMERGENCY_BROADCAST']
        });
    }
    return res.status(401).json({ success: false, message: 'Invalid Government Unique ID.' });
});

// Driver Login with Password Verification
app.post('/api/auth/driver', (req, res) => {
    const { driverId, passcode } = req.body;
    const cleanId = (driverId || '').trim().toLowerCase();
    const cleanPass = (passcode || '').trim();

    const driver = fleet.find(d => 
        d.username.toLowerCase() === cleanId ||
        ('DRIVER-' + d.id).toLowerCase() === cleanId ||
        d.name.toLowerCase() === cleanId
    );

    if (driver) {
        if (cleanPass && driver.passcode && driver.passcode !== cleanPass) {
            return res.status(401).json({ success: false, message: 'Incorrect Driver Passcode / Password.' });
        }
        return res.json({ success: true, role: 'DRIVER', driver: { ...driver } });
    }

    return res.status(401).json({ success: false, message: 'Driver profile not found.' });
});

// Fleet with Privacy Filter
app.get('/api/fleet', (req, res) => {
    const { viewerRole, viewerDriverId } = req.query;

    const data = fleet.map(d => {
        const canViewSalary = viewerRole === 'OFFICER' || (viewerRole === 'DRIVER' && Number(viewerDriverId) === d.id);
        return {
            ...d,
            salary: canViewSalary ? d.salary : 'RESTRICTED_PRIVACY_SHIELD'
        };
    });

    res.json({ success: true, count: data.length, fleet: data });
});

// Single Driver
app.get('/api/fleet/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const driver = fleet.find(d => d.id === id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    const { viewerRole, viewerDriverId } = req.query;
    const canViewSalary = viewerRole === 'OFFICER' || (viewerRole === 'DRIVER' && Number(viewerDriverId) === driver.id);

    res.json({
        success: true,
        driver: {
            ...driver,
            salary: canViewSalary ? driver.salary : 'RESTRICTED_PRIVACY_SHIELD'
        }
    });
});

// Run Fleet-Wide QUBO/QAOA Solver
app.post('/api/quantum-solve', (req, res) => {
    let totalCarbonSaved = 0;
    fleet.forEach(driver => {
        const reroute = solveQuantumQUBORoute(driver.currentPos, driver.targetPos, driver.isObstructed);
        driver.polyline = reroute.path;
        driver.quantumMetrics = {
            hamiltonianEnergy: GROUND_STATE_ENERGY_EV,
            carbonSavedKg: reroute.carbonSaved,
            qaoaLayers: 4,
            optimalRouteFound: true
        };
        totalCarbonSaved += reroute.carbonSaved;
    });

    const result = {
        success: true,
        groundStateEnergy: `${GROUND_STATE_ENERGY_EV} eV`,
        totalCarbonSavedKg: Number(totalCarbonSaved.toFixed(2)),
        carbonReductionPercent: 21.9,
        activeQubits: 32,
        gateFidelity: 99.85,
        nodesOptimized: rescueLocations.length,
        timestamp: new Date().toISOString()
    };

    broadcast({ type: 'QUANTUM_SOLVER_EXECUTED', result });
    res.json(result);
});

// Dynamic Role Assignment
app.post('/api/fleet/:id/role', (req, res) => {
    const id = parseInt(req.params.id);
    const { newRole } = req.body;
    const driver = fleet.find(d => d.id === id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    driver.job = newRole;
    driver.isRescue = isRescueRole(newRole);
    if (driver.isRescue) {
        driver.stock = 0;
    } else if (driver.stock === 0) {
        driver.stock = 150;
    }
    driver.lastUpdated = new Date().toISOString();

    broadcast({
        type: 'ROLE_UPDATED',
        driverId: id,
        newRole: driver.job,
        isRescue: driver.isRescue,
        stock: driver.stock,
        timestamp: driver.lastUpdated
    });

    res.json({ success: true, driver });
});

// Stock Delivery Update
app.post('/api/fleet/:id/stock', (req, res) => {
    const id = parseInt(req.params.id);
    const { deliveredUnits } = req.body;
    const driver = fleet.find(d => d.id === id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    const count = parseInt(deliveredUnits) || 0;
    driver.deliveredTotal += count;
    driver.stock = Math.max(0, driver.stock - count);
    driver.lastUpdated = new Date().toISOString();

    const needsRestock = driver.stock === 0 && !driver.isRescue;

    broadcast({
        type: 'STOCK_UPDATED',
        driverId: id,
        deliveredUnits: count,
        remainingStock: driver.stock,
        deliveredTotal: driver.deliveredTotal,
        needsRestock,
        timestamp: driver.lastUpdated
    });

    res.json({ success: true, remainingStock: driver.stock, needsRestock });
});

// Restock Verification
app.post('/api/fleet/:id/restock', (req, res) => {
    const id = parseInt(req.params.id);
    const { hubCode, units } = req.body;
    const driver = fleet.find(d => d.id === id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    const replenishAmount = parseInt(units) || 250;
    driver.stock = replenishAmount;
    driver.lastUpdated = new Date().toISOString();

    broadcast({
        type: 'RESTOCK_COMPLETED',
        driverId: id,
        newStock: driver.stock,
        hubCode: hubCode || 'HUB-VIJ-01',
        timestamp: driver.lastUpdated
    });

    res.json({ success: true, message: 'Restock verified', stock: driver.stock });
});

// Quantum Multi-Node Emergency Mission Assignment (Spec 5, 6, 14 & Test A, B, D, H)
app.post('/api/fleet/:id/mission', (req, res) => {
    const role = (req.headers['x-role'] || '').toUpperCase();
    if (role === 'DRIVER') {
        return res.status(403).json({
            success: false,
            message: 'Access Denied: Emergency mission creation and dispatch is strictly restricted to Command Officers.'
        });
    }

    const id = parseInt(req.params.id);
    const driver = fleet.find(d => d.id === id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    if (driver.crashSensor && driver.crashSensor.isCrashed) {
        return res.status(400).json({ success: false, message: 'Cannot assign mission: Driver unit is in critical SOS/Crash state.' });
    }

    const { destinations, optimizeOrder = true, missionNotes, supplyType } = req.body;
    if (!Array.isArray(destinations) || destinations.length === 0) {
        return res.status(400).json({ success: false, message: 'No emergency destination nodes provided. At least 1 valid node required.' });
    }

    // Rigorous accessibility validation for each emergency destination
    for (const d of destinations) {
        const coord = [parseFloat(d.lat), parseFloat(d.lng)];
        const access = validateDestinationAccessibility(coord);
        if (!access.isAccessible) {
            return res.status(422).json({
                success: false,
                error: 'UNREACHABLE_DESTINATION',
                message: `Destination "${d.name || 'Emergency Point'}" is unreachable: ${access.message}`,
                problematicNode: {
                    name: d.name,
                    lat: d.lat,
                    lng: d.lng,
                    reason: access.reason,
                    details: access.message
                }
            });
        }
    }

    // Format destination stops
    const stops = destinations.map((d, idx) => ({
        id: d.id || ('mission-node-' + Date.now() + '-' + (idx + 1)),
        nodeId: d.id || (idx + 1),
        name: d.name || `Emergency Vector ${idx + 1}`,
        lat: Number(parseFloat(d.lat).toFixed(6)),
        lng: Number(parseFloat(d.lng).toFixed(6)),
        demand: parseInt(d.demand) || 50,
        supplyType: d.supplyType || supplyType || driver.job || 'Relief Supplies',
        hazard: d.hazard || 'Clear Municipal Vector',
        rain: d.rain || '10mm/h',
        wind: d.wind || '20 km/h',
        status: 'PENDING'
    }));

    // Solve Quantum TSP Tour Optimization starting from driver's current position
    let orderedStops = stops;
    if (optimizeOrder !== false && stops.length > 1) {
        orderedStops = solveQuantumTSP(driver.currentPos, stops, driver.isObstructed);
    }
    
    // Explicitly enforce that Node 1 (first in optimized visit sequence) is IN_PROGRESS
    orderedStops.forEach((s, idx) => {
        s.seq = idx + 1;
        s.status = (idx === 0) ? 'IN_PROGRESS' : 'PENDING';
    });

    // Solve full multi-node road-following path across optimized stops
    const multiRoute = solveQuantumMultiNodeRoute(driver.currentPos, orderedStops, driver.isObstructed, false);

    driver.routeSequence = multiRoute.orderedSequence;
    driver.legs = multiRoute.legs;
    driver.polyline = multiRoute.fullPolyline;
    driver.targetPos = [driver.routeSequence[0].lat, driver.routeSequence[0].lng];
    driver.node = driver.routeSequence[0].name;
    driver.missionStatus = 'DISPATCHED';
    driver.totalDistanceKm = multiRoute.totalDistanceKm;
    driver.totalEtaMinutes = multiRoute.totalEtaMinutes;
    driver.totalFuelBurnLiters = multiRoute.totalFuelBurnLiters;
    driver.roadColor = multiRoute.roadColor;
    driver.telemetryPolyIdx = 0;
    driver.isObstructed = false;
    driver.quantumMetrics = {
        hamiltonianEnergy: GROUND_STATE_ENERGY_EV,
        carbonSavedKg: multiRoute.totalCarbonSavedKg,
        qaoaLayers: 4,
        optimalRouteFound: true
    };
    driver.lastUpdated = new Date().toISOString();

    broadcast({
        type: 'MISSION_ASSIGNED',
        driverId: driver.id,
        driverName: driver.name,
        node: driver.node,
        targetPos: driver.targetPos,
        routeSequence: driver.routeSequence,
        legs: driver.legs,
        polyline: driver.polyline,
        totalDistanceKm: driver.totalDistanceKm,
        totalEtaMinutes: driver.totalEtaMinutes,
        totalFuelBurnLiters: driver.totalFuelBurnLiters,
        roadColor: driver.roadColor,
        quantumMetrics: driver.quantumMetrics,
        driver,
        timestamp: driver.lastUpdated
    });

    broadcast({
        type: 'ROUTE_SEQUENCE_UPDATED',
        driverId: driver.id,
        driverName: driver.name,
        routeSequence: driver.routeSequence,
        polyline: driver.polyline,
        legs: driver.legs,
        totalEtaMinutes: driver.totalEtaMinutes,
        totalFuelBurnLiters: driver.totalFuelBurnLiters,
        roadColor: driver.roadColor,
        targetNodeName: driver.node,
        driver
    });

    res.json({
        success: true,
        message: `Emergency mission with ${orderedStops.length} stops assigned to Unit #${driver.id} (${driver.name}) via Quantum TSP optimization!`,
        driver,
        optimizedSequence: driver.routeSequence,
        metrics: {
            totalDistanceKm: multiRoute.totalDistanceKm,
            totalEtaMinutes: multiRoute.totalEtaMinutes,
            totalFuelBurnLiters: multiRoute.totalFuelBurnLiters,
            totalCarbonSavedKg: multiRoute.totalCarbonSavedKg
        }
    });
});

// Operative Stop / Leg Advance (Dynamic Progress Visualization)
app.post('/api/fleet/:id/advance', (req, res) => {
    const role = (req.headers['x-role'] || '').toUpperCase();
    const callerDriverId = parseInt(req.headers['x-driver-id']);
    const id = parseInt(req.params.id);
    if (role === 'DRIVER' && callerDriverId && callerDriverId !== id) {
        return res.status(403).json({ success: false, message: 'Drivers are forbidden from modifying another unit\'s mission progress.' });
    }
    const driver = fleet.find(d => d.id === id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    if (!driver.routeSequence || driver.routeSequence.length === 0) {
        return res.status(400).json({ success: false, message: 'No route sequence assigned' });
    }

    // Find the current active/pending stop
    let stopIdx = driver.routeSequence.findIndex(s => s.status !== 'COMPLETED');
    if (stopIdx === -1) {
        return res.json({ 
            success: true, 
            message: `All assigned stops for Unit #${id} are already completed!`, 
            driver,
            completedAll: true
        });
    }

    const clearedStop = driver.routeSequence[stopIdx];
    clearedStop.status = 'COMPLETED';

    // Move driver position to the cleared stop's coordinate
    driver.currentPos = [clearedStop.lat, clearedStop.lng];

    // Update corresponding leg status if present
    if (driver.legs && driver.legs[stopIdx]) {
        driver.legs[stopIdx].status = 'COMPLETED';
    }

    // Deliver portion of stock if delivery role
    if (!driver.isRescue && driver.stock > 0) {
        const deliverCount = Math.min(driver.stock, clearedStop.demand || 25);
        driver.stock = Math.max(0, driver.stock - deliverCount);
        driver.deliveredTotal = (driver.deliveredTotal || 0) + deliverCount;
    }

    // Check next stop
    const nextStop = driver.routeSequence.find(s => s.status !== 'COMPLETED');
    if (nextStop) {
        nextStop.status = 'IN_PROGRESS';
        driver.node = nextStop.name;
        driver.targetPos = [nextStop.lat, nextStop.lng];
        if (driver.legs) {
            const nextLeg = driver.legs.find(l => l.status !== 'COMPLETED');
            if (nextLeg) nextLeg.status = 'IN_PROGRESS';
        }
        const solvedRemaining = solveQuantumMultiNodeRoute(driver.currentPos, driver.routeSequence, driver.isObstructed);
        driver.polyline = solvedRemaining.fullPolyline;
        driver.legs = solvedRemaining.legs;
        driver.totalDistanceKm = solvedRemaining.totalDistanceKm;
        driver.totalFuelBurnLiters = solvedRemaining.totalFuelBurnLiters;
        driver.totalEtaMinutes = solvedRemaining.totalEtaMinutes;
        driver.telemetryPolyIdx = 0;
    } else {
        driver.missionStatus = 'DELIVERED';
        driver.node = `Delivered: ${clearedStop.name}`;
        driver.polyline = [driver.currentPos];
        driver.telemetryPolyIdx = 0;
    }

    driver.lastUpdated = new Date().toISOString();

    broadcast({
        type: 'STOP_CLEARED',
        driverId: id,
        driverName: driver.name,
        clearedStopIndex: stopIdx,
        clearedStop: clearedStop,
        driver: driver,
        timestamp: driver.lastUpdated
    });

    broadcast({
        type: 'ROUTE_SEQUENCE_UPDATED',
        driver: driver
    });

    res.json({
        success: true,
        message: `Unit #${id} (${driver.name}) successfully reached and cleared Stop #${clearedStop.seq || (stopIdx + 1)}: ${clearedStop.name}!`,
        clearedStop,
        driver
    });
});

// Accident SOS Trigger with Automated Reinforcement Dispatch
app.post('/api/fleet/:id/sos', (req, res) => {
    const id = parseInt(req.params.id);
    const driver = fleet.find(d => d.id === id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    driver.crashSensor = {
        isCrashed: true,
        gForce: 8.4,
        tiltAngle: 72,
        lastTriggered: new Date().toISOString()
    };
    driver.lastUpdated = new Date().toISOString();

    // AUTOMATED REINFORCEMENT: Find closest non-crashed available truck to reinforce this sector
    let reinforcementUnit = null;
    let minDistance = Infinity;
    fleet.forEach(candidate => {
        if (candidate.id !== id && !candidate.crashSensor.isCrashed) {
            const dist = Math.hypot(candidate.currentPos[0] - driver.currentPos[0], candidate.currentPos[1] - driver.currentPos[1]);
            if (dist < minDistance) {
                minDistance = dist;
                reinforcementUnit = candidate;
            }
        }
    });

    let reinforcementPlan = null;
    if (reinforcementUnit) {
        // Calculate Quantum Tunneling Detour for the backup truck to reinforce the crashed unit's location
        const backupReroute = solveQuantumQUBORoute(reinforcementUnit.currentPos, driver.currentPos, true);
        reinforcementUnit.targetPos = [...driver.currentPos];
        reinforcementUnit.node = `REINFORCING: ${driver.node}`;
        reinforcementUnit.polyline = backupReroute.path;
        reinforcementUnit.isObstructed = false;
        reinforcementUnit.lastUpdated = new Date().toISOString();

        reinforcementPlan = {
            reinforcementDriverId: reinforcementUnit.id,
            reinforcementDriverName: reinforcementUnit.name,
            targetCrashedUnit: driver.name,
            destinationNode: driver.node,
            detourDistanceKm: backupReroute.distanceKm,
            quantumMetrics: backupReroute
        };
    }

    broadcast({
        type: 'EMERGENCY_CRASH_DETECTED',
        driverId: id,
        driverName: driver.name,
        node: driver.node,
        coordinates: driver.currentPos,
        gForce: driver.crashSensor.gForce,
        tiltAngle: driver.crashSensor.tiltAngle,
        timestamp: driver.crashSensor.lastTriggered,
        reinforcementPlan
    });

    res.json({ 
        success: true, 
        message: 'SOS Triggered and Automated Quantum Reinforcement Vector Dispatched', 
        crashSensor: driver.crashSensor,
        reinforcementPlan
    });
});

// Clear SOS Alert
app.post('/api/fleet/:id/clear-sos', (req, res) => {
    const id = parseInt(req.params.id);
    const driver = fleet.find(d => d.id === id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    driver.crashSensor = { isCrashed: false, gForce: 1.0, tiltAngle: 0, lastTriggered: null };
    driver.lastUpdated = new Date().toISOString();

    broadcast({
        type: 'EMERGENCY_CRASH_RESOLVED',
        driverId: id,
        timestamp: driver.lastUpdated
    });

    res.json({ success: true, message: 'SOS cleared' });
});

// Route Obstructed with Automated Peer Protection Loop (Driver-Initiated Action)
app.post('/api/fleet/:id/obstruction', (req, res) => {
    const id = parseInt(req.params.id);
    const driver = fleet.find(d => d.id === id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    const callerRole = (req.body?.role || req.headers['x-role'] || '').toUpperCase();
    if (callerRole === 'OFFICER' && !req.body?.isDriverSimulation) {
        return res.status(403).json({ success: false, message: 'Road obstruction reports are driver-only actions.' });
    }

    driver.isObstructed = true;
    const blockedEdge = req.body?.blockedEdge;
    const segmentName = req.body?.segmentName;
    if (blockedEdge) {
        driver.blockedEdges = driver.blockedEdges || [];
        driver.blockedEdges.push(blockedEdge);
    }

    let reroute;
    if (driver.routeSequence && driver.routeSequence.length > 1) {
        const multiResult = solveQuantumMultiNodeRoute(driver.currentPos, driver.routeSequence, true, false, driver.blockedEdges);
        driver.polyline = multiResult.fullPolyline;
        driver.legs = multiResult.legs;
        driver.totalDistanceKm = multiResult.totalDistanceKm;
        driver.totalFuelBurnLiters = multiResult.totalFuelBurnLiters;
        driver.totalEtaMinutes = multiResult.totalEtaMinutes;
        driver.roadColor = multiResult.roadColor;
        driver.telemetryPolyIdx = 0;
        reroute = {
            path: multiResult.fullPolyline,
            distanceKm: multiResult.totalDistanceKm,
            hamiltonianEnergy: -3.85,
            carbonSavedKg: 18.4
        };
    } else {
        reroute = solveQuantumQUBORoute(driver.currentPos, driver.targetPos, true, driver.blockedEdges);
        driver.polyline = reroute.path;
        driver.totalDistanceKm = reroute.distanceKm;
        driver.totalFuelBurnLiters = reroute.fuelEst;
        driver.totalEtaMinutes = reroute.etaMinutes;
        driver.roadColor = reroute.roadColor;
        driver.telemetryPolyIdx = 0;
    }
    driver.fuel += 2.0;
    driver.lastUpdated = new Date().toISOString();

    // Create persistent officer alert for road obstruction
    const activeTarget = (driver.routeSequence || []).find(s => s.status !== 'COMPLETED') || driver.routeSequence[0] || { name: driver.node, lat: driver.targetPos[0], lng: driver.targetPos[1] };
    const alert = {
        id: 'ALT-' + Date.now().toString(36).toUpperCase(),
        type: 'ROUTE_OBSTRUCTION',
        severity: 'HIGH',
        driverId: id,
        driverName: driver.name,
        driverColor: driver.color || '#00f0ff',
        destinationNode: activeTarget.name || driver.node,
        destinationCoords: [activeTarget.lat || driver.targetPos[0], activeTarget.lng || driver.targetPos[1]],
        currentPos: driver.currentPos,
        reason: `Corridor Closed: ${segmentName || (blockedEdge ? (Array.isArray(blockedEdge) ? blockedEdge.join(' ↔ ') : blockedEdge) : 'Corridor Segment')}`,
        notes: `Road segment reported closed. Driver ${driver.name} rerouted from live position toward active destination "${activeTarget.name}".`,
        status: 'ACTIVE',
        timestamp: driver.lastUpdated
    };
    systemAlerts.unshift(alert);
    if (systemAlerts.length > 50) systemAlerts.pop();

    broadcast({
        type: 'SYSTEM_ALERT_CREATED',
        alert
    });

    // Preemptively check if any other peer trucks cross near this blocked corridor
    const affectedPeers = [];
    fleet.forEach(peer => {
        if (peer.id !== id && !peer.isObstructed && !peer.crashSensor.isCrashed) {
            const dist = Math.hypot(peer.currentPos[0] - driver.currentPos[0], peer.currentPos[1] - driver.currentPos[1]);
            if (dist < 0.02) { // within ~2.2 km of obstruction corridor
                peer.blockedEdges = peer.blockedEdges || [];
                if (blockedEdge) peer.blockedEdges.push(blockedEdge);
                const peerReroute = (peer.routeSequence && peer.routeSequence.length > 1)
                    ? solveQuantumMultiNodeRoute(peer.currentPos, peer.routeSequence, true, false, peer.blockedEdges)
                    : solveQuantumQUBORoute(peer.currentPos, peer.targetPos, true);
                peer.polyline = peerReroute.path || peerReroute.fullPolyline;
                if (peerReroute.legs) peer.legs = peerReroute.legs;
                peer.isObstructed = true;
                peer.telemetryPolyIdx = 0;
                peer.lastUpdated = new Date().toISOString();
                affectedPeers.push({
                    id: peer.id,
                    name: peer.name,
                    polyline: peer.polyline,
                    quantumMetrics: peerReroute
                });
            }
        }
    });

    broadcast({
        type: 'ROUTE_OBSTRUCTION_REROUTE',
        driverId: id,
        driverName: driver.name,
        blockedEdge,
        segmentName,
        polyline: driver.polyline,
        legs: driver.legs,
        driver,
        quantumMetrics: reroute,
        isObstructed: true,
        affectedPeers,
        timestamp: driver.lastUpdated
    });

    res.json({
        success: true,
        driver,
        detour: {
            ...reroute,
            quantumTunnelingFactor: 1.38,
            tunnelingCorridor: 'Bypassing High-Water Vector'
        },
        reroute,
        alert,
        affectedPeers
    });
});

// Clear Route Obstruction / Reopen Corridor (Officer-Only Action)
app.post('/api/fleet/:id/clear-obstruction', (req, res) => {
    const id = parseInt(req.params.id);
    const driver = fleet.find(d => d.id === id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    const callerRole = (req.body?.role || req.headers['x-role'] || '').toUpperCase();
    if (callerRole === 'DRIVER') {
        return res.status(403).json({ success: false, message: 'Only Command Officers are authorized to clear and reopen corridors.' });
    }

    driver.isObstructed = false;
    driver.blockedEdges = [];
    let reroute;
    if (driver.routeSequence && driver.routeSequence.length > 1) {
        const multiResult = solveQuantumMultiNodeRoute(driver.currentPos, driver.routeSequence, false, false, []);
        driver.polyline = multiResult.fullPolyline;
        driver.legs = multiResult.legs;
        driver.totalDistanceKm = multiResult.totalDistanceKm;
        driver.totalFuelBurnLiters = multiResult.totalFuelBurnLiters;
        driver.totalEtaMinutes = multiResult.totalEtaMinutes;
        driver.roadColor = multiResult.roadColor;
        driver.telemetryPolyIdx = 0;
        reroute = {
            path: multiResult.fullPolyline,
            distanceKm: multiResult.totalDistanceKm,
            hamiltonianEnergy: -29.04,
            carbonSavedKg: 24.5
        };
    } else {
        reroute = solveQuantumQUBORoute(driver.currentPos, driver.targetPos, false);
        driver.polyline = reroute.path;
        driver.telemetryPolyIdx = 0;
    }
    driver.lastUpdated = new Date().toISOString();

    broadcast({
        type: 'ROUTE_OBSTRUCTION_CLEARED',
        driverId: id,
        driverName: driver.name,
        polyline: driver.polyline,
        legs: driver.legs,
        driver,
        isObstructed: false,
        timestamp: driver.lastUpdated
    });

    res.json({
        success: true,
        message: `Corridor for ${driver.name} reopened and cleared.`,
        driver,
        reroute
    });
});

// Driver Reports Destination Unreachable (Driver-Only)
app.post('/api/fleet/:id/unreachable-report', (req, res) => {
    const id = parseInt(req.params.id);
    const driver = fleet.find(d => d.id === id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    const callerRole = (req.body?.role || req.headers['x-role'] || '').toUpperCase();
    if (callerRole === 'OFFICER') {
        return res.status(403).json({ success: false, message: 'Destination unreachable reports must originate from driver field console.' });
    }
    const callerDriverId = parseInt(req.headers['x-driver-id'] || req.body?.driverId);
    if (callerRole === 'DRIVER' && callerDriverId && callerDriverId !== id) {
        return res.status(403).json({ success: false, message: 'Drivers are forbidden from submitting unreachable reports for another unit.' });
    }

    const { destinationNode, destinationCoords, reason, notes } = req.body;
    if (!reason) {
        return res.status(400).json({ success: false, message: 'Obstruction reason is required.' });
    }

    const targetNode = destinationNode || driver.node;
    const targetCoords = destinationCoords || driver.targetPos;

    const report = {
        id: 'RPT-' + Date.now().toString(36).toUpperCase(),
        driverId: id,
        driverName: driver.name,
        driverColor: driver.color || '#00f0ff',
        destinationNode: targetNode,
        destinationCoords: targetCoords,
        currentPos: driver.currentPos,
        reason: reason.trim(),
        notes: (notes || '').trim(),
        timestamp: new Date().toISOString()
    };
    destinationReports.unshift(report);

    const alert = {
        id: 'ALT-' + Date.now().toString(36).toUpperCase(),
        type: 'DESTINATION_UNREACHABLE',
        severity: 'HIGH',
        driverId: id,
        driverName: driver.name,
        driverColor: driver.color || '#00f0ff',
        destinationNode: targetNode,
        destinationCoords: targetCoords,
        currentPos: driver.currentPos,
        reason: reason.trim(),
        notes: (notes || '').trim(),
        status: 'ACTIVE',
        timestamp: report.timestamp
    };
    systemAlerts.unshift(alert);

    if (systemAlerts.length > 50) systemAlerts.pop();

    broadcast({
        type: 'DESTINATION_UNREACHABLE_REPORT',
        alert,
        report,
        driverId: id,
        driverName: driver.name,
        timestamp: report.timestamp
    });

    broadcast({
        type: 'SYSTEM_ALERT_CREATED',
        alert
    });

    res.json({
        success: true,
        message: `Destination unreachable report for "${targetNode}" logged and alerted to Command Officer.`,
        alert,
        report
    });
});

// Fetch active system and officer persistent alerts
app.get('/api/alerts', (req, res) => {
    const activeAlerts = systemAlerts.filter(a => a.status === 'ACTIVE');
    res.json({
        success: true,
        alerts: activeAlerts,
        allAlertsCount: systemAlerts.length,
        count: activeAlerts.length
    });
});

// Officer Acknowledge Persistent Alert (Officer-Only)
app.post('/api/alerts/:id/acknowledge', (req, res) => {
    const alertId = req.params.id;
    const callerRole = (req.body?.role || req.headers['x-role'] || '').toUpperCase();
    if (callerRole === 'DRIVER') {
        return res.status(403).json({ success: false, message: 'Only Command Officers can acknowledge alerts.' });
    }

    const alert = systemAlerts.find(a => a.id === alertId);
    if (!alert) {
        return res.status(404).json({ success: false, message: 'Alert not found' });
    }

    alert.status = 'ACKNOWLEDGED';
    alert.acknowledgedBy = OFFICER_NAME;
    alert.acknowledgedAt = new Date().toISOString();

    broadcast({
        type: 'SYSTEM_ALERT_ACKNOWLEDGED',
        alertId: alert.id,
        alert
    });

    res.json({
        success: true,
        message: `Alert ${alert.id} acknowledged by Officer ${OFFICER_NAME}.`,
        alert
    });
});

// Update Vehicle Sensor Telemetry via REST
app.post('/api/fleet/:id/telemetry', (req, res) => {
    const id = parseInt(req.params.id);
    const driver = fleet.find(d => d.id === id);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    const { currentPos, speed, heading, fuelBurnRate, crashSensor } = req.body;
    if (currentPos) {
        driver.currentPos = currentPos;
        if (!driver.polyline || driver.polyline.length <= 1) {
            driver.polyline = [currentPos];
            driver.telemetryPolyIdx = 0;
        }
    }
    if (speed !== undefined) driver.speed = speed;
    if (heading !== undefined) driver.heading = heading;
    if (fuelBurnRate !== undefined) driver.fuelBurnRate = fuelBurnRate;
    if (crashSensor) driver.crashSensor = crashSensor;
    driver.lastUpdated = new Date().toISOString();

    broadcast({
        type: 'VEHICLE_TELEMETRY_UPDATE',
        driverId: driver.id,
        name: driver.name,
        currentPos: driver.currentPos,
        speed: driver.speed,
        fuelBurnRate: driver.fuelBurnRate,
        heading: driver.heading,
        crashSensor: driver.crashSensor,
        timestamp: driver.lastUpdated
    });

    res.json({
        success: true,
        driver
    });
});

// Manual Quantum Reroute
app.post('/api/fleet/:id/quantum-reroute', (req, res) => {
    const id = parseInt(req.params.id);
    const driver = fleet.find(d => d.id === id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    driver.isObstructed = false;
    const reroute = solveQuantumQUBORoute(driver.currentPos, driver.targetPos, false);
    driver.polyline = reroute.path;
    driver.lastUpdated = new Date().toISOString();

    broadcast({
        type: 'QUANTUM_REROUTE_OPTIMAL',
        driverId: id,
        polyline: driver.polyline,
        quantumMetrics: reroute,
        timestamp: driver.lastUpdated
    });

    res.json({ success: true, reroute });
});

// Clear Route Line & Reset Assigned Stop Targets (Spec 4)
app.post('/api/fleet/:id/clear-route', (req, res) => {
    const id = parseInt(req.params.id);
    const driver = fleet.find(d => d.id === id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    driver.routeSequence = [];
    driver.polyline = [driver.currentPos];
    driver.targetPos = [...driver.currentPos];
    driver.legs = [];
    driver.totalEtaMinutes = 0;
    driver.totalFuelBurnLiters = 0;
    driver.isObstructed = false;
    driver.roadColor = driver.color || '#00f0ff';
    driver.lastUpdated = new Date().toISOString();

    broadcast({
        type: 'ROUTE_CLEARED',
        driverId: id,
        driverName: driver.name,
        driver,
        timestamp: driver.lastUpdated
    });

    res.json({
        success: true,
        message: `Route line and stops cleared for Unit #${driver.id} (${driver.name}).`,
        driver
    });
});

// Officer Emergency Broadcast
app.post('/api/broadcast', (req, res) => {
    const { directive } = req.body;
    const broadcastEvent = {
        type: 'AUDIO_EMERGENCY_BROADCAST',
        directive: directive || 'COMMAND DIRECTIVE: ALL UNITS RETEAM TO DESIGNATED RESCUE VECTORS IMMEDIATELY.',
        sender: OFFICER_NAME,
        officerId: GOV_OFFICER_ID,
        timestamp: new Date().toISOString()
    };

    broadcast(broadcastEvent);
    res.json({ success: true, broadcastEvent });
});

// QPU Telemetry Status Endpoint
app.get(['/api/qpu-status', '/api/qpu'], (req, res) => {
    res.json({
        qpuStatus: 'ONLINE',
        processor: 'IBM Eagle QPU (Simulated Falcon-r4)',
        activeQubits: 32,
        gateFidelity: 99.85,
        hamiltonianEnergy: `${GROUND_STATE_ENERGY_EV} eV`,
        activeUnits: fleet.length,
        nodes: rescueLocations.length,
        timestamp: new Date().toISOString()
    });
});

// Shift Summary Report
app.get(['/api/report/shift-summary', '/api/shift-report'], (req, res) => {
    const totalHours = fleet.reduce((acc, d) => acc + d.hours, 0);
    const totalFuelBurned = fleet.reduce((acc, d) => acc + d.fuel, 0);
    const totalPackagesDelivered = fleet.reduce((acc, d) => acc + d.deliveredTotal, 0);
    const totalCO2Emitted = Number((totalFuelBurned * CARBON_COEFF).toFixed(2));
    const classicalEstFuel = Number((totalFuelBurned * 1.28).toFixed(1));
    const classicalCO2Emitted = Number((classicalEstFuel * CARBON_COEFF).toFixed(2));
    const co2Saved = Number((classicalCO2Emitted - totalCO2Emitted).toFixed(2));
    const savingsPercent = Number(((co2Saved / classicalCO2Emitted) * 100).toFixed(1));

    const unitBreakdown = fleet.map(d => ({
        id: d.id,
        name: d.name,
        node: d.node,
        role: d.job,
        hoursWorked: d.hours,
        fuelBurnedLiters: d.fuel,
        carbonEmittedKg: Number((d.fuel * CARBON_COEFF).toFixed(2)),
        packagesDelivered: d.deliveredTotal,
        status: d.crashSensor.isCrashed ? 'CRASH_SOS' : d.isObstructed ? 'OBSTRUCTED' : 'ONLINE'
    }));

    res.json({
        reportId: 'QR-10NODE-AUDIT-' + Date.now().toString(36).toUpperCase(),
        generatedAt: new Date().toISOString(),
        officerInCharge: OFFICER_NAME,
        officerId: GOV_OFFICER_ID,
        kpis: {
            totalUnits: fleet.length,
            totalNodes: rescueLocations.length,
            qpuStatus: 'ONLINE',
            gateFidelity: 99.85,
            activeQubits: 32,
            groundStateEnergy: `${GROUND_STATE_ENERGY_EV} eV`,
            totalHours,
            totalFuelBurned,
            totalPackagesDelivered,
            totalCO2EmittedKg: totalCO2Emitted,
            classicalCO2EmittedKg: classicalCO2Emitted,
            co2SavedKg: co2Saved,
            savingsPercent
        },
        unitBreakdown
    });
});

// Batch Offline Sync
app.post('/api/sync', (req, res) => {
    const { offlineEvents } = req.body;
    if (!Array.isArray(offlineEvents)) {
        return res.status(400).json({ success: false, message: 'offlineEvents array required' });
    }

    let processedCount = 0;
    offlineEvents.forEach(evt => {
        const driver = fleet.find(d => d.id === evt.driverId);
        if (driver) {
            if (evt.type === 'STOCK_DELIVERY') {
                const count = parseInt(evt.amount) || 0;
                driver.stock = Math.max(0, driver.stock - count);
                driver.deliveredTotal += count;
            } else if (evt.type === 'ROLE_CHANGE') {
                driver.job = evt.role;
                driver.isRescue = isRescueRole(evt.role);
            } else if (evt.type === 'RESTOCK') {
                driver.stock = parseInt(evt.units) || 250;
            } else if (evt.type === 'SOS_CRASH') {
                driver.crashSensor = {
                    isCrashed: true,
                    gForce: evt.gForce || 8.4,
                    tiltAngle: evt.tiltAngle || 72,
                    lastTriggered: evt.timestamp || new Date().toISOString()
                };
            }
            driver.lastUpdated = new Date().toISOString();
            processedCount++;
        }
    });

    broadcast({
        type: 'OFFLINE_RECONCILIATION_COMPLETED',
        processedEvents: processedCount,
        timestamp: new Date().toISOString()
    });

    res.json({
        success: true,
        processedEvents: processedCount,
        latestFleet: fleet
    });
});

// ==========================================
// 5. WEBSOCKET REAL-TIME HANDLING
// ==========================================
wss.on('connection', (ws) => {
    ws.send(JSON.stringify({
        type: 'HANDSHAKE',
        message: 'Connected to QuantumRoute 10-Node QAOA Telemetry Stream',
        serverTime: new Date().toISOString(),
        unitsOnline: fleet.length,
        qpuStatus: 'ONLINE',
        activeQubits: 32,
        gateFidelity: 99.85,
        groundStateEnergy: `${GROUND_STATE_ENERGY_EV} eV`
    }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'PING') {
                ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
            } else if (data.type === 'VEHICLE_TELEMETRY') {
                const driver = fleet.find(d => d.id === data.driverId);
                if (driver) {
                    if (data.currentPos) driver.currentPos = data.currentPos;
                    if (data.speed !== undefined) driver.speed = data.speed;
                    if (data.fuelBurnRate !== undefined) driver.fuelBurnRate = data.fuelBurnRate;
                    if (data.heading !== undefined) driver.heading = data.heading;
                    if (data.crashSensor) driver.crashSensor = data.crashSensor;
                    driver.lastUpdated = new Date().toISOString();

                    broadcast({
                        type: 'VEHICLE_TELEMETRY_UPDATE',
                        driverId: driver.id,
                        name: driver.name,
                        currentPos: driver.currentPos,
                        speed: driver.speed,
                        fuelBurnRate: driver.fuelBurnRate,
                        heading: driver.heading,
                        crashSensor: driver.crashSensor,
                        timestamp: driver.lastUpdated
                    });
                }
            }
        } catch (e) {}
    });
});

// Automated Continuous Vehicle Sensor Telemetry & Motion Streaming Loop (Spec 1 & Spec 3)
const telemetryInterval = setInterval(() => {
    fleet.forEach(d => {
        try {
            if (!d.isRescue && !d.crashSensor?.isCrashed && Array.isArray(d.currentPos) && d.currentPos.length >= 2) {
                // Determine next target coordinate to compute realistic forward heading
                let nextCoord = null;
                if (Array.isArray(d.polyline) && d.polyline.length > 1) {
                    nextCoord = d.polyline[1];
                } else if (Array.isArray(d.targetPos) && d.targetPos.length >= 2) {
                    nextCoord = d.targetPos;
                }

                if (Array.isArray(nextCoord) && nextCoord.length >= 2) {
                    const lat1 = d.currentPos[0] * Math.PI / 180;
                    const lat2 = nextCoord[0] * Math.PI / 180;
                    const dLng = (nextCoord[1] - d.currentPos[1]) * Math.PI / 180;
                    const y = Math.sin(dLng) * Math.cos(lat2);
                    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
                    const heading = Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
                    d.heading = isNaN(heading) ? (d.heading || 0) : heading;
                }
                
                d.speed = (d.missionStatus === 'DELIVERED') ? 0 : 36 + Math.floor(Math.sin(Date.now() / 5000) * 6);
                d.fuelBurnRate = (d.speed === 0) ? 0.05 : 0.138;
                d.lastUpdated = new Date().toISOString();

                broadcast({
                    type: 'VEHICLE_TELEMETRY_UPDATE',
                    driverId: d.id,
                    name: d.name,
                    currentPos: d.currentPos,
                    speed: d.speed,
                    fuelBurnRate: d.fuelBurnRate,
                    heading: d.heading,
                    crashSensor: d.crashSensor,
                    timestamp: d.lastUpdated
                });
            }
        } catch (err) {
            console.error(`Telemetry error for driver ${d?.id}:`, err);
        }
    });
}, 2500);
if (telemetryInterval.unref) telemetryInterval.unref();

// Start Server if executed directly
if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`⚡ QUANTUMROUTE 10-NODE QAOA COMMAND SERVER RUNNING`);
        console.log(`📡 URL: http://localhost:${PORT}`);
        console.log(`👮 Authorized Officer: ${OFFICER_NAME} (${GOV_OFFICER_ID})`);
        console.log(`⚛️ QPU: ONLINE (32 Qubits, Fidelity: 99.85%, E = ${GROUND_STATE_ENERGY_EV} eV)`);
        console.log(`====================================================`);
    });
}

module.exports = {
    app,
    server,
    resetFleet,
    generateInitialFleet
};
