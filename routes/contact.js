import { Router } from 'express';
import transporter from '../config/mailer.js';
import ContactMessage from '../models/ContactMessage.js';

const router = Router();

// Handle contact form submissions
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const fullName = body.fullName || body.name;
    const email = body.email;
    const subject = body.subject || 'New Contact Message';
    const message = body.message;

    // Basic validation
    if (!fullName || !email || !message) {
      return res.status(400).json({ success: false, message: 'name/fullName, email and message are required.' });
    }

    const emailRegex = /^(?:[a-zA-Z0-9_'^&+\-])+(?:\.(?:[a-zA-Z0-9_'^&+\-])+)*@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    // Persist if possible
    try {
      await ContactMessage.create({ fullName, email, subject, message });
    } catch (err) {
      // Non-fatal: continue to send the email even if DB save fails
      console.warn('ContactMessage save warning:', err?.message || err);
    }

    // Send notification email to site owner (admin)
    await transporter.sendMail({
      from: `"${fullName}" <${email}>`,
      to: 'alvirebal123@gmail.com',
      replyTo: email,
      subject,
      html: `
        <h3>New Message from Contact Form</h3>
        <p><b>Name:</b> ${fullName}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Subject:</b> ${subject}</p>
        <p><b>Message:</b></p>
        <p>${(String(message) || '').replace(/</g, '&lt;')}</p>
      `,
    });

    return res.json({ success: true, message: 'Message sent successfully!' });
  } catch (err) {
    console.error('Email send failed:', err);
    return res.status(500).json({ success: false, message: 'Email send failed' });
  }
});

export default router;