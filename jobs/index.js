const agenda = require('../config/agenda')
const activationReminderJob = require('./activationReminder');

const startAgenda = async () => {
  activationReminderJob(agenda);
  agenda.on("ready", async () => {
    console.log("Agenda connected and ready.");
    try{
      await agenda.every('1 minute', 'send activation reminders');
      console.log('Task "send activation reminders" scheduled successfully!');
    } catch (err) {
      console.error('Failed to schedule job:', err.message);
    }
  });

  agenda.on("error", (err) => {
    console.error("Agenda connection error:", err.message);
  });
  await agenda.start();
  console.log('Agenda Running');
};

module.exports = startAgenda;
