const resetPasswordMail = (otp, fullName) => {
  return `
  <div style="background: #f9f9f9; padding:40px; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <div style="max-width:600px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
      
      <!-- Header -->
      <div style="background: #f9f9f9 ; padding:20px; text-align:center; color:#fff;">
        <h1 style="margin:0; font-size:24px;">Password Reset</h1>
      </div>
      
      <!-- Body -->
      <div style="padding:30px; color:#333;">
        <h2 style="margin-top:0; color:#000;">Hello ${fullName.split(" ")[0]},</h2>
        <p style="font-size:15px; line-height:1.6;">
          You have requested for a <strong>change of password</strong>.  
          Please use the 6-digit code below to reset your password
        </p>

        <!-- OTP Box -->
        <div style="text-align:center; margin:30px 0;">
          <span style="display:inline-block; font-size:32px; letter-spacing:8px; 
                       font-weight:bold; color:#000; background:#f9f9f9; 
                       padding:15px 25px; border-radius:8px; border:2px;">
            ${otp}
          </span>
        </div>

        <p style="font-size:14px; color:#555; line-height:1.6;">
           This emaill is valid for <strong>10 minutes</strong>.  
          If you did not make this request, don't worry. \n
          Your password is still safe and you can disregard this email
        </p>

        <p style="margin-top:25px; font-size:14px; color:#444;">
          With care,<br/>
          <strong style="color:#18b818;">The TSAN Team</strong>
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#18b818; padding:15px; text-align:center; font-size:12px; color:#888;">
      <p style="margin:0; font-weight:bold;">Best regards</p>
      <p style="margin:5px 0 0 0;">Support: <a href="mailto:websupport@scouts.org.ng" style="color:#fff; text-decoration:underline;">webscout@email.com</a></p>
      <p style="margin-top:10px;">© ${new Date().getFullYear()} TSAN. All rights reserved.</p>
      </div>
    </div>
  </div>
  `;
};


const welcomeMail = (otp, fullName) => {
  return `
    <div style="background: #f9f9f9; padding:40px; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <div style="max-width:600px; margin:0 auto; background:#fff; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
        
        <div style="padding:30px; color:#333;">
          <h2 style="margin-top:0; color:#000000;">Hello ${fullName.split(" ")[0]}, </h2>
          <p style="font-size:15px; line-height:1.6;">
            Thank you for registering. we're excited to have you. Here is your code to activate your account:
          </p>

          <!-- OTP -->
          <div style="text-align:center; margin:25px 0;">
            <span style="display:inline-block; font-size:30px; font-weight:bold; 
                         letter-spacing:6px; color:#000; background:#f9f9f9; 
                         padding:12px 24px; border-radius:8px; border:2px;">
              ${otp}
            </span>
          </div>

          <p style="font-size:14px; color:#555; line-height:1.6;">
            If you did not make this request, you can disregard this email or contact your administrator.  
          </p>
          
        <p style="margin-top:25px; font-size:14px; color:#444;">
          With care,<br/>
          <strong style="color:#18b818;">The TSAN Team</strong>
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#18b818; padding:15px; text-align:center; font-size:12px; color:#888;">
      <p style="margin:0; font-weight:bold;">Best regards</p>
      <p style="margin:5px 0 0 0;">Support: <a href="mailto:websupport@scouts.org.ng" style="color:#fff; text-decoration:underline;">webscout@email.com</a></p>
      <p style="margin-top:10px;">© ${new Date().getFullYear()} TSAN. All rights reserved.</p>
     
        </div>
      </div>
    </div>
  `;
};


const emailVerificationMail = (link, fullName) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; background: #f9f9f9;">
      <h2 style="color: #000;">Hi ${fullName},</h2>
      <p>Thank you for registering with TSAN. Please verify your email address by clicking the button below:</p>
      <a href="${link}" 
         style="display:inline-block;padding:10px 20px;margin:20px 0;
                background:#18b818;color:#fff;text-decoration:none;border-radius:5px;">
         Verify Email
      </a>
      <p>If you did not create this account, please ignore this message.</p>
      <p>Regards,<br/>TSAN Team</p>

      
      <!-- Footer -->
      <div style="background:#18b818; padding:15px; text-align:center; font-size:12px; color:#888;">
      <p style="margin:0; font-weight:bold;">Best regards</p>
      <p style="margin:5px 0 0 0;">Support: <a href="mailto:websupport@scouts.org.ng" style="color:#fff; text-decoration:underline;">webscout@email.com</a></p>
      <p style="margin-top:10px;">© ${new Date().getFullYear()} TSAN. All rights reserved.</p>
      </div>
    </div>
  `;
};

const twoFAMail = (otp, fullName) => {
  return `
    <div style="background: #f9f9f9; padding:40px; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <div style="max-width:600px; margin:0 auto; background:#fff; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
        
        <div style="padding:30px; color: #333;">
          <h2 style="margin-top:0; color: #000000;">2FA Authentication</h2>
          <p style="font-size:15px; line-height:1.6;">
            Hello ${fullName.split(" ")[0]},
          </p>
          <p style="font-size:15px; line-height:1.6;">
            Please enter the code below to complete your login:
          </p>

          <!-- OTP -->
          <div style="text-align:center; margin:25px 0;">
            <span style="display:inline-block; font-size:30px; font-weight:bold; 
                         letter-spacing:6px; color:#000; background:#f9f9f9; 
                         padding:12px 24px; border-radius:8px; border:2px;">
              ${otp}
            </span>
          </div>

          <p style="font-size:14px; color:#555; line-height:1.6;">
            If you did not initiate this action, please contact us immediately  
            via email <a href="mailto:websupport@scout.org.ng" style="color:#2e6da4; text-decoration:none;">websupport@scout.org.ng</a>.
          </p>
          
        <p style="margin-top:25px; font-size:14px; color:#444;">
          With care,<br/>
          <strong style="color:#18b818;">The TSAN Team</strong>
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#18b818; padding:15px; text-align:center; font-size:12px; color:#888;">
      <p style="margin:5px 0 0 0;">Support: <a href="mailto:websupport@scouts.org.ng" style="color:#fff; text-decoration:underline;">webscout@email.com</a></p>
      <p style="margin-top:10px;">© ${new Date().getFullYear()} TSAN. All rights reserved.</p>
      
     
        </div>
      </div>
    </div>
  `;
};


const mfaEmailTemplate = (fullName, otp) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background: #000; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: auto; background: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        h2 { color: #111827; }
        .otp { font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #f9f9f9; margin: 20px 0; }
        .footer { font-size: 12px; color: #18b818; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>2FA Authentication</h2>
        <p>Hello <strong>${fullName.split(" ")[0]}</strong>,</p>
        <p>Please enter the code below to complete your login:</p>
        <div class="otp">${otp}</div>
        <p>If you did not initiate this action, please contact us immediately at <a href="mailto:websupport@scout.org.ng">websupport@scout.org.ng</a>.</p>
        <p class="footer">This code will expire in 10 minutes.</p>
      </div>
    </body>
    </html>
  `;
};

const inviteUserMail = (fullName, role, council, inviteLink) => {
  return `
    <div style="background:#f9f9f9; padding:40px; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <div style="max-width:600px; margin:0 auto; background:#fff; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.1);">

        <div style="padding:30px; color:#333;">
          <h2 style="margin-top:0; color:#000000;">Hello ${fullName.split(" ")[0]},</h2>
          <p style="font-size:15px; line-height:1.6;">
           Congratulation, You have been assigned as a <strong>${role}</strong> to manage <strong>${council}</strong>.
          </p>

          <p style="font-size:15px; line-height:1.6;">
            Please click on the button below to proceed with your registration.
          </p>

          <div style="text-align:center; margin:25px 0;">
            <a href="${inviteLink}" 
              style="display:inline-block; background:#18b818; color:#fff; text-decoration:none;
                     padding:14px 28px; border-radius:6px; font-size:16px; font-weight:bold;">
              Create my account
            </a>
          </div>

          <p style="font-size:14px; color:#555; line-height:1.6;">
            This invitation will expire in <strong>30 days</strong>. If you do not complete onboarding before it expires, 
            you’ll need to request a new invite.
          </p>

          <p style="margin-top:25px; font-size:14px; color:#444;">
            With care,<br/>
            <strong style="color:#18b818;">The TSAN Team</strong>
          </p>
        </div>

        <div style="background:#18b818; padding:15px; text-align:center; font-size:12px; color:#fff;">
      <p style="margin:5px 0 0 0;">Support: <a href="mailto:websupport@scouts.org.ng" style="color:#fff; text-decoration:underline;">webscout@email.com</a></p>
      <p style="margin-top:10px;">© ${new Date().getFullYear()} TSAN. All rights reserved.</p>
      </div>
        </div>
      </div>
    </div>
  `;
};

const approvalMailTemplate = (name, message, approver, displayRole) => {
  return `
  <div style="font-family: Arial, sans-serif; line-height: 1.6;">
    <h2>Approval Notification</h2>
    <p>Hello <b>${name}</b>,</p>
    <p>${message}</p>
    <p>Approved by: <b>${approver}</b> (${displayRole})</p>
    <p>© ${new Date().getFullYear()} TSAN. All rights reserved.</p>
  </div>
`;
};

const rejectionMailTemplate = (name, message, rejector, displayRole) => { 
  return `
  <div style="font-family: Arial, sans-serif; line-height: 1.6;">
    <h2>Rejection Notification</h2>
    <p>Hello <b>${name}</b>,</p>
    <p>${message}</p>
    <p>Rejected by: <b>${rejector}</b> (${displayRole})</p>
    <p>© ${new Date().getFullYear()} TSAN. All rights reserved.</p>
  </div>
`;
}




module.exports = {
  resetPasswordMail,
  welcomeMail,
  emailVerificationMail,
  twoFAMail,
  mfaEmailTemplate, 
  inviteUserMail,
  approvalMailTemplate,
  rejectionMailTemplate
};
