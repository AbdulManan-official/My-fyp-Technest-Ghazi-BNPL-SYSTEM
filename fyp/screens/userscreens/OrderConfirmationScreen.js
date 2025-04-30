// OrderConfirmationScreen.js (COMPLETE - Integrated First Installment Payment Flow - Verified Fixed Duration Handling - Full Code)

import React, { useState, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
    Alert, ScrollView, ActivityIndicator, StatusBar, Platform,
    SafeAreaView
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { db } from '../../firebaseConfig'; // Adjust path if needed
import {
    doc, serverTimestamp, addDoc, collection, query, where,
    documentId, getDocs, updateDoc, Timestamp, getFirestore, limit,
    setDoc, writeBatch // Import Timestamp and writeBatch
} from 'firebase/firestore';
import axios from 'axios';
import { useStripe } from '@stripe/stripe-react-native'; // Import useStripe

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
const CARTS_COLLECTION = 'Carts';
const ORDERS_COLLECTION = 'orders';
const ADMIN_COLLECTION = 'Admin'; // Verify collection name

// Define statuses that indicate an INCOMPLETE BNPL/Fixed order for the check
// *Includes* statuses for Fixed Duration orders
const INCOMPLETE_BNPL_FIXED_STATUSES = [
    'Partially Paid',
    'Unpaid (Fixed Duration)', // <<< Relevant for Fixed
    'Overdue',
    'Unpaid (BNPL)',
    'Pending First Installment',
    'Mixed (COD/BNPL Pending)',
    'Mixed (COD/Fixed Pending)', // <<< Relevant for Fixed
];
// Define payment methods that trigger the existing order check
// *Includes* Fixed Duration
const BNPL_FIXED_METHODS = ['BNPL', 'Fixed Duration', 'Mixed'];

// --- Payment Related Constants ---
const PAYMENT_API_ENDPOINT = "https://back.txyber.com/create-payment-intent"; // <--- !!! VERIFY/UPDATE THIS URL !!!
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send"; // For Expo push notifications
const CURRENCY_CODE = 'PKR'; // Or your currency code (e.g., 'usd')
const PAID_STATUS = 'Paid';
const PARTIALLY_PAID_STATUS = 'Partially Paid';
const COMPLETED_ORDER_STATUS = 'Delivered'; // Or your final completed status like 'Completed', 'Shipped' etc.

// --- Helper: Fetch Admin Tokens ---
async function getAdminExpoTokens() {
    const tokens = [];
    console.log('[getAdminExpoTokens] Fetching admin push tokens...');
    try {
        const dbInstance = getFirestore(); // Use getFirestore if db isn't initialized globally
        // Query for users with the role 'admin'
        const adminQuery = query(collection(dbInstance, ADMIN_COLLECTION), where('role', '==', 'admin'));
        const adminSnapshot = await getDocs(adminQuery);

        if (adminSnapshot.empty) {
            console.log('[getAdminExpoTokens] No admin users found.');
            return [];
        }

        // Extract user IDs efficiently (adjust if your Admin collection structure differs)
        const adminUserIds = adminSnapshot.docs.map((d) => d.id);

        // Fetch tokens in batches if there are many admins (Firestore 'in' query limit is 30)
        const MAX_IDS_PER_QUERY = 30;
        const tokenPromises = [];

        for (let i = 0; i < adminUserIds.length; i += MAX_IDS_PER_QUERY) {
            const batchIds = adminUserIds.slice(i, i + MAX_IDS_PER_QUERY);
            // Query the same collection again, filtering by the obtained IDs
            // (Assuming expoPushToken is stored directly on the admin user doc)
            const tokensQuery = query(
                collection(dbInstance, ADMIN_COLLECTION), // Query Admin collection
                where(documentId(), 'in', batchIds) // Filter by the IDs found
            );
            tokenPromises.push(getDocs(tokensQuery));
        }

        const snapshots = await Promise.all(tokenPromises);
        snapshots.forEach((tokensSnapshot) => {
            tokensSnapshot.forEach((adminDoc) => {
                const token = adminDoc.data()?.expoPushToken; // Adjust field name if needed
                // Validate the token format
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
        // Decide if you want to propagate the error or return empty array
    }
    return tokens;
}


// --- Helper: Render BNPL/Fixed Details in Item ---
const renderBnplDetailsSection = (item) => {
    const { bnplPlan, quantity, price } = item;
    // Basic validation
    if (!bnplPlan?.id || typeof price !== 'number' || typeof quantity !== 'number' || quantity <= 0) {
        return null; // Don't render if data is invalid/missing
    }
    const name = bnplPlan.name || 'Payment Plan'; // Default name
    const duration = bnplPlan.duration; // e.g., 3 (months)
    const interestRate = bnplPlan.interestRate; // e.g., 0 or 5 (for 5%)
    const planType = bnplPlan.planType || 'N/A'; // e.g., 'Installment', 'Fixed Duration'
    const formattedInterest = interestRate != null ? `${(interestRate).toFixed(1)}%` : 'N/A';
    const isFixed = planType === 'Fixed Duration';
    // Calculate number of installments (only relevant for non-fixed plans)
    const numInstallments = !isFixed && duration ? duration : 1; // Defaults to 1 for Fixed or 0 duration
    // Calculate estimated monthly payment ONLY for standard Installment plans
    let currentMonthlyPayment = null;
    if (!isFixed && duration > 0) {
        const currentTotalPrice = price * quantity;
        // Simple division - doesn't account for complex interest calculations if any
        const monthlyRaw = currentTotalPrice / duration;
        // Format nicely
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
// Calculates due date by adding months to a base date. Returns Firestore Timestamp.
const calculateDueDate = (baseDateInput, monthOffset) => {
    let baseDate;
    // Handle different input types for base date
    if (baseDateInput instanceof Timestamp) { baseDate = baseDateInput.toDate(); } // Convert Firestore Timestamp to JS Date
    else if (baseDateInput instanceof Date) { baseDate = new Date(baseDateInput.getTime()); } // Clone the date to avoid modifying the original
    else { console.warn("[calculateDueDate] Invalid baseDateInput provided, using current date."); baseDate = new Date(); } // Fallback to current date
    // Add month offset if valid
    if (typeof monthOffset === 'number' && monthOffset >= 0) { baseDate.setMonth(baseDate.getMonth() + monthOffset); }
    else if (typeof monthOffset === 'number') { console.warn("[calculateDueDate] Invalid (negative) monthOffset provided:", monthOffset); }
    // Return as Firestore Timestamp
    return Timestamp.fromDate(baseDate);
};


// --- Helper: Generate ALL BNPL Installments (First Due Immediately) ---
// Generates an array of installment objects for a standard BNPL plan (type: Installment).
const generateBnplInstallments = (bnplTotal, bnplPlanDetails, orderTimestampInput) => {
    // Validate input: Ensure it's an 'Installment' type plan with positive duration and total
    if (!bnplPlanDetails || bnplPlanDetails.planType !== 'Installment' || !bnplPlanDetails.duration || bnplPlanDetails.duration <= 0 || bnplTotal <= 0) {
        console.log("[generateBnplInstallments] Conditions not met for installment generation (must be type 'Installment' with duration > 0).", { planType: bnplPlanDetails?.planType, duration: bnplPlanDetails?.duration, bnplTotal });
        return []; // Return empty array if not applicable
    }
    // Determine the starting date for calculating due dates
    let orderDate;
    if (orderTimestampInput instanceof Timestamp) { orderDate = orderTimestampInput.toDate(); }
    else if (orderTimestampInput instanceof Date) { orderDate = new Date(orderTimestampInput.getTime()); } // Clone
    else { console.warn("[generateBnplInstallments] Invalid orderTimestampInput, using current date."); orderDate = new Date(); } // Fallback
    const installments = [];
    const duration = bnplPlanDetails.duration; // Number of months/installments
    const total = Number(bnplTotal); // Ensure total is a number
    // Calculate base amount per installment, rounding to 2 decimal places
    const installmentAmount = Math.round((total / duration) * 100) / 100;
    if (isNaN(installmentAmount) || installmentAmount < 0) {
        console.error("[generateBnplInstallments] Calculated installment amount is invalid:", installmentAmount);
        return []; // Stop if calculation failed
    }
    // Create each installment object
    for (let i = 0; i < duration; i++) {
        // Calculate due date: Use 'i' as the month offset (0 for first, 1 for second, etc.)
        const dueDate = calculateDueDate(orderDate, i); // First installment due immediately (offset 0)
        installments.push({
            installmentNumber: i + 1,
            amount: parseFloat(installmentAmount.toFixed(2)), // Store as number, ensure 2 decimals
            dueDate: dueDate, // Firestore Timestamp
            paid: false, // Initially unpaid
            paidAt: null, // Timestamp when paid
            penalty: 0, // Any penalty applied
            status: 'Pending' // Initial status
        });
    }
    // Adjust the last installment amount to account for rounding differences
    if (installments.length > 0) {
        const totalCalculated = installments.reduce((sum, inst) => sum + inst.amount, 0);
        const difference = Math.round((total - totalCalculated) * 100) / 100; // Difference in cents
        if (difference !== 0) {
            const lastInstallmentIndex = installments.length - 1;
            const adjustedAmount = Math.round((installments[lastInstallmentIndex].amount + difference) * 100) / 100;
            installments[lastInstallmentIndex].amount = Math.max(0, adjustedAmount); // Ensure not negative
        }
    }
    console.log("[ConfirmScreen] Generated BNPL Installments (first due immediately):", JSON.stringify(installments.map(inst => ({...inst, dueDate: inst.dueDate.toDate().toISOString()})), null, 2));
    return installments;
};


// --- START: Payment and Notification Helper Functions (Full Code) ---

// Send Notification to Admins on FULL Order Payment Completion
async function sendAdminPaymentNotification(orderIdentifier, userName, finalPaidAmount, paymentMethod) {
    const adminTokens = await getAdminExpoTokens();
    if (!adminTokens || adminTokens.length === 0) {
        console.log("[AdminPaymentNotify] No admin tokens found. Skipping final completion notification.");
        return;
    }
    const shortOrderId = orderIdentifier.substring(0, 6).toUpperCase(); // Short ID for readability
    const messages = adminTokens.map(token => ({
        to: token, sound: 'default', title: `🎉 Order #${shortOrderId} Fully Paid!`,
        body: `User ${userName || 'N/A'} completed payment for ${paymentMethod} Order #${shortOrderId}. Final payment amount: ${CURRENCY_SYMBOL}${finalPaidAmount?.toLocaleString()}`,
        data: { orderId: orderIdentifier, type: 'order_completed' }, // Add relevant data
        priority: 'high', // Or 'normal'
        channelId: 'admin-notifications' // Optional: For Android notification channels
    }));
    try {
        console.log(`[AdminPaymentNotify] Sending ${messages.length} FINAL completion notifications for order ${orderIdentifier}...`);
        await axios.post(EXPO_PUSH_ENDPOINT, messages, {
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Accept-encoding': 'gzip, deflate' },
            timeout: 10000 // Add a timeout (10 seconds)
        });
        console.log(`[AdminPaymentNotify] Sent FINAL completion notifications for order ${orderIdentifier}.`);
    } catch (error) {
        console.error(`[AdminPaymentNotify] Failed to send FINAL completion notifications for order ${orderIdentifier}:`, error.response?.data || error.message);
    }
}

// Send Notification to Admins when an Installment is Paid
async function sendAdminInstallmentPaidNotification(orderId, userName, installmentNumber, installmentAmount) {
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
            timeout: 10000 // 10 second timeout
        });
        console.log(`[AdminInstallmentNotify] Sent notifications for Order ${orderId}, Inst #${installmentNumber}.`);
    } catch (error) {
        console.error(`[AdminInstallmentNotify] Failed to send notifications for Order ${orderId}, Inst #${installmentNumber}:`, error.response?.data || error.message);
    }
}


/**
 * Updates Firestore after a successful first installment payment directly from Confirmation Screen.
 * Uses a Write Batch for atomicity.
 */
async function updateFirestoreAfterFirstPayment(orderId, paidAmount, firstInstallment, originalOrderData) {
    // --- Input Validation ---
    if (!orderId || !firstInstallment?.installmentNumber || !originalOrderData || paidAmount <= 0) {
        console.error("[Firestore Update Error] Missing required data for first payment update:", { orderId, firstInstallment, originalOrderDataExists: !!originalOrderData, paidAmount });
        Alert.alert( "Order Update Issue", "Payment successful, but critical information was missing to update the order automatically. Please contact support with your Order ID." );
        return; // Stop execution
    }
    const orderRef = doc(db, ORDERS_COLLECTION, orderId);
    const batch = writeBatch(db); // Create a batch operation
    console.log(`[Firestore Update] Starting update for Order ${orderId} after First Installment payment (Amount: ${paidAmount})`);
    try {
        const now = Timestamp.now(); // Consistent timestamp for all updates in this batch
        // --- Prepare Updates Object ---
        let updates = {
            firstInstallmentPaymentPreference: 'Paid Online', // Always record the preference
        };
        // --- Update Installments Array ---
        const currentInstallments = originalOrderData.installments || [];
        let updatedInstallments = [];
        let installmentUpdated = false;
        if (currentInstallments.length > 0 && currentInstallments[0].installmentNumber === firstInstallment.installmentNumber) {
            const updatedFirst = { ...currentInstallments[0], status: PAID_STATUS, paid: true, paidAt: now };
            updatedInstallments = [updatedFirst, ...currentInstallments.slice(1)];
            installmentUpdated = true;
            console.log(`[Firestore Update] Updated first installment (#${firstInstallment.installmentNumber}) directly in array.`);
        } else {
            updatedInstallments = currentInstallments.map(inst => {
                if (inst.installmentNumber === firstInstallment.installmentNumber && !inst.paid) {
                    installmentUpdated = true;
                    console.log(`[Firestore Update] Found and updated installment #${firstInstallment.installmentNumber} by number.`);
                    return { ...inst, status: PAID_STATUS, paid: true, paidAt: now };
                } return inst;
            });
        }
        // Critical Check: Ensure the installment was actually found and updated
        if (!installmentUpdated) {
            console.error(`[Firestore Update Error] CRITICAL: Failed to find or update unpaid installment #${firstInstallment.installmentNumber} for Order ${orderId}. Payment was successful but order data is potentially inconsistent.`);
            Alert.alert( "Order Update Discrepancy", `Payment for installment #${firstInstallment.installmentNumber} successful, but issue marking it paid. Contact support with Order ID ${orderId.substring(0,8)}.` );
            return; // Do NOT proceed with the batch commit
        }
        updates.installments = updatedInstallments; // Add the updated array to the batch updates
        console.log(`[Firestore Update] Marked Inst #${firstInstallment.installmentNumber} as Paid for Order ${orderId}`);
        // --- Check if Order is Now Fully Paid ---
        const allInstallmentsPaid = updatedInstallments.every(i => i.paid === true || i.status?.toLowerCase() === PAID_STATUS.toLowerCase());
        const codIsPending = (originalOrderData.codAmount || 0) > 0 && !originalOrderData.codPaymentReceivedAt;
        const fixedIsPending = (originalOrderData.paymentMethod === 'Fixed Duration' || (originalOrderData.paymentMethod === 'Mixed' && (originalOrderData.fixedAmount || 0) > 0)) && !originalOrderData.paymentReceivedAt; // Adjust logic based on your fixed payment tracking
        let shouldNotifyAdminOrderComplete = false;
        if (allInstallmentsPaid && !codIsPending && !fixedIsPending) {
            console.log(`[Firestore Update] Order ${orderId} is now fully paid.`);
            updates.paymentStatus = PAID_STATUS;
            updates.paymentReceivedAt = now;
            if (originalOrderData.status && originalOrderData.status?.toLowerCase() !== 'cancelled' && originalOrderData.status !== COMPLETED_ORDER_STATUS) {
                updates.status = COMPLETED_ORDER_STATUS;
                console.log(`[Firestore Update] Setting Order ${orderId} status to ${COMPLETED_ORDER_STATUS}.`);
            }
            shouldNotifyAdminOrderComplete = true;
        } else {
            console.log(`[Firestore Update] Order ${orderId} is now ${PARTIALLY_PAID_STATUS}.`);
            updates.paymentStatus = PARTIALLY_PAID_STATUS;
        }
        // --- Commit Batch ---
        console.log(`[Firestore Update] Preparing to commit batch update for Order ${orderId} (First Installment Payment):`, updates);
        batch.update(orderRef, updates);
        await batch.commit();
        console.log(`[Firestore Update] Batch commit successful for Order ${orderId}`);
        // --- Send Notifications (AFTER successful commit) ---
        await sendAdminInstallmentPaidNotification(orderId, originalOrderData.userName || 'user', firstInstallment.installmentNumber, paidAmount);
        if (shouldNotifyAdminOrderComplete) {
            const finalAmountForNotification = paidAmount; // Or originalOrderData.grandTotal
            await sendAdminPaymentNotification(orderId, originalOrderData.userName || 'user', finalAmountForNotification, originalOrderData.paymentMethod);
        }
    } catch (error) {
        console.error(`[Firestore Update Error] Failed during batch commit or notification for Order ${orderId} after first payment:`, error);
        Alert.alert( "Database Update Issue", "Payment successful, but error updating order status. Details should update soon. Contact support if issue persists." );
    }
}


/**
 * Initializes Stripe and attempts payment for the first installment immediately after order confirmation.
 * Handles the entire payment sheet flow and triggers Firestore updates.
 */
async function initializeAndPayFirstInstallment(
    orderId, firstInstallment, currentUserDetails, amountToPay,
    setProcessingPayment, stripe, originalOrderData, navigation
) {
    const paymentAttemptId = `${orderId}-Inst-${firstInstallment?.installmentNumber ?? '1'}-${Date.now()}`;
    console.log(`[Payment Flow] Attempt ${paymentAttemptId} starting...`);
    // --- Input Validation ---
    if (!orderId || !firstInstallment?.installmentNumber || !currentUserDetails?.uid || !amountToPay || amountToPay <= 0 || !stripe?.initPaymentSheet || !stripe?.presentPaymentSheet || !originalOrderData) {
        Alert.alert("Payment Error", "Cannot initiate payment due to missing information. Please try again or contact support.");
        console.error(`[Payment Init Error] Attempt ${paymentAttemptId} - Missing critical data:`, { orderId, firstInstallmentExists: !!firstInstallment, userExists: !!currentUserDetails?.uid, amountToPay, stripeExists: !!stripe, originalOrderDataExists: !!originalOrderData });
        return; // Stop execution
    }
    setProcessingPayment(true); // Show loading indicator
    try {
        console.log(`[Payment] Attempt ${paymentAttemptId}: Initiating FIRST installment payment for Order ${orderId}, Inst #${firstInstallment.installmentNumber}, Amount: ${amountToPay}`);
        // === Step 1: Call Backend to Create Payment Intent ===
        console.log(`[Payment] Attempt ${paymentAttemptId}: Calling backend endpoint: ${PAYMENT_API_ENDPOINT}`);
        const response = await axios.post(PAYMENT_API_ENDPOINT, {
            amount: Math.round(amountToPay * 100), currency: CURRENCY_CODE.toLowerCase(), orderId: orderId, userId: currentUserDetails.uid,
            paymentDescription: `First Installment (#${firstInstallment.installmentNumber}) for Order #${orderId.substring(0, 6)}`,
            customerName: currentUserDetails.name || 'N/A', customerEmail: currentUserDetails.email || undefined,
            metadata: { order_id: orderId, user_id: currentUserDetails.uid, payment_type: 'Installment', installment_number: firstInstallment.installmentNumber.toString(), is_first_installment: 'true' }
        }, { timeout: 15000 });
        console.log(`[Payment] Attempt ${paymentAttemptId}: Backend response received.`);
        const { clientSecret, ephemeralKey, customer, error: backendError } = response.data;
        // Validate backend response
        if (backendError || !clientSecret) { throw new Error(backendError || "Failed to get payment setup details from the server."); }
        console.log(`[Payment] Attempt ${paymentAttemptId}: Payment Intent Client Secret received.`);
        // === Step 2: Initialize Stripe Payment Sheet ===
        console.log(`[Payment] Attempt ${paymentAttemptId}: Initializing Stripe Payment Sheet...`);
        const { error: initError } = await stripe.initPaymentSheet({
            merchantDisplayName: "Txyber", // !!! REPLACE WITH YOUR ACTUAL MERCHANT NAME !!!
            paymentIntentClientSecret: clientSecret, customerId: customer, customerEphemeralKeySecret: ephemeralKey,
            allowsDelayedPaymentMethods: false, style: 'automatic',
        });
        if (initError) { console.error(`[Stripe Init Error] Attempt ${paymentAttemptId}:`, initError); throw new Error(`Payment setup failed: ${initError.localizedMessage || initError.code || initError.message}`); }
        console.log(`[Payment] Attempt ${paymentAttemptId}: Stripe Payment Sheet initialized successfully.`);
        // === Step 3: Present Payment Sheet ===
        console.log(`[Payment] Attempt ${paymentAttemptId}: Presenting Stripe Payment Sheet...`);
        const { error: paymentError } = await stripe.presentPaymentSheet();
        // === Step 4: Handle Payment Result ===
        const orderDocRef = doc(db, ORDERS_COLLECTION, orderId);
        if (paymentError) {
            if (paymentError.code === 'Canceled') {
                console.log(`[Payment] Attempt ${paymentAttemptId}: Payment canceled by user for Order ${orderId}.`);
                Alert.alert("Payment Canceled", "Payment process canceled. Pay later from order details.");
                 try { await updateDoc(orderDocRef, { firstInstallmentPaymentPreference: 'Pay Now Online - Canceled' }); } catch (updateError) {console.error(`Attempt ${paymentAttemptId}: Failed preference update after cancellation:`, updateError);}
            } else {
                console.error(`[Stripe Payment Error] Attempt ${paymentAttemptId}:`, paymentError);
                 try { await updateDoc(orderDocRef, { firstInstallmentPaymentPreference: 'Pay Now Online - Failed' }); } catch (updateError) {console.error(`Attempt ${paymentAttemptId}: Failed preference update after payment error:`, updateError);}
                throw new Error(`Payment failed: ${paymentError.localizedMessage || paymentError.code || paymentError.message}`);
            }
        } else {
            // --- Payment Successful ---
            console.log(`[Payment] Attempt ${paymentAttemptId}: First installment payment SUCCESSFUL for Order ${orderId}. Updating Firestore...`);
            Alert.alert("Payment Successful!", "Your first installment has been paid.");
            // === Step 5: Update Firestore ===
            await updateFirestoreAfterFirstPayment( orderId, amountToPay, firstInstallment, originalOrderData );
        }
    } catch (error) {
        // Catch errors from backend call, Stripe init/present, or Firestore trigger
        console.error(`[Payment Flow Error] Attempt ${paymentAttemptId}, Order ${orderId}:`, error);
        Alert.alert( "Payment Process Error", error.message || "Unexpected error during payment. Check order details or contact support." );
        // Defensive preference update on failure
         try { await updateDoc(doc(db, ORDERS_COLLECTION, orderId), { firstInstallmentPaymentPreference: 'Pay Now Online - Failed' }); }
         catch (updateError) {console.error(`Attempt ${paymentAttemptId}: Failed preference update after general payment flow error:`, updateError);}
    } finally {
        // === Step 6: Cleanup and Navigation ===
        setProcessingPayment(false); // Stop loading indicator
        console.log(`[Payment Flow] Attempt ${paymentAttemptId}: Finished for Order ${orderId}. Navigating home.`);
        // Navigate away AFTER the entire process attempts
        if (navigation && typeof navigation.popToTop === 'function') { navigation.popToTop(); }
        else { console.warn(`[Payment Flow] Attempt ${paymentAttemptId}: Navigation object or popToTop function not available.`); }
    }
}

// --- END: Payment and Notification Helper Functions ---


// --- Main Component ---
export default function OrderConfirmationScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { currentUserDetails = null, cartItems = [], subTotal = 0, grandTotal = 0 } = route.params || {};

    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const { initPaymentSheet, presentPaymentSheet, loading: stripeLoadingHook } = useStripe();
    const [isProcessingFirstPayment, setIsProcessingFirstPayment] = useState(false);

    const totalItemCount = useMemo(() => {
        if (!Array.isArray(cartItems)) return 0;
        return cartItems.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);
    }, [cartItems]);

    const isCartEmpty = !cartItems || cartItems.length === 0 || totalItemCount === 0;

    // --- Render Confirmation Item ---
    const renderConfirmationItem = useCallback(({ item, index }) => {
        if (!item?.id || typeof item.price !== 'number' || typeof item.quantity !== 'number' || item.quantity <= 0) { console.warn("Skipping rendering invalid cart item:", item); return null; }
        const itemTotalPrice = item.price * item.quantity;
        const isLastItem = index === cartItems.length - 1;
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
    }, [cartItems]);


    // --- Handle Confirm & Place Order (Handles BNPL Installment Prompt & Fixed Duration correctly) ---
    const handleConfirmAndPlaceOrder = useCallback(async () => {
        // Prevent double taps
        if (isPlacingOrder || isProcessingFirstPayment) { console.log("Ignoring tap: Action already in progress."); return; }
        // Initial Checks
        if (!currentUserDetails?.uid) { Alert.alert('Authentication Error', 'User details are missing.'); return; }
        if (!Array.isArray(cartItems) || cartItems.length === 0) { Alert.alert('Empty Cart', 'Your shopping cart is empty.'); return; }
        const validCartItems = cartItems.filter(item => item?.id && typeof item.quantity === 'number' && item.quantity > 0 && typeof item.price === 'number' && item.price >= 0);
        if (validCartItems.length === 0) { Alert.alert('Invalid Cart', 'No valid items found.'); return; }

        const currentCartItems = validCartItems;
        const currentSubTotal = currentCartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const currentGrandTotal = grandTotal; // Assuming passed grandTotal is correct

        setIsPlacingOrder(true); // Start initial loading
        const userId = currentUserDetails.uid;
        let newOrderId = null;
        const firestoreWriteTimestamp = serverTimestamp();
        const jsOrderPlacementDate = new Date();
        let orderDetailsToSave = {};
        let isBnplInstallmentOrder = false; // Flag for immediate payment prompt

        try {
            // === Check for Existing Incomplete BNPL/Fixed Orders ===
            // This check triggers if the *new* order contains BNPL or Fixed items.
            const newOrderHasBnplOrFixed = currentCartItems.some(item => item?.paymentMethod === 'BNPL' || item?.paymentMethod === 'Fixed Duration');
            if (newOrderHasBnplOrFixed) {
                console.log(`[ConfirmScreen] Checking existing incomplete orders for user ${userId}...`);
                const ordersRef = collection(db, ORDERS_COLLECTION);
                // Query looks for *any* existing order that is BNPL/Fixed/Mixed
                // AND has an incomplete status (including Fixed statuses).
                const qExisting = query(
                    ordersRef,
                    where('userId', '==', userId),
                    where('paymentMethod', 'in', BNPL_FIXED_METHODS), // Checks BNPL, Fixed Duration, Mixed
                    where('paymentStatus', 'in', INCOMPLETE_BNPL_FIXED_STATUSES), // Checks all relevant incomplete statuses
                    limit(1)
                );
                try {
                    const existingIncompleteSnapshot = await getDocs(qExisting);
                    if (!existingIncompleteSnapshot.empty) {
                        const existingOrder = existingIncompleteSnapshot.docs[0].data();
                        const existingOrderId = existingIncompleteSnapshot.docs[0].id;
                        console.warn(`[ConfirmScreen] Blocking order: User ${userId} has incomplete order ${existingOrderId} (Method: ${existingOrder.paymentMethod}, Status: ${existingOrder.paymentStatus}).`);
                        Alert.alert(
                            'Order Restriction',
                            'You have an existing payment plan (BNPL or Fixed Duration) that is not yet fully paid. Please settle current payments before placing a new order with a payment plan.',
                            [{ text: 'OK' }]
                        );
                        setIsPlacingOrder(false); return; // STOP order placement
                    } else {
                        console.log("[ConfirmScreen] No blocking incomplete BNPL/Fixed orders found.");
                    }
                } catch (queryError) {
                    console.error("[ConfirmScreen] Error querying existing orders:", queryError);
                    if (queryError.code === 'failed-precondition') { Alert.alert('Server Busy', 'Checking payment history failed due to server index setup. Please try again shortly.'); }
                    else { Alert.alert('Verification Error', 'Could not verify payment history. Please check your connection and try again.'); }
                    setIsPlacingOrder(false); return; // STOP on query error
                }
            } else {
                 console.log("[ConfirmScreen] New order is COD/Prepaid only. Skipping existing order check.");
            }
            // === End Existing Order Check ===

            // === Determine Order Characteristics & Prepare Data ===
            console.log("[ConfirmScreen] Preparing order data...");
            const codItems = currentCartItems.filter(item => item?.paymentMethod === 'COD');
            const bnplItems = currentCartItems.filter(item => item?.paymentMethod === 'BNPL' && item.bnplPlan?.planType === 'Installment'); // Filter specifically for Installment type BNPL
            // Fixed items might have method 'Fixed Duration' OR 'BNPL' but planType 'Fixed Duration'
            const fixedItems = currentCartItems.filter(item => item.bnplPlan?.planType === 'Fixed Duration' && (item?.paymentMethod === 'Fixed Duration' || item?.paymentMethod === 'BNPL'));

            const bnplSubTotal = bnplItems.reduce((sum, item) => sum + ((item?.price || 0) * (item?.quantity || 0)), 0);
            const fixedSubTotal = fixedItems.reduce((sum, item) => sum + ((item?.price || 0) * (item?.quantity || 0)), 0);
            const codSubTotal = codItems.reduce((sum, item) => sum + ((item?.price || 0) * (item?.quantity || 0)), 0);

            const relevantItemForPlan = bnplItems[0] || fixedItems[0]; // Get plan from BNPL or Fixed item
            const relevantBnplPlan = relevantItemForPlan?.bnplPlan || null;
            const planType = relevantBnplPlan?.planType;

            let overallPaymentMethod = 'Unknown';
            let overallPaymentStatus = 'Pending';
            let orderSpecificData = {};
            let fullInstallmentSchedule = [];

            // Determine overall Payment Method
            const hasBnpl = bnplItems.length > 0;
            const hasFixed = fixedItems.length > 0;
            const hasCod = codItems.length > 0;

            if ((hasBnpl || hasFixed) && hasCod) { overallPaymentMethod = 'Mixed'; }
            else if (hasBnpl) { overallPaymentMethod = 'BNPL'; }
            else if (hasFixed) { overallPaymentMethod = 'Fixed Duration'; }
            else if (hasCod) { overallPaymentMethod = 'COD'; }
            else { overallPaymentMethod = 'Prepaid'; overallPaymentStatus = 'Paid'; } // Assuming non-COD/BNPL/Fixed is prepaid and paid upfront

            console.log(`[ConfirmScreen] Determined Payment Method: ${overallPaymentMethod}`);

            // Set status and specific data based on determined method
            isBnplInstallmentOrder = false; // Default to false

            // Case 1: BNPL Installments (Pure or Mixed with COD)
            if (overallPaymentMethod === 'BNPL' || (overallPaymentMethod === 'Mixed' && hasBnpl)) {
                if (relevantBnplPlan && planType === 'Installment' && relevantBnplPlan.duration > 0 && bnplSubTotal > 0) {
                    console.log("[ConfirmScreen] Processing BNPL Installment order part.");
                    fullInstallmentSchedule = generateBnplInstallments(bnplSubTotal, relevantBnplPlan, jsOrderPlacementDate);
                    if (fullInstallmentSchedule.length > 0) {
                        isBnplInstallmentOrder = true; // Needs payment prompt
                        overallPaymentStatus = overallPaymentMethod === 'Mixed' ? 'Mixed (COD/BNPL Pending)' : 'Pending First Installment';
                        orderSpecificData = {
                            paymentStatus: overallPaymentStatus, installments: fullInstallmentSchedule,
                            bnplPlanDetails: { id: relevantBnplPlan.id, name: relevantBnplPlan.name, duration: relevantBnplPlan.duration, interestRate: relevantBnplPlan.interestRate, planType: relevantBnplPlan.planType }
                        };
                    } else { console.error("[ConfirmScreen] Failed to generate installments."); overallPaymentStatus = 'Pending Review (Installment Error)'; }
                } else { console.warn("[ConfirmScreen] Invalid BNPL Installment plan data."); overallPaymentStatus = 'Pending Review (Invalid Plan Data)'; }
            }
            // Case 2: Fixed Duration (Pure or Mixed with COD)
            else if (overallPaymentMethod === 'Fixed Duration' || (overallPaymentMethod === 'Mixed' && hasFixed)) {
                if (relevantBnplPlan && planType === 'Fixed Duration') {
                    console.log("[ConfirmScreen] Processing Fixed Duration order part.");
                    const fixedDueDate = calculateDueDate(jsOrderPlacementDate, relevantBnplPlan.duration);
                    overallPaymentStatus = overallPaymentMethod === 'Mixed' ? 'Mixed (COD/Fixed Pending)' : 'Unpaid (Fixed Duration)';
                    orderSpecificData = {
                        paymentStatus: overallPaymentStatus,
                        fixedDurationDetails: { id: relevantBnplPlan.id, name: relevantBnplPlan.name, duration: relevantBnplPlan.duration, interestRate: relevantBnplPlan.interestRate, planType: relevantBnplPlan.planType },
                        paymentDueDate: fixedDueDate, // Due date for the single fixed payment
                        fixedDurationAmountDue: fixedSubTotal, // The total amount due for fixed items
                        penalty: 0 // Initialize penalty
                    };
                    isBnplInstallmentOrder = false; // NO immediate payment prompt for Fixed Duration
                } else { console.error("[ConfirmScreen] Fixed Duration method but plan details missing/invalid."); overallPaymentStatus = 'Pending Review (Missing Fixed Plan)'; isBnplInstallmentOrder = false; }
            }
            // Case 3: Pure COD
            else if (overallPaymentMethod === 'COD') {
                console.log("[ConfirmScreen] Processing COD order part.");
                overallPaymentStatus = 'Unpaid (COD)';
                orderSpecificData = { paymentStatus: overallPaymentStatus };
                isBnplInstallmentOrder = false;
            }
            // Case 4: Other (e.g., Prepaid)
            else {
                 console.log("[ConfirmScreen] Processing Other/Prepaid order part.");
                 // Assuming prepaid orders are marked as paid immediately (adjust if external payment happens elsewhere)
                 orderSpecificData = { paymentStatus: overallPaymentStatus };
                 isBnplInstallmentOrder = false;
            }

            // Set initial preference (null unless BNPL Installment requires choice)
            let firstInstallmentPref = isBnplInstallmentOrder ? 'Pending Choice' : null;

            // === Build the Final Order Object to Save ===
             orderDetailsToSave = {
                userId: userId, userName: currentUserDetails.name || 'N/A', userAddress: currentUserDetails.address || 'N/A', userPhone: currentUserDetails.phone || 'N/A', userEmail: currentUserDetails.email || null,
                items: currentCartItems.map(item => ({ // Store item details accurately
                    id: item.id, name: item.name, price: item.price, quantity: item.quantity, image: item.image || null,
                    paymentMethod: item.paymentMethod, // Item's specific method
                    ...(item.bnplPlan && { // Store plan details if item used BNPL/Fixed
                        bnplPlan: { id: item.bnplPlan.id, name: item.bnplPlan.name, duration: item.bnplPlan.duration, interestRate: item.bnplPlan.interestRate, planType: item.bnplPlan.planType }
                    })
                })),
                subtotal: currentSubTotal, grandTotal: currentGrandTotal,
                codAmount: codSubTotal, // Store COD amount
                bnplAmount: bnplSubTotal, // Store BNPL Installment amount
                // fixedDurationAmount is captured in fixedSubTotal calculation above.
                // Specific details like due date and amount are in orderSpecificData for Fixed orders
                createdAt: firestoreWriteTimestamp, orderDate: jsOrderPlacementDate, // Use JS Date for easier calculations
                status: 'Pending', // Initial fulfillment status (e.g., processing, pending shipment)
                paymentMethod: overallPaymentMethod,
                // Spread specific data: paymentStatus, installments OR fixedDurationDetails, paymentDueDate, fixedDurationAmountDue, penalty
                ...orderSpecificData,
                // Add preference field ONLY for BNPL Installment orders needing a choice
                ...(isBnplInstallmentOrder && { firstInstallmentPaymentPreference: firstInstallmentPref })
            };

            // Final validation before saving
            if (!orderDetailsToSave.items || orderDetailsToSave.items.length === 0) { throw new Error("Order contains no valid items."); }
            if (!orderDetailsToSave.paymentMethod || orderDetailsToSave.paymentMethod === 'Unknown') { throw new Error("Could not determine valid payment method."); }

            console.log("[ConfirmScreen] Final Order Object Prepared:", JSON.stringify(orderDetailsToSave, (key, value) => key === 'createdAt' ? 'SERVER_TIMESTAMP' : value, 2)); // Avoid logging huge timestamp object

            // === Step 1: Save Order to Firestore ===
            console.log('[ConfirmScreen] Saving order to Firestore...');
            const orderCollectionRef = collection(db, ORDERS_COLLECTION);
            const docRef = await addDoc(orderCollectionRef, orderDetailsToSave);
            newOrderId = docRef.id;
            if (!newOrderId) { throw new Error('Failed to get Order ID after saving.'); }
            console.log('[ConfirmScreen] Order successfully saved with ID:', newOrderId);

            // === Step 2: Clear User's Cart ===
            try {
                console.log(`[ConfirmScreen] Clearing cart for user ${userId}.`);
                const cartDocRef = doc(db, CARTS_COLLECTION, userId);
                await updateDoc(cartDocRef, { items: [], lastUpdated: serverTimestamp() });
                console.log(`[ConfirmScreen] Cart cleared successfully.`);
            } catch (cartError) {
                 console.error(`[ConfirmScreen] CRITICAL ERROR: Failed to clear cart for user ${userId} after order ${newOrderId}:`, cartError);
                 // Non-fatal for the order itself, but needs monitoring
                 Alert.alert("Cart Clear Issue", "Order placed, but failed to clear cart. Please manually remove items or contact support.");
            }

            // === Step 3: Send Initial Admin Notification ===
            getAdminExpoTokens().then(adminTokens => {
                if (adminTokens && adminTokens.length > 0) {
                    const shortOrderId = newOrderId.substring(0, 6).toUpperCase();
                    const messages = adminTokens.map(token => ({
                        to: token, sound: 'default', title: `🛒 New Order! (#${shortOrderId})`,
                        body: `User ${orderDetailsToSave.userName} placed a ${orderDetailsToSave.paymentMethod} order (#${shortOrderId}). Total: ${CURRENCY_SYMBOL}${orderDetailsToSave.grandTotal.toLocaleString()}`,
                        data: { orderId: newOrderId, type: 'new_order' }, priority: 'high', channelId: 'admin-notifications' }));
                    console.log(`[ConfirmScreen] Sending ${messages.length} NEW ORDER notifications...`);
                    axios.post(EXPO_PUSH_ENDPOINT, messages, { headers: { 'Content-Type': 'application/json' }, timeout: 10000 })
                        .then(() => console.log(`[ConfirmScreen] New order notifications sent.`))
                        .catch(notifyError => console.error(`[ConfirmScreen] Notification send error:`, notifyError.response?.data || notifyError.message));
                } else { console.log("[ConfirmScreen] No admin tokens for notification."); }
            }).catch(tokenError => console.error("[ConfirmScreen] Error fetching admin tokens:", tokenError));

            // === Step 4: Handle Post-Order Action (Payment Prompt or Simple Success) ===
            setIsPlacingOrder(false); // Done placing order

            // Show payment prompt ONLY for BNPL Installment Orders that have installments generated
            if (isBnplInstallmentOrder && orderDetailsToSave.installments && orderDetailsToSave.installments.length > 0) {
                const firstInstallment = orderDetailsToSave.installments[0];
                const amountToPay = (firstInstallment.amount || 0) + (firstInstallment.penalty || 0);
                if (amountToPay <= 0) {
                     console.warn(`[ConfirmScreen] First installment amount zero or less for ${newOrderId}. Skipping payment prompt.`);
                     Alert.alert('Order Placed Successfully!', `Order (#${newOrderId.substring(0, 8)}) confirmed. Installment details available in order history.`, [{ text: 'OK', onPress: () => navigation.popToTop() }], { cancelable: false });
                } else {
                    Alert.alert( 'Order Placed & First Installment Due', `Order (#${newOrderId.substring(0, 8)}) confirmed.\n\nFirst installment: ${CURRENCY_SYMBOL}${amountToPay.toFixed(2)}. Pay online now?`,
                        [
                            { text: 'Pay Now Online', onPress: async () => {
                                    if (isProcessingFirstPayment || stripeLoadingHook) { Alert.alert("Please Wait", "Payment process initializing..."); return; }
                                    console.log(`[ConfirmScreen] User chose 'Pay Now Online' for order ${newOrderId}.`);
                                    // Pass the full orderDetailsToSave, as it contains the latest generated installments array
                                    await initializeAndPayFirstInstallment( newOrderId, firstInstallment, currentUserDetails, amountToPay, setIsProcessingFirstPayment, { initPaymentSheet, presentPaymentSheet }, orderDetailsToSave, navigation );
                            } },
                            { text: 'Pay at Delivery', onPress: async () => {
                                    console.log(`[ConfirmScreen] User chose 'Pay at Delivery' for order ${newOrderId}.`);
                                    try { await updateDoc(doc(db, ORDERS_COLLECTION, newOrderId), { firstInstallmentPaymentPreference: 'Pay at Delivery' }); console.log(`[ConfirmScreen] Preference updated for ${newOrderId}.`); Alert.alert("Preference Saved", "You'll pay the first installment upon delivery.");}
                                    catch (updateError) { console.error(`Error updating preference:`, updateError); Alert.alert("Error", "Could not save preference."); }
                                    finally { navigation.popToTop(); }
                            } }
                        ], { cancelable: false }
                    );
                }
            } else {
                // For Fixed Duration, COD, Prepaid - Show simple success message
                console.log(`[ConfirmScreen] Order ${newOrderId} (Type: ${overallPaymentMethod}) placed. No immediate prompt needed.`);
                Alert.alert( 'Order Placed Successfully!', `Your Order (#${newOrderId.substring(0, 8)}) has been confirmed. Check order history for details.`,
                    [{ text: 'OK', onPress: () => navigation.popToTop() }], { cancelable: false }
                );
            }

        } catch (error) { // Catch errors during the entire placement process
             console.error('[ConfirmScreen] CRITICAL ERROR during order placement:', error);
             setIsPlacingOrder(false); setIsProcessingFirstPayment(false); // Reset both loaders
             let errorMsg = 'Could not place order. Please try again.';
             if (error.code === 'permission-denied') errorMsg = 'Authentication Error. Please log in again and retry.';
             else if (error.code === 'failed-precondition' || error.message?.includes('index required')) errorMsg = 'Server busy processing history. Please try again in a moment.';
             else if (error.message) errorMsg = `Failed: ${error.message}`;
             Alert.alert('Order Placement Failed', errorMsg);
             // Potentially clean up if order was partially created but failed later? (Complex)
             // if (newOrderId) { console.warn(`Order ${newOrderId} might be in an inconsistent state.`); }
        }
    }, [ // Dependencies
        currentUserDetails, cartItems, subTotal, grandTotal, navigation,
        isPlacingOrder, isProcessingFirstPayment, stripeLoadingHook, initPaymentSheet, presentPaymentSheet
    ]);

    // --- Render Logic ---
    if (!currentUserDetails) { return (<SafeAreaView style={styles.safeArea}><View style={styles.loadingContainer}><ActivityIndicator size="large" color={AccentColor} /><Text style={styles.loadingText}>Loading User Details...</Text></View></SafeAreaView>); }
    if (isCartEmpty) { return ( <SafeAreaView style={styles.safeArea}><StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} /><View style={styles.emptyCartContainer}><Icon name="remove-shopping-cart" size={60} color={TextColorSecondary} /><Text style={styles.emptyCartTitle}>Your Cart is Empty</Text><Text style={styles.emptyCartSubtitle}>Add items to place an order.</Text><TouchableOpacity style={styles.goShoppingButton} onPress={() => navigation.navigate('Home')}><Text style={styles.goShoppingButtonText}>Start Shopping</Text></TouchableOpacity></View></SafeAreaView> ); }

    // --- Main Confirmation Screen Render ---
    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContentContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Delivery Address */}
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
                {/* Order Items */}
                <View style={styles.sectionContainer}>
                     <Text style={styles.sectionTitle}>Order Items ({totalItemCount})</Text>
                     <View style={styles.cartListContainer}>
                         <FlatList data={cartItems} keyExtractor={(item, index) => item.cartItemId || item.id?.toString() || `confirm-${index}`} renderItem={renderConfirmationItem} scrollEnabled={false} ListEmptyComponent={<Text style={styles.emptyListText}>No items found in cart data.</Text>} />
                     </View>
                </View>
                {/* Order Summary */}
                <View style={styles.sectionContainer}>
                     <Text style={styles.sectionTitle}>Order Summary</Text>
                     <View style={styles.summaryBox}>
                         <View style={styles.summaryRow}><Text style={styles.summaryText}>Subtotal:</Text><Text style={styles.summaryValue}>{`${CURRENCY_SYMBOL} ${subTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}</Text></View>
                         <View style={styles.summaryRow}><Text style={styles.summaryText}>Total Items:</Text><Text style={styles.summaryValue}>{totalItemCount}</Text></View>
                         {/* Add Delivery Fee / Discounts here if applicable */}
                         <View style={styles.divider} />
                         <View style={styles.summaryRow}><Text style={styles.totalText}>Grand Total:</Text><Text style={styles.totalValue}>{`${CURRENCY_SYMBOL} ${grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}</Text></View>
                     </View>
                </View>
                <View style={{ height: 20 }} />{/* Bottom Spacer */}
            </ScrollView>
            {/* Footer Area: Button and Payment Indicator */}
            <View style={styles.footer}>
                 {isProcessingFirstPayment && ( <View style={styles.paymentProcessingIndicator}><ActivityIndicator size="small" color={AccentColor} /><Text style={styles.paymentProcessingText}>Processing Payment...</Text></View> )}
                <TouchableOpacity style={[ styles.confirmButton, (isPlacingOrder || isCartEmpty || isProcessingFirstPayment) && styles.disabledButton ]} onPress={handleConfirmAndPlaceOrder} disabled={isPlacingOrder || isCartEmpty || isProcessingFirstPayment} activeOpacity={0.7}>
                    {isPlacingOrder ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.confirmButtonText}>Confirm & Place Order</Text> }
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: ScreenBackgroundColor },
    scrollView: { flex: 1 },
    scrollContentContainer: { flexGrow: 1, paddingHorizontal: 15, paddingTop: 20, paddingBottom: 120 }, // Increased paddingBottom for footer
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
});