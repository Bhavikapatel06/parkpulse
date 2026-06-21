require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const axios = require('axios');
const Violation = require('./models/Violation');
const xlsx = require('xlsx');

const app = express();

// Allow frontend origin from env; fallback to all origins for local dev
const allowedOrigin = process.env.FRONTEND_URL || '*';
app.use(cors({
    origin: allowedOrigin === '*' ? '*' : [allowedOrigin],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000';

const upload = multer({ dest: 'uploads/' });

// Global System Logs Array (MVP implementation)
const systemLogs = [
    { timestamp: new Date(), level: 'INFO', message: 'System Initialized and Ready' }
];

let cachedRecommendations = null;

// Simple logging middleware
app.use((req, res, next) => {
    if (req.method !== 'OPTIONS' && !req.path.includes('/api/admin/logs') && !req.path.includes('/api/heatmap') && !req.path.includes('/api/admin/recommendation-history')) {
        systemLogs.unshift({ timestamp: new Date(), level: 'INFO', message: `${req.method} ${req.path} - Processing Request` });
        if (systemLogs.length > 200) systemLogs.length = 200; // keep last 200 logs
    }
    next();
});

// Admin Endpoints
app.delete('/api/admin/dataset', async (req, res) => {
    try {
        await Violation.deleteMany({});
        cachedRecommendations = null; // Reset cache
        systemLogs.unshift({ timestamp: new Date(), level: 'WARN', message: 'Admin permanently wiped violation database' });
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
            // Generate mock history dynamically from current database only once
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

// MongoDB Connection with index creation
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/parkpulse')
    .then(async () => {
        console.log('MongoDB Connected');
        // Create indexes for fast aggregation queries
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
    if (policeStation) {
        query.police_station = policeStation;
    }
    if (vehicleType) {
        query.vehicle_type = vehicleType;
    }
    if (violationType) {
        query.violation_type = violationType;
    }
    if (riskLevel) {
        // Map risk levels (Low, Medium, High) to database validation statuses
        if (riskLevel === 'Low') {
            query.validation_status = 'Rejected';
        } else if (riskLevel === 'Medium') {
            query.validation_status = 'Pending';
        } else if (riskLevel === 'High') {
            query.validation_status = 'Approved';
        } else {
            query.validation_status = riskLevel;
        }
    }
    return query;
}

// Routes
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');

    const results = [];
    // Only parse as Excel if the file extension is literally .xlsx or .xls (fixes Windows CSV MIME type conflict)
    const isExcel = req.file.originalname.toLowerCase().endsWith('.xlsx') || req.file.originalname.toLowerCase().endsWith('.xls');

    if (isExcel) {
        try {
            const workbook = xlsx.readFile(req.file.path);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const dataRows = xlsx.utils.sheet_to_json(worksheet);

            for (const data of dataRows) {
                const latStr = getFieldValue(data, ['latitude', 'lat', 'lat_deg', 'y']);
                const lngStr = getFieldValue(data, ['longitude', 'lng', 'lon', 'lon_deg', 'x']);

                if (latStr && lngStr) {
                    const latitude = parseFloat(latStr);
                    const longitude = parseFloat(lngStr);

                    if (!isNaN(latitude) && !isNaN(longitude)) {
                        let v_status = getFieldValue(data, ['validation_status', 'status', 'validation']);
                        if (!v_status || v_status.toLowerCase() === 'null' || v_status === '') {
                            v_status = 'Pending';
                        }
                        v_status = v_status.charAt(0).toUpperCase() + v_status.slice(1).toLowerCase();

                        let v_type = getFieldValue(data, ['violation_type', 'violation', 'offence_type', 'offence']) || 'Unknown';
                        if (v_type.startsWith('[')) {
                            try {
                                const parsed = JSON.parse(v_type);
                                v_type = parsed[0] || 'Unknown';
                            } catch (e) { }
                        }

                        const vehicle_type = (getFieldValue(data, ['vehicle_type', 'vehicle', 'vehicle_category', 'type']) || 'Unknown').trim().toUpperCase();
                        const created_datetime_str = getFieldValue(data, ['created_datetime', 'date', 'time', 'datetime', 'timestamp']);
                        const police_station = getFieldValue(data, ['police_station', 'station', 'area', 'location', 'police']) || 'Unknown';
                        const junction_name = getFieldValue(data, ['junction_name', 'junction', 'crossroad']) || 'Unknown';

                        results.push({
                            latitude,
                            longitude,
                            vehicle_type,
                            violation_type: v_type,
                            created_datetime: (() => {
                                if (!created_datetime_str) return new Date();
                                const d = new Date(created_datetime_str);
                                return isNaN(d.getTime()) ? new Date() : d;
                            })(),
                            police_station,
                            junction_name,
                            validation_status: v_status
                        });
                    }
                }
            }

            if (results.length > 0) {
                // IMPORTANT: Delete BEFORE inserting. If delete fails, abort entirely.
                try {
                    await Violation.deleteMany({});
                    cachedRecommendations = null;
                } catch (deleteErr) {
                    console.error('Failed to clear DB before Excel upload:', deleteErr.message);
                    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                    return res.status(500).json({
                        error: 'Could not clear existing data. Upload aborted to prevent data duplication.'
                    });
                }
                const chunkSize = 5000;
                for (let i = 0; i < results.length; i += chunkSize) {
                    const chunk = results.slice(i, i + chunkSize);
                    await Violation.collection.insertMany(chunk, { ordered: false });
                }
            }
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            res.status(200).json({ message: 'Upload successful', count: results.length });
        } catch (err) {
            console.error("Excel Upload Error: ", err);
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            res.status(500).json({ error: err.message });
        }
    } else {
        // ── CSV Upload Path ──────────────────────────────────────────────────────
        // IMPORTANT: Delete BEFORE inserting. If delete fails, abort entirely
        // so we never append new data on top of stale old data.
        try {
            await Violation.deleteMany({});
            cachedRecommendations = null;
        } catch (e) {
            console.error('Failed to clear DB before CSV upload:', e.message);
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(500).json({
                error: 'Could not clear existing data before import. Upload aborted to prevent data duplication.'
            });
        }

        let totalCount = 0;
        const batchSize = 10000;
        let currentBatch = [];

        try {
            const parser = fs.createReadStream(req.file.path).pipe(csv());

            for await (const data of parser) {
                const latStr = getFieldValue(data, ['latitude', 'lat', 'lat_deg', 'y']);
                const lngStr = getFieldValue(data, ['longitude', 'lng', 'lon', 'lon_deg', 'x']);

                if (latStr && lngStr) {
                    const latitude = parseFloat(latStr);
                    const longitude = parseFloat(lngStr);

                    if (!isNaN(latitude) && !isNaN(longitude)) {
                        let v_status = getFieldValue(data, ['validation_status', 'status', 'validation']);
                        if (!v_status || v_status.toLowerCase() === 'null' || v_status === '') {
                            v_status = 'Pending';
                        }
                        v_status = v_status.charAt(0).toUpperCase() + v_status.slice(1).toLowerCase();

                        let v_type = getFieldValue(data, ['violation_type', 'violation', 'offence_type', 'offence']) || 'Unknown';
                        if (v_type.startsWith('[')) {
                            try {
                                const parsed = JSON.parse(v_type);
                                v_type = parsed[0] || 'Unknown';
                            } catch (e) { }
                        }

                        const vehicle_type = (getFieldValue(data, ['vehicle_type', 'vehicle', 'vehicle_category', 'type']) || 'Unknown').trim().toUpperCase();
                        const created_datetime_str = getFieldValue(data, ['created_datetime', 'date', 'time', 'datetime', 'timestamp']);
                        const police_station = getFieldValue(data, ['police_station', 'station', 'area', 'location', 'police']) || 'Unknown';
                        const junction_name = getFieldValue(data, ['junction_name', 'junction', 'crossroad']) || 'Unknown';

                        currentBatch.push({
                            latitude,
                            longitude,
                            vehicle_type,
                            violation_type: v_type,
                            created_datetime: (() => {
                                if (!created_datetime_str) return new Date();
                                const d = new Date(created_datetime_str);
                                return isNaN(d.getTime()) ? new Date() : d;
                            })(),
                            police_station,
                            junction_name,
                            validation_status: v_status
                        });

                        totalCount++;

                        if (currentBatch.length >= batchSize) {
                            try {
                                await Violation.collection.insertMany(currentBatch, { ordered: false });
                            } catch (err) {
                                console.error("Chunk Insert Error:", err.message);
                            }
                            currentBatch = []; // reset batch after insert
                        }
                    }
                }
            }

            // Insert remaining
            if (currentBatch.length > 0) {
                try {
                    await Violation.collection.insertMany(currentBatch, { ordered: false });
                } catch (err) {
                    console.error("Final Chunk Insert Error:", err.message);
                }
            }

            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            res.status(200).json({ message: 'Upload successful', count: totalCount });

        } catch (err) {
            console.error("CSV Parse/Upload Error: ", err);
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            res.status(500).json({ error: err.message });
        }
    }
});

app.get('/api/dashboard', async (req, res) => {
    try {
        const filter = buildFilterQuery(req);

        // Single aggregation with $facet for all stats in one DB round-trip
        const statsAgg = await Violation.aggregate([
            { $match: filter },
            {
                $facet: {
                    byStatus: [
                        { $group: { _id: '$validation_status', count: { $sum: 1 } } }
                    ],
                    byStation: [
                        { $group: { _id: '$police_station', count: { $sum: 1 } } },
                        { $sort: { count: -1 } }
                    ],
                    total: [
                        { $count: 'count' }
                    ]
                }
            }
        ]);

        const result   = statsAgg[0] || { byStatus: [], byStation: [], total: [] };
        const byStatus = result.byStatus || [];
        const byStation = result.byStation || [];

        // $count is the ground truth for the total number of documents
        const total = result.total[0]?.count ?? 0;

        let approved = 0;
        let rejected = 0;
        let pending  = 0;

        byStatus.forEach(({ _id, count }) => {
            const id = (_id || '').trim().toLowerCase();
            if (id === 'approved')       approved += (count || 0);
            else if (id === 'rejected')  rejected += (count || 0);
            else if (id === 'pending')   pending  += (count || 0);
            // any other status values (e.g. 'valid', 'invalid', empty) are
            // silently absorbed into the total — they won't skew the 3 known buckets
        });

        const highestRiskArea = byStation.length > 0 && byStation[0]._id
            ? byStation[0]._id
            : 'Unknown';

        // Calculate active hotspots count using the exact same logic as /api/hotspots
        const hotspotsFilter = { ...filter };
        if (hotspotsFilter.validation_status) {
            delete hotspotsFilter.validation_status;
        }

        const totalViolationsForHotspots = await Violation.countDocuments(hotspotsFilter);
        let activeHotspots = 0;

        if (totalViolationsForHotspots > 0) {
            const hotspotsAgg = await Violation.aggregate([
                { $match: hotspotsFilter },
                {
                    $group: {
                        _id: "$police_station",
                        count: { $sum: 1 }
                    }
                }
            ]);

            const reqRiskLevel = req.query.riskLevel;
            hotspotsAgg.forEach(group => {
                if (group.count >= 5) {
                    const percentage = (group.count / totalViolationsForHotspots) * 100;
                    let risk_level = 'Low';
                    if (percentage >= 15) {
                        risk_level = 'Critical';
                    } else if (percentage >= 8) {
                        risk_level = 'High';
                    } else if (percentage >= 3) {
                        risk_level = 'Moderate';
                    }

                    let matchesRisk = true;
                    if (reqRiskLevel) {
                        const searchLevel = reqRiskLevel.toLowerCase();
                        const hLevel = risk_level.toLowerCase();
                        if (searchLevel === 'low') {
                            matchesRisk = (hLevel === 'low');
                        } else if (searchLevel === 'medium' || searchLevel === 'moderate') {
                            matchesRisk = (hLevel === 'moderate');
                        } else if (searchLevel === 'high' || searchLevel === 'critical') {
                            matchesRisk = (hLevel === 'high' || hLevel === 'critical');
                        }
                    }

                    if (matchesRisk) {
                        activeHotspots++;
                    }
                }
            });
        }

        res.json({
            totalViolations:    total,
            approvedViolations: approved,
            rejectedViolations: rejected,
            pendingViolations:  pending,
            activeHotspots,
            highestRiskArea
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/heatmap', async (req, res) => {
    try {
        const filter = buildFilterQuery(req);
        const violations = await Violation.find(filter, 'latitude longitude validation_status').lean();
        res.json(violations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/hotspots', async (req, res) => {
    try {
        const filter = buildFilterQuery(req);
        
        // Remove raw database validation_status filter if riskLevel is passed,
        // because riskLevel filters the calculated hotspot risk levels (Low, Moderate, High, Critical)
        const reqRiskLevel = req.query.riskLevel;
        if (filter.validation_status) {
            delete filter.validation_status;
        }

        const totalViolations = await Violation.countDocuments(filter);
        if (totalViolations === 0) return res.json({ hotspots: [] });

        const hotspotsAgg = await Violation.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: "$police_station",
                    count: { $sum: 1 },
                    lat: { $avg: "$latitude" },
                    lng: { $avg: "$longitude" }
                }
            }
        ]);

        const hotspots = [];
        let idCounter = 1;

        hotspotsAgg.forEach(group => {
            if (group.count >= 5) {
                const percentage = (group.count / totalViolations) * 100;
                let risk_level = 'Low';
                if (percentage >= 15) {
                    risk_level = 'Critical';
                } else if (percentage >= 8) {
                    risk_level = 'High';
                } else if (percentage >= 3) {
                    risk_level = 'Moderate';
                }

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

        // Filter hotspots based on the calculated risk level
        let finalHotspots = hotspots;
        if (reqRiskLevel) {
            const searchLevel = reqRiskLevel.toLowerCase();
            finalHotspots = hotspots.filter(h => {
                const hLevel = h.risk_level.toLowerCase();
                if (searchLevel === 'low') {
                    return hLevel === 'low';
                } else if (searchLevel === 'medium' || searchLevel === 'moderate') {
                    return hLevel === 'moderate';
                } else if (searchLevel === 'high' || searchLevel === 'critical') {
                    return hLevel === 'high' || hLevel === 'critical';
                }
                return true;
            });
        }

        // Sort by count descending
        finalHotspots.sort((a, b) => b.count - a.count);

        res.json({ hotspots: finalHotspots });
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

        const recommendations = topAreas.map((area, index) => {
            const location = area._id || 'Unknown Region';
            const risk = Math.min(100, Math.max(30, Math.floor((area.count / (total || 1)) * 500) + 60));

            let recText;
            if (risk > 90) {
                recText = `Critical density: ${area.count} violations detected! Deploy 3-4 traffic marshals immediately and consider automated enforcement cameras.`;
            } else if (risk > 75) {
                recText = `High violation rate (${area.count} total). Increase patrol frequency during known peak hours to deter illegal parking.`;
            } else {
                recText = `Moderate risk with ${area.count} total violations. Review current parking signage visibility and consider setting up temporary barricades.`;
            }
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
        const byVehicleType = await Violation.aggregate([
            { $match: filter },
            { $group: { _id: "$vehicle_type", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        const byArea = await Violation.aggregate([
            { $match: filter },
            { $group: { _id: "$police_station", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        res.json({
            byVehicleType: byVehicleType.map(x => ({ name: x._id, value: x.count })),
            byArea: byArea.map(x => ({ name: x._id, value: x.count }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Congestion Prediction Proxy endpoint using Random Forest
app.post('/api/predict', async (req, res) => {
    try {
        const { location, vehicleType, hour, dayOfWeek } = req.body;

        // Group historical data for Random Forest training in Python
        const history = await Violation.aggregate([
            {
                $project: {
                    location: { $ifNull: ["$police_station", "Unknown"] },
                    vehicle_type: { $ifNull: ["$vehicle_type", "Unknown"] },
                    hour: { $hour: { date: "$created_datetime", timezone: "Asia/Kolkata" } },
                    day_of_week: { $dayOfWeek: { date: "$created_datetime", timezone: "Asia/Kolkata" } }
                }
            },
            {
                $group: {
                    _id: {
                        location: "$location",
                        vehicle_type: "$vehicle_type",
                        hour: "$hour",
                        day_of_week: "$day_of_week"
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    location: "$_id.location",
                    vehicle_type: "$_id.vehicle_type",
                    hour: "$_id.hour",
                    day_of_week: { $subtract: ["$_id.day_of_week", 1] },
                    count: 1
                }
            },
            { $limit: 10000 }
        ]);

        const payload = {
            history,
            target: {
                location: location || 'Unknown',
                vehicle_type: vehicleType || 'Unknown',
                hour: hour !== undefined && hour !== null ? parseInt(hour) : 12,
                day_of_week: dayOfWeek !== undefined && dayOfWeek !== null ? parseInt(dayOfWeek) : 1
            }
        };

        const aiResponse = await axios.post(`${AI_SERVICE_URL}/api/predict`, payload, {
            timeout: 60000 // 60 second timeout for ML training
        });
        res.json(aiResponse.data);
    } catch (err) {
        console.error("Prediction Proxy Error: ", err.message);
        // If AI service timed out or is unavailable, return a graceful fallback
        if (err.code === 'ECONNABORTED' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
            return res.status(503).json({
                error: 'AI service is currently unavailable or initializing. Please try again in a few seconds.',
                fallback: true
            });
        }
        res.status(500).json({ error: err.message });
    }
});

// CSV Export endpoint — streams via cursor to avoid loading all docs into memory
app.get('/api/export/csv', async (req, res) => {
    try {
        const filter = buildFilterQuery(req);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=violations_export.csv');

        // Write header
        res.write('id,latitude,longitude,vehicle_type,violation_type,created_datetime,police_station,junction_name,validation_status\n');

        // Stream rows using cursor — memory efficient for large datasets
        const cursor = Violation.find(filter).lean().cursor();
        for await (const v of cursor) {
            const row = `${v._id},${v.latitude},${v.longitude},"${(v.vehicle_type || 'Unknown').replace(/"/g, '""')}","${(v.violation_type || 'Unknown').replace(/"/g, '""')}",${v.created_datetime ? v.created_datetime.toISOString() : ''},"${(v.police_station || 'Unknown').replace(/"/g, '""')}","${(v.junction_name || 'Unknown').replace(/"/g, '""')}","${v.validation_status || 'Pending'}"\n`;
            res.write(row);
        }
        res.end();
    } catch (err) {
        console.error('CSV Export Error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

// GET unique metadata dynamically from the database
app.get('/api/meta', async (req, res) => {
    try {
        const policeStations = await Violation.distinct('police_station');
        const vehicleTypes = await Violation.distinct('vehicle_type');
        const violationTypes = await Violation.distinct('violation_type');
        res.json({
            policeStations: policeStations.filter(Boolean),
            vehicleTypes: vehicleTypes.filter(Boolean),
            violationTypes: violationTypes.filter(Boolean)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
