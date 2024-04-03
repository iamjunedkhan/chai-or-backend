import mongoose , {Schema} from 'mongoose';

const userSchema = new Schema({
    username:{
        type:String,
        requried:true,
        unique:true,
        lowercase : true,
        trim:true,
        index:true
    },
    email:{
        type:String,
        requried:true,
        unique:true,
        lowercase : true,
        trim:true
    },
    fullname:{
        type:String,
        requried:true,
        trim:true,
        index:true
    },
    avatar:{
        type:String,//cloudanary service
        requried:true,
    },
    coverImage:{
        type:String,//cloudanary service
    },
    wathHistory: [
        {
           type:Schema.Types.ObjectId,
           ref:"Video" 
        }
    ],
    password:{
        type:String,
        required:[true,"Password is Required"],
    },
    refreshToken :{
        type:String
    }
},{timestamps:true});

export const User  = mongoose.model('User',userSchema);