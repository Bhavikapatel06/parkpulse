const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  vehicle_type: { type: String },
  violation_type: { type: String },
  created_datetime: { type: Date, default: Date.now },
  police_station: { type: String },
  junction_name: { type: String },
  validation_status: { type: String, default: 'Pending' }
});

module.exports = mongoose.model('Violation', violationSchema, 'violations');
