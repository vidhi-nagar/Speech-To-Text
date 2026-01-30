const mongoose = require("mongoose");

const TranscriptionSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    filePath: { type: String, required: true }, // Multer jahan file save karega
    transcript: { type: String, default: "" }, // API se aane wala text
    transcriptHindi: { type: String, default: "" }, // for hindi audio
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
  },
  { timestamps: true },
); // Isse 'createdAt' apne aap mil jayega

module.exports = mongoose.model("Transcription", TranscriptionSchema);
