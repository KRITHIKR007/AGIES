"use client";

import { useState, useEffect, useRef, useMemo } from "react";

interface Telemetry {
  speed: number;
  alert: string;
  detections: Record<string, number>;
  coords: Array<{ label: string; x: number; y: number; }>;
}

export default function Home() {
  const [messages, setMessages] = useState([{ sender: "AI", text: "SYSTEM OPERATIONAL. VISION ACTIVE." }]);
  const [input, setInput] = useState("");
  const [telemetry, setTelemetry] = useState<Telemetry>({ speed: 0, alert: "NORMAL", detections: {}, coords: [] });
  const [viewMode, setViewMode] = useState("HUD");
  const [isListening, setIsListening] = useState(false);
  const [logs, setLogs] = useState(["[SYS] Boot sequence initiated..."]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("http://127.0.0.1:5000/api/data");
        const data = await res.json();
        setTelemetry(data);
        
        if (data.detections) {
          const dets = Object.entries(data.detections).map(([k, v]) => `${v} ${k}`).join(", ");
          if (dets) {
            setLogs(prev => {
              const newLogs = [...prev, `[SCAN] ${dets}`];
              return newLogs.slice(-15);
            });
          }
        }
      } catch (e) {
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const speak = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 0.95;
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
      setMessages([...newMessages, { sender: "AI", text: "Connection error." }]);
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
    } else {
      alert("Speech recognition not supported in this browser.");
    }
  };

  const radarDots = useMemo(() => {
    return (telemetry.coords || []).map((coord: any) => ({
      top: `${coord.y}%`,
      left: `${coord.x}%`,
    }));
  }, [telemetry.coords]);

  if (!mounted) return null;

  const isDanger = typeof telemetry.alert === "string" && telemetry.alert.includes("DANGER");
  const isWarning = typeof telemetry.alert === "string" && telemetry.alert.includes("WARNING");
  const alertColor = isDanger ? "text-red-500 shadow-red-500" : isWarning ? "text-yellow-500 shadow-yellow-500" : "text-cyan-400 shadow-cyan-400";
  const alertBorder = isDanger ? "border-red-500 border-2" : isWarning ? "border-yellow-500" : "border-cyan-400";

  const speedPct = Math.min(100, (telemetry.speed / 120) * 100);

  return (
    <main className="relative w-screen h-screen bg-black overflow-hidden font-mono text-cyan-400 select-none flex">
      
      {/* Danger Pulse Overlay */}
      <div className={`absolute inset-0 transition-opacity duration-300 pointer-events-none z-[100] ${isDanger ? "opacity-100 bg-red-600/10" : "opacity-0"}`}>
        <div className="absolute top-0 w-full h-32 bg-gradient-to-b from-red-600/40 to-transparent"></div>
        <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-red-600/40 to-transparent"></div>
        {isDanger && (
           <div className="absolute top-24 left-1/2 -translate-x-1/2 animate-pulse bg-red-600/20 px-8 py-2 rounded-full border border-red-500 backdrop-blur-md">
             <h1 className="text-red-500 font-black text-4xl tracking-[0.5em] uppercase drop-shadow-[0_0_15px_rgba(220,38,38,1)]">PROXIMITY ALERT</h1>
           </div>
        )}
      </div>

      {/* Mode Toggles */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex gap-2 pointer-events-auto shadow-xl bg-black/40 rounded-full border border-cyan-900 overflow-hidden backdrop-blur-md">
         <button onClick={() => setViewMode("HUD")} className={`px-8 py-2 font-bold text-sm tracking-widest transition-all ${viewMode === "HUD" ? "bg-cyan-600/30 text-cyan-200 border-b border-cyan-400 shadow-[inset_0_-2px_10px_rgba(34,211,238,0.3)]" : "bg-transparent text-cyan-600 hover:text-cyan-400 hover:bg-cyan-900/30"}`}>HUD</button>
         <button onClick={() => setViewMode("DASHBOARD")} className={`px-8 py-2 font-bold text-sm tracking-widest transition-all ${viewMode === "DASHBOARD" ? "bg-cyan-600/30 text-cyan-200 border-b border-cyan-400 shadow-[inset_0_-2px_10px_rgba(34,211,238,0.3)]" : "bg-transparent text-cyan-600 hover:text-cyan-400 hover:bg-cyan-900/30"}`}>DIAGNOSTICS</button>
      </div>

      {/* Dynamic Background */}
      {viewMode === "HUD" ? (
         <div className="absolute inset-0 z-0">
           <img src="http://127.0.0.1:5000/video_feed" alt="HUD View" className="w-full h-full object-contain bg-black" />
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0.6)_100%)] pointer-events-none"></div>
         </div>
      ) : (
         <div className="absolute inset-0 bg-slate-950 bg-[radial-gradient(ellipse_at_center,rgba(8,145,178,0.15),rgba(0,0,0,1))] z-0">
           <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
         </div>
      )}

      {/* HUD Elements */}
      {viewMode === "HUD" && (
        <div className="absolute w-full h-full flex flex-col justify-between p-10 pointer-events-none z-10">
          
          {/* Top Row Elements */}
          <div className="flex justify-between items-start">
              {/* Top Left: Terminal/Logs */}
              <div className="w-80 bg-black/50 backdrop-blur-md rounded-lg p-4 border border-cyan-800 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-2 mb-3 border-b border-cyan-900/50 pb-2">
                  <span className="w-2 h-2 bg-cyan-400 animate-pulse rounded-full"></span>
                  <h3 className="text-xs font-bold tracking-[0.2em] text-cyan-300">DATA STREAM</h3>
                </div>
                <div className="h-40 overflow-y-auto text-[10px] leading-tight opacity-80 flex flex-col justify-end space-y-2 font-mono scrollbar-hide">
                  {logs.map((L, i) => <div key={i} className="hover:text-white transition-colors">{L}</div>)}
                </div>
              </div>

              {/* Status Tag */}
              <div className={`px-6 py-2 bg-black/70 backdrop-blur-md rounded-xl border flex items-center gap-3 ${alertBorder} mb-auto mt-4`}>
                <span className={`w-3 h-3 rounded-full ${isDanger ? "bg-red-500 animate-ping" : isWarning ? "bg-yellow-500" : "bg-cyan-400"}`}></span>
                <span className={`font-bold tracking-widest text-sm ${alertColor}`}>{telemetry.alert}</span>
              </div>

              {/* Top Right: Speedometer */}
              <div className="bg-black/50 backdrop-blur-md p-6 rounded-2xl border border-cyan-800 flex flex-col items-center shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                    <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-cyan-950" />
                    <circle 
                      cx="80" cy="80" r="70" 
                      stroke="currentColor" 
                      strokeWidth="8" 
                      fill="transparent" 
                      strokeDasharray="440" 
                      strokeDashoffset={440 - (440 * speedPct) / 100}
                      strokeLinecap="round"
                      className={`transition-all duration-700 ease-out ${isDanger ? "text-red-500" : "text-cyan-400"}`} 
                    />
                  </svg>
                  <div className="flex flex-col items-center">
                    <span className={`text-5xl font-black ${alertColor}`}>{telemetry.speed}</span>
                    <span className="text-[10px] opacity-60 tracking-[0.3em] mt-1 text-cyan-200">MPH</span>
                  </div>
                </div>
              </div>
          </div>

          {/* Center Crosshair Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50 z-0">
            <div className="w-56 h-56 rounded-full border-2 border-cyan-800/30 flex items-center justify-center relative">
              <div className="w-2 h-4 bg-cyan-500 absolute top-[-10px]"></div>
              <div className="w-2 h-4 bg-cyan-500 absolute bottom-[-10px]"></div>
              <div className="h-2 w-4 bg-cyan-500 absolute left-[-10px]"></div>
              <div className="h-2 w-4 bg-cyan-500 absolute right-[-10px]"></div>
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_10px_#22d3ee]"></div>
            </div>
          </div>
          
        </div>
      )}

      {/* Diagnostics View */}
      {viewMode === "DASHBOARD" && (
        <div className="flex-1 w-full h-full pt-28 px-10 pb-10 flex gap-8 z-10 pr-[420px] overflow-hidden">
           <div className="flex-1 flex flex-col gap-6 max-w-4xl mx-auto w-full">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-cyan-[950]/30 border border-cyan-600/30 backdrop-blur-xl p-8 rounded-2xl flex flex-col justify-between h-48 shadow-xl">
                  <span className="text-xs tracking-[0.2em] opacity-80 text-cyan-200">TARGETS LOCKED</span>
                  <span className="text-7xl font-light text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">{detectionsArray.length}</span>
                </div>
                <div className="bg-cyan-950/30 border border-cyan-600/30 backdrop-blur-xl p-8 rounded-2xl flex flex-col justify-between h-48 shadow-xl">
                  <span className="text-xs tracking-[0.2em] opacity-80 text-cyan-200">VELOCITY</span>
                  <span className="text-7xl font-light text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">{telemetry.speed}</span>
                </div>
                <div className={`border backdrop-blur-xl p-8 rounded-2xl flex flex-col justify-between h-48 shadow-xl ${isDanger ? "bg-red-900/30 border-red-500" : "bg-cyan-950/30 border-cyan-600/30"}`}>
                  <span className="text-xs tracking-[0.2em] opacity-80 text-cyan-200">THREAT LEVEL</span>
                  <span className={`text-4xl font-medium ${alertColor}`}>{telemetry.alert}</span>
                </div>
              </div>

              {/* Lower Section Split */}
              <div className="flex gap-6 h-full min-h-0">
                {/* Recognition List */}
                <div className="flex-1 bg-cyan-950/30 border border-cyan-600/30 backdrop-blur-xl p-8 rounded-2xl flex flex-col overflow-hidden shadow-xl">
                  <h3 className="text-sm font-bold tracking-[0.2em] mb-6 text-cyan-300 border-b border-cyan-800 pb-3">RECOGNITION MATRIX</h3>
                  {detectionsArray.length === 0 ? (
                       <div className="flex-1 flex flex-col items-center justify-center text-cyan-700/60 italic border-2 border-dashed border-cyan-900/50 rounded-xl">
                          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-50"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                          No active targets...
                       </div>
                   ) : (
                      <div className="grid grid-cols-2 gap-4 overflow-y-auto pr-2 scrollbar-hide">
                          {detectionsArray.map(([name, count]: any) => (
                             <div key={name} className="flex items-center justify-between p-4 bg-black/60 border-l-4 border-cyan-500 border-y border-r border-cyan-900/50 rounded-lg shadow-md transition-all hover:bg-cyan-900/40 cursor-default">
                                <span className="text-lg uppercase font-semibold text-cyan-100">{name}</span>
                                <span className="text-2xl font-black text-cyan-400 bg-cyan-950/80 px-4 py-2 rounded shadow-inner">{count as number}</span>
                             </div>
                          ))}
                      </div>
                   )}
                </div>

                {/* Radar */}
                <div className="w-[320px] bg-cyan-950/30 border border-cyan-600/30 backdrop-blur-xl rounded-2xl p-6 flex flex-col relative overflow-hidden shadow-xl">
                    <h3 className="text-sm font-bold tracking-[0.2em] z-10 text-cyan-300 border-b border-cyan-800 pb-3 w-full mb-6">LIDAR EMULATION</h3>
                    <div className="flex-1 flex items-center justify-center relative">
                      <div className="w-56 h-56 rounded-full border-2 border-cyan-500/40 relative flex items-center justify-center bg-cyan-950/20 shadow-[0_0_30px_rgba(8,145,178,0.2)] inset-0 absolute m-auto">
                        <div className="absolute w-full h-full rounded-full border-r-4 border-cyan-400 animate-spin" style={{ animationDuration: "2s"}}>
                            <div className="w-full h-full bg-[conic-gradient(from_0deg,transparent_0%,rgba(34,211,238,0.2)_100%)] rounded-full"></div>
                        </div>
                        <div className="absolute w-3/4 h-3/4 rounded-full border border-cyan-500/20"></div>
                        <div className="absolute w-1/2 h-1/2 rounded-full border border-cyan-500/20"></div>
                        <div className="w-3 h-3 bg-cyan-300 rounded-full shadow-[0_0_15px_#67e8f9] z-10"></div>
                        {radarDots.map((pos, i) => (
                            <div key={i} className={`absolute w-3 h-3 rounded-full shadow-[0_0_15px_#facc15] ${isDanger ? "bg-red-500 shadow-red-500 animate-ping" : "bg-yellow-400"} `} style={{top: pos.top, left: pos.left}}></div>
                        ))}
                      </div>
                    </div>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* AI Chat Interface (Global) */}
      <div className="absolute bottom-10 right-10 w-[380px] flex flex-col z-50 pointer-events-auto shadow-2xl">
         <div className="bg-black/80 backdrop-blur-xl border-2 border-cyan-800 rounded-2xl overflow-hidden flex flex-col h-[450px]">
            {/* Header */}
            <div className="bg-cyan-950 p-4 border-b-2 border-cyan-800 flex justify-between items-center shadow-md">
              <div className="flex items-center gap-3">
                 <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_#22d3ee]"></span>
                 <span className="font-bold tracking-[0.2em] text-xs text-white">SYS_A.I. LINK</span>
              </div>
              <div className="flex gap-1">
                 <div className="w-1.5 h-1.5 bg-cyan-700 rounded-full"></div>
                 <div className="w-1.5 h-1.5 bg-cyan-700 rounded-full"></div>
                 <div className="w-1.5 h-1.5 bg-cyan-700 rounded-full"></div>
              </div>
            </div>
            
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-5 pb-2 space-y-4 flex flex-col scrollbar-hide">
              {messages.map((msg, idx) => (
                <div key={idx} className={`relative p-3 px-4 rounded-xl text-sm max-w-[90%] font-medium leading-relaxed shadow-md ${msg.sender === "User" ? "bg-cyan-700/40 border border-cyan-500/50 text-cyan-50 self-end rounded-br-sm" : "bg-black/60 border border-cyan-800 text-cyan-300 self-start rounded-bl-sm"}`}>
                  {msg.text}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-black/90 border-t-2 border-cyan-800">
              <div className="flex gap-2">
                <button
                  onClick={startListening}
                  className={`p-3 rounded-xl transition-all flex flex-shrink-0 items-center justify-center shadow-lg ${isListening ? "bg-red-500/20 text-red-500 border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]" : "bg-cyan-900/50 text-cyan-500 border border-cyan-800 hover:bg-cyan-800 hover:text-cyan-300"}`}
                  title="Voice Command Mode"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>
                </button>
                <input
                  type="text"
                  className="flex-1 min-w-0 bg-cyan-950/30 border border-cyan-800 text-cyan-50 text-sm rounded-xl px-4 py-2 outline-none focus:border-cyan-500 focus:bg-cyan-900/40 transition-colors placeholder:text-cyan-800"
                  placeholder="Enter command..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <button
                  onClick={() => sendMessage()}
                  className="bg-cyan-600 hover:bg-cyan-500 text-black p-3 flex-shrink-0 rounded-xl font-bold uppercase tracking-wider transition-colors shadow-[0_0_15px_rgba(8,145,178,0.4)]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path></svg>
                </button>
              </div>
            </div>
         </div>
      </div>
    </main>
  );
}
