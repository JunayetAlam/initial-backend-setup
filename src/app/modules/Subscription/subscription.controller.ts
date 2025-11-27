import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { SubscriptionService } from './subscription.service';

const createSubscription = catchAsync(async (req, res) => {
  const payload = req.body;
  const result = await SubscriptionService.createSubscription(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: 'Subscription created successfully',
    data: result,
  });
});

const getAllSubscriptions = catchAsync(async (req, res) => {
  const result = await SubscriptionService.getAllSubscriptions(false);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'All subscriptions retrieved successfully',
    data: result,
  });
});

const getAllVisibleSubscriptions = catchAsync(async (req, res) => {
  const result = await SubscriptionService.getAllSubscriptions(true);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Visible subscriptions retrieved successfully',
    data: result,
  });
});

const getSingleSubscription = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await SubscriptionService.getSingle(id, false);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Subscription retrieved successfully',
    data: result,
  });
});



const getSingleSubscriptionWithAdminData = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await SubscriptionService.getSingle(id, true);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Subscription with admin data retrieved successfully',
    data: result,
  });
});

const updateSubscription = catchAsync(async (req, res) => {
  const { id } = req.params;
  const payload = req.body;
  const result = await SubscriptionService.updateSingle(id, payload);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Subscription updated successfully',
    data: result,
  });
});

const deleteSubscription = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await SubscriptionService.deleteSingle(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Subscription deleted successfully',
    data: result,
  });
});

const syncSubscriptions = catchAsync(async (req, res) => {
  const result = await SubscriptionService.syncWithStripe();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Subscriptions synced with Stripe successfully',
    data: result,
  });
});

export const SubscriptionController = {
  createSubscription,
  getAllSubscriptions,
  getAllVisibleSubscriptions,
  getSingleSubscription,
  getSingleSubscriptionWithAdminData,
  updateSubscription,
  deleteSubscription,
  syncSubscriptions,
};