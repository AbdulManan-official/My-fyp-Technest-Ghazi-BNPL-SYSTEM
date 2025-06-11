// SchedulesDetailScreen.js - FINAL COMPLETE CODE v33 - Handles 'Pay at Delivery' for First Installment
// Adopts V12 UI patterns (Cards, Detail Rows, Installment Rows, Progress Bar, Colors)
// Retains V27/V32 Functionality (Stripe, Listener, Notifications, 'Active' status check)
// ** NEW: If user chose 'Pay at Delivery' for the 1st installment, it shows a special status instead of 'Overdue'. **

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    StyleSheet, Text, View, SafeAreaView,
    ActivityIndicator, TouchableOpacity, StatusBar, ScrollView,
    Image, Alert, Platform, AppState, Animated
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import {
    getFirestore, collection, query, where, Timestamp,
    onSnapshot, doc, updateDoc, getDocs, writeBatch
} from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig'; // Verify path
import {
    format, isValid, isPast, differenceInDays, isToday, isTomorrow, startOfDay,
    differenceInMilliseconds
} from 'date-fns';
import { useStripe } from '@stripe/stripe-react-native';
import axios from 'axios';

// --- Constants ---
const AppBackgroundColor = '#FFFFFF';
const ScreenBackgroundColor = '#F8F9FA';
const CardBackgroundColor = '#FFFFFF';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const PlaceholderBgColor = '#F0F0F0';
const CardBorderColor = '#EAEAEA';
const SubtleDividerColor = '#F0F0F0';
const InstallmentRowDefaultBorderColor = '#f0f0f0';
const ProgressBarBackgroundColor = '#E9ECEF';
const PendingColor = '#FFA726';
const ProcessingColor = '#42A5F5';
const ShippedColor = '#66BB6A';
const DeliveredColor = '#78909C';
const ActiveColor = '#29B6F6';
const CancelledColor = '#EF5350';
const PaidColor = '#4CAF50';
const UnknownColor = '#BDBDBD';
const OverdueColor = CancelledColor;
const SuccessColor = PaidColor;
const PartiallyPaidColor = ProcessingColor;
const ActionButtonRed = '#FF0000';
const PlanAmountColor = '#0056b3';
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
const placeholderImagePath = require('../../assets/p3.jpg');
const PAYMENT_API_ENDPOINT = "https://back.txyber.com/create-payment-intent";
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const ONE_SECOND = 1000;
const ONE_MINUTE = ONE_SECOND * 60;
const ONE_HOUR = ONE_MINUTE * 60;
const ONE_DAY = ONE_HOUR * 24;

// --- Helper Functions ---

const formatShortDate = (timestamp) => {
    let dateToFormat = null;
    if (timestamp && typeof timestamp.toDate === 'function') {
        try { dateToFormat = timestamp.toDate(); } catch (e) { console.warn("Timestamp toDate conversion error", e); }
    } else if (timestamp instanceof Date) {
        dateToFormat = timestamp;
    }
    if (dateToFormat && isValid(dateToFormat)) {
        try { return format(dateToFormat, 'MMM d, yyyy'); } catch (e) { return 'Invalid Date'; }
    }
    return 'N/A';
};

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

const getInstallmentStatusStyle = (status) => {
    return (status?.toLowerCase() === PAID_STATUS.toLowerCase())
        ? styles.statusPaidInstallment
        : styles.statusPendingInstallment;
};

const formatTimeDifference = (milliseconds) => {
    if (milliseconds <= 0) {
        if (milliseconds > -ONE_MINUTE) { return "Due Now"; }
        return "Overdue";
    }
    const days = Math.floor(milliseconds / ONE_DAY);
    const hours = Math.floor((milliseconds % ONE_DAY) / ONE_HOUR);
    const minutes = Math.floor((milliseconds % ONE_HOUR) / ONE_MINUTE);
    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (parts.length === 0) {
        const seconds = Math.floor((milliseconds % ONE_MINUTE) / ONE_SECOND);
        if (seconds > 0) return `${seconds}s left`;
        return "Due Now";
    }
    return parts.join(' ') + " left";
};

const calculateInstallmentProgress = (installments = []) => {
    if (!Array.isArray(installments) || installments.length === 0) { return { paidCount: 0, totalCount: 0, progressPercent: 0, nextDueDate: null, nextAmount: null, totalPaidAmount: 0 }; }
    const totalCount = installments.length;
    let paidCount = 0, totalPaidAmount = 0, nextDueDate = null, nextAmount = null, foundNext = false;
    installments.forEach(inst => {
        if (inst.status?.toLowerCase() === PAID_STATUS.toLowerCase()) { paidCount++; if (typeof inst.amount === 'number') totalPaidAmount += inst.amount; }
        else if (!foundNext) { nextDueDate = inst.dueDate; nextAmount = inst.amount; foundNext = true; }
    });
    const progressPercent = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;
    return { paidCount, totalCount, progressPercent, nextDueDate, nextAmount, totalPaidAmount };
};

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

// --- Main Detail Screen Component ---
export default function SchedulesDetailScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const initialOrder = route.params?.order;
    const [order, setOrder] = useState(initialOrder);
    const { initPaymentSheet, presentPaymentSheet, loading: stripeLoadingHook } = useStripe();
    const [payingItemId, setPayingItemId] = useState(null);
    const [localError, setLocalError] = useState(null);
    const [timeLeft, setTimeLeft] = useState('');
    const appState = useRef(AppState.currentState);
    const listenerUnsubscribeRef = useRef(null);
    const timerIntervalRef = useRef(null);
    
    // --- Effects ---
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
     }, [initialOrder?.id]);

    useEffect(() => { if (route.params?.order && route.params.order.id !== order?.id) { setOrder(route.params.order); } }, [route.params?.order, order?.id]);

    useEffect(() => {
        const currentInstallments = order?.installments || [];
        const showInstallmentSectionForTimer = order?.paymentMethod === BNPL_TYPE || (order?.paymentMethod === MIXED_TYPE && Array.isArray(currentInstallments) && currentInstallments.length > 0);
        const firstUnpaid = showInstallmentSectionForTimer
            ? currentInstallments.find(inst => inst.status?.toLowerCase() !== PAID_STATUS.toLowerCase())
            : null;
        if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
        setTimeLeft('');
        if (firstUnpaid) {
            const dueDateTimestamp = firstUnpaid.dueDate;
            let dueDate = null;
            if (dueDateTimestamp && typeof dueDateTimestamp.toDate === 'function') {
                try { dueDate = dueDateTimestamp.toDate(); } catch (e) { console.warn("Timer: Invalid due date conversion"); }
            } else if (dueDateTimestamp instanceof Date && isValid(dueDateTimestamp)) {
                dueDate = dueDateTimestamp;
            }
            if (dueDate && isValid(dueDate)) {
                const updateTimer = () => {
                    const now = new Date();
                    const diff = differenceInMilliseconds(dueDate, now);
                    setTimeLeft(formatTimeDifference(diff));
                    if (diff <= -ONE_MINUTE && timerIntervalRef.current) {
                        clearInterval(timerIntervalRef.current);
                        timerIntervalRef.current = null;
                    }
                };
                updateTimer();
                timerIntervalRef.current = setInterval(updateTimer, ONE_SECOND);
            } else {
                setTimeLeft('Invalid Due Date');
            }
        }
        return () => { if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); } };
    }, [order]);

    // --- Payment Functions ---
    const initializeAndPay = async (currentOrderData, amountToPay, paymentTypeLabel, installmentDetails = null) => {
        const orderId = currentOrderData.id;
        const paymentAttemptId = `${orderId}-${paymentTypeLabel}-${installmentDetails?.installmentNumber ?? 'fixed'}-${Date.now()}`;
        if (!amountToPay || amountToPay <= 0) { Alert.alert("Error", "Invalid payment amount specified."); return; }
        if (payingItemId) { Alert.alert("Payment In Progress", "Another payment is currently being processed. Please wait."); return; }
        if (stripeLoadingHook) { Alert.alert("Initializing Payment", "Stripe is still loading. Please wait a moment."); return; }
        if (!auth.currentUser) { Alert.alert("Authentication Error", "You must be logged in to make a payment."); navigation.navigate('Login'); return; }
        if (paymentTypeLabel === 'Installment' && installmentDetails?.status?.toLowerCase() === PAID_STATUS.toLowerCase()) { Alert.alert("Already Paid", "This installment has already been paid."); return; }
        if (paymentTypeLabel === 'Fixed Duration' && currentOrderData.paymentReceivedAt) { Alert.alert("Already Paid", "The fixed duration payment for this order has already been paid."); return; }
        setPayingItemId(paymentAttemptId);
        setLocalError(null);
        try {
            console.log(`[Payment] Initiating payment for Order ${orderId}, Type: ${paymentTypeLabel}, Amount: ${amountToPay}`);
            const response = await axios.post(PAYMENT_API_ENDPOINT, {
                amount: Math.round(amountToPay * 100), currency: CURRENCY_CODE.toLowerCase(),
                orderId: currentOrderData.id, userId: auth.currentUser.uid,
                paymentDescription: `Payment for Order #${currentOrderData.orderNumber || currentOrderData.id.substring(0,6)} - ${paymentTypeLabel}`,
                customerName: currentOrderData.userName || 'N/A', customerEmail: auth.currentUser.email || undefined,
                metadata: { order_id: currentOrderData.id, user_id: auth.currentUser.uid, payment_type: paymentTypeLabel, installment_number: installmentDetails?.installmentNumber ?? null }
            });
            const { clientSecret, ephemeralKey, customer, error: backendError } = response.data;
            if (backendError || !clientSecret) throw new Error(backendError || "Failed to set up payment on the server.");
            console.log(`[Payment] Initializing Stripe Payment Sheet for Order ${orderId}`);
            const { error: initError } = await initPaymentSheet({
                merchantDisplayName: "Txyber", paymentIntentClientSecret: clientSecret,
                customerId: customer, customerEphemeralKeySecret: ephemeralKey,
                allowsDelayedPaymentMethods: false,
             });
            if (initError) throw new Error(`Failed to initialize payment sheet: ${initError.localizedMessage || initError.message}`);
            console.log(`[Payment] Presenting Stripe Payment Sheet for Order ${orderId}`);
            const { error: paymentError } = await presentPaymentSheet();
            if (paymentError) {
                if (paymentError.code === 'Canceled') { Alert.alert("Payment Canceled", "The payment process was canceled."); }
                else { throw new Error(`Payment failed: ${paymentError.localizedMessage || paymentError.message}`); }
            } else {
                console.log(`[Payment] Payment successful for Order ${orderId}, Type: ${paymentTypeLabel}. Updating Firestore...`);
                Alert.alert("Payment Successful!", "Your payment has been processed successfully.");
                await updateFirestoreAfterPayment(currentOrderData, amountToPay, paymentTypeLabel, installmentDetails);
            }
        } catch (error) {
            console.error(`[Payment Flow Error] Order ${orderId}, Attempt ${paymentAttemptId}:`, error);
            Alert.alert("Payment Error", error.message || "An unexpected error occurred during payment.");
            setLocalError(`Payment failed: ${error.message}`);
        } finally { setPayingItemId(null); }
    };
    const updateFirestoreAfterPayment = async (orderData, paidAmount, paymentType, paidInstallment = null) => {
        const orderRef = doc(db, ORDERS_COLLECTION, orderData.id);
        const batch = writeBatch(db);
        console.log(`[Firestore Update] Starting update for Order ${orderData.id}, Payment Type: ${paymentType}`);
        try {
            const now = Timestamp.now(); let updates = {}; let shouldNotifyAdminOrderComplete = false;
            if (paymentType === 'Installment' && paidInstallment) {
                let updateOccurred = false; let updatedInstallmentDetails = null; let currentInstallments = orderData.installments || [];
                const newInstallments = currentInstallments.map(inst => {
                    if (inst.installmentNumber === paidInstallment.installmentNumber && inst.status?.toLowerCase() !== PAID_STATUS.toLowerCase()) {
                        updateOccurred = true; updatedInstallmentDetails = { ...inst, status: PAID_STATUS, paid: true, paidAt: now };
                        console.log(`[Firestore Update] Marking Inst #${inst.installmentNumber} as Paid for Order ${orderData.id}`); return updatedInstallmentDetails;
                    } return inst;
                });
                if (!updateOccurred) { console.warn(`[Firestore Update] No update needed for Inst #${paidInstallment.installmentNumber} for Order ${orderData.id}.`); return; }
                updates.installments = newInstallments;
                const allInstallmentsPaid = newInstallments.every(i => i.status?.toLowerCase() === PAID_STATUS.toLowerCase());
                const codPaid = !orderData.codAmount || !!orderData.codPaymentReceivedAt;
                const fixedPaid = !(!!orderData.fixedDurationAmountDue || !!orderData.paymentDueDate) || !!orderData.paymentReceivedAt;
                if (allInstallmentsPaid && codPaid && fixedPaid) {
                    console.log(`[Firestore Update] Order ${orderData.id} fully paid after installment payment.`);
                    updates.paymentStatus = PAID_STATUS; updates.paymentReceivedAt = orderData.paymentReceivedAt || now;
                    if (orderData.status?.toLowerCase() !== 'cancelled' && orderData.status?.toLowerCase() !== 'rejected' && orderData.status !== COMPLETED_ORDER_STATUS) {
                        updates.status = COMPLETED_ORDER_STATUS; updates.deliveredAt = orderData.deliveredAt || now;
                        console.log(`[Firestore Update] Setting Order ${orderData.id} status to ${COMPLETED_ORDER_STATUS}.`);
                    } shouldNotifyAdminOrderComplete = true;
                } else { console.log(`[Firestore Update] Order ${orderData.id} is now Partially Paid after installment.`); updates.paymentStatus = PARTIALLY_PAID_STATUS; }
                batch.update(orderRef, updates); console.log(`[Firestore Update] Committing batch update for Order ${orderData.id} (Installment)`); await batch.commit(); console.log(`[Firestore Update] Batch commit successful for Order ${orderData.id}`);
                if (updatedInstallmentDetails) { await sendAdminInstallmentPaidNotification(orderData.id, orderData.userName || 'user', updatedInstallmentDetails.installmentNumber, updatedInstallmentDetails.amount); }
                if (shouldNotifyAdminOrderComplete) { await sendAdminPaymentNotification(orderData.orderNumber || orderData.id, orderData.userName || 'user', paidAmount, orderData.paymentMethod); }
                return;
            } else if (paymentType === 'Fixed Duration') {
                if (orderData.paymentReceivedAt) { console.warn(`[Firestore Update] Fixed duration payment already recorded for Order ${orderData.id}. Skipping update.`); return; }
                console.log(`[Firestore Update] Marking Fixed Duration as Paid for Order ${orderData.id}`); updates.paymentReceivedAt = now;
                const finalCheckInstallments = orderData.installments || []; const allInstallmentsPaid = finalCheckInstallments.every(i => i.status?.toLowerCase() === PAID_STATUS.toLowerCase()); const codPaid = !orderData.codAmount || !!orderData.codPaymentReceivedAt;
                if (allInstallmentsPaid && codPaid) {
                    console.log(`[Firestore Update] Order ${orderData.id} fully paid after Fixed Duration payment.`); updates.paymentStatus = PAID_STATUS;
                    if (orderData.status?.toLowerCase() !== 'cancelled' && orderData.status?.toLowerCase() !== 'rejected' && orderData.status !== COMPLETED_ORDER_STATUS) {
                        updates.status = COMPLETED_ORDER_STATUS; updates.deliveredAt = orderData.deliveredAt || now;
                        console.log(`[Firestore Update] Setting Order ${orderData.id} status to ${COMPLETED_ORDER_STATUS}.`);
                    } shouldNotifyAdminOrderComplete = true;
                } else { console.log(`[Firestore Update] Order ${orderData.id} is now Partially Paid after Fixed Duration payment.`); updates.paymentStatus = PARTIALLY_PAID_STATUS; }
                batch.update(orderRef, updates); console.log(`[Firestore Update] Committing batch update for Order ${orderData.id} (Fixed Duration)`); await batch.commit(); console.log(`[Firestore Update] Batch commit successful for Order ${orderData.id}`);
                await sendAdminFixedPaymentNotification(orderData.id, orderData.userName || 'user', paidAmount);
                if (shouldNotifyAdminOrderComplete) { await sendAdminPaymentNotification(orderData.orderNumber || orderData.id, orderData.userName || 'user', paidAmount, orderData.paymentMethod); }
                return;
            } else { console.warn(`[Firestore Update] Unhandled payment type: ${paymentType} for Order ${orderData.id}. No Firestore update performed.`); return; }
        } catch (error) {
            console.error(`[Firestore Update Error] Failed to update Order ${orderData.id} after payment:`, error);
            Alert.alert( "Database Update Error", "Your payment was successful, but there was an issue updating the order details. Please contact support if the status doesn't update shortly." );
        }
    };
    const handlePayInstallment = useCallback((installment) => {
        if (!order || !installment) { console.error("[handlePayInstallment] Order or Installment data is missing."); Alert.alert("Error", "Cannot proceed with payment. Order details are incomplete."); return; }
        const amountToPay = (installment.amount || 0) + (installment.penalty || 0);
        if (amountToPay <= 0) { Alert.alert("Error", "The calculated installment amount is invalid."); return; }
        console.log(`[Pay Button] Initiating payment for Installment #${installment.installmentNumber}, Amount: ${amountToPay}`);
        initializeAndPay(order, amountToPay, 'Installment', installment);
    }, [order, initializeAndPay]);
    const handlePayFixedDuration = useCallback((amountDue) => {
        if (!order) { console.error("[handlePayFixedDuration] Order data is missing."); Alert.alert("Error", "Cannot proceed with payment. Order details are incomplete."); return; }
        if (typeof amountDue !== 'number' || amountDue <= 0) { Alert.alert("Error", "The specified fixed duration amount is invalid."); return; }
        const amountToPay = amountDue + (order?.penalty || 0);
        if (amountToPay <= 0) { Alert.alert("Error", "The calculated fixed duration amount is invalid."); return; }
        console.log(`[Pay Button] Initiating payment for Fixed Duration, Amount: ${amountToPay}`);
        initializeAndPay(order, amountToPay, 'Fixed Duration');
    }, [order, initializeAndPay]);

    // --- Loading/Error State Rendering ---
    if (!order && !localError && initialOrder === undefined) {
        return ( <SafeAreaView style={styles.centeredContainer}><StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} /><ActivityIndicator size="large" color={OverdueColor} /><Text style={styles.loadingText}>Loading order details...</Text></SafeAreaView> ); }
    if (!order && localError) {
        return ( <SafeAreaView style={styles.centeredContainer}><StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} /><MaterialIcons name="error-outline" size={60} color={OverdueColor} /><Text style={styles.errorText}>{localError}</Text>{navigation.canGoBack() && (<TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, {backgroundColor: OverdueColor}]}><Text style={styles.backButtonText}>Go Back</Text></TouchableOpacity>)}</SafeAreaView> ); }
     if (!order && !localError && initialOrder !== undefined) {
         return ( <SafeAreaView style={styles.centeredContainer}><StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} /><ActivityIndicator size="large" color={OverdueColor} /><Text style={styles.loadingText}>Loading latest order details...</Text></SafeAreaView> ); }
    if (!order) {
        return ( <SafeAreaView style={styles.centeredContainer}><StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} /><MaterialIcons name="search-off" size={60} color={TextColorSecondary} /><Text style={styles.errorText}>Failed to load order details or order not found.</Text>{navigation.canGoBack() && (<TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, {backgroundColor: OverdueColor}]}><Text style={styles.backButtonText}>Go Back</Text></TouchableOpacity>)}</SafeAreaView> ); }

    // --- Derive data for Rendering ---
    const paymentMethod = order.paymentMethod || 'Unknown';
    const displayPaymentMethodText = paymentMethod === BNPL_TYPE ? INSTALLMENT_DISPLAY_TEXT : paymentMethod;
    const displayId = order.orderNumber ? `#${order.orderNumber}` : `#${order.id.substring(0, 6).toUpperCase()}`;
    const firstItem = order.items?.[0];
    const imageSource = firstItem?.image ? { uri: firstItem.image } : placeholderImagePath;
    const orderStatus = order.status || 'Unknown';
    const paymentStatus = order.paymentStatus || 'N/A';
    const isOrderActive = order.status?.toLowerCase() === ACTIVE_ORDER_STATUS.toLowerCase();
    const isInstallmentPlan = paymentMethod === BNPL_TYPE;
    const showInstallmentSection = isInstallmentPlan || (order.paymentMethod === MIXED_TYPE && Array.isArray(order.installments) && order.installments.length > 0);
    const showFixedDurationSection = (order.paymentMethod === FIXED_TYPE) || (order.paymentMethod === MIXED_TYPE && (!!order.paymentDueDate || !!order.fixedDurationAmountDue));
    const showCodSection = (order.paymentMethod === 'COD') || (order.paymentMethod === MIXED_TYPE && typeof order.codAmount === 'number' && order.codAmount > 0);
    const { paidCount, totalCount, progressPercent } = showInstallmentSection ? calculateInstallmentProgress(order.installments) : { paidCount: 0, totalCount: 0, progressPercent: 0 };
    const remainingAmount = calculateRemainingAmount(order);
    const firstUnpaidInstallment = showInstallmentSection && totalCount > paidCount ? (order.installments || []).find(inst => inst.status?.toLowerCase() !== PAID_STATUS.toLowerCase()) : null;
    const fixedDueDate = showFixedDurationSection ? order.paymentDueDate : null;
    const fixedAmountDue = showFixedDurationSection ? (order.fixedDurationAmountDue ?? order.bnplAmount ?? 0) : 0;
    const fixedAmountToPay = fixedAmountDue + (order.penalty || 0);
    const isFixedPaid = showFixedDurationSection && !!order.paymentReceivedAt;
    const timeRemainingString = fixedDueDate ? formatTimeRemaining(fixedDueDate) : "";
    const isFixedOverdue = !isFixedPaid && fixedDueDate && isValid(fixedDueDate?.toDate ? fixedDueDate.toDate() : fixedDueDate) ? isPast(startOfDay(fixedDueDate.toDate())) && !isToday(startOfDay(fixedDueDate.toDate())) : false;
    const isAnyPaymentProcessing = !!payingItemId;
    const isPayingThisInstallment = !!(firstUnpaidInstallment && payingItemId?.startsWith(`${order.id}-Installment-${firstUnpaidInstallment.installmentNumber}`));
    const isPayingThisFixed = !!(!isFixedPaid && payingItemId?.startsWith(`${order.id}-Fixed Duration-fixed`));
    const disableButton = stripeLoadingHook || isAnyPaymentProcessing;

    // --- Main Render Structure ---
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
            <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">

                {localError && order ? ( <View style={styles.errorBanner}><Text style={styles.errorBannerText}>⚠️ {localError}</Text></View> ) : null}

                 <View style={styles.card}>
                    <View style={styles.headerProductInfo}>
                        <Image source={imageSource} style={styles.headerImage} defaultSource={placeholderImagePath} />
                        <View style={styles.headerTextContainer}>
                             <Text style={styles.headerProductName} numberOfLines={2}>{firstItem?.name || 'Order Item(s)'}</Text>
                             <Text style={styles.headerOrderId}>Order ID: {displayId}</Text>
                             <Text style={styles.headerOrderDate}>Ordered on: {formatShortDate(order.createdAt)}</Text>
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

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Payment Breakdown</Text>

                    {showCodSection ? (
                        <View style={styles.componentSubSection}>
                            <Text style={styles.componentTitle}>Cash on Delivery</Text>
                            <View style={styles.detailRow}><Text style={styles.detailLabel}>Amount:</Text><Text style={styles.detailValue}>{CURRENCY_SYMBOL}{(order.codAmount || 0).toLocaleString()}</Text></View>
                            <View style={styles.detailRow}><Text style={styles.detailLabel}>Status:</Text><Text style={styles.detailValue}>{order.codPaymentReceivedAt ? `Paid (${formatShortDate(order.codPaymentReceivedAt)})` : 'Pending'}</Text></View>
                        </View>
                    ) : null }

                    {showInstallmentSection ? (
                        <View style={[styles.componentSubSection, showCodSection && styles.componentSpacing]}>
                            <Text style={styles.componentTitle}>Installment Plan</Text>
                             {totalCount > 0 ? (
                                <View style={styles.progressSection}>
                                    <View style={styles.progressTextContainer}><Text style={styles.progressText}>Progress</Text><Text style={styles.progressCountText}>{paidCount}/{totalCount} Paid</Text></View>
                                    <View style={styles.progressBarContainer}><View style={styles.progressBarBackground}><View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} /></View></View>
                                </View>
                             ) : null }
                             {(order.installments && order.installments.length > 0) ? (
                                 order.installments.map((installment, index, arr) => {
                                     const isLast = index === arr.length - 1;
                                     const isNext = firstUnpaidInstallment?.installmentNumber === installment.installmentNumber;
                                     const isPaid = installment.status?.toLowerCase() === PAID_STATUS.toLowerCase();
                                     const installmentDueDate = installment.dueDate?.toDate ? installment.dueDate.toDate() : installment.dueDate;
                                     const isOverdue = !isPaid && installmentDueDate && isValid(installmentDueDate) && isPast(startOfDay(installmentDueDate)) && !isToday(startOfDay(installmentDueDate));

                                     const isFirstInstallmentPayAtDelivery = 
                                        installment.installmentNumber === 1 &&
                                        order.firstInstallmentPaymentPreference === 'Pay at Delivery' &&
                                        !isPaid;

                                     return (
                                        <View key={`inst-${order.id}-${installment.installmentNumber || index}`} style={[styles.installmentRow, isLast && styles.installmentRow_lastChild, isNext && styles.nextInstallmentHighlight]}>
                                            <View style={styles.installmentLeft}>
                                                <Text style={[styles.installmentNumber, isNext && styles.nextInstallmentText]}>Inst. #{installment.installmentNumber || index + 1}</Text>
                                                <Text style={styles.installmentAmount}>{CURRENCY_SYMBOL} {installment.amount?.toLocaleString() ?? 'N/A'}</Text>
                                                {typeof installment.penalty === 'number' && installment.penalty > 0 ? (<Text style={styles.penaltyText}><MaterialIcons name="warning" size={12} color={OverdueColor} style={{marginRight: 2}}/>Penalty: {CURRENCY_SYMBOL}{installment.penalty.toFixed(0)}</Text>) : null}
                                            </View>
                                            <View style={styles.installmentRight}>
                                                <View style={[styles.statusBadgeSmall, getInstallmentStatusStyle(installment.status)]}><Text style={styles.statusTextSmall}>{installment.status || PENDING_STATUS}</Text></View>
                                                
                                                {isFirstInstallmentPayAtDelivery ? (
                                                    <View style={styles.dateRow}>
                                                        <MaterialCommunityIcons name="truck-delivery-outline" size={12} color={styles.deliveryPaymentText.color} style={styles.dateIcon} />
                                                        <Text style={styles.deliveryPaymentText}>To be Paid at Delivery</Text>
                                                    </View>
                                                ) : (
                                                    <>
                                                        <View style={styles.dateRow}>
                                                           <FontAwesome5 name="calendar-alt" size={11} color={isOverdue && !isPaid ? OverdueColor : TextColorSecondary} style={styles.dateIcon} />
                                                           <Text style={[styles.installmentDueDate, isOverdue && !isPaid && styles.overdueText]}>
                                                                Due: {formatShortDate(installment.dueDate)} {isOverdue && !isPaid ? '(Overdue)' : ''}
                                                            </Text>
                                                        </View>
                                                        {isPaid && installment.paidAt ? (
                                                             <View style={styles.dateRow}>
                                                                 <FontAwesome5 name="check-circle" size={11} color={PaidColor} style={styles.dateIcon} />
                                                                 <Text style={styles.paidDateTextGreen}>Paid: {formatShortDate(installment.paidAt)}</Text>
                                                             </View>
                                                        ) : null}
                                                    </>
                                                )}

                                                {isNext && !isPaid && timeLeft ? (
                                                    <View style={styles.timerContainer}>
                                                         <MaterialIcons name="timer" size={11} color={timeLeft === 'Overdue' || timeLeft === 'Due Now' ? OverdueColor : TextColorSecondary} style={styles.timerIcon} />
                                                         <Text style={[styles.timerText, (timeLeft === 'Overdue' || timeLeft === 'Due Now') && styles.timerTextOverdue]}>{timeLeft}</Text>
                                                    </View>
                                                ) : null}
                                            </View>
                                        </View>
                                     );
                                 })
                             ) : ( <Text style={styles.noScheduleText}>No installment schedule found for this order.</Text> )}
                        </View>
                    ) : null }

                    {showFixedDurationSection ? (
                        <View style={[styles.componentSubSection, (showCodSection || showInstallmentSection) && styles.componentSpacing]}>
                            <Text style={styles.componentTitle}>Fixed Duration Payment</Text>
                            <View style={styles.detailRow}><Text style={styles.detailLabel}>Amount Due:</Text><Text style={styles.detailValueEmphasized}>{CURRENCY_SYMBOL}{fixedAmountDue.toLocaleString()}</Text></View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Due Date:</Text>
                                <View style={styles.fixedDueDateContainer}><AnimatedTimeRemaining timeString={timeRemainingString} isOverdue={isFixedOverdue && !isFixedPaid} /><Text style={[styles.absoluteDateText, isFixedOverdue && !isFixedPaid && styles.overdueText]}>({formatShortDate(fixedDueDate)})</Text></View>
                            </View>
                            {typeof order.penalty === 'number' && order.penalty > 0 && !isFixedPaid ? (<View style={styles.detailRow}><Text style={[styles.detailLabel, styles.penaltyLabel]}><MaterialIcons name="warning" size={14} color={OverdueColor} style={{marginRight: 3}}/> Penalty:</Text><Text style={[styles.detailValue, styles.penaltyValue]}>{CURRENCY_SYMBOL}{order.penalty.toFixed(0)}</Text></View>) : null }
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Status:</Text>
                                {isFixedPaid ? (<View style={styles.paidStatusContainer}><FontAwesome5 name="check-circle" size={13} color={PaidColor} style={styles.dateIcon} /><Text style={styles.paidText}> Paid {order.paymentReceivedAt ? `(${formatShortDate(order.paymentReceivedAt)})` : ''}</Text></View>) : (<Text style={[styles.detailValue, isFixedOverdue && styles.overdueText]}>{isFixedOverdue ? 'Pending (Overdue)' : 'Pending'}</Text>)}
                            </View>
                        </View>
                    ) : null }

                    <View style={[styles.orderTotalsSubSection, !(showCodSection || showInstallmentSection || showFixedDurationSection) && styles.componentSubSection_lastChild]}>
                         <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal:</Text><Text style={styles.totalValue}>{CURRENCY_SYMBOL}{order.subtotal?.toLocaleString() ?? 'N/A'}</Text></View>
                         {typeof order.deliveryFee === 'number' && order.deliveryFee > 0 ? (<View style={styles.totalRow}><Text style={styles.totalLabel}>Delivery Fee:</Text><Text style={styles.totalValue}>{CURRENCY_SYMBOL}{order.deliveryFee.toLocaleString()}</Text></View>) : null }
                         <View style={styles.totalDivider} />
                         <View style={styles.totalRow}><Text style={styles.grandTotalLabel}>Grand Total:</Text><Text style={styles.grandTotalValue}>{CURRENCY_SYMBOL}{order.grandTotal?.toLocaleString() ?? 'N/A'}</Text></View>
                          {paymentStatus?.toLowerCase() !== PAID_STATUS.toLowerCase() && remainingAmount > 0 ? (<View style={[styles.totalRow, styles.remainingRow]}><Text style={styles.remainingLabel}>Total Remaining:</Text><Text style={styles.remainingAmountHighlight}>{CURRENCY_SYMBOL}{remainingAmount.toLocaleString() ?? 'N/A'}</Text></View>) : null }
                     </View>

                     {paymentStatus?.toLowerCase() !== PAID_STATUS.toLowerCase() && remainingAmount > 0 && isOrderActive && (
                         <View style={styles.payButtonContainer}>
                             {showInstallmentSection && firstUnpaidInstallment ? (
                                <TouchableOpacity
                                    style={[ styles.payButton, disableButton && styles.payButtonDisabled ]}
                                    onPress={() => handlePayInstallment(firstUnpaidInstallment)}
                                    disabled={disableButton}>
                                    {isPayingThisInstallment ? ( <ActivityIndicator size="small" color="#FFFFFF"/> ) : (
                                        <View style={styles.payButtonContent}><MaterialIcons name="payment" size={18} color="#FFFFFF" style={styles.payButtonIcon}/><Text style={styles.payButtonText}>{`Pay Installment (${CURRENCY_SYMBOL}${(firstUnpaidInstallment.amount + (firstUnpaidInstallment.penalty || 0))?.toLocaleString()})`}</Text></View>
                                    )}
                                </TouchableOpacity>
                             ) : null }
                             {showFixedDurationSection && !isFixedPaid && fixedAmountDue > 0 ? (
                                <TouchableOpacity
                                    style={[ styles.payButton, disableButton && styles.payButtonDisabled, (showInstallmentSection && firstUnpaidInstallment) && styles.secondaryPayButton ]}
                                    onPress={() => handlePayFixedDuration(fixedAmountDue)}
                                    disabled={disableButton}>
                                    {isPayingThisFixed ? ( <ActivityIndicator size="small" color="#FFFFFF"/> ) : (
                                        <View style={styles.payButtonContent}><MaterialIcons name="event-available" size={18} color="#FFFFFF" style={styles.payButtonIcon}/><Text style={styles.payButtonText}>{`Pay Fixed Amount (${CURRENCY_SYMBOL}${fixedAmountToPay.toLocaleString()})`}</Text></View>
                                    )}
                                </TouchableOpacity>
                             ): null }
                         </View>
                      )}
                </View>

                 <View style={{ height: 20 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: ScreenBackgroundColor },
    scrollContainer: { flexGrow: 1, paddingBottom: 30, paddingHorizontal: 10, paddingTop: 10 },
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: ScreenBackgroundColor },
    card: { backgroundColor: CardBackgroundColor, borderRadius: 10, marginBottom: 15, padding: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, borderWidth: Platform.OS === 'ios' ? 1 : 0, borderColor: CardBorderColor },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 15, borderBottomWidth: 1, borderBottomColor: SubtleDividerColor, paddingBottom: 10 },
    componentSubSection: { paddingBottom: 15, marginBottom: 15, borderBottomWidth: 1, borderBottomColor: SubtleDividerColor },
    componentSubSection_lastChild: { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 },
    componentSpacing: { marginTop: 15 },
    componentTitle: { fontSize: 16, fontWeight: '600', color: TextColorPrimary, marginBottom: 15 },
    noScheduleText: { color: TextColorSecondary, fontStyle: 'italic', paddingVertical: 15, textAlign: 'center' },
    headerProductInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    headerImage: { width: 65, height: 65, borderRadius: 8, marginRight: 15, backgroundColor: PlaceholderBgColor },
    headerTextContainer: { flex: 1, justifyContent: 'flex-start' },
    headerProductName: { fontSize: 17, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 4, lineHeight: 23 },
    headerOrderId: { fontSize: 13, color: TextColorSecondary, marginBottom: 4 },
    headerOrderDate: { fontSize: 13, color: TextColorSecondary, marginBottom: 12 },
    headerStatusColumn: { flexDirection: 'column', alignItems: 'flex-start', marginTop: 0 },
    headerStatusLineItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, width: '100%' },
    headerStatusLabel: { fontSize: 13, color: TextColorSecondary, marginRight: 8, minWidth: 65, textAlign: 'left' },
    statusBadgeValue: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 14, flexShrink: 1 },
    statusBadgeTextValue: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
    badgeIcon: { marginRight: 4 },
    statusBadgePending: { backgroundColor: PendingColor }, statusBadgeProcessing: { backgroundColor: ProcessingColor },
    statusBadgePartiallyPaid: { backgroundColor: PartiallyPaidColor }, statusBadgeShipped: { backgroundColor: ShippedColor },
    statusBadgeActive: { backgroundColor: ActiveColor }, statusBadgeDelivered: { backgroundColor: DeliveredColor },
    statusBadgeCancelled: { backgroundColor: CancelledColor }, statusBadgePaid: { backgroundColor: PaidColor },
    statusBadgeUnknown: { backgroundColor: UnknownColor }, paymentMethodBadge: { backgroundColor: PlanAmountColor },
    progressSection: { marginVertical: 15, paddingHorizontal: 0 },
    progressTextContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 5 },
    progressText: { fontSize: 13, color: TextColorSecondary },
    progressCountText: { fontSize: 13, color: TextColorPrimary, fontWeight: '500' },
    progressBarContainer: { height: 14, backgroundColor: ProgressBarBackgroundColor, borderRadius: 7, marginVertical: 10, overflow: 'hidden' },
    progressBarBackground: { flex: 1 },
    progressBarFill: { backgroundColor: ActionButtonRed, height: '100%', borderRadius: 7 },
    installmentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', borderRadius: 6, marginBottom: 8, borderWidth: 1, borderColor: InstallmentRowDefaultBorderColor, backgroundColor: CardBackgroundColor },
    nextInstallmentHighlight: { borderColor: ActionButtonRed, borderWidth: 1.5 },
    installmentRow_lastChild: { marginBottom: 0 },
    installmentLeft: { flex: 1.2, marginRight: 10 },
    installmentRight: { flex: 1, alignItems: 'flex-end', minWidth: 100 },
    installmentNumber: { fontSize: 14, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 4 },
    nextInstallmentText: { color: ActionButtonRed },
    installmentAmount: { fontSize: 14, color: TextColorSecondary, marginBottom: 4 },
    dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    dateIcon: { marginRight: 4, width: 12, textAlign: 'center' },
    installmentDueDate: { fontSize: 12, color: TextColorSecondary },
    paidDateTextGreen: { color: PaidColor, fontWeight: '500', fontSize: 11, fontStyle: 'italic' },
    penaltyText: { fontSize: 12, color: OverdueColor, marginTop: 3, fontWeight: '500', fontStyle: 'italic', display: 'flex', alignItems: 'center' },
    statusBadgeSmall: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, marginBottom: 5 },
    statusTextSmall: { fontSize: 11, fontWeight: 'bold', color: '#fff' },
    statusPaidInstallment: { backgroundColor: PaidColor }, statusPendingInstallment: { backgroundColor: PendingColor },
    timerContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    timerIcon: { marginRight: 4, color: ActionButtonRed },
    timerText: { fontSize: 11, color: ActionButtonRed, fontWeight: 'bold', fontStyle: 'italic' },
    timerTextOverdue: { color: OverdueColor },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: SubtleDividerColor, minHeight: 35, marginBottom: 5 },
    detailLabel: { fontSize: 14, color: TextColorSecondary, marginRight: 10 },
    detailValue: { fontSize: 14, fontWeight: '500', color: TextColorPrimary, textAlign: 'right', flexShrink: 1, flex: 1, marginLeft: 10 },
    detailValueEmphasized: { fontSize: 15, fontWeight: '600', color: TextColorPrimary, textAlign: 'right' },
    fixedDueDateContainer: { alignItems: 'flex-end' },
    timeRemainingAnimatedContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
    iconStyle: { marginRight: 4 },
    absoluteDateText: { fontSize: 11, color: TextColorSecondary, fontStyle: 'italic', textAlign: 'right' },
    overdueText: { color: OverdueColor, fontWeight: 'bold' },
    paidStatusContainer: { flexDirection: 'row', alignItems: 'center' },
    paidText: { fontSize: 14, fontWeight: 'bold', color: PaidColor, textAlign: 'right' },
    penaltyLabel: { color: OverdueColor, fontWeight: 'bold', display: 'flex', alignItems: 'center' },
    penaltyValue: { color: OverdueColor, fontWeight: 'bold', textAlign: 'right', flex: 1 },
    detailValueDate: { fontSize: 14, fontWeight: '600', textAlign: 'right' },
    orderTotalsSubSection: { marginTop: 15, paddingTop: 15, paddingHorizontal: 5 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, marginBottom: 6 },
    totalLabel: { fontSize: 14, color: TextColorSecondary },
    totalValue: { fontSize: 14, fontWeight: '500', color: TextColorPrimary },
    remainingRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: SubtleDividerColor },
    remainingLabel: { fontSize: 15, fontWeight: 'bold', color: TextColorPrimary },
    remainingAmountHighlight: { fontWeight: 'bold', color: OverdueColor, fontSize: 16 },
    grandTotalLabel: { fontWeight: 'bold', fontSize: 16, color: TextColorPrimary },
    grandTotalValue: { fontWeight: 'bold', fontSize: 16, color: OverdueColor },
    totalDivider: { height: 1, backgroundColor: SubtleDividerColor, marginVertical: 10 },
    payButtonContainer: { marginTop: 25, paddingHorizontal: 5, paddingBottom: 10 },
    payButton: { backgroundColor: ActionButtonRed, paddingVertical: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginBottom: 10, minHeight: 50, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2 },
    payButtonContent: { flexDirection: 'row', alignItems: 'center' },
    payButtonIcon: { marginRight: 8 },
    payButtonDisabled: { backgroundColor: '#A5A5A5', opacity: 0.7, elevation: 0 },
    payButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
    secondaryPayButton: { marginTop: 5 },
    loadingText: { marginTop: 10, color: TextColorSecondary },
    errorText: { color: OverdueColor, fontSize: 16, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
    backButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6, marginTop: 10 },
    backButtonText: { color: '#fff', fontWeight: 'bold' },
    errorBanner: { backgroundColor: '#FFF3E0', paddingVertical: 8, paddingHorizontal: 15, marginHorizontal: 0, marginBottom: 15, borderRadius: 6, borderWidth: 1, borderColor: '#FFCC80' },
    errorBannerText: { color: '#E65100', fontSize: 13, textAlign: 'center' },
    deliveryPaymentText: {
        fontSize: 12,
        color: PlanAmountColor,
        fontWeight: '600',
        fontStyle: 'italic',
    },
});