import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    imageUrl: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  { timestamps: true }
);

CategorySchema.pre('validate', function (next) {
  if (this.name && !this.slug) {
    const s = String(this.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    this.slug = s || Date.now().toString(36);
  }
  next();
});

const Category = mongoose.model('Category', CategorySchema);
export default Category;

