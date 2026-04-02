require('dotenv').config();
const {Agenda} = require('agenda');
const dbUrl = process.env.DATABASE_URI

if (!dbUrl) {
  throw new Error('DATABASE_URI is required for Agenda jobs');
}

const agenda = new Agenda({
  db: {
    address: dbUrl || process.env.DATABASE_URI, 
    collection: 'agendaJobs'
  },
  processEvery: '5 seconds' 
});

module.exports = agenda;
