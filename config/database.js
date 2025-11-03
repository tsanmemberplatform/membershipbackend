const mongoose = require('mongoose')
require('dotenv').config()
const DB = process.env.DATABASE_URI

mongoose.connect(DB).then(()=>{
    console.log('Database Connected Succesfully');
}).catch((error)=>{
    console.log('Error connecting to database' + error.message);
})