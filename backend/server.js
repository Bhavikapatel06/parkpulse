require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const axios = require('axios');
const http = require('http');
const { Server } = require('socket.io');
const Violation = require('./models/Violation');
const xlsx = require('xlsx');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            callback(null, origin || '*');
        },
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
    }
});

// Allow frontend origin(s) from env; fallback to all origins for local dev
const ALLOWED_ORIGINS = [
    process.env.FRONTEND_URL,
    'https://parkpulse-smoky.vercel.app',  // production Vercel frontend
    'http://localhost:5173',               // Vite local dev
    'http://localhost:3000',               // alternate local dev
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Dynamically allow any origin to completely avoid CORS issues while supporting credentials
        callback(null, origin || '*');
    },
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Disable caching for all API responses
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Debug-Version', '1.0.1');
    next();
});

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000';

const upload = multer({ dest: 'uploads/' });

// Global System Logs Array (MVP implementation)
const systemLogs = [
    { timestamp: new Date(), level: 'INFO', message: 'System Initialized and Ready' }
];

let cachedRecommendations = null;

// ── Upload Session Tracking (polling-based, works through Vercel proxy) ──────
// sessionId -> { inserted, total, done, error, errorMsg, startTime }
const uploadSessions = new Map();

// Clean up sessions older than 15 minutes
setInterval(() => {
    const now = Date.now();
    for (const [id, data] of uploadSessions.entries()) {
        if (now - data.startTime > 15 * 60 * 1000) uploadSessions.delete(id);
    }
}, 60000);

// Poll endpoint — simple GET, works through Vercel proxy (unlike SSE)
app.get('/api/upload/status/:sessionId', (req, res) => {
    const sess = uploadSessions.get(req.params.sessionId);
    if (!sess) return res.json({ progress: 0, status: 'waiting', inserted: 0, total: 0 });

    const progress = sess.total > 0
        ? (sess.done ? 100 : Math.min(99, Math.floor((sess.inserted / sess.total) * 100)))
        : (sess.done ? 100 : 0);

    res.json({
        progress,
        inserted: sess.inserted,
        total: sess.total,
        status: sess.done ? 'done' : sess.error ? 'error' : 'uploading',
        errorMsg: sess.errorMsg || null
    });
});

// Simple logging middleware
app.use((req, res, next) => {
    if (req.method !== 'OPTIONS' && !req.path.includes('/api/admin/logs') && !req.path.includes('/api/heatmap') && !req.path.includes('/api/admin/recommendation-history') && !req.path.includes('/api/upload/status')) {
        systemLogs.unshift({ timestamp: new Date(), level: 'INFO', message: `${req.method} ${req.path} - Processing Request` });
        if (systemLogs.length > 200) systemLogs.length = 200;
    }
    next();
});

// Admin Endpoints
app.delete('/api/admin/dataset', async (req, res) => {
    try {
        await clearAndReclaimDB();
        systemLogs.unshift({ timestamp: new Date(), level: 'WARN', message: 'Admin permanently wiped violation database' });
        io.emit('data_deleted');
        res.json({ message: 'Dataset cleared' });
    } catch (err) {
        systemLogs.unshift({ timestamp: new Date(), level: 'ERROR', message: `Database wipe failed: ${err.message}` });
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/logs', (req, res) => {
    res.json(systemLogs);
});

app.get('/api/admin/recommendation-history', async (req, res) => {
    try {
        if (!cachedRecommendations) {
            const topAreas = await Violation.aggregate([
                { $group: { _id: "$police_station", count: { $sum: 1 }, latest: { $max: "$created_datetime" } } },
                { $sort: { latest: -1 } },
                { $limit: 10 }
            ]);
            cachedRecommendations = topAreas.map((area, i) => ({
                id: `REC-${String(i + 1).padStart(4, '0')}`,
                timestamp: area.latest || new Date(),
                location: area._id || 'Unknown',
                action: area.count > 50 ? 'Deploy 3 Marshals & Camera' : 'Issue Warning Signage',
                status: 'Pending'
            }));
        }
        res.json(cachedRecommendations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/recommendation-history/:id/status', (req, res) => {
    if (!cachedRecommendations) return res.status(404).json({ error: 'No recommendations found' });
    const { id } = req.params;
    const { status } = req.body;

    const rec = cachedRecommendations.find(r => r.id === id);
    if (rec) {
        rec.status = status;
        systemLogs.unshift({ timestamp: new Date(), level: 'INFO', message: `Admin marked task ${id} as ${status}` });
        if (systemLogs.length > 200) systemLogs.length = 200;
        res.json(rec);
    } else {
        res.status(404).json({ error: 'Recommendation not found' });
    }
});

// ── Event Simulator ────────────────────────────────────────────────────────────
// POST /api/simulate-event — insert 1 or more synthetic parking violations
app.post('/api/simulate-event', async (req, res) => {
    try {
        const {
            count = 1,
            police_station,
            vehicle_type,
            violation_type,
            validation_status,
            latitude,
            longitude
        } = req.body;

        const STATIONS = [
            'Andheri', 'Bandra', 'Borivali', 'Chembur', 'Colaba',
            'Dadar', 'Ghatkopar', 'Juhu', 'Kurla', 'Malad',
            'Mulund', 'Thane', 'Vile Parle', 'Worli', 'Powai'
        ];
        const VEHICLES = ['TWO WHEELER', 'FOUR WHEELER', 'AUTO', 'BUS', 'TRUCK', 'TEMPO'];
        const VIOLATIONS = [
            'No Parking', 'Wrong Side Parking', 'Footpath Parking',
            'Bus Stop Parking', 'Double Parking', 'Handicap Zone Parking',
            'Blocking Driveway', 'Tow Away Zone'
        ];
        const STATUSES = ['Approved', 'Rejected', 'Pending'];

        // Mumbai lat/lng bounding box
        const BASE_LAT = 19.076;
        const BASE_LNG = 72.877;

        const docs = [];
        const n = Math.min(Math.max(parseInt(count) || 1, 1), 100); // cap at 100 per call

        for (let i = 0; i < n; i++) {
            docs.push({
                latitude:  latitude  != null ? parseFloat(latitude)  : BASE_LAT + (Math.random() - 0.5) * 0.3,
                longitude: longitude != null ? parseFloat(longitude) : BASE_LNG + (Math.random() - 0.5) * 0.3,
                vehicle_type:      (vehicle_type  || VEHICLES[Math.floor(Math.random() * VEHICLES.length)]).toString().toUpperCase(),
                violation_type:     violation_type || VIOLATIONS[Math.floor(Math.random() * VIOLATIONS.length)],
                created_datetime:   new Date(),
                police_station:     police_station || STATIONS[Math.floor(Math.random() * STATIONS.length)],
                junction_name:      'Simulated Junction',
                validation_status:  validation_status || STATUSES[Math.floor(Math.random() * STATUSES.length)]
            });
        }

        await Violation.collection.insertMany(docs, { ordered: false });
        systemLogs.unshift({ timestamp: new Date(), level: 'INFO', message: `Event Simulator: inserted ${docs.length} synthetic violation(s)` });
        if (systemLogs.length > 200) systemLogs.length = 200;

        res.json({ message: `Simulated ${docs.length} event(s) successfully`, count: docs.length });
    } catch (err) {
        console.error('Simulate Event Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// MongoDB Connection with index creation
const MONGO_URI = process.env.MONGO_URI || 'mongodb://bhavikapatel4298_db_user:bhavikaparkpluse@ac-g0aegda-shard-00-00.5a0szq8.mongodb.net:27017,ac-g0aegda-shard-00-01.5a0szq8.mongodb.net:27017,ac-g0aegda-shard-00-02.5a0szq8.mongodb.net:27017/parkpulse?ssl=true&replicaSet=atlas-eb8704-shard-0&authSource=admin&appName=Cluster0';
mongoose.connect(MONGO_URI)
    .then(async () => {
        const dbName = mongoose.connection.db.databaseName;
        console.log(`MongoDB Connected to database: ${dbName}`);
        console.log(`MongoDB URI: ${MONGO_URI.startsWith('mongodb+srv') ? 'Atlas cluster' : MONGO_URI}`);
        systemLogs.unshift({ timestamp: new Date(), level: 'INFO', message: `MongoDB Connected to database: ${dbName}` });
        try {
            await Violation.collection.createIndex({ police_station: 1 });
            await Violation.collection.createIndex({ created_datetime: -1 });
            await Violation.collection.createIndex({ vehicle_type: 1 });
            await Violation.collection.createIndex({ validation_status: 1 });
            await Violation.collection.createIndex({ violation_type: 1 });
            await Violation.collection.createIndex({ police_station: 1, created_datetime: -1 });
            console.log('MongoDB Indexes created/verified');
        } catch (indexErr) {
            console.warn('Index creation warning:', indexErr.message);
        }
    })
    .catch(err => console.log('MongoDB Connection Error: ', err));

// Helper to drop collection and recreate indexes to reclaim Atlas storage space
async function clearAndReclaimDB() {
    try {
        await Violation.collection.drop();
    } catch (e) {
        if (e.code !== 26 && e.message !== 'ns not found') {
            throw e;
        }
    }
    await Violation.createIndexes();
    cachedRecommendations = null;
}

// Find matching key case-insensitively once per file
function findMatchingKey(data, possibleKeys) {
    if (!data) return null;
    const keys = Object.keys(data);
    for (const possibleKey of possibleKeys) {
        const match = keys.find(k => k.trim().toLowerCase() === possibleKey.toLowerCase());
        if (match) return match;
    }
    return null;
}

// Helper for flexible header matching
function getFieldValue(data, possibleKeys) {
    const keys = Object.keys(data);
    for (const possibleKey of possibleKeys) {
        const match = keys.find(k => k.trim().toLowerCase() === possibleKey.toLowerCase());
        if (match && data[match] !== undefined && data[match] !== null) {
            return data[match].toString().trim();
        }
    }
    return '';
}

// Helper to build MongoDB query based on request parameters
function buildFilterQuery(req) {
    const query = {};
    const { startDate, endDate, policeStation, vehicleType, violationType, riskLevel } = req.query;

    if (startDate || endDate) {
        query.created_datetime = {};
        if (startDate) query.created_datetime.$gte = new Date(startDate);
        if (endDate) query.created_datetime.$lte = new Date(endDate);
    }
    if (policeStation) query.police_station = policeStation;
    if (vehicleType) query.vehicle_type = vehicleType;
    if (violationType) query.violation_type = violationType;
    if (riskLevel) {
        if (riskLevel === 'Low') query.validation_status = 'Rejected';
        else if (riskLevel === 'Medium') query.validation_status = 'Pending';
        else if (riskLevel === 'High') query.validation_status = 'Approved';
        else query.validation_status = riskLevel;
    }
    return query;
}

// ── Upload Route — responds 202 immediately, processes in background ───────────
// This avoids Render's 30-second request timeout (which causes 502 on Vercel).
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const sessionId = req.query.sessionId || null;
    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const isExcel = originalName.toLowerCase().endsWith('.xlsx') || originalName.toLowerCase().endsWith('.xls');

    // Initialise session immediately so polling can start
    if (sessionId) {
        uploadSessions.set(sessionId, { inserted: 0, total: 0, done: false, error: false, errorMsg: null, startTime: Date.now() });
    }

    // Respond 202 right away — background processing continues
    res.status(202).json({ message: 'Upload received, processing in background', sessionId });

    // ── Background processing ────────────────────────────────────────────────
    (async () => {
        try {
            if (isExcel) {
                // Excel path
                const workbook = xlsx.readFile(filePath);
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const dataRows = xlsx.utils.sheet_to_json(worksheet);

                if (sessionId) uploadSessions.get(sessionId).total = dataRows.length;

                const results = [];
                let headerMapping = null;
                for (const data of dataRows) {
                    if (!headerMapping) {
                        headerMapping = {
                            latKey:     findMatchingKey(data, ['latitude', 'lat', 'lat_deg', 'y']),
                            lngKey:     findMatchingKey(data, ['longitude', 'lng', 'lon', 'lon_deg', 'x']),
                            statusKey:  findMatchingKey(data, ['validation_status', 'status', 'validation']),
                            typeKey:    findMatchingKey(data, ['violation_type', 'violation', 'offence_type', 'offence']),
                            vehicleKey: findMatchingKey(data, ['vehicle_type', 'vehicle', 'vehicle_category', 'type']),
                            dateKey:    findMatchingKey(data, ['created_datetime', 'date', 'time', 'datetime', 'timestamp']),
                            stationKey: findMatchingKey(data, ['police_station', 'station', 'area', 'location', 'police']),
                            junctionKey:findMatchingKey(data, ['junction_name', 'junction', 'crossroad'])
                        };
                    }

                    const latStr = headerMapping.latKey ? data[headerMapping.latKey] : '';
                    const lngStr = headerMapping.lngKey ? data[headerMapping.lngKey] : '';
                    if (!latStr || !lngStr) continue;

                    const latitude  = parseFloat(latStr);
                    const longitude = parseFloat(lngStr);
                    if (isNaN(latitude) || isNaN(longitude)) continue;

                    let v_status = (headerMapping.statusKey ? data[headerMapping.statusKey] : '') || 'Pending';
                    if (typeof v_status === 'string') {
                        v_status = (!v_status || v_status.toLowerCase() === 'null') ? 'Pending'
                            : v_status.charAt(0).toUpperCase() + v_status.slice(1).toLowerCase();
                    } else {
                        v_status = v_status != null ? v_status.toString() : 'Pending';
                    }

                    let v_type = (headerMapping.typeKey ? data[headerMapping.typeKey] : '') || 'Unknown';
                    if (typeof v_type === 'string' && v_type.startsWith('[')) {
                        try { v_type = JSON.parse(v_type)[0] || 'Unknown'; } catch (_) {}
                    }

                    results.push({
                        latitude,
                        longitude,
                        vehicle_type:      String((headerMapping.vehicleKey ? data[headerMapping.vehicleKey] : '') || 'Unknown').trim().toUpperCase(),
                        violation_type:    String(v_type),
                        created_datetime:  (() => { if (!headerMapping.dateKey || !data[headerMapping.dateKey]) return new Date(); const d = new Date(data[headerMapping.dateKey]); return isNaN(d.getTime()) ? new Date() : d; })(),
                        police_station:    String((headerMapping.stationKey ? data[headerMapping.stationKey] : '') || 'Unknown'),
                        junction_name:     String((headerMapping.junctionKey ? data[headerMapping.junctionKey] : '') || 'Unknown'),
                        validation_status: v_status
                    });
                }

                await clearAndReclaimDB();
                const chunkSize = 5000;
                let inserted = 0;
                for (let i = 0; i < results.length; i += chunkSize) {
                    await Violation.collection.insertMany(results.slice(i, i + chunkSize), { ordered: false });
                    inserted += Math.min(chunkSize, results.length - i);
                    if (sessionId) { const s = uploadSessions.get(sessionId); if (s) { s.inserted = inserted; } }
                    io.emit('upload_progress', { sessionId, inserted, total: results.length });
                }
                if (sessionId) { const s = uploadSessions.get(sessionId); if (s) { s.inserted = results.length; s.total = results.length; s.done = true; } }
                io.emit('data_updated');
                systemLogs.unshift({ timestamp: new Date(), level: 'INFO', message: `Excel upload complete: ${results.length} records inserted` });

            } else {
                // CSV path — stream-based, memory efficient
                // First pass: count lines for progress
                let estimatedTotal = 0;
                try {
                    const cs = fs.createReadStream(filePath);
                    let count = 0;
                    for await (const chunk of cs) {
                        for (let i = 0; i < chunk.length; i++) { if (chunk[i] === 10) count++; }
                    }
                    estimatedTotal = count > 0 ? count - 1 : 0;
                } catch (_) { estimatedTotal = 0; }

                if (sessionId) { const s = uploadSessions.get(sessionId); if (s) s.total = estimatedTotal; }

                await clearAndReclaimDB();

                let totalCount = 0;
                let currentBatch = [];
                const batchSize = 10000;
                const parser = fs.createReadStream(filePath).pipe(csv());
                let headerMapping = null;

                for await (const data of parser) {
                    if (!headerMapping) {
                        headerMapping = {
                            latKey:     findMatchingKey(data, ['latitude', 'lat', 'lat_deg', 'y']),
                            lngKey:     findMatchingKey(data, ['longitude', 'lng', 'lon', 'lon_deg', 'x']),
                            statusKey:  findMatchingKey(data, ['validation_status', 'status', 'validation']),
                            typeKey:    findMatchingKey(data, ['violation_type', 'violation', 'offence_type', 'offence']),
                            vehicleKey: findMatchingKey(data, ['vehicle_type', 'vehicle', 'vehicle_category', 'type']),
                            dateKey:    findMatchingKey(data, ['created_datetime', 'date', 'time', 'datetime', 'timestamp']),
                            stationKey: findMatchingKey(data, ['police_station', 'station', 'area', 'location', 'police']),
                            junctionKey:findMatchingKey(data, ['junction_name', 'junction', 'crossroad'])
                        };
                    }

                    const latStr = headerMapping.latKey ? data[headerMapping.latKey] : '';
                    const lngStr = headerMapping.lngKey ? data[headerMapping.lngKey] : '';
                    if (!latStr || !lngStr) continue;

                    const latitude  = parseFloat(latStr);
                    const longitude = parseFloat(lngStr);
                    if (isNaN(latitude) || isNaN(longitude)) continue;

                    let v_status = (headerMapping.statusKey ? data[headerMapping.statusKey] : '') || 'Pending';
                    if (typeof v_status === 'string') {
                        v_status = (!v_status || v_status.toLowerCase() === 'null') ? 'Pending'
                            : v_status.charAt(0).toUpperCase() + v_status.slice(1).toLowerCase();
                    } else {
                        v_status = v_status != null ? v_status.toString() : 'Pending';
                    }

                    let v_type = (headerMapping.typeKey ? data[headerMapping.typeKey] : '') || 'Unknown';
                    if (typeof v_type === 'string' && v_type.startsWith('[')) {
                        try { v_type = JSON.parse(v_type)[0] || 'Unknown'; } catch (_) {}
                    }

                    currentBatch.push({
                        latitude,
                        longitude,
                        vehicle_type:      String((headerMapping.vehicleKey ? data[headerMapping.vehicleKey] : '') || 'Unknown').trim().toUpperCase(),
                        violation_type:    String(v_type),
                        created_datetime:  (() => { if (!headerMapping.dateKey || !data[headerMapping.dateKey]) return new Date(); const d = new Date(data[headerMapping.dateKey]); return isNaN(d.getTime()) ? new Date() : d; })(),
                        police_station:    String((headerMapping.stationKey ? data[headerMapping.stationKey] : '') || 'Unknown'),
                        junction_name:     String((headerMapping.junctionKey ? data[headerMapping.junctionKey] : '') || 'Unknown'),
                        validation_status: v_status
                    });
                    totalCount++;

                    if (currentBatch.length >= batchSize) {
                        try {
                            await Violation.collection.insertMany(currentBatch, { ordered: false });
                        } catch (e) { console.error('Batch insert error:', e.message); }
                        currentBatch = [];
                        if (sessionId) { const s = uploadSessions.get(sessionId); if (s) s.inserted = totalCount; }
                        io.emit('upload_progress', { sessionId, inserted: totalCount, total: estimatedTotal });
                    }
                }

                // Insert remaining records
                if (currentBatch.length > 0) {
                    try {
                        await Violation.collection.insertMany(currentBatch, { ordered: false });
                    } catch (e) { console.error('Final batch insert error:', e.message); }
                }

                if (sessionId) { const s = uploadSessions.get(sessionId); if (s) { s.inserted = totalCount; s.total = totalCount; s.done = true; } }
                io.emit('data_updated');
                systemLogs.unshift({ timestamp: new Date(), level: 'INFO', message: `CSV upload complete: ${totalCount} records inserted` });
            }

        } catch (err) {
            console.error('Background Upload Error:', err);
            systemLogs.unshift({ timestamp: new Date(), level: 'ERROR', message: `Upload processing error: ${err.message}` });
            if (sessionId) { const s = uploadSessions.get(sessionId); if (s) { s.error = true; s.errorMsg = err.message; s.done = true; } }
        } finally {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
    })();
});

app.get('/api/violations', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const search = req.query.search || '';
        const skip = (page - 1) * limit;

        const filter = buildFilterQuery(req);
        
        if (search) {
            filter.$or = [
                { police_station: { $regex: search, $options: 'i' } },
                { vehicle_type: { $regex: search, $options: 'i' } },
                { violation_type: { $regex: search, $options: 'i' } },
                { validation_status: { $regex: search, $options: 'i' } }
            ];
        }

        const totalRecords = await Violation.countDocuments(filter);
        const records = await Violation.find(filter)
            .sort({ created_datetime: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.json({
            records,
            totalRecords,
            totalPages: Math.ceil(totalRecords / limit),
            currentPage: page
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/dashboard', async (req, res) => {
    try {
        const filter = buildFilterQuery(req);

        const statsAgg = await Violation.aggregate([
            { $match: filter },
            {
                $facet: {
                    byStatus:  [{ $group: { _id: '$validation_status', count: { $sum: 1 } } }],
                    byStation: [{ $group: { _id: '$police_station', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
                    total:     [{ $count: 'count' }]
                }
            }
        ]);

        const result   = statsAgg[0] || { byStatus: [], byStation: [], total: [] };
        const byStatus  = result.byStatus || [];
        const byStation = result.byStation || [];
        const total     = result.total[0]?.count ?? 0;

        let approved = 0, rejected = 0, pending = 0;
        byStatus.forEach(({ _id, count }) => {
            const id = (_id || '').trim().toLowerCase();
            if (id === 'approved')      approved += (count || 0);
            else if (id === 'rejected') rejected += (count || 0);
            else if (id === 'pending')  pending  += (count || 0);
        });

        const highestRiskArea = byStation.length > 0 && byStation[0]._id ? byStation[0]._id : 'Unknown';

        const hotspotsFilter = { ...filter };
        if (hotspotsFilter.validation_status) delete hotspotsFilter.validation_status;

        const totalViolationsForHotspots = await Violation.countDocuments(hotspotsFilter);
        let activeHotspots = 0;

        if (totalViolationsForHotspots > 0) {
            const hotspotsAgg = await Violation.aggregate([
                { $match: hotspotsFilter },
                { $group: { _id: "$police_station", count: { $sum: 1 } } }
            ]);
            const reqRiskLevel = req.query.riskLevel;
            hotspotsAgg.forEach(group => {
                if (group.count >= 5) {
                    const percentage = (group.count / totalViolationsForHotspots) * 100;
                    let risk_level = 'Low';
                    if (percentage >= 15) risk_level = 'Critical';
                    else if (percentage >= 8) risk_level = 'High';
                    else if (percentage >= 3) risk_level = 'Moderate';

                    let matchesRisk = true;
                    if (reqRiskLevel) {
                        const sl = reqRiskLevel.toLowerCase();
                        const hl = risk_level.toLowerCase();
                        if (sl === 'low') matchesRisk = hl === 'low';
                        else if (sl === 'medium' || sl === 'moderate') matchesRisk = hl === 'moderate';
                        else if (sl === 'high' || sl === 'critical') matchesRisk = hl === 'high' || hl === 'critical';
                    }
                    if (matchesRisk) activeHotspots++;
                }
            });
        }

        res.json({ totalViolations: total, approvedViolations: approved, rejectedViolations: rejected, pendingViolations: pending, activeHotspots, highestRiskArea });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/heatmap', async (req, res) => {
    try {
        const filter = buildFilterQuery(req);
        const violations = await Violation.find(filter, 'latitude longitude validation_status')
            .sort({ created_datetime: -1 })
            .limit(15000)
            .lean();
        res.json(violations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/hotspots', async (req, res) => {
    try {
        const filter = buildFilterQuery(req);
        if (filter.validation_status) delete filter.validation_status;

        // Try calling the Python AI Service first for advanced DBSCAN clustering
        try {
            const locations = await Violation.find(filter, 'latitude longitude police_station')
                .sort({ created_datetime: -1 })
                .limit(15000)
                .lean();
            const locationsData = locations.map(l => ({ lat: l.latitude, lng: l.longitude, area: l.police_station || 'Unknown' }));
            
            const aiRes = await axios.post(`${AI_SERVICE_URL}/api/hotspots`, { locations: locationsData }, { timeout: 30000 });
            let finalHotspots = aiRes.data.hotspots || [];

            // Filter by risk level if requested
            const reqRiskLevel = req.query.riskLevel;
            if (reqRiskLevel) {
                const sl = reqRiskLevel.toLowerCase();
                finalHotspots = finalHotspots.filter(h => {
                    const hl = (h.risk_level || '').toLowerCase();
                    if (sl === 'low') return hl === 'low';
                    if (sl === 'medium' || sl === 'moderate') return hl === 'moderate';
                    if (sl === 'high' || sl === 'critical') return hl === 'high' || hl === 'critical';
                    return true;
                });
            }
            return res.json({ hotspots: finalHotspots });

        } catch (aiErr) {
            console.warn("AI Service Hotspots failed, falling back to basic aggregation:", aiErr.message);
            // Fallback to basic aggregation if AI service is down
            const totalViolations = await Violation.countDocuments(filter);
            if (totalViolations === 0) return res.json({ hotspots: [] });

            const hotspotsAgg = await Violation.aggregate([
                { $match: filter },
                { $group: { _id: "$police_station", count: { $sum: 1 }, lat: { $avg: "$latitude" }, lng: { $avg: "$longitude" } } }
            ]);

            const hotspots = [];
            let idCounter = 1;
            hotspotsAgg.forEach(group => {
                if (group.count >= 5) {
                    const percentage = (group.count / totalViolations) * 100;
                    let risk_level = 'Low';
                    if (percentage >= 15) risk_level = 'Critical';
                    else if (percentage >= 8) risk_level = 'High';
                    else if (percentage >= 3) risk_level = 'Moderate';

                    hotspots.push({
                        id: idCounter++,
                        lat: group.lat,
                        lng: group.lng,
                        count: group.count,
                        area: group._id || 'Unknown',
                        risk_level,
                        risk_score: Math.min(100, Math.max(10, Math.floor(percentage * 4)))
                    });
                }
            });

            let finalHotspots = hotspots;
            const reqRiskLevel = req.query.riskLevel;
            if (reqRiskLevel) {
                const sl = reqRiskLevel.toLowerCase();
                finalHotspots = hotspots.filter(h => {
                    const hl = h.risk_level.toLowerCase();
                    if (sl === 'low') return hl === 'low';
                    if (sl === 'medium' || sl === 'moderate') return hl === 'moderate';
                    if (sl === 'high' || sl === 'critical') return hl === 'high' || hl === 'critical';
                    return true;
                });
            }

            finalHotspots.sort((a, b) => b.count - a.count);
            return res.json({ hotspots: finalHotspots });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/recommendations', async (req, res) => {
    try {
        const filter = buildFilterQuery(req);
        const topAreas = await Violation.aggregate([
            { $match: filter },
            { $group: { _id: "$police_station", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 6 }
        ]);
        const total = await Violation.countDocuments(filter);
        const recommendations = topAreas.map((area) => {
            const location = area._id || 'Unknown Region';
            const risk = Math.min(100, Math.max(30, Math.floor((area.count / (total || 1)) * 500) + 60));
            let recText;
            if (risk > 90) recText = `Critical density: ${area.count} violations detected! Deploy 3-4 traffic marshals immediately and consider automated enforcement cameras.`;
            else if (risk > 75) recText = `High violation rate (${area.count} total). Increase patrol frequency during known peak hours to deter illegal parking.`;
            else recText = `Moderate risk with ${area.count} total violations. Review current parking signage visibility and consider setting up temporary barricades.`;
            return { location, risk, recommendation: recText };
        });
        res.json(recommendations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/analytics', async (req, res) => {
    try {
        const filter = buildFilterQuery(req);
        const [byVehicleType, byArea] = await Promise.all([
            Violation.aggregate([{ $match: filter }, { $group: { _id: "$vehicle_type", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
            Violation.aggregate([{ $match: filter }, { $group: { _id: "$police_station", count: { $sum: 1 } } }, { $sort: { count: -1 } }])
        ]);
        res.json({
            byVehicleType: byVehicleType.map(x => ({ name: x._id, value: x.count })),
            byArea: byArea.map(x => ({ name: x._id, value: x.count }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Congestion Prediction endpoint
app.post('/api/predict', async (req, res) => {
    try {
        const { location, vehicleType, hour, dayOfWeek } = req.body;
        const targetLoc = location || 'Unknown';
        const targetVeh = vehicleType || 'Unknown';
        const targetHour = hour !== undefined && hour !== null ? parseInt(hour) : 12;
        const targetDay  = dayOfWeek !== undefined && dayOfWeek !== null ? parseInt(dayOfWeek) : 1;

        try {
            // Fetch history data for AI service
            const historyAgg = await Violation.aggregate([
                { $project: {
                    location: "$police_station",
                    vehicle_type: "$vehicle_type",
                    hour: { $hour: { date: "$created_datetime", timezone: "Asia/Kolkata" } },
                    day_of_week: { $dayOfWeek: { date: "$created_datetime", timezone: "Asia/Kolkata" } }
                }},
                { $group: {
                    _id: { location: "$location", vehicle_type: "$vehicle_type", hour: "$hour", day_of_week: "$day_of_week" },
                    count: { $sum: 1 }
                }}
            ]);
            
            const history = historyAgg.map(h => ({
                location: h._id.location || 'Unknown',
                vehicle_type: h._id.vehicle_type || 'Unknown',
                hour: h._id.hour,
                day_of_week: h._id.day_of_week - 1, // Convert 1-7 (Sun-Sat) to 0-6
                count: h.count
            }));

            const aiRes = await axios.post(`${AI_SERVICE_URL}/api/predict`, {
                history,
                target: { location: targetLoc, vehicle_type: targetVeh, hour: targetHour, day_of_week: targetDay }
            }, { timeout: 60000 });

            return res.json(aiRes.data);
            
        } catch (aiErr) {
            console.warn("AI Service Prediction failed, falling back to simulated prediction:", aiErr.message);
            // Fallback to basic prediction logic if AI is unreachable
            const [overallHotspots, targetLocStats] = await Promise.all([
                Violation.aggregate([
                    { $match: { vehicle_type: { $regex: new RegExp(`^${targetVeh}$`, 'i') } } },
                    { $group: { _id: "$police_station", count: { $sum: 1 } } }
                ]),
                Violation.aggregate([
                    { $match: { police_station: { $regex: new RegExp(`^${targetLoc}$`, 'i') }, vehicle_type: { $regex: new RegExp(`^${targetVeh}$`, 'i') } } },
                    { $project: { hour: { $hour: { date: "$created_datetime", timezone: "Asia/Kolkata" } }, day_of_week: { $dayOfWeek: { date: "$created_datetime", timezone: "Asia/Kolkata" } } } },
                    { $group: { _id: { hour: "$hour", day_of_week: "$day_of_week" }, count: { $sum: 1 } } }
                ])
            ]);

            let totalCount = 0;
            const futureHotspotsMap = {};
            overallHotspots.forEach(h => { totalCount += h.count; futureHotspotsMap[h._id || 'Unknown'] = h.count; });

            const locHourCounts = new Array(24).fill(0);
            const locDayCounts  = new Array(7).fill(0);
            targetLocStats.forEach(s => {
                const h = s._id.hour;
                const d = s._id.day_of_week - 1;
                if (h >= 0 && h < 24) locHourCounts[h] += s.count;
                if (d >= 0 && d < 7)  locDayCounts[d]  += s.count;
            });

            const maxHourCount = Math.max(...locHourCounts, 1);
            const maxDayCount  = Math.max(...locDayCounts, 1);

            const hourly_forecast = [];
            for (let i = 0; i < 24; i++) {
                const isPeak = (i >= 8 && i <= 10) || (i >= 17 && i <= 19);
                const historicalWeight = (locHourCounts[i] / maxHourCount) * 50;
                const syntheticWeight  = isPeak ? 35 : (i >= 22 || i <= 5 ? 5 : 20);
                let risk = Math.round(historicalWeight + syntheticWeight + (Math.random() * 5));
                risk = Math.min(100, Math.max(10, risk));
                hourly_forecast.push({ hour: `${i.toString().padStart(2, '0')}:00`, risk });
            }

            const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const weekly_trend = [];
            for (let i = 0; i < 7; i++) {
                const isWeekend = i === 0 || i === 6;
                const historicalWeight = (locDayCounts[i] / maxDayCount) * 60;
                const syntheticWeight  = isWeekend ? 15 : 35;
                let risk = Math.round(historicalWeight + syntheticWeight + (Math.random() * 5));
                risk = Math.min(100, Math.max(10, risk));
                weekly_trend.push({ day: DAYS[i], risk });
            }

            const tomorrowDay  = (targetDay + 1) % 7;
            const tomorrow_risk   = Math.min(100, Math.max(10, weekly_trend[tomorrowDay].risk + Math.floor(Math.random() * 10) - 5));
            const next_week_risk  = weekly_trend[targetDay].risk;

            const future_hotspots = Object.keys(futureHotspotsMap)
                .map(loc => ({
                    area: loc,
                    risk: Math.min(100, Math.max(15, Math.round((futureHotspotsMap[loc] / (totalCount || 1)) * 100 * 4 + 20 + Math.random() * 10)))
                }))
                .sort((a, b) => b.risk - a.risk)
                .slice(0, 5);

            return res.json({ tomorrow_risk, next_week_risk, hourly_forecast, weekly_trend, future_hotspots });
        }
    } catch (err) {
        console.error("Prediction Error: ", err.message);
        res.status(500).json({ error: err.message });
    }
});

// CSV Export endpoint
app.get('/api/export/csv', async (req, res) => {
    try {
        const filter = buildFilterQuery(req);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=violations_export.csv');
        res.write('id,latitude,longitude,vehicle_type,violation_type,created_datetime,police_station,junction_name,validation_status\n');
        const cursor = Violation.find(filter).lean().cursor();
        for await (const v of cursor) {
            const row = `${v._id},${v.latitude},${v.longitude},"${(v.vehicle_type||'Unknown').replace(/"/g,'""')}","${(v.violation_type||'Unknown').replace(/"/g,'""')}",${v.created_datetime?v.created_datetime.toISOString():''},"${(v.police_station||'Unknown').replace(/"/g,'""')}","${(v.junction_name||'Unknown').replace(/"/g,'""')}","${v.validation_status||'Pending'}"\n`;
            res.write(row);
        }
        res.end();
    } catch (err) {
        console.error('CSV Export Error:', err);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});

// GET unique metadata
app.get('/api/meta', async (req, res) => {
    try {
        const [policeStations, vehicleTypes, violationTypes] = await Promise.all([
            Violation.aggregate([{ $group: { _id: "$police_station" } }]),
            Violation.aggregate([{ $group: { _id: "$vehicle_type" } }]),
            Violation.aggregate([{ $group: { _id: "$violation_type" } }])
        ]);
        res.json({
            policeStations: policeStations.map(p => p._id).filter(Boolean),
            vehicleTypes:   vehicleTypes.map(v => v._id).filter(Boolean),
            violationTypes: violationTypes.map(v => v._id).filter(Boolean)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
