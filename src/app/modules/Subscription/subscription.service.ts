import httpStatus from 'http-status';
import { getStripeRecurring, stripe } from '../../utils/stripe';
import AppError from '../../errors/AppError';
import { prisma } from '../../utils/prisma';
import { CreateSubscriptionPayload } from './subscription.interface';
import config from '../../../config';
import { updateSingleSubscription } from './update_subscription.service';

const createSubscription = async (payload: CreateSubscriptionPayload) => {
    const stripeProduct = await stripe.products.create({
        name: payload.name,
        description: `Subscription plan: ${payload.name}`,
        active: payload.active ?? true,
        metadata: {
            websiteId: config.website_identifier,
            billingCycle: payload.billingCycle,
            createdAt: new Date().toISOString()
        }
    });
    const recurringConfig = getStripeRecurring(payload.billingCycle);
    const stripePrice = await stripe.prices.create({
        product: stripeProduct.id,
        unit_amount: Math.round(payload.price * 100),
        currency: 'sek',
        recurring: recurringConfig,
        active: payload.active ?? true,
        metadata: {
            subscriptionProductId: stripeProduct.id
        }
    });

    await stripe.products.update(stripeProduct.id, {
        default_price: stripePrice.id
    });

    const subscription = await prisma.subscription.create({
        data: {
            name: payload.name,
            price: payload.price,
            billingCycle: payload.billingCycle,
            points: payload.points,
            active: payload.active ?? true,
            isVisible: payload.isVisible ?? true,
            stripeProductId: stripeProduct.id,
            stripePriceId: stripePrice.id,
            stripeActive: payload.active ?? true,
            currency: 'sek'
        },
    });



    return subscription;
};

const getAllSubscriptions = async (onlyIsVisible: boolean = false) => {
    const where = onlyIsVisible ? { isVisible: true, isDeleted: false } : { isDeleted: false };

    const subscriptions = await prisma.subscription.findMany({
        where,
        orderBy: { createdAt: 'desc' }
    });

    return subscriptions;
};

const getSingle = async (id: string, includeAdminData: boolean = false) => {
    const subscription = await prisma.subscription.findUniqueOrThrow({
        where: {
            id,
            ...(!includeAdminData && {
                isVisible: true,
            })
        },
    });

    return subscription;
};


const deleteSingle = async (id: string) => {
    const existingSubscription = await prisma.subscription.findUnique({
        where: { id }
    });

    if (!existingSubscription) {
        throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found');
    }

    // Deactivate in Stripe (don't delete)
    await stripe.products.update(existingSubscription.stripeProductId, {
        active: false
    });

    // Deactivate all prices for this product in Stripe
    const prices = await stripe.prices.list({ product: existingSubscription.stripeProductId });
    for (const price of prices.data) {
        if (price.active) {
            await stripe.prices.update(price.id, { active: false });
        }
    }

    // Deactivate in our database (soft delete)
    const deletedSubscription = await prisma.subscription.update({
        where: { id },
        data: {
            isDeleted: true
        }
    });

    return {
        message: 'Subscription deleted successfully',
        id: deletedSubscription.id
    };
};

// Sync function to ensure database and Stripe are in sync
const syncWithStripe = async () => {
    const subscriptions = await prisma.subscription.findMany({
        where: { stripeActive: true }
    });

    for (const sub of subscriptions) {
        const stripeProduct = await stripe.products.retrieve(sub.stripeProductId);

        if (!stripeProduct.active && sub.active) {
            await prisma.subscription.update({
                where: { id: sub.id },
                data: {
                    active: false,
                    stripeActive: false,
                    isVisible: false
                },
            });
        }
    }

    return { message: 'Sync completed successfully' };
};

export const SubscriptionService = {
    createSubscription,
    getAllSubscriptions,
    getSingle,
    updateSingle: updateSingleSubscription,
    deleteSingle,
    syncWithStripe
};