import mongoose from 'mongoose';

const SearchQuerySchema = new mongoose.Schema({
  term: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
  count: { type: Number, default: 0 },
  lastUsed: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.SearchQuery || mongoose.model('SearchQuery', SearchQuerySchema);