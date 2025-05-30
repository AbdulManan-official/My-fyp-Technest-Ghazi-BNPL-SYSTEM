// OrderConfirmationScreen.js (COMPLETE - Integrated First Installment Payment Flow - Verified Fixed Duration Handling - Full Code - LOOPING Lottie with OK Button & Back Press as OK - White BG Popup)

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
    Alert, ScrollView, ActivityIndicator, StatusBar, Platform,
    SafeAreaView, Modal
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { db } from '../../firebaseConfig'; // Adjust path if needed
import {
    doc, serverTimestamp, addDoc, collection, query, where,
    documentId, getDocs, updateDoc, Timestamp, getFirestore, limit,
    setDoc, writeBatch
} from 'firebase/firestore'; // Ensure updateDoc and serverTimestamp are imported
import axios from 'axios';
import { useStripe } from '@stripe/stripe-react-native';

// --- Constants ---
const AppBackgroundColor = '#FFFFFF';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#666666';
const AccentColor = '#FF0000'; // Example Accent Color - Choose yours
const LightBorderColor = '#EEEEEE';
const PlaceholderBgColor = '#F0F0F0';
const ScreenBackgroundColor = '#F8F9FA';
const BnplPlanDetailColor = TextColorSecondary;
const BnplPlanValueColor = TextColorPrimary;
const BnplPlanIconColor = '#757575';
const placeholderImagePath = require('../../assets/p3.jpg'); // !!! ADJUST PATH AS NEEDED !!!
const CURRENCY_SYMBOL = 'PKR';
const ERROR_COLOR = '#D32F2F';
const CARTS_COLLECTION = 'Carts'; // <<< ENSURE THIS IS CORRECT AND DEFINED
const ORDERS_COLLECTION = 'orders';
const ADMIN_COLLECTION = 'Admin'; // Verify collection name

// Path to your Lottie animation file
const ORDER_SUCCESS_LOTTIE = require('./../../assets/congratulations.json');

// Define statuses that indicate an INCOMPLETE BNPL/Fixed order for the check
const INCOMPLETE_BNPL_FIXED_STATUSES = [
    'Partially Paid',
    'Unpaid (Fixed Duration)',
    'Overdue',
    'Unpaid (BNPL)',
    'Pending First Installment',
    'Mixed (COD/BNPL Pending)',
    'Mixed (COD/Fixed Pending)',
];
// Define payment methods that trigger the existing order check
const BNPL_FIXED_METHODS = ['BNPL', 'Fixed Duration', 'Mixed'];

// --- Payment Related Constants ---
const PAYMENT_API_ENDPOINT = "https://back.txyber.com/create-payment-intent"; // <--- !!! VERIFY/UPDATE THIS URL !!!
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send"; // For Expo push notifications
const CURRENCY_CODE = 'PKR';
const PAID_STATUS = 'Paid';
const PARTIALLY_PAID_STATUS = 'Partially Paid';
const COMPLETED_ORDER_STATUS = 'Delivered';

// --- Helper: Fetch Admin Tokens ---
async function getAdminExpoTokens() {
    // ... (your existing getAdminExpoTokens function - no changes needed here for Scenario 1)
    const tokens = [];
    console.log('[getAdminExpoTokens] Fetching admin push tokens...');
    try {
        const dbInstance = getFirestore();
        const adminQuery = query(collection(dbInstance, ADMIN_COLLECTION), where('role', '==', 'admin'));
        const adminSnapshot = await getDocs(adminQuery);

        if (adminSnapshot.empty) {
            console.log('[getAdminExpoTokens] No admin users found.');
            return [];
        }

        const adminUserIds = adminSnapshot.docs.map((d) => d.id);
        const MAX_IDS_PER_QUERY = 30;
        const tokenPromises = [];

        for (let i = 0; i < adminUserIds.length; i += MAX_IDS_PER_QUERY) {
            const batchIds = adminUserIds.slice(i, i + MAX_IDS_PER_QUERY);
            const tokensQuery = query(
                collection(dbInstance, ADMIN_COLLECTION),
                where(documentId(), 'in', batchIds)
            );
            tokenPromises.push(getDocs(tokensQuery));
        }

        const snapshots = await Promise.all(tokenPromises);
        snapshots.forEach((tokensSnapshot) => {
            tokensSnapshot.forEach((adminDoc) => {
                const token = adminDoc.data()?.expoPushToken;
                if (token && typeof token === 'string' && token.startsWith('ExponentPushToken[')) {
                    tokens.push(token);
                } else if (token) {
                     console.warn(`[getAdminExpoTokens] Invalid token format found for admin ${adminDoc.id}:`, token);
                }
            });
        });
        console.log(`[getAdminExpoTokens] Found ${tokens.length} valid admin tokens.`);
    } catch (error) {
        console.error('[getAdminExpoTokens] Error fetching admin tokens:', error);
    }
    return tokens;
}

// --- Helper: Render BNPL/Fixed Details in Item ---
const renderBnplDetailsSection = (item) => {
    // ... (your existing renderBnplDetailsSection function - no changes needed here for Scenario 1)
    const { bnplPlan, quantity, price } = item;
    if (!bnplPlan?.id || typeof price !== 'number' || typeof quantity !== 'number' || quantity <= 0) {
        return null;
    }
    const name = bnplPlan.name || 'Payment Plan';
    const duration = bnplPlan.duration;
    const interestRate = bnplPlan.interestRate;
    const planType = bnplPlan.planType || 'N/A';
    const formattedInterest = interestRate != null ? `${(interestRate).toFixed(1)}%` : 'N/A';
    const isFixed = planType === 'Fixed Duration';
    const numInstallments = !isFixed && duration ? duration : 1;
    let currentMonthlyPayment = null;
    if (!isFixed && duration > 0) {
        const currentTotalPrice = price * quantity;
        const monthlyRaw = currentTotalPrice / duration;
        currentMonthlyPayment = `${CURRENCY_SYMBOL} ${monthlyRaw.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return (
        <View style={styles.bnplDetailsContainer}>
            <Text style={styles.bnplPlanTitle}>Plan: {name}</Text>
            {planType !== 'N/A' && ( <View style={styles.bnplDetailRow}><Icon name="info-outline" size={14} color={BnplPlanIconColor} style={styles.bnplDetailIcon} /><Text style={styles.bnplDetailText}>Type:{' '} <Text style={styles.bnplDetailValue}>{planType}</Text> </Text></View> )}
            {duration != null && duration >= 0 && ( <View style={styles.bnplDetailRow}><Icon name="schedule" size={14} color={BnplPlanIconColor} style={styles.bnplDetailIcon} /><Text style={styles.bnplDetailText}>Duration:{' '} <Text style={styles.bnplDetailValue}>{duration} {duration === 1 ? 'Month' : 'Months'}</Text> {isFixed ? ( <Text style={styles.bnplDetailValue}> (1 Payment)</Text> ) : ( duration > 0 && <Text style={styles.bnplDetailValue}>{' '}/ {numInstallments} Inst.</Text> )} </Text></View> )}
            {currentMonthlyPayment && !isFixed && ( <View style={styles.bnplDetailRow}><Icon name="calculate" size={14} color={BnplPlanIconColor} style={styles.bnplDetailIcon} /><Text style={styles.bnplDetailText}>Est. Monthly:{' '} <Text style={styles.bnplDetailValue}>{currentMonthlyPayment}</Text> </Text></View> )}
            {interestRate !== null && ( <View style={styles.bnplDetailRow}><Icon name="percent" size={14} color={BnplPlanIconColor} style={styles.bnplDetailIcon} /><Text style={styles.bnplDetailText}>Interest:{' '} <Text style={styles.bnplDetailValue}>{formattedInterest}</Text> </Text></View> )}
        </View>
    );
};

// --- Helper: Calculate Due Date ---
const calculateDueDate = (baseDateInput, monthOffset) => {
    // ... (your existing calculateDueDate function - no changes needed here for Scenario 1)
    let baseDate;
    if (baseDateInput instanceof Timestamp) { baseDate = baseDateInput.toDate(); }
    else if (baseDateInput instanceof Date) { baseDate = new Date(baseDateInput.getTime()); }
    else { console.warn("[calculateDueDate] Invalid baseDateInput provided, using current date."); baseDate = new Date(); }
    if (typeof monthOffset === 'number' && monthOffset >= 0) { baseDate.setMonth(baseDate.getMonth() + monthOffset); }
    else if (typeof monthOffset === 'number') { console.warn("[calculateDueDate] Invalid (negative) monthOffset provided:", monthOffset); }
    return Timestamp.fromDate(baseDate);
};

// --- Helper: Generate ALL BNPL Installments (First Due Immediately) ---
const generateBnplInstallments = (bnplTotal, bnplPlanDetails, orderTimestampInput) => {
    // ... (your existing generateBnplInstallments function - no changes needed here for Scenario 1)
    if (!bnplPlanDetails || bnplPlanDetails.planType !== 'Installment' || !bnplPlanDetails.duration || bnplPlanDetails.duration <= 0 || bnplTotal <= 0) {
        console.log("[generateBnplInstallments] Conditions not met for installment generation.", { planType: bnplPlanDetails?.planType, duration: bnplPlanDetails?.duration, bnplTotal });
        return [];
    }
    let orderDate;
    if (orderTimestampInput instanceof Timestamp) { orderDate = orderTimestampInput.toDate(); }
    else if (orderTimestampInput instanceof Date) { orderDate = new Date(orderTimestampInput.getTime()); }
    else { console.warn("[generateBnplInstallments] Invalid orderTimestampInput, using current date."); orderDate = new Date(); }

    const installments = [];
    const duration = bnplPlanDetails.duration;
    const total = Number(bnplTotal);
    const installmentAmount = Math.round((total / duration) * 100) / 100;

    if (isNaN(installmentAmount) || installmentAmount < 0) {
        console.error("[generateBnplInstallments] Calculated installment amount is invalid:", installmentAmount);
        return [];
    }
    for (let i = 0; i < duration; i++) {
        const dueDate = calculateDueDate(orderDate, i);
        installments.push({
            installmentNumber: i + 1,
            amount: parseFloat(installmentAmount.toFixed(2)),
            dueDate: dueDate,
            paid: false,
            paidAt: null,
            penalty: 0,
            status: 'Pending'
        });
    }
    if (installments.length > 0) {
        const totalCalculated = installments.reduce((sum, inst) => sum + inst.amount, 0);
        const difference = Math.round((total - totalCalculated) * 100) / 100;
        if (difference !== 0) {
            const lastInstallmentIndex = installments.length - 1;
            const adjustedAmount = Math.round((installments[lastInstallmentIndex].amount + difference) * 100) / 100;
            installments[lastInstallmentIndex].amount = Math.max(0, adjustedAmount);
        }
    }
    console.log("[ConfirmScreen] Generated BNPL Installments (first due immediately):", JSON.stringify(installments.map(inst => ({...inst, dueDate: inst.dueDate.toDate().toISOString()})), null, 2));
    return installments;
};

// --- Payment and Notification Helper Functions ---
async function sendAdminPaymentNotification(orderIdentifier, userName, finalPaidAmount, paymentMethod) {
    // ... (your existing sendAdminPaymentNotification function - no changes needed here for Scenario 1)
    const adminTokens = await getAdminExpoTokens();
    if (!adminTokens || adminTokens.length === 0) {
        console.log("[AdminPaymentNotify] No admin tokens found. Skipping final completion notification.");
        return;
    }
    const shortOrderId = orderIdentifier.substring(0, 6).toUpperCase();
    const messages = adminTokens.map(token => ({
        to: token, sound: 'default', title: `🎉 Order #${shortOrderId} Fully Paid!`,
        body: `User ${userName || 'N/A'} completed payment for ${paymentMethod} Order #${shortOrderId}. Final payment amount: ${CURRENCY_SYMBOL}${finalPaidAmount?.toLocaleString()}`,
        data: { orderId: orderIdentifier, type: 'order_completed' },
        priority: 'high', channelId: 'admin-notifications'
    }));
    try {
        console.log(`[AdminPaymentNotify] Sending ${messages.length} FINAL completion notifications for order ${orderIdentifier}...`);
        await axios.post(EXPO_PUSH_ENDPOINT, messages, {
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Accept-encoding': 'gzip, deflate' },
            timeout: 10000
        });
        console.log(`[AdminPaymentNotify] Sent FINAL completion notifications for order ${orderIdentifier}.`);
    } catch (error) {
        console.error(`[AdminPaymentNotify] Failed to send FINAL completion notifications for order ${orderIdentifier}:`, error.response?.data || error.message);
    }
}

async function sendAdminInstallmentPaidNotification(orderId, userName, installmentNumber, installmentAmount) {
    // ... (your existing sendAdminInstallmentPaidNotification function - no changes needed here for Scenario 1)
    const adminTokens = await getAdminExpoTokens();
    if (!adminTokens || adminTokens.length === 0) {
        console.log("[AdminInstallmentNotify] No admin tokens found. Skipping installment paid notification.");
        return;
    }
    const shortOrderId = orderId.substring(0, 6).toUpperCase();
    const body = `User ${userName || 'N/A'} paid Installment #${installmentNumber} (${CURRENCY_SYMBOL}${installmentAmount?.toLocaleString()}) for Order #${shortOrderId}.`;
    const messages = adminTokens.map(token => ({
        to: token, sound: 'default', title: `✅ Inst #${installmentNumber} Paid! (Order #${shortOrderId})`,
        body: body, data: { orderId: orderId, installmentNumber: installmentNumber, type: 'installment_paid' },
        priority: 'high', channelId: 'admin-notifications',
    }));
    try {
        console.log(`[AdminInstallmentNotify] Sending ${messages.length} notifications for Order ${orderId}, Inst #${installmentNumber}...`);
        await axios.post(EXPO_PUSH_ENDPOINT, messages, {
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Accept-encoding': 'gzip, deflate' },
            timeout: 10000
        });
        console.log(`[AdminInstallmentNotify] Sent notifications for Order ${orderId}, Inst #${installmentNumber}.`);
    } catch (error) {
        console.error(`[AdminInstallmentNotify] Failed to send notifications for Order ${orderId}, Inst #${installmentNumber}:`, error.response?.data || error.message);
    }
}

async function updateFirestoreAfterFirstPayment(orderId, paidAmount, firstInstallment, originalOrderData) {
    // ... (your existing updateFirestoreAfterFirstPayment function - no changes needed here for Scenario 1)
    if (!orderId || !firstInstallment?.installmentNumber || !originalOrderData || paidAmount <= 0) {
        console.error("[Firestore Update Error] Missing required data for first payment update:", { orderId, firstInstallment, originalOrderDataExists: !!originalOrderData, paidAmount });
        Alert.alert( "Order Update Issue", "Payment successful, but critical information was missing to update the order automatically. Please contact support with your Order ID." );
        return;
    }
    const orderRef = doc(db, ORDERS_COLLECTION, orderId);
    const batch = writeBatch(db);
    console.log(`[Firestore Update] Starting update for Order ${orderId} after First Installment payment (Amount: ${paidAmount})`);
    try {
        const now = Timestamp.now();
        let updates = { firstInstallmentPaymentPreference: 'Paid Online' };
        const currentInstallments = originalOrderData.installments || [];
        let updatedInstallments = [];
        let installmentUpdated = false;

        if (currentInstallments.length > 0 && currentInstallments[0].installmentNumber === firstInstallment.installmentNumber) {
            const updatedFirst = { ...currentInstallments[0], status: PAID_STATUS, paid: true, paidAt: now };
            updatedInstallments = [updatedFirst, ...currentInstallments.slice(1)];
            installmentUpdated = true;
        } else {
            updatedInstallments = currentInstallments.map(inst => {
                if (inst.installmentNumber === firstInstallment.installmentNumber && !inst.paid) {
                    installmentUpdated = true;
                    return { ...inst, status: PAID_STATUS, paid: true, paidAt: now };
                } return inst;
            });
        }

        if (!installmentUpdated) {
            console.error(`[Firestore Update Error] CRITICAL: Failed to find or update unpaid installment #${firstInstallment.installmentNumber} for Order ${orderId}.`);
            Alert.alert( "Order Update Discrepancy", `Payment for installment #${firstInstallment.installmentNumber} successful, but issue marking it paid. Contact support with Order ID ${orderId.substring(0,8)}.` );
            return;
        }
        updates.installments = updatedInstallments;
        console.log(`[Firestore Update] Marked Inst #${firstInstallment.installmentNumber} as Paid for Order ${orderId}`);

        const allInstallmentsPaid = updatedInstallments.every(i => i.paid === true || i.status?.toLowerCase() === PAID_STATUS.toLowerCase());
        const codIsPending = (originalOrderData.codAmount || 0) > 0 && !originalOrderData.codPaymentReceivedAt;
        const fixedIsPending = (originalOrderData.paymentMethod === 'Fixed Duration' || (originalOrderData.paymentMethod === 'Mixed' && (originalOrderData.fixedAmount || 0) > 0)) && !originalOrderData.paymentReceivedAt;
        let shouldNotifyAdminOrderComplete = false;

        if (allInstallmentsPaid && !codIsPending && !fixedIsPending) {
            console.log(`[Firestore Update] Order ${orderId} is now fully paid.`);
            updates.paymentStatus = PAID_STATUS;
            updates.paymentReceivedAt = now;
            if (originalOrderData.status && originalOrderData.status?.toLowerCase() !== 'cancelled' && originalOrderData.status !== COMPLETED_ORDER_STATUS) {
                updates.status = COMPLETED_ORDER_STATUS;
            }
            shouldNotifyAdminOrderComplete = true;
        } else {
            console.log(`[Firestore Update] Order ${orderId} is now ${PARTIALLY_PAID_STATUS}.`);
            updates.paymentStatus = PARTIALLY_PAID_STATUS;
        }
        console.log(`[Firestore Update] Preparing to commit batch update for Order ${orderId}:`, updates);
        batch.update(orderRef, updates);
        await batch.commit();
        console.log(`[Firestore Update] Batch commit successful for Order ${orderId}`);

        await sendAdminInstallmentPaidNotification(orderId, originalOrderData.userName || 'user', firstInstallment.installmentNumber, paidAmount);
        if (shouldNotifyAdminOrderComplete) {
            const finalAmountForNotification = paidAmount;
            await sendAdminPaymentNotification(orderId, originalOrderData.userName || 'user', finalAmountForNotification, originalOrderData.paymentMethod);
        }
    } catch (error) {
        console.error(`[Firestore Update Error] Failed during batch commit or notification for Order ${orderId}:`, error);
        Alert.alert( "Database Update Issue", "Payment successful, but error updating order status. Details should update soon. Contact support if issue persists." );
    }
}

async function initializeAndPayFirstInstallment(
    orderId, firstInstallment, currentUserDetails, amountToPay,
    setProcessingPayment, stripe, originalOrderData, navigation
) {
    // ... (your existing initializeAndPayFirstInstallment function - no changes needed here for Scenario 1)
    const paymentAttemptId = `${orderId}-Inst-${firstInstallment?.installmentNumber ?? '1'}-${Date.now()}`;
    if (!orderId || !firstInstallment?.installmentNumber || !currentUserDetails?.uid || !amountToPay || amountToPay <= 0 || !stripe?.initPaymentSheet || !stripe?.presentPaymentSheet || !originalOrderData) {
        Alert.alert("Payment Error", "Cannot initiate payment due to missing information.");
        console.error(`[Payment Init Error] Attempt ${paymentAttemptId} - Missing critical data:`, { orderId, firstInstallmentExists: !!firstInstallment, userExists: !!currentUserDetails?.uid, amountToPay, stripeExists: !!stripe, originalOrderDataExists: !!originalOrderData });
        return;
    }
    setProcessingPayment(true);
    try {
        console.log(`[Payment] Attempt ${paymentAttemptId}: Initiating FIRST installment payment for Order ${orderId}, Inst #${firstInstallment.installmentNumber}, Amount: ${amountToPay}`);
        const response = await axios.post(PAYMENT_API_ENDPOINT, {
            amount: Math.round(amountToPay * 100), currency: CURRENCY_CODE.toLowerCase(), orderId: orderId, userId: currentUserDetails.uid,
            paymentDescription: `First Installment (#${firstInstallment.installmentNumber}) for Order #${orderId.substring(0, 6)}`,
            customerName: currentUserDetails.name || 'N/A', customerEmail: currentUserDetails.email || undefined,
            metadata: { order_id: orderId, user_id: currentUserDetails.uid, payment_type: 'Installment', installment_number: firstInstallment.installmentNumber.toString(), is_first_installment: 'true' }
        }, { timeout: 15000 });

        const { clientSecret, ephemeralKey, customer, error: backendError } = response.data;
        if (backendError || !clientSecret) { throw new Error(backendError || "Failed to get payment setup details from the server."); }

        const { error: initError } = await stripe.initPaymentSheet({
            merchantDisplayName: "Txyber", // !!! REPLACE WITH YOUR ACTUAL MERCHANT NAME !!!
            paymentIntentClientSecret: clientSecret, customerId: customer, customerEphemeralKeySecret: ephemeralKey,
            allowsDelayedPaymentMethods: false, style: 'automatic',
        });
        if (initError) { throw new Error(`Payment setup failed: ${initError.localizedMessage || initError.code || initError.message}`); }

        const { error: paymentError } = await stripe.presentPaymentSheet();
        const orderDocRef = doc(db, ORDERS_COLLECTION, orderId);

        if (paymentError) {
            if (paymentError.code === 'Canceled') {
                Alert.alert("Payment Canceled", "Payment process canceled. Pay later from order details.");
                 try { await updateDoc(orderDocRef, { firstInstallmentPaymentPreference: 'Pay Now Online - Canceled' }); } catch (e) {console.error(`Pref update error:`, e);}
            } else {
                console.error(`[Stripe Payment Error] Attempt ${paymentAttemptId}:`, paymentError);
                 try { await updateDoc(orderDocRef, { firstInstallmentPaymentPreference: 'Pay Now Online - Failed' }); } catch (e) {console.error(`Pref update error:`, e);}
                throw new Error(`Payment failed: ${paymentError.localizedMessage || paymentError.code || paymentError.message}`);
            }
        } else {
            console.log(`[Payment] Attempt ${paymentAttemptId}: First installment payment SUCCESSFUL for Order ${orderId}.`);
            Alert.alert("Payment Successful!", "Your first installment has been paid.");
            await updateFirestoreAfterFirstPayment( orderId, amountToPay, firstInstallment, originalOrderData );
        }
    } catch (error) {
        console.error(`[Payment Flow Error] Attempt ${paymentAttemptId}, Order ${orderId}:`, error);
        Alert.alert( "Payment Process Error", error.message || "Unexpected error during payment. Check order details or contact support." );
         try { await updateDoc(doc(db, ORDERS_COLLECTION, orderId), { firstInstallmentPaymentPreference: 'Pay Now Online - Failed' }); }
         catch (e) {console.error(`Pref update error:`, e);}
    } finally {
        setProcessingPayment(false);
        console.log(`[Payment Flow] Attempt ${paymentAttemptId}: Finished for Order ${orderId}. Navigating home.`);
        if (navigation && typeof navigation.popToTop === 'function') { navigation.popToTop(); }
        else { console.warn(`[Payment Flow] Attempt ${paymentAttemptId}: Navigation object or popToTop function not available.`); }
    }
}

// --- Main Component ---
export default function OrderConfirmationScreen() {
    const navigation = useNavigation();
    const route = useRoute(); // Using useRoute to get params
    // Destructure cartItems from route.params, and rename to avoid conflict if you use a local cartItems state later
    const {
        currentUserDetails = null,
        cartItems: initialCartItemsFromRoute = [], // Use this for the order items
        subTotal = 0,
        grandTotal = 0,
        // origin will be in route.params.origin
    } = route.params || {};

    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const { initPaymentSheet, presentPaymentSheet, loading: stripeLoadingHook } = useStripe();
    const [isProcessingFirstPayment, setIsProcessingFirstPayment] = useState(false);
    const [showOrderSuccessAnimation, setShowOrderSuccessAnimation] = useState(false);
    const postOrderActionDataRef = useRef(null);
    const lottieAnimationRef = useRef(null);

    const totalItemCount = useMemo(() => {
        if (!Array.isArray(initialCartItemsFromRoute)) return 0; // Use initialCartItemsFromRoute
        return initialCartItemsFromRoute.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);
    }, [initialCartItemsFromRoute]); // Use initialCartItemsFromRoute

    const isCartEmpty = !initialCartItemsFromRoute || initialCartItemsFromRoute.length === 0 || totalItemCount === 0; // Use initialCartItemsFromRoute

    const renderConfirmationItem = useCallback(({ item, index }) => {
        // ... (your existing renderConfirmationItem logic)
        if (!item?.id || typeof item.price !== 'number' || typeof item.quantity !== 'number' || item.quantity <= 0) {
            console.warn("Skipping rendering invalid cart item:", item); return null;
        }
        const itemTotalPrice = item.price * item.quantity;
        const isLastItem = index === initialCartItemsFromRoute.length - 1; // Use initialCartItemsFromRoute
        const showPlanDetails = (item.paymentMethod === 'BNPL' || item.paymentMethod === 'Fixed Duration') && item.bnplPlan;
        return (
            <View style={[styles.cartItem, isLastItem && styles.lastCartItem]}>
                <Image source={item.image ? { uri: item.image } : placeholderImagePath} style={styles.productImage} defaultSource={placeholderImagePath} onError={(e) => console.warn(`Image load failed: ${item.image}`, e.nativeEvent.error)} />
                <View style={styles.itemDetails}>
                    <Text style={styles.productName} numberOfLines={2}>{item.name || 'Unnamed Product'}</Text>
                    <Text style={styles.itemQuantityPrice}>Qty: {item.quantity} x {`${CURRENCY_SYMBOL} ${item.price.toLocaleString()}`}</Text>
                    <Text style={styles.itemSubtotal}>Item Total: <Text style={styles.itemSubtotalValue}>{`${CURRENCY_SYMBOL} ${itemTotalPrice.toLocaleString()}`}</Text></Text>
                    {showPlanDetails && renderBnplDetailsSection(item)}
                </View>
            </View>
        );
    }, [initialCartItemsFromRoute]); // Use initialCartItemsFromRoute

    const handlePostOrderSuccessActions = useCallback(async () => {
        // ... (your existing handlePostOrderSuccessActions function - no changes needed here for Scenario 1)
        if (!showOrderSuccessAnimation && !postOrderActionDataRef.current) return;

        setShowOrderSuccessAnimation(false);
        const { newOrderId, orderDetailsToSave, isBnplInstallmentOrder } = postOrderActionDataRef.current || {};

        if (!newOrderId || !orderDetailsToSave) {
            console.error("[PostOrderAction] Missing order data after animation.");
            if (navigation.canGoBack()) navigation.popToTop(); else navigation.navigate("Home"); // Fallback
            postOrderActionDataRef.current = null; // Clear ref
            return;
        }

        if (isBnplInstallmentOrder && orderDetailsToSave.installments && orderDetailsToSave.installments.length > 0) {
            const firstInstallment = orderDetailsToSave.installments[0];
            const amountToPay = (firstInstallment.amount || 0) + (firstInstallment.penalty || 0);

            if (amountToPay <= 0) {
                Alert.alert('Order Confirmed', `Your Order (#${newOrderId.substring(0, 8)}) details are available in your order history.`, [{ text: 'OK', onPress: () => navigation.popToTop() }], { cancelable: false });
            } else {
                Alert.alert( 'First Installment Due', `Order (#${newOrderId.substring(0, 8)}) confirmed!\n\nYour first installment of ${CURRENCY_SYMBOL}${amountToPay.toFixed(2)} is due. Pay online now?`,
                    [
                        { text: 'Pay Now Online', onPress: async () => {
                            if (isProcessingFirstPayment || stripeLoadingHook) { Alert.alert("Please Wait", "Payment process initializing..."); return; }
                            await initializeAndPayFirstInstallment( newOrderId, firstInstallment, currentUserDetails, amountToPay, setIsProcessingFirstPayment, { initPaymentSheet, presentPaymentSheet }, orderDetailsToSave, navigation );
                        } },
                        { text: 'Pay at Delivery', onPress: async () => {
                            try { await updateDoc(doc(db, ORDERS_COLLECTION, newOrderId), { firstInstallmentPaymentPreference: 'Pay at Delivery' }); Alert.alert("Preference Saved", "You'll pay the first installment upon delivery.");}
                            catch (updateError) { console.error(`Error updating preference:`, updateError); Alert.alert("Error", "Could not save preference."); }
                            finally { navigation.popToTop(); }
                        } }
                    ], { cancelable: false }
                );
            }
        } else {
            console.log(`[ConfirmScreen] Order ${newOrderId} (Type: ${orderDetailsToSave.paymentMethod}) placed. Navigating home.`);
            navigation.popToTop();
        }
        postOrderActionDataRef.current = null; // Clear the ref
    }, [
        currentUserDetails, navigation, initPaymentSheet, presentPaymentSheet,
        isProcessingFirstPayment, stripeLoadingHook, showOrderSuccessAnimation
    ]);

    const handleConfirmAndPlaceOrder = useCallback(async () => {
        if (isPlacingOrder || isProcessingFirstPayment || showOrderSuccessAnimation) {
            console.log("Ignoring tap: Action already in progress."); return;
        }
        if (!currentUserDetails?.uid) { Alert.alert('Authentication Error', 'User details are missing.'); return; }
        // Use initialCartItemsFromRoute for validation
        if (!Array.isArray(initialCartItemsFromRoute) || initialCartItemsFromRoute.length === 0) { Alert.alert('Empty Cart', 'Your shopping cart is empty.'); return; }
        const validCartItems = initialCartItemsFromRoute.filter(item => item?.id && typeof item.quantity === 'number' && item.quantity > 0 && typeof item.price === 'number' && item.price >= 0);
        if (validCartItems.length === 0) { Alert.alert('Invalid Cart', 'No valid items found.'); return; }

        const currentCartItemsForOrder = validCartItems; // These items will be saved in the order
        // subTotal and grandTotal are already available from route.params

        setIsPlacingOrder(true);
        const userId = currentUserDetails.uid;
        let newOrderId = null;
        const firestoreWriteTimestamp = serverTimestamp();
        const jsOrderPlacementDate = new Date();
        let orderDetailsToSave = {};
        let isBnplInstallmentOrder = false;

        try {
            // --- Existing Incomplete BNPL/Fixed Order Check ---
            const newOrderHasBnplOrFixed = currentCartItemsForOrder.some(item => item?.paymentMethod === 'BNPL' || item?.paymentMethod === 'Fixed Duration');
            if (newOrderHasBnplOrFixed) {
                // ... (your existing check logic) ...
                const ordersRef = collection(db, ORDERS_COLLECTION);
                const qExisting = query( ordersRef, where('userId', '==', userId), where('paymentMethod', 'in', BNPL_FIXED_METHODS), where('paymentStatus', 'in', INCOMPLETE_BNPL_FIXED_STATUSES), limit(1) );
                const existingIncompleteSnapshot = await getDocs(qExisting);
                if (!existingIncompleteSnapshot.empty) {
                    Alert.alert( 'Order Restriction', 'You have an existing payment plan (BNPL or Fixed Duration) that is not yet fully paid. Please settle current payments before placing a new order with a payment plan.', [{ text: 'OK' }] );
                    setIsPlacingOrder(false); return;
                }
            }

            // --- Determine Payment Method, Status, and Construct Order Details ---
            // ... (your existing logic for codItems, bnplItems, fixedItems, subtotals) ...
            // ... (your existing logic for relevantItemForPlan, relevantBnplPlan, planType) ...
            // ... (your existing logic for overallPaymentMethod, overallPaymentStatus, orderSpecificData) ...
            // ... (your existing logic for generating installments if BNPL) ...
            // ... (your existing logic for fixed duration details if Fixed Duration) ...

            const codItems = currentCartItemsForOrder.filter(item => item?.paymentMethod === 'COD');
            const bnplItems = currentCartItemsForOrder.filter(item => item?.paymentMethod === 'BNPL' && item.bnplPlan?.planType === 'Installment');
            const fixedItems = currentCartItemsForOrder.filter(item => item.bnplPlan?.planType === 'Fixed Duration' && (item?.paymentMethod === 'Fixed Duration' || item?.paymentMethod === 'BNPL'));

            const bnplSubTotalFromItems = bnplItems.reduce((sum, item) => sum + ((item?.price || 0) * (item?.quantity || 0)), 0);
            const fixedSubTotalFromItems = fixedItems.reduce((sum, item) => sum + ((item?.price || 0) * (item?.quantity || 0)), 0);
            const codSubTotalFromItems = codItems.reduce((sum, item) => sum + ((item?.price || 0) * (item?.quantity || 0)), 0);

            const relevantItemForPlan = bnplItems[0] || fixedItems[0];
            const relevantBnplPlan = relevantItemForPlan?.bnplPlan || null;
            const planType = relevantBnplPlan?.planType;

            let overallPaymentMethod = 'Unknown';
            let overallPaymentStatus = 'Pending';
            let orderSpecificData = {};

            const hasBnpl = bnplItems.length > 0;
            const hasFixed = fixedItems.length > 0;
            const hasCod = codItems.length > 0;

            if ((hasBnpl || hasFixed) && hasCod) { overallPaymentMethod = 'Mixed'; }
            else if (hasBnpl) { overallPaymentMethod = 'BNPL'; }
            else if (hasFixed) { overallPaymentMethod = 'Fixed Duration'; }
            else if (hasCod) { overallPaymentMethod = 'COD'; }
            else { overallPaymentMethod = 'Prepaid'; overallPaymentStatus = 'Paid'; } // Should not happen if cart has items

            isBnplInstallmentOrder = false;

            if (overallPaymentMethod === 'BNPL' || (overallPaymentMethod === 'Mixed' && hasBnpl)) {
                if (relevantBnplPlan && planType === 'Installment' && relevantBnplPlan.duration > 0 && bnplSubTotalFromItems > 0) {
                    const fullInstallmentSchedule = generateBnplInstallments(bnplSubTotalFromItems, relevantBnplPlan, jsOrderPlacementDate);
                    if (fullInstallmentSchedule.length > 0) {
                        isBnplInstallmentOrder = true;
                        overallPaymentStatus = overallPaymentMethod === 'Mixed' ? 'Mixed (COD/BNPL Pending)' : 'Pending First Installment';
                        orderSpecificData = { paymentStatus: overallPaymentStatus, installments: fullInstallmentSchedule, bnplPlanDetails: { id: relevantBnplPlan.id, name: relevantBnplPlan.name, duration: relevantBnplPlan.duration, interestRate: relevantBnplPlan.interestRate, planType: relevantBnplPlan.planType } };
                    } else { overallPaymentStatus = 'Pending Review (Installment Error)'; }
                } else { overallPaymentStatus = 'Pending Review (Invalid Plan Data)'; }
            }
            else if (overallPaymentMethod === 'Fixed Duration' || (overallPaymentMethod === 'Mixed' && hasFixed)) {
                if (relevantBnplPlan && planType === 'Fixed Duration') {
                    const fixedDueDate = calculateDueDate(jsOrderPlacementDate, relevantBnplPlan.duration);
                    overallPaymentStatus = overallPaymentMethod === 'Mixed' ? 'Mixed (COD/Fixed Pending)' : 'Unpaid (Fixed Duration)';
                    orderSpecificData = { paymentStatus: overallPaymentStatus, fixedDurationDetails: { id: relevantBnplPlan.id, name: relevantBnplPlan.name, duration: relevantBnplPlan.duration, interestRate: relevantBnplPlan.interestRate, planType: relevantBnplPlan.planType }, paymentDueDate: fixedDueDate, fixedDurationAmountDue: fixedSubTotalFromItems, penalty: 0 };
                } else { overallPaymentStatus = 'Pending Review (Missing Fixed Plan)'; }
            }
            else if (overallPaymentMethod === 'COD') {
                overallPaymentStatus = 'Unpaid (COD)';
                orderSpecificData = { paymentStatus: overallPaymentStatus };
            }
            else { orderSpecificData = { paymentStatus: overallPaymentStatus }; }


            let firstInstallmentPref = isBnplInstallmentOrder ? 'Pending Choice' : null;
            orderDetailsToSave = {
                userId: userId, userName: currentUserDetails.name || 'N/A', userAddress: currentUserDetails.address || 'N/A', userPhone: currentUserDetails.phone || 'N/A', userEmail: currentUserDetails.email || null,
                items: currentCartItemsForOrder.map(item => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity, image: item.image || null, paymentMethod: item.paymentMethod, ...(item.bnplPlan && { bnplPlan: { id: item.bnplPlan.id, name: item.bnplPlan.name, duration: item.bnplPlan.duration, interestRate: item.bnplPlan.interestRate, planType: item.bnplPlan.planType }}) })),
                subtotal: subTotal, // Use subTotal from route params
                grandTotal: grandTotal, // Use grandTotal from route params
                codAmount: codSubTotalFromItems, // Use calculated COD subtotal
                bnplAmount: bnplSubTotalFromItems, // Use calculated BNPL subtotal
                createdAt: firestoreWriteTimestamp, orderDate: jsOrderPlacementDate,
                status: 'Pending', paymentMethod: overallPaymentMethod,
                ...orderSpecificData,
                ...(isBnplInstallmentOrder && { firstInstallmentPaymentPreference: firstInstallmentPref })
            };

            if (!orderDetailsToSave.items || orderDetailsToSave.items.length === 0) { throw new Error("Order contains no valid items."); }
            if (!orderDetailsToSave.paymentMethod || orderDetailsToSave.paymentMethod === 'Unknown') { throw new Error("Could not determine valid payment method."); }

            // --- Save Order to Firestore ---
            const orderCollectionRef = collection(db, ORDERS_COLLECTION);
            const docRef = await addDoc(orderCollectionRef, orderDetailsToSave);
            newOrderId = docRef.id;
            if (!newOrderId) { throw new Error('Failed to get Order ID after saving.'); }
            console.log('[ConfirmScreen] Order successfully saved with ID:', newOrderId);


            // +++++++++++++++++++++++ CART MODIFICATION LOGIC FOR SCENARIO 1 +++++++++++++++++++++++
            const orderOrigin = route.params?.origin; // Get origin from the route params

            // This was the old cart clearing logic, we will replace/enhance it.
            // try {
            //     const cartDocRef = doc(db, CARTS_COLLECTION, userId);
            //     await updateDoc(cartDocRef, { items: [], lastUpdated: serverTimestamp() });
            // } catch (cartError) {
            //      console.error(`[ConfirmScreen] CRITICAL ERROR: Failed to clear cart for user ${userId} after order ${newOrderId}:`, cartError);
            //      Alert.alert("Cart Clear Issue", "Order placed, but failed to clear cart. Please manually remove items or contact support.");
            // }

            // NEW CART MODIFICATION LOGIC
            try {
                const cartDocRef = doc(db, CARTS_COLLECTION, userId);

                if (orderOrigin === 'CartScreen') {
                    // SCENARIO 1: Clear entire cart
                    console.log("[OrderConfirmation] Origin is CartScreen. Clearing entire cart for user:", userId);
                    await updateDoc(cartDocRef, { items: [], lastUpdated: serverTimestamp() });
                    console.log(`[OrderConfirmation] Cart cleared for user ${userId}`);
                }
                // Placeholder for Scenario 2 & 3
                // else if (orderOrigin === 'ProductDetailFromCart' && route.params?.orderedItemId) { /* ... */ }
                // else if (orderOrigin === 'ProductDetailDirect') { /* ... */ }
                else {
                    console.warn(`[OrderConfirmation] Origin is '${orderOrigin}'. No specific cart modification rule implemented yet for this origin (besides CartScreen).`);
                }

            } catch (cartModificationError) {
                console.error(`[OrderConfirmation] CRITICAL ERROR during cart modification for user ${userId} (origin: ${orderOrigin}):`, cartModificationError);
                // Important: Don't let cart modification error block the user from knowing the order was placed.
                Alert.alert(
                    "Order Placed, Cart Issue",
                    "Your order has been placed successfully, but there was an issue updating your cart. Please check your cart or contact support."
                );
            }
            // +++++++++++++++++++++++ END OF CART MODIFICATION LOGIC +++++++++++++++++++++++


            // --- Admin Notifications ---
            getAdminExpoTokens().then(adminTokens => {
                // ... (your existing notification sending logic)
                if (adminTokens && adminTokens.length > 0) {
                    const shortOrderId = newOrderId.substring(0, 6).toUpperCase();
                    const messages = adminTokens.map(token => ({ to: token, sound: 'default', title: `🛒 New Order! (#${shortOrderId})`, body: `User ${orderDetailsToSave.userName} placed a ${orderDetailsToSave.paymentMethod} order (#${shortOrderId}). Total: ${CURRENCY_SYMBOL}${orderDetailsToSave.grandTotal.toLocaleString()}`, data: { orderId: newOrderId, type: 'new_order' }, priority: 'high', channelId: 'admin-notifications' }));
                    axios.post(EXPO_PUSH_ENDPOINT, messages, { headers: { 'Content-Type': 'application/json' }, timeout: 10000 })
                        .catch(notifyError => console.error(`[ConfirmScreen] Notification send error:`, notifyError.response?.data || notifyError.message));
                }
            });

            setIsPlacingOrder(false);
            postOrderActionDataRef.current = { newOrderId, orderDetailsToSave, isBnplInstallmentOrder };
            setShowOrderSuccessAnimation(true);

        } catch (error) {
            console.error('[ConfirmScreen] CRITICAL ERROR during order placement:', error);
            setIsPlacingOrder(false); setIsProcessingFirstPayment(false);
            let errorMsg = 'Could not place order. Please try again.';
            if (error.code === 'permission-denied') errorMsg = 'Authentication Error. Please log in again and retry.';
            else if (error.code === 'failed-precondition' || error.message?.includes('index required')) errorMsg = 'Server busy processing history. Please try again in a moment.';
            else if (error.message) errorMsg = `Failed: ${error.message}`;
            Alert.alert('Order Placement Failed', errorMsg);
        }
    }, [
        currentUserDetails,
        initialCartItemsFromRoute, // Ensures this is from route.params
        subTotal, // From route.params
        grandTotal, // From route.params
        route.params?.origin, // *** ADDED route.params?.origin TO THE DEPENDENCY ARRAY ***
        navigation,
        isPlacingOrder,
        isProcessingFirstPayment,
        stripeLoadingHook,
        initPaymentSheet,
        presentPaymentSheet,
        showOrderSuccessAnimation
        // Ensure all other state/props used inside are listed if they can change
    ]);

    // --- Loading/Empty States and Main Render ---
    if (!currentUserDetails) { return (<SafeAreaView style={styles.safeArea}><View style={styles.loadingContainer}><ActivityIndicator size="large" color={AccentColor} /><Text style={styles.loadingText}>Loading User Details...</Text></View></SafeAreaView>); }
    if (isCartEmpty) { return ( <SafeAreaView style={styles.safeArea}><StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} /><View style={styles.emptyCartContainer}><Icon name="remove-shopping-cart" size={60} color={TextColorSecondary} /><Text style={styles.emptyCartTitle}>Your Cart is Empty</Text><Text style={styles.emptyCartSubtitle}>Add items to place an order.</Text><TouchableOpacity style={styles.goShoppingButton} onPress={() => navigation.navigate('Home')}><Text style={styles.goShoppingButtonText}>Start Shopping</Text></TouchableOpacity></View></SafeAreaView> ); }

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
            {/* Use initialCartItemsFromRoute for the FlatList data */}
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContentContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" >
                {/* ... (Delivery Address Section) ... */}
                <View style={styles.sectionContainer}>
                     <Text style={styles.sectionTitle}>Delivery Address</Text>
                     <View style={styles.addressBox}>
                         <Icon name="location-pin" size={24} color={TextColorSecondary} style={styles.addressIcon} />
                         <View style={styles.addressTextContainer}>
                             <Text style={styles.addressName}>{currentUserDetails.name || 'N/A'}</Text>
                             <Text style={styles.addressDetail}>{currentUserDetails.address || 'N/A'}</Text>
                             <Text style={styles.addressDetail}>Phone: {currentUserDetails.phone || 'N/A'}</Text>
                         </View>
                     </View>
                </View>
                {/* ... (Order Items Section) ... */}
                <View style={styles.sectionContainer}>
                     <Text style={styles.sectionTitle}>Order Items ({totalItemCount})</Text>
                     <View style={styles.cartListContainer}>
                         {/* Pass initialCartItemsFromRoute to FlatList */}
                         <FlatList data={initialCartItemsFromRoute} keyExtractor={(item, index) => item.cartItemId || item.id?.toString() || `confirm-${index}`} renderItem={renderConfirmationItem} scrollEnabled={false} ListEmptyComponent={<Text style={styles.emptyListText}>No items found in cart data.</Text>} />
                     </View>
                </View>
                {/* ... (Order Summary Section) ... */}
                <View style={styles.sectionContainer}>
                     <Text style={styles.sectionTitle}>Order Summary</Text>
                     <View style={styles.summaryBox}>
                         <View style={styles.summaryRow}><Text style={styles.summaryText}>Subtotal:</Text><Text style={styles.summaryValue}>{`${CURRENCY_SYMBOL} ${subTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}</Text></View>
                         <View style={styles.summaryRow}><Text style={styles.summaryText}>Total Items:</Text><Text style={styles.summaryValue}>{totalItemCount}</Text></View>
                         <View style={styles.divider} />
                         <View style={styles.summaryRow}><Text style={styles.totalText}>Grand Total:</Text><Text style={styles.totalValue}>{`${CURRENCY_SYMBOL} ${grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}</Text></View>
                     </View>
                </View>
                <View style={{ height: 20 }} />
            </ScrollView>

            {/* ... (Footer with Confirm Button) ... */}
            <View style={styles.footer}>
                 {isProcessingFirstPayment && ( <View style={styles.paymentProcessingIndicator}><ActivityIndicator size="small" color={AccentColor} /><Text style={styles.paymentProcessingText}>Processing Payment...</Text></View> )}
                <TouchableOpacity style={[ styles.confirmButton, (isPlacingOrder || isCartEmpty || isProcessingFirstPayment || showOrderSuccessAnimation) && styles.disabledButton ]} onPress={handleConfirmAndPlaceOrder} disabled={isPlacingOrder || isCartEmpty || isProcessingFirstPayment || showOrderSuccessAnimation} activeOpacity={0.7} >
                    {isPlacingOrder ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.confirmButtonText}>Confirm & Place Order</Text> }
                </TouchableOpacity>
            </View>

            {/* ... (Order Success Animation Modal) ... */}
            {showOrderSuccessAnimation && (
                <Modal
                    transparent={true}
                    animationType="fade"
                    visible={showOrderSuccessAnimation}
                    onRequestClose={() => {
                        console.log("Order success modal close requested (e.g., Android back button). Treating as OK.");
                        if (showOrderSuccessAnimation) { // Safeguard
                            handlePostOrderSuccessActions();
                        }
                    }}
                >
                    <View style={styles.lottieOverlay}>
                        <View style={styles.lottieContentContainer}>
                            <LottieView ref={lottieAnimationRef} source={ORDER_SUCCESS_LOTTIE} autoPlay loop={true} style={styles.lottieAnimation} onLayout={() => lottieAnimationRef.current?.play()} />
                            <Text style={styles.lottieSuccessText}>Congratulations!</Text>
                            <Text style={styles.lottieSuccessSubtitle}>Your order has been placed successfully.</Text>
                            <TouchableOpacity style={styles.lottieOkButton} onPress={handlePostOrderSuccessActions} >
                                <Text style={styles.lottieOkButtonText}>OK</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            )}
        </SafeAreaView>
    );
}

// --- Styles ---
// ... (Your existing styles - no changes needed here for Scenario 1)
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: ScreenBackgroundColor },
    scrollView: { flex: 1 },
    scrollContentContainer: { flexGrow: 1, paddingHorizontal: 15, paddingTop: 20, paddingBottom: 120 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: ScreenBackgroundColor },
    loadingText: { marginTop: 15, fontSize: 16, color: TextColorSecondary },
    emptyCartContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30, paddingBottom: 40, backgroundColor: ScreenBackgroundColor },
    emptyCartTitle: { fontSize: 22, fontWeight: '600', color: TextColorPrimary, marginTop: 25, marginBottom: 10, textAlign: 'center' },
    emptyCartSubtitle: { fontSize: 16, color: TextColorSecondary, textAlign: 'center', marginBottom: 30 },
    goShoppingButton: { backgroundColor: AccentColor, paddingVertical: 14, paddingHorizontal: 40, borderRadius: 8, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
    goShoppingButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    sectionContainer: { marginBottom: 25 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: TextColorPrimary, marginBottom: 15, paddingLeft: 5 },
    addressBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: AppBackgroundColor, padding: 15, borderRadius: 10, borderWidth: 1, borderColor: LightBorderColor, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
    addressIcon: { marginRight: 15, marginTop: 2, color: TextColorSecondary },
    addressTextContainer: { flex: 1 },
    addressName: { fontSize: 16, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 6 },
    addressDetail: { fontSize: 14, color: TextColorSecondary, lineHeight: 20, marginBottom: 4 },
    cartListContainer: { backgroundColor: AppBackgroundColor, borderRadius: 10, borderWidth: 1, borderColor: LightBorderColor, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
    cartItem: { flexDirection: 'row', padding: 15, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: LightBorderColor, backgroundColor: AppBackgroundColor },
    lastCartItem: { borderBottomWidth: 0 },
    emptyListText: { padding: 20, textAlign: 'center', color: TextColorSecondary, fontStyle: 'italic' },
    productImage: { width: 65, height: 65, borderRadius: 8, marginRight: 15, backgroundColor: PlaceholderBgColor },
    itemDetails: { flex: 1, justifyContent: 'center' },
    productName: { fontSize: 15, fontWeight: '600', color: TextColorPrimary, marginBottom: 5 },
    itemQuantityPrice: { fontSize: 14, color: TextColorSecondary, marginBottom: 6 },
    itemSubtotal: { fontSize: 14, color: TextColorSecondary, marginTop: 2 },
    itemSubtotalValue: { fontWeight: 'bold', color: TextColorPrimary },
    bnplDetailsContainer: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
    bnplPlanTitle: { fontSize: 13, fontWeight: '600', color: TextColorPrimary, marginBottom: 8 },
    bnplDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    bnplDetailIcon: { marginRight: 8, width: 16, textAlign: 'center', color: BnplPlanIconColor },
    bnplDetailText: { fontSize: 12, color: BnplPlanDetailColor, flexShrink: 1, lineHeight: 16 },
    bnplDetailValue: { fontWeight: '600', color: BnplPlanValueColor },
    summaryBox: { backgroundColor: AppBackgroundColor, padding: 20, borderRadius: 10, borderWidth: 1, borderColor: LightBorderColor, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' },
    summaryText: { fontSize: 15, color: TextColorSecondary },
    summaryValue: { fontSize: 15, fontWeight: '500', color: TextColorPrimary },
    divider: { height: 1, backgroundColor: LightBorderColor, marginVertical: 12 },
    totalText: { fontSize: 17, fontWeight: 'bold', color: TextColorPrimary },
    totalValue: { fontSize: 18, fontWeight: 'bold', color: AccentColor },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 15, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 34 : 20, backgroundColor: AppBackgroundColor, borderTopWidth: 1, borderTopColor: LightBorderColor, alignItems: 'center' },
    paymentProcessingIndicator: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 10, width: '100%' },
    paymentProcessingText: { marginLeft: 10, fontSize: 14, color: TextColorSecondary, fontStyle: 'italic' },
    confirmButton: { backgroundColor: AccentColor, paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 52, shadowColor: AccentColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6 },
    disabledButton: { backgroundColor: '#BDBDBD', elevation: 0, shadowOpacity: 0 },
    confirmButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
    
    // --- Modal Styles ---
    lottieOverlay: { // This is the semi-transparent backdrop for the modal
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)', // Slightly less dim
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20, // Ensures the content container doesn't touch edges
    },
    lottieContentContainer: { // This is the new white box for the Lottie and text
        backgroundColor: AppBackgroundColor, // Should be white
        borderRadius: 15,
        padding: 25,
        alignItems: 'center',
        width: '90%', // Adjust width as needed, e.g., '85%' or a fixed value
        maxWidth: 380, // Maximum width for larger screens
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 10, // For Android shadow
    },
    lottieAnimation: {
        width: 250, // Adjusted size
        height: 250, // Adjusted size
        marginBottom: 15,
    },
    lottieSuccessText: {
        fontSize: 24, // Adjusted font size slightly
        fontWeight: 'bold',
        color: TextColorPrimary, // Changed from #FFFFFF
        textAlign: 'center',
        marginBottom: 8,
    },
    lottieSuccessSubtitle: {
        fontSize: 16, // Adjusted font size slightly
        color: TextColorSecondary, // Changed from #E0E0E0
        textAlign: 'center',
        marginBottom: 25, // Spacing before button
        paddingHorizontal: 10,
        lineHeight: 22,
    },
    lottieOkButton: {
        backgroundColor: AccentColor,
        paddingVertical: 12,
        paddingHorizontal: 55,
        borderRadius: 10,
        elevation: 2, // Subtle elevation for the button
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
    },
    lottieOkButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '600',
    }
});