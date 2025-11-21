import mongoose from 'mongoose';

const SubscriptionSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  country: { type: String, default: '' },
  // Newsletter types this email is subscribed to: e.g., ['job', 'blog']
  types: { type: [String], default: ['job'] },
  unsubscribed: { type: Boolean, default: false },
}, { timestamps: true });

// Keep a unique index on email to avoid multiple documents per address.
// We store multiple newsletter subscriptions in the single document via `types` array.
SubscriptionSchema.index({ email: 1 }, { unique: true });

export default mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema);