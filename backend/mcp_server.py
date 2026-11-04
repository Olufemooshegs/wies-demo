import urllib.request
import json
import math
from fastmcp import FastMCP

mcp = FastMCP("California-Water-Data")

STATIONS = {
    "shasta lake": {"id": "SHA", "lat": 40.718, "lng": -122.420},
    "lake oroville": {"id": "ORO", "lat": 39.538, "lng": -121.485},
    "lake tahoe": {"id": "TAH", "lat": 39.096, "lng": -120.032},
    "folsom lake": {"id": "FOL", "lat": 38.683, "lng": -121.183}
}

CITIES = {
    "sacramento": {"lat": 38.5816, "lng": -121.4944},
    "san francisco": {"lat": 37.7749, "lng": -122.4194},
    "los angeles": {"lat": 34.0522, "lng": -118.2437},
    "redding": {"lat": 40.5865, "lng": -122.3917}
}

def haversine(lat1, lon1, lat2, lon2):
    R = 3958.8
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    return R * c

@mcp.tool()
def get_water_level(station_name: str) -> dict:
    """Fetches the latest water level, historical averages, and 30-day trend data."""
    key = station_name.lower().strip()
    if key not in STATIONS:
        return {"error": f"No live data available for {station_name}"}
        
    info = STATIONS[key]
    url = f"https://cdec.water.ca.gov/dynamicapp/req/JSONDataServlet?Stations={info['id']}&SensorNums=6&dur_code=D&Sort=&max_records=30"
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            
        if not data or len(data) == 0:
            return {"error": f"No recent readings for {station_name}"}
            
        values = []
        history = []
        for row in data:
            if row.get('value') is not None:
                try:
                    val = float(row['value'])
                    values.append(val)
                    history.append({"date": row['date'], "level": val})
                except ValueError:
                    pass

        def calc_avg(days):
            subset = values[:days]
            return round(sum(subset) / len(subset), 2) if subset else None

        return {
            "station": station_name.title(),
            "latitude": info["lat"],
            "longitude": info["lng"],
            "water_level": values[0],
            "unit": "ft",
            "seven_day_avg": calc_avg(7),
            "fourteen_day_avg": calc_avg(14),
            "thirty_day_avg": calc_avg(30),
            "history": history[::-1]
        }
    except Exception as e:
        return {"error": str(e)}

@mcp.tool()
def get_lakes_near_city(city_name: str) -> list:
    """Finds California lakes within 100 miles of a given city."""
    city_key = city_name.lower().strip()
    if city_key not in CITIES:
        return [{"error": f"City '{city_name}' not in database. Try Sacramento, San Francisco, or Redding."}]
        
    city_loc = CITIES[city_key]
    nearby = []
    
    for name, loc in STATIONS.items():
        dist = haversine(city_loc["lat"], city_loc["lng"], loc["lat"], loc["lng"])
        if dist <= 100:
            nearby.append({
                "station": name.title(),
                "distance_miles": round(dist, 1),
                "latitude": loc["lat"],
                "longitude": loc["lng"]
            })
            
    return nearby if nearby else [{"message": f"No lakes found within 100 miles of {city_name}"}]

if __name__ == "__main__":
    mcp.run(transport="stdio")