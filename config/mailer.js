const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
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
