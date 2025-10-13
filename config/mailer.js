const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail", // or use another provider like "hotmail", "yahoo"
  auth: {
    user: process.env.EMAIL_USER, // your email address
    pass: process.env.EMAIL_PASS, // your email app password
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
