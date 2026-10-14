/**
 * QUANTUMROUTE: CONFIGURATION & 6-NODE AP DISASTER RELIEF MASTER DATA
 * Optimized for High-Speed Live Presentation & National Quantum Mission Command
 */

const CONFIG = {
    APP_NAME: 'QuantumRoute: Disaster Relief & Emergency Logistics Command',
    MISSION: 'National Quantum Mission (NQM) - Disaster Logistics Grid',
    VERSION: '3.0.0-PROD',
    GOV_OFFICER_ID: 'GOV-TEJO-2026',
    OFFICER_NAME: 'Tejo Vardhan Chennupati',
    DEFAULT_TOKEN: 'QUANTUM-ALPHA-2026',
    BASE_LAT: 16.5062,
    BASE_LNG: 80.6480,
    CARBON_COEFF_PER_LITER: 2.68, // Liters * 2.68 kg CO2
    GROUND_STATE_ENERGY_EV: -29.04, // Qiskit QAOA ground-state Hamiltonian energy
    GATE_FIDELITY: 99.85,
    ACTIVE_QUBITS: 32,
    WS_URL: (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + (window.location.host || 'localhost:3000'),
    API_URL: window.location.origin.includes('http') ? window.location.origin + '/api' : 'http://localhost:3000/api',
    DEPOT_HUBS: [
        { code: 'HUB-VIJ-01', name: 'Krishna Central Depot (Prakasam Barrage)', lat: 16.5062, lng: 80.6480, capacity: 5000 },
        { code: 'HUB-BENZ-02', name: 'Benz Circle Logistics Staging', lat: 16.5019, lng: 80.6704, capacity: 3500 },
        { code: 'HUB-GOL-03', name: 'Gollapudi Flood Relief Depot', lat: 16.5152, lng: 80.5781, capacity: 4200 }
    ]
};

// 10 Distinct Disaster Rescue Nodes in Andhra Pradesh Sector
const RESCUE_LOCATIONS = [
    { 
        id: 1, 
        name: "Prakasam Barrage Flood Hub", 
        lat: 16.5062, 
        lng: 80.6480, 
        hazard: "Flood Lv 3 - Severe Surge", 
        color: "#ef4444", 
        rain: "45mm/h", 
        wind: "48 km/h", 
        icon: "fa-cloud-showers-heavy",
        description: "Primary Krishna river barrage barrier and flood evacuation staging hub."
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
        icon: "fa-triangle-exclamation",
        description: "Central medical triage camp and urgent pharmaceutical dispatch post."
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
        icon: "fa-cloud-sun",
        description: "High-capacity emergency shelter housing displaced families with dry transit."
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
        icon: "fa-wind",
        description: "Elevated relief distribution point managing storm supplies and water filtration."
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
        icon: "fa-water",
        description: "Submerged canal bridge checkpoint coordinating amphibious transport."
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
        icon: "fa-triangle-exclamation",
        description: "Major ration grain and fresh water supply consolidation depot."
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
        icon: "fa-bus",
        description: "Central transit interchange serving as public triage and triage sorting."
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
        icon: "fa-truck-medical",
        description: "Southern sector mobile trauma center and perimeter rescue depot."
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
        icon: "fa-wind",
        description: "Highway node maintaining supply corridor for heavy relief trailers."
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
        icon: "fa-check",
        description: "Heavy logistics, power generator repair, and boat trailer base."
    }
];

const RESCUE_LOCATIONS_6 = RESCUE_LOCATIONS; // Compatibility alias

// 10 Dedicated Field Drivers paired with the 10 Nodes
const INITIAL_DRIVERS = [
    { id: 1, name: "Rajesh", fullName: "Chennupati Rajesh", username: "DRIVER-RAJESH-01", nodeIndex: 0, job: "Food Supply", stock: 250, fuel: 24, hours: 45, salary: 35000 },
    { id: 2, name: "Suresh", fullName: "Suresh Kumar", username: "DRIVER-SURESH-02", nodeIndex: 1, job: "Medical Supplies", stock: 180, fuel: 21, hours: 42, salary: 36500 },
    { id: 3, name: "Kiran", fullName: "Kiran Teja", username: "DRIVER-KIRAN-03", nodeIndex: 2, job: "Shelter Kits", stock: 300, fuel: 28, hours: 38, salary: 34000 },
    { id: 4, name: "Ramesh", fullName: "Ramesh Varma", username: "DRIVER-RAMESH-04", nodeIndex: 3, job: "Human Rescue", stock: 150, fuel: 19, hours: 48, salary: 38000 },
    { id: 5, name: "Anil", fullName: "Anil Krishna", username: "DRIVER-ANIL-05", nodeIndex: 4, job: "Water Supply", stock: 220, fuel: 25, hours: 40, salary: 35500 },
    { id: 6, name: "Vijay", fullName: "Vijay Bhaskar", username: "DRIVER-VIJAY-06", nodeIndex: 5, job: "Food Hub Supplies", stock: 400, fuel: 32, hours: 44, salary: 37000 },
    { id: 7, name: "Karthik", fullName: "Karthik Raju", username: "DRIVER-KARTHIK-07", nodeIndex: 6, job: "Clothing Shelter", stock: 190, fuel: 22, hours: 39, salary: 34500 },
    { id: 8, name: "Manoj", fullName: "Manoj Varma", username: "DRIVER-MANOJ-08", nodeIndex: 7, job: "Medical Supplies", stock: 270, fuel: 26, hours: 43, salary: 36000 },
    { id: 9, name: "Rahul", fullName: "Rahul Chowdary", username: "DRIVER-RAHUL-09", nodeIndex: 8, job: "Power Units", stock: 210, fuel: 23, hours: 41, salary: 35000 },
    { id: 10, name: "Prasad", fullName: "Prasad Rao", username: "DRIVER-PRASAD-10", nodeIndex: 9, job: "Heavy Rescue", stock: 350, fuel: 30, hours: 46, salary: 37500 }
];

const INITIAL_DRIVERS_6 = INITIAL_DRIVERS; // Compatibility alias

function isRescueMission(role) {
    if (!role) return false;
    const lower = role.toLowerCase();
    return lower.includes('rescue') || lower.includes('evacuation');
}

// Generate the 10-driver fleet with turn-by-turn navigation waypoint trails
function generateDriverFleet() {
    return INITIAL_DRIVERS.map((d, index) => {
        const rescueNode = RESCUE_LOCATIONS[d.nodeIndex];
        const currentLat = rescueNode.lat;
        const currentLng = rescueNode.lng;
        
        // Target waypoint node offset for realistic Leaflet polyline
        const targetLat = Number((currentLat + 0.005 * ((index % 2 === 0) ? 1 : -1)).toFixed(6));
        const targetLng = Number((currentLng + 0.005 * ((index % 3 === 0) ? 1 : -1)).toFixed(6));
        const midLat = Number(((currentLat + targetLat) / 2 + 0.001).toFixed(6));
        const midLng = Number(((currentLng + targetLng) / 2 - 0.001).toFixed(6));

        const rescue = isRescueMission(d.job);

        return {
            id: d.id,
            name: d.name,
            fullName: d.fullName,
            username: d.username,
            passcode: '123456',
            job: d.job,
            isRescue: rescue,
            node: rescueNode.name,
            nodeLat: rescueNode.lat,
            nodeLng: rescueNode.lng,
            hazardLevel: rescueNode.hazard,
            hazardColor: rescueNode.color,
            rain: rescueNode.rain,
            wind: rescueNode.wind,
            weatherIcon: rescueNode.icon,
            stock: rescue ? 0 : d.stock,
            maxStock: rescue ? 0 : 500,
            fuel: d.fuel,
            hours: d.hours,
            salary: d.salary,
            deliveredTotal: 210 + (index * 35),
            currentPos: [currentLat, currentLng],
            targetPos: [targetLat, targetLng],
            polyline: [
                [currentLat, currentLng],
                [midLat, midLng],
                [targetLat, targetLng]
            ],
            navigationCues: [
                { instruction: `Depart ${rescueNode.name} staging bay`, distance: "0 m" },
                { instruction: "Turn right onto NH-16 Relief Transit Vector", distance: "450 m" },
                { instruction: "Maintain 35 km/h; bypass high-water depression on left", distance: "1.2 km" },
                { instruction: `Arrive at Target Node (Sector ${d.id}) Staging Post`, distance: "3.4 km" }
            ],
            isObstructed: false,
            crashSensor: {
                isCrashed: false,
                gForce: 1.0,
                tiltAngle: 0,
                lastTriggered: null
            },
            quantumMetrics: {
                hamiltonianEnergy: CONFIG.GROUND_STATE_ENERGY_EV,
                carbonSavedKg: Number((d.fuel * 0.28 * CONFIG.CARBON_COEFF_PER_LITER).toFixed(2)),
                distanceSavedKm: Number((d.fuel * 0.42).toFixed(1)),
                qaoaLayers: 4,
                optimalRouteFound: true
            },
            lastUpdated: new Date().toISOString()
        };
    });
}

function generate6DriverFleet() {
    return generateDriverFleet();
}
