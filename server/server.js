const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const multer = require("multer");
const path = require("path");
const { createClient } = require("@deepgram/sdk");
const translate = require("google-translate-api-x");
const axios = require("axios");
const History = require("./models/History");

// config
dotenv.config();
const app = express();

// Deepgram Initialize
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// Middleware
app.use(
  cors({
    origin: ["https://speech-to-text-dcdl.vercel.app"],
    methods: ["GET", "POST"],
    credentials: true,
  }),
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Database Connection
connectDB();

// Multer storage (Memory use kar rahe hain processing ke liye)
const upload = multer({ storage: multer.memoryStorage() });

app.get("/", (req, res) => {
  res.send("API is running...");
});

// --- 1. UPLOAD & TRANSLATE ROUTE ---
app.post("/api/upload", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).send("No audio buffer");
    }

    const targetLang = req.body.targetLang || "hi";
    const sourceLang = req.body.sourceLang || "en";
    const userId = req.body.userId; // ✅ Sahi tarika userId nikalne ka

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    console.log(
      `Processing: ${sourceLang} -> ${targetLang} for User: ${userId}`,
    );

    // Deepgram API Call (Speech to Text)
    const deepgramUrl = `https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=${sourceLang}`;
    const deepgramResponse = await axios.post(deepgramUrl, req.file.buffer, {
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": "application/octet-stream",
      },
    });

    const transcriptText =
      deepgramResponse.data.results?.channels[0]?.alternatives[0]?.transcript;

    if (!transcriptText) {
      return res.json({ transcript: "No speech detected", translatedText: "" });
    }

    // Translation logic (Text to Translated Text)
    const translation = await translate(transcriptText, { to: targetLang });

    // ✅ DATABASE SAVE: Transcript milne ke baad hi save karein
    const newHistory = new History({
      userId: userId,
      transcript: transcriptText,
      transcriptHindi: translation.text,
      targetLang: targetLang,
    });

    await newHistory.save();
    console.log("✅ Saved to MongoDB History");

    // Final Response to Frontend
    res.json({
      transcript: transcriptText,
      translatedText: translation.text,
      targetLanguage: targetLang,
    });
  } catch (err) {
    console.error("❌ Server Error Detail:", err.message);
    res.status(500).json({ error: "Processing failed", details: err.message });
  }
});

// --- 2. HISTORY FETCH ROUTE ---
app.get("/api/history", async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "userId query parameter is missing" });
  }

  console.log("Fetching History for UserID:", userId);

  try {
    // Sirf is specific user ki history nikalna
    const history = await History.find({ userId: userId }).sort({
      createdAt: -1,
    });

    console.log(`Data found: ${history.length} items`);
    res.json(history);
  } catch (err) {
    console.error("❌ Database Query Error:", err);
    res
      .status(500)
      .json({ error: "History load nahi ho saki", details: err.message });
  }
});

// Server start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));
