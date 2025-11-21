import JobApplication from '../models/JobApplication.js';
import BlogView from '../models/BlogView.js';
import JobPost from '../models/JobPost.js';
import User from '../models/User.js';
import SearchQuery from '../models/SearchQuery.js';

// GET /api/analytics/engagement?days=14
// Optional: start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns daily counts for job applications and blog views
export const getEngagementOverTime = async (req, res) => {
  try {
    const today = new Date();
    let start;
    let end;

    const qStart = String(req.query.start || '').trim();
    const qEnd = String(req.query.end || '').trim();
    const daysParam = Number(req.query.days);

    if (qStart && qEnd) {
      const s = new Date(qStart);
      const e = new Date(qEnd);
      if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) {
        return res.status(400).json({ error: 'Invalid start or end date' });
      }
      // normalize to local midnight for consistency
      start = new Date(s.getFullYear(), s.getMonth(), s.getDate());
      end = new Date(e.getFullYear(), e.getMonth(), e.getDate());
      if (start > end) [start, end] = [end, start];
      // clamp range to 180 days to prevent heavy queries
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      if (diffDays > 180) {
        return res.status(400).json({ error: 'Range too large. Max 180 days.' });
      }
    } else {
      const days = Math.max(1, Math.min(90, Number.isFinite(daysParam) ? daysParam : 14));
      end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (days - 1));
    }

    const groupFmt = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };

    const [appsAgg, viewsAgg] = await Promise.all([
      JobApplication.aggregate([
        { $match: { createdAt: { $gte: start, $lte: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999) } } },
        { $group: { _id: groupFmt, count: { $sum: 1 } } },
      ]),
      BlogView.aggregate([
        { $match: { createdAt: { $gte: start, $lte: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999) } } },
        { $group: { _id: groupFmt, count: { $sum: 1 } } },
      ]),
    ]);

    const appsMap = new Map(appsAgg.map((a) => [a._id, a.count]));
    const viewsMap = new Map(viewsAgg.map((v) => [v._id, v.count]));

    const series = [];
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      series.push({
        date: key,
        jobApplications: appsMap.get(key) || 0,
        blogViews: viewsMap.get(key) || 0,
      });
    }

    const totalApplicants = series.reduce((s, r) => s + r.jobApplications, 0);
    const totalBlogViews = series.reduce((s, r) => s + r.blogViews, 0);

    return res.json({ days: series, totalApplicants, totalBlogViews, start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10) });
  } catch (err) {
    console.error('getEngagementOverTime error', err);
    return res.status(500).json({ error: 'Failed to fetch engagement stats' });
  }
};

// GET /api/analytics/totals
// Returns live totals for jobs, companies, users, applications
export const getTotals = async (_req, res) => {
  try {
    const baseCounts = await Promise.all([
      JobPost.countDocuments({}),
      User.countDocuments({}),
      JobApplication.countDocuments({}),
    ]);
    const [jobsTotal, usersTotal, applicationsTotal] = baseCounts;
    return res.json({ jobsTotal, usersTotal, applicationsTotal });
  } catch (err) {
    console.error('getTotals error', err);
    return res.status(500).json({ error: 'Failed to fetch totals' });
  }
};

// POST /api/analytics/search
// Records one or more search terms used by users
export const recordSearchTerm = async (req, res) => {
  try {
    const termsInput = Array.isArray(req.body?.terms) ? req.body.terms : [];
    let single = String(req.body?.term || req.query?.term || req.body?.q || req.query?.q || '').trim();
    const loc = String(req.body?.loc || req.query?.loc || '').trim();

    const stopwords = new Set(['in','and','or','the','of','for','to','a','an','by','with']);
    const tokenize = (t) => String(t || '')
      .toLowerCase()
      .split(/[^a-z0-9+.#]+/)
      .map(s => s.trim())
      .filter(s => s && s.length >= 3 && !stopwords.has(s));

    let candidates = [];
    if (termsInput.length) {
      candidates = termsInput.map(t => String(t).trim()).filter(Boolean);
    } else if (single) {
      candidates = tokenize(single);
    }
    if (/remote/i.test(loc)) {
      candidates.push('remote');
    }
    // De-duplicate
    candidates = Array.from(new Set(candidates.map(c => c.toLowerCase())));

    if (!candidates.length) {
      return res.json({ ok: true, recorded: 0 });
    }

    const now = new Date();
    await Promise.all(candidates.map(async (term) => {
      try {
        await SearchQuery.updateOne(
          { term },
          { $inc: { count: 1 }, $set: { lastUsed: now } },
          { upsert: true }
        );
      } catch (_) {
        // swallow errors (e.g., DB not connected) to avoid impacting UX
      }
    }));

    return res.json({ ok: true, recorded: candidates.length });
  } catch (err) {
    console.error('recordSearchTerm error', err);
    // Graceful success even if DB unavailable
    return res.json({ ok: true, recorded: 0 });
  }
};

// GET /api/analytics/popular-searches?limit=7&days=90
// Returns top search terms by frequency
export const getPopularSearches = async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(20, Number(req.query?.limit) || 7));
    const days = Number(req.query?.days);
    const hasDays = Number.isFinite(days) && days > 0;
    const since = hasDays ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;

    const filter = since ? { lastUsed: { $gte: since } } : {};
    let docs = [];
    try {
      docs = await SearchQuery.find(filter).sort({ count: -1, lastUsed: -1 }).limit(limit);
    } catch (_) {
      docs = [];
    }

    const fallback = ['Remote','Frontend','Fullstack','React','Developer','JavaScript','Internship'];
    const terms = (Array.isArray(docs) && docs.length)
      ? docs.map(d => String(d.term || '').trim()).filter(Boolean)
      : fallback.slice(0, limit);
    // Title-case for display
    const display = terms.map(t => t.charAt(0).toUpperCase() + t.slice(1));
    return res.json(display);
  } catch (err) {
    console.error('getPopularSearches error', err);
    const fallback = ['Remote','Frontend','Fullstack','React','Developer','JavaScript','Internship'];
    return res.json(fallback.slice(0, Math.max(1, Math.min(20, Number(req.query?.limit) || 7))));
  }
};