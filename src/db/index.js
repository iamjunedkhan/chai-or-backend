import mongoose from "mongoose";
import { DB_NAME } from "../constants.js    ";

const connectDB = async () => {
    try {
        let connection = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log(`\n MongoDB connect !! DB Host: ${connection.connection.host}`);
        
    } catch (error) {
        console.log("The error is : " + error);
        process.exit(1);
    }
}
export default connectDB