import nodemailer from 'nodemailer';

// Create transporter (Gmail by default) using admin mailbox
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'alvirebal123@gmail.com',
    pass: 'ppak dmsa ivsn bnez',
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