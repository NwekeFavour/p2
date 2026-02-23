require("dotenv").config()
const {Resend} = require("resend")
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
      subject: "💎 Go Premium: Unlock Expert Mentorship & Fast-Track Your Career",
      html: `
      <div style="font-family: 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f4f7fa; padding: 40px 0; display: flex; justify-content: center;">
        <div style="background: #ffffff; max-width: 560px; width: 100%; border-radius: 14px; box-shadow: 0 10px 25px rgba(0,0,0,0.06); padding: 36px 38px; margin: auto;">

          <div style="text-align: center; margin-bottom: 25px;">
            <div style="line-height: 1;">
              <span style="display: block; font-size: 28px; font-weight: 800; letter-spacing: -1px; color: #111827;">KNOWNLY</span>
              <span style="display: block; font-size: 10px; font-weight: 700; letter-spacing: 4px; color: #4f39f6; text-transform: uppercase; margin-top: 4px;">INTERNSHIPS</span>
            </div>
          </div>

          <p style="font-size: 16px; color: #111827;">Hi <strong>${user.fname}</strong>,</p>

          <p style="font-size: 15px; color: #374151; line-height: 1.65;">
            You're already on your way to building great things. But what if you could do it with a <strong>Senior Engineer</strong> by your side? 
            Upgrade to <strong>Knownly Premium</strong> to bridge the gap between learning and landing your dream job.
          </p>

          <div style="background: linear-gradient(135deg, #4f39f6, #4f39e1); border-radius: 12px; padding: 22px 24px; margin: 24px 0; color: #ffffff;">
            <p style="margin: 0; font-size: 18px; font-weight: 700; text-align: center;">The Premium Advantage</p>
            <ul style="margin: 15px 0 0; padding-left: 20px; font-size: 14px; line-height: 1.6; color: #e0e7ff;">
              <li>⚡ <strong>Direct Access:</strong> 1-on-1 sessions with industry mentors.</li>
              <li>🛠️ <strong>Real-World PR Reviews:</strong> Get your code critiqued by pros.</li>
              <li>🥇 <strong>Priority Selection:</strong> Top-tier placement for partner job roles.</li>
            </ul>
          </div>

          <p style="font-size: 15px; color: #374151; line-height: 1.6;"><strong>What’s included in Premium:</strong></p>
          <ul style="font-size: 14px; color: #374151; line-height: 1.7; padding-left: 18px;">
            <li>💼 <strong>Job Readiness:</strong> Tailored resume reviews & mock interviews.</li>
            <li>📜 <strong>Premium Certification:</strong> Stand out to recruiters with verified credentials.</li>
            <li>🚀 <strong>Advanced Curriculum:</strong> Deep dives into system design and scalable architecture.</li>
            <li>🤝 <strong>Exclusive Network:</strong> Access to the private Premium Slack channels.</li>
          </ul>

          <div style="text-align: center; margin: 35px 0 20px;">
            <a href="https://knownly.tech/upgrade-premium" style="background-color: #4f39f6; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(79, 57, 246, 0.25);">
              Upgrade to Premium Now →
            </a>
          </div>

          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;" />

          <div style="text-align: center; background-color: #f8fafc; padding: 20px; border-radius: 10px;">
            <p style="margin: 0 0 12px; font-size: 14px; color: #4b5563;">Don't miss out on updates and career tips:</p>
            <a href="https://x.com/knownlyhq" style="color: #4f39f6; text-decoration: none; font-weight: 700; font-size: 15px;">
              Follow us on X (Twitter) @knownlyhq
            </a>
          </div>

          <p style="font-size: 14px; color: #6b7280; margin-top: 30px; text-align: center;">
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