const { userModel } = require('../models/userModel');
const sendMail = require('../utils/email'); 
const { activationBeforeLogin } = require('../utils/mailTemplates');
const otpGenerator = require('otp-generator');

const generateOTP = () => {
  return otpGenerator.generate(6, { 
    upperCaseAlphabets: false, 
    lowerCaseAlphabets: false, 
    specialChars: false 
  });
};

module.exports = (agenda) => {
  agenda.define('send activation reminders', async () => {
    try {
      console.log('Running activation reminder job...');
      const now = new Date();

      const users = await userModel.find({ emailVerified: false });

      let sentCount = 0;
      for (const user of users) {
        const createdAt = user.createdAt;
        const lastSent = user.lastReminderSent;
        
        // FIRST REMINDER AFTER 24 HOURS
        if (!lastSent) {
          const hoursPassed = (now - createdAt) / (1000 * 60 * 60);

          if (hoursPassed < 24) continue;
        }

        // SUBSEQUENT REMINDERS EVERY 7 DAYS
        if (lastSent) {
          const daysPassed = (now - lastSent) / (1000 * 60 * 60 * 24);

          if (daysPassed < 7) continue;
        }

        // OPTIONAL: Stop after 5 reminders
        if (user.reminderCount >= 5) continue;        
        
        const otp = generateOTP();
        user.emailOtp = otp;
        user.otpExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
        await user.save();
        const activationUrl = `${process.env.activatingUrl}${user.email}`;
              
        await sendMail({
          email: user.email,
          subject: `Activate Your Account - ${user.fullName}`,
          text: 'Activate your account',
          html: activationBeforeLogin(otp, user.fullName, activationUrl)
        });

        // save last reminder time
        user.lastReminderSent = now;
        user.reminderCount += 1;
        await user.save();

        sentCount++;
      }

      console.log(`Sent ${sentCount} reminders emails`);

    } catch (err) {
      console.error('Error in reminder job:', err);
    }
  });

};
