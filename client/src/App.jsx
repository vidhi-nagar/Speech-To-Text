import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { supabase } from "./supabaseClient";

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [targetLang, setTargetLang] = useState("hi");
  const [sourceLang, setSourceLang] = useState("en-US");
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // --- STEP 3: Auth State Listener (Zaruri hai user detect karne ke liye) ---
  useEffect(() => {
    // Current session check karein
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Login/Logout hone par auto-update
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );

    return () => authListener.subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setError(error.message);
    setAuthLoading(false);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setError("");
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
    } else {
      alert(
        "Signup success! Check your email (or try logging in if confirmation is off)",
      );
      setIsSignUp(false); // Signup ke baad vapas login par bhej dega
    }
    setAuthLoading(false);
  };

  // --- Recording & Upload Logic (Same as your code) ---
  const startRecording = async () => {
    setLiveTranscript("");
    setResult(null);
    setError("");

    try {
      // 1. Mic Permission Check
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 2. Speech Recognition Check
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert(
          "Aapka browser live typing support nahi karta. Please Chrome use karein.",
        );
        return;
      }

      // 3. Initialize Recognition (IMPORTANT: Shuru mein hi karein)
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = sourceLang;

      // 4. MediaRecorder Setup
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const recordedFile = new File([blob], "recording.webm", {
          type: "audio/webm",
        });
        setFile(recordedFile);
      };

      // 5. Live Transcription Logic (The Fix)
      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        console.log("Captured Text:", transcript); // Debugging ke liye
        setLiveTranscript(transcript);
      };

      recognition.onstart = () => {
        console.log("Mic is now listening...");
      };

      recognition.onerror = (event) => {
        console.error("Recognition Error:", event.error);
        if (event.error === "no-speech") return;
        setError("Speech recognition error: " + event.error);
      };

      // 6. Start Everything
      mediaRecorder.start();
      recognition.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic Error:", err);
      alert("Microphone access deny ho gaya hai!");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsRecording(false);
  };

  const handleUpload = async () => {
    if (!file || !user) return alert("Please login and select a file!");
    setLoading(true);
    const formData = new FormData();
    formData.append("audio", file);
    formData.append("targetLang", targetLang);
    formData.append("sourceLang", sourceLang.split("-")[0]);
    formData.append("userId", user.id);

    try {
      const response = await axios.post(
        "https://speech-to-text-backend-rouge.vercel.app/api/upload",
        formData,
      );
      setResult(response.data);
      fetchHistory();
    } catch (error) {
      setError("Upload failed!");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!user) return;
    try {
      const res = await axios.get(
        `https://speech-to-text-backend-rouge.vercel.app/api/history?userId=${user.id}`,
      );
      setHistory(res.data);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    if (user) fetchHistory();
  }, [user]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 font-sans">
      {!user ? (
        /* --- AUTH CARD (Day 10 UI) --- */
        <div className="w-full max-w-md bg-white/5 p-8 rounded-3xl border border-white/10 shadow-2xl">
          <h2 className="text-3xl font-bold text-cyan-400 mb-2 text-center">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h2>
          <p className="text-slate-400 text-center text-sm mb-8">
            {isSignUp
              ? "Sign up to start translating"
              : "Login to access your history"}
          </p>

          <form
            className="space-y-4"
            onSubmit={isSignUp ? handleSignup : handleLogin}
          >
            <input
              type="email"
              placeholder="Email Address"
              required
              className="w-full p-4 bg-black/40 rounded-xl outline-none border border-white/10 focus:border-cyan-500 transition-all"
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password (Min. 6 characters)"
              required
              className="w-full p-4 bg-black/40 rounded-xl outline-none border border-white/10 focus:border-cyan-500 transition-all"
              onChange={(e) => setPassword(e.target.value)}
            />

            {error && <p className="text-red-400 text-xs py-2">{error}</p>}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-4 bg-cyan-500 rounded-xl font-bold text-black hover:bg-cyan-400 transition-all disabled:opacity-50"
            >
              {authLoading
                ? "Please wait..."
                : isSignUp
                  ? "Create Account"
                  : "Sign In"}
            </button>

            {/* --- TOGGLE BUTTON (Yahan Step 2 Fix kiya hai) --- */}
            <p className="text-center text-sm text-slate-400 mt-6">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError("");
                }}
                className="ml-2 text-cyan-400 font-bold hover:underline"
              >
                {isSignUp ? "Login here" : "Sign up here"}
              </button>
            </p>
          </form>
        </div>
      ) : (
        /* --- MAIN APP INTERFACE --- */
        <div className="w-full max-w-2xl bg-white/5 border border-white/10 p-8 rounded-3xl">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-slate-400">{user.email}</span>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-xs text-red-400 border border-red-400/30 px-3 py-1 rounded-lg hover:bg-red-400/10 transition-all"
            >
              Logout
            </button>
          </div>

          <h1 className="text-3xl font-bold text-center mb-8 text-cyan-400 tracking-tight">
            🎙️ ECHO TRANSLATE AI
          </h1>

          {/* ... Rest of your existing recording and history UI ... */}
          <div className="space-y-6">
            {/* Language Selector Code ... */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col bg-black/20 p-4 rounded-xl border border-white/5">
                <span className="text-[10px] font-bold text-slate-500 uppercase mb-2">
                  I am speaking:
                </span>
                <select
                  value={sourceLang}
                  onChange={(e) => {
                    setSourceLang(e.target.value);
                    if (recognitionRef.current)
                      recognitionRef.current.lang = e.target.value;
                  }}
                  className="bg-transparent text-yellow-400 font-bold outline-none cursor-pointer"
                >
                  <option value="en-US">English (US)</option>
                  <option value="hi-IN">Hindi (हिंदी)</option>
                  <option value="gu-IN">Gujrati</option>
                </select>
              </div>
              <div className="flex flex-col bg-black/20 p-4 rounded-xl border border-white/5">
                <span className="text-[10px] font-bold text-slate-500 uppercase mb-2">
                  Translate to:
                </span>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="bg-transparent text-cyan-400 font-bold outline-none cursor-pointer"
                >
                  <option value="hi">Hindi</option>
                  <option value="en">English</option>
                  <option value="gu">Gujrati</option>
                </select>
              </div>
            </div>

            <div className="mt-4 p-4 border-2 border-dashed border-white/10 rounded-xl hover:border-cyan-500/50 transition-all text-center">
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
                id="fileInput"
              />
              <label
                htmlFor="fileInput"
                className="cursor-pointer text-sm text-slate-400"
              >
                {file && !isRecording
                  ? `Selected: ${file.name}`
                  : "Or click to upload an audio file"}
              </label>
            </div>

            <div className="w-full p-6 bg-black/30 border border-white/5 rounded-2xl min-h-[120px] relative">
              <p className="text-slate-300 italic">
                {liveTranscript || "Aapki awaaz yahan likhi jayegi..."}
              </p>
            </div>

            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-full py-4 rounded-xl font-bold transition-all ${isRecording ? "bg-red-500/20 border-red-500 border text-red-500" : "bg-white/10 text-slate-300"}`}
            >
              {isRecording ? "⏹️ STOP" : "🎙️ START LIVE"}
            </button>

            <button
              onClick={handleUpload}
              disabled={loading || !file || isRecording}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-bold disabled:opacity-20 transition-all transform active:scale-[0.98]"
            >
              {loading ? "PROCESSING..." : "GET TRANSLATION"}
            </button>
          </div>

          {/* Translation Result and History Sections (Same as your code) */}
          {result && (
            <div className="mt-8 space-y-4 animate-in fade-in duration-500">
              <div className="p-4 bg-white/5 rounded-xl border-l-4 border-cyan-500">
                <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">
                  Original
                </p>
                <p>{result.transcript}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border-l-4 border-fuchsia-500 relative group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">
                      Translation
                    </p>
                    <p className="text-xl font-hindi">
                      {result.translatedText}
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(result.translatedText)}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* History Section ... */}
          <div className="mt-12 mb-6 flex justify-between items-center">
            <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">
              Recent History
            </h3>
            {history.length > 2 && (
              <button
                onClick={() => setShowAllHistory(!showAllHistory)}
                className="text-[10px] font-bold text-slate-400 hover:text-cyan-400 underline"
              >
                {showAllHistory ? "SHOW LESS ↑" : "SHOW MORE ↓"}
              </button>
            )}
          </div>
          <div className="space-y-4">
            {history
              .slice(0, showAllHistory ? history.length : 2)
              .map((item) => (
                <div
                  key={item._id}
                  className="p-5 bg-slate-900/50 border border-slate-800 rounded-2xl"
                >
                  <div className="flex justify-between mb-2">
                    <span className="text-[10px] font-bold text-fuchsia-400 bg-fuchsia-400/10 px-2 py-1 rounded-md">
                      {item.targetLang}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-white text-lg font-hindi">
                    {item.transcriptHindi}
                  </p>
                  <p className="text-sm text-slate-400 italic">
                    "{item.transcript}"
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
