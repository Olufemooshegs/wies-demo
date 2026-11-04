import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Send, Loader2, Droplets, Sun, Moon, Terminal, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Icons
const activeWaterIcon = new L.DivIcon({
  className: 'custom-icon',
  html: `<div style="background-color: #3b82f6; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 0 15px rgba(59, 130, 246, 0.8);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg></div>`,
  iconSize: [30, 30], iconAnchor: [15, 15],
});

const baseIcon = new L.DivIcon({
  className: 'custom-icon',
  html: `<div style="background-color: #64748b; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; opacity: 0.7;"></div>`,
  iconSize: [16, 16], iconAnchor: [8, 8],
});

const BASE_STATIONS = [
  { name: "Shasta Lake", lat: 40.718, lng: -122.420 },
  { name: "Lake Oroville", lat: 39.538, lng: -121.485 },
  { name: "Lake Tahoe", lat: 39.096, lng: -120.032 },
  { name: "Folsom Lake", lat: 38.683, lng: -121.183 }
];

function MapController({ location }) {
  const map = useMap();
  useEffect(() => {
    if (Array.isArray(location) && location.length > 0) {
      // If it's an array of lakes (proximity search)
      const bounds = L.latLngBounds(location.map(d => [d.latitude, d.longitude]));
      map.flyToBounds(bounds, { padding: [50, 50], duration: 2 });
    } else if (location && location.latitude) {
      // If it's a single lake
      map.flyTo([location.latitude, location.longitude], 10, { duration: 2 });
    }
  }, [location, map]);
  return null;
}

// Trace Component (The "How I got this" panel)
function AgentTrace({ trace }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!trace || trace.length === 0) return null;

  return (
    <div className="mt-2 w-full">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
      >
        <Terminal size={12} />
        {isOpen ? 'Hide' : 'Show'} Agent Trace
        {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      
      {isOpen && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 bg-slate-900 rounded-lg p-3 text-[10px] font-mono overflow-x-auto border border-slate-700">
          {trace.map((t, idx) => (
            <div key={idx} className="mb-2 last:mb-0">
              <span className="text-pink-400">Tool:</span> <span className="text-yellow-300">{t.tool}</span><br/>
              <span className="text-pink-400">Args:</span> <span className="text-slate-300">{JSON.stringify(t.args)}</span><br/>
              <span className="text-pink-400">Result:</span> <span className="text-green-400">{t.result}</span>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Hello. I am connected to live CDEC data via MCP. Ask me about a California lake, or click a grey dot on the map.' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mapData, setMapData] = useState(null);
  const [isDark, setIsDark] = useState(false);

  const sendMessage = async (query) => {
    const text = query || input;
    if (!text.trim() || loading) return;
    
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('https://golden-state-api.onrender.com/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response,
        trace: data.trace,
        history: data.map_data?.history || null
      }]);
      
      if (data.map_data && (data.map_data.latitude || Array.isArray(data.map_data))) {
        setMapData(data.map_data);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error connecting to the server.' }]);
    } finally {
      setLoading(false);
    }
  };

  const theme = {
    bg: isDark ? 'bg-slate-900' : 'bg-slate-50',
    text: isDark ? 'text-white' : 'text-slate-900',
    textMuted: isDark ? 'text-slate-400' : 'text-slate-500',
    panelBg: isDark ? 'bg-slate-800/90' : 'bg-white/90',
    border: isDark ? 'border-slate-700' : 'border-slate-200',
    inputBg: isDark ? 'bg-slate-900' : 'bg-white',
    userMsg: 'bg-blue-600 text-white',
    botMsg: isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-800',
    btn: isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'
  };

  return (
    <div className={`relative h-screen w-screen overflow-hidden ${theme.bg}`}>
      <MapContainer center={[37.5, -119.5]} zoom={7} style={{ height: '100%', width: '100%', zIndex: 0 }}>
        {isDark ? (
          <>
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" />
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}" />
          </>
        ) : (
          <TileLayer 
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}" 
            attribution="Tiles &copy; Esri" 
          />
        )}

        {/* Render base stations */}
        {BASE_STATIONS.map((s, i) => (
          <Marker key={`base-${i}`} position={[s.lat, s.lng]} icon={baseIcon} eventHandlers={{ click: () => sendMessage(`What is the water level for ${s.name}?`) }}>
            <Popup>{s.name}</Popup>
          </Marker>
        ))}

        {/* Render Result markers */}
        {Array.isArray(mapData) ? (
          mapData.map((d, i) => d.latitude && (
            <Marker key={`res-${i}`} position={[d.latitude, d.longitude]} icon={activeWaterIcon}>
              <Popup><strong>{d.station}</strong><br/>{d.distance_miles} miles away</Popup>
            </Marker>
          ))
        ) : mapData && mapData.latitude && (
          <Marker position={[mapData.latitude, mapData.longitude]} icon={activeWaterIcon}>
            <Popup className="rounded-lg">
              <div className="p-1 min-w-[150px]">
                <h3 className="font-bold text-lg m-0 text-slate-800">{mapData.station}</h3>
                <div className="text-blue-600 font-semibold text-lg">{mapData.water_level} {mapData.unit}</div>
                {mapData.seven_day_avg && (
                  <div className="text-xs text-slate-500 mt-1 border-t border-slate-200 pt-1">
                    <strong>7-day avg:</strong> {mapData.seven_day_avg} ft
                  </div>
                )}
                <div className="text-[10px] text-slate-400 mt-1">Updated: {mapData.last_updated}</div>
              </div>
            </Popup>
          </Marker>
        )}
        <MapController location={mapData} />
      </MapContainer>

      <div className={`absolute top-6 left-6 z-10 ${theme.panelBg} backdrop-blur-md px-6 py-3 rounded-2xl border ${theme.border} shadow-xl flex items-center justify-between w-[calc(100%-3rem)] md:w-auto md:min-w-[400px]`}>
        <div className="flex items-center gap-3">
          <Droplets className="text-blue-500" size={28} />
          <div>
            <h1 className={`text-xl font-bold ${theme.text} m-0 tracking-tight`}>Golden State Water Explorer</h1>
            <p className={`text-xs ${theme.textMuted} m-0`}>Agentic GIS Demo via MCP</p>
          </div>
        </div>
        <button onClick={() => setIsDark(!isDark)} className={`ml-6 p-2 rounded-lg border ${theme.border} ${theme.btn} ${theme.text} transition-colors`}>
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <div className={`absolute top-24 bottom-6 right-6 w-[450px] z-10 flex flex-col ${theme.panelBg} backdrop-blur-xl border ${theme.border} rounded-3xl shadow-2xl overflow-hidden transition-colors duration-300`}>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <AnimatePresence>
            {messages.map((m, i) => (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm overflow-x-auto ${
                  m.role === 'user' ? theme.userMsg + ' rounded-br-sm' : theme.botMsg + ' rounded-bl-sm'
                }`}>
                  
                  {m.role === 'user' ? (
                    m.content
                  ) : (
                    <>
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({node, ...props}) => <table className="min-w-full border-collapse border border-slate-300 dark:border-slate-600 my-2" {...props} />,
                          th: ({node, ...props}) => <th className={`border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-left font-semibold ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} {...props} />,
                          td: ({node, ...props}) => <td className="border border-slate-300 dark:border-slate-600 px-3 py-1.5" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-bold text-blue-600 dark:text-blue-400" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc list-inside my-2 space-y-1" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal list-inside my-2 space-y-1" {...props} />,
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>

                      {/* Render Chart if history exists */}
                      {m.history && m.history.length > 0 && (
                        <div className="mt-4 h-40 w-full bg-slate-50 dark:bg-slate-800 rounded-lg p-2 border border-slate-200 dark:border-slate-700">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={m.history}>
                              <XAxis dataKey="date" hide />
                              <YAxis domain={['auto', 'auto']} hide />
                              <Tooltip 
                                contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', borderRadius: '8px', border: 'none', color: isDark ? '#fff' : '#000' }}
                                labelStyle={{ display: 'none' }}
                              />
                              <Line type="monotone" dataKey="level" stroke="#3b82f6" strokeWidth={3} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* Evidence Card Download */}
                      {m.trace && m.trace.length > 0 && !m.content.includes("An error occurred") && (
                        <button  
                          onClick={() => {
                            const evidence = {
                              timestamp: new Date().toISOString(),
                              query: messages[i-1]?.content || "Unknown Query",
                              finding: m.content,
                              data_source: "CDEC API",
                              evidence_label: "Observed / Derived",
                              agent_trace: m.trace
                            };
                            const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `evidence-card-${Date.now()}.json`;
                            a.click();
                          }}
                          className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                        >
                          <Download size={14} /> Save as Evidence Card (JSON)
                        </button>
                      )}
                    </>
                  )}
                </div>
                {/* Render the trace if it exists */}
                {m.trace && <AgentTrace trace={m.trace} />}
              </motion.div>
            ))}
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className={`${theme.botMsg} rounded-2xl rounded-bl-sm px-5 py-3 flex items-center gap-3`}>
                  <Loader2 className="animate-spin text-blue-500" size={18} />
                  <span className={`text-sm ${theme.textMuted}`}>Executing MCP Tools...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Quick Prompts */}
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
          {["Shasta Lake", "Lake Oroville", "Folsom Lake", "Lakes near Sacramento"].map(name => (
            <button key={name} onClick={() => sendMessage(`What is the water level for ${name}?`)} className={`text-xs whitespace-nowrap px-3 py-1.5 rounded-full border ${theme.border} ${theme.textMuted} ${theme.btn} transition-colors`}>
              {name}
            </button>
          ))}
        </div>

        <div className={`p-4 ${isDark ? 'bg-slate-900/50' : 'bg-slate-50/50'} border-t ${theme.border}`}>
          <div className="relative flex items-center">
            <input
              type="text" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask about a California lake..."
              className={`w-full ${theme.inputBg} border ${theme.border} ${theme.text} placeholder-slate-400 rounded-xl py-4 pl-5 pr-14 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
            />
            <button onClick={() => sendMessage()} disabled={loading || !input.trim()} className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-400 text-white rounded-lg transition-colors">
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}