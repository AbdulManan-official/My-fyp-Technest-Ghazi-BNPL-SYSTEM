// AdminDetailOrderScreen.js (FIXED FieldValue.increment error - Corrected Sales Count to use item.id)

import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet, Text, View, ScrollView, Image, TouchableOpacity,
    SafeAreaView, Platform, ActivityIndicator, FlatList, Alert, StatusBar,
    KeyboardAvoidingView
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons as IconMUI } from '@expo/vector-icons';
import { TextInput as PaperInput } from 'react-native-paper';
import {
    getFirestore, doc, updateDoc, onSnapshot, Timestamp,
    serverTimestamp, getDoc, collection, writeBatch,
    increment // <<< CORRECTED IMPORT: Import increment directly
} from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Verify path
import axios from 'axios';
import { format, isValid } from 'date-fns';

// --- Constants ---
const AppBackgroundColor = '#FFFFFF';
const ScreenBackgroundColor = '#F8F9FA';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const AccentColor = '#FF0000';
const SuccessColor = '#4CAF50';
const LightBorderColor = '#BDBDBD';
const FocusedBorderColor = AccentColor;
const PlaceholderBgColor = '#F0F0F0';
const CURRENCY_SYMBOL = 'PKR';
const placeholderImagePath = require('../../assets/p3.jpg'); // Verify path
const ORDERS_COLLECTION = 'orders';
const USERS_COLLECTION = 'Users';
const PRODUCTS_COLLECTION_NAME = 'Products'; // <<< ENSURE THIS MATCHES YOUR FIRESTORE COLLECTION
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const SHIPPED_STATUS = 'Shipped';
const DELIVERED_STATUS = 'Delivered';
const PAID_STATUS = 'Paid';
const ACTIVE_STATUS = 'Active';
const PENDING_STATUS = 'Pending';
const PARTIALLY_PAID_STATUS = 'Partially Paid';
const OTP_LENGTH = 6;

// --- Helper Function: Generate OTP ---
const generateOtpValue = () => {
    const min = Math.pow(10, OTP_LENGTH - 1);
    const max = Math.pow(10, OTP_LENGTH) - 1;
    const otp = Math.floor(min + Math.random() * (max - min + 1));
    return String(otp);
};

// --- Helper Function: Format Date (Full with Time) ---
const formatDate = (timestamp) => {
    let dateToFormat = null;
    if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); }
    else if (timestamp instanceof Date) { dateToFormat = timestamp; }
    if (dateToFormat && isValid(dateToFormat)) {
        try { return format(dateToFormat, 'MMM d, yyyy, h:mm a'); }
        catch (e) { console.error("Error formatting date:", e); return 'Invalid Date'; }
    }
    return 'N/A';
};

// --- Helper Function: Format Date (Short Date Only) ---
const formatShortDate = (timestamp) => {
    let dateToFormat = null;
    if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); }
    else if (timestamp instanceof Date) { dateToFormat = timestamp; }
    if (dateToFormat && isValid(dateToFormat)) {
        try { return format(dateToFormat, 'MMM d, yyyy'); }
        catch (e) { console.error("Error formatting short date:", e); return 'Invalid Date'; }
    }
    return 'N/A';
};

// --- Helper Function: Get Status Badge Style ---
const getStatusStyle = (status) => {
    const lowerStatus = status?.toLowerCase() || 'unknown';
    switch (lowerStatus) {
        case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': case 'unpaid (bnpl)':
        case 'pending first installment': case 'mixed (cod/bnpl pending)': case 'mixed (cod/fixed pending)':
            return styles.statusPending;
        case 'processing': case PARTIALLY_PAID_STATUS.toLowerCase():
            return styles.statusProcessing;
        case 'shipped': return styles.statusShipped;
        case 'delivered': return styles.statusDelivered;
        case 'active': return styles.statusActive;
        case 'cancelled': case 'rejected': return styles.statusCancelled;
        case PAID_STATUS.toLowerCase(): return styles.statusFullyPaid;
        default: return styles.statusUnknown;
    }
};
const getInstallmentStatusStyle = (status) => {
    return (status?.toLowerCase() === PAID_STATUS.toLowerCase()) ? styles.statusPaid : styles.statusInstallmentPending;
};

// --- Helper Function: Fetch User's Expo Push Token ---
async function getUserExpoToken(userId) {
    if (!userId) { console.error("[getUserExpoToken] userId missing."); return null; }
    try {
        const userDocRef = doc(db, USERS_COLLECTION, userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const token = userDocSnap.data()?.expoPushToken;
            if (token && typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))) {
                 return token;
            } else if (token) { console.log(`[getUserExpoToken] Invalid or missing Expo push token format for user ${userId}. Token:`, token); return null; }
            else { console.log(`[getUserExpoToken] Expo push token field not found for user ${userId}.`); return null; }
        } else { console.log(`[getUserExpoToken] User document not found for ID: ${userId}`); return null; }
    } catch (error) { console.error(`[getUserExpoToken] Error fetching token for user ${userId}:`, error); return null; }
}

// --- Main Component: AdminDetailOrderScreen ---
export default function AdminDetailOrderScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const initialOrder = route.params?.order;
    const orderId = initialOrder?.id;

    const [currentOrderData, setCurrentOrderData] = useState(initialOrder);
    const [loading, setLoading] = useState(!initialOrder);
    const [error, setError] = useState(null);
    const [isProcessingShip, setIsProcessingShip] = useState(false);
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
    const [enteredOtp, setEnteredOtp] = useState('');
    const [otpError, setOtpError] = useState('');

    useEffect(() => {
        if (!orderId) { setError("Order ID not found in navigation parameters."); setLoading(false); setCurrentOrderData(null); return; }
        setError(null); setLoading(true);
        const orderRef = doc(db, ORDERS_COLLECTION, orderId);
        const unsubscribe = onSnapshot(orderRef, (docSnap) => {
            if (docSnap.exists()) {
                const newData = { id: docSnap.id, ...docSnap.data() };
                setCurrentOrderData(newData);
                if (newData.status !== SHIPPED_STATUS) { setEnteredOtp(''); setOtpError(''); }
                setError(null);
            } else {
                console.warn(`Order document with ID ${orderId} does not exist.`); setError("Order data not found. It might have been deleted."); setCurrentOrderData(null);
            }
            setLoading(false);
        }, (err) => {
            setError("Failed to load real-time order details. Check permissions or connection."); setLoading(false); console.error(`Firestore listener error for order ${orderId}:`, err);
        });
        return () => { console.log(`Unsubscribing from listener for order ${orderId}`); unsubscribe(); };
    }, [orderId]);

    const sendShippingNotification = async (userId, orderIdentifier, generatedOtp) => {
        if (!userId || !orderIdentifier || !generatedOtp) { console.error("Missing data for shipping notification.", { userId, orderIdentifier, generatedOtp }); return; }
        const shortOrderId = orderIdentifier.substring(0, 6).toUpperCase();
        const userToken = await getUserExpoToken(userId);
        if (userToken) {
            const message = { to: userToken, sound: 'default', title: '🚚 Your Order Has Shipped!', body: `Order #${shortOrderId} is on its way! Your Delivery OTP is: ${generatedOtp}. Please provide this code to the delivery rider upon arrival.`, data: { orderId: orderId, type: 'shipping_update' }, priority: 'high', channelId: 'order-updates' };
            try { await axios.post(EXPO_PUSH_ENDPOINT, [message], { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Accept-encoding': 'gzip, deflate' }, timeout: 10000 }); console.log(`Shipping notification sent successfully for user ${userId}, order #${shortOrderId}.`);
            } catch (e) { console.error(`Failed to send shipping notification to user ${userId}, order #${shortOrderId}:`, e.response?.data || e.message || e); }
        } else { console.log(`No valid push token found for user ${userId}, order #${shortOrderId}. Skipping shipping notification.`); }
    };

    const sendFirstInstallmentPaidNotification = async (userId, orderIdentifier) => {
        if (!userId || !orderIdentifier) return;
        const shortOrderId = orderIdentifier.substring(0, 6).toUpperCase();
        const userToken = await getUserExpoToken(userId);
        if (userToken) {
            const message = { to: userToken, sound: 'default', title: '✅ First Installment Confirmed!', body: `Payment for the first installment of your order #${shortOrderId} (paid on delivery) has been confirmed. Your order is now active.`, data: { orderId: orderId, type: 'installment_update' }, priority: 'high', channelId: 'order-updates' };
            try { await axios.post(EXPO_PUSH_ENDPOINT, [message], { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Accept-encoding': 'gzip, deflate' }, timeout: 10000 }); console.log(`First installment (on delivery) notification sent for user ${userId}, order #${shortOrderId}.`);
            } catch (e) { console.error(`Failed 1st installment (on delivery) notification to user ${userId}:`, e.response?.data || e.message || e); }
        } else { console.log(`No valid token for user ${userId}. Skipping 1st installment (on delivery) notification.`); }
    };

    const sendMixedCodPaidNotification = async (userId, orderIdentifier, fixedAmount, dueDate) => {
        if (!userId || !orderIdentifier || !dueDate) return;
        const shortOrderId = orderIdentifier.substring(0, 6).toUpperCase();
        const userToken = await getUserExpoToken(userId);
        if (userToken) {
            const formattedDueDate = formatShortDate(dueDate) || 'N/A';
            const formattedAmount = typeof fixedAmount === 'number' ? fixedAmount.toLocaleString(undefined, { maximumFractionDigits: 0 }) : 'N/A';
            const message = { to: userToken, sound: 'default', title: '✅ COD Payment Received!', body: `Cash payment for order #${shortOrderId} confirmed. Reminder: Your Fixed Duration payment of ${CURRENCY_SYMBOL} ${formattedAmount} is due on ${formattedDueDate}.`, data: { orderId: orderId, type: 'payment_update' }, priority: 'high', channelId: 'order-updates' };
            try { await axios.post(EXPO_PUSH_ENDPOINT, [message], { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Accept-encoding': 'gzip, deflate' }, timeout: 10000 }); console.log(`Mixed COD Paid (Fixed Reminder) notification sent for user ${userId}, order #${shortOrderId}.`);
            } catch (e) { console.error(`Failed Mixed COD Paid (Fixed Reminder) notification to user ${userId}:`, e.response?.data || e.message || e); }
        } else { console.log(`No valid token for user ${userId}. Skipping Mixed COD Paid (Fixed Reminder) notification.`); }
    };

    const sendMixedCodBnplNotification = async (userId, orderIdentifier, firstInstJustPaid, nextInstallment) => {
        if (!userId || !orderIdentifier) return;
        const shortOrderId = orderIdentifier.substring(0, 6).toUpperCase();
        const userToken = await getUserExpoToken(userId);
        if (userToken) {
            let bodyMessage = `Cash payment for order #${shortOrderId} confirmed! `;
            if (firstInstJustPaid) { bodyMessage += "Your first installment (paid on delivery) is also confirmed. "; }
            if (nextInstallment && nextInstallment.dueDate && typeof nextInstallment.amount === 'number') {
                const formattedDueDate = formatShortDate(nextInstallment.dueDate) || 'N/A';
                const formattedAmount = nextInstallment.amount.toLocaleString(undefined, { maximumFractionDigits: 0 });
                bodyMessage += `Reminder: Your next installment of ${CURRENCY_SYMBOL} ${formattedAmount} is due on ${formattedDueDate}.`;
            } else if (firstInstJustPaid && !nextInstallment) { bodyMessage += "All installments are now scheduled or paid.";
            } else if (!firstInstJustPaid && !nextInstallment) { bodyMessage += "All payments appear complete.";
            } else if (!firstInstJustPaid && nextInstallment) {
                const formattedDueDate = formatShortDate(nextInstallment.dueDate) || 'N/A';
                const formattedAmount = nextInstallment.amount.toLocaleString(undefined, { maximumFractionDigits: 0 });
                bodyMessage += `Reminder: Your next installment of ${CURRENCY_SYMBOL} ${formattedAmount} is due on ${formattedDueDate}.`;
            } else { bodyMessage += "Your order is proceeding."; }
            const message = { to: userToken, sound: 'default', title: '✅ COD Payment Received!', body: bodyMessage, data: { orderId: orderId, type: 'payment_update' }, priority: 'high', channelId: 'order-updates' };
            try { await axios.post(EXPO_PUSH_ENDPOINT, [message], { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Accept-encoding': 'gzip, deflate' }, timeout: 10000 }); console.log(`Mixed COD+BNPL notification sent for user ${userId}, order #${shortOrderId}.`);
            } catch (e) { console.error(`Failed Mixed COD+BNPL notification to user ${userId}:`, e.response?.data || e.message || e); }
        } else { console.log(`No valid token for user ${userId}. Skipping Mixed COD+BNPL notification.`); }
    };

    const handleShipAndGenerateOtp = async () => {
        if (!currentOrderData?.id || !currentOrderData?.userId || isProcessingShip) return;
        const currentStatus = currentOrderData.status?.toLowerCase() || '';
        const canShip = ['pending', 'processing', 'active', 'unpaid (cod)', 'unpaid (fixed duration)', 'unpaid (bnpl)', 'pending first installment', 'partially paid', 'mixed (cod/bnpl pending)', 'mixed (cod/fixed pending)'].includes(currentStatus);
        const otpExists = !!currentOrderData?.deliveryOtp;
        if (!canShip || otpExists) { Alert.alert("Action Not Allowed", otpExists ? "Delivery OTP already exists for this order." : `Order cannot be shipped in its current status ('${currentOrderData.status}').`); return; }
        Alert.alert("Confirm Shipment", "Are you sure you want to mark this order as shipped and generate a Delivery OTP? This will notify the customer.",
            [{ text: "Cancel", style: "cancel" }, {
                text: "Ship & Notify", style: "destructive", onPress: async () => {
                    setIsProcessingShip(true);
                    const orderRef = doc(db, ORDERS_COLLECTION, currentOrderData.id);
                    const newOtp = generateOtpValue();
                    console.log(`[Shipment] Generated Delivery OTP for order ${currentOrderData.id}: ${newOtp}`);
                    try {
                        await updateDoc(orderRef, { status: SHIPPED_STATUS, shippedAt: serverTimestamp(), deliveryOtp: newOtp });
                        console.log(`[Shipment] Order ${currentOrderData.id} status updated to ${SHIPPED_STATUS} and Delivery OTP saved.`);
                        await sendShippingNotification(currentOrderData.userId, currentOrderData.id, newOtp);
                        Alert.alert("Success", `Order marked as ${SHIPPED_STATUS}. Delivery OTP (${newOtp}) sent to customer.`);
                    } catch (e) { console.error("[Shipment] Error marking order as shipped or saving OTP:", e); Alert.alert("Error", "Could not update the order status or save OTP. Please try again."); }
                    finally { setIsProcessingShip(false); }
                }
            }], { cancelable: true }
        );
    };

    const handleVerifyOtp = async () => {
        const storedOtp = currentOrderData?.deliveryOtp;
        const trimmedEnteredOtp = enteredOtp.trim();
        setOtpError('');
        if (!trimmedEnteredOtp) { setOtpError("Please enter the OTP."); return; }
        if (trimmedEnteredOtp.length !== OTP_LENGTH) { setOtpError(`OTP must be ${OTP_LENGTH} digits.`); return; }
        if (!storedOtp) { Alert.alert("Error", "No Delivery OTP found stored for this order. Cannot verify."); return; }
        if (isVerifyingOtp) return;
        setIsVerifyingOtp(true);

        if (trimmedEnteredOtp === storedOtp) {
            console.log(`[OTP Verify] Delivery OTP Verified for order ${orderId}. Determining update logic...`);
            const orderRef = doc(db, ORDERS_COLLECTION, currentOrderData.id);
            const paymentMethod = currentOrderData?.paymentMethod;
            const isFixedDurationOrder = paymentMethod === 'Fixed Duration';
            const isBnplOrder = paymentMethod === 'BNPL';
            const isMixedOrder = paymentMethod === 'Mixed';
            const hasFixedDurationComponent = !!currentOrderData?.fixedDurationDetails || (isFixedDurationOrder && (currentOrderData?.bnplAmount > 0 || currentOrderData?.fixedAmount > 0));
            const hasCodComponent = typeof currentOrderData?.codAmount === 'number' && currentOrderData.codAmount > 0;
            const hasInstallmentComponent = Array.isArray(currentOrderData?.installments) && currentOrderData.installments.length > 0;
            const firstInstallment = currentOrderData?.installments?.[0];
            const isFirstInstallmentUnpaid = hasInstallmentComponent && firstInstallment && firstInstallment.status?.toLowerCase() !== PAID_STATUS.toLowerCase();
            const totalInstallments = currentOrderData?.installments?.length || 0;

            let updateData = {}; let successMessage = ""; let notificationToSend = null;

            try {
                // --- Determine order updateData based on payment method and conditions ---
                if (isMixedOrder && hasCodComponent && hasInstallmentComponent) {
                    console.log("[OTP Verify] Handling Mixed (COD + BNPL) order completion."); let firstInstallmentPaidInThisUpdate = false; let updatedInstallmentsArray = [...(currentOrderData.installments || [])];
                    if (isFirstInstallmentUnpaid && currentOrderData.firstInstallmentPaymentPreference === 'Pay at Delivery') {
                        console.log("[OTP Verify] ...Marking first BNPL installment as paid (on delivery)."); const clientPaidAtTimestamp = Timestamp.now();
                        updatedInstallmentsArray = updatedInstallmentsArray.map((inst, index) => { if (index === 0) { firstInstallmentPaidInThisUpdate = true; return { ...inst, status: PAID_STATUS, paid: true, paidAt: clientPaidAtTimestamp }; } return inst; });
                        updateData.installments = updatedInstallmentsArray;
                    } else if (isFirstInstallmentUnpaid) { console.log("[OTP Verify] ...First BNPL installment is unpaid, but preference wasn't 'Pay at Delivery'. Not marking paid now.");
                    } else { console.log("[OTP Verify] ...First BNPL installment was already paid."); }
                    updateData.status = ACTIVE_STATUS; updateData.deliveredAt = serverTimestamp(); updateData.paymentStatus = PARTIALLY_PAID_STATUS; updateData.codPaymentReceivedAt = serverTimestamp();
                    successMessage = "OTP Verified! Delivery confirmed. COD portion paid."; if (firstInstallmentPaidInThisUpdate) { successMessage += " First installment marked as paid."; }
                    const nextUnpaidInstallment = updatedInstallmentsArray.find((inst) => inst.status?.toLowerCase() !== PAID_STATUS.toLowerCase());
                    notificationToSend = () => sendMixedCodBnplNotification(currentOrderData.userId, currentOrderData.id, firstInstallmentPaidInThisUpdate, nextUnpaidInstallment);

                } else if (isMixedOrder && hasCodComponent && hasFixedDurationComponent) {
                    console.log("[OTP Verify] Handling Mixed (COD + Fixed Duration) order completion."); updateData = { status: ACTIVE_STATUS, deliveredAt: serverTimestamp(), paymentStatus: PARTIALLY_PAID_STATUS, codPaymentReceivedAt: serverTimestamp() };
                    successMessage = "OTP Verified! Delivery confirmed. COD portion paid. Fixed Duration payment remains pending.";
                    const fixedAmount = currentOrderData.fixedDurationAmountDue ?? 0; const dueDate = currentOrderData.fixedDurationDetails?.dueDate ?? currentOrderData.paymentDueDate;
                    if (dueDate && fixedAmount > 0) { notificationToSend = () => sendMixedCodPaidNotification(currentOrderData.userId, currentOrderData.id, fixedAmount, dueDate);
                    } else { console.warn("[OTP Verify] Missing due date or amount for Fixed Duration reminder in Mixed order."); }

                } else if (isFixedDurationOrder) {
                    console.log("[OTP Verify] Handling Fixed Duration order completion (Set to Active)."); updateData = { status: ACTIVE_STATUS, deliveredAt: serverTimestamp() };
                    successMessage = `OTP Verified! Delivery confirmed. Order status set to ${ACTIVE_STATUS}. Payment remains pending.`;

                } else if (isBnplOrder && isFirstInstallmentUnpaid && currentOrderData.firstInstallmentPaymentPreference === 'Pay at Delivery') {
                    console.log("[OTP Verify] Handling BNPL order - First installment unpaid (Pay at Delivery). Marking paid and setting Active."); const clientPaidAtTimestamp = Timestamp.now();
                    const updatedInstallments = (currentOrderData.installments || []).map((inst, index) => { if (index === 0) { return { ...inst, status: PAID_STATUS, paid: true, paidAt: clientPaidAtTimestamp }; } return inst; });
                    updateData = { installments: updatedInstallments, status: ACTIVE_STATUS, deliveredAt: serverTimestamp(), paymentStatus: totalInstallments > 1 ? PARTIALLY_PAID_STATUS : PAID_STATUS };
                    successMessage = "OTP Verified! First installment marked as paid. Order is now Active."; notificationToSend = () => sendFirstInstallmentPaidNotification(currentOrderData.userId, currentOrderData.id);

                } else if (isBnplOrder && !isFirstInstallmentUnpaid && totalInstallments > 1) {
                    console.log("[OTP Verify] Handling BNPL order - First installment already paid online, more exist. Setting Active."); updateData = { status: ACTIVE_STATUS, deliveredAt: serverTimestamp() };
                    successMessage = "OTP Verified! Delivery confirmed. Order remains Active (pending further installments).";

                } else {
                    console.log("[OTP Verify] Handling standard order completion (COD, Prepaid, Single/Paid BNPL, etc) - Set to Delivered/Paid.");
                    updateData = { status: DELIVERED_STATUS, deliveredAt: serverTimestamp(), paymentStatus: PAID_STATUS, paymentReceivedAt: serverTimestamp(), ...(hasCodComponent && !currentOrderData.codPaymentReceivedAt && { codPaymentReceivedAt: serverTimestamp() }), ...(isBnplOrder && isFirstInstallmentUnpaid && currentOrderData.firstInstallmentPaymentPreference !== 'Pay at Delivery' && { paymentStatus: currentOrderData.paymentStatus, paymentReceivedAt: null }) };
                    if (isBnplOrder && isFirstInstallmentUnpaid && currentOrderData.firstInstallmentPaymentPreference !== 'Pay at Delivery') { successMessage = "OTP Verified! Order marked as Delivered. First installment payment is still pending.";
                    } else { successMessage = "OTP Verified! Order marked as Delivered and Paid."; }
                }

                // --- SALES COUNT LOGIC ---
                console.log(`[SalesCount] Checking eligibility for order ${orderId}. Current salesCountProcessed: ${currentOrderData.salesCountProcessed}`);
                const newOrderStatusForSalesCount = updateData.status || currentOrderData.status;
                const shouldProcessSalesCount =
                    !currentOrderData.salesCountProcessed &&
                    (newOrderStatusForSalesCount === DELIVERED_STATUS || newOrderStatusForSalesCount === ACTIVE_STATUS);

                if (shouldProcessSalesCount) {
                    console.log(`[SalesCount] Order ${orderId} is ELIGIBLE for sales count processing. New status: ${newOrderStatusForSalesCount}. Will set salesCountProcessed = true on order.`);
                    updateData.salesCountProcessed = true;
                } else {
                    if (currentOrderData.salesCountProcessed) console.log(`[SalesCount] Order ${orderId} ALREADY processed for sales count.`);
                    else console.log(`[SalesCount] Order ${orderId} NOT eligible for sales count processing. New status: ${newOrderStatusForSalesCount}. salesCountProcessed flag is: ${currentOrderData.salesCountProcessed}`);
                }
                // --- END SALES COUNT LOGIC DETERMINATION ---

                console.log(`[OTP Verify] Order ${orderId}: Preparing to update order document with:`, updateData);
                await updateDoc(orderRef, updateData);
                console.log(`[OTP Verify] Order ${orderId} updated successfully with order-specific data (including salesCountProcessed if applicable).`);

                // --- PRODUCT SALES COUNT UPDATE (if flagged previously) ---
                if (shouldProcessSalesCount && currentOrderData.items && currentOrderData.items.length > 0) {
                    console.log(`[SalesCount] Order ${orderId}: Starting product sales count batch update.`);
                    const productSalesBatch = writeBatch(db);
                    const productUpdatesLog = [];

                    for (const item of currentOrderData.items) {
                        console.log(`[SalesCount] Evaluating item: ID (as productID)=${item.id}, Quantity=${item.quantity}`);
                        if (item.id && typeof item.quantity === 'number' && item.quantity > 0) {
                            const productRef = doc(db, PRODUCTS_COLLECTION_NAME, item.id);
                            productSalesBatch.update(productRef, {
                                salesCount: increment(item.quantity) // <<< CORRECTED USAGE of increment
                            });
                            productUpdatesLog.push(`  - Product ${item.id}: salesCount incremented by ${item.quantity}.`);
                        } else {
                            console.warn(`[SalesCount] Order ${orderId}: SKIPPING sales count for item due to missing id (as productID) or invalid quantity:`, JSON.stringify(item));
                        }
                    }

                    if (productUpdatesLog.length > 0) {
                        try {
                            await productSalesBatch.commit();
                            console.log(`[SalesCount] Order ${orderId}: Product sales counts batch committed successfully.`);
                            productUpdatesLog.forEach(log => console.log(log));
                        } catch (productBatchError) {
                            console.error(`[SalesCount] Order ${orderId}: FATAL ERROR updating product sales counts batch:`, productBatchError);
                            Alert.alert("Partial Success - Critical Error", "Order status updated, but FAILED to update product sales counts. Please check logs and manually verify product counts for this order.");
                        }
                    } else {
                        console.log(`[SalesCount] Order ${orderId}: No valid products found in items array to update sales count for (all items lacked 'id' (as productID) or had quantity <= 0).`);
                    }
                } else if (currentOrderData.salesCountProcessed) {
                    console.log(`[SalesCount] Order ${orderId}: Sales count was already processed for this order (checked again after order update).`);
                } else if (shouldProcessSalesCount && (!currentOrderData.items || currentOrderData.items.length === 0)) {
                    console.log(`[SalesCount] Order ${orderId}: Eligible for sales count processing, but order has no items to count.`);
                }
                // --- END PRODUCT SALES COUNT UPDATE ---

                Alert.alert("Success", successMessage); setEnteredOtp('');
                if (notificationToSend) { console.log(`[OTP Verify] Order ${orderId}: Triggering notification...`); await notificationToSend(); }
                else { console.log(`[OTP Verify] Order ${orderId}: No specific notification needed for this OTP verification case.`); }

            } catch (e) {
                console.error("[OTP Verify] Error updating order status after OTP verification:", e);
                Alert.alert("Error", "Could not update order status after verification. Please check logs.");
                setOtpError("Verification succeeded but failed to update status. Please retry or contact support.");
            }
        } else {
            console.warn(`[OTP Verify] Incorrect Delivery OTP entered for order ${orderId}. Entered: ${trimmedEnteredOtp}, Expected: ${storedOtp}`);
            setOtpError("Incorrect OTP entered. Please double-check and try again.");
        }
        setIsVerifyingOtp(false);
    };

    const renderOrderItem = ({ item, index }) => {
        if (!item || typeof item.price !== 'number' || typeof item.quantity !== 'number') { return null; }
        const itemsArray = currentOrderData?.items || [];
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        const itemPaymentMethod = item.paymentMethod || 'COD';
        let paymentDisplay = itemPaymentMethod;
        if (item.bnplPlan?.name) { paymentDisplay = item.bnplPlan.name; }
        else if (itemPaymentMethod === 'BNPL') { paymentDisplay = 'BNPL Plan'; }
        else if (itemPaymentMethod === 'Fixed Duration') { paymentDisplay = 'Fixed Duration'; }
        return (
            <View style={[styles.itemContainer, index === itemsArray.length - 1 && styles.lastItemContainer]}>
                <Image source={item.image ? { uri: item.image } : placeholderImagePath} style={styles.itemImage} defaultSource={placeholderImagePath} onError={(e) => console.warn(`Image load failed for item ${item.id || 'unknown'}: ${item.image}`, e.nativeEvent.error)} />
                <View style={styles.itemDetails}>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name || 'Unnamed Product'}</Text>
                    <Text style={styles.itemQtyPrice}>Qty: {item.quantity || 1}</Text>
                    <Text style={styles.itemPrice}>{CURRENCY_SYMBOL} {(item.price || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} each</Text>
                    <Text style={styles.itemPaymentMethod}>Method: {paymentDisplay}</Text>
                </View>
                <Text style={styles.itemTotalValue}>{CURRENCY_SYMBOL} {itemTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
            </View>
        );
    };

    const renderInstallment = ({ item }) => {
        if (!item || typeof item.amount !== 'number' || !item.installmentNumber) { return null; }
        const installmentStatus = item.status || PENDING_STATUS;
        const dueDateFormatted = formatShortDate(item.dueDate); const paidDateFormatted = formatDate(item.paidAt);
        return (
            <View style={styles.installmentRow}>
                <View style={styles.installmentColumn}><Text style={styles.installmentNumber}>Inst. #{item.installmentNumber}</Text><Text style={styles.installmentAmount}>{CURRENCY_SYMBOL} {item.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 'N/A'}</Text></View>
                <View style={styles.installmentColumn}><Text style={styles.installmentDueDate}>Due: {dueDateFormatted}</Text>{item.paidAt && paidDateFormatted !== 'N/A' && (<Text style={styles.paidAtText}>Paid: {paidDateFormatted}</Text>)}</View>
                <View style={styles.installmentColumnStatus}><View style={[styles.statusBadgeSmall, getInstallmentStatusStyle(installmentStatus)]}><Text style={styles.statusTextSmall}>{installmentStatus}</Text></View>{typeof item.penalty === 'number' && item.penalty > 0 && (<Text style={styles.penaltyText}>Penalty: {CURRENCY_SYMBOL}{item.penalty.toFixed(2)}</Text>)}</View>
            </View>
        );
    };

    if (loading) { return (<SafeAreaView style={styles.container}><View style={styles.loadingContainer}><ActivityIndicator size="large" color={AccentColor} /><Text style={styles.loadingText}>Loading Order...</Text></View></SafeAreaView>); }
    if (error || !currentOrderData) { return (<SafeAreaView style={styles.container}><View style={styles.loadingContainer}><IconMUI name="error-outline" size={48} color={AccentColor} /><Text style={styles.errorText}>{error || "Order details could not be loaded or order not found."}</Text>{navigation.canGoBack() && (<TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.errorLink}>Go Back</Text></TouchableOpacity>)}</View></SafeAreaView>); }

    const currentStatusLower = currentOrderData.status?.toLowerCase() || '';
    const paymentMethodForDisplay = currentOrderData.paymentMethod || 'Unknown';
    const canShip = ['pending', 'processing', 'active', 'unpaid (cod)', 'unpaid (fixed duration)', 'unpaid (bnpl)', 'pending first installment', 'partially paid', 'mixed (cod/bnpl pending)', 'mixed (cod/fixed pending)'].includes(currentStatusLower);
    const otpExists = !!currentOrderData?.deliveryOtp;
    const canMarkAsShipped = canShip && !otpExists;
    const showDeliveryOtpVerification = currentStatusLower === SHIPPED_STATUS.toLowerCase() && otpExists;
    const relevantPlanDetails = currentOrderData.bnplPlanDetails || currentOrderData.fixedDurationDetails;
    const isInstallmentOrder = currentOrderData.paymentMethod === 'BNPL' || (currentOrderData.paymentMethod === 'Mixed' && Array.isArray(currentOrderData.installments) && currentOrderData.installments.length > 0);
    const isFixedDurationOrderOnly = currentOrderData.paymentMethod === 'Fixed Duration';
    const showCodSection = (currentOrderData.paymentMethod === 'COD' || currentOrderData.paymentMethod === 'Mixed') && typeof currentOrderData.codAmount === 'number' && currentOrderData.codAmount > 0;
    const showInstallmentSection = isInstallmentOrder;
    const showFixedDurationSection = isFixedDurationOrderOnly || (currentOrderData.paymentMethod === 'Mixed' && !!currentOrderData?.fixedDurationDetails);
    const numFormatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}>
                <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Items Ordered ({currentOrderData.items?.length || 0})</Text>
                        <View style={styles.itemsListContainer}>
                            <FlatList data={currentOrderData.items || []} keyExtractor={(itemData, index) => `${itemData.id || 'item'}-${index}`} renderItem={renderOrderItem} scrollEnabled={false} ListEmptyComponent={<Text style={styles.emptyListText}>No items found in this order.</Text>} />
                        </View>
                        <View style={styles.orderTotals}>
                            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal:</Text><Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {(currentOrderData.subtotal || 0).toLocaleString(undefined, numFormatOptions)}</Text></View>
                            {typeof currentOrderData.deliveryFee === 'number' && currentOrderData.deliveryFee > 0 && (<View style={styles.summaryRow}><Text style={styles.summaryLabel}>Delivery Fee:</Text><Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {currentOrderData.deliveryFee.toLocaleString(undefined, numFormatOptions)}</Text></View>)}
                            {typeof currentOrderData.discountAmount === 'number' && currentOrderData.discountAmount > 0 && (<View style={styles.summaryRow}><Text style={styles.summaryLabel}>Discount:</Text><Text style={[styles.summaryValue, styles.discountValue]}>- {CURRENCY_SYMBOL} {currentOrderData.discountAmount.toLocaleString(undefined, numFormatOptions)}</Text></View>)}
                            <View style={styles.totalDivider} />
                            <View style={styles.summaryRow}><Text style={[styles.summaryLabel, styles.grandTotalLabel]}>Grand Total:</Text><Text style={[styles.summaryValue, styles.grandTotalValue]}>{CURRENCY_SYMBOL} {(currentOrderData.grandTotal || 0).toLocaleString(undefined, numFormatOptions)}</Text></View>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Order Summary</Text>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Order ID:</Text><Text style={[styles.summaryValue, styles.idValue]} selectable={true}>{currentOrderData.id || 'N/A'}</Text></View>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Order Date:</Text><Text style={styles.summaryValue}>{formatDate(currentOrderData.createdAt || currentOrderData.orderDate)}</Text></View>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Order Status:</Text><View style={[styles.statusBadge, getStatusStyle(currentOrderData.status)]}><Text style={styles.statusText}>{currentOrderData.status || 'Unknown'}</Text></View></View>
                        {currentOrderData.shippedAt && (<View style={styles.summaryRow}><Text style={styles.summaryLabel}>Shipped Date:</Text><Text style={styles.summaryValue}>{formatDate(currentOrderData.shippedAt)}</Text></View>)}
                        {currentOrderData.deliveredAt && (<View style={styles.summaryRow}><Text style={styles.summaryLabel}>Delivered Date:</Text><Text style={styles.summaryValue}>{formatDate(currentOrderData.deliveredAt)}</Text></View>)}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Customer Information</Text>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Name:</Text><Text style={styles.summaryValue}>{currentOrderData.userName || 'N/A'}</Text></View>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Phone:</Text><Text style={styles.summaryValue} selectable={true}>{currentOrderData.userPhone || 'N/A'}</Text></View>
                        {currentOrderData.userEmail && (<View style={styles.summaryRow}><Text style={styles.summaryLabel}>Email:</Text><Text style={styles.summaryValue} selectable={true}>{currentOrderData.userEmail}</Text></View>)}
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Address:</Text><Text style={[styles.summaryValue, styles.addressValue]} selectable={true}>{currentOrderData.userAddress || 'N/A'}</Text></View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Payment Details</Text>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Method:</Text><Text style={styles.summaryValue}>{paymentMethodForDisplay}</Text></View>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Payment Status:</Text><View style={[styles.statusBadge, getStatusStyle(currentOrderData.paymentStatus)]}><Text style={styles.statusText}>{currentOrderData.paymentStatus || 'N/A'}</Text></View></View>
                        {currentOrderData.paymentReceivedAt && currentOrderData.paymentStatus === PAID_STATUS && (<View style={styles.summaryRow}><Text style={styles.summaryLabel}>Fully Paid Date:</Text><Text style={styles.summaryValue}>{formatDate(currentOrderData.paymentReceivedAt)}</Text></View>)}
                        {showCodSection && (<View style={styles.paymentSubSection}><Text style={styles.paymentSubHeader}>Cash on Delivery Details</Text><View style={styles.summaryRow}><Text style={styles.summaryLabel}>Amount Due (COD):</Text><Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.codAmount || 0).toLocaleString(undefined, numFormatOptions)}</Text></View>{currentOrderData.codPaymentReceivedAt && (<View style={styles.summaryRow}><Text style={styles.summaryLabel}>COD Paid At:</Text><Text style={styles.summaryValue}>{formatDate(currentOrderData.codPaymentReceivedAt)}</Text></View>)}</View>)}
                        {showInstallmentSection && (<View style={styles.paymentSubSection}><Text style={styles.paymentSubHeader}>Installment Plan Details</Text><View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total Plan Amount (BNPL):</Text><Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.bnplAmount || 0).toLocaleString(undefined, numFormatOptions)}</Text></View>{relevantPlanDetails && (<View style={styles.planDetailsBox}><Text style={styles.planDetailText}>Plan: {relevantPlanDetails.name || 'N/A'}</Text><Text style={styles.planDetailText}>Duration: {relevantPlanDetails.duration || 'N/A'} Months</Text><Text style={styles.planDetailText}>Interest: {typeof relevantPlanDetails.interestRate === 'number' ? `${(relevantPlanDetails.interestRate).toFixed(1)}%` : 'N/A'}</Text></View>)}{currentOrderData.firstInstallmentPaymentPreference && (<View style={styles.summaryRow}><Text style={styles.summaryLabel}>1st Inst. Preference:</Text><Text style={styles.summaryValue}>{currentOrderData.firstInstallmentPaymentPreference}</Text></View>)}{(currentOrderData.installments?.length > 0) && <Text style={styles.linkText}>(Full schedule below)</Text>}</View>)}
                        {showFixedDurationSection && (<View style={styles.paymentSubSection}><Text style={styles.paymentSubHeader}>Fixed Duration Plan Details</Text><View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total Plan Amount:</Text><Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.fixedDurationAmountDue ?? 0).toLocaleString(undefined, numFormatOptions)}</Text></View>{relevantPlanDetails && (<View style={styles.planDetailsBox}><Text style={styles.planDetailText}>Plan: {relevantPlanDetails.name || 'Fixed Plan'}</Text><Text style={styles.planDetailText}>Duration: {relevantPlanDetails.duration || 'N/A'} Months</Text><Text style={styles.planDetailText}>Interest: {typeof relevantPlanDetails.interestRate === 'number' ? `${(relevantPlanDetails.interestRate).toFixed(1)}%` : 'N/A'}</Text></View>)}<View style={styles.summaryRow}><Text style={styles.summaryLabel}>Payment Due Date:</Text><Text style={[styles.summaryValue, styles.dueDateValue]}>{formatShortDate(currentOrderData.fixedDurationDetails?.dueDate ?? currentOrderData.paymentDueDate)}</Text></View>{typeof currentOrderData.penalty === 'number' && currentOrderData.penalty > 0 && (<View style={styles.summaryRow}><Text style={[styles.summaryLabel, styles.penaltyLabel]}>Penalty Applied:</Text><Text style={[styles.summaryValue, styles.penaltyValue]}>{CURRENCY_SYMBOL}{currentOrderData.penalty.toFixed(2)}</Text></View>)}</View>)}
                    </View>

                    {showInstallmentSection && currentOrderData.installments?.length > 0 && (<View style={styles.section}><Text style={styles.sectionTitle}>Installment Schedule</Text><FlatList data={currentOrderData.installments} keyExtractor={(inst, index) => inst?.installmentNumber ? `inst-${inst.installmentNumber}-${index}` : `inst-fallback-${index}`} renderItem={renderInstallment} scrollEnabled={false} ListEmptyComponent={<Text style={styles.emptyListText}>No installment data found.</Text>} /></View>)}

                    {canMarkAsShipped && (<TouchableOpacity style={[styles.actionButton, isProcessingShip && styles.disabledButton]} onPress={handleShipAndGenerateOtp} disabled={isProcessingShip} activeOpacity={0.7}>{isProcessingShip ? (<ActivityIndicator color="#FFF" size="small" />) : (<View style={styles.buttonContent}><IconMUI name="local-shipping" size={18} color="#FFF" style={styles.buttonIcon} /><Text style={styles.actionButtonText}>Ship & Generate Delivery OTP</Text></View>)}</TouchableOpacity>)}
                    {showDeliveryOtpVerification && (
                        <View style={styles.otpVerificationContainer}>
                            <Text style={styles.otpInputLabel}>Enter Delivery OTP</Text><Text style={styles.otpInputSubLabel}>Provided by customer/rider</Text>
                            <PaperInput label={`Enter ${OTP_LENGTH}-Digit Delivery OTP`} mode="outlined" style={styles.otpInputPaper} value={enteredOtp} onChangeText={setEnteredOtp} keyboardType="number-pad" maxLength={OTP_LENGTH} editable={!isVerifyingOtp} outlineColor={LightBorderColor} activeOutlineColor={FocusedBorderColor} theme={{ colors: { primary: FocusedBorderColor, text: TextColorPrimary, placeholder: TextColorSecondary, background: AppBackgroundColor }, roundness: 8 }} onSubmitEditing={handleVerifyOtp} error={!!otpError} contentStyle={styles.otpInputContentStyle} />
                            {otpError ? <Text style={styles.otpErrorText}>{otpError}</Text> : null}
                            {__DEV__ && currentOrderData.deliveryOtp && (<Text style={styles.otpReferenceText}>Expected (Dev only): {currentOrderData.deliveryOtp}</Text>)}
                            <TouchableOpacity style={[styles.verifyOtpButton, (isVerifyingOtp || !enteredOtp || enteredOtp.length !== OTP_LENGTH) && styles.disabledButton]} onPress={handleVerifyOtp} disabled={isVerifyingOtp || !enteredOtp || enteredOtp.length !== OTP_LENGTH} activeOpacity={0.7}>{isVerifyingOtp ? (<ActivityIndicator color="#FFF" size="small" />) : (<View style={styles.buttonContent}><IconMUI name="check-circle-outline" size={18} color="#FFF" style={styles.buttonIcon} /><Text style={styles.actionButtonText}>Verify Delivery OTP</Text></View>)}</TouchableOpacity>
                        </View>
                    )}
                    {!canMarkAsShipped && !showDeliveryOtpVerification && currentOrderData.status && (<View style={styles.finalStatusContainer}><Text style={styles.finalStatusLabel}>Current Order Status:</Text><View style={[styles.statusBadge, getStatusStyle(currentOrderData.status)]}><Text style={styles.statusText}>{currentOrderData.status}</Text></View></View>)}
                    <View style={{ height: 30 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: ScreenBackgroundColor, },
    scrollContainer: { flexGrow: 1, padding: 15, paddingBottom: 40, paddingTop: Platform.OS === 'android' ? 10 : 20 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    loadingText: { marginTop: 15, fontSize: 16, color: TextColorSecondary },
    errorText: { fontSize: 17, fontWeight: '500', color: AccentColor, marginBottom: 20, textAlign: 'center' },
    errorLink: { fontSize: 16, color: '#007AFF', fontWeight: 'bold', marginTop: 10 },
    emptyListText: { textAlign: 'center', color: TextColorSecondary, fontStyle: 'italic', paddingVertical: 10 },
    section: { backgroundColor: AppBackgroundColor, borderRadius: 10, padding: 15, marginBottom: 18, elevation: 1.5, shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2.5, borderWidth: Platform.OS === 'ios' ? 0.5 : 0, borderColor: '#E0E0E0', },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: TextColorPrimary, marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingBottom: 10, },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', },
    summaryLabel: { fontSize: 14, color: TextColorSecondary, marginRight: 8, flexBasis: '35%', },
    summaryValue: { fontSize: 14, fontWeight: '500', color: TextColorPrimary, textAlign: 'right', flexShrink: 1, flexBasis: '60%', },
    addressValue: { textAlign: 'left', marginLeft: 'auto', },
    idValue: { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 13 },
    dueDateValue: { fontWeight: 'bold', color: AccentColor },
    discountValue: { color: SuccessColor },
    statusBadge: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 15, alignSelf: 'flex-end', },
    statusText: { fontSize: 12, fontWeight: 'bold', color: '#fff', },
    statusPending: { backgroundColor: '#FFA726' }, statusProcessing: { backgroundColor: '#42A5F5' }, statusShipped: { backgroundColor: '#81C784' }, statusDelivered: { backgroundColor: '#90A4AE' }, statusCancelled: { backgroundColor: '#EF5350' }, statusUnknown: { backgroundColor: '#BDBDBD' }, statusActive: { backgroundColor: '#29B6F6' }, statusFullyPaid: { backgroundColor: '#4CAF50' },
    paymentSubSection: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f0f0f0', },
    paymentSubHeader: { fontSize: 15, fontWeight: '600', color: TextColorPrimary, marginBottom: 10, },
    paymentValueHighlight: { fontSize: 15, fontWeight: 'bold', color: AccentColor, },
    planDetailsBox: { marginTop: 10, marginBottom: 5, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 6, borderWidth: 1, borderColor: '#eee' },
    planDetailText: { fontSize: 13, color: TextColorSecondary, marginBottom: 4, lineHeight: 18 },
    linkText: { fontSize: 13, color: '#007AFF', marginTop: 5, fontStyle: 'italic', textAlign: 'right', },
    penaltyLabel: { color: AccentColor, fontWeight: '600' },
    penaltyValue: { color: AccentColor, fontWeight: 'bold' },
    installmentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', flexWrap: 'nowrap' },
    installmentColumn: { flex: 1, paddingHorizontal: 4, },
    installmentColumnStatus: { flexBasis: 'auto', alignItems: 'flex-end', paddingLeft: 8, },
    installmentNumber: { fontSize: 13, fontWeight: '600', color: TextColorPrimary, marginBottom: 2, },
    installmentAmount: { fontSize: 13, color: TextColorPrimary, },
    installmentDueDate: { fontSize: 12, color: TextColorSecondary, marginBottom: 2, },
    paidAtText: { fontSize: 11, color: TextColorSecondary, fontStyle: 'italic', marginTop: 2, },
    penaltyText: { fontSize: 11, color: AccentColor, fontWeight: '500', marginTop: 3, },
    statusBadgeSmall: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, },
    statusTextSmall: { fontSize: 10, fontWeight: 'bold', color: '#fff', },
    statusPaid: { backgroundColor: SuccessColor }, statusInstallmentPending: { backgroundColor: '#FFA726'},
    itemsListContainer: { marginTop: 5, },
    itemContainer: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', alignItems: 'center', },
    lastItemContainer: { borderBottomWidth: 0, },
    itemImage: { width: 55, height: 55, borderRadius: 8, marginRight: 15, backgroundColor: PlaceholderBgColor, },
    itemDetails: { flex: 1, justifyContent: 'center', marginRight: 8, },
    itemName: { fontSize: 15, fontWeight: '600', color: TextColorPrimary, marginBottom: 3, },
    itemQtyPrice: { fontSize: 13, color: TextColorSecondary, marginBottom: 3, },
    itemPrice: { fontSize: 13, color: TextColorSecondary, },
    itemPaymentMethod: { fontSize: 12, fontStyle: 'italic', color: TextColorSecondary, marginTop: 4, backgroundColor: '#f0f0f0', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
    itemTotalValue: { fontSize: 15, fontWeight: 'bold', color: TextColorPrimary, textAlign: 'right', marginLeft: 10, },
    orderTotals: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F0F0F0', },
    totalDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 10, },
    grandTotalLabel: { fontWeight: 'bold', fontSize: 16, color: TextColorPrimary },
    grandTotalValue: { fontWeight: 'bold', fontSize: 16, color: AccentColor },
    actionButton: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 20, marginHorizontal: 5, marginBottom: 10, elevation: 3, minHeight: 50, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, backgroundColor: AccentColor, },
    disabledButton: { backgroundColor: '#BDBDBD', elevation: 0, shadowOpacity: 0, },
    actionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', },
    buttonContent: { flexDirection: 'row', alignItems: 'center', },
    buttonIcon: { marginRight: 10, },
    otpVerificationContainer: { marginTop: 25, marginBottom: 15, marginHorizontal: 0, paddingVertical: 20, paddingHorizontal: 15, backgroundColor: '#FFF8E1', borderRadius: 10, borderWidth: 1, borderColor: '#FFD54F', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, },
    otpInputLabel: { fontSize: 17, fontWeight: 'bold', color: TextColorPrimary, textAlign: 'center', marginBottom: 5, },
    otpInputSubLabel: { fontSize: 13, color: TextColorSecondary, textAlign: 'center', marginBottom: 15, },
    otpInputPaper: { backgroundColor: '#fff', marginBottom: 10, },
    otpInputContentStyle: { fontSize: 22, textAlign: 'center', letterSpacing: 10, fontWeight: 'bold' },
    otpErrorText: { color: AccentColor, fontSize: 14, textAlign: 'center', marginBottom: 8, fontWeight: '500' },
    otpReferenceText: { fontSize: 12, color: '#E65100', textAlign: 'center', fontStyle: 'italic', marginBottom: 15, },
    verifyOtpButton: { backgroundColor: SuccessColor, paddingVertical: 14, paddingHorizontal: 30, borderRadius: 10, elevation: 2, minHeight: 50, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2, alignSelf: 'center', width: '90%', maxWidth: 350, marginTop: 10, },
    finalStatusContainer: { marginTop: 20, marginBottom: 10, marginHorizontal: 5, paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: AppBackgroundColor, borderRadius: 10, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1.5, borderWidth: Platform.OS === 'android' ? 0 : 1, borderColor: '#E0E0E0', },
    finalStatusLabel: { fontSize: 16, fontWeight: '600', color: TextColorPrimary, marginRight: 12, },
});