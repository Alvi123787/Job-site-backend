import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import transporter from '../config/mailer.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5175';

export const signup = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      country,
      location,
      profession,
      bio,
      phone,
      avatarUrl,
      acceptTerms,
    } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }
    if (!role || !['Job Seeker', 'Employer', 'Admin'].includes(role)) {
      return res.status(400).json({ error: 'Valid role is required' });
    }
    if (!acceptTerms) {
      return res.status(400).json({ error: 'You must accept the Terms and Privacy Policy' });
    }
    if (!profession || !bio) {
      return res.status(400).json({ error: 'profession and bio are required to complete profile' });
    }
    if (!location && !country) {
      return res.status(400).json({ error: 'location or country is required' });
    }
    if (String(password).length < 8 || !/[0-9]/.test(password) || !/[A-Za-z]/.test(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters and include letters and numbers' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashed,
      role,
      country: country || undefined,
      location: location || undefined,
      profession,
      bio,
      phone: phone || undefined,
      avatarUrl: avatarUrl || undefined,
      notifications: { email: true, jobAlerts: role === 'Job Seeker', marketing: false },
    });

    // Issue JWT so the client can be auto-logged-in after signup
    const token = jwt.sign({ id: String(user._id), email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    // Optional: send welcome email (non-blocking). Failures don’t block signup.
    try {
      await transporter.sendMail({
        from: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
        to: user.email,
        subject: 'Welcome to CareerHub',
        html: `
          <p>Hello ${user.name},</p>
          <p>Welcome to CareerHub! Your profile has been created with the role <strong>${role}</strong>.</p>
          <p>You can manage your profile here: <a href="${FRONTEND_URL}/profile">${FRONTEND_URL}/profile</a></p>
          <p>Happy exploring!</p>
        `,
      });
    } catch (mailErr) {
      console.warn('welcome mail failed:', mailErr?.message);
    }

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        location: user.location || user.country || '',
        profession: user.profession || '',
        bio: user.bio || '',
        avatarUrl: user.avatarUrl || '',
      },
      message: 'Account created successfully',
    });
  } catch (err) {
    console.error('signup error', err);
    return res.status(500).json({ error: 'Failed to create account' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: String(user._id), email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ error: 'Login failed' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email is required' });

    const user = await User.findOne({ email });
    // Always respond success to avoid disclosing account existence
    if (!user) return res.json({ message: 'If the email exists, a reset link has been sent.' });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    user.resetPasswordToken = tokenHash;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const resetUrl = `${FRONTEND_URL}/reset-password/${token}`;
    await transporter.sendMail({
      from: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <p>Hello ${user.name || ''},</p>
        <p>You requested a password reset. Click the link below to set a new password. This link expires in 1 hour.</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>If you did not request this, you can safely ignore this email.</p>
      `,
    });

    return res.json({ message: 'Password reset link has been sent to your email.' });
  } catch (err) {
    console.error('forgotPassword error', err);
    return res.status(500).json({ error: 'Failed to process password reset' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    const { password } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Invalid token' });
    if (!password) return res.status(400).json({ error: 'password is required' });
    if (String(password).length < 8 || !/[0-9]/.test(password) || !/[A-Za-z]/.test(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters and include letters and numbers' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ resetPasswordToken: tokenHash, resetPasswordExpires: { $gt: new Date() } });
    if (!user) return res.status(400).json({ error: 'Token is invalid or has expired' });

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();
    return res.json({ message: 'Password has been reset successfully. Please log in.' });
  } catch (err) {
    console.error('resetPassword error', err);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
};