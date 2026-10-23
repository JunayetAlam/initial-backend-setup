import httpStatus from 'http-status';
import {
  User,
  UserRoleEnum,
  UserStatus,
} from '../../../generated/prisma/client';
import QueryBuilder from '../../builder/QueryBuilder';
import { prisma } from '../../utils/prisma';
import { Request } from 'express';
import AppError from '../../errors/AppError';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { deleteFromMinIO, uploadToMinIO } from '../Upload/uploadToMinio';
import { destroyAllUserSessions } from '../../utils/sessions';
import { clearAuthCookies } from '../../utils/cookieOptions';
import { isAdminRole } from '../../constant';
import { AuthUser } from '../../interface';

// Role hierarchy: SUPERADMIN manages ADMIN + USER accounts, ADMIN manages USER accounts only.
const MANAGEABLE_ROLES: Record<UserRoleEnum, UserRoleEnum[]> = {
  SUPERADMIN: [UserRoleEnum.ADMIN, UserRoleEnum.USER],
  ADMIN: [UserRoleEnum.USER],
  USER: [],
};

const canManageRole = (actorRole: UserRoleEnum, targetRole: UserRoleEnum) =>
  MANAGEABLE_ROLES[actorRole].includes(targetRole);

// Never expose credentials / tokens from admin user-management responses
const managedUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  status: true,
  isDeleted: true,
} as const;

/**
 * Loads the target account and ensures the acting user may manage it.
 */
const getManageableUser = async (actor: AuthUser, targetId: string) => {
  if (actor.id === targetId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You cannot change your own role, status or account state',
    );
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true },
  });
  if (!target) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!canManageRole(actor.role, target.role)) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `You do not have permission to manage ${target.role} accounts`,
    );
  }

  return target;
};

const getAllUsers = catchAsync(async (req, res) => {
  const user = req.user;
  const query: Record<string, unknown> = req.query;

  if (!isAdminRole(user.role)) {
    query.isDeleted = false;
  }

  // Admins only see the accounts they are allowed to manage
  if (user.role === UserRoleEnum.ADMIN) {
    query.role = UserRoleEnum.USER;
  }

  const usersQuery = new QueryBuilder<typeof prisma.user>(prisma.user, query);
  const result = await usersQuery
    .search(['firstName', 'lastName', 'email'])
    .filter()
    .sort()
    .select({
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      profilePhoto: true,
      loginWay: true,
      ...(isAdminRole(user.role) && {
        isDeleted: true,
        createdAt: true,
        updatedAt: true,
        status: true,
      }),
    })
    .exclude()
    .paginate()
    .execute();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Users retrieved successfully',
    ...result,
  });
});

const getMyProfile = catchAsync(async (req, res) => {
  const id = req.user.id;

  const Profile = await prisma.user.findUniqueOrThrow({
    where: {
      id: id,
    },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Profile retrieved successfully',
    data: Profile,
  });
});

const getUserDetails = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const user = req.user;

  // Users may only view themselves; ADMIN may view USER accounts; SUPERADMIN may view all.
  if (user.id !== id) {
    if (!isAdminRole(user.role)) {
      throw new AppError(httpStatus.FORBIDDEN, 'Forbidden!');
    }
    if (user.role === UserRoleEnum.ADMIN) {
      const target = await prisma.user.findUnique({
        where: { id },
        select: { role: true },
      });
      if (target && target.role !== UserRoleEnum.USER) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          `You do not have permission to view ${target.role} accounts`,
        );
      }
    }
  }

  const result = await prisma.user.findUniqueOrThrow({
    where: {
      id,
      ...(!isAdminRole(user.role) && { isDeleted: false }),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      profilePhoto: true,
      loginWay: true,
      ...(isAdminRole(user.role) && {
        isDeleted: true,
        createdAt: true,
        updatedAt: true,
        status: true,
      }),
    },
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User details retrieved successfully',
    data: result,
  });
});

const updateMyProfile = catchAsync(async (req: Request, res) => {
  const id = req.user.id;
  const payload = req.body;
  delete payload.email;

  const result = await prisma.user.update({
    where: {
      id,
    },
    data: payload,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User profile updated successfully',
    data: result,
  });
});

const updateProfileImage = catchAsync(async (req: Request, res) => {
  const id = req.user.id;
  const file = req.file;
  const previousImg = req.user.profilePhoto || '';

  if (file) {
    const location = await uploadToMinIO(file);
    const result = await prisma.user.update({
      where: {
        id,
      },
      data: {
        profilePhoto: location,
      },
    });

    if (previousImg) {
      deleteFromMinIO(previousImg);
    }

    req.user.profilePhoto = location;

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'Profile image updated successfully',
      data: result,
    });
    return;
  }

  throw new AppError(httpStatus.NOT_FOUND, 'Please provide image');
});

const updateUserRoleStatus = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const role = req.body.role as UserRoleEnum; // validated: USER | ADMIN

  await getManageableUser(req.user, id);

  const result = await prisma.user.update({
    where: {
      id: id,
    },
    data: {
      role: role,
    },
    select: managedUserSelect,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User role updated successfully',
    data: result,
  });
});

const updateUserStatus = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };
  const status = req.body.status;

  await getManageableUser(req.user, id);

  const result = await prisma.user.update({
    where: {
      id,
    },
    data: {
      status,
    },
    select: {
      id: true,
      status: true,
      role: true,
    },
  });

  if (status === UserStatus.BLOCKED) {
    await destroyAllUserSessions(id);
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User status updated successfully',
    data: result,
  });
});

const deleteMyProfileFromDB = catchAsync(async (req, res) => {
  const id = req.user.id;

  await prisma.user.update({
    where: {
      id,
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
    },
  });

  await destroyAllUserSessions(id);
  clearAuthCookies(res);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Account deleted successfully',
    data: { message: 'Account deleted successfully' },
  });
});

const undeletedUser = catchAsync(async (req, res) => {
  const { id } = req.params as { id: string };

  await getManageableUser(req.user, id);

  const result = await prisma.user.update({
    where: { id },
    data: {
      isDeleted: false,
    },
    select: managedUserSelect,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Account reactivated successfully',
    data: result,
  });
});

export const UserServices = {
  getAllUsers,
  getMyProfile,
  getUserDetails,
  updateMyProfile,
  updateProfileImage,
  updateUserRoleStatus,
  updateUserStatus,
  deleteMyProfileFromDB,
  undeletedUser,
};
