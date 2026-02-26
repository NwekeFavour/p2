require("dotenv").config();
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendPremiumPromoLogic(user, email) {
  try {
    if (!email || !user?.fname) {
      console.error("❌ Missing user data or email");
      return;
    }

    const { data, error } = await resend.emails.send({
      from: "Knownly Internships <support@knownly.tech>",
      to: [email],
      subject:
        "💎 Go Premium: Unlock Expert Mentorship & Fast-Track Your Career",
      html: `
<div style="font-family:'Segoe UI',Roboto,Arial,sans-serif;background:#f4f7fa;padding:40px 0;display:flex;justify-content:center;">
  <div style="background:#ffffff;max-width:560px;width:100%;border-radius:14px;box-shadow:0 10px 25px rgba(0,0,0,0.06);padding:36px 38px;margin:auto;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:25px;">
      <span style="display:block;font-size:28px;font-weight:800;letter-spacing:-1px;color:#111827;">KNOWNLY</span>
      <span style="display:block;font-size:10px;font-weight:700;letter-spacing:4px;color:#4f39f6;text-transform:uppercase;margin-top:4px;">INTERNSHIPS</span>
    </div>

    <!-- Greeting -->
    <p style="font-size:16px;color:#111827;">Hi <strong>${user.fname}</strong>,</p>

    <p style="font-size:15px;color:#374151;line-height:1.65;">
      You’re already taking real steps toward your tech career.  
      Imagine building production-level projects while working closely with a <strong>Senior Engineer</strong>.
      That’s what <strong>Knownly Premium</strong> unlocks.
    </p>

    <!-- Premium Advantage -->
    <div style="background:linear-gradient(135deg,#4f39f6,#4f39e1);border-radius:12px;padding:22px 24px;margin:24px 0;color:#ffffff;">
      <p style="margin:0;font-size:18px;font-weight:700;text-align:center;">The Premium Advantage</p>
      <ul style="margin:15px 0 0;padding-left:20px;font-size:14px;line-height:1.6;color:#e0e7ff;">
        <li>⚡ <strong>Direct Access:</strong> 1-on-1 mentor sessions.</li>
        <li>🛠️ <strong>Real PR Reviews:</strong> Your code reviewed by senior engineers.</li>
        <li>🥇 <strong>Priority Opportunities:</strong> Faster selection for partner roles.</li>
      </ul>
    </div>

    <!-- What’s Included -->
    <p style="font-size:15px;color:#374151;line-height:1.6;"><strong>What’s included in Premium:</strong></p>
    <ul style="font-size:14px;color:#374151;line-height:1.7;padding-left:18px;">
      <li>💼 Resume reviews & mock interviews</li>
      <li>📜 Verified premium certification</li>
      <li>🚀 Advanced system design & production workflows</li>
      <li>🤝 Private Premium community & networking</li>
    </ul>

    <!-- Track Links -->
    <div style="background:#f8fafc;border-radius:12px;padding:20px;margin:26px 0;">
      <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#111827;text-align:center;">
        See what you’ll build in your track
      </p>

      <ul style="font-size:14px;color:#374151;line-height:1.8;padding-left:18px;">
        <li>💻 If you're on the <strong>Frontend</strong> track → 
          <a href="https://knownly.tech/frontend" style="color:#4f39f6;text-decoration:none;font-weight:600;">Click here</a>
        </li>

        <li>⚙️ If you're on the <strong>Backend</strong> track → 
          <a href="https://knownly.tech/backend" style="color:#4f39f6;text-decoration:none;font-weight:600;">Click here</a>
        </li>

        <li>🎨 If you're on the <strong>UI/UX</strong> track → 
          <a href="https://knownly.tech/uiux" style="color:#4f39f6;text-decoration:none;font-weight:600;">Click here</a>
        </li>

        <li>📈 If you're on the <strong>Digital Marketing</strong> track → 
          <a href="https://knownly.tech/digital-marketing" style="color:#4f39f6;text-decoration:none;font-weight:600;">Click here</a>
        </li>
      </ul>

      <p style="margin-top:12px;font-size:13px;color:#6b7280;text-align:center;">
        Each page shows the Premium benefits plus the real projects you’ll build.
      </p>
    </div>

    <!-- Referral / Share -->
    <div style="background:#eef2ff;border-radius:12px;padding:20px;margin:26px 0;text-align:center;">
      <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#111827;">
        Know someone who should join you?
      </p>
      <p style="margin:0 0 12px;font-size:14px;color:#4b5563;">
        Share Knownly with friends and build together.
      </p>
      <a href="https://knownly.tech/internships" style="color:#4f39f6;text-decoration:none;font-weight:700;">
        knownly.tech/internships
      </a>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:35px 0 20px;">
      <a href="https://knownly.tech/upgrade-premium" style="background:#4f39f6;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:8px;font-weight:600;display:inline-block;box-shadow:0 4px 12px rgba(79,57,246,0.25);">
        Upgrade to Premium →
      </a>
    </div>

    <hr style="border:0;border-top:1px solid #e5e7eb;margin:30px 0;" />

    <!-- Footer -->
    <div style="text-align:center;background:#f8fafc;padding:20px;border-radius:10px;">
      <p style="margin:0 0 12px;font-size:14px;color:#4b5563;">Stay updated with tips & opportunities:</p>
      <a href="https://x.com/knownlyhq" style="color:#4f39f6;text-decoration:none;font-weight:700;font-size:15px;">
        Follow @knownlyhq
      </a>
    </div>

    <p style="font-size:14px;color:#6b7280;margin-top:30px;text-align:center;">
      To your success,<br/>
      <strong>The Knownly Team</strong>
    </p>

  </div>
</div>
`,
    });

    if (error) {
      console.error("❌ Resend API Error:", error);
      return;
    }

    console.log(`✅ Promo email sent to ${email}`);
  } catch (err) {
    console.error("❌ Premium Promo Email Logic Error:", err);
  }
}
// --- HOW TO CALL IT ---
const mockUser = { fname: "John" };
sendPremiumPromoLogic(mockUser, "nwekefavour1315@gmail.com");
