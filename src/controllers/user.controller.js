import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiError } from './../utils/ApiError.js'
import { ApiResponse } from './../utils/ApiResponse.js'
import { User } from './../models/user.models.js'
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from 'jsonwebtoken';

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const refreshToken = user.generateRefreshToken();
        const accessToken = user.generateAccessToken();

        user.refreshToken = refreshToken;

        await user.save({ validateBeforeSave: false });

        return { refreshToken, accessToken };

    } catch (error) {
        throw new ApiError(500, 'Something went wrong while generating Tokens');
    }
}

const registerUser = asyncHandler(async (req, res, next) => {
    // get user details from frontend 
    // validaton  not empty
    // check if user already present


    const { username, email, fullname, password } = req.body;
    console.log({ username, email, fullname, password });

    if ([username, email, fullname, password].some(field => field == null || field?.trim() == "")) {
        // throw new ApiError(400, "All values are reqruied");
        return res.send({ msg: 'all values are required' });
    }
    const existingUser = await User.findOne({
        $or: [
            { username }, { email }
        ]
    })

    if (existingUser) {
        throw new ApiError(409, "User with email or username already exist");
        // return res.send({msg:'user with same email or username exist',existingUser});
    }
    let avatarPath = null;
    if (req.files?.avatar?.length > 0) {

        avatarPath = req.files?.avatar[0]?.path;
    }
    let coverImagePath;

    if (
        req.files &&
        Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0) {
        coverImagePath = req.files.coverImage[0].path
    }


    if (!avatarPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    let cloudinaryAvatarPath = await uploadOnCloudinary(avatarPath);
    let cloudinaryCoverPath = await uploadOnCloudinary(coverImagePath);

    if (!cloudinaryAvatarPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    const user = await User.create({
        fullname,
        username: username.toLowerCase(),
        password,
        email,
        avatar: cloudinaryAvatarPath.url,
        coverImage: cloudinaryCoverPath?.url || ""
    });


    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(500, 'Something went wrong while registering the user');
    }


    res.status(201).json(new ApiResponse(201, createdUser))

})

const loginUser = asyncHandler(async (req, res, next) => {
    // data from req body
    // check if exist username or email 
    // find the user 
    // check password 
    // access and refresh token  
    // send cookies 

    const { email, username, password } = req.body;
    console.log({ email, username });
    if (!email && !username) {
        throw new ApiError(400, "Username or Email is required");
    }

    const user = await User.findOne({
        $or: [
            { username },
            { email }
        ]
    });

    if (!user) {
        throw new ApiError(404, 'User not exist');
    }

    let isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, 'Invalid user credentials');
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    };

    return res.status(200)
        .cookie('accessToken', accessToken, options)
        .cookie('refreshToken', refreshToken, options)
        .json(new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User LoggedIn Sucessfully"
        ))


})

const logoutUser = asyncHandler(async (req, res, next) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, 'User Logged Out'));
})

const refreshAccessToken = asyncHandler(async (req, res, next) => {
    const incomingRegreshToken = req.cookies.refreshToken || req.body.refreshToken;
    console.log('incomingRegreshToken ' + incomingRegreshToken);
    if (!incomingRegreshToken) {
        throw new ApiError(401, 'Unauthorized Request');
    }

    try {
        let decodedToken = jwt.verify(incomingRegreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(401, "Invalid Refresh Token");
        }

        if (incomingRegreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is Expired or used");
        }

        const options = {
            httpOnly: true,
            secure: true
        }


        const { refreshToken, accessToken } = await generateAccessAndRefreshToken(user._id);

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200, { accessToken, refreshToken },
                    "Access Token Refreshed"
                )
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Refresh Token");
    }

})

const changeCurrentPassword = asyncHandler(async (req, res, resp) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);
    let isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(400, 'Invalid Old Password');
    }

    user.password = newPassword;

    await user.save({ validateBeforeSave: false });

    return res.status(200)
        .json(new ApiResponse(200, {}, "Password Changed Successfully"))
});


const getCurrentUser = asyncHandler(async (req, res, next) => {
    return res.status(200).json(new ApiResponse(200, req.user, 'current User Fetched successfully'));
})

const updateAccountDetails = asyncHandler(async (req, res, next) => {
    const { fullName, email } = req.body;

    if (!fullName || !email) {
        throw new ApiError(400, "All Fields Are Requried");
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
        {
            $set: {
                fullname: fullName,
                email: email
            }
        },
        { new: true }).select("-password");

    return res.status(200)
        .json(new ApiResponse(200, user, "Account Details updated Successfully"));
})

const updateUserAvatar = asyncHandler(async (req, res, next) => {
    const avatarPath = req.file?.path;

    if (!avatarPath) {
        throw new ApiError(400, "Avatar file is missing");
    }

    const avatar = await uploadOnCloudinary(avatarPath);

    if (!avatar.url) {
        throw new ApiError(400, "error while uploading on avatar");
    }

    const user = await User.findByIdAndUpdate(req.user?._id, {
        $set: {
            avatar: avatar.url
        }
    }, { new: true }).select("-password");
    return res.status(200)
    .json(new ApiResponse(200,user,"Avatar image updated successfully"));
})
const updateUserCoverImage = asyncHandler(async (req, res, next) => {
    const coverImagePath = req.file?.path;

    if (!coverImagePath) {
        throw new ApiError(400, "CoverImage file is missing");
    }

    const coverImage = await uploadOnCloudinary(coverImagePath);

    if (!coverImage.url) {
        throw new ApiError(400, "error while uploading on cover");
    }

    const user = await User.findByIdAndUpdate(req.user?._id, {
        $set: {
            coverImage: coverImage.url
        }
    }, { new: true }).select("-password");

    return res.status(200)
    .json(new ApiResponse(200,user,"Cover image updated successfully"));
})



export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
};


