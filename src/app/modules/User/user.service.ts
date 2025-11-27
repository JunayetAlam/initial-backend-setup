import httpStatus from 'http-status';
import { User, UserRoleEnum, UserStatus } from '@prisma/client';
import QueryBuilder from '../../builder/QueryBuilder';
import { prisma } from '../../utils/prisma';
import { Request } from 'express';
import AppError from '../../errors/AppError';
import { JwtPayload } from 'jsonwebtoken';
import { deleteFromCloudStorage, uploadToCloudStorage } from '../../utils/uploadToDigitalOceanAWS';
import { uploadToMinIO } from '../../utils/uploadToMinio';


interface UserWithOptionalPassword extends Omit<User, 'password'> {
  password?: string;
}
const getAllUsersFromDB = async (query: any, user: JwtPayload) => {
  if (user.role !== 'SUPERADMIN') {
    query.isDeleted = false;
  }
  const usersQuery = new QueryBuilder<typeof prisma.user>(prisma.user, query);
  const result = await usersQuery
    .search(['firstName', 'lastName', 'email'])
    .filter()
    .sort()
    .customFields({
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      profilePhoto: true,
      ...(user.role === 'SUPERADMIN' && { isDeleted: true, createdAt: true, updatedAt: true, status: true, }),
    })
    .exclude()
    .paginate()
    .execute();

  return result;
};

const getMyProfileFromDB = async (id: string, role: UserRoleEnum) => {
  const Profile = await prisma.user.findUniqueOrThrow({
    where: {
      id: id,
    },
    include: {
      ...(role !== 'SUPERADMIN' && {
        payments: {
          where: {
            paymentType: 'SUBSCRIPTION',
            paymentStatus: 'SUCCESS',
            endAt: {
              gte: new Date(),
            },
          },
          select: {
            id: true,
            paymentStatus: true,
            endAt: true,
            subscriptionPackageId: true
          }
        },
      })
    }
  });

  if (role === 'SUPERADMIN') {
    return { ...Profile, hideSubscription: false }
  }

  const payments = Profile.payments
  const exactPayment = payments?.filter(item => item.paymentStatus === 'SUCCESS')[0]
  const isVerified = new Date(exactPayment?.endAt || '') >= new Date();
  const result = {
    ...Profile,
    payments: undefined,
    isPaid: isVerified,
    subscriptionPackageId: exactPayment?.subscriptionPackageId || '',
    endAt: exactPayment?.endAt || null,
    hideSubscription: false
  }
  return result;
};

const getUserDetailsFromDB = async (id: string, user: JwtPayload) => {
  const result = await prisma.user.findUniqueOrThrow({
    where: {
      id,
      ...(user.role !== 'SUPERADMIN' && { isDeleted: false })
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      profilePhoto: true,
      ...(user.role === 'SUPERADMIN' && { isDeleted: true, createdAt: true, updatedAt: true, status: true, }),
    },
  });
  return result;
};

const updateProfileImg = async (id: string, previousImg: string, req: Request, file: Express.Multer.File | undefined) => {

  if (file) {
    const location = await uploadToMinIO(file)
    const result = await prisma.user.update({
      where: {
        id
      },
      data: {
        profilePhoto: location
      }
    });
    if (previousImg) {
      deleteFromCloudStorage(previousImg)
    }
    req.user.profilePhoto = location;
    return result
  }
  throw new AppError(httpStatus.NOT_FOUND, 'Please provide image')
};

const updateMyProfileIntoDB = async (
  id: string,

  payload: Partial<User>,
) => {
  delete payload.email


  const result = await prisma.user.update({
    where: {
      id
    },
    data: payload
  })
  return result
};

const updateUserRoleStatusIntoDB = async (id: string, role: UserRoleEnum) => {
  const result = await prisma.user.update({
    where: {
      id: id,
    },
    data: {
      role: role
    },
  });
  return result;
};
const updateProfileStatus = async (id: string, status: UserStatus) => {
  const result = await prisma.user.update({
    where: {
      id
    },
    data: {
      status
    },
    select: {
      id: true,
      status: true,
      role: true
    },
  })
  return result
}

const deleteMyProfileFromDB = async (id: string) => {
  await prisma.user.update({
    where: {
      id
    },
    data: {
      isDeleted: true,
      isEmailVerified: false,
      emailVerificationToken: null,
      emailVerificationTokenExpires: null,
      otp: null,
      otpFor: null,
      otpExpiry: null,
      passwordResetToken: null,
      passwordResetTokenExpires: null,
    }
  });
  return { message: 'Account deleted successfully' }
}

const undeletedUser = async (id: string) => {
  const result = await prisma.user.update({
    where: { id },
    data: {
      isDeleted: false,
    }
  });
  return result;
}

export const UserServices = {
  getAllUsersFromDB,
  getMyProfileFromDB,
  getUserDetailsFromDB,
  updateMyProfileIntoDB,
  updateUserRoleStatusIntoDB,
  updateProfileStatus,
  updateProfileImg,
  deleteMyProfileFromDB,
  undeletedUser
};