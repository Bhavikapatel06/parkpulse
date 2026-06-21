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

@app.route('/api/hotspots', methods=['POST'])
def detect_hotspots():
    data = request.json
    if not data or 'locations' not in data:
        return jsonify({'error': 'No locations provided'}), 400
    
    locations = data['locations'] # list of dicts: {'lat': float, 'lng': float}
    if not locations:
        return jsonify({'hotspots': []})
        
    df = pd.DataFrame(locations)
    
    # DBSCAN clustering
    # Adjusted for Hackathon MVP: Make parameters more lenient so large, visible clusters always appear
    eps = 0.005 # ~500 meters
    min_samples = 3
    
    # Convert lat/lng to radians for haversine metric if needed, 
    # but for simple approx in city we can use euclidean on lat/lng or just adjust eps.
    coords = df[['lat', 'lng']].values
    
    db = DBSCAN(eps=eps, min_samples=min_samples, metric='euclidean').fit(coords)
    
    df['cluster'] = db.labels_
    
    # -1 means noise (not a hotspot)
    hotspots_df = df[df['cluster'] != -1]
    
    hotspots = []
    
    for cluster_id, group in hotspots_df.groupby('cluster'):
        center_lat = group['lat'].mean()
        center_lng = group['lng'].mean()
        count = len(group)
        
        # Get the most common area name in this cluster
        top_area = group['area'].mode()[0] if 'area' in group else 'Unknown'
        
        # Determine risk level based on count
        if count < 10:
            risk_level = "Low"
            risk_score = count * 2
        elif count < 30:
            risk_level = "Moderate"
            risk_score = count * 2 + 20
        elif count < 60:
            risk_level = "High"
            risk_score = count * 1.5 + 40
        else:
            risk_level = "Critical"
            risk_score = min(100, count * 1.2 + 50)
            
        hotspots.append({
            'id': int(cluster_id),
            'lat': float(center_lat),
            'lng': float(center_lng),
            'count': int(count),
            'area': str(top_area),
            'risk_level': risk_level,
            'risk_score': min(100, int(risk_score))
        })
        
    # Sort by risk score
    hotspots.sort(key=lambda x: x['risk_score'], reverse=True)
        
    return jsonify({'hotspots': hotspots})

@app.route('/api/predict', methods=['POST'])
def predict_congestion():
    from sklearn.ensemble import RandomForestRegressor
    import pandas as pd
    # pyrefly: ignore [missing-import]
    import numpy as np
    
    data = request.json
    if not data or 'history' not in data or 'target' not in data:
        return jsonify({'error': 'History and target are required'}), 400
        
    history = data['history']  
    target = data['target']    
    
    if not history:
        return jsonify({
            'tomorrow_risk': 20, 
            'next_week_risk': 25, 
            'hourly_forecast': [], 
            'weekly_trend': [], 
            'future_hotspots': []
        })
        
    df = pd.DataFrame(history)
    
    try:
        # Calculate max count for risk normalization
        max_count = float(df['count'].max()) if len(df) > 0 else 1.0
        if max_count == 0:
            max_count = 1.0
            
        # Proper encoding: LabelEncoder incorrectly treats locations as ordinal continuous values.
        # We must use one-hot encoding (get_dummies) for categorical features (location, vehicle_type).
        X_df = df[['location', 'vehicle_type', 'hour', 'day_of_week']]
        y = df['count'].values
        
        # Convert categoricals into binary columns
        X_encoded = pd.get_dummies(X_df, columns=['location', 'vehicle_type'])
        
        # Train Random Forest Regressor
        rf = RandomForestRegressor(n_estimators=50, random_state=42, max_depth=15)
        rf.fit(X_encoded, y)
        
        # Helper function to properly format prediction features to match training columns
        def make_feature(loc, veh, hr, day):
            row = pd.DataFrame([{'location': loc, 'vehicle_type': veh, 'hour': hr, 'day_of_week': day}])
            row_encoded = pd.get_dummies(row, columns=['location', 'vehicle_type'])
            
            # Add missing columns with 0
            missing_cols = set(X_encoded.columns) - set(row_encoded.columns)
            for c in missing_cols:
                row_encoded[c] = 0
                
            # Ensure the exact same column order as training
            return row_encoded[X_encoded.columns]

        target_loc = target['location']
        target_veh = target['vehicle_type']
        target_hour = int(target['hour'])
        target_day = int(target['day_of_week'])
        
        # Predict Tomorrow Risk
        tomorrow_day = (target_day + 1) % 7
        tomorrow_features = make_feature(target_loc, target_veh, target_hour, tomorrow_day)
        tomorrow_pred = max(0, rf.predict(tomorrow_features)[0])
        tomorrow_risk = min(100, int((tomorrow_pred / max_count) * 100))
        
        # Predict Next Week Risk
        next_week_features = make_feature(target_loc, target_veh, target_hour, target_day)
        next_week_pred = max(0, rf.predict(next_week_features)[0])
        next_week_risk = min(100, int((next_week_pred / max_count) * 100))
        
        # 24-Hour Forecast (for target day)
        hourly_forecast = []
        for h in range(24):
            feat = make_feature(target_loc, target_veh, h, target_day)
            pred = max(0, rf.predict(feat)[0])
            risk = min(100, int((pred / max_count) * 100))
            hourly_forecast.append({'hour': f"{h:02d}:00", 'risk': risk})
            
        # 7-Day Risk Trend (for target hour)
        days_names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        weekly_trend = []
        for d in range(7):
            feat = make_feature(target_loc, target_veh, target_hour, d)
            pred = max(0, rf.predict(feat)[0])
            risk = min(100, int((pred / max_count) * 100))
            weekly_trend.append({'day': days_names[d], 'risk': risk})
            
        # Future Hotspots (for target vehicle/hour/day)
        all_locations = df['location'].unique()
        future_hotspots = []
        for loc in all_locations:
            feat = make_feature(loc, target_veh, target_hour, target_day)
            pred = max(0, rf.predict(feat)[0])
            risk = min(100, int((pred / max_count) * 100))
            future_hotspots.append({'area': loc, 'risk': risk})
            
        future_hotspots.sort(key=lambda x: x['risk'], reverse=True)
        top_future_hotspots = future_hotspots[:5]
        
        return jsonify({
            'tomorrow_risk': tomorrow_risk,
            'next_week_risk': next_week_risk,
            'hourly_forecast': hourly_forecast,
            'weekly_trend': weekly_trend,
            'future_hotspots': top_future_hotspots
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
