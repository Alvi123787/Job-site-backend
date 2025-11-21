import JobPost from '../models/JobPost.js';
import buildJobJsonLd from '../helpers/buildJobJsonLd.js';
import JobApplication from '../models/JobApplication.js';
import { upsertCompanyFromJob } from './companyController.js';
import Subscription from '../models/Subscription.js';
import transporter from '../config/mailer.js';

// Helper to parse numeric fields safely
const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export const createJob = async (req, res) => {
  try {
    const payload = { ...req.body };

    // Normalize numbers
    if (payload.salaryMin !== undefined) payload.salaryMin = toNumber(payload.salaryMin);
    if (payload.salaryMax !== undefined) payload.salaryMax = toNumber(payload.salaryMax);

    // Validate endDate: required and future
    const endRaw = payload.endDate;
    const endTs = endRaw ? new Date(endRaw).getTime() : NaN;
    if (!Number.isFinite(endTs)) {
      return res.status(400).json({ error: 'endDate is required and must be a valid date' });
    }
    if (endTs < Date.now()) {
      return res.status(400).json({ error: 'endDate must be a future date' });
    }

    // Build JSON-LD before create so it persists with the document
    try {
      const site = {
        name: process.env.SITE_NAME || 'MySite',
        url: process.env.SITE_URL || 'https://example.com',
        logo: process.env.SITE_LOGO || undefined,
      };
      const dto = {
        ...payload,
        isRemote: payload.remote,
        datePosted: payload.postingDate,
        validThrough: payload.endDate,
        employmentType: payload.jobType,
        salaryCurrency: payload.currency,
        salaryUnit: String(payload.salaryPer || '').toUpperCase(),
        companyName: payload.company,
        companyLogo: payload.companyLogo,
        region: payload.state,
        city: payload.city,
        country: payload.country,
      };
      payload.schemaJsonLd = buildJobJsonLd(dto, site);
    } catch (e) {
      console.warn('createJob: failed to generate schemaJsonLd (non-fatal):', e?.message || e);
    }

    const job = await JobPost.create(payload);
    // Reflect job creation in Company collection (increment open positions)
    try { await upsertCompanyFromJob(job); } catch (_) {}
    // Fire-and-forget subscriber notifications; do not block response
    (async () => {
      try {
        // Notify subscribers to Job Alerts (fallback to legacy records without `types`)
        const subs = await Subscription.find({
          unsubscribed: { $ne: true },
          $or: [
            { types: 'job' },
            { types: { $exists: false } },
          ],
        }).lean();
        if (subs && subs.length) {
          const FRONTEND_BASE = process.env.FRONTEND_BASE || 'http://localhost:5174';
          const jobUrl = `${FRONTEND_BASE}/jobs/${job._id}`;
          const subject = `New Job Posted: ${job.title} at ${job.company}`;

          const lines = [
            `A new job has been posted${job.country ? ` in ${job.country}` : ''}.`,
            '',
            `Title: ${job.title}`,
            `Company: ${job.company}`,
            `Location: ${[job.city, job.state, job.country].filter(Boolean).join(', ')}`,
            job.jobType ? `Job Type: ${job.jobType}` : '',
          ].filter(Boolean);

          const salaryLabel = (() => {
            const min = job.salaryMin;
            const max = job.salaryMax;
            const currency = job.currency || '';
            const per = job.salaryPer || '';
            if (min || max) {
              const range = `${min ?? ''}${min && max ? ' - ' : ''}${max ?? ''}`.trim();
              const capPer = per ? ` / ${per}` : '';
              return `${currency ? currency + ' ' : ''}${range}${capPer}`;
            }
            return '';
          })();

          const html = `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
              <h2 style="margin:0 0 12px">New Job Alert 🚀</h2>
              <p style="margin:0 0 8px"><strong>${job.title}</strong></p>
              <p style="margin:0 0 8px"><strong>Company:</strong> ${job.company}</p>
              <p style="margin:0 0 8px"><strong>Location:</strong> ${[job.city, job.state, job.country].filter(Boolean).join(', ')}</p>
              ${job.jobType ? `<p style=\"margin:0 0 8px\"><strong>Type:</strong> ${job.jobType}</p>` : ''}
              ${salaryLabel ? `<p style=\"margin:0 0 12px\"><strong>Salary:</strong> ${salaryLabel}</p>` : ''}
              <a href="${jobUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px" target="_blank" rel="noopener noreferrer">View Details</a>
              <p style="margin-top:16px;font-size:12px;color:#64748b">You’re receiving this because you subscribed to Job Alerts.</p>
            </div>
          `;

          console.log(`Sending job alerts to ${subs.length} subscribers`);
          const sends = subs
            .map(s => s?.email)
            .filter(Boolean)
            .map((to) => transporter.sendMail({
              from: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
              to,
              subject,
              text: lines.join('\n'),
              html,
            }));

          // Do not block job creation; log failures
          const results = await Promise.allSettled(sends);
          const failed = results.filter(r => r.status === 'rejected');
          if (failed.length) {
            console.warn(`Job alert emails failed for ${failed.length} recipient(s)`);
          }
        }
      } catch (err) {
        console.error('Subscription notify error', err?.message || err);
      }
    })();
    return res.status(201).json(job);
  } catch (err) {
    console.error('createJob error', err);
    return res.status(400).json({ error: err.message || 'Invalid job data' });
  }
};

export const getJobs = async (req, res) => {
  try {
    const now = new Date();
    // Base query: only active (not expired) job posts
    const query = {
      $or: [
        { endDate: { $exists: false } },
        { endDate: null },
        { endDate: { $gte: now } }
      ]
    };

    // Optional filters
    const { featured } = req.query;
    if (typeof featured !== 'undefined') {
      const val = String(featured).toLowerCase();
      if (val === 'true') query.featured = true;
      else if (val === 'false') query.featured = false;
    }
    // Pagination params
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Total count for pagination
    const totalJobs = await JobPost.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(totalJobs / limit));

    // Page data
    const jobs = await JobPost
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.json({ jobs, totalJobs, totalPages });
  } catch (err) {
    console.error('getJobs error', err);
    return res.status(500).json({ error: 'Failed to fetch jobs' });
  }
};

export const getJobById = async (req, res) => {
  try {
    const job = await JobPost.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.endDate && new Date(job.endDate).getTime() < Date.now()) {
      return res.status(404).json({ error: 'This job post has expired' });
    }
    return res.json(job);
  } catch (err) {
    console.error('getJobById error', err);
    return res.status(400).json({ error: 'Invalid job id' });
  }
};

export const updateJob = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.salaryMin !== undefined) updates.salaryMin = toNumber(updates.salaryMin);
    if (updates.salaryMax !== undefined) updates.salaryMax = toNumber(updates.salaryMax);
    let job = await JobPost.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    // Regenerate JSON-LD after update
    try {
      const site = {
        name: process.env.SITE_NAME || 'MySite',
        url: process.env.SITE_URL || 'https://example.com',
        logo: process.env.SITE_LOGO || undefined,
      };
      const dto = {
        ...job.toObject(),
        isRemote: job.remote,
        datePosted: job.postingDate,
        validThrough: job.endDate,
        employmentType: job.jobType,
        salaryCurrency: job.currency,
        salaryUnit: String(job.salaryPer || '').toUpperCase(),
        companyName: job.company,
        companyLogo: job.companyLogo,
        region: job.state,
        city: job.city,
        country: job.country,
      };
      job.schemaJsonLd = buildJobJsonLd(dto, site);
      job = await job.save();
    } catch (e) {
      console.warn('updateJob: failed to generate schemaJsonLd (non-fatal):', e?.message || e);
    }
    return res.json(job);
  } catch (err) {
    console.error('updateJob error', err);
    return res.status(400).json({ error: err.message || 'Failed to update job' });
  }
};

export const deleteJob = async (req, res) => {
  try {
    const job = await JobPost.findByIdAndDelete(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error('deleteJob error', err);
    return res.status(400).json({ error: 'Invalid job id' });
  }
};

// POST /api/jobs/:id/apply
// Increments applicationsCount for a job when a user clicks Apply
export const applyToJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const job = await JobPost.findById(jobId).select('_id applicationsCount endDate');
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.endDate && new Date(job.endDate).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Job has expired' });
    }

    try {
      await JobApplication.create({ job: job._id, user: userId });
      await JobPost.updateOne({ _id: job._id }, { $inc: { applicationsCount: 1 } });
      const updated = await JobPost.findById(job._id).select('applicationsCount');
      return res.json({ success: true, applicationsCount: Number(updated?.applicationsCount || 0), applied: true, new: true });
    } catch (err) {
      // Duplicate application (unique index violation)
      if (err && err.code === 11000) {
        return res.json({ success: true, applicationsCount: Number(job.applicationsCount || 0), applied: true, new: false });
      }
      console.error('applyToJob error', err);
      return res.status(400).json({ error: 'Failed to apply' });
    }
  } catch (err) {
    console.error('applyToJob error', err);
    return res.status(400).json({ error: 'Invalid job id' });
  }
};

// GET /api/jobs/:id/apply/status
// Returns whether current user already applied and latest count
export const getApplyStatus = async (req, res) => {
  try {
    const jobId = req.params.id;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const [job, existing] = await Promise.all([
      JobPost.findById(jobId).select('applicationsCount'),
      JobApplication.findOne({ job: jobId, user: userId }).select('_id'),
    ]);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json({ applied: !!existing, applicationsCount: Number(job.applicationsCount || 0) });
  } catch (err) {
    console.error('getApplyStatus error', err);
    return res.status(400).json({ error: 'Invalid job id' });
  }
};

// GET /api/jobs/categories
// Returns distinct categories with active job counts
export const getCategories = async (req, res) => {
  try {
    const now = new Date();
    const matchActive = {
      $or: [
        { endDate: { $exists: false } },
        { endDate: null },
        { endDate: { $gte: now } }
      ]
    };

    const agg = await JobPost.aggregate([
      { $match: matchActive },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const categories = agg.map(c => ({ name: c._id, count: c.count }));
    return res.json({ categories, totalCategories: categories.length });
  } catch (err) {
    console.error('getCategories error', err);
    return res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

// GET /api/jobs/stats
// Returns counts for total, active, draft (pending), expired and recent jobs
export const getJobStats = async (_req, res) => {
  try {
    const now = new Date();

    const totalJobs = await JobPost.countDocuments({});
    const activeJobs = await JobPost.countDocuments({
      $and: [
        { $or: [
          { endDate: { $exists: false } },
          { endDate: null },
          { endDate: { $gte: now } },
        ] },
        { status: { $ne: 'Draft' } },
      ],
    });
    const draftJobs = await JobPost.countDocuments({ status: 'Draft' });
    const expiredJobs = await JobPost.countDocuments({
      $or: [
        { status: 'Expired' },
        { endDate: { $lt: now } },
      ],
    });

    const recent = await JobPost.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('title status createdAt company applicationsCount');

    const recentJobs = recent.map((j) => ({
      id: String(j._id),
      title: j.title,
      status: j.status || 'Active',
      date: j.createdAt,
      company: j.company || '',
      applications: Number(j.applicationsCount || 0),
    }));

    return res.json({ totalJobs, activeJobs, draftJobs, expiredJobs, recentJobs });
  } catch (err) {
    console.error('getJobStats error', err);
    return res.status(500).json({ error: 'Failed to fetch job stats' });
  }
};