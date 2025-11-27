import express from 'express';
import auth from '../../middlewares/auth';
import { UserControllers } from './user.controller';
import validateRequest from '../../middlewares/validateRequest';
import { userValidation } from './user.validation';
import { uploadMiddleware } from '../../middlewares/upload';

const router = express.Router();

router.get('/', auth('SUPERADMIN'), UserControllers.getAllUsers);
router.get('/me', auth('ANY'), UserControllers.getMyProfile);

router.get('/:id', auth('ANY'), UserControllers.getUserDetails);

router.put(
  '/update-profile',
  auth('ANY'),
  validateRequest.body(userValidation.updateUser),
  UserControllers.updateMyProfile,
);

router.put(
  '/update-profile-image',
  auth('ANY'),
  uploadMiddleware.single('file'),
  UserControllers.updateProfileImage,
);

router.put(
  '/user-role/:id',
  auth('SUPERADMIN'),
  validateRequest.body(userValidation.updateUserRoleSchema),
  UserControllers.updateUserRoleStatus,
);

router.put(
  '/user-status/:id',
  auth('SUPERADMIN'),
  validateRequest.body(userValidation.updateUserStatus),
  UserControllers.updateUserStatus,
);


router.delete(
  '/delete-my-profile',
  auth('USER'),
  UserControllers.deleteMyProfileFromDB,
);

router.put(
  '/undelete-user/:id',
  auth('SUPERADMIN'),
  UserControllers.undeletedUser,
);

export const UserRouters = router;
