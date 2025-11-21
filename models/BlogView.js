import mongoose from 'mongoose';

const BlogViewSchema = new mongoose.Schema(
  {
    blog: { type: mongoose.Schema.Types.ObjectId, ref: 'Blog', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

BlogViewSchema.index({ blog: 1, createdAt: 1 });

export default mongoose.models.BlogView || mongoose.model('BlogView', BlogViewSchema);