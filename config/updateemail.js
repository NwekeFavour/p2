const approvedEmail = (name) => `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden;">
        <!-- Header / Logo -->
        <tr>
          <td align="center" style="background-color: #4f39f6; padding: 30px;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Internship Program</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding: 30px; color: #333333; font-size: 16px; line-height: 1.5;">
            <p>Hi <strong>${name}</strong>,</p>
            <p>Congratulations! 🎉 Your application has been <strong>approved</strong>.</p>
            <p>We are excited to have you join our internship community and start your journey with us.</p>
            <p style="text-align:center; margin: 20px 0;">
              <a href="https://knownly.tech/internships/join" style="
                background-color: #4f39f6;
                color: #ffffff;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: bold;
                display: inline-block;
              ">Join Now</a>
            </p>
            <p>We look forward to seeing you thrive in our community.</p>
            <p>Best regards,<br>— The Knownly Incubation Team</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="background-color: #f4f4f4; padding: 20px; font-size: 12px; color: #777777;">
            © 2025 Internship Program. All rights reserved.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`;

const rejectedEmail = (name) => `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden;">
        <!-- Header -->
        <tr>
          <td align="center" style="background-color: #F44336; padding: 30px;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Internship Program</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding: 30px; color: #333333; font-size: 16px; line-height: 1.5;">
            <p>Hi <strong>${name}</strong>,</p>
            <p>We regret to inform you that your application has been <strong>rejected</strong>.</p>
            <p>Don't be discouraged! We encourage you to stay connected and apply for future opportunities.</p>
            <p>Thank you for your interest and for taking the time to apply.</p>
            <p>Best regards,<br>— Internship Team</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="background-color: #f4f4f4; padding: 20px; font-size: 12px; color: #777777;">
            © 2025 Internship Program. All rights reserved.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`;


module.exports = { approvedEmail, rejectedEmail };
