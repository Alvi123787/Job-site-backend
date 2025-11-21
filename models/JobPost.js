import mongoose from 'mongoose';
import buildJobJsonLd from '../helpers/buildJobJsonLd.js';

const JobPostSchema = new mongoose.Schema(
  {
    // 1. Basic Info
    title: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    companyLogo: { type: String, trim: true }, // URL or base64
    category: { type: String, required: true, trim: true },
    jobType: { type: String, required: true, trim: true },
    workMode: { type: String, required: true, trim: true },
    featured: { type: Boolean, default: false },

    // 2. Location
    country: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    remote: { type: Boolean, default: false },

    // 3. Details
    shortDescription: { type: String, required: true, trim: true },
    longDescription: { type: String, required: true, trim: true },
    skills: { type: [String], default: [] },
    experience: { type: String, required: true, trim: true },
    education: { type: String, trim: true },
    employmentLevel: { type: String, required: true, trim: true },

    // 4. Compensation
    salaryMin: { type: Number },
    salaryMax: { type: Number },
    currency: { type: String, default: 'USD' },
    salaryPer: { type: String, default: 'Year' },
    benefits: { type: String, trim: true },

    // 5. Timeline
    deadline: { type: Date },
    postingDate: { type: Date, default: Date.now },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator: function(v) {
          if (!v) return false;
          try {
            const ts = (v instanceof Date) ? v.getTime() : new Date(v).getTime();
            return Number.isFinite(ts) && ts >= Date.now();
          } catch (_) { return false; }
        },
        message: 'endDate must be a future date'
      }
    },

    // 6. Application
    apply: { type: String, required: true, trim: true },
    website: { type: String, trim: true },
    // Applicants count (incremented when users click Apply)
    applicationsCount: { type: Number, default: 0 },

    // 7. Tags
    tags: { type: [String], default: [] },

    // 8. Ownership & Status
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['Active', 'Draft', 'Expired'], default: 'Active' },
    // Generated JSON-LD for SEO rich results (JobPosting)
    schemaJsonLd: { type: String },
  },
  { timestamps: true }
);

// Generate schemaJsonLd before saving (fallback if not already set by controllers)
JobPostSchema.pre('save', function(next) {
  try {
    if (!this.schemaJsonLd) {
      const site = {
        name: process.env.SITE_NAME || 'MySite',
        url: process.env.SITE_URL || 'https://example.com',
        logo: process.env.SITE_LOGO || undefined,
      };
      const dto = {
        ...this.toObject(),
        isRemote: this.remote,
        datePosted: this.postingDate,
        validThrough: this.endDate,
        employmentType: this.jobType,
        salaryCurrency: this.currency,
        salaryUnit: String(this.salaryPer || '').toUpperCase(),
        companyName: this.company,
        companyLogo: this.companyLogo,
        region: this.state,
        city: this.city,
        country: this.country,
      };
      this.schemaJsonLd = buildJobJsonLd(dto, site);
    }
  } catch (err) {
    console.error('Failed to build job schema:', err);
  }
  next();
});

export default mongoose.models.JobPost || mongoose.model('JobPost', JobPostSchema);