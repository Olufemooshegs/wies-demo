# 🌊 Golden State Water Explorer

A full-stack, agentic GIS (Geographic Information System) application that allows users to query live California water reservoir data using natural language. 

🔗 **Live Demo:** [https://wies-demo.vercel.app](https://wies-demo.vercel.app)

## 📖 Overview

This project was built as a proof-of-concept to demonstrate how **Model Context Protocol (MCP)** can be used to give AI agents spatial reasoning capabilities. Instead of hard-coding API calls, the LLM autonomously selects and executes GIS tools to fetch data, analyze spatial proximity, and update the map.

It features a highly transparent "Agent Trace" and an "Evidence Card" export system, designed to align with educational frameworks (like the WIES project) that require students to separate AI hypotheses from observed data.

## ✨ Key Features

- **Natural Language Querying:** Ask questions like *"What is the water level for Lake Oroville?"*
- **Live Data Integration:** Fetches real-time reservoir elevations and 7/14/30-day averages directly from the California Data Exchange Center (CDEC).
- **Interactive Mapping:** Uses Leaflet and React to fly to the queried location and drop custom markers.
- **Spatial Proximity Analysis:** Ask *"What lakes are near Sacramento?"* to trigger a spatial query that calculates distances using the Haversine formula.
- **MCP Transparency:** The "Show Agent Trace" panel exposes the exact Python tool used, the arguments passed, and the raw JSON returned by the server.
- **Evidence Cards:** Download a JSON file containing the query, the finding, and the AI's tool trace for later reporting.
- **Dynamic Theming:** Toggle between beautiful light (Topographic) and dark (Dark Gray Canvas) basemaps.

## 🛠️ Tech Stack

- **Frontend:** React, Vite, Tailwind CSS, Leaflet, Recharts, Framer Motion
- **Backend:** Python, FastAPI, FastMCP
- **AI/LLM:** Groq API (Llama-3.1-70b-versatile)
- **Deployment:** Vercel (Frontend), Render (Backend)

## 🚀 How it Works (The MCP Flow)

1. The user asks a question in the React UI.
2. The FastAPI backend connects to a local Python **MCP Server** (`mcp_server.py`).
3. The MCP server exposes tools like `get_water_level` and `get_lakes_near_city`.
4. The backend sends the user prompt and the tool schemas to the Groq LLM.
5. The LLM decides which tool to call.
6. The FastAPI backend executes the tool via MCP, gets the live data, and feeds it back to the LLM.
7. The LLM formats the final response, and the backend sends the text, the map coordinates, and the trace data back to the frontend.

## 💻 Local Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- A [Groq API Key](https://console.groq.com/)

### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend` folder:
```env
GROQ_API_KEY=your_gsk_api_key_here
```

Start the server:
```bash
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## 🧠 Future Improvements
- Add more spatial tools (e.g., watershed delineation, point-in-polygon).
- Connect to a PostGIS database for advanced spatial querying.
- Add user authentication to save Evidence Cards to a database.
```

