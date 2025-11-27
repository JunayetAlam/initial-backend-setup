import express from 'express';
import { SubscriptionController } from './subscription.controller';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { subscriptionValidation } from './subscription.validation';

const router = express.Router();

// Public routes (visible subscriptions)
router.get(
  '/',
  SubscriptionController.getAllVisibleSubscriptions
);

router.get(
  '/:id',
  SubscriptionController.getSingleSubscription
);

// Admin routes (require SUPERADMIN authentication)
router.post(
  '/',
  auth('SUPERADMIN'),
  validateRequest.body(subscriptionValidation.createSubscription),
  SubscriptionController.createSubscription
);

router.get(
  '/admin/all',
  auth('SUPERADMIN'),
  SubscriptionController.getAllSubscriptions
);

router.get(
  '/admin/:id',
  auth('SUPERADMIN'),
  SubscriptionController.getSingleSubscriptionWithAdminData
);

router.put(
  '/:id',
  auth('SUPERADMIN'),
  validateRequest.body(subscriptionValidation.updateSubscription),
  SubscriptionController.updateSubscription
);

router.delete(
  '/:id',
  auth('SUPERADMIN'),
  SubscriptionController.deleteSubscription
);

router.post(
  '/sync/stripe',
  auth('SUPERADMIN'),
  SubscriptionController.syncSubscriptions
);

export const SubscriptionRoutes = router;