import mongoose from 'mongoose';

const CompanySchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true, unique: true },
    logo: { type: String, trim: true },
    location: { type: String, trim: true },
    industry: { type: String, trim: true },
    openPositions: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.models.Company || mongoose.model('Company', CompanySchema);