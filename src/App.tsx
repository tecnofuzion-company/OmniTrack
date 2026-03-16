import React, { useState, useRef } from 'react';
import { UploadCloud, Users, LogIn, LogOut, Activity, Video, Mic, BarChart2, AlertCircle, X, Loader2, Volume2, MessageSquare, Globe, Tag, Layout, Eye, FileText, Download } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface RoomStat {
  name: string;
  currentCount: number;
  trafficTrend: 'increasing' | 'decreasing' | 'stable';
  noiseTrend: number[];
  lastEntryTime?: string;
  lastExitTime?: string;
}

interface AnalysisResult {
  isOfficeEnvironment: boolean;
  rejectionReason?: string;

  currentPeopleInRoom?: number;
  totalEntered?: number;
  totalLeft?: number;
  maleCount?: number;
  femaleCount?: number;

  averageAudioVibe?: string;
  audioIntensityLevel?: 'Quiet' | 'Moderate' | 'Loud' | 'Intense';
  audioLanguage?: string;
  audioTranscription?: string;
  audioSummary?: string;
  audioKeywords?: string[];

  meetingRoomFocus?: string;
  outsideMeetingRoom?: string;

  rooms?: RoomStat[];
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelection = (selectedFile?: File) => {
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('video/')) {
      setError({
        title: 'Invalid File Type',
        message: 'Please upload a valid video file (e.g., MP4, WebM, MOV).'
      });
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError({
        title: 'File Too Large',
        message: 'File size exceeds the 50MB limit. Please upload a smaller video.'
      });
      return;
    }
    
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setResult(null);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelection(e.target.files?.[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelection(e.dataTransfer.files?.[0]);
  };

  const clearSelection = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const analyzeVideo = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            const base64 = reader.result.split(',')[1];
            if (base64) {
              resolve(base64);
            } else {
              reject(new Error('Invalid base64 encoding'));
            }
          } else {
            reject(new Error('Failed to read file as string'));
          }
        };
        reader.onerror = () => reject(new Error('FileReader encountered an error'));
        reader.readAsDataURL(file);
      });

      const base64Data = await base64Promise;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: file.type,
                  data: base64Data,
                },
              },
              {
                text: `Analyze this video comprehensively.
CRITICAL RULE 1: First, determine if this video is of an office space, meeting room, or corporate environment. If it is NOT (e.g., it's a park, street, home, etc.), set 'isOfficeEnvironment' to false, provide a 'rejectionReason' (e.g., "Please upload a relevant office-related video."), and leave all other fields empty. Do not analyze further.
CRITICAL RULE 2: If it IS an office environment, set 'isOfficeEnvironment' to true and provide the following detailed analysis:
1. Global Stats: currentPeopleInRoom, totalEntered, totalLeft, maleCount (number of males, 0 if none), femaleCount (number of females, 0 if none).
2. Environment: Focus primarily on the main meeting room ('meetingRoomFocus'). Clearly highlight what is visible outside the meeting room (e.g., through windows/doors) in 'outsideMeetingRoom'. If nothing is visible outside, state "None visible".
3. Audio Intelligence: Identify the 'audioLanguage', provide a full 'audioTranscription', a concise 'audioSummary', a list of 'audioKeywords' (highlighted/important words), a highly granular 'averageAudioVibe', and an 'audioIntensityLevel' ("Quiet", "Moderate", "Loud", or "Intense").
4. Room Breakdown: Break down the scene into distinct areas visible. For each room, provide its name, currentCount of people, trafficTrend ("increasing", "decreasing", or "stable"), a noiseTrend array of exactly 20 integers (0-100) representing the estimated noise level dynamically over the duration of the video, lastEntryTime (timestamp like "01:23" of the most recent entry, or "None"), and lastExitTime (timestamp like "02:45" of the most recent exit, or "None").`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isOfficeEnvironment: { type: Type.BOOLEAN },
              rejectionReason: { type: Type.STRING },
              currentPeopleInRoom: { type: Type.INTEGER },
              totalEntered: { type: Type.INTEGER },
              totalLeft: { type: Type.INTEGER },
              maleCount: { type: Type.INTEGER },
              femaleCount: { type: Type.INTEGER },
              averageAudioVibe: { type: Type.STRING },
              audioIntensityLevel: { type: Type.STRING },
              audioLanguage: { type: Type.STRING },
              audioTranscription: { type: Type.STRING },
              audioSummary: { type: Type.STRING },
              audioKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              meetingRoomFocus: { type: Type.STRING },
              outsideMeetingRoom: { type: Type.STRING },
              rooms: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    currentCount: { type: Type.INTEGER },
                    trafficTrend: { type: Type.STRING },
                    noiseTrend: {
                      type: Type.ARRAY,
                      items: { type: Type.INTEGER }
                    },
                    lastEntryTime: { type: Type.STRING },
                    lastExitTime: { type: Type.STRING }
                  },
                  required: ['name', 'currentCount', 'trafficTrend', 'noiseTrend', 'lastEntryTime', 'lastExitTime']
                }
              }
            },
            required: ['isOfficeEnvironment'],
          },
        },
      });

      if (response.text) {
        try {
          const parsedResult = JSON.parse(response.text) as AnalysisResult;
          setResult(parsedResult);
        } catch (parseError) {
          console.error('Failed to parse AI response:', parseError);
          throw new Error('Received an invalid response format from the AI.');
        }
      } else {
        throw new Error('No response received from the AI model.');
      }
    } catch (err: any) {
      console.error('Analysis error:', err);
      let errorMessage = 'An unexpected error occurred during analysis. Please try again.';
      
      if (err instanceof Error) {
        if (err.message.includes('413') || err.message.toLowerCase().includes('payload too large')) {
          errorMessage = 'The video file is too large for the AI to process in a single request. Please try a shorter or more compressed video.';
        } else if (err.message.includes('fetch') || err.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (err.message.includes('API key not valid')) {
          errorMessage = 'Invalid API key. Please check your configuration.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError({
        title: 'Analysis Failed',
        message: errorMessage
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const exportToCSV = () => {
    if (!result) return;

    const rows: string[][] = [];
    
    const escapeCSV = (str?: string | number | null) => {
      if (str === undefined || str === null) return '""';
      const stringified = String(str);
      return `"${stringified.replace(/"/g, '""')}"`;
    };

    // Global Stats
    rows.push(['--- GLOBAL STATS ---']);
    rows.push(['Net Occupancy', escapeCSV(result.currentPeopleInRoom)]);
    rows.push(['Total Entered', escapeCSV(result.totalEntered)]);
    rows.push(['Total Exited', escapeCSV(result.totalLeft)]);
    rows.push(['Male Count', escapeCSV(result.maleCount)]);
    rows.push(['Female Count', escapeCSV(result.femaleCount)]);
    rows.push([]);

    // Environment
    rows.push(['--- ENVIRONMENT ---']);
    rows.push(['Meeting Room Focus', escapeCSV(result.meetingRoomFocus)]);
    rows.push(['Outside Visibility', escapeCSV(result.outsideMeetingRoom)]);
    rows.push([]);

    // Audio Intelligence
    rows.push(['--- AUDIO INTELLIGENCE ---']);
    rows.push(['Language', escapeCSV(result.audioLanguage)]);
    rows.push(['Intensity Level', escapeCSV(result.audioIntensityLevel)]);
    rows.push(['Average Vibe', escapeCSV(result.averageAudioVibe)]);
    rows.push(['Summary', escapeCSV(result.audioSummary)]);
    rows.push(['Keywords', escapeCSV(result.audioKeywords?.join(', '))]);
    rows.push(['Transcription', escapeCSV(result.audioTranscription)]);
    rows.push([]);

    // Rooms
    rows.push(['--- ROOM BREAKDOWN ---']);
    rows.push(['Room Name', 'Current Count', 'Traffic Trend', 'Last Entry', 'Last Exit']);
    if (result.rooms) {
      result.rooms.forEach(room => {
        rows.push([
          escapeCSV(room.name), 
          escapeCSV(room.currentCount), 
          escapeCSV(room.trafficTrend), 
          escapeCSV(room.lastEntryTime || 'None'), 
          escapeCSV(room.lastExitTime || 'None')
        ]);
      });
    }

    const csvContent = rows.map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `omnitrack-analysis-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#1A1A24] text-white font-sans selection:bg-cyan-500/30 selection:text-cyan-100 pb-20">
      {/* Top Header: The Action Zone */}
      <header className="sticky top-0 z-50 bg-[#1A1A24]/90 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-400/10 p-2 rounded-xl">
            <Activity className="w-6 h-6 text-cyan-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Omni<span className="text-cyan-400">Track</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="video/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-[#2A2A38] hover:bg-[#353546] border border-white/10 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
          >
            <UploadCloud className="w-4 h-4 text-cyan-400" />
            Upload Media
          </button>
          {file && !isAnalyzing && !result && (
            <button
              onClick={analyzeVideo}
              className="bg-cyan-500 hover:bg-cyan-400 text-[#1A1A24] px-5 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(0,229,255,0.3)]"
            >
              <BarChart2 className="w-4 h-4" />
              Analyze Video
            </button>
          )}
          {result && (
            <>
              <button
                onClick={exportToCSV}
                className="bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={clearSelection}
                className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            </>
          )}
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Error Banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-rose-400">{error.title}</h4>
                <p className="text-sm text-rose-300/80 mt-1">{error.message}</p>
              </div>
              <button onClick={() => setError(null)} className="ml-auto text-rose-400/50 hover:text-rose-400">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {!file && !isAnalyzing && !result ? (
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="mt-12 border-2 border-dashed border-white/10 rounded-3xl p-20 flex flex-col items-center justify-center text-center hover:bg-[#2A2A38]/50 hover:border-cyan-400/50 transition-all cursor-pointer group"
          >
            <div className="bg-[#2A2A38] w-20 h-20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
              <Video className="w-10 h-10 text-cyan-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Drop your video here</h2>
            <p className="text-gray-400 max-w-md">
              Upload security footage or meeting room recordings to instantly generate a Video Dashboard with crowd flow and noise analytics.
            </p>
          </div>
        ) : result && !result.isOfficeEnvironment ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-12 flex flex-col items-center justify-center text-center mt-12"
          >
            <AlertCircle className="w-16 h-16 text-rose-400 mb-6" />
            <h2 className="text-3xl font-bold text-white mb-4">Analysis Rejected</h2>
            <p className="text-xl text-rose-300 max-w-2xl">
              {result.rejectionReason || "Please upload a relevant office-related video."}
            </p>
            <button 
              onClick={clearSelection}
              className="mt-8 bg-[#2A2A38] hover:bg-[#353546] border border-white/10 text-white px-6 py-3 rounded-xl font-medium transition-colors"
            >
              Upload Different Video
            </button>
          </motion.div>
        ) : (
          <>
            {/* Top Grid: Source & Global Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
              
              {/* Left Column: The Source (60%) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-[#2A2A38] rounded-2xl p-4 border border-white/5 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <Video className="w-4 h-4 text-cyan-400" />
                      Live Feed
                    </h3>
                    {file && <span className="text-xs text-gray-500 font-mono">{file.name}</span>}
                  </div>
                  
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-white/5">
                    {previewUrl && (
                      <video
                        src={previewUrl}
                        controls
                        className="w-full h-full object-contain"
                      />
                    )}
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-[#1A1A24]/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
                        <p className="text-cyan-400 font-medium animate-pulse">Analyzing Video Data...</p>
                      </div>
                    )}
                  </div>

                  {/* Audio Sync Bar */}
                  <div className="mt-4 bg-[#1A1A24] rounded-xl p-4 border border-white/5 flex items-center gap-4">
                    <Mic className="w-5 h-5 text-purple-500 shrink-0" />
                    <div className="flex-1 flex items-end gap-1 h-8">
                      {/* Fake waveform that animates if analyzing, or shows static if done */}
                      {Array.from({ length: 40 }).map((_, i) => {
                        const height = isAnalyzing 
                          ? Math.random() * 100 
                          : result ? (Math.sin(i) * 50 + 50) : 10;
                        return (
                          <motion.div
                            key={i}
                            animate={{ height: `${height}%` }}
                            transition={{ duration: 0.2, repeat: isAnalyzing ? Infinity : 0, repeatType: 'reverse', delay: i * 0.02 }}
                            className="flex-1 bg-purple-500/80 rounded-t-sm"
                            style={{ minHeight: '4px' }}
                          />
                        );
                      })}
                    </div>
                    <span className="text-xs font-bold text-purple-400 uppercase tracking-widest shrink-0 w-16 text-right">
                      {isAnalyzing ? 'SYNCING' : result ? 'SYNCED' : 'READY'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Global Stats (40%) */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                {/* Net Occupancy */}
                <div className="bg-[#2A2A38] rounded-2xl p-6 border border-white/5 shadow-lg flex-1 flex flex-col justify-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-10">
                    <Users className="w-32 h-32 text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 relative z-10">Net Occupancy</h3>
                  <div className="flex items-baseline gap-3 relative z-10">
                    <span className="text-7xl font-black text-white tracking-tighter">
                      {result ? result.currentPeopleInRoom : '--'}
                    </span>
                    <span className="text-lg font-medium text-cyan-400">Active</span>
                  </div>
                  
                  {result && (
                    <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/10 relative z-10">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Male</span>
                        <span className="text-lg font-bold text-cyan-400">{result.maleCount}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Female</span>
                        <span className="text-lg font-bold text-purple-400">{result.femaleCount}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Traffic Flow */}
                <div className="bg-[#2A2A38] rounded-2xl p-6 border border-white/5 shadow-lg flex-1 flex flex-col justify-center">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Traffic Flow</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <LogIn className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-medium text-gray-500 uppercase">Total Entered</span>
                      </div>
                      <span className="text-4xl font-bold text-emerald-400">
                        {result ? `+${result.totalEntered}` : '--'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <LogOut className="w-4 h-4 text-rose-400" />
                        <span className="text-xs font-medium text-gray-500 uppercase">Total Exited</span>
                      </div>
                      <span className="text-4xl font-bold text-rose-400">
                        {result ? `-${result.totalLeft}` : '--'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acoustic Profile */}
                <div className="bg-[#2A2A38] rounded-2xl p-6 border border-white/5 shadow-lg flex-1 flex flex-col justify-center">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Acoustic Profile</h3>
                    {result && (
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                        result.audioIntensityLevel === 'Quiet' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        result.audioIntensityLevel === 'Moderate' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                        result.audioIntensityLevel === 'Loud' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {result.audioIntensityLevel}
                      </span>
                    )}
                  </div>
                  {result ? (
                    <div className="flex items-start gap-3">
                      <Volume2 className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                      <span className="text-sm font-medium text-gray-300 leading-relaxed">
                        {result.averageAudioVibe}
                      </span>
                    </div>
                  ) : (
                    <span className="text-3xl font-bold text-gray-600">--</span>
                  )}
                </div>
              </div>
            </div>

            {/* Middle Row: Deep Analysis */}
            {result && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6"
              >
                {/* Environment Context */}
                <div className="bg-[#2A2A38] rounded-2xl p-6 border border-white/5 shadow-lg flex flex-col gap-6">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Layout className="w-4 h-4 text-cyan-400" />
                    Spatial Context
                  </h3>
                  
                  <div>
                    <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">Meeting Room Focus</h4>
                    <p className="text-sm text-gray-300 leading-relaxed bg-[#1A1A24] p-4 rounded-xl border border-white/5">
                      {result.meetingRoomFocus}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <Eye className="w-4 h-4" /> Outside Visibility
                    </h4>
                    <p className="text-sm text-gray-300 leading-relaxed bg-[#1A1A24] p-4 rounded-xl border border-white/5">
                      {result.outsideMeetingRoom}
                    </p>
                  </div>
                </div>

                {/* Audio Intelligence */}
                <div className="bg-[#2A2A38] rounded-2xl p-6 border border-white/5 shadow-lg flex flex-col gap-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-purple-400" />
                      Audio Intelligence
                    </h3>
                    <div className="flex items-center gap-2 bg-[#1A1A24] px-3 py-1.5 rounded-lg border border-white/5">
                      <Globe className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">{result.audioLanguage}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#1A1A24] p-4 rounded-xl border border-white/5">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Summary</h4>
                      <p className="text-sm text-gray-300 leading-relaxed">{result.audioSummary}</p>
                    </div>
                    <div className="bg-[#1A1A24] p-4 rounded-xl border border-white/5">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5" /> Keywords
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {result.audioKeywords?.map((kw, i) => (
                          <span key={i} className="text-xs font-medium bg-purple-500/20 text-purple-300 px-2 py-1 rounded-md border border-purple-500/20">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#1A1A24] p-4 rounded-xl border border-white/5 flex-1 flex flex-col min-h-[120px]">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Transcription
                    </h4>
                    <div className="text-sm text-gray-400 leading-relaxed overflow-y-auto max-h-[150px] pr-2 custom-scrollbar">
                      {result.audioTranscription}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Bottom Row: The Room Breakdown */}
            {result && result.rooms && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#2A2A38] rounded-2xl p-6 border border-white/5 shadow-lg"
              >
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Room Breakdown
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {result.rooms.map((room, idx) => (
                    <div key={idx} className="bg-[#1A1A24] rounded-xl p-5 border border-white/5 hover:border-cyan-400/30 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-base font-bold text-white truncate pr-2">{room.name}</h4>
                        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                          room.trafficTrend === 'increasing' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' :
                          room.trafficTrend === 'decreasing' ? 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]' :
                          'bg-gray-500'
                        }`} title={`Traffic: ${room.trafficTrend}`} />
                      </div>
                      
                      <div className="flex items-end justify-between">
                        <div>
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">Current</span>
                          <span className="text-3xl font-black text-white">👤 {room.currentCount}</span>
                        </div>
                        
                        {/* Dynamic Audio Sparkline (20 segments) */}
                        <div className="flex items-end gap-[2px] h-10 w-24 opacity-90" title="Dynamic Noise Trend">
                          {room.noiseTrend.map((val, i) => {
                            // Color code based on intensity
                            let barColor = 'bg-cyan-400';
                            if (val > 75) barColor = 'bg-rose-500';
                            else if (val > 40) barColor = 'bg-purple-400';

                            return (
                              <motion.div 
                                key={i} 
                                initial={{ height: 0 }}
                                animate={{ height: `${Math.max(5, val)}%` }}
                                transition={{ duration: 0.6, delay: i * 0.03, ease: "easeOut" }}
                                className={`flex-1 rounded-t-[1px] ${barColor}`} 
                              />
                            );
                          })}
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-2 text-xs">
                        <div className="flex items-center justify-between text-gray-400">
                          <div className="flex items-center gap-1.5">
                            <LogIn className="w-3.5 h-3.5 text-emerald-400/70" />
                            <span>Last Entry</span>
                          </div>
                          <span className="font-mono text-emerald-400/90 bg-emerald-400/10 px-1.5 py-0.5 rounded">{room.lastEntryTime || 'None'}</span>
                        </div>
                        <div className="flex items-center justify-between text-gray-400">
                          <div className="flex items-center gap-1.5">
                            <LogOut className="w-3.5 h-3.5 text-rose-400/70" />
                            <span>Last Exit</span>
                          </div>
                          <span className="font-mono text-rose-400/90 bg-rose-400/10 px-1.5 py-0.5 rounded">{room.lastExitTime || 'None'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
