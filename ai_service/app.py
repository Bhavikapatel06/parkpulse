import os
# pyrefly: ignore [missing-import]
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from sklearn.cluster import DBSCAN
# pyrefly: ignore [missing-import]
import numpy as np

app = Flask(__name__)
CORS(app)


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint for Render deployment."""
    return jsonify({'status': 'ok', 'service': 'parkpulse-ai'})


# ──────────────────────────────────────────────────────────────────────────────
# Hotspot Detection  (DBSCAN clustering on lat/lng points)
# ──────────────────────────────────────────────────────────────────────────────
@app.route('/api/hotspots', methods=['POST'])
def detect_hotspots():
    data = request.json
    if not data or 'locations' not in data:
        return jsonify({'error': 'No locations provided'}), 400

    locations = data['locations']  # list of dicts: {'lat', 'lng', 'area'}
    if not locations:
        return jsonify({'hotspots': []})

    df = pd.DataFrame(locations)

    eps = 0.005        # ~500 m in decimal degrees
    min_samples = 3

    coords = df[['lat', 'lng']].values
    db = DBSCAN(eps=eps, min_samples=min_samples, metric='euclidean').fit(coords)
    df['cluster'] = db.labels_

    hotspots_df = df[df['cluster'] != -1]
    if hotspots_df.empty:
        return jsonify({'hotspots': []})

    # Dynamic thresholds based on cluster count percentiles
    counts = hotspots_df.groupby('cluster').size()
    max_count = int(counts.max())

    # Use percentiles to guarantee a good distribution of colors
    mod_thresh  = max(3, np.percentile(counts, 50))  # 50th percentile
    high_thresh = max(6, np.percentile(counts, 75))  # 75th percentile
    crit_thresh = max(10, np.percentile(counts, 90)) # 90th percentile

    hotspots = []
    for cluster_id, group in hotspots_df.groupby('cluster'):
        center_lat = group['lat'].mean()
        center_lng = group['lng'].mean()
        count = len(group)
        top_area = group['area'].mode()[0] if 'area' in group.columns else 'Unknown'

        if count < mod_thresh:
            risk_level = 'Low'
            risk_score = (count / mod_thresh) * 30
        elif count < high_thresh:
            risk_level = 'Moderate'
            risk_score = 30 + ((count - mod_thresh) / max(1, high_thresh - mod_thresh)) * 30
        elif count < crit_thresh:
            risk_level = 'High'
            risk_score = 60 + ((count - high_thresh) / max(1, crit_thresh - high_thresh)) * 25
        else:
            risk_level = 'Critical'
            risk_score = min(100, 85 + ((count - crit_thresh) / max(1, max_count - crit_thresh)) * 15)

        hotspots.append({
            'id': int(cluster_id),
            'lat': float(center_lat),
            'lng': float(center_lng),
            'count': int(count),
            'area': str(top_area),
            'risk_level': risk_level,
            'risk_score': min(100, max(1, int(risk_score)))
        })

    hotspots.sort(key=lambda x: x['risk_score'], reverse=True)
    return jsonify({'hotspots': hotspots})


# ──────────────────────────────────────────────────────────────────────────────
# Congestion Prediction  (Random Forest Regressor)
# ──────────────────────────────────────────────────────────────────────────────
@app.route('/api/predict', methods=['POST'])
def predict_congestion():
    from sklearn.ensemble import RandomForestRegressor

    data = request.json
    if not data or 'history' not in data or 'target' not in data:
        return jsonify({'error': 'History and target are required'}), 400

    history = data['history']
    target  = data['target']

    _empty_hours = [{'hour': f'{h:02d}:00', 'risk': 0} for h in range(24)]
    _empty_days  = [{'day': d, 'risk': 0} for d in
                    ['Sunday', 'Monday', 'Tuesday', 'Wednesday',
                     'Thursday', 'Friday', 'Saturday']]

    if not history:
        return jsonify({
            'tomorrow_risk': 0,
            'next_week_risk': 0,
            'hourly_forecast': _empty_hours,
            'weekly_trend': _empty_days,
            'future_hotspots': []
        })

    df = pd.DataFrame(history)

    try:
        # ── Features & labels ──────────────────────────────────────────────
        X_df = df[['location', 'vehicle_type', 'hour', 'day_of_week']]
        y    = df['count'].values.astype(float)

        X_encoded = pd.get_dummies(X_df, columns=['location', 'vehicle_type'])

        # ── Train ──────────────────────────────────────────────────────────
        rf = RandomForestRegressor(
            n_estimators=100,
            random_state=42,
            max_depth=12,
            n_jobs=-1
        )
        rf.fit(X_encoded, y)

        target_loc  = target['location']
        target_veh  = target['vehicle_type']
        target_hour = int(target['hour'])
        target_day  = int(target['day_of_week'])

        # ── Build all prediction requests in one batch ─────────────────────
        pred_requests = []
        tomorrow_day = (target_day + 1) % 7

        # idx 0..23:  24-hour forecast for TODAY's day_of_week
        for h in range(24):
            pred_requests.append({
                'location': target_loc, 'vehicle_type': target_veh,
                'hour': h, 'day_of_week': target_day
            })
        # idx 24..47: 24-hour forecast for TOMORROW's day_of_week
        #  → tomorrow_risk = peak (max) of these 24 predictions
        for h in range(24):
            pred_requests.append({
                'location': target_loc, 'vehicle_type': target_veh,
                'hour': h, 'day_of_week': tomorrow_day
            })
        # idx 48..54: daily peak for each of the 7 days at the target hour
        #  → next_week_risk = average of these 7 predictions
        for d in range(7):
            pred_requests.append({
                'location': target_loc, 'vehicle_type': target_veh,
                'hour': target_hour, 'day_of_week': d
            })
        # idx 55+: future hotspot risk — one row per unique location
        all_locations = df['location'].unique()
        for loc in all_locations:
            pred_requests.append({
                'location': loc, 'vehicle_type': target_veh,
                'hour': target_hour, 'day_of_week': target_day
            })

        pred_df      = pd.DataFrame(pred_requests)
        pred_encoded = pd.get_dummies(pred_df, columns=['location', 'vehicle_type'])

        # Align to training schema (add missing dummy cols)
        for col in X_encoded.columns:
            if col not in pred_encoded.columns:
                pred_encoded[col] = 0
        pred_features = pred_encoded[X_encoded.columns]

        # ── Predict ────────────────────────────────────────────────────────
        preds = np.maximum(rf.predict(pred_features), 0)

        # ── Section slices ─────────────────────────────────────────────────
        today_preds    = preds[0:24]       # 24 hours for today
        tomorrow_preds = preds[24:48]      # 24 hours for tomorrow
        weekly_preds   = preds[48:55]      # 7 days at target hour
        hs_start       = 55
        hs_preds       = preds[hs_start:]  # one per location

        # ── Calculate dynamic baseline (95th percentile of target vehicle type counts or global) ──
        veh_df = df[df['vehicle_type'] == target_veh] if 'vehicle_type' in df.columns else pd.DataFrame()
        if not veh_df.empty:
            baseline = float(np.percentile(veh_df['count'].values, 95))
        else:
            baseline = float(np.percentile(df['count'].values, 95)) if not df.empty else 10.0
        
        # Ensure a reasonable minimum baseline to avoid division issues or extreme scaling on small numbers
        baseline = max(baseline, 5.0)

        # ── Helper to calculate risk index ──
        def get_risk_index(val: float) -> int:
            return min(100, max(1, int(round((val / baseline) * 100))))

        # ── Tomorrow risk = PEAK hour across all 24h tomorrow ─────────────
        tomorrow_risk = get_risk_index(float(tomorrow_preds.max()))

        # ── Next-week risk = average peak across 7 days ───────────────────
        next_week_risk  = get_risk_index(float(weekly_preds.mean()))

        # ── 24-hour forecast (today) ──────────────────────────────────────
        hourly_forecast = [
            {'hour': f'{h:02d}:00',
             'risk': get_risk_index(float(today_preds[h]))}
            for h in range(24)
        ]

        # ── 7-day weekly trend ────────────────────────────────────────────
        days_names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday',
                      'Thursday', 'Friday', 'Saturday']
        weekly_trend = [
            {'day': days_names[d],
             'risk': get_risk_index(float(weekly_preds[d]))}
            for d in range(7)
        ]

        # ── Future hotspots ───────────────────────────────────────────────
        future_hotspots = []
        for idx, loc in enumerate(all_locations):
            val  = float(hs_preds[idx])
            risk = get_risk_index(val)
            future_hotspots.append({'area': loc, 'risk': risk})

        future_hotspots.sort(key=lambda x: x['risk'], reverse=True)

        return jsonify({
            'tomorrow_risk':   tomorrow_risk,
            'next_week_risk':  next_week_risk,
            'hourly_forecast': hourly_forecast,
            'weekly_trend':    weekly_trend,
            'future_hotspots': future_hotspots[:5]
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
