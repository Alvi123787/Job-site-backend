import mongoose from 'mongoose';

const SectionSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    image: { type: String, trim: true }, // optional visual
  },
  { _id: false }
);

const FeatureSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    icon: { type: String, trim: true }, // optional emoji or icon text
    text: { type: String, trim: true },
  },
  { _id: false }
);

const StatSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true },
    value: { type: String, trim: true }, // keep as string to allow formats like 500+
  },
  { _id: false }
);

const TeamSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    text: { type: String, trim: true },
    photo: { type: String, trim: true },
    highlights: { type: [String], default: [] },
  },
  { _id: false }
);

const AboutSchema = new mongoose.Schema(
  {
    heroTitle: { type: String, trim: true },
    heroSubtitle: { type: String, trim: true },
    mainImage: { type: String, trim: true },

    sectionTitle: { type: String, trim: true },
    description: { type: String, trim: true },

    mission: { type: SectionSchema, default: {} },
    vision: { type: SectionSchema, default: {} },
    purpose: { type: SectionSchema, default: {} },

    features: { type: [FeatureSchema], default: [] },
    stats: { type: [StatSchema], default: [] },
    team: { type: TeamSchema, default: {} },
  },
  { timestamps: true }
);

export default mongoose.models.About || mongoose.model('About', AboutSchema);