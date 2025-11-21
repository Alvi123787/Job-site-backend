import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    password: { type: String, required: true }, // hashed
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    // Profile
    role: { type: String, enum: ['Job Seeker', 'Employer', 'Admin'], default: 'Job Seeker' },
    country: { type: String, trim: true },
    location: { type: String, trim: true },
    profession: { type: String, trim: true },
    bio: { type: String, trim: true },
    phone: { type: String, trim: true },
    avatarUrl: { type: String, trim: true },
    notifications: {
      email: { type: Boolean, default: true },
      jobAlerts: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false },
    },
    // Saved items
    savedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'JobPost' }],
    savedBlogs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Blog' }],
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model('User', UserSchema);