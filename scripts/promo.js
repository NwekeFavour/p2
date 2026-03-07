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
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Roboto,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 16px;">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

        <!-- ── HEADER ── -->
        <tr>
          <td style="background:linear-gradient(135deg,#4f39f6 0%,#7c3aed 100%);border-radius:16px 16px 0 0;padding:36px 40px;text-align:center;">
            <p style="margin:0;font-size:30px;font-weight:900;letter-spacing:-1px;color:#ffffff;">KNOWNLY</p>
            <p style="margin:4px 0 0;font-size:10px;font-weight:700;letter-spacing:5px;color:#c4b5fd;text-transform:uppercase;">INTERNSHIPS</p>
            <div style="margin:20px auto 0;background:rgba(255,255,255,0.15);border-radius:100px;padding:6px 18px;display:inline-block;">
              <p style="margin:0;font-size:12px;color:#e9d5ff;font-weight:600;">🔒 Premium — Limited Spots</p>
            </div>
          </td>
        </tr>

        <!-- ── BODY ── -->
        <tr>
          <td style="background:#ffffff;padding:40px 40px 32px;">

            <!-- Greeting -->
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;">Hey ${user.fname}! 👋</p>
            <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;">
              You're approved! Your community access link is on its way — or jump in right now:
            </p>

            <div style="text-align:center;margin:0 0 32px;">
              <a href="https://knownly.tech/internships/join?utm_source=email_welcome_promo"
                 style="background:#4f39f6;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;font-size:14px;display:inline-block;">
                Join the Community →
              </a>
            </div>

            <hr style="border:0;border-top:1px solid #f3f4f6;margin:0 0 32px;">

            <!-- Intro to Premium -->
            <p style="margin:0 0 6px;font-size:18px;font-weight:800;color:#111827;">Ready to go further?</p>
            <p style="margin:0 0 28px;font-size:15px;color:#4b5563;line-height:1.7;">
              Free gets you in the door. <strong>Premium gets you the career.</strong> Here's exactly what changes when you upgrade:
            </p>

            <!-- Benefits Grid — 2 col table for email compatibility -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
              <tr>
                <td width="48%" style="background:#f5f3ff;border-radius:12px;padding:20px;vertical-align:top;">
                  <p style="margin:0 0 8px;font-size:24px;">🚀</p>
                  <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#111827;">Fast-Track Your Career</p>
                  <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">First access to partner job referrals and hiring opportunities — before anyone else.</p>
                </td>
                <td width="4%"></td>
                <td width="48%" style="background:#eff6ff;border-radius:12px;padding:20px;vertical-align:top;">
                  <p style="margin:0 0 8px;font-size:24px;">🧠</p>
                  <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#111827;">1-on-1 Mentorship</p>
                  <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">Weekly sessions with a senior engineer. Real feedback, not just group Q&As.</p>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
              <tr>
                <td width="48%" style="background:#fdf4ff;border-radius:12px;padding:20px;vertical-align:top;">
                  <p style="margin:0 0 8px;font-size:24px;">🛠️</p>
                  <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#111827;">Real Code Reviews</p>
                  <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">Your PRs reviewed by seniors. Learn how production code is actually written and shipped.</p>
                </td>
                <td width="4%"></td>
                <td width="48%" style="background:#fff7ed;border-radius:12px;padding:20px;vertical-align:top;">
                  <p style="margin:0 0 8px;font-size:24px;">📄</p>
                  <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#111827;">Resume & Interview Prep</p>
                  <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">Portfolio polish, resume reviews and mock interviews so you show up ready.</p>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td width="48%" style="background:#fef2f2;border-radius:12px;padding:20px;vertical-align:top;">
                  <p style="margin:0 0 8px;font-size:24px;">🏆</p>
                  <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#111827;">Verified Certification</p>
                  <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">A verified Knownly certificate that stands out on LinkedIn and your portfolio.</p>
                </td>
                <td width="4%"></td>
                <td width="48%" style="background:#f0fdf4;border-radius:12px;padding:20px;vertical-align:top;">
                  <p style="margin:0 0 8px;font-size:24px;">🤝</p>
                  <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#111827;">Private Network</p>
                  <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">An exclusive group of high-performing interns, alumni and industry professionals.</p>
                </td>
              </tr>
            </table>

            <!-- Urgency Banner -->
            <div style="background:linear-gradient(135deg,#4f39f6,#7c3aed);border-radius:12px;padding:24px 28px;margin-bottom:32px;text-align:center;">
              <p style="margin:0 0 4px;font-size:19px;font-weight:800;color:#ffffff;">Cohort starts April 1st</p>
              <p style="margin:0 0 18px;font-size:14px;color:#c4b5fd;">Premium spots are filling up fast — don't miss your window.</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" width="48%" style="background:rgba(255,255,255,0.12);border-radius:8px;padding:12px;">
                    <p style="margin:0;font-size:13px;color:#e9d5ff;">⚡ Weekly mentor sessions</p>
                  </td>
                  <td width="4%"></td>
                  <td align="center" width="48%" style="background:rgba(255,255,255,0.12);border-radius:8px;padding:12px;">
                    <p style="margin:0;font-size:13px;color:#e9d5ff;">🥇 Priority partner referrals</p>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Track Links -->
            <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#111827;">See what you'll build in your track:</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="padding:10px 14px;background:#f8fafc;border-radius:8px;margin-bottom:8px;display:block;">
                  <a href="https://knownly.tech/frontend" style="text-decoration:none;color:#111827;font-size:14px;">💻 <strong>Frontend</strong> Track <span style="color:#4f39f6;float:right;">View Projects →</span></a>
                </td>
              </tr>
              <tr><td height="8"></td></tr>
              <tr>
                <td style="padding:10px 14px;background:#f8fafc;border-radius:8px;">
                  <a href="https://knownly.tech/backend" style="text-decoration:none;color:#111827;font-size:14px;">⚙️ <strong>Backend</strong> Track <span style="color:#4f39f6;float:right;">View Projects →</span></a>
                </td>
              </tr>
              <tr><td height="8"></td></tr>
              <tr>
                <td style="padding:10px 14px;background:#f8fafc;border-radius:8px;">
                  <a href="https://knownly.tech/uiux" style="text-decoration:none;color:#111827;font-size:14px;">🎨 <strong>UI/UX</strong> Track <span style="color:#4f39f6;float:right;">View Projects →</span></a>
                </td>
              </tr>
              <tr><td height="8"></td></tr>
              <tr>
                <td style="padding:10px 14px;background:#f8fafc;border-radius:8px;">
                  <a href="https://knownly.tech/digital-marketing" style="text-decoration:none;color:#111827;font-size:14px;">📈 <strong>Digital Marketing</strong> Track <span style="color:#4f39f6;float:right;">View Projects →</span></a>
                </td>
              </tr>
            </table>

            <!-- Main CTA -->
            <div style="text-align:center;margin-bottom:12px;">
              <a href="https://knownly.tech/upgrade-premium?utm_source=email_welcome_promo"
                 style="background:linear-gradient(135deg,#4f39f6,#7c3aed);color:#ffffff;text-decoration:none;padding:16px 36px;border-radius:10px;font-weight:700;font-size:16px;display:inline-block;box-shadow:0 6px 20px rgba(79,57,246,0.35);">
                Upgrade to Premium — ₦5,000 One-Time →
              </a>
            </div>
            <p style="margin:0 0 32px;font-size:13px;color:#9ca3af;text-align:center;">One-time payment. Unlock everything instantly. No recurring fees.</p>

            <hr style="border:0;border-top:1px solid #f3f4f6;margin:0 0 28px;">

            <!-- Referral -->
            <div style="background:#f5f3ff;border-radius:12px;padding:22px;text-align:center;margin-bottom:28px;">
              <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#111827;">Know someone who should join?</p>
              <p style="margin:0 0 12px;font-size:14px;color:#6b7280;">Share Knownly and build together.</p>
              <a href="https://knownly.tech/internships" style="color:#4f39f6;text-decoration:none;font-weight:700;font-size:14px;">knownly.tech/internships →</a>
            </div>

          </td>
        </tr>

        <!-- ── FOOTER ── -->
        <tr>
          <td style="background:#1f2937;border-radius:0 0 16px 16px;padding:28px 40px;text-align:center;">
            <p style="margin:0 0 12px;font-size:13px;color:#9ca3af;">Stay updated with tips & opportunities:</p>
            <a href="https://x.com/knownlyhq" style="color:#a78bfa;text-decoration:none;font-weight:700;font-size:14px;">Follow @knownlyhq on X →</a>
            <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">
              To your success,<br/>
              <strong style="color:#d1d5db;">The Knownly Team</strong>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>
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
