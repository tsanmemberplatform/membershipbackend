const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();


const sendMail = async ({email, subject, text, html = "" }) => {
    try {
        if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
          
          
            console.error('Brevo API key or sender email is not configured.');
            return false;
        }

        const response = await axios({
            method: 'POST',
            url: 'https://api.brevo.com/v3/smtp/email',
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'api-key': process.env.BREVO_API_KEY
            },
            data: {
                sender: {
                    name: 'TSAN_Platform',
                    email: process.env.BREVO_SENDER_EMAIL
                },  
                to :[{
                  email: email,
                }],
                subject,
                textContent: text,
                htmlContent: html
            }
        });

        console.log('✅ Email sent successfully:', response.data);
        return true;
    } catch (error) {
        console.error('❌ Error sending email:', error.response?.data || error.message);
        return false;
    }
};

module.exports = sendMail;
