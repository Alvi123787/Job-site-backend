import Company from '../models/Company.js';
import JobPost from '../models/JobPost.js';

// GET /api/companies
// Supports filters: featured=true|false, sort=openPositions, limit
export const getCompanies = async (req, res) => {
  try {
    const { featured, sort, active } = req.query;
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    
    // If active=true, compute companies based on non-expired jobs (ensures accurate counts)
    if (String(active).toLowerCase() === 'true') {
      const now = new Date();
      const matchActive = {
        $and: [
          { $or: [
            { endDate: { $exists: false } },
            { endDate: null },
            { endDate: { $gte: now } },
          ] },
          { $or: [
            { status: { $exists: false } },
            { status: { $ne: 'Expired' } },
          ] },
        ]
      };

      const agg = await JobPost.aggregate([
        { $match: matchActive },
        { $group: { _id: '$company', openPositions: { $sum: 1 }, companyLogo: { $first: '$companyLogo' }, category: { $first: '$category' } } },
        { $sort: (String(sort).toLowerCase() === 'openpositions') ? { openPositions: -1 } : { _id: 1 } },
        { $limit: limit },
      ]);

      // Merge with Company docs (if exist) for logo/location/industry
      const names = agg.map(a => a._id).filter(Boolean);
      const docs = await Company.find({ companyName: { $in: names } });
      const byName = new Map(docs.map(d => [d.companyName, d]));
      const companies = agg.map(a => {
        const doc = byName.get(a._id);
        return {
          companyName: a._id,
          logo: (doc?.logo || a.companyLogo || undefined),
          location: doc?.location,
          industry: doc?.industry || a.category,
          openPositions: a.openPositions || 0,
          featured: !!doc?.featured,
          _id: doc?._id || undefined,
        };
      });
      return res.json({ companies, totalCompanies: companies.length });
    }

    // Default: return companies from Company collection (may include stale counts)
    const query = {};
    if (typeof featured !== 'undefined') {
      const v = String(featured).toLowerCase();
      if (v === 'true') query.featured = true; else if (v === 'false') query.featured = false;
    }
    const sortOpt = (String(sort).toLowerCase() === 'openpositions') ? { openPositions: -1, createdAt: -1 } : { createdAt: -1 };
    const companies = await Company.find(query).sort(sortOpt).limit(limit);

    if ((featured === 'true') && companies.length === 0) {
      const topByPositions = await Company.find({}).sort({ openPositions: -1, createdAt: -1 }).limit(limit);
      return res.json({ companies: topByPositions, totalCompanies: topByPositions.length });
    }
    return res.json({ companies, totalCompanies: companies.length });
  } catch (err) {
    console.error('getCompanies error', err);
    return res.status(500).json({ error: 'Failed to fetch companies' });
  }
};

// Helper to upsert company and increment openPositions when new job is created
export const upsertCompanyFromJob = async (job) => {
  try {
    if (!job || !job.company) return;
    // Derive location string from job fields
    const location = job.remote ? 'Remote' : `${job.city}${job.state ? ', ' + job.state : ''}, ${job.country}`;
    await Company.findOneAndUpdate(
      { companyName: job.company },
      {
        $setOnInsert: { companyName: job.company },
        $set: {
          logo: job.companyLogo || undefined,
          industry: job.category || undefined,
          location,
        },
        $inc: { openPositions: 1 },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.warn('upsertCompanyFromJob warning:', err?.message || err);
  }
};

// POST /api/companies/backfill
// Populate/refresh Company collection from existing JobPost documents
export const backfillCompaniesFromJobs = async (req, res) => {
  try {
    const groups = await JobPost.aggregate([
      {
        $group: {
          _id: '$company',
          openPositions: { $sum: 1 },
          companyLogo: { $first: '$companyLogo' },
          category: { $first: '$category' },
          remote: { $first: '$remote' },
          city: { $first: '$city' },
          state: { $first: '$state' },
          country: { $first: '$country' },
        },
      },
    ]);

    let created = 0;
    let updated = 0;

    for (const g of groups) {
      const name = g._id;
      const location = g.remote ? 'Remote' : `${g.city || ''}${g.state ? ', ' + g.state : ''}${g.country ? (g.city || g.state ? ', ' : '') + g.country : ''}`.trim();
      const resUpdate = await Company.updateOne(
        { companyName: name },
        {
          $setOnInsert: { companyName: name },
          $set: {
            logo: g.companyLogo || undefined,
            industry: g.category || undefined,
            location: location || undefined,
            openPositions: g.openPositions || 0,
          },
        },
        { upsert: true }
      );
      // resUpdate.upsertedCount exists in newer drivers; fallback by checking matchedCount
      if (resUpdate.upsertedCount && resUpdate.upsertedCount > 0) created += resUpdate.upsertedCount;
      else if (resUpdate.matchedCount) updated += resUpdate.matchedCount;
      else updated += 1; // conservative fallback
    }

    return res.json({ ok: true, companiesProcessed: groups.length, created, updated });
  } catch (err) {
    console.error('backfillCompaniesFromJobs error', err);
    return res.status(500).json({ error: 'Failed to backfill companies' });
  }
};