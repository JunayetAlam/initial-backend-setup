import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { AuthServices } from './auth.service';

// POST /auth/login
const loginUser = catchAsync(async (req, res) => {
  const result = await AuthServices.loginUserFromDB(res, req.body);
  if (result) {
    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'User logged in successfully',
      data: result,
    });
  }
});

// POST /auth/register
const registerUser = catchAsync(async (req, res) => {
  const message = await AuthServices.registerUserIntoDB(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: 'User Register Successfully. Check your mail to verify',
    data: message,
  });
});

// POST /auth/verify-phone
const verifyEmail = catchAsync(async (req, res) => {
  const result = await AuthServices.verifyEmail(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Email verified successfully',
    data: result,
  });
});

// POST /auth/resend-otp
const resendVerificationOtpToNumber = catchAsync(async (req, res) => {
  const { email } = req.body;
  const result = await AuthServices.resendVerificationOtpToNumber(email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    data: result,
  });
});

// PATCH /auth/change-password
const changePassword = catchAsync(async (req, res) => {
  const result = await AuthServices.changePassword(req.user, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    data: result,
  });
});

// POST /auth/forget-password
const forgetPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  const result = await AuthServices.forgetPassword(email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    data: result,
  });
});

// POST /auth/verify-forgot-password-otp
const verifyForgotPassOtp = catchAsync(async (req, res) => {
  const result = await AuthServices.verifyForgotPassOtp(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'OTP verified successfully',
    data: result,
  });
});

// POST /auth/reset-password
const resetPassword = catchAsync(async (req, res) => {
  const token = req.headers.authorization as string;
  const result = await AuthServices.resetPassword(req.body, token);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    data: result,
  });
});
const refreshToken = catchAsync(async (req, res) => {
  const result = await AuthServices.refreshToken(req.user.email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Token Refresh Successfully',
    data: result,
  });
});

export const AuthControllers = {
  loginUser,
  registerUser,
  verifyEmail,
  resendVerificationOtpToNumber,
  changePassword,
  forgetPassword,
  verifyForgotPassOtp,
  resetPassword,
  refreshToken
};
