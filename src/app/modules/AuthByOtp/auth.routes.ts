import express from 'express';
import validateRequest from '../../middlewares/validateRequest';
import { AuthControllers } from './auth.controller';
import { authValidation } from './auth.validation';
import auth from '../../middlewares/auth';

const router = express.Router();

// POST /auth/login
router.post(
  '/login',
  validateRequest.body(authValidation.loginUser),
  AuthControllers.loginUser
);

// POST /auth/register
router.post(
  '/register',
  validateRequest.body(authValidation.registerUser),
  AuthControllers.registerUser
);
router.post(
  '/refresh-token',
  auth('ANY'),
  AuthControllers.refreshToken
);

// POST /auth/verify-email
router.post(
  '/verify-email',
  validateRequest.body(authValidation.verifyEmail),
  AuthControllers.verifyEmail
);

// POST /auth/resend-verification-otp
router.post(
  '/resend-verification-otp',
  validateRequest.body(authValidation.resendOtp),
  AuthControllers.resendVerificationOtpToNumber
);

// PATCH /auth/change-password (requires auth)
router.patch(
  '/change-password',
  auth('ANY'),
  validateRequest.body(authValidation.changePassword),
  AuthControllers.changePassword
);

// POST /auth/forget-password
router.post(
  '/forget-password',
  validateRequest.body(authValidation.forgetPassword),
  AuthControllers.forgetPassword
);

// POST /auth/verify-forgot-password-otp
router.post(
  '/verify-forgot-password-otp',
  validateRequest.body(authValidation.verifyForgotOtp),
  AuthControllers.verifyForgotPassOtp
);

// POST /auth/reset-password
router.post(
  '/reset-password',
  validateRequest.body(authValidation.resetPassword),
  AuthControllers.resetPassword
);

export const AuthByOtpRouters = router;