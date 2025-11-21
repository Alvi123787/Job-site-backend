import mongoose from 'mongoose';

const ContactMessageSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    receivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.ContactMessage || mongoose.model('ContactMessage', ContactMessageSchema);