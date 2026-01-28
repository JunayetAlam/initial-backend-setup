import * as bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';
import config from '../../../config';
import AppError from '../../errors/AppError';
import { insecurePrisma, prisma } from '../../utils/prisma';
import { User } from '@prisma/client';
import { Response } from 'express';
import jwt from 'jsonwebtoken'
import { generateToken } from '../../utils/generateToken';
import { generateOTP, getOtpStatusMessage, otpExpiryTime } from '../../utils/otp';
import { verifyOtp } from '../../utils/verifyOtp';
import { sendOtp } from '../../utils/sendOtp';

const loginUserFromDB = async (res: Response, payload: {
  email: string;
  password: string;
}) => {

  const userData = await insecurePrisma.user.findUniqueOrThrow({
    where: {
      email: payload.email,
    },
  });
  if (userData.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Account has been deleted. Please contact support to reactivate your account');
  }
  if (userData.status === 'BLOCKED') {
    throw new AppError(httpStatus.FORBIDDEN, 'Account has been blocked');
  }
  const isCorrectPassword: Boolean = await bcrypt.compare(
    payload.password,
    userData.password,
  );

  if (!isCorrectPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password incorrect');
  }
  if (userData.role !== 'SUPERADMIN' && !userData.isEmailVerified) {
    const result = await resendVerificationOtpToNumber(userData.email)
    return result
  }
  const result = await refreshToken(userData.email, userData);
  return result
};

const refreshToken = async (email: string, user?: User) => {
  let userData: User;
  if (user) {
    userData = user
  } else {
    userData = await insecurePrisma.user.findUniqueOrThrow({
      where: {
        email: email,
      },
    });
  }

  if (userData.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Account has been deleted. Please contact support to reactivate your account');
  }

  if (userData.status === 'BLOCKED') {
    throw new AppError(httpStatus.FORBIDDEN, 'Account has been blocked');
  }

  if (userData.role === 'SUPERADMIN') {
    const accessToken = await generateToken(
      {
        id: userData.id,
        name: userData.firstName + userData.lastName,
        email: userData.email,
        role: userData.role,
        // isPaid: true
      },
      config.jwt.access_secret as Secret,
      config.jwt.access_expires_in as SignOptions['expiresIn'],
    );
    return {
      id: userData.id,
      role: userData.role,
      accessToken: accessToken,
      isPaid: true
    };
  }
  // const payments = await prisma.payment.count({
  //   where: {
  //     subscriptionPackage: {
  //       userType: {
  //         has: userData.role
  //       }
  //     },
  //     paymentType: 'SUBSCRIPTION',
  //     paymentStatus: 'SUCCESS',
  //     endAt: {
  //       gte: new Date()
  //     },
  //     userId: userData.id
  //   }
  // });
  const accessToken = await generateToken(
    {
      id: userData.id,
      name: userData.firstName + userData.lastName,
      email: userData.email,
      role: userData.role,
      // isPaid: payments > 0 ? true : false
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as SignOptions['expiresIn'],
  );
  return {
    id: userData.id,
    role: userData.role,
    accessToken: accessToken,
    // isPaid: payments > 0 ? true : false
  };
}

const registerUserIntoDB = async (payload: User) => {
  if (payload.role == "SUPERADMIN") {
    throw new AppError(httpStatus.NOT_ACCEPTABLE, "User can only pass User and Provider")
  }
  const hashedPassword: string = await bcrypt.hash(payload.password, 12);


  const existingUser = await prisma.user.findFirst({
    where: {
      email: payload.email
    },
    select: {
      id: true,
      email: true,
      isDeleted: true
    },
  });

  if (existingUser) {
    if (existingUser.isDeleted) {
      throw new AppError(httpStatus.CONFLICT, 'User already exists with the email and its deleted. Please contact support to reactivate your account');
    } else {
      throw new AppError(httpStatus.CONFLICT, 'User already exists with the email');
    }

  }




  const otp = generateOTP();
  const userData = {
    ...payload,
    password: hashedPassword,
    otp,
    otpExpiry: otpExpiryTime(),
  }

  const createdUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        ...userData,
        otpFor: 'USER_VERIFICATION',
      },
    });

    sendOtp({ email: userData.email, otp });

    return { user, otp: otp };
  });

  return {
    message: 'Please check your Email to verify your account',
    otp
  }

};

const verifyEmail = async (payload: { email: string; otp: string }) => {
  const { userData } = await verifyOtp({ email: payload.email, otp: payload.otp }, 'USER_VERIFICATION');
  await prisma.user.update({
    where: {
      email: userData.email,
    },
    data: {
      otp: null,
      otpExpiry: null,
      isEmailVerified: true,
      otpFor: 'NOT'
    },
    select: {
      id: true,
    }
  });

  const accessToken = await generateToken(
    {
      id: userData.id,
      name: userData.firstName + userData.lastName,
      email: userData.email,
      role: userData.role,
      // isPaid: false
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as SignOptions['expiresIn'],
  );

  return {
    id: userData.id,
    name: userData.firstName + userData.lastName,
    email: userData.email,
    role: userData.role,
    accessToken: accessToken,
  };
}

const resendVerificationOtpToNumber = async (email: string) => {
  const user = await insecurePrisma.user.findFirstOrThrow({
    where: {
      email: email,
    },
  });

  if (user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Account has been deleted. Please contact support to reactivate your account');
  }

  if (user.status === 'BLOCKED') {
    throw new AppError(httpStatus.FORBIDDEN, 'User is blocked');
  }
  if (user.isEmailVerified) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Already verified')
  }

  // if (user.otp && user.otpExpiry && new Date(user.otpExpiry).getTime() > Date.now()) {
  //   const message = getOtpStatusMessage(user.otpExpiry);
  //   throw new AppError(httpStatus.CONFLICT, message)
  // }


  const otp = generateOTP();

  const updatedUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { email: email },
      data: {
        otp,
        otpExpiry: otpExpiryTime(),
        otpFor: 'USER_VERIFICATION',
      },
    });

    sendOtp({ email: user.email, otp });

    return {
      otp,
      message: 'Verify Otp has sent to your email'
    };
  });


  return { message: 'Verification otp sent successfully. Please check your email.', otp, };
};

const changePassword = async (user: any, payload: {
  oldPassword: string
  newPassword: string
}) => {
  const userData = await insecurePrisma.user.findUniqueOrThrow({
    where: {
      email: user.email,
      status: 'ACTIVE',
    },
  });

  if (userData.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Account has been deleted. Please contact support to reactivate your account');
  }

  if (userData.status === 'BLOCKED') {
    throw new AppError(httpStatus.FORBIDDEN, 'Account has been blocked');
  }

  const isCorrectPassword: boolean = await bcrypt.compare(
    payload.oldPassword,
    userData.password,
  );

  if (!isCorrectPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Old Password is incorrect')
  }

  const hashedPassword: string = await bcrypt.hash(payload.newPassword, 12);

  await prisma.user.update({
    where: {
      id: userData.id,
    },
    data: {
      password: hashedPassword,
    },
  });

  return {
    message: 'Password changed successfully!',
  };
};



const verifyForgotPassOtp = async (payload: { email: string; otp: string }) => {

  const { userData } = await verifyOtp(payload, 'FORGOT_PASSWORD')


  const resetToken = generateToken(
    {
      id: userData.id,
      name: userData.firstName + userData.lastName,
      email: userData.email,
      role: userData.role,
      // isPaid: false
    },
    config.jwt.access_secret as Secret,
    '600s',
  );


  // Prisma transaction
  await prisma.user.update({
    where: {
      email: payload.email,
    },
    data: {
      otp: null,
      otpExpiry: null,
      passwordResetToken: resetToken,
      otpFor: 'NOT'
    },
  });

  return { resetToken, expireInMinutes: 5 };
}

const resetPassword = async (payload: {
  email: string;
  newPassword: string;
}, token: string) => {
  if (!token) {
    throw new AppError(httpStatus.FORBIDDEN, 'Token is missing!')
  }

  const userData = await insecurePrisma.user.findFirstOrThrow({
    where: {
      email: payload.email,
    },
  })

  if (userData.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Account has been deleted. Please contact support to reactivate your account');
  }

  if (userData.status === 'BLOCKED') {
    throw new AppError(httpStatus.FORBIDDEN, 'User has blocked')
  }

  if (token !== userData.passwordResetToken) {
    throw new AppError(httpStatus.FORBIDDEN, 'Invalid token')
  }

  const decoded = jwt.verify(token, config.jwt.access_secret as string) as JwtPayload

  if (!decoded || !decoded.exp) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid token');
  }

  if (decoded.email !== payload.email) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are forbidden!')
  }

  const newHashedPassword = await bcrypt.hash(payload.newPassword, Number(config.bcrypt_salt_rounds))

  await prisma.user.update({
    where: {
      email: payload.email
    },
    data: {
      password: newHashedPassword,
      passwordResetToken: null,
      passwordResetTokenExpires: null,
    }
  })

  return { message: 'Password reset successfully' };
}

const forgetPassword = async (email: string) => {
  const user = await insecurePrisma.user.findFirstOrThrow({
    where: {
      email: email,
    },
  });


  if (user.isEmailVerified) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not verified!')
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Account has been deleted. Please contact support to reactivate your account');
  }

  if (user.status === 'BLOCKED') {
    throw new AppError(httpStatus.FORBIDDEN, 'User is blocked');
  }

  // if (user.otpFor === 'FORGOT_PASSWORD' && user.otp && user.otpExpiry && new Date(user.otpExpiry).getTime() > Date.now()) {
  //   const message = getOtpStatusMessage(user.otpExpiry);
  //   throw new AppError(httpStatus.CONFLICT, message)
  // }


  const otp = generateOTP();

  const updatedUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { email: email },
      data: {
        otp,
        otpExpiry: otpExpiryTime(),
        otpFor: 'FORGOT_PASSWORD',
      },
    });
    sendOtp({ email: user.email, otp });


    return {
      message: 'Verify Otp has sent to your email',

    };
  });

  return { message: 'Verification otp sent successfully. Please check your inbox.', otp };
};

export const AuthServices = {
  loginUserFromDB,
  registerUserIntoDB,
  changePassword,
  forgetPassword,
  resetPassword,
  resendVerificationOtpToNumber,
  verifyEmail,
  verifyForgotPassOtp,
  refreshToken
};