import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create transporter (Gmail by default) using admin mailbox
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    pass: process.env.ADMIN_PASS || process.env.EMAIL_PASS,
  },
});

// Optional: verify connection at startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email connection failed:', error.message || error);
  } else {
    console.log('✅ Email server ready to send messages');
  }
});

export default transporter;