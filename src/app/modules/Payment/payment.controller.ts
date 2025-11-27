import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { PaymentService } from './payment.service';


const handleBuySubscription = catchAsync(async (req, res) => {
  const subscriptionId = req.body.subscriptionId;
  const userId = req.user.id;
  const email = req.user.email;
  const role = req.user.role;

  const result = await PaymentService.handleBuySubscription(subscriptionId, userId, email, role);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Subscription payment session created successfully',
    data: result,
  });
});

// Renew expired/cancelled subscription
const handleRenewSubscription = catchAsync(async (req, res) => {
  const subscriptionId = req.body.subscriptionId; // Subscription package ID from your DB
  const userId = req.user.id;
  const email = req.user.email;
  const role = req.user.role;

  const result = await PaymentService.handleRenewSubscription(subscriptionId, userId, email, role);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Subscription renewal session created successfully',
    data: result,
  });
});

// Get user's active subscriptions
const getUserActiveSubscriptions = catchAsync(async (req, res) => {
  const userId = req.user.id;

  const result = await PaymentService.getUserActiveSubscriptions(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Active subscriptions retrieved successfully',
    data: result,
  });
});

// Get all payments (superadmin -> all, others -> own)
const getAllPayments = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;

  const result = await PaymentService.getAllPayments(userId, role, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Payments retrieved successfully',
    data: result,
  });
});

// Single transaction history by ID
const singleTransactionHistory = catchAsync(async (req, res) => {
  const query = {
    id: req.params.id,
    ...(req.user.role !== 'SUPERADMIN' && { userId: req.user.id }),
  };

  const result = await PaymentService.singleTransactionHistory(query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Transaction history retrieved successfully',
    data: result,
  });
});

// Single transaction history by Stripe sessionId
const singleTransactionHistoryBySessionId = catchAsync(async (req, res) => {
  const query = {
    stripeSessionId: req.params.sessionId,
    ...(req.user.role !== 'SUPERADMIN' && { userId: req.user.id }),
  };

  const result = await PaymentService.singleTransactionHistoryBySessionId(query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Transaction history retrieved successfully by sessionId',
    data: result,
  });
});

// Cancel payment
const cancelPayment = catchAsync(async (req, res) => {
  const id = req.params.id;
  const userId = req.user.id;
  const role = req.user.role;

  const result = await PaymentService.cancelPayment(id, userId, role);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Payment cancelled successfully',
    data: result,
  });
});

export const PaymentController = {
  handleBuySubscription,
  handleRenewSubscription,
  getUserActiveSubscriptions,
  getAllPayments,
  singleTransactionHistory,
  singleTransactionHistoryBySessionId,
  cancelPayment,
};