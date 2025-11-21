import mongoose from 'mongoose';

const JobApplicationSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'JobPost', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Ensure one application per user per job (deduplication at DB level)
JobApplicationSchema.index({ job: 1, user: 1 }, { unique: true });

export default mongoose.models.JobApplication || mongoose.model('JobApplication', JobApplicationSchema);