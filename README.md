# ParkPulse AI

ParkPulse AI is an AI-powered parking hotspot intelligence dashboard that analyzes parking violation datasets and helps authorities identify congestion-causing parking hotspots. Built as a MERN stack MVP for the hackathon.

## Features (Phase 1)
- **CSV Upload**: Upload large parking violation datasets directly into the database.
- **Dashboard Overview**: Live stats, approved/rejected violations, and active hotspots.
- **Hotspot Heatmap**: React Leaflet map showing the density of violations.
- **AI Hotspot Detection**: Python AI service using DBSCAN clustering to dynamically detect hotspots based on location proximity.
- **Analytics**: Charts visualizing violations by area and vehicle type.

## Tech Stack
- **Frontend**: React, Tailwind CSS (v4), React Leaflet, Recharts, Lucide Icons.
- **Backend**: Node.js, Express, Mongoose.
- **Database**: MongoDB (Local/Atlas).
- **AI Service**: Python, Flask, Pandas, Scikit-Learn (DBSCAN).

## Installation & Setup

You will need 3 terminal tabs to run all services.

### 1. MongoDB Database
Ensure MongoDB is running locally on `mongodb://localhost:27017/parkpulse`.
Alternatively, set the `MONGO_URI` environment variable in the backend folder.

### 2. Backend (Node.js)
```bash
cd backend
npm install
npm start
```

### 3. AI Service (Python)
```bash
cd ai_service
python -m venv venv
# Activate venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
# source venv/bin/activate
pip install -r requirements.txt # or pip install flask pandas scikit-learn flask-cors
python app.py
```

### 4. Frontend (Vite + React)
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` to view the application.
