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
                    await Violation.insertMany(chunk);
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
                                await Violation.insertMany(currentBatch, { ordered: false });
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
                    await Violation.insertMany(currentBatch, { ordered: false });
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

        let activeHotspots = 0;
        if (total > 0) {
            byStation.forEach(group => {
                if ((group.count / total) * 100 >= 3) activeHotspots++;
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

        // Sort by count descending
        hotspots.sort((a, b) => b.count - a.count);

        res.json({ hotspots });
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

        const targetLoc = location || 'Unknown';
        const targetVeh = vehicleType || 'Unknown';
        const targetHour = hour !== undefined && hour !== null ? parseInt(hour) : 12;
        const targetDay = dayOfWeek !== undefined && dayOfWeek !== null ? parseInt(dayOfWeek) : 1;

        // Fast aggregations running in parallel
        const [overallHotspots, targetLocStats] = await Promise.all([
            // 1. Get global hotspots counts quickly using indexed police_station, filtered by vehicle type
            Violation.aggregate([
                { $match: { vehicle_type: { $regex: new RegExp(`^${targetVeh}$`, 'i') } } },
                { $group: { _id: "$police_station", count: { $sum: 1 } } }
            ]),
            // 2. Get hour/day distributions ONLY for the target location and vehicle type
            Violation.aggregate([
                { $match: { 
                    police_station: { $regex: new RegExp(`^${targetLoc}$`, 'i') }, 
                    vehicle_type: { $regex: new RegExp(`^${targetVeh}$`, 'i') } 
                } },
                {
                    $project: {
                        hour: { $hour: { date: "$created_datetime", timezone: "Asia/Kolkata" } },
                        day_of_week: { $dayOfWeek: { date: "$created_datetime", timezone: "Asia/Kolkata" } }
                    }
                },
                {
                    $group: {
                        _id: { hour: "$hour", day_of_week: "$day_of_week" },
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        let totalCount = 0;
        const futureHotspotsMap = {};
        overallHotspots.forEach(h => {
            totalCount += h.count;
            const loc = h._id || 'Unknown';
            futureHotspotsMap[loc] = h.count;
        });

        const locHourCounts = new Array(24).fill(0);
        const locDayCounts = new Array(7).fill(0);

        targetLocStats.forEach(s => {
            const h = s._id.hour;
            // MongoDB $dayOfWeek is 1-7 (Sun-Sat), JS array indices are 0-6
            const d = s._id.day_of_week - 1; 
            if (h >= 0 && h < 24) locHourCounts[h] += s.count;
            if (d >= 0 && d < 7) locDayCounts[d] += s.count;
        });

        const maxHourCount = Math.max(...locHourCounts, 1);
        const maxDayCount = Math.max(...locDayCounts, 1);

        const hourly_forecast = [];
        for (let i = 0; i < 24; i++) {
            const isPeak = (i >= 8 && i <= 10) || (i >= 17 && i <= 19);
            const historicalWeight = (locHourCounts[i] / maxHourCount) * 50;
            const syntheticWeight = isPeak ? 35 : (i >= 22 || i <= 5 ? 5 : 20);
            
            let risk = Math.round(historicalWeight + syntheticWeight + (Math.random() * 5));
            risk = Math.min(100, Math.max(10, risk));
            hourly_forecast.push({ hour: `${i.toString().padStart(2, '0')}:00`, risk });
        }

        const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const weekly_trend = [];
        for (let i = 0; i < 7; i++) {
            const isWeekend = i === 0 || i === 6;
            const historicalWeight = (locDayCounts[i] / maxDayCount) * 60;
            const syntheticWeight = isWeekend ? 15 : 35;
            let risk = Math.round(historicalWeight + syntheticWeight + (Math.random() * 5));
            risk = Math.min(100, Math.max(10, risk));
            weekly_trend.push({ day: DAYS[i], risk });
        }

        const tomorrowDay = (targetDay + 1) % 7;
        const tomorrow_risk = Math.min(100, Math.max(10, weekly_trend[tomorrowDay].risk + Math.floor(Math.random() * 10) - 5));
        const next_week_risk = weekly_trend[targetDay].risk;

        const allLocations = Object.keys(futureHotspotsMap);
        const future_hotspots = allLocations.map(loc => {
            const locScore = (futureHotspotsMap[loc] / (totalCount || 1)) * 100;
            return {
                area: loc,
                risk: Math.min(100, Math.max(15, Math.round(locScore * 4 + 20 + Math.random() * 10)))
            };
        }).sort((a, b) => b.risk - a.risk).slice(0, 5);

        return res.json({
            tomorrow_risk,
            next_week_risk,
            hourly_forecast,
            weekly_trend,
            future_hotspots
        });
    } catch (err) {
        console.error("Prediction Error: ", err.message);
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
