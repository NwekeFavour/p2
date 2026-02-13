const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config();

const transporter = nodemailer.createTransport({
  host: "smtp.resend.com",
  port: 465,
  secure: true,
  auth: {
    user: 'resend',
    pass: process.env.RESEND_API_KEY,
  },
  tls: {
    rejectUnauthorized: false,
  }
});


transporter.verify((error, success) => {
  if (error) {
    console.error("Email setup error:", error);
  } else {
    console.log("✅ Server is ready to send emails");
  }
});

module.exports = transporter;
