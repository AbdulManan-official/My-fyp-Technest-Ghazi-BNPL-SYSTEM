// SchedulesDetailScreen.js - FINAL COMPLETE CODE v27 - Fixed Payment + Notify
// Displays full details, handles payments & notifications with improved UI.
// FIXED: Fixed Duration Payment button functionality & added specific admin notification.
// BUTTONS: Both Pay Buttons are Bright Red (#FF0000).
// HEADER STATUS: Line-by-line Label: [Badge] format below Order Date, Centered Image.
// FIXED: Used .map() to preserve dueDate Timestamps. Card style applied.
// Admin Notify per Installment & per Fixed Payment added.
// Adopted View-based Progress Bar & Installment Row/Highlight styles.
// All functionality included.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    StyleSheet, Text, View, SafeAreaView,
    ActivityIndicator, TouchableOpacity, StatusBar, ScrollView,
    Image, Alert, Platform, AppState, Animated // Ensure Animated is imported
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons'; // Ensure both icon sets are imported
import {
    getFirestore, collection, query, where, Timestamp,
    onSnapshot, doc, updateDoc, getDocs, writeBatch // Ensure all Firestore functions are imported
} from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig'; // Verify path
import { format, isValid, isPast, differenceInDays, isToday, isTomorrow, startOfDay } from 'date-fns'; // Ensure all date-fns functions are imported
import { useStripe } from '@stripe/stripe-react-native'; // Ensure Stripe hook is imported
import axios from 'axios'; // Ensure axios is imported

// --- Constants ---
const AppBackgroundColor = '#FFFFFF'; // Used for Card Background now
const ScreenBackgroundColor = '#F8F9FA';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const AccentColor = '#FF4500'; // Keep for non-button highlights (e.g., Remaining Amount, Grand Total)
const ActionButtonRed = '#FF0000'; // *** BRIGHT RED for Progress Bar, Highlights, AND BOTH PAY BUTTONS ***
const ProgressBarBackgroundColor = '#E9ECEF';
const SuccessColor = '#4CAF50';
const PendingColor = '#FFA726';
const OverdueColor = '#D32F2F';
const ProcessingColor = '#42A5F5';
const ActiveColor = '#29B6F6';
const ShippedColor = '#66BB6A';
const DeliveredColor = '#78909C';
const UnknownColor = '#BDBDBD';
const PaidColor = SuccessColor;
const PartiallyPaidColor = ProcessingColor;
const CancelledColor = OverdueColor;
const PlanAmountColor = '#0056b3';
const PlaceholderBgColor = '#F0F0F0';
const CardBorderColor = '#EAEAEA'; // Softer border for cards
const SubtleDividerColor = '#F0F0F0';
const InstallmentRowDefaultBorderColor = '#f0f0f0';

const ORDERS_COLLECTION = 'orders';
const USERS_COLLECTION = 'Users';
const ADMIN_COLLECTION = 'Admin';
const CURRENCY_SYMBOL = 'PKR';
const CURRENCY_CODE = 'PKR';
const BNPL_TYPE = 'BNPL';
const FIXED_TYPE = 'Fixed Duration';
const MIXED_TYPE = 'Mixed';
const PAID_STATUS = 'Paid';
const PENDING_STATUS = 'Pending';
const PARTIALLY_PAID_STATUS = 'Partially Paid';
const COMPLETED_ORDER_STATUS = 'Delivered';
const ACTIVE_ORDER_STATUS = 'Active';
const INSTALLMENT_DISPLAY_TEXT = 'Installment';

const placeholderImagePath = require('../../assets/p3.jpg'); // **** ADJUST PATH ****
const PAYMENT_API_ENDPOINT = "https://back.txyber.com/create-payment-intent"; // <--- !!! UPDATE THIS !!!
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

// --- Helper Functions ---

/**
 * Formats a Firestore Timestamp or Date object into 'MMM d, yyyy' format.
 */
const formatShortDate = (timestamp) => {
    let dateToFormat = null;
    if (timestamp instanceof Timestamp) { try { dateToFormat = timestamp.toDate(); } catch (e) { console.warn("TS date error", e); } }
    else if (timestamp instanceof Date) { dateToFormat = timestamp; }
    else if (timestamp && typeof timestamp.toDate === 'function') { try { dateToFormat = timestamp.toDate(); } catch (e) { console.warn("Obj date error", e); } }
    if (dateToFormat && isValid(dateToFormat)) { try { return format(dateToFormat, 'MMM d, yyyy'); } catch (e) { return 'Invalid Date'; } }
    return 'N/A';
};

/**
 * Returns the style object for the overall status badge background.
 */
const getOverallStatusStyle = (status) => {
    const lowerStatus = status?.toLowerCase() || 'unknown';
     switch (lowerStatus) {
        case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': case 'unpaid (bnpl)': return styles.statusBadgePending;
        case 'processing': return styles.statusBadgeProcessing;
        case PARTIALLY_PAID_STATUS.toLowerCase(): return styles.statusBadgePartiallyPaid;
        case 'shipped': return styles.statusBadgeShipped;
        case ACTIVE_ORDER_STATUS.toLowerCase(): return styles.statusBadgeActive;
        case 'delivered': case 'completed': return styles.statusBadgeDelivered;
        case 'cancelled': case 'rejected': return styles.statusBadgeCancelled;
        case PAID_STATUS.toLowerCase(): return styles.statusBadgePaid;
        default: return styles.statusBadgeUnknown;
    }
};

/**
 * Returns the style object for an installment status badge background.
 */
const getInstallmentStatusStyle = (status) => {
    return (status?.toLowerCase() === PAID_STATUS.toLowerCase())
        ? styles.statusPaidInstallment   // Green
        : styles.statusPendingInstallment; // Orange
};

/**
 * Calculates installment payment progress details.
 */
const calculateInstallmentProgress = (installments = []) => {
    if (!Array.isArray(installments) || installments.length === 0) {
        return { paidCount: 0, totalCount: 0, progressPercent: 0, nextDueDate: null, nextAmount: null, totalPaidAmount: 0 };
    }
    const totalCount = installments.length;
    let paidCount = 0, totalPaidAmount = 0, nextDueDate = null, nextAmount = null, foundNext = false;
    installments.forEach(inst => {
        if (inst.status?.toLowerCase() === PAID_STATUS.toLowerCase()) {
            paidCount++;
            if (typeof inst.amount === 'number') totalPaidAmount += inst.amount;
        } else if (!foundNext) {
            nextDueDate = inst.dueDate; nextAmount = inst.amount; foundNext = true;
        }
    });
    const progressPercent = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;
    return { paidCount, totalCount, progressPercent, nextDueDate, nextAmount, totalPaidAmount };
};

/**
 * Calculates the total remaining amount for an order.
 */
const calculateRemainingAmount = (orderData) => {
    if (!orderData || typeof orderData.grandTotal !== 'number') return 0;
    if (orderData.paymentStatus?.toLowerCase() === PAID_STATUS.toLowerCase()) return 0;
    let remainingCalculated = 0;
    if (orderData.codAmount && !orderData.codPaymentReceivedAt) { remainingCalculated += (typeof orderData.codAmount === 'number' ? orderData.codAmount : 0); }
    if (Array.isArray(orderData.installments)) {
        orderData.installments.forEach(inst => {
            if (inst.status?.toLowerCase() !== PAID_STATUS.toLowerCase()) {
                 if (typeof inst.amount === 'number') remainingCalculated += inst.amount;
                 if (typeof inst.penalty === 'number' && inst.penalty > 0) remainingCalculated += inst.penalty;
            }
        });
    }
    const hasFixedComp = !!orderData.fixedDurationAmountDue || !!orderData.paymentDueDate;
    const isFixedPaid = !!orderData.paymentReceivedAt;
    if (hasFixedComp && !isFixedPaid) {
         const fixedAmount = orderData.fixedDurationAmountDue ?? orderData.bnplAmount ?? 0;
         if (typeof fixedAmount === 'number') remainingCalculated += fixedAmount;
         if (typeof orderData.penalty === 'number' && orderData.penalty > 0) remainingCalculated += orderData.penalty;
    }
    return Math.max(0, remainingCalculated);
};

/**
 * Formats the time remaining until a due date.
 */
const formatTimeRemaining = (dueDateTimestamp) => {
    let dueDate = null;
    if (dueDateTimestamp instanceof Timestamp) { try { dueDate = dueDateTimestamp.toDate(); } catch (e) { return "Invalid Date"; } }
    else if (dueDateTimestamp instanceof Date) { dueDate = dueDateTimestamp; }
    else if (dueDateTimestamp && typeof dueDateTimestamp.toDate === 'function') { try { dueDate = dueDateTimestamp.toDate(); } catch (e) { return "Invalid Date"; } }
    if (!dueDate || !isValid(dueDate)) return "Due date N/A";
    const now = new Date();
    const dueDateStart = startOfDay(dueDate);
    const nowStart = startOfDay(now);
    if (isPast(dueDateStart) && !isToday(dueDateStart)) { const days = differenceInDays(nowStart, dueDateStart); return `Overdue by ${days} day${days > 1 ? 's' : ''}`; }
    if (isToday(dueDateStart)) return "Due today";
    if (isTomorrow(dueDateStart)) return "Due tomorrow";
    const days = differenceInDays(dueDateStart, nowStart);
    if (days >= 0) return `${days} day${days !== 1 ? 's' : ''} left`;
    return formatShortDate(dueDateTimestamp);
};

// --- Animated Component ---
const AnimatedTimeRemaining = ({ timeString, isOverdue }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        const animation = Animated.loop( Animated.sequence([ Animated.timing(pulseAnim, { toValue: 1.06, duration: 800, useNativeDriver: true }), Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }), ]) );
        animation.start();
        return () => animation.stop();
    }, [pulseAnim]);
    const textColor = isOverdue ? OverdueColor : TextColorPrimary;
    return ( <Animated.View style={[styles.timeRemainingAnimatedContainer, { transform: [{ scale: pulseAnim }] }]}><MaterialIcons name="timer" size={15} color={textColor} style={styles.iconStyle} /><Text style={[styles.detailValueDate, { color: textColor }]}>{timeString || ''}</Text></Animated.View> );
};

// --- Admin Notification Helpers ---
/**
 * Fetches Expo Push Tokens for admins.
 */
async function getAdminExpoTokens() {
    const tokens = [];
    try {
        const q = query(collection(db, ADMIN_COLLECTION), where("role", "==", "admin"));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) { console.log(`[getAdminExpoTokens] No admins found.`); return []; }
        querySnapshot.forEach((doc) => {
            const token = doc.data()?.expoPushToken;
            if (token && typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))) { tokens.push(token); }
        });
        console.log(`[getAdminExpoTokens] Found ${tokens.length} valid tokens.`);
    } catch (error) { console.error("[getAdminExpoTokens] Error:", error); }
    return tokens;
}

/**
 * Sends notifications to admins about FINAL order completion.
 */
async function sendAdminPaymentNotification(orderIdentifier, userName, finalPaidAmount, paymentMethod) {
    const adminTokens = await getAdminExpoTokens();
    if (!adminTokens || adminTokens.length === 0) { console.log("[AdminPaymentNotify] No tokens. Skipping final completion."); return; }
    const messages = adminTokens.map(token => ({
        to: token, sound: 'default', title: `🎉 Order #${orderIdentifier} Fully Paid!`,
        body: `User ${userName || 'N/A'} completed payment for ${paymentMethod} Order #${orderIdentifier}. Final payment: ${CURRENCY_SYMBOL}${finalPaidAmount?.toLocaleString()}`,
        data: { orderId: orderIdentifier, type: 'order_completed' }, priority: 'high', channelId: 'admin-notifications'
    }));
    try {
        console.log(`[AdminPaymentNotify] Sending ${messages.length} FINAL notifications for order ${orderIdentifier}...`);
        await axios.post(EXPO_PUSH_ENDPOINT, messages, { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Accept-encoding': 'gzip, deflate' }, timeout: 10000 });
        console.log(`[AdminPaymentNotify] Sent FINAL for order ${orderIdentifier}.`);
    } catch (error) { console.error(`[AdminPaymentNotify] Failed FINAL for ${orderIdentifier}:`, error.response?.data || error.message); }
}

/**
 * Sends a notification to admins when a single installment is paid.
 */
async function sendAdminInstallmentPaidNotification(orderId, userName, installmentNumber, installmentAmount) {
    const adminTokens = await getAdminExpoTokens();
    if (!adminTokens || adminTokens.length === 0) { console.log("[AdminInstallmentNotify] No admin tokens found. Skipping."); return; }
    const shortOrderId = orderId.substring(0, 6).toUpperCase();
    const body = `User ${userName || 'N/A'} paid Installment #${installmentNumber} (${CURRENCY_SYMBOL}${installmentAmount?.toLocaleString()}) for Order #${shortOrderId}.`;
    const messages = adminTokens.map(token => ({
        to: token, sound: 'default', title: `✅ Inst #${installmentNumber} Paid! (Order #${shortOrderId})`, body: body,
        data: { orderId: orderId, installmentNumber: installmentNumber, type: 'installment_paid' }, priority: 'high', channelId: 'admin-notifications',
    }));
    try {
        console.log(`[AdminInstallmentNotify] Sending ${messages.length} notifications for Order ${orderId}, Inst #${installmentNumber}...`);
        await axios.post(EXPO_PUSH_ENDPOINT, messages, { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Accept-encoding': 'gzip, deflate' }, timeout: 10000 });
        console.log(`[AdminInstallmentNotify] Sent for Order ${orderId}, Inst #${installmentNumber}.`);
    } catch (error) { console.error(`[AdminInstallmentNotify] Failed for Order ${orderId}, Inst #${installmentNumber}:`, error.response?.data || error.message); }
}

/**
 * Sends a notification to admins when the fixed duration portion is paid. (Added in v27)
 */
async function sendAdminFixedPaymentNotification(orderId, userName, amountPaid) {
    const adminTokens = await getAdminExpoTokens();
    if (!adminTokens || adminTokens.length === 0) { console.log("[AdminFixedNotify] No admin tokens found. Skipping."); return; }
    const shortOrderId = orderId.substring(0, 6).toUpperCase();
    const body = `User ${userName || 'N/A'} paid the Fixed Duration amount (${CURRENCY_SYMBOL}${amountPaid?.toLocaleString()}) for Order #${shortOrderId}.`;
    const messages = adminTokens.map(token => ({
        to: token, sound: 'default', title: `📅 Fixed Payment Received! (Order #${shortOrderId})`, body: body,
        data: { orderId: orderId, type: 'fixed_payment_paid' }, priority: 'high', channelId: 'admin-notifications',
    }));
    try {
        console.log(`[AdminFixedNotify] Sending ${messages.length} notifications for Order ${orderId}...`);
        await axios.post(EXPO_PUSH_ENDPOINT, messages, { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Accept-encoding': 'gzip, deflate' }, timeout: 10000 });
        console.log(`[AdminFixedNotify] Sent for Order ${orderId}.`);
    } catch (error) { console.error(`[AdminFixedNotify] Failed for Order ${orderId}:`, error.response?.data || error.message); }
}
// --- End Admin Notification Helpers ---

// --- Main Detail Screen Component ---
export default function SchedulesDetailScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const initialOrder = route.params?.order;

    // State
    const [order, setOrder] = useState(initialOrder);
    const { initPaymentSheet, presentPaymentSheet, loading: stripeLoadingHook } = useStripe();
    const [payingItemId, setPayingItemId] = useState(null);
    const [localError, setLocalError] = useState(null);
    const appState = useRef(AppState.currentState);
    const listenerUnsubscribeRef = useRef(null);

    // Effect: Real-time Firestore Listener
    useEffect(() => {
        const currentOrderId = order?.id || initialOrder?.id;
        if (!currentOrderId) { if (!initialOrder) setLocalError("Order details missing."); return; }
        const orderRef = doc(db, ORDERS_COLLECTION, currentOrderId);
        let unsubscribe = null;
        const setupListener = () => {
            if (listenerUnsubscribeRef.current) listenerUnsubscribeRef.current();
            unsubscribe = onSnapshot(orderRef, (docSnap) => {
                if (docSnap.exists()) { setOrder({ id: docSnap.id, ...docSnap.data() }); setLocalError(null); }
                else { setLocalError("This order may have been deleted."); setOrder(null); if (listenerUnsubscribeRef.current) listenerUnsubscribeRef.current(); }
            }, (error) => { setLocalError("Real-time update failed."); });
            listenerUnsubscribeRef.current = unsubscribe;
        };
        const handleAppStateChange = (nextAppState) => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') setupListener();
            else if (nextAppState.match(/inactive|background/)) { if (listenerUnsubscribeRef.current) { listenerUnsubscribeRef.current(); listenerUnsubscribeRef.current = null; } }
            appState.current = nextAppState;
        };
        const subscription = AppState.addEventListener('change', handleAppStateChange);
        if (appState.current === 'active') setupListener();
        return () => { subscription.remove(); if (listenerUnsubscribeRef.current) listenerUnsubscribeRef.current(); };
    }, [initialOrder?.id]); // Dependency on initialOrder.id ensures listener resets if screen is reused for a different order

    // Effect: Update state from route params if initialOrder changes *after* mount
    useEffect(() => { if (route.params?.order && route.params.order.id !== order?.id) { setOrder(route.params.order); } }, [route.params?.order, order?.id]);

    // --- Payment Functions ---
    const initializeAndPay = async (currentOrderData, amountToPay, paymentTypeLabel, installmentDetails = null) => {
        const orderId = currentOrderData.id;
        // Create a unique ID for this payment attempt (useful for loading state)
        const paymentAttemptId = `${orderId}-${paymentTypeLabel}-${installmentDetails?.installmentNumber ?? 'fixed'}-${Date.now()}`;

        // Pre-Checks
        if (!amountToPay || amountToPay <= 0) { Alert.alert("Error", "Invalid payment amount specified."); return; }
        if (payingItemId) { Alert.alert("Payment In Progress", "Another payment is currently being processed. Please wait."); return; }
        if (stripeLoadingHook) { Alert.alert("Initializing Payment", "Stripe is still loading. Please wait a moment."); return; }
        if (!auth.currentUser) { Alert.alert("Authentication Error", "You must be logged in to make a payment."); navigation.navigate('Login'); return; } // Redirect to login if needed

        // Specific payment type checks
        if (paymentTypeLabel === 'Installment' && installmentDetails?.status?.toLowerCase() === PAID_STATUS.toLowerCase()) { Alert.alert("Already Paid", "This installment has already been paid."); return; }
        if (paymentTypeLabel === 'Fixed Duration' && currentOrderData.paymentReceivedAt) { Alert.alert("Already Paid", "The fixed duration payment for this order has already been paid."); return; }

        setPayingItemId(paymentAttemptId); // Set loading state for *this* specific payment attempt
        setLocalError(null);

        try {
            // 1. Call Backend to Create Payment Intent
            console.log(`[Payment] Initiating payment for Order ${orderId}, Type: ${paymentTypeLabel}, Amount: ${amountToPay}`);
            const response = await axios.post(PAYMENT_API_ENDPOINT, {
                amount: Math.round(amountToPay * 100), // Amount in cents
                currency: CURRENCY_CODE.toLowerCase(),
                orderId: currentOrderData.id,
                userId: auth.currentUser.uid,
                paymentDescription: `Payment for Order #${currentOrderData.orderNumber || currentOrderData.id.substring(0,6)} - ${paymentTypeLabel}`,
                customerName: currentOrderData.userName || 'N/A',
                customerEmail: auth.currentUser.email || undefined, // Optional but recommended
                metadata: {
                    order_id: currentOrderData.id,
                    user_id: auth.currentUser.uid,
                    payment_type: paymentTypeLabel,
                    installment_number: installmentDetails?.installmentNumber ?? null // Include installment number if applicable
                }
            });

            const { clientSecret, ephemeralKey, customer, error: backendError } = response.data;

            if (backendError || !clientSecret) {
                console.error(`[Payment Backend Error] Order ${orderId}: ${backendError || 'Missing clientSecret'}`);
                throw new Error(backendError || "Failed to set up payment on the server.");
            }

            // 2. Initialize Payment Sheet
            console.log(`[Payment] Initializing Stripe Payment Sheet for Order ${orderId}`);
            const { error: initError } = await initPaymentSheet({
                merchantDisplayName: "Txyber", // Your merchant name
                paymentIntentClientSecret: clientSecret,
                customerId: customer, // Optional: Reuse Stripe customer ID
                customerEphemeralKeySecret: ephemeralKey, // Required for customer reuse
                allowsDelayedPaymentMethods: false, // Set true if you allow bank debits etc.
                // appearance: { /* ... customize appearance ... */ } // Optional
            });

            if (initError) {
                console.error(`[Payment Sheet Init Error] Order ${orderId}: ${initError.code} - ${initError.message}`);
                throw new Error(`Failed to initialize payment sheet: ${initError.localizedMessage || initError.message}`);
            }

            // 3. Present Payment Sheet
            console.log(`[Payment] Presenting Stripe Payment Sheet for Order ${orderId}`);
            const { error: paymentError } = await presentPaymentSheet();

            if (paymentError) {
                if (paymentError.code === 'Canceled') {
                    console.log(`[Payment] Payment canceled by user for Order ${orderId}.`);
                    Alert.alert("Payment Canceled", "The payment process was canceled.");
                } else {
                    console.error(`[Payment Sheet Present Error] Order ${orderId}: ${paymentError.code} - ${paymentError.message}`);
                    throw new Error(`Payment failed: ${paymentError.localizedMessage || paymentError.message}`);
                }
            } else {
                // 4. Payment Successful - Update Firestore
                console.log(`[Payment] Payment successful for Order ${orderId}, Type: ${paymentTypeLabel}. Updating Firestore...`);
                Alert.alert("Payment Successful!", "Your payment has been processed successfully.");
                await updateFirestoreAfterPayment(currentOrderData, amountToPay, paymentTypeLabel, installmentDetails);
            }
        } catch (error) {
            console.error(`[Payment Flow Error] Order ${orderId}, Attempt ${paymentAttemptId}:`, error);
            Alert.alert("Payment Error", error.message || "An unexpected error occurred during payment.");
            setLocalError(`Payment failed: ${error.message}`); // Display error locally
        } finally {
            setPayingItemId(null); // Clear loading state regardless of outcome
        }
    };

    const updateFirestoreAfterPayment = async (orderData, paidAmount, paymentType, paidInstallment = null) => {
        const orderRef = doc(db, ORDERS_COLLECTION, orderData.id);
        const batch = writeBatch(db); // Use batch for atomic updates
        console.log(`[Firestore Update] Starting update for Order ${orderData.id}, Payment Type: ${paymentType}`);

        try {
            const now = Timestamp.now();
            let updates = {}; // Object to hold Firestore field updates
            let shouldNotifyAdminOrderComplete = false; // Flag to trigger final notification

            // --- Handle Installment Payment ---
            if (paymentType === 'Installment' && paidInstallment) {
                let updateOccurred = false;
                let updatedInstallmentDetails = null;
                let currentInstallments = orderData.installments || [];

                // Map over installments to find and update the paid one
                const newInstallments = currentInstallments.map(inst => {
                    if (inst.installmentNumber === paidInstallment.installmentNumber && inst.status?.toLowerCase() !== PAID_STATUS.toLowerCase()) {
                        updateOccurred = true;
                        updatedInstallmentDetails = { // Store details for notification
                            ...inst,
                            status: PAID_STATUS,
                            paid: true, // Keep for consistency if used elsewhere
                            paidAt: now
                        };
                        console.log(`[Firestore Update] Marking Inst #${inst.installmentNumber} as Paid for Order ${orderData.id}`);
                        return updatedInstallmentDetails;
                    }
                    return inst; // Keep other installments as they are
                });

                if (!updateOccurred) {
                    console.warn(`[Firestore Update] No update needed for Inst #${paidInstallment.installmentNumber} (already paid or not found) for Order ${orderData.id}.`);
                    return; // Avoid unnecessary write if installment already paid or mismatch
                }

                updates.installments = newInstallments; // Update the installments array

                // Check if ALL components are now paid to mark the order complete
                const allInstallmentsPaid = newInstallments.every(i => i.status?.toLowerCase() === PAID_STATUS.toLowerCase());
                const codPaid = !orderData.codAmount || !!orderData.codPaymentReceivedAt; // COD is paid if no COD amount OR it has a received date
                const fixedPaid = !(!!orderData.fixedDurationAmountDue || !!orderData.paymentDueDate) || !!orderData.paymentReceivedAt; // Fixed is paid if no fixed component OR it has a received date

                if (allInstallmentsPaid && codPaid && fixedPaid) {
                    console.log(`[Firestore Update] Order ${orderData.id} fully paid after installment payment.`);
                    updates.paymentStatus = PAID_STATUS;
                    // Only update paymentReceivedAt if it wasn't already set (e.g., by fixed payment)
                    updates.paymentReceivedAt = orderData.paymentReceivedAt || now;
                    // Update order status if it's in a state that should transition to completed
                    if (orderData.status?.toLowerCase() !== 'cancelled' && orderData.status?.toLowerCase() !== 'rejected' && orderData.status !== COMPLETED_ORDER_STATUS) {
                        updates.status = COMPLETED_ORDER_STATUS;
                        updates.deliveredAt = orderData.deliveredAt || now; // Mark as delivered now
                        console.log(`[Firestore Update] Setting Order ${orderData.id} status to ${COMPLETED_ORDER_STATUS}.`);
                    }
                    shouldNotifyAdminOrderComplete = true; // Flag for final admin notification
                } else {
                     console.log(`[Firestore Update] Order ${orderData.id} is now Partially Paid after installment.`);
                    updates.paymentStatus = PARTIALLY_PAID_STATUS;
                }

                // Commit Firestore updates FIRST
                batch.update(orderRef, updates);
                console.log(`[Firestore Update] Committing batch update for Order ${orderData.id} (Installment)`);
                await batch.commit();
                console.log(`[Firestore Update] Batch commit successful for Order ${orderData.id}`);

                // THEN Send Notifications
                if (updatedInstallmentDetails) {
                    await sendAdminInstallmentPaidNotification(orderData.id, orderData.userName || 'user', updatedInstallmentDetails.installmentNumber, updatedInstallmentDetails.amount);
                }
                if (shouldNotifyAdminOrderComplete) {
                    await sendAdminPaymentNotification(orderData.orderNumber || orderData.id, orderData.userName || 'user', paidAmount, orderData.paymentMethod);
                }
                return; // Exit after handling installment

            // --- Handle Fixed Duration Payment ---
            } else if (paymentType === 'Fixed Duration') {
                if (orderData.paymentReceivedAt) {
                     console.warn(`[Firestore Update] Fixed duration payment already recorded for Order ${orderData.id}. Skipping update.`);
                     return; // Avoid duplicate updates
                }

                console.log(`[Firestore Update] Marking Fixed Duration as Paid for Order ${orderData.id}`);
                updates.paymentReceivedAt = now; // Mark the fixed part as paid

                // Check if ALL components are now paid
                const finalCheckInstallments = orderData.installments || [];
                const allInstallmentsPaid = finalCheckInstallments.every(i => i.status?.toLowerCase() === PAID_STATUS.toLowerCase());
                const codPaid = !orderData.codAmount || !!orderData.codPaymentReceivedAt;
                // Fixed portion is now considered paid because we are setting updates.paymentReceivedAt

                if (allInstallmentsPaid && codPaid) {
                    console.log(`[Firestore Update] Order ${orderData.id} fully paid after Fixed Duration payment.`);
                    updates.paymentStatus = PAID_STATUS;
                     // Update order status if needed
                    if (orderData.status?.toLowerCase() !== 'cancelled' && orderData.status?.toLowerCase() !== 'rejected' && orderData.status !== COMPLETED_ORDER_STATUS) {
                        updates.status = COMPLETED_ORDER_STATUS;
                        updates.deliveredAt = orderData.deliveredAt || now;
                        console.log(`[Firestore Update] Setting Order ${orderData.id} status to ${COMPLETED_ORDER_STATUS}.`);
                    }
                    shouldNotifyAdminOrderComplete = true;
                } else {
                    console.log(`[Firestore Update] Order ${orderData.id} is now Partially Paid after Fixed Duration payment.`);
                    updates.paymentStatus = PARTIALLY_PAID_STATUS;
                }

                // Commit Firestore updates FIRST
                batch.update(orderRef, updates);
                console.log(`[Firestore Update] Committing batch update for Order ${orderData.id} (Fixed Duration)`);
                await batch.commit();
                console.log(`[Firestore Update] Batch commit successful for Order ${orderData.id}`);

                // THEN Send Notifications
                // Send notification specifically for the fixed payment
                await sendAdminFixedPaymentNotification(orderData.id, orderData.userName || 'user', paidAmount);
                // Send notification for final order completion if applicable
                if (shouldNotifyAdminOrderComplete) {
                    await sendAdminPaymentNotification(orderData.orderNumber || orderData.id, orderData.userName || 'user', paidAmount, orderData.paymentMethod);
                }
                return; // Exit after handling fixed payment

            // --- Handle Other Payment Types (if any) ---
            } else {
                console.warn(`[Firestore Update] Unhandled payment type: ${paymentType} for Order ${orderData.id}. No Firestore update performed.`);
                return;
            }

        } catch (error) {
            console.error(`[Firestore Update Error] Failed to update Order ${orderData.id} after payment:`, error);
            // Alert user about the update failure, even though payment was successful
            Alert.alert(
                "Database Update Error",
                "Your payment was successful, but there was an issue updating the order details in our system. Please contact support if the status doesn't update shortly."
            );
            // Optionally: Log this error more robustly (e.g., to a monitoring service)
        }
    };

    // --- Payment Button Handlers (wrapped in useCallback for potential optimization) ---
    const handlePayInstallment = useCallback((installment) => {
        if (!order || !installment) {
            console.error("[handlePayInstallment] Order or Installment data is missing.");
            Alert.alert("Error", "Cannot proceed with payment. Order details are incomplete.");
            return;
        }
        // Calculate total amount including penalty for the specific installment
        const amountToPay = (installment.amount || 0) + (installment.penalty || 0);
        if (amountToPay <= 0) {
            Alert.alert("Error", "The calculated installment amount is invalid.");
            return;
        }
        console.log(`[Pay Button] Initiating payment for Installment #${installment.installmentNumber}, Amount: ${amountToPay}`);
        initializeAndPay(order, amountToPay, 'Installment', installment); // Pass installment details
    }, [order, initializeAndPay]); // Dependencies: order data and the payment function

    const handlePayFixedDuration = useCallback((amountDue) => {
        if (!order) {
            console.error("[handlePayFixedDuration] Order data is missing.");
             Alert.alert("Error", "Cannot proceed with payment. Order details are incomplete.");
            return;
        }
        if (typeof amountDue !== 'number' || amountDue <= 0) {
            Alert.alert("Error", "The specified fixed duration amount is invalid.");
            return;
        }
        // Calculate total amount including order-level penalty
        const amountToPay = amountDue + (order?.penalty || 0);
        if (amountToPay <= 0) {
            Alert.alert("Error", "The calculated fixed duration amount is invalid.");
             return;
        }
        console.log(`[Pay Button] Initiating payment for Fixed Duration, Amount: ${amountToPay}`);
        initializeAndPay(order, amountToPay, 'Fixed Duration'); // No specific installment details needed
    }, [order, initializeAndPay]); // Dependencies: order data and the payment function


    // --- Loading/Error State Rendering ---
    // Initial loading state (before initialOrder is even available from route params)
    if (!order && !localError && initialOrder === undefined) {
        return (
            <SafeAreaView style={styles.centeredContainer}>
                <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
                <ActivityIndicator size="large" color={AccentColor} />
                <Text style={styles.loadingText}>Loading order details...</Text>
            </SafeAreaView>
        );
    }

    // Error state (e.g., order deleted, listener failed, initial data missing)
    if (!order && localError) {
        return (
            <SafeAreaView style={styles.centeredContainer}>
                <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
                <MaterialIcons name="error-outline" size={60} color={OverdueColor} />
                <Text style={styles.errorText}>{localError}</Text>
                {navigation.canGoBack() && (
                    <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, {backgroundColor: OverdueColor}]}>
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </TouchableOpacity>
                )}
            </SafeAreaView>
        );
    }

     // Loading state while fetching latest data after initial data was present
     if (!order && !localError && initialOrder !== undefined) {
         return (
             <SafeAreaView style={styles.centeredContainer}>
                 <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
                 <ActivityIndicator size="large" color={AccentColor} />
                 <Text style={styles.loadingText}>Loading latest order details...</Text>
             </SafeAreaView>
         );
     }

    // Final fallback if order somehow becomes null without an error set
    if (!order) {
        return (
            <SafeAreaView style={styles.centeredContainer}>
                <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
                 <MaterialIcons name="search-off" size={60} color={TextColorSecondary} />
                <Text style={styles.errorText}>Failed to load order details or order not found.</Text>
                 {navigation.canGoBack() && (
                    <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton]}>
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </TouchableOpacity>
                )}
            </SafeAreaView>
        );
    }

    // --- Derive data for Rendering (once order data is available) ---
    const paymentMethod = order.paymentMethod || 'Unknown';
    // Use specific display text for BNPL
    const displayPaymentMethodText = paymentMethod === BNPL_TYPE ? INSTALLMENT_DISPLAY_TEXT : paymentMethod;
    const displayId = order.orderNumber ? `#${order.orderNumber}` : `#${order.id.substring(0, 6).toUpperCase()}`;
    const firstItem = order.items?.[0]; // Assuming first item's image represents the order
    const imageSource = firstItem?.image ? { uri: firstItem.image } : placeholderImagePath;
    const orderStatus = order.status || 'Unknown';
    const paymentStatus = order.paymentStatus || 'N/A'; // e.g., 'Paid', 'Partially Paid', 'Pending'

    // Determine which sections to show based on payment method and data presence
    const isInstallmentPlan = paymentMethod === BNPL_TYPE;
    const showInstallmentSection = isInstallmentPlan || (order.paymentMethod === MIXED_TYPE && Array.isArray(order.installments) && order.installments.length > 0);
    const showFixedDurationSection = (order.paymentMethod === FIXED_TYPE) || (order.paymentMethod === MIXED_TYPE && (!!order.paymentDueDate || !!order.fixedDurationAmountDue));
    const showCodSection = (order.paymentMethod === 'COD') || (order.paymentMethod === MIXED_TYPE && typeof order.codAmount === 'number' && order.codAmount > 0);

    // Calculate progress and remaining amounts
    const { paidCount, totalCount, progressPercent } = showInstallmentSection ? calculateInstallmentProgress(order.installments) : { paidCount: 0, totalCount: 0, progressPercent: 0 };
    const remainingAmount = calculateRemainingAmount(order);

    // Find the next installment to pay (if applicable)
    const firstUnpaidInstallment = showInstallmentSection && totalCount > paidCount
        ? (order.installments || []).find(inst => inst.status?.toLowerCase() !== PAID_STATUS.toLowerCase())
        : null;

    // Details for the Fixed Duration section
    const fixedDueDate = showFixedDurationSection ? order.paymentDueDate : null;
    const fixedAmountDue = showFixedDurationSection ? (order.fixedDurationAmountDue ?? order.bnplAmount ?? 0) : 0; // Use fixedAmount first, fallback to bnplAmount if needed for legacy/mixed cases
    const fixedAmountToPay = fixedAmountDue + (order.penalty || 0); // Total including penalty
    const isFixedPaid = showFixedDurationSection && !!order.paymentReceivedAt; // Check if the fixed payment has been received

    // Format time remaining for fixed due date
    const timeRemainingString = fixedDueDate ? formatTimeRemaining(fixedDueDate) : "";
    // Check if fixed due date is past (and not today) - used for styling
    const isFixedOverdue = !isFixedPaid && fixedDueDate && isValid(fixedDueDate?.toDate ? fixedDueDate.toDate() : fixedDueDate)
        ? isPast(startOfDay(fixedDueDate.toDate())) && !isToday(startOfDay(fixedDueDate.toDate()))
        : false;

    // Determine loading/disabled states for buttons
    const isAnyPaymentProcessing = !!payingItemId; // Is *any* payment attempt currently active?
    // Is the currently processing payment for *this specific* installment?
    const isPayingThisInstallment = !!(firstUnpaidInstallment && payingItemId?.startsWith(`${order.id}-Installment-${firstUnpaidInstallment.installmentNumber}`));
    // Is the currently processing payment for *this specific* fixed payment?
    const isPayingThisFixed = !!(!isFixedPaid && payingItemId?.startsWith(`${order.id}-Fixed Duration-fixed`));
    // Disable buttons if Stripe hook is loading OR any payment is processing
    const disableButton = stripeLoadingHook || isAnyPaymentProcessing;


    // --- Main Render Structure ---
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
            <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">

                {/* Optional Error Banner for non-critical errors (e.g., real-time update temporarily failed) */}
                {localError && order ? (
                    <View style={styles.errorBanner}>
                        <Text style={styles.errorBannerText}>⚠️ {localError}</Text>
                    </View>
                ) : null}

                 {/* Card 1: Header - Product Image, Order ID, Date, Statuses */}
                 <View style={styles.card}>
                    <View style={styles.headerProductInfo}>
                         {/* Use defaultSource for better UX while image loads */}
                        <Image
                            source={imageSource}
                            style={styles.headerImage}
                            defaultSource={placeholderImagePath} // Show placeholder initially
                        />
                        <View style={styles.headerTextContainer}>
                             <Text style={styles.headerProductName} numberOfLines={2}>{firstItem?.name || 'Order Item(s)'}</Text>
                             <Text style={styles.headerOrderId}>Order ID: {displayId}</Text>
                             <Text style={styles.headerOrderDate}>Ordered on: {formatShortDate(order.createdAt)}</Text>
                             {/* Statuses displayed line-by-line */}
                            <View style={styles.headerStatusColumn}>
                                <View style={styles.headerStatusLineItem}>
                                    <Text style={styles.headerStatusLabel}>Payment:</Text>
                                    <View style={[styles.statusBadgeValue, getOverallStatusStyle(paymentStatus)]}>
                                        <MaterialCommunityIcons name="credit-card-check-outline" size={13} color="#fff" style={styles.badgeIcon}/>
                                        <Text style={styles.statusBadgeTextValue}>{paymentStatus}</Text>
                                    </View>
                                </View>
                                <View style={styles.headerStatusLineItem}>
                                    <Text style={styles.headerStatusLabel}>Order:</Text>
                                    <View style={[styles.statusBadgeValue, getOverallStatusStyle(orderStatus)]}>
                                        <MaterialCommunityIcons name="package-variant-closed" size={13} color="#fff" style={styles.badgeIcon}/>
                                        <Text style={styles.statusBadgeTextValue}>{orderStatus}</Text>
                                     </View>
                                </View>
                                <View style={styles.headerStatusLineItem}>
                                    <Text style={styles.headerStatusLabel}>Method:</Text>
                                    <View style={[styles.statusBadgeValue, styles.paymentMethodBadge]}>
                                        <MaterialIcons name="payment" size={13} color="#fff" style={styles.badgeIcon}/>
                                        <Text style={styles.statusBadgeTextValue}>{displayPaymentMethodText}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                 </View>

                {/* Card 2: Payment Details - Breakdown, Progress, Totals, Pay Buttons */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Payment Breakdown</Text>

                    {/* Conditionally Render COD Section */}
                    {showCodSection ? (
                        <View style={styles.componentSubSection}>
                            <Text style={styles.componentTitle}>Cash on Delivery</Text>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Amount:</Text>
                                <Text style={styles.detailValueEmphasized}>{CURRENCY_SYMBOL}{(order.codAmount || 0).toLocaleString()}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Status:</Text>
                                <Text style={styles.detailValue}>
                                    {order.codPaymentReceivedAt
                                        ? `Paid (${formatShortDate(order.codPaymentReceivedAt)})`
                                        : 'Pending'}
                                </Text>
                            </View>
                        </View>
                    ) : null }

                    {/* Conditionally Render Installment Section */}
                    {showInstallmentSection ? (
                        <View style={[styles.componentSubSection, showCodSection && styles.componentSpacing]}>
                            <Text style={styles.componentTitle}>Installment Plan</Text>

                             {/* Installment Progress Bar */}
                             {totalCount > 0 ? (
                                <View style={styles.progressSection}>
                                    <View style={styles.progressTextContainer}>
                                        <Text style={styles.progressText}>Progress</Text>
                                        <Text style={styles.progressCountText}>{paidCount}/{totalCount} Paid</Text>
                                    </View>
                                    <View style={styles.progressBarContainer}>
                                        <View style={styles.progressBarBackground}>
                                            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                                        </View>
                                    </View>
                                </View>
                             ) : null }

                             {/* Installment List */}
                             {(order.installments && order.installments.length > 0) ? (
                                 order.installments.map((installment, index, arr) => {
                                     const isLast = index === arr.length - 1;
                                     const isNext = firstUnpaidInstallment?.installmentNumber === installment.installmentNumber;
                                     const isPaid = installment.status?.toLowerCase() === PAID_STATUS.toLowerCase();
                                     // Check if installment is overdue
                                     const installmentDueDate = installment.dueDate?.toDate ? installment.dueDate.toDate() : installment.dueDate;
                                     const isOverdue = !isPaid && installmentDueDate && isValid(installmentDueDate) && isPast(startOfDay(installmentDueDate)) && !isToday(startOfDay(installmentDueDate));

                                     return (
                                        <View
                                            key={`inst-${order.id}-${installment.installmentNumber || index}`} // Ensure unique key
                                            style={[
                                                styles.installmentRow,
                                                isLast && styles.installmentRow_lastChild, // Style for last item
                                                isNext && styles.nextInstallmentHighlight // Highlight next due
                                            ]}
                                        >
                                            {/* Left Side: Number, Amount, Penalty */}
                                            <View style={styles.installmentLeft}>
                                                <Text style={styles.installmentNumber}>Inst. #{installment.installmentNumber || index + 1}</Text>
                                                <Text style={styles.installmentAmount}>{CURRENCY_SYMBOL} {installment.amount?.toLocaleString() ?? 'N/A'}</Text>
                                                {/* Show penalty if applicable */}
                                                {typeof installment.penalty === 'number' && installment.penalty > 0 ? (
                                                    <Text style={styles.penaltyText}>
                                                        <MaterialIcons name="warning" size={12} color={OverdueColor} style={{marginRight: 2}}/>
                                                        Penalty: {CURRENCY_SYMBOL}{installment.penalty.toFixed(0)}
                                                    </Text>
                                                ) : null}
                                            </View>
                                            {/* Right Side: Status Badge, Due Date, Paid Date */}
                                            <View style={styles.installmentRight}>
                                                <View style={[styles.statusBadgeSmall, getInstallmentStatusStyle(installment.status)]}>
                                                    <Text style={styles.statusTextSmall}>{installment.status || PENDING_STATUS}</Text>
                                                </View>
                                                <Text style={[styles.installmentDueDate, isOverdue && styles.overdueText]}>
                                                    <MaterialIcons name="date-range" size={12} color={isOverdue ? OverdueColor : TextColorSecondary} style={{marginRight: 3}}/>
                                                    {formatShortDate(installment.dueDate)} {isOverdue ? '(Overdue)' : ''}
                                                </Text>
                                                {/* Show paid date if available */}
                                                {isPaid && installment.paidAt ? (
                                                    <Text style={styles.paidAtText}>
                                                        <MaterialIcons name="check-circle" size={11} color={SuccessColor} style={{marginRight: 3}}/>
                                                         Paid: {formatShortDate(installment.paidAt)}
                                                    </Text>
                                                ) : null}
                                            </View>
                                        </View>
                                     );
                                 })
                             ) : (
                                <Text style={styles.noScheduleText}>No installment schedule found for this order.</Text>
                             )}
                        </View>
                    ) : null }

                    {/* Conditionally Render Fixed Duration Section */}
                    {showFixedDurationSection ? (
                        <View style={[styles.componentSubSection, (showCodSection || showInstallmentSection) && styles.componentSpacing]}>
                            <Text style={styles.componentTitle}>Fixed Duration Payment</Text>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Amount Due:</Text>
                                <Text style={styles.detailValueEmphasized}>{CURRENCY_SYMBOL}{fixedAmountDue.toLocaleString()}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Due Date:</Text>
                                <View style={styles.fixedDueDateContainer}>
                                    {/* Animated Time Remaining */}
                                    <AnimatedTimeRemaining timeString={timeRemainingString} isOverdue={isFixedOverdue && !isFixedPaid} />
                                    {/* Absolute Date */}
                                    <Text style={styles.absoluteDateText}>({formatShortDate(fixedDueDate)})</Text>
                                </View>
                            </View>
                             {/* Show Order-Level Penalty if applicable */}
                            {typeof order.penalty === 'number' && order.penalty > 0 && !isFixedPaid ? (
                                <View style={styles.detailRow}>
                                    <Text style={[styles.detailLabel, styles.penaltyLabel]}>
                                        <MaterialIcons name="warning" size={14} color={OverdueColor} style={{marginRight: 3}}/> Penalty:
                                    </Text>
                                    <Text style={[styles.detailValue, styles.penaltyValue]}>
                                        {CURRENCY_SYMBOL}{order.penalty.toFixed(0)}
                                    </Text>
                                </View>
                            ) : null }
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Status:</Text>
                                {isFixedPaid ? (
                                    <Text style={styles.paidText}>
                                        <MaterialIcons name="check-circle" size={14} color={SuccessColor} style={{marginRight: 3}}/> Paid {order.paymentReceivedAt ? `(${formatShortDate(order.paymentReceivedAt)})` : ''}
                                    </Text>
                                ) : (
                                    <Text style={[styles.detailValue, isFixedOverdue && styles.overdueText]}>
                                        {isFixedOverdue ? 'Pending (Overdue)' : 'Pending'}
                                    </Text>
                                )}
                            </View>
                        </View>
                    ) : null }

                    {/* Totals Section */}
                    <View style={[styles.orderTotalsSubSection, !(showCodSection || showInstallmentSection || showFixedDurationSection) && styles.componentSubSection_lastChild]}>
                         {/* Subtotal */}
                         <View style={styles.totalRow}>
                             <Text style={styles.totalLabel}>Subtotal:</Text>
                             <Text style={styles.totalValue}>{CURRENCY_SYMBOL}{order.subtotal?.toLocaleString() ?? 'N/A'}</Text>
                         </View>
                         {/* Delivery Fee (Optional) */}
                         {typeof order.deliveryFee === 'number' && order.deliveryFee > 0 ? (
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Delivery Fee:</Text>
                                <Text style={styles.totalValue}>{CURRENCY_SYMBOL}{order.deliveryFee.toLocaleString()}</Text>
                            </View>
                         ) : null }
                         {/* Divider */}
                         <View style={styles.totalDivider} />
                         {/* Grand Total */}
                         <View style={styles.totalRow}>
                             <Text style={styles.grandTotalLabel}>Grand Total:</Text>
                             <Text style={styles.grandTotalValue}>{CURRENCY_SYMBOL}{order.grandTotal?.toLocaleString() ?? 'N/A'}</Text>
                         </View>
                          {/* Remaining Amount (Show only if not fully paid) */}
                          {paymentStatus?.toLowerCase() !== PAID_STATUS.toLowerCase() && remainingAmount > 0 ? (
                            <View style={[styles.totalRow, styles.remainingRow]}>
                                <Text style={styles.remainingLabel}>Total Remaining:</Text>
                                <Text style={[styles.totalValue, styles.remainingAmountHighlight]}>
                                    {CURRENCY_SYMBOL}{remainingAmount.toLocaleString() ?? 'N/A'}
                                </Text>
                            </View>
                          ) : null }
                     </View>

                     {/* Pay Buttons Container (Show only if not fully paid) */}
                     {paymentStatus?.toLowerCase() !== PAID_STATUS.toLowerCase() && remainingAmount > 0 && (
                         <View style={styles.payButtonContainer}>
                             {/* Pay Next Installment Button */}
                             {showInstallmentSection && firstUnpaidInstallment ? (
                                <TouchableOpacity
                                    style={[
                                        styles.payButton, // Red base style
                                        disableButton && styles.payButtonDisabled // Disabled style
                                    ]}
                                    onPress={() => handlePayInstallment(firstUnpaidInstallment)}
                                    disabled={disableButton}
                                >
                                    {isPayingThisInstallment ? (
                                        <ActivityIndicator size="small" color="#FFFFFF"/>
                                    ) : (
                                        <View style={styles.payButtonContent}>
                                            <MaterialIcons name="payment" size={18} color="#FFFFFF" style={styles.payButtonIcon}/>
                                            <Text style={styles.payButtonText}>
                                                {`Pay Installment (${CURRENCY_SYMBOL}${(firstUnpaidInstallment.amount + (firstUnpaidInstallment.penalty || 0))?.toLocaleString()})`}
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                             ) : null }

                             {/* Pay Fixed Duration Button */}
                             {showFixedDurationSection && !isFixedPaid && fixedAmountDue > 0 ? (
                                <TouchableOpacity
                                    style={[
                                        styles.payButton, // Red base style
                                        disableButton && styles.payButtonDisabled, // Disabled style
                                        // Add margin if both buttons are shown
                                        (showInstallmentSection && firstUnpaidInstallment) && styles.secondaryPayButton
                                    ]}
                                    onPress={() => handlePayFixedDuration(fixedAmountDue)}
                                    disabled={disableButton}
                                >
                                    {isPayingThisFixed ? (
                                        <ActivityIndicator size="small" color="#FFFFFF"/>
                                    ) : (
                                        <View style={styles.payButtonContent}>
                                            <MaterialIcons name="event-available" size={18} color="#FFFFFF" style={styles.payButtonIcon}/>
                                            <Text style={styles.payButtonText}>
                                                {`Pay Fixed Amount (${CURRENCY_SYMBOL}${fixedAmountToPay.toLocaleString()})`}
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                             ): null }
                         </View>
                      )}
                </View>

                 {/* Add some spacing at the bottom */}
                 <View style={{ height: 20 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    // Base & Containers
    container: { flex: 1, backgroundColor: ScreenBackgroundColor },
    scrollContainer: { flexGrow: 1, paddingBottom: 30, paddingHorizontal: 10, paddingTop: 10 }, // Added paddingTop
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: ScreenBackgroundColor },
    card: {
        backgroundColor: AppBackgroundColor,
        borderRadius: 10,
        marginBottom: 15,
        padding: 15,
        // Android Shadow
        elevation: 2,
        // iOS Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        // Optional Border for iOS
        borderWidth: Platform.OS === 'ios' ? 1 : 0,
        borderColor: CardBorderColor,
    },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 15, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: SubtleDividerColor },
    componentSubSection: { paddingBottom: 15, marginBottom: 15, borderBottomWidth: 1, borderBottomColor: SubtleDividerColor, },
    componentSubSection_lastChild: { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 }, // Remove bottom border/margin for last item in card
    componentSpacing: { marginTop: 15 }, // Add space between different payment type sections
    componentTitle: { fontSize: 16, fontWeight: '600', color: TextColorPrimary, marginBottom: 15 },
    noScheduleText: { color: TextColorSecondary, fontStyle: 'italic', paddingVertical: 15, textAlign: 'center' },

    // Header
    headerProductInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, }, // Centered image vertically
    headerImage: { width: 65, height: 65, borderRadius: 8, marginRight: 15, backgroundColor: PlaceholderBgColor },
    headerTextContainer: { flex: 1, justifyContent: 'flex-start', },
    headerProductName: { fontSize: 17, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 4, lineHeight: 23 },
    headerOrderId: { fontSize: 13, color: TextColorSecondary, marginBottom: 4 },
    headerOrderDate: { fontSize: 13, color: TextColorSecondary, marginBottom: 12 }, // Increased margin below date
    headerStatusColumn: { flexDirection: 'column', alignItems: 'flex-start', marginTop: 0, }, // Line-by-line container
    headerStatusLineItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, width: '100%', }, // Each line
    headerStatusLabel: { fontSize: 13, color: TextColorSecondary, marginRight: 8, minWidth: 65, textAlign: 'left', },
    statusBadgeValue: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 14, flexShrink: 1, }, // Allow badge to shrink if needed
    statusBadgeTextValue: { color: '#fff', fontSize: 11, fontWeight: 'bold', },
    badgeIcon: { marginRight: 4 },
    // Status Badge Colors
    statusBadgePending: { backgroundColor: PendingColor },
    statusBadgeProcessing: { backgroundColor: ProcessingColor },
    statusBadgePartiallyPaid: { backgroundColor: PartiallyPaidColor }, // Use ProcessingColor for Partially Paid
    statusBadgeShipped: { backgroundColor: ShippedColor },
    statusBadgeActive: { backgroundColor: ActiveColor },
    statusBadgeDelivered: { backgroundColor: DeliveredColor }, // Use DeliveredColor for Completed/Delivered
    statusBadgeCancelled: { backgroundColor: CancelledColor },
    statusBadgePaid: { backgroundColor: PaidColor }, // Use SuccessColor for Paid
    statusBadgeUnknown: { backgroundColor: UnknownColor },
    paymentMethodBadge: { backgroundColor: PlanAmountColor }, // Specific color for payment method

    // Progress Bar
    progressSection: { marginVertical: 15, paddingHorizontal: 0 }, // No horizontal padding needed here
    progressTextContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 5 }, // Padding inside text container
    progressText: { fontSize: 13, color: TextColorSecondary },
    progressCountText: { fontSize: 13, color: TextColorPrimary, fontWeight: '500' },
    progressBarContainer: { height: 14, backgroundColor: ProgressBarBackgroundColor, borderRadius: 7, marginVertical: 10, overflow: 'hidden', },
    progressBarBackground: { flex: 1, }, // Background takes full container width
    progressBarFill: { backgroundColor: ActionButtonRed, height: '100%', borderRadius: 7, }, // Fill color is red

    // Installment List
    installmentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 10,
        alignItems: 'center',
        borderRadius: 6,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: InstallmentRowDefaultBorderColor, // Default subtle border
        backgroundColor: AppBackgroundColor, // Match card background
    },
    nextInstallmentHighlight: {
        borderColor: ActionButtonRed, // Highlight next due with Red border
        borderWidth: 1.5
    },
    installmentRow_lastChild: { marginBottom: 0 }, // No margin for the last item
    installmentLeft: { flex: 1.2, marginRight: 10 }, // Give slightly more space to left side
    installmentRight: { flex: 1, alignItems: 'flex-end' }, // Align right content to the end
    installmentNumber: { fontSize: 14, fontWeight: '600', color: TextColorPrimary, marginBottom: 4 },
    installmentAmount: { fontSize: 14, color: TextColorSecondary, marginBottom: 4 },
    penaltyText: {
        fontSize: 12,
        color: OverdueColor,
        marginTop: 3,
        fontStyle: 'italic',
        display: 'flex', // Use flex for icon alignment
        alignItems: 'center'
    },
    statusBadgeSmall: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, marginBottom: 5 },
    statusTextSmall: { fontSize: 11, fontWeight: 'bold', color: '#fff' },
    installmentDueDate: {
        fontSize: 12,
        color: TextColorSecondary,
        textAlign: 'right',
        display: 'flex', // Use flex for icon alignment
        alignItems: 'center'
    },
    overdueText: { color: OverdueColor, fontWeight: 'bold' }, // Style for overdue dates/text
    paidAtText: {
        fontSize: 11,
        color: SuccessColor,
        fontStyle: 'italic',
        marginTop: 4,
        textAlign: 'right',
        display: 'flex', // Use flex for icon alignment
        alignItems: 'center'
    },
    // Installment Status Badge Colors
    statusPaidInstallment: { backgroundColor: SuccessColor },
    statusPendingInstallment: { backgroundColor: PendingColor },

    // Fixed Duration & Detail Rows
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingVertical: 2, minHeight: 25 },
    detailLabel: { fontSize: 14, color: TextColorSecondary, marginRight: 10 },
    detailValue: { fontSize: 14, fontWeight: '500', color: TextColorPrimary, textAlign: 'right', flexShrink: 1 }, // Allow value text to shrink
    detailValueEmphasized: { fontSize: 15, fontWeight: '600', color: TextColorPrimary, textAlign: 'right' },
    fixedDueDateContainer: { alignItems: 'flex-end' }, // Align due date info to the right
    timeRemainingAnimatedContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
    iconStyle: { marginRight: 4 }, // Style for icons within text (like timer, check)
    absoluteDateText: { fontSize: 11, color: TextColorSecondary, fontStyle: 'italic', textAlign: 'right' },
    paidText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: SuccessColor,
        textAlign: 'right',
        display: 'flex', // Use flex for icon alignment
        alignItems: 'center'
    },
    penaltyLabel: {
        color: OverdueColor,
        display: 'flex', // Use flex for icon alignment
        alignItems: 'center'
    },
    penaltyValue: { color: OverdueColor, fontWeight: 'bold', textAlign: 'right' },
    detailValueDate: { fontSize: 14, fontWeight: '600', textAlign: 'right' }, // For the animated date string

    // Totals
    orderTotalsSubSection: { marginTop: 15, paddingTop: 15, paddingHorizontal: 5, }, // Padding for totals section
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    totalLabel: { fontSize: 14, color: TextColorSecondary },
    totalValue: { fontSize: 14, fontWeight: '500', color: TextColorPrimary },
    remainingRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: SubtleDividerColor }, // Separator for remaining amount
    remainingLabel: { fontSize: 15, fontWeight: 'bold', color: TextColorPrimary },
    remainingAmountHighlight: { fontWeight: 'bold', color: AccentColor, fontSize: 16 }, // Keep Remaining Amount highlighted
    grandTotalLabel: { fontWeight: 'bold', fontSize: 16, color: TextColorPrimary },
    grandTotalValue: { fontWeight: 'bold', fontSize: 16, color: AccentColor }, // Keep Grand Total highlighted
    totalDivider: { height: 1, backgroundColor: SubtleDividerColor, marginVertical: 10 },

    // Pay Buttons
    payButtonContainer: { marginTop: 25, paddingHorizontal: 5, paddingBottom: 10 },
    payButton: { // Base style for BOTH buttons - NOW RED
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        marginBottom: 10,
        minHeight: 50, // Ensure minimum height
        // Shadow/Elevation
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
        backgroundColor: ActionButtonRed, // *** BOTH BUTTONS ARE RED ***
    },
    // payInstallmentButton: { backgroundColor: ActionButtonRed, }, // *** REMOVED - Now part of base style ***
    payButtonContent: { flexDirection: 'row', alignItems: 'center' },
    payButtonIcon: { marginRight: 8 },
    payButtonDisabled: { // Style when button is disabled
        backgroundColor: TextColorSecondary,
        opacity: 0.7,
        elevation: 0 // Remove shadow when disabled
    },
    payButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
    secondaryPayButton: { marginTop: 5, }, // Add small margin if both buttons are present

    // Error & Loading
    loadingText: { marginTop: 10, color: TextColorSecondary },
    errorText: { color: OverdueColor, fontSize: 16, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
    backButton: { backgroundColor: AccentColor, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6, marginTop: 10 },
    backButtonText: { color: '#fff', fontWeight: 'bold' },
    // Non-critical error banner style
    errorBanner: {
        backgroundColor: '#FFF3E0', // Light orange background
        paddingVertical: 8,
        paddingHorizontal: 15,
        marginHorizontal: 0, // Span full width within scrollview padding
        marginBottom: 15,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#FFCC80' // Darker orange border
    },
    errorBannerText: { color: '#E65100', fontSize: 13, textAlign: 'center' }, // Dark orange text
});