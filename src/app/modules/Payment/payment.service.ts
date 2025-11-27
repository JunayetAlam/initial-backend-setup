import { UserRoleEnum } from '@prisma/client';
import httpStatus from 'http-status';
import { prisma } from '../../utils/prisma';
import AppError from '../../errors/AppError';
import { subscriptionCheckout } from '../../utils/StripeUtils';
import QueryBuilder from '../../builder/QueryBuilder';


const handleBuySubscription = async (id: string, userId: string, email: string, role: UserRoleEnum) => {
    const subscription = await prisma.subscription.findUniqueOrThrow({
        where: {
            id,
            isVisible: true
        }
    });
    if (!subscription) {
        throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found')
    };


    const isHaveSubscription = await prisma.payment.findFirst({
        where: {
            userId,
            paymentStatus: 'SUCCESS',
            endAt: {
                gte: new Date()
            },
            paymentType: 'SUBSCRIPTION'
        }
    });
    if(isHaveSubscription){
        throw new AppError(httpStatus.BAD_REQUEST, 'Already a subscription available!')
    }

    const isPaymentExist = await prisma.payment.findUnique({
        where: {
            userId_subscriptionPackageId: {
                subscriptionPackageId: id,
                userId: userId
            }
        },
        select: {
            id: true,
            userId: true,
            paymentMethodType: true,
            paymentStatus: true
        }
    })
    if (isPaymentExist && isPaymentExist.paymentStatus === 'SUCCESS') {
        throw new AppError(httpStatus.BAD_REQUEST, 'Already paid')
    }
    if (isPaymentExist) {
        const url = await subscriptionCheckout({
            email: email,
            paymentId: isPaymentExist.id,
            productId: subscription.stripeProductId,
            role: role

        })
        return { url }
    } else {
        const paymentData = await prisma.payment.create({
            data: {
                userId: userId,
                subscriptionPackageId: id,
                amount: subscription.price,
                currency: 'sek',
                paymentType: 'SUBSCRIPTION',
            }
        })
        const url = await subscriptionCheckout({
            email: email,
            paymentId: paymentData.id,
            productId: subscription.stripeProductId,
            role: role
        })
        return { url }
    }
}

const getAllPayments = async (userId: string, role: UserRoleEnum, query: Record<string, any>) => {
    if (role !== 'SUPERADMIN') {
        query.userId = userId
    }
    const paymentQuery = new QueryBuilder<typeof prisma.transaction>(prisma.transaction, query);
    const result = await paymentQuery
        .search(['user.name', 'user.email', 'vehicle.title', 'stripePaymentId', 'stripeSessionId'])
        .filter()
        .sort()
        .customFields({
            id: true,
            amount: true,
            userId: true,
            cardBrand: true,
            cardExpMonth: true,
            cardExpYear: true,
            cardLast4: true,
            paymentId: true,
            payment: {
                select: {
                    paymentType: true,
                    paymentMethodType: true,
                    paymentStatus: true,
                    stripeCustomerId: true,
                    stripePaymentId: true,
                    startAt: true,
                    endAt: true,
                    stripeSubscriptionId: true,
                    stripeSessionId: true,
                }
            },

            createdAt: true,

            stripeSessionId: true,

            user: {
                select: {
                    profilePhoto: true,
                    firstName: true,
                    lastName: true,
                    email: true
                }
            },
        })
        .exclude()
        .paginate()
        .execute()
    return result
};

const singleTransactionHistory = async (query: { id: string, userId?: string }) => {
    const result = await prisma.transaction.findUnique({
        where: query,
        select: {
            id: true,
            amount: true,
            userId: true,
            cardBrand: true,
            cardExpMonth: true,
            cardExpYear: true,
            cardLast4: true,
            paymentId: true,
            payment: {
                select: {
                    paymentType: true,
                    paymentMethodType: true,
                    paymentStatus: true,
                    stripeCustomerId: true,
                    stripePaymentId: true,
                    startAt: true,
                    endAt: true,
                    stripeSubscriptionId: true,
                }
            },

            createdAt: true,

            stripeSessionId: true,

            user: {
                select: {
                    profilePhoto: true,
                    firstName: true,
                    lastName: true,
                    email: true
                }
            },
        }
    }
    );
    if (!result) {
        throw new AppError(httpStatus.NOT_FOUND, 'Transaction history not found')
    }
    return result
}

const singleTransactionHistoryBySessionId = async (query: { stripeSessionId: string, userId?: string }) => {
    const result = await prisma.payment.findUnique({
        where: query,
        select: {
            id: true,
            amount: true,
            userId: true,
            paymentMethodType: true,
            createdAt: true,
            stripeCustomerId: true,
            stripePaymentId: true,
            stripeSessionId: true,
            currency: true,
            paymentStatus: true,
            startAt: true,
            endAt: true,
            stripeSubscriptionId: true,
            user: {
                select: {
                    profilePhoto: true,
                    firstName: true,
                    lastName: true,
                    email: true
                }
            },
        }
    });
    if (!result) {
        throw new AppError(httpStatus.NOT_FOUND, 'Transaction history not found')
    }
    return result
}

const handleRenewSubscription = async (id: string, userId: string, email: string, role: UserRoleEnum) => {
    const subscription = await prisma.subscription.findUniqueOrThrow({
        where: {
            id,
            isVisible: true
        }
    });

    if (!subscription) {
        throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found')
    }



    // Check if user has an expired or cancelled subscription for this package
    const expiredPayment = await prisma.payment.findFirst({
        where: {
            userId: userId,
            subscriptionPackageId: id,
            paymentType: 'SUBSCRIPTION',
            OR: [
                { paymentStatus: 'EXPIRED' },
                { paymentStatus: 'CANCELLED' },
                {
                    paymentStatus: 'SUCCESS',
                    endAt: { lt: new Date() } // Subscription has ended
                }
            ]
        },
        orderBy: { createdAt: 'desc' }
    });

    if (!expiredPayment) {
        throw new AppError(httpStatus.BAD_REQUEST, 'No expired subscription found to renew')
    }

    // Create new payment for renewal
    const renewalPayment = await prisma.payment.create({
        data: {
            userId: userId,
            subscriptionPackageId: id,
            amount: 10,
            currency: 'sek',
            paymentType: 'SUBSCRIPTION',
        }
    });

    const url = await subscriptionCheckout({
        email: email,
        paymentId: renewalPayment.id,
        productId: subscription.stripeProductId,
        role: role
    });

    return { url };
}

const getUserActiveSubscriptions = async (userId: string) => {
    const activeSubscriptions = await prisma.payment.findFirst({
        where: {
            userId: userId,
            paymentType: 'SUBSCRIPTION',
            paymentStatus: 'SUCCESS',
            endAt: { gt: new Date() } // Still active
        },
        include: {
            subscriptionPackage: {
                select: {
                    id: true,
                    name: true,
                    stripeProductId: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    return activeSubscriptions || {};
}

const cancelPayment = async (id: string, userId: string, role: UserRoleEnum) => {
    return await prisma.payment.update({
        where: {
            id,
            ...(role !== 'SUPERADMIN' && { userId })
        },
        data: {
            paymentStatus: 'CANCELLED'
        },
    })
}

export const PaymentService = {
    getAllPayments,
    singleTransactionHistory,
    singleTransactionHistoryBySessionId,
    cancelPayment,
    handleBuySubscription,
    handleRenewSubscription,
    getUserActiveSubscriptions,
};
