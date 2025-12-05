const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const dotenv = require("dotenv");

dotenv.config();

const ses = new SESClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const sendMail = async ({ email, subject, text, html = "" }) => {
    try {
        if (!process.env.SES_SENDER) {
            console.error("SES sender email not configured.");
            return false;
        }

        const params = {
            Source: process.env.SES_SENDER,
            Destination: {
                ToAddresses: [email],
            },
            Message: {
                Subject: {
                    Charset: "UTF-8",
                    Data: subject,
                },
                Body: {},
            },
        };

        // If HTML is provided, use HTML
        if (html) {
            params.Message.Body.Html = {
                Charset: "UTF-8",
                Data: html,
            };
        }

        // If only text
        if (text && !html) {
            params.Message.Body.Text = {
                Charset: "UTF-8",
                Data: text,
            };
        }

        const command = new SendEmailCommand(params);
        const response = await ses.send(command);

        console.log("✅ Email sent successfully:", response);
        return true;

    } catch (error) {
        console.error("❌ Error sending email:", error.message || error);
        return false;
    }
};

module.exports = sendMail;
