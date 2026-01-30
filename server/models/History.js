const mongoose = require("mongoose");

const HistorySchema = new mongoose.Schema({
  // 🔥 Ye sabse zaruri field hai
  userId: {
    type: String,
    required: true, // Bina user ID ke data save nahi hoga
    index: true, // Indexing se search fast ho jayegi
  },
  transcript: String,
  transcriptHindi: String,
  targetLang: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("History", HistorySchema);
