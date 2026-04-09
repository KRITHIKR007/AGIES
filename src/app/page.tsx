"use client";

import { useState, useEffect, useRef, useMemo } from "react";

interface Telemetry {
  speed: number;
  alert: string;
  detections: Record<string, number>;
  coords: Array<{ label: string; conf: number; x1: number; y1: number; x2: number; y2: number; }>;
}

export default function Home() {
  const [messages, setMessages] = useState([{ sender: "AI", text: "SYSTEM INITIALIZED. NEURAL LINK ESTABLISHED." }]);
  const [input, setInput] = useState("");
  const [telemetry, setTelemetry] = useState<Telemetry>({ speed: 0, alert: "NORMAL", detections: {}, coords: [] });
  const [viewMode, setViewMode] = useState("HUD");
  const [focusMode, setFocusMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [logs, setLogs] = useState(["[SYS] Booting Augmented Vision OS...", "[SYS] Calibrating YOLOv8 Sensors..."]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => setBooting(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("http://127.0.0.1:5000/api/data");
        const data = await res.json();
        setTelemetry(data);
        
        if (data.detections && Object.keys(data.detections).length > 0) {
          const dets = Object.entries(data.detections).map(([k, v]) => `${v} ${k}`).join(", ");
          setLogs(prev => {
            const newLog = `[DET] ${dets}`;
            if (prev[prev.length - 1] === newLog) return prev;
            const newLogs = [...prev, newLog];
            return newLogs.slice(-20);
          });
        }
      } catch (e) {
        // Silently handle backend connection issues
      }
    }, 100); 
    return () => clearInterval(interval);
  }, []);

  const detectionsArray = useMemo(() => {
    return Object.entries(telemetry.detections || {});
  }, [telemetry.detections]);

  const speak = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
      utterance.pitch = 0.85; 
      window.speechSynthesis.speak(utterance);
    }
  };

  const sendMessage = async (textToSend: string = input) => {
    if (!textToSend.trim()) return;

    const newMessages = [...messages, { sender: "User", text: textToSend }];
    setMessages(newMessages);
    setInput("");

    try {
      const response = await fetch("http://127.0.0.1:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend }),
      });
      const data = await response.json();
      setMessages([...newMessages, { sender: "AI", text: data.response }]);
      speak(data.response);
    } catch (e) {
      setMessages([...newMessages, { sender: "AI", text: "SIGNAL INTERRUPTED." }]);
    }
  };

  const startListening = () => {
    if (typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        sendMessage(transcript);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
    }
  };

  if (!mounted) return null;

  const isDanger = telemetry.alert?.includes("DANGER");
  const isWarning = telemetry.alert?.includes("WARNING");
  const primaryColor = isDanger ? "text-red-500" : isWarning ? "text-amber-500" : "text-cyan-400";
  const primaryBorder = isDanger ? "border-red-500" : isWarning ? "border-amber-500" : "border-cyan-500";
  const speedPct = Math.min(100, (telemetry.speed / 120) * 100);

  return (
    <main className="relative w-screen h-screen bg-black overflow-hidden font-mono text-cyan-400 select-none flex scanline">
      
      {/* Booting Overlay */}
      {booting && (
        <div className="absolute inset-0 z-[1000] bg-black flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(34,211,238,0.5)]"></div>
          <div className="text-sm tracking-[0.8em] font-black animate-pulse uppercase">Neural Link Initiating</div>
        </div>
      )}

      {/* Danger Pulse Overlay */}
      <div className={`absolute inset-0 transition-opacity duration-300 pointer-events-none z-[100] ${isDanger ? "opacity-100 bg-red-950/20" : "opacity-0"}`}>
        <div className="absolute inset-0 border-[40px] border-red-600/10 animate-pulse"></div>
        {isDanger && (
           <div className="absolute inset-0 flex items-center justify-center bg-black/40">
             <div className="animate-hud-pulse flex flex-col items-center gap-4">
               <h1 className="text-red-500 font-black text-7xl tracking-[0.3em] uppercase drop-shadow-[0_0_30px_rgba(239,68,68,1)]">CRITICAL</h1>
               <div className="h-px w-96 bg-red-500"></div>
               <span className="text-white text-xl tracking-[0.5em]">{telemetry.alert}</span>
             </div>
           </div>
        )}
      </div>

      {/* Main UI Layer */}
      <div className="relative w-full h-full flex flex-col p-8 z-10 transition-transform duration-700 ease-in-out">
        
        {/* Superior Header */}
        <header className="flex justify-between items-start mb-8">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-4">
              <div className="w-2 h-8 bg-cyan-500 shadow-[0_0_15px_#22d3ee]"></div>
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black tracking-[0.4em] opacity-40 uppercase">Assigned Unit</span>
                  <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/30 text-[10px] text-cyan-300 uppercase">Online</span>
                </div>
                <div className="text-2xl font-black text-white tracking-widest leading-none">AV-ALPHA-7</div>
              </div>
            </div>
            
            <div className="mt-6 flex gap-2">
              <button 
                onClick={() => setViewMode("HUD")}
                className={`px-8 py-2 text-[10px] font-black tracking-[0.3em] transition-all border ${viewMode === "HUD" ? "bg-cyan-500 text-black border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)]" : "border-cyan-900 text-cyan-600 hover:border-cyan-500"}`}
              >
                HUD_LOCK
              </button>
              <button 
                onClick={() => setViewMode("DASHBOARD")}
                className={`px-8 py-2 text-[10px] font-black tracking-[0.3em] transition-all border ${viewMode === "DASHBOARD" ? "bg-cyan-500 text-black border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)]" : "border-cyan-900 text-cyan-600 hover:border-cyan-500"}`}
              >
                DIAGNOSTICS
              </button>
              <button 
                onClick={() => setFocusMode(!focusMode)}
                className={`ml-4 px-8 py-2 text-[10px] font-black tracking-[0.3em] transition-all border ${focusMode ? "bg-amber-500 text-black border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)]" : "border-cyan-900 text-cyan-600 hover:border-amber-500"}`}
              >
                {focusMode ? "MINIMAL: OFF" : "MINIMAL: ON"}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className={`px-12 py-3 border-r-4 ${primaryBorder} bg-black/60 backdrop-blur-xl flex flex-col items-end transition-all duration-500 ${isDanger ? "scale-110" : "scale-100"}`}>
               <span className={`text-[10px] font-black tracking-[0.5em] mb-1 ${primaryColor} opacity-70 uppercase`}>Sensor Feedback</span>
               <span className={`text-3xl font-black tracking-[0.2em] transition-colors ${primaryColor}`}>{telemetry.alert}</span>
            </div>
            <div className="text-[10px] font-bold tracking-[0.3em] opacity-30 uppercase">Local Link: {new Date().toLocaleTimeString()}</div>
          </div>
        </header>

        {/* Tactical Viewbox */}
        <div className="flex-1 flex gap-8 min-h-0 relative">
          
          {/* Detailed Statistics Aside */}
          {!focusMode && (
            <aside className="w-80 flex flex-col gap-6 animate-in slide-in-from-left duration-700">
              <div className="flex-1 border-t border-cyan-900 bg-cyan-950/5 flex flex-col overflow-hidden">
                <div className="p-4 flex justify-between items-center border-b border-cyan-900/50">
                  <span className="text-[10px] font-black tracking-[0.4em]">LOG_BUFFER</span>
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-cyan-500 animate-pulse"></div>
                    <div className="w-1 h-1 bg-cyan-500 animate-pulse delay-75"></div>
                    <div className="w-1 h-1 bg-cyan-500 animate-pulse delay-150"></div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-3 items-start animate-in fade-in slide-in-from-left duration-300">
                      <span className="text-[9px] font-bold text-cyan-900 mt-0.5">[{1000 + i}]</span>
                      <span className={`text-[10px] leading-relaxed ${log.includes("DET") ? "text-cyan-200" : "text-cyan-800"}`}>{log}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 border border-cyan-900 bg-cyan-950/10">
                 <div className="text-[10px] font-black tracking-[0.4em] opacity-40 mb-6">BIOMETRIC_FEEDS</div>
                 <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-[10px] mb-2">
                        <span className="opacity-60 uppercase">System Integrity</span>
                        <span className="text-cyan-400 font-black">98.4%</span>
                      </div>
                      <div className="h-1 bg-cyan-950 overflow-hidden">
                        <div className="h-full bg-cyan-500 shadow-[0_0_10px_#22d3ee] w-[98.4%] transition-all duration-1000"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] mb-2">
                        <span className="opacity-60 uppercase">Network Load</span>
                        <span className="text-cyan-400 font-black">12ms</span>
                      </div>
                      <div className="h-1 bg-cyan-950 overflow-hidden">
                        <div className="h-full bg-cyan-500 shadow-[0_0_10px_#22d3ee] w-[14%] transition-all"></div>
                      </div>
                    </div>
                 </div>
              </div>
            </aside>
          )}

          {/* Core Visualizer */}
          <section className={`flex-1 relative bg-black/90 border border-white/5 overflow-hidden transition-all duration-1000 ${focusMode ? "border-amber-500/20" : ""}`}>
            {viewMode === "HUD" ? (
              <div className="w-full h-full relative">
                <img 
                  src="http://127.0.0.1:5000/video_feed" 
                  alt="Primary Sensor" 
                  className="w-full h-full object-cover opacity-90 brightness-110 contrast-125" 
                />
                
                {/* Visual Enhancers */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/80 pointer-events-none"></div>
                <div className="absolute inset-0 border-[1px] border-cyan-500/10 pointer-events-none"></div>
                
                {/* ADVANCED TRACKING UI */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {(telemetry.coords || []).map((box, i) => (
                    <div 
                      key={i} 
                      className="absolute border-[0.5px] border-cyan-500/30 transition-all duration-150 ease-out"
                      style={{
                        left: `${box.x1}%`,
                        top: `${box.y1}%`,
                        width: `${box.x2 - box.x1}%`,
                        height: `${box.y2 - box.y1}%`,
                      }}
                    >
                      {/* Tracking Corner Indicators */}
                      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-400"></div>
                      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-400"></div>
                      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-400"></div>
                      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-400"></div>
                      
                      {/* Identification Data - Inside Box */}
                      <div className="absolute top-1 left-1 flex flex-col items-start mix-blend-difference">
                        <div className="flex items-center gap-1.5 bg-black/40 px-1 py-0.5">
                           <span className="text-[8px] font-black text-white uppercase tracking-[0.2em]">
                             {box.label}
                           </span>
                           <span className="text-[7px] text-cyan-400 font-bold opacity-80">
                             {Math.round((box.conf || 0) * 100)}%
                           </span>
                        </div>
                        <div className="text-[6px] text-cyan-500/50 font-black tracking-widest pl-0.5 uppercase">Locked</div>
                      </div>
                      
                      {/* Auxiliary Telemetry */}
                      <div className="absolute bottom-1 right-1 text-right mix-blend-difference">
                        <div className="text-[9px] font-black text-white tracking-widest">
                          {Math.round(40 / (box.x2 - box.x1) * 10) / 10}m
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Empty State Search */}
                  {(!telemetry.coords || telemetry.coords.length === 0) && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-20">
                      <div className="relative w-96 h-96 flex items-center justify-center">
                         <div className="absolute inset-0 border border-cyan-500/20 rounded-full animate-ping [animation-duration:3s]"></div>
                         <div className="absolute inset-20 border border-cyan-500/10 rounded-full animate-pulse"></div>
                         <span className="text-[10px] font-black tracking-[1em] text-cyan-500 uppercase">Scanning Environment</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Overlaid Instrumentation */}
                <div className="absolute inset-0 p-12 flex flex-col justify-between pointer-events-none">
                  <div className="flex justify-between items-start">
                    <div className="w-24 h-24 border-t border-l border-cyan-500/30"></div>
                    <div className="flex flex-col items-center gap-1 opacity-40">
                       <div className="w-[1px] h-12 bg-cyan-500"></div>
                       <span className="text-[8px] font-black">NAV_0°</span>
                    </div>
                    <div className="w-24 h-24 border-t border-r border-cyan-500/30"></div>
                  </div>
                  
                  {/* Digital Compass / Crosshair */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-[500px] h-[500px] relative flex items-center justify-center opacity-30">
                      <div className="absolute inset-0 border border-cyan-500/10 rounded-full"></div>
                      <div className="absolute inset-[30%] border border-cyan-500/10 rounded-full"></div>
                      <div className="w-16 h-px bg-cyan-500 absolute left-0"></div>
                      <div className="w-16 h-px bg-cyan-500 absolute right-0"></div>
                      <div className="h-16 w-px bg-cyan-500 absolute top-0"></div>
                      <div className="h-16 w-px bg-cyan-500 absolute bottom-0"></div>
                      <div className="text-[10px] font-black absolute top-[40%] translate-y-[-50%] text-cyan-400">STABLE</div>
                    </div>
                  </div>

                  <div className="flex justify-between items-end">
                    <div className="w-24 h-24 border-b border-l border-cyan-500/30"></div>
                    <div className="w-24 h-24 border-b border-r border-cyan-500/30"></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full bg-[#020817] p-12 grid grid-cols-3 gap-8 overflow-y-auto scrollbar-hide">
                 <div className="col-span-3 grid grid-cols-3 gap-8">
                    {[
                      { l: "IDENTIFIED_ENTITIES", v: detectionsArray.length, sub: "TRACKED" },
                      { l: "CURRENT_VELOCITY", v: telemetry.speed, sub: "MPH" },
                      { l: "THREAT_COEFFICIENT", v: isDanger ? "CRITICAL" : isWarning ? "ELEVATED" : "ZERO", sub: "AUTO_DET" }
                    ].map((st, i) => (
                      <div key={st.l} className="border-l-4 border-cyan-500 bg-cyan-950/20 p-8 transition-transform hover:scale-[1.02]">
                        <div className="text-[9px] font-black tracking-[0.5em] text-cyan-800 mb-4">{st.l}</div>
                        <div className="text-6xl font-black text-white mb-2">{st.v}</div>
                        <div className="text-[10px] font-bold text-cyan-500 opacity-50">{st.sub}</div>
                      </div>
                    ))}
                 </div>
                 
                 <div className="col-span-2 border border-cyan-900 bg-cyan-950/10 p-8">
                    <div className="flex justify-between items-center mb-10 pb-4 border-b border-cyan-900/40">
                      <h3 className="text-sm font-black tracking-[0.4em]">RECOGNITION_DATABASE</h3>
                      <span className="text-[10px] opacity-30 italic">Sorted by Confidence</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {detectionsArray.map(([name, count]) => (
                        <div key={name} className="flex justify-between items-center p-4 bg-cyan-500/5 border border-cyan-900 group hover:border-cyan-400 transition-all">
                          <span className="text-xs font-black uppercase tracking-widest text-cyan-300">{name}</span>
                          <span className="text-2xl font-black text-white group-hover:text-cyan-400">{count}</span>
                        </div>
                      ))}
                      {detectionsArray.length === 0 && <div className="col-span-2 text-center py-20 text-cyan-900 font-black tracking-[0.5em] uppercase">No Signatures Found</div>}
                    </div>
                 </div>

                 <div className="border border-cyan-900 bg-cyan-950/10 p-8 flex flex-col">
                    <h3 className="text-sm font-black tracking-[0.4em] mb-10 pb-4 border-b border-cyan-900/40 uppercase">SpatialScan</h3>
                    <div className="flex-1 flex items-center justify-center">
                       <div className="w-56 h-56 rounded-full border border-cyan-900 relative">
                          <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0%,rgba(34,211,238,0.1)_100%)] rounded-full animate-spin [animation-duration:4s]"></div>
                          {telemetry.coords?.map((c, i) => (
                            <div 
                              key={i} 
                              className="absolute w-2 h-2 rounded-full animate-pulse bg-cyan-500 shadow-[0_0_15px_cyan]"
                              style={{ left: `${(c.x1 + c.x2)/2}%`, top: `${(c.y1 + c.y2)/2}%` }}
                            ></div>
                          ))}
                       </div>
                    </div>
                 </div>
              </div>
            )}
            
            {/* Minimalist Speed Overlay */}
            {focusMode && (
              <div className="absolute bottom-12 left-12 h-32 w-80 bg-black/80 backdrop-blur-3xl border-l-[6px] border-amber-500 p-8 flex flex-col justify-center animate-in slide-in-from-left duration-700">
                <div className="text-[10px] font-black text-amber-500/60 tracking-[0.5em] mb-2 uppercase">Core Velocity</div>
                <div className="text-6xl font-black text-white leading-none">{telemetry.speed} <span className="text-xs text-amber-500/40 ml-2">MPH</span></div>
              </div>
            )}
          </section>

          {/* Neural Interface Aside */}
          {!focusMode && (
            <aside className="w-[450px] flex flex-col gap-8 animate-in slide-in-from-right duration-700">
              
              {/* Velocity Meter */}
              <div className="border border-cyan-900 bg-cyan-950/10 p-10 flex flex-col items-center">
                 <div className="relative w-56 h-56 flex items-center justify-center">
                   <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                      <circle cx="112" cy="112" r="95" stroke="currentColor" strokeWidth="1" fill="transparent" className="text-cyan-950" />
                      <circle 
                        cx="112" cy="112" r="95" 
                        stroke="currentColor" 
                        strokeWidth="8" 
                        fill="transparent" 
                        strokeDasharray="597" 
                        strokeDashoffset={597 - (597 * speedPct) / 100}
                        strokeLinecap="butt"
                        className={`transition-all duration-1000 ease-out ${primaryColor} opacity-80`} 
                      />
                   </svg>
                   <div className="flex flex-col items-center">
                      <div className="text-[10px] font-black tracking-[0.6em] opacity-30 mb-2 uppercase">Velocity</div>
                      <div className={`text-7xl font-black transition-colors duration-500 ${primaryColor}`}>{telemetry.speed}</div>
                      <div className="text-[10px] font-bold text-white tracking-[0.3em] mt-1">MPH</div>
                   </div>
                 </div>
              </div>

              {/* A.I. Feedback Segment */}
              <div className="flex-1 flex flex-col bg-cyan-950/5 border-t border-cyan-900 overflow-hidden">
                 <div className="p-4 flex items-center gap-3 border-b border-cyan-900/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></div>
                    <span className="text-[10px] font-black tracking-[0.4em] uppercase">Neural_Comms_Link</span>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                    {messages.map((m, i) => (
                      <div key={i} className={`flex flex-col ${m.sender === "User" ? "items-end" : "items-start"}`}>
                         <div className={`p-4 text-[11px] font-bold leading-relaxed border ${m.sender === "User" ? "bg-cyan-500/10 border-cyan-500/50 text-white" : "bg-black border-cyan-900 text-cyan-300"}`}>
                            {m.text}
                         </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                 </div>

                 <div className="p-6 bg-black">
                    <div className="flex gap-4">
                      <button 
                        onClick={startListening}
                        className={`w-14 h-14 flex items-center justify-center border transition-all ${isListening ? "bg-red-500 border-red-400 shadow-[0_0_15px_red]" : "border-cyan-900 text-cyan-600 hover:border-cyan-500"}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                      </button>
                      <input 
                        type="text"
                        className="flex-1 bg-black border border-cyan-900 px-6 text-[11px] font-bold outline-none focus:border-cyan-500 transition-colors text-white placeholder:text-cyan-950"
                        placeholder="ENTER DIRECTIVE..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && sendMessage()}
                      />
                    </div>
                 </div>
              </div>
            </aside>
          )}
        </div>

        {/* Tactical Footer */}
        <footer className="mt-8 flex justify-between items-center text-[9px] font-black tracking-[0.3em] uppercase border-t border-cyan-900/40 pt-6">
           <div className="flex gap-12">
              <div className="flex gap-3 items-center">
                 <span className="opacity-30">Neural Load:</span>
                 <span className="text-cyan-500">22.4%</span>
              </div>
              <div className="flex gap-3 items-center">
                 <span className="opacity-30">Sat Link:</span>
                 <span className="text-emerald-500">Encrypted</span>
              </div>
           </div>
           <div className="text-cyan-500/20 ">OS_KERNEL: STABLE // ARCH: x64_NEURAL</div>
        </footer>
      </div>
    </main>
  );
}


