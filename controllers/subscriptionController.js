import Subscription from '../models/Subscription.js';
import transporter from '../config/mailer.js';

export const subscribe = async (req, res) => {
  try {
    const { email, country } = req.body || {};
    let type = String((req.body?.type || 'job')).trim().toLowerCase();
    if (!['job','blog'].includes(type)) type = 'job';
    const e = String(email || '').trim().toLowerCase();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    // Check for existing subscription
    const existing = await Subscription.findOne({ email: e }).lean();
    if (existing && existing.unsubscribed === false && Array.isArray(existing.types) && existing.types.includes(type)) {
      return res.status(409).json({ error: 'Email already subscribed to this newsletter' });
    }

    // Create or re-activate subscription
    let sub;
    if (existing) {
      sub = await Subscription.findOneAndUpdate(
        { email: e },
        { $set: { unsubscribed: false, country: String(country || existing.country || '') }, $addToSet: { types: type } },
        { new: true }
      );
    } else {
      try {
        sub = await Subscription.create({ email: e, country: String(country || ''), types: [type] });
      } catch (err) {
        if (err && (err.code === 11000 || /E11000/.test(String(err.message)))) {
          // Unique on email hit: fall back to adding the requested type to existing record
          sub = await Subscription.findOneAndUpdate(
            { email: e },
            { $set: { unsubscribed: false, country: String(country || '') }, $addToSet: { types: type } },
            { new: true }
          );
        } else {
          throw err;
        }
      }
    }

    // Send welcome email (non-blocking)
    (async () => {
      try {
        await transporter.sendMail({
          to: sub.email,
          from: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
          subject: type === 'blog' ? 'Welcome to Blog Alerts!' : 'Welcome to Job Alerts!',
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
              <h2 style="margin:0 0 12px">You’re subscribed 🎉</h2>
              ${type === 'blog'
                ? '<p>Thanks for subscribing to our Blog Alerts. We’ll email you when new posts are published.</p>'
                : '<p>Thanks for subscribing to our Job Alerts. We’ll email you when new jobs are posted.</p>'}
              <p style="margin-top:16px">You can unsubscribe anytime.</p>
            </div>
          `,
        });
      } catch (mailErr) {
        console.warn('welcome subscription mail failed:', mailErr?.message || mailErr);
      }
    })();

    const msg = type === 'blog' ? 'Subscribed to Blog Alerts!' : 'Subscribed to Job Alerts!';
    return res.json({ success: true, message: msg, subscriber: { email: sub.email, country: sub.country || '', types: sub.types || [] } });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};

export const unsubscribe = async (req, res) => {
  try {
    const { email, type } = req.body || {};
    const e = String(email || '').trim().toLowerCase();
    if (!e) return res.status(400).json({ error: 'Email is required' });
    const filter = { email: e };
    const update = { $set: { unsubscribed: true } };
    // If a specific type is provided, we remove that type from the array (soft unsubscribe from that list)
    if (type && ['job','blog'].includes(String(type).toLowerCase())) {
      update.$pull = { types: String(type).toLowerCase() };
    }
    const sub = await Subscription.findOneAndUpdate(filter, update, { new: true });
    if (!sub) return res.status(404).json({ error: 'Subscriber not found' });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to unsubscribe' });
  }
};