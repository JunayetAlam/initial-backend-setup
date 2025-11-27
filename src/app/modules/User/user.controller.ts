import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { UserServices } from './user.service';
import { Request } from 'express';
import { prisma } from '../../utils/prisma';

const getAllUsers = catchAsync(async (req, res) => {
 const user = req.user;
  const result = await UserServices.getAllUsersFromDB(req.query, user);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'Users retrieved successfully',
      ...result
    });
  });

const getMyProfile = catchAsync(async (req, res) => {
  const id = req.user.id;
  const result = await UserServices.getMyProfileFromDB(id, req.user.role);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Profile retrieved successfully',
    data: result,
  });
});

const getUserDetails = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await UserServices.getUserDetailsFromDB(id, req.user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User details retrieved successfully',
    data: result,
  });
});

// Update profile fields
const updateMyProfile = catchAsync(async (req: Request, res) => {
  const id = req.user.id;
  const payload = req.body;

  const result = await UserServices.updateMyProfileIntoDB(id, payload);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User profile updated successfully',
    data: result,
  });
});

// Update profile image
const updateProfileImage = catchAsync(async (req: Request, res) => {
  const id = req.user.id;
  const file = req.file;
  const previousImg = req.user.profilePhoto || '';

  const result = await UserServices.updateProfileImg(id, previousImg, req, file);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Profile image updated successfully',
    data: result,
  });
});

const updateUserRoleStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const role = req.body.role;
  const result = await UserServices.updateUserRoleStatusIntoDB(id, role);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User role updated successfully',
    data: result,
  });
});

const updateUserStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const status = req.body.status;
  const result = await UserServices.updateProfileStatus(id, status);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'User status updated successfully',
    data: result,
  });
});


const deleteMyProfileFromDB = catchAsync(async (req, res) => {
  const id = req.user.id;
  const result = await UserServices.deleteMyProfileFromDB(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Account deleted successfully',
    data: result,
  });
});

const undeletedUser = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await UserServices.undeletedUser(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Account reactivated successfully',
    data: result,
  });
});

export const UserControllers = {
  getAllUsers,
  getMyProfile,
  getUserDetails,
  updateMyProfile,
  updateProfileImage,
  updateUserRoleStatus,
  updateUserStatus,
  deleteMyProfileFromDB,
  undeletedUser
};
