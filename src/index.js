// require('dotenv').config({path:'./env'}); 
import dotenv from 'dotenv';
import connectDB from "./db/index.js";

dotenv.config({
    path:'./env'
})

connectDB().then(()=>{
    app.listen(process.env.PORT||8000,()=>{
        console.log(`The server is running on ${process.env.PORT||8000}`);
        
    })
})



/*
import express from 'express'
const app = express();
(async () => {
    try {
        let connection = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        app.on("error",(err)=>{
            console.log(err);
            throw err;
        })
    } catch (error) {
        console.error("ERROR : " + error);
        throw err;
    }
})(); */