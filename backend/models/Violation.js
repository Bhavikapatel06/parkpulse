const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema({
  latitude:          { type: Number, required: true },
  longitude:         { type: Number, required: true },
  vehicle_type:      { type: String, index: true },
  violation_type:    { type: String },
  created_datetime:  { type: Date, default: Date.now, index: true },
  police_station:    { type: String, index: true },
  junction_name:     { type: String },
  validation_status: { type: String, default: 'Pending', index: true }
});

// Compound index for dashboard aggregation queries
violationSchema.index({ police_station: 1, created_datetime: -1 });
violationSchema.index({ vehicle_type: 1, validation_status: 1 });

module.exports = mongoose.model('Violation', violationSchema, 'violations');
