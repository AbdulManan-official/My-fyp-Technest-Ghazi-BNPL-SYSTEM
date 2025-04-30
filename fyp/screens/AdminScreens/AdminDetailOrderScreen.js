// AdminDetailOrderScreen.js (Complete Code - Final Version - Includes All Functionality - Verified Full - Updated Fixed Duration Amount Display)

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
    getFirestore, doc, updateDoc, onSnapshot, Timestamp, // Ensure Timestamp is imported
    serverTimestamp, getDoc, collection, writeBatch
    // deleteField // Optional: Uncomment if you want to delete OTP after delivery/verification
} from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Verify path
import axios from 'axios';
import { format, isValid } from 'date-fns';

// --- Constants ---
const AppBackgroundColor = '#FFFFFF';
const ScreenBackgroundColor = '#F8F9FA';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const AccentColor = '#FF0000'; // Red for primary actions, focus border
const SuccessColor = '#4CAF50'; // Green for success/verification
const LightBorderColor = '#BDBDBD'; // Default outline color
const FocusedBorderColor = AccentColor; // Focus outline color
const PlaceholderBgColor = '#F0F0F0';
const CURRENCY_SYMBOL = 'PKR';
const placeholderImagePath = require('../../assets/p3.jpg'); // Verify path
const ORDERS_COLLECTION = 'orders';
const USERS_COLLECTION = 'Users'; // Make sure this matches your Firestore collection name for users
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const SHIPPED_STATUS = 'Shipped';
const DELIVERED_STATUS = 'Delivered';
const PAID_STATUS = 'Paid'; // Used for overall paymentStatus AND installment status
const ACTIVE_STATUS = 'Active'; // Used for overall order status after 1st installment paid OR Fixed Duration delivered
const PENDING_STATUS = 'Pending'; // Used for installment status (default)
const PARTIALLY_PAID_STATUS = 'Partially Paid'; // For Mixed orders after COD paid, or BNPL after 1st paid
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
    // Check if conversion was successful and the resulting date is valid
    if (dateToFormat && isValid(dateToFormat)) {
        try {
            // Format: e.g., Jan 1, 2023, 5:30 PM
            return format(dateToFormat, 'MMM d, yyyy, h:mm a');
        } catch (e) {
            console.error("Error formatting date:", e);
            return 'Invalid Date';
        }
    }
    return 'N/A'; // Return N/A if input is null, undefined, or invalid
};

// --- Helper Function: Format Date (Short Date Only) ---
const formatShortDate = (timestamp) => {
    let dateToFormat = null;
    if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); }
    else if (timestamp instanceof Date) { dateToFormat = timestamp; }
    // Check if conversion was successful and the resulting date is valid
    if (dateToFormat && isValid(dateToFormat)) {
        try {
            // Format: e.g., Jan 1, 2023
            return format(dateToFormat, 'MMM d, yyyy');
        } catch (e) {
            console.error("Error formatting short date:", e);
            return 'Invalid Date';
        }
    }
    return 'N/A'; // Return N/A if input is null, undefined, or invalid
};


// --- Helper Function: Get Status Badge Style ---
const getStatusStyle = (status) => {
    const lowerStatus = status?.toLowerCase() || 'unknown';
    switch (lowerStatus) {
        case 'pending':
        case 'unpaid (cod)':
        case 'unpaid (fixed duration)':
        case 'unpaid (bnpl)':
        case 'pending first installment': // Explicitly handle pending first installment
        case 'mixed (cod/bnpl pending)':
        case 'mixed (cod/fixed pending)':
            return styles.statusPending; // Orange for pending/unpaid states
        case 'processing':
        case PARTIALLY_PAID_STATUS.toLowerCase(): // Partially Paid uses Processing style
            return styles.statusProcessing; // Blue for processing/partially paid
        case 'shipped':
            return styles.statusShipped; // Light Green for shipped
        case 'delivered':
            return styles.statusDelivered; // Grey for delivered (final physical state)
        case 'active':
            return styles.statusActive; // Bright Blue for Active (BNPL/Fixed after delivery)
        case 'cancelled':
        case 'rejected':
            return styles.statusCancelled; // Red for cancelled/rejected
        case PAID_STATUS.toLowerCase(): // Explicitly handle Paid status if used as overall status
             return styles.statusFullyPaid; // Dark Green for fully paid
        default:
            return styles.statusUnknown; // Grey for unknown/default
    }
};
const getInstallmentStatusStyle = (status) => {
    return (status?.toLowerCase() === PAID_STATUS.toLowerCase()) ? styles.statusPaid : styles.statusInstallmentPending;
};


// --- Helper Function: Fetch User's Expo Push Token ---
async function getUserExpoToken(userId) {
    if (!userId) {
        console.error("[getUserExpoToken] userId missing.");
        return null;
    }
    try {
        const userDocRef = doc(db, USERS_COLLECTION, userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const token = userDocSnap.data()?.expoPushToken; // Ensure field name matches your User schema
            // Validate token format
            if (token && typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))) {
                 return token;
            } else if (token) {
                 // Log if token exists but format is wrong
                 console.log(`[getUserExpoToken] Invalid or missing Expo push token format found for user ${userId}. Token:`, token);
                 return null;
            } else {
                 // Log if token field is missing entirely
                 console.log(`[getUserExpoToken] Expo push token field not found for user ${userId}.`);
                 return null;
            }
        } else {
            console.log(`[getUserExpoToken] User document not found for ID: ${userId}`);
            return null;
        }
    } catch (error) {
        console.error(`[getUserExpoToken] Error fetching token for user ${userId}:`, error);
        return null;
    }
}

// --- Main Component: AdminDetailOrderScreen ---
export default function AdminDetailOrderScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const initialOrder = route.params?.order;
    const orderId = initialOrder?.id;

    // --- State Variables ---
    const [currentOrderData, setCurrentOrderData] = useState(initialOrder);
    const [loading, setLoading] = useState(!initialOrder); // Start loading if no initial order passed
    const [error, setError] = useState(null);
    // Delivery OTP State
    const [isProcessingShip, setIsProcessingShip] = useState(false); // Loading for "Ship" button
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false); // Loading for "Verify OTP" button
    const [enteredOtp, setEnteredOtp] = useState('');
    const [otpError, setOtpError] = useState(''); // Error message specific to OTP input

    // --- Effect: Setup Real-time Listener ---
    useEffect(() => {
        // Ensure orderId is valid before setting up listener
        if (!orderId) {
            setError("Order ID not found in navigation parameters.");
            setLoading(false);
            setCurrentOrderData(null);
            return; // Stop effect if no ID
        }

        setError(null); // Clear previous errors
        setLoading(true); // Set loading true while listener attaches/fetches initial data

        const orderRef = doc(db, ORDERS_COLLECTION, orderId);

        const unsubscribe = onSnapshot(orderRef,
            (docSnap) => {
                if (docSnap.exists()) {
                    const newData = { id: docSnap.id, ...docSnap.data() };
                    console.log("Received order update:", newData.status, newData.paymentStatus); // Log updates
                    setCurrentOrderData(newData);
                    // Clear entered OTP if status is no longer 'Shipped' (e.g., if cancelled after shipping)
                    if (newData.status !== SHIPPED_STATUS) {
                        setEnteredOtp('');
                        setOtpError('');
                    }
                    setError(null); // Clear error on successful fetch/update
                } else {
                    console.warn(`Order document with ID ${orderId} does not exist.`);
                    setError("Order data not found. It might have been deleted.");
                    setCurrentOrderData(null); // Clear data if doc doesn't exist
                }
                setLoading(false); // Stop loading after data processed
            },
            (err) => {
                // Handle errors during listening (e.g., permission denied)
                setError("Failed to load real-time order details. Check permissions or connection.");
                setLoading(false); // Stop loading on error
                console.error(`Firestore listener error for order ${orderId}:`, err);
            }
        );

        // Cleanup function: Unsubscribe from the listener when the component unmounts
        // or when orderId changes (though orderId shouldn't change in this screen)
        return () => {
            console.log(`Unsubscribing from listener for order ${orderId}`);
            unsubscribe();
        };
    }, [orderId]); // Dependency array includes orderId


    // --- Function to Send Shipping Notification ---
    const sendShippingNotification = async (userId, orderIdentifier, generatedOtp) => {
        if (!userId || !orderIdentifier || !generatedOtp) {
             console.error("Missing data for shipping notification.", { userId, orderIdentifier, generatedOtp });
             return; // Prevent sending incomplete notification
        }
        const shortOrderId = orderIdentifier.substring(0, 6).toUpperCase();
        console.log(`Attempting shipping notification for user ${userId}, order #${shortOrderId}`);
        const userToken = await getUserExpoToken(userId);

        if (userToken) {
            const message = {
                to: userToken,
                sound: 'default',
                title: '🚚 Your Order Has Shipped!',
                body: `Order #${shortOrderId} is on its way! Your Delivery OTP is: ${generatedOtp}. Please provide this code to the delivery rider upon arrival.`,
                data: { orderId: orderId, type: 'shipping_update' }, // Include data payload for potential in-app navigation
                priority: 'high', // Ensure timely delivery
                channelId: 'order-updates' // Optional: Android Notification Channel
            };
            try {
                await axios.post(EXPO_PUSH_ENDPOINT, [message], {
                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Accept-encoding': 'gzip, deflate' },
                    timeout: 10000 // 10 second timeout
                });
                console.log(`Shipping notification sent successfully for user ${userId}, order #${shortOrderId}.`);
            } catch (error) {
                console.error(`Failed to send shipping notification to user ${userId}, order #${shortOrderId}:`, error.response?.data || error.message || error);
            }
        } else {
            console.log(`No valid push token found for user ${userId}, order #${shortOrderId}. Skipping shipping notification.`);
        }
    };

    // --- Function to Send First Installment Paid Notification (After OTP verification) ---
    const sendFirstInstallmentPaidNotification = async (userId, orderIdentifier) => {
         if (!userId || !orderIdentifier) return;
         const shortOrderId = orderIdentifier.substring(0, 6).toUpperCase();
        console.log(`Attempting 1st installment paid (on delivery) notification for user ${userId}, order #${shortOrderId}`);
        const userToken = await getUserExpoToken(userId);
        if (userToken) {
            const message = {
                to: userToken, sound: 'default', title: '✅ First Installment Confirmed!',
                body: `Payment for the first installment of your order #${shortOrderId} (paid on delivery) has been confirmed. Your order is now active.`,
                data: { orderId: orderId, type: 'installment_update' }, priority: 'high', channelId: 'order-updates'
            };
            try {
                await axios.post(EXPO_PUSH_ENDPOINT, [message], { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Accept-encoding': 'gzip, deflate' }, timeout: 10000 });
                console.log(`First installment (on delivery) notification sent for user ${userId}, order #${shortOrderId}.`);
            } catch (error) { console.error(`Failed 1st installment (on delivery) notification to user ${userId}:`, error.response?.data || error.message || error); }
        } else { console.log(`No valid token for user ${userId}. Skipping 1st installment (on delivery) notification.`); }
    };

    // --- Function to Send Mixed Order COD Paid Notification (for COD + Fixed) ---
    const sendMixedCodPaidNotification = async (userId, orderIdentifier, fixedAmount, dueDate) => {
         if (!userId || !orderIdentifier || !dueDate) return;
         const shortOrderId = orderIdentifier.substring(0, 6).toUpperCase();
        console.log(`Attempting Mixed COD Paid notification for user ${userId}, order #${shortOrderId}`);
        const userToken = await getUserExpoToken(userId);
        if (userToken) {
            const formattedDueDate = formatShortDate(dueDate) || 'N/A'; // Handle potential invalid date
            const formattedAmount = typeof fixedAmount === 'number' ? fixedAmount.toLocaleString(undefined, { maximumFractionDigits: 0 }) : 'N/A';

            const message = {
                to: userToken, sound: 'default', title: '✅ COD Payment Received!',
                body: `Cash payment for order #${shortOrderId} confirmed. Reminder: Your Fixed Duration payment of ${CURRENCY_SYMBOL} ${formattedAmount} is due on ${formattedDueDate}.`,
                data: { orderId: orderId, type: 'payment_update' }, priority: 'high', channelId: 'order-updates'
            };
            try {
                await axios.post(EXPO_PUSH_ENDPOINT, [message], { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Accept-encoding': 'gzip, deflate' }, timeout: 10000 });
                console.log(`Mixed COD Paid (Fixed Reminder) notification sent for user ${userId}, order #${shortOrderId}.`);
            } catch (error) { console.error(`Failed Mixed COD Paid (Fixed Reminder) notification to user ${userId}:`, error.response?.data || error.message || error); }
        } else { console.log(`No valid token for user ${userId}. Skipping Mixed COD Paid (Fixed Reminder) notification.`); }
    };

    // --- Function to Send Mixed Order (COD + BNPL) Notification ---
    const sendMixedCodBnplNotification = async (userId, orderIdentifier, firstInstJustPaid, nextInstallment) => {
         if (!userId || !orderIdentifier) return;
         const shortOrderId = orderIdentifier.substring(0, 6).toUpperCase();
        console.log(`Attempting Mixed COD+BNPL notification for user ${userId}, order #${shortOrderId}`);
        const userToken = await getUserExpoToken(userId);
        if (userToken) {
            let bodyMessage = `Cash payment for order #${shortOrderId} confirmed! `;
            if (firstInstJustPaid) {
                bodyMessage += "Your first installment (paid on delivery) is also confirmed. ";
            }

            // Add reminder for the *next* unpaid installment if it exists
            if (nextInstallment && nextInstallment.dueDate && typeof nextInstallment.amount === 'number') {
                 const formattedDueDate = formatShortDate(nextInstallment.dueDate) || 'N/A';
                 const formattedAmount = nextInstallment.amount.toLocaleString(undefined, { maximumFractionDigits: 0 });
                 bodyMessage += `Reminder: Your next installment of ${CURRENCY_SYMBOL} ${formattedAmount} is due on ${formattedDueDate}.`;
            } else if (firstInstJustPaid && !nextInstallment) {
                 bodyMessage += "All installments are now scheduled or paid."; // First was the last one
            } else if (!firstInstJustPaid && !nextInstallment) {
                 // COD paid, first installment was already paid online, and it was the only one
                 bodyMessage += "All payments appear complete.";
            } else if (!firstInstJustPaid && nextInstallment) {
                 // COD paid, first installment was already paid online, remind about the next one
                 const formattedDueDate = formatShortDate(nextInstallment.dueDate) || 'N/A';
                 const formattedAmount = nextInstallment.amount.toLocaleString(undefined, { maximumFractionDigits: 0 });
                 bodyMessage += `Reminder: Your next installment of ${CURRENCY_SYMBOL} ${formattedAmount} is due on ${formattedDueDate}.`;
            } else {
                // Fallback if logic misses a case
                bodyMessage += "Your order is proceeding.";
            }


            const message = {
                to: userToken, sound: 'default', title: '✅ COD Payment Received!',
                body: bodyMessage, data: { orderId: orderId, type: 'payment_update' },
                priority: 'high', channelId: 'order-updates'
            };
            try {
                await axios.post(EXPO_PUSH_ENDPOINT, [message], { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Accept-encoding': 'gzip, deflate' }, timeout: 10000 });
                console.log(`Mixed COD+BNPL notification sent for user ${userId}, order #${shortOrderId}.`);
            } catch (error) { console.error(`Failed Mixed COD+BNPL notification to user ${userId}:`, error.response?.data || error.message || error); }
        } else { console.log(`No valid token for user ${userId}. Skipping Mixed COD+BNPL notification.`); }
    };


    // --- Handler Function: Ship Order & Generate OTP ---
    const handleShipAndGenerateOtp = async () => {
         if (!currentOrderData?.id || !currentOrderData?.userId || isProcessingShip) return;

        const currentStatus = currentOrderData.status?.toLowerCase() || '';
        // Check if the current status allows shipping AND if OTP doesn't already exist
        const canShip = [
             'pending', 'processing', 'active', // Active covers BNPL/Fixed after 1st paid/delivered
             'unpaid (cod)', 'unpaid (fixed duration)', 'unpaid (bnpl)',
             'pending first installment', 'partially paid', // Allow shipping even if partially paid
             'mixed (cod/bnpl pending)', 'mixed (cod/fixed pending)'
         ].includes(currentStatus);

        const otpExists = !!currentOrderData?.deliveryOtp;

        if (!canShip || otpExists) {
             let reason = "";
             if (otpExists) reason = "Delivery OTP already exists for this order.";
             else if (!canShip) reason = `Order cannot be shipped in its current status ('${currentOrderData.status}').`;
             Alert.alert("Action Not Allowed", reason);
             return;
        }

        // Confirmation Dialog
        Alert.alert(
            "Confirm Shipment",
            "Are you sure you want to mark this order as shipped and generate a Delivery OTP? This will notify the customer.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Ship & Notify",
                    style: "destructive", // Or "default"
                    onPress: async () => {
                        setIsProcessingShip(true); // Show loading indicator in button
                        const orderRef = doc(db, ORDERS_COLLECTION, currentOrderData.id);
                        const newOtp = generateOtpValue();
                        console.log(`Generated Delivery OTP for order ${currentOrderData.id}: ${newOtp}`);

                        try {
                            // Update status to Shipped and add OTP/timestamp
                            await updateDoc(orderRef, {
                                status: SHIPPED_STATUS,
                                shippedAt: serverTimestamp(), // Use server time for shipping
                                deliveryOtp: newOtp
                            });
                            console.log(`Order ${currentOrderData.id} status updated to ${SHIPPED_STATUS} and Delivery OTP saved.`);
                            // Send notification AFTER successful update
                            await sendShippingNotification(
                                currentOrderData.userId,
                                currentOrderData.id, // Pass full ID for consistency
                                newOtp
                            );
                            Alert.alert("Success", `Order marked as ${SHIPPED_STATUS}. Delivery OTP (${newOtp}) sent to customer.`);
                        } catch (error) {
                            console.error("Error marking order as shipped or saving OTP:", error);
                            Alert.alert("Error", "Could not update the order status or save OTP. Please try again.");
                        } finally {
                            setIsProcessingShip(false); // Hide loading indicator in button
                        }
                    },
                },
            ],
            { cancelable: true }
        );
    };


    // --- Handler Function: Verify Delivery OTP & Complete Order ---
    const handleVerifyOtp = async () => {
        const storedOtp = currentOrderData?.deliveryOtp;
        const trimmedEnteredOtp = enteredOtp.trim();

        setOtpError(''); // Clear previous errors
        if (!trimmedEnteredOtp) { setOtpError("Please enter the OTP."); return; }
        if (trimmedEnteredOtp.length !== OTP_LENGTH) { setOtpError(`OTP must be ${OTP_LENGTH} digits.`); return; }
        if (!storedOtp) {
            // This shouldn't happen if the UI is shown correctly, but double-check
            Alert.alert("Error", "No Delivery OTP found stored for this order. Cannot verify.");
            return;
        }
        if (isVerifyingOtp) return; // Prevent double taps

        setIsVerifyingOtp(true);

        if (trimmedEnteredOtp === storedOtp) {
            console.log(`Delivery OTP Verified for order ${orderId}. Determining update logic...`);
            const orderRef = doc(db, ORDERS_COLLECTION, currentOrderData.id);

            // --- Determine payment method and relevant conditions BEFORE update attempt ---
            const paymentMethod = currentOrderData?.paymentMethod;
            const isFixedDurationOrder = paymentMethod === 'Fixed Duration';
            const isBnplOrder = paymentMethod === 'BNPL';
            const isMixedOrder = paymentMethod === 'Mixed';

            // Check presence of different payment components
            const hasFixedDurationComponent = !!currentOrderData?.fixedDurationDetails || (isFixedDurationOrder && (currentOrderData?.bnplAmount > 0 || currentOrderData?.fixedAmount > 0));
            const hasCodComponent = typeof currentOrderData?.codAmount === 'number' && currentOrderData.codAmount > 0;
            const hasInstallmentComponent = Array.isArray(currentOrderData?.installments) && currentOrderData.installments.length > 0;

            const firstInstallment = currentOrderData?.installments?.[0];
            // Check if the first installment exists AND is NOT marked as Paid
            const isFirstInstallmentUnpaid = hasInstallmentComponent && firstInstallment && firstInstallment.status?.toLowerCase() !== PAID_STATUS.toLowerCase();
            const totalInstallments = currentOrderData?.installments?.length || 0;
            // --- End Determination ---

            let updateData = {};
            let successMessage = "";
            let notificationToSend = null;

            try {
                // Case 1: Mixed Order (COD + BNPL Installments) -> Set Active, Partially Paid
                if (isMixedOrder && hasCodComponent && hasInstallmentComponent) {
                    console.log("Handling Mixed (COD + BNPL) order completion.");
                    let firstInstallmentPaidInThisUpdate = false;
                    let updatedInstallmentsArray = [...(currentOrderData.installments || [])];

                    if (isFirstInstallmentUnpaid && currentOrderData.firstInstallmentPaymentPreference === 'Pay at Delivery') { // Only mark paid if preference was Pay at Delivery
                        console.log("...Marking first BNPL installment as paid (on delivery).");
                        const clientPaidAtTimestamp = Timestamp.now(); // Use client time for this action
                        updatedInstallmentsArray = updatedInstallmentsArray.map((inst, index) => {
                            if (index === 0) {
                                firstInstallmentPaidInThisUpdate = true;
                                return { ...inst, status: PAID_STATUS, paid: true, paidAt: clientPaidAtTimestamp }; // Mark paid
                            }
                            return inst;
                        });
                        updateData.installments = updatedInstallmentsArray;
                    } else if (isFirstInstallmentUnpaid) {
                         console.log("...First BNPL installment is unpaid, but preference wasn't 'Pay at Delivery'. Not marking paid now.");
                    } else {
                        console.log("...First BNPL installment was already paid.");
                    }

                    updateData.status = ACTIVE_STATUS; // Order is active, installments remain
                    updateData.deliveredAt = serverTimestamp();
                    updateData.paymentStatus = PARTIALLY_PAID_STATUS; // COD paid, BNPL may remain
                    updateData.codPaymentReceivedAt = serverTimestamp(); // Mark COD as received now
                    // updateData.deliveryOtp = deleteField(); // Optional: Remove OTP after verification

                    successMessage = "OTP Verified! Delivery confirmed. COD portion paid.";
                    if (firstInstallmentPaidInThisUpdate) {
                        successMessage += " First installment marked as paid.";
                    }

                    // Find the next installment that isn't paid (could be #1 if preference wasn't PayAtDelivery, or #2 onwards)
                    const nextUnpaidInstallment = updatedInstallmentsArray.find((inst) => inst.status?.toLowerCase() !== PAID_STATUS.toLowerCase());
                    notificationToSend = () => sendMixedCodBnplNotification(
                        currentOrderData.userId,
                        currentOrderData.id, // Use full ID
                        firstInstallmentPaidInThisUpdate,
                        nextUnpaidInstallment // Pass the next one (could be null)
                    );
                }
                // Case 2: Mixed Order (COD + Fixed Duration) -> Set Active, Partially Paid
                else if (isMixedOrder && hasCodComponent && hasFixedDurationComponent) {
                    console.log("Handling Mixed (COD + Fixed Duration) order completion.");
                    updateData = {
                        status: ACTIVE_STATUS, // Active because Fixed payment is still pending
                        deliveredAt: serverTimestamp(),
                        paymentStatus: PARTIALLY_PAID_STATUS, // COD paid, Fixed remains
                        codPaymentReceivedAt: serverTimestamp(),
                        // deliveryOtp: deleteField()
                    };
                    successMessage = "OTP Verified! Delivery confirmed. COD portion paid. Fixed Duration payment remains pending.";
                    // Get Fixed details for notification
                    // *** USE fixedDurationAmountDue here for notification consistency ***
                    const fixedAmount = currentOrderData.fixedDurationAmountDue ?? 0;
                    const dueDate = currentOrderData.fixedDurationDetails?.dueDate ?? currentOrderData.paymentDueDate; // Get due date
                    if (dueDate && fixedAmount > 0) {
                         notificationToSend = () => sendMixedCodPaidNotification(currentOrderData.userId, currentOrderData.id, fixedAmount, dueDate);
                    } else { console.warn("Missing due date or amount for Fixed Duration reminder in Mixed order."); }
                }
                // Case 3: Pure Fixed Duration Order -> Set Active
                else if (isFixedDurationOrder) {
                    console.log("Handling Fixed Duration order completion (Set to Active).");
                    updateData = {
                         status: ACTIVE_STATUS, // Active because payment is still due later
                         deliveredAt: serverTimestamp()
                         // Payment status remains unchanged (e.g., Unpaid (Fixed Duration))
                         // deliveryOtp: deleteField()
                    };
                    successMessage = `OTP Verified! Delivery confirmed. Order status set to ${ACTIVE_STATUS}. Payment remains pending.`;
                    // No payment notification needed here, user knows payment is due later
                }
                // Case 4: Pure BNPL Order with Unpaid First Installment -> Mark 1st Paid, Set Active
                else if (isBnplOrder && isFirstInstallmentUnpaid && currentOrderData.firstInstallmentPaymentPreference === 'Pay at Delivery') {
                   console.log("Handling BNPL order - First installment unpaid (Pay at Delivery). Marking paid and setting Active.");
                   const clientPaidAtTimestamp = Timestamp.now(); // Use client time
                   const updatedInstallments = (currentOrderData.installments || []).map((inst, index) => {
                       if (index === 0) { return { ...inst, status: PAID_STATUS, paid: true, paidAt: clientPaidAtTimestamp }; }
                       return inst;
                   });
                   updateData = {
                       installments: updatedInstallments,
                       status: ACTIVE_STATUS, // Active because subsequent installments may remain
                       deliveredAt: serverTimestamp(),
                       paymentStatus: totalInstallments > 1 ? PARTIALLY_PAID_STATUS : PAID_STATUS // Update payment status based on remaining installments
                       // deliveryOtp: deleteField()
                   };
                   successMessage = "OTP Verified! First installment marked as paid. Order is now Active.";
                   notificationToSend = () => sendFirstInstallmentPaidNotification(currentOrderData.userId, currentOrderData.id);
                }
                // Case 5: Pure BNPL Order where 1st was ALREADY Paid, and MORE installments exist -> Set Active
                else if (isBnplOrder && !isFirstInstallmentUnpaid && totalInstallments > 1) {
                    console.log("Handling BNPL order - First installment already paid online, more exist. Setting Active.");
                    updateData = {
                        status: ACTIVE_STATUS, // Set to Active as delivery confirmed, but installments remain
                        deliveredAt: serverTimestamp()
                        // DO NOT change paymentStatus or installments array here (payment status should be Partially Paid already)
                        // deliveryOtp: deleteField()
                    };
                    successMessage = "OTP Verified! Delivery confirmed. Order remains Active (pending further installments).";
                    // No immediate payment notification needed, user already knows it's active.
                }
                // Case 6: All other orders -> Set Delivered, Paid
                // This covers: Pure COD, Standard Prepaid, Single-Installment BNPL (paid online or on delivery), BNPL where 1st was unpaid but preference wasn't PayAtDelivery.
                else {
                    console.log("Handling standard order completion (COD, Prepaid, Single/Paid BNPL, etc) - Set to Delivered/Paid.");
                    updateData = {
                        status: DELIVERED_STATUS,
                        deliveredAt: serverTimestamp(),
                        paymentStatus: PAID_STATUS, // Assume payment complete on delivery for these cases
                        paymentReceivedAt: serverTimestamp(), // Record payment time
                        // If COD, mark it paid specifically if not done already
                        ...(hasCodComponent && !currentOrderData.codPaymentReceivedAt && { codPaymentReceivedAt: serverTimestamp() }),
                        // If BNPL/1st Inst unpaid/Not PayAtDelivery -> mark delivered, payment still pending until paid via app/link
                        ...(isBnplOrder && isFirstInstallmentUnpaid && currentOrderData.firstInstallmentPaymentPreference !== 'Pay at Delivery' && {
                             paymentStatus: currentOrderData.paymentStatus, // Keep original payment status (e.g., Pending First Installment)
                             paymentReceivedAt: null // Payment not received yet
                        }),
                        // If it was a single BNPL installment that was already paid, this correctly marks the order complete.
                         // deliveryOtp: deleteField()
                    };

                    // Adjust success message for the unpaid BNPL case
                    if (isBnplOrder && isFirstInstallmentUnpaid && currentOrderData.firstInstallmentPaymentPreference !== 'Pay at Delivery') {
                        successMessage = "OTP Verified! Order marked as Delivered. First installment payment is still pending.";
                    } else {
                         successMessage = "OTP Verified! Order marked as Delivered and Paid.";
                    }
                    // Send generic delivered/paid notification? Maybe not needed if specific ones covered above.
                }

                // Perform the Firestore update
                console.log(`Order ${orderId}: Preparing to update with:`, updateData);
                await updateDoc(orderRef, updateData);
                console.log(`Order ${orderId} updated successfully based on OTP verification logic.`);
                Alert.alert("Success", successMessage);
                setEnteredOtp(''); // Clear entered OTP after successful verification

                // Send the relevant notification *after* successful update
                if (notificationToSend) {
                    console.log(`Order ${orderId}: Triggering notification...`);
                    await notificationToSend();
                } else {
                    console.log(`Order ${orderId}: No specific notification needed for this OTP verification case.`);
                }

            } catch (error) {
                console.error("Error updating order status after OTP verification:", error);
                Alert.alert("Error", "Could not update order status after verification. Please check logs.");
                setOtpError("Verification succeeded but failed to update status. Please retry or contact support."); // More specific error
            }
        } else {
            // Incorrect OTP
            console.warn(`Incorrect Delivery OTP entered for order ${orderId}. Entered: ${trimmedEnteredOtp}, Expected: ${storedOtp}`);
            setOtpError("Incorrect OTP entered. Please double-check and try again.");
        }
        setIsVerifyingOtp(false); // Stop loading indicator
    };


    // --- Render Functions ---
    const renderOrderItem = ({ item, index }) => {
          // Basic validation
          if (!item || typeof item.price !== 'number' || typeof item.quantity !== 'number') {
              console.warn("Skipping rendering invalid order item:", item);
              return null;
          }
        const itemsArray = currentOrderData?.items || [];
        const itemTotal = (item.price || 0) * (item.quantity || 1);

        // Determine display text for payment method specific to this item
        const paymentMethod = item.paymentMethod || 'COD'; // Default to COD if missing
        let paymentDisplay = paymentMethod;
        if (item.bnplPlan?.name) { // If plan name exists, use it
             paymentDisplay = item.bnplPlan.name;
        } else if (paymentMethod === 'BNPL') {
             paymentDisplay = 'BNPL Plan'; // Generic fallback
        } else if (paymentMethod === 'Fixed Duration') {
             paymentDisplay = 'Fixed Duration'; // Generic fallback
        } // COD uses 'COD'

        return (
            <View style={[styles.itemContainer, index === itemsArray.length - 1 && styles.lastItemContainer]}>
                <Image
                     source={item.image ? { uri: item.image } : placeholderImagePath}
                     style={styles.itemImage}
                     defaultSource={placeholderImagePath} // Show placeholder while loading/on error
                     onError={(e) => console.warn(`Image load failed for item ${item.id}: ${item.image}`, e.nativeEvent.error)}
                 />
                <View style={styles.itemDetails}>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name || 'Unnamed Product'}</Text>
                    <Text style={styles.itemQtyPrice}>Qty: {item.quantity || 1}</Text>
                    <Text style={styles.itemPrice}>{CURRENCY_SYMBOL} {(item.price || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} each</Text>
                    <Text style={styles.itemPaymentMethod}>Method: {paymentDisplay}</Text>
                </View>
                {/* Display Item Total */}
                <Text style={styles.itemTotalValue}>{CURRENCY_SYMBOL} {itemTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
            </View>
        );
    };
    const renderInstallment = ({ item }) => {
         // Basic validation for installment item
         if (!item || typeof item.amount !== 'number' || !item.installmentNumber) {
             console.warn("Skipping rendering invalid installment item:", item);
             return null;
         }
         const installmentStatus = item.status || PENDING_STATUS;
         const dueDateFormatted = formatShortDate(item.dueDate);
         const paidDateFormatted = formatDate(item.paidAt); // Use full format for paid date

        return (
            <View style={styles.installmentRow}>
                 <View style={styles.installmentColumn}>
                     <Text style={styles.installmentNumber}>Inst. #{item.installmentNumber}</Text>
                     <Text style={styles.installmentAmount}>{CURRENCY_SYMBOL} {item.amount?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || 'N/A'}</Text>
                 </View>
                 <View style={styles.installmentColumn}>
                     <Text style={styles.installmentDueDate}>Due: {dueDateFormatted}</Text>
                     {item.paidAt && paidDateFormatted !== 'N/A' && (
                          <Text style={styles.paidAtText}>Paid: {paidDateFormatted}</Text>
                     )}
                 </View>
                 <View style={styles.installmentColumnStatus}>
                     <View style={[styles.statusBadgeSmall, getInstallmentStatusStyle(installmentStatus)]}>
                        <Text style={styles.statusTextSmall}>{installmentStatus}</Text>
                     </View>
                    {typeof item.penalty === 'number' && item.penalty > 0 && (<Text style={styles.penaltyText}>Penalty: {CURRENCY_SYMBOL}{item.penalty.toFixed(2)}</Text>)}
                 </View>
            </View>
        );
    };
    // --- (End Render Functions) ---


    // --- Conditional Rendering Logic for Loading/Error ---
    if (loading) {
        return (<SafeAreaView style={styles.container}><View style={styles.loadingContainer}><ActivityIndicator size="large" color={AccentColor} /><Text style={styles.loadingText}>Loading Order...</Text></View></SafeAreaView>);
    }
    if (error || !currentOrderData) {
        // Show error message if error state is set or if data is null after loading finishes
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <IconMUI name="error-outline" size={48} color={AccentColor} />
                    <Text style={styles.errorText}>{error || "Order details could not be loaded or order not found."}</Text>
                    {navigation.canGoBack() && ( // Only show Go Back if navigation is possible
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Text style={styles.errorLink}>Go Back</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </SafeAreaView>
        );
    }

    // --- Determine derived values for UI rendering AFTER data is loaded ---
    const currentStatusLower = currentOrderData.status?.toLowerCase() || '';
    const paymentMethod = currentOrderData.paymentMethod || 'Unknown';

    // Conditions for showing action buttons/sections
    const canShip = [
        'pending', 'processing', 'active', 'unpaid (cod)', 'unpaid (fixed duration)', 'unpaid (bnpl)',
        'pending first installment', 'partially paid', 'mixed (cod/bnpl pending)', 'mixed (cod/fixed pending)'
     ].includes(currentStatusLower);
    const otpExists = !!currentOrderData?.deliveryOtp;
    const canMarkAsShipped = canShip && !otpExists; // Show "Ship" only if allowed status AND no OTP yet
    const showDeliveryOtpVerification = currentStatusLower === SHIPPED_STATUS.toLowerCase() && otpExists;

    // Conditions for showing payment detail sections
    const relevantPlanDetails = currentOrderData.bnplPlanDetails || currentOrderData.fixedDurationDetails; // Combine plan sources
    const isInstallmentOrder = paymentMethod === 'BNPL' || (paymentMethod === 'Mixed' && Array.isArray(currentOrderData.installments) && currentOrderData.installments.length > 0);
    const isFixedDurationOrderOnly = paymentMethod === 'Fixed Duration'; // Purely Fixed Duration
    const showCodSection = (paymentMethod === 'COD' || paymentMethod === 'Mixed') && typeof currentOrderData.codAmount === 'number' && currentOrderData.codAmount > 0;
    const showInstallmentSection = isInstallmentOrder;
    const showFixedDurationSection = isFixedDurationOrderOnly || (paymentMethod === 'Mixed' && !!currentOrderData?.fixedDurationDetails); // Show if pure Fixed or Mixed with Fixed details


    // --- Main Screen Render ---
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
            {/* KeyboardAvoidingView helps push content up when keyboard appears for OTP */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0} // Adjust offset if needed
            >
                <ScrollView
                     contentContainerStyle={styles.scrollContainer}
                     showsVerticalScrollIndicator={false}
                     keyboardShouldPersistTaps="handled" // Ensures taps work inside ScrollView (e.g., on buttons)
                 >

                    {/* Section 1: Items */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Items Ordered ({currentOrderData.items?.length || 0})</Text>
                        <View style={styles.itemsListContainer}>
                            <FlatList
                                data={currentOrderData.items || []}
                                keyExtractor={(itemData, index) => itemData?.id ? `${itemData.id}-${index}` : `item-fallback-${index}`}
                                renderItem={renderOrderItem}
                                scrollEnabled={false} // Disable nested scrolling
                                ListEmptyComponent={<Text style={styles.emptyListText}>No items found in this order.</Text>}
                            />
                        </View>
                        {/* Order Totals Sub-section */}
                        <View style={styles.orderTotals}>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Subtotal:</Text>
                                <Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {(currentOrderData.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                            </View>
                            {/* Conditionally display Delivery Fee */}
                            {typeof currentOrderData.deliveryFee === 'number' && currentOrderData.deliveryFee > 0 && (
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Delivery Fee:</Text>
                                    <Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {currentOrderData.deliveryFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                </View>
                            )}
                             {/* Conditionally display Discount */}
                             {typeof currentOrderData.discountAmount === 'number' && currentOrderData.discountAmount > 0 && (
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Discount:</Text>
                                    <Text style={[styles.summaryValue, styles.discountValue]}>- {CURRENCY_SYMBOL} {currentOrderData.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                </View>
                            )}
                            <View style={styles.totalDivider} />
                            <View style={styles.summaryRow}>
                                <Text style={[styles.summaryLabel, styles.grandTotalLabel]}>Grand Total:</Text>
                                <Text style={[styles.summaryValue, styles.grandTotalValue]}>{CURRENCY_SYMBOL} {(currentOrderData.grandTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Section 2: Order Summary */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Order Summary</Text>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Order ID:</Text>
                            {/* Use full ID for copy/paste or reference */}
                            <Text style={[styles.summaryValue, styles.idValue]} selectable={true}>{currentOrderData.id || 'N/A'}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Order Date:</Text>
                            <Text style={styles.summaryValue}>{formatDate(currentOrderData.createdAt || currentOrderData.orderDate)}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Order Status:</Text>
                            {/* Use the dynamic status badge */}
                            <View style={[styles.statusBadge, getStatusStyle(currentOrderData.status)]}>
                                <Text style={styles.statusText}>{currentOrderData.status || 'Unknown'}</Text>
                            </View>
                        </View>
                         {/* Display Shipped Date if available */}
                         {currentOrderData.shippedAt && (
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Shipped Date:</Text>
                                <Text style={styles.summaryValue}>{formatDate(currentOrderData.shippedAt)}</Text>
                            </View>
                        )}
                        {/* Display Delivered Date if available */}
                        {currentOrderData.deliveredAt && (
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Delivered Date:</Text>
                                <Text style={styles.summaryValue}>{formatDate(currentOrderData.deliveredAt)}</Text>
                            </View>
                        )}
                    </View>

                    {/* Section 3: Customer Information */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Customer Information</Text>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Name:</Text>
                            <Text style={styles.summaryValue}>{currentOrderData.userName || 'N/A'}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Phone:</Text>
                            <Text style={styles.summaryValue} selectable={true}>{currentOrderData.userPhone || 'N/A'}</Text>
                        </View>
                         {/* Display Email if available */}
                        {currentOrderData.userEmail && (
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Email:</Text>
                                <Text style={styles.summaryValue} selectable={true}>{currentOrderData.userEmail}</Text>
                            </View>
                        )}
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Address:</Text>
                            {/* Make address selectable and allow more space */}
                            <Text style={[styles.summaryValue, styles.addressValue]} selectable={true}>{currentOrderData.userAddress || 'N/A'}</Text>
                        </View>
                    </View>

                    {/* Section 4: Payment Details */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Payment Details</Text>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Method:</Text>
                            <Text style={styles.summaryValue}>{paymentMethod}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Payment Status:</Text>
                            <View style={[styles.statusBadge, getStatusStyle(currentOrderData.paymentStatus)]}>
                                <Text style={styles.statusText}>{currentOrderData.paymentStatus || 'N/A'}</Text>
                            </View>
                        </View>
                         {/* Display Payment Received Date if available */}
                         {currentOrderData.paymentReceivedAt && currentOrderData.paymentStatus === PAID_STATUS && (
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Fully Paid Date:</Text>
                                <Text style={styles.summaryValue}>{formatDate(currentOrderData.paymentReceivedAt)}</Text>
                            </View>
                        )}

                        {/* Conditional: COD Section */}
                        {showCodSection && (
                            <View style={styles.paymentSubSection}>
                                <Text style={styles.paymentSubHeader}>Cash on Delivery Details</Text>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Amount Due (COD):</Text>
                                    <Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.codAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                </View>
                                {/* Display COD payment time if available */}
                                {currentOrderData.codPaymentReceivedAt && (
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>COD Paid At:</Text>
                                        <Text style={styles.summaryValue}>{formatDate(currentOrderData.codPaymentReceivedAt)}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Conditional: Installment Section */}
                        {showInstallmentSection && (
                            <View style={styles.paymentSubSection}>
                                <Text style={styles.paymentSubHeader}>Installment Plan Details</Text>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Total Plan Amount (BNPL):</Text>
                                    <Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.bnplAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                </View>
                                {/* Display Plan Details if available */}
                                {relevantPlanDetails && (
                                    <View style={styles.planDetailsBox}>
                                        <Text style={styles.planDetailText}>Plan: {relevantPlanDetails.name || 'N/A'}</Text>
                                        <Text style={styles.planDetailText}>Duration: {relevantPlanDetails.duration || 'N/A'} Months</Text>
                                        <Text style={styles.planDetailText}>Interest: {typeof relevantPlanDetails.interestRate === 'number' ? `${(relevantPlanDetails.interestRate).toFixed(1)}%` : 'N/A'}</Text>
                                    </View>
                                )}
                                {/* Show 1st installment preference */}
                                {currentOrderData.firstInstallmentPaymentPreference && (
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>1st Inst. Preference:</Text>
                                        <Text style={styles.summaryValue}>{currentOrderData.firstInstallmentPaymentPreference}</Text>
                                    </View>
                                )}
                                {/* Link to schedule below */}
                                {(currentOrderData.installments?.length > 0) && <Text style={styles.linkText}>(Full schedule below)</Text>}
                            </View>
                        )}

                        {/* Conditional: Fixed Duration Section */}
                        {showFixedDurationSection && (
                            <View style={styles.paymentSubSection}>
                                <Text style={styles.paymentSubHeader}>Fixed Duration Plan Details</Text>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Total Plan Amount:</Text>
                                    {/* === UPDATED TO USE fixedDurationAmountDue === */}
                                    <Text style={styles.paymentValueHighlight}>
                                        {CURRENCY_SYMBOL} {(currentOrderData.fixedDurationAmountDue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Text>
                                    {/* ============================================ */}
                                </View>
                                {/* Display Plan Details if available */}
                                {relevantPlanDetails && (
                                    <View style={styles.planDetailsBox}>
                                        <Text style={styles.planDetailText}>Plan: {relevantPlanDetails.name || 'Fixed Plan'}</Text>
                                        <Text style={styles.planDetailText}>Duration: {relevantPlanDetails.duration || 'N/A'} Months</Text>
                                        <Text style={styles.planDetailText}>Interest: {typeof relevantPlanDetails.interestRate === 'number' ? `${(relevantPlanDetails.interestRate).toFixed(1)}%` : 'N/A'}</Text>
                                    </View>
                                )}
                                {/* Display Due Date */}
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Payment Due Date:</Text>
                                    <Text style={[styles.summaryValue, styles.dueDateValue]}>{formatShortDate(currentOrderData.fixedDurationDetails?.dueDate ?? currentOrderData.paymentDueDate)}</Text>
                                </View>
                                {/* Display Penalty if applied */}
                                {typeof currentOrderData.penalty === 'number' && currentOrderData.penalty > 0 && (
                                    <View style={styles.summaryRow}>
                                        <Text style={[styles.summaryLabel, styles.penaltyLabel]}>Penalty Applied:</Text>
                                        <Text style={[styles.summaryValue, styles.penaltyValue]}>{CURRENCY_SYMBOL}{currentOrderData.penalty.toFixed(2)}</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Section 5: BNPL Installment Schedule */}
                    {showInstallmentSection && currentOrderData.installments?.length > 0 && (
                        <View style={styles.section}>
                             <Text style={styles.sectionTitle}>Installment Schedule</Text>
                             <FlatList
                                data={currentOrderData.installments}
                                keyExtractor={(inst, index) => inst?.installmentNumber ? `inst-${inst.installmentNumber}-${index}` : `inst-fallback-${index}`}
                                renderItem={renderInstallment}
                                scrollEnabled={false} // Prevent nested scrolling
                                ListEmptyComponent={<Text style={styles.emptyListText}>No installment data found.</Text>}
                             />
                        </View>
                    )}

                    {/* --- ACTION BUTTONS --- */}

                    {/* Button: Mark as Shipped & Generate OTP */}
                    {canMarkAsShipped && (
                        <TouchableOpacity
                            style={[styles.actionButton, isProcessingShip && styles.disabledButton]}
                            onPress={handleShipAndGenerateOtp}
                            disabled={isProcessingShip}
                            activeOpacity={0.7}
                        >
                           {isProcessingShip ? ( <ActivityIndicator color="#FFF" size="small" /> ) : (
                                <View style={styles.buttonContent}>
                                    <IconMUI name="local-shipping" size={18} color="#FFF" style={styles.buttonIcon} />
                                    <Text style={styles.actionButtonText}>Ship & Generate Delivery OTP</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    )}

                    {/* Section: Delivery OTP Verification */}
                    {showDeliveryOtpVerification && (
                         <View style={styles.otpVerificationContainer}>
                            <Text style={styles.otpInputLabel}>Enter Delivery OTP</Text>
                            <Text style={styles.otpInputSubLabel}>Provided by customer/rider</Text>
                            {/* Use React Native Paper TextInput for better styling */}
                            <PaperInput
                                label={`Enter ${OTP_LENGTH}-Digit Delivery OTP`}
                                mode="outlined"
                                style={styles.otpInputPaper}
                                value={enteredOtp}
                                onChangeText={setEnteredOtp} // No need to filter here if keyboardType is number-pad
                                keyboardType="number-pad" // Use number pad for easier input
                                maxLength={OTP_LENGTH} // Limit input length
                                editable={!isVerifyingOtp} // Disable input while verifying
                                outlineColor={LightBorderColor} // Default border color
                                activeOutlineColor={FocusedBorderColor} // Border color when focused
                                theme={{
                                     colors: { primary: FocusedBorderColor, text: TextColorPrimary, placeholder: TextColorSecondary, background: AppBackgroundColor },
                                     roundness: 8 // Match border radius
                                }}
                                onSubmitEditing={handleVerifyOtp} // Allow submission via keyboard 'done'
                                error={!!otpError} // Show error indication on input
                                contentStyle={styles.otpInputContentStyle} // Center text, increase size
                            />
                            {/* Display OTP error message */}
                            {otpError ? <Text style={styles.otpErrorText}>{otpError}</Text> : null}
                            {/* Show the expected OTP for admin reference (remove in production if sensitive) */}
                            {__DEV__ && currentOrderData.deliveryOtp && ( // Only show in development builds
                                <Text style={styles.otpReferenceText}>Expected (Dev only): {currentOrderData.deliveryOtp}</Text>
                            )}
                            {/* Verify Button */}
                            <TouchableOpacity
                                style={[
                                    styles.verifyOtpButton,
                                    // Disable button if verifying or OTP is invalid/empty
                                    (isVerifyingOtp || !enteredOtp || enteredOtp.length !== OTP_LENGTH) && styles.disabledButton
                                ]}
                                onPress={handleVerifyOtp}
                                disabled={isVerifyingOtp || !enteredOtp || enteredOtp.length !== OTP_LENGTH}
                                activeOpacity={0.7}
                            >
                                {isVerifyingOtp ? ( <ActivityIndicator color="#FFF" size="small" /> ) : (
                                    <View style={styles.buttonContent}>
                                        <IconMUI name="check-circle-outline" size={18} color="#FFF" style={styles.buttonIcon} />
                                        <Text style={styles.actionButtonText}>Verify Delivery OTP</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Display Final Status when no actions are available */}
                    {!canMarkAsShipped && !showDeliveryOtpVerification && currentOrderData.status && (
                        <View style={styles.finalStatusContainer}>
                            <Text style={styles.finalStatusLabel}>Current Order Status:</Text>
                            <View style={[styles.statusBadge, getStatusStyle(currentOrderData.status)]}>
                                <Text style={styles.statusText}>{currentOrderData.status}</Text>
                            </View>
                        </View>
                    )}

                    {/* Add some padding at the bottom */}
                    <View style={{ height: 30 }} />

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: ScreenBackgroundColor, },
    scrollContainer: { flexGrow: 1, padding: 15, paddingBottom: 40, paddingTop: Platform.OS === 'android' ? 10 : 20 }, // Adjust top padding
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    loadingText: { marginTop: 15, fontSize: 16, color: TextColorSecondary },
    errorText: { fontSize: 17, fontWeight: '500', color: AccentColor, marginBottom: 20, textAlign: 'center' },
    errorLink: { fontSize: 16, color: '#007AFF', fontWeight: 'bold', marginTop: 10 },
    emptyListText: { textAlign: 'center', color: TextColorSecondary, fontStyle: 'italic', paddingVertical: 10 },
    // Section Styling
    section: {
        backgroundColor: AppBackgroundColor,
        borderRadius: 10, // Slightly more rounded corners
        padding: 15,
        marginBottom: 18, // Increased spacing between sections
        elevation: 1.5, // Subtle elevation for Android
        shadowColor: '#000000', // Shadow for iOS
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2.5,
        borderWidth: Platform.OS === 'ios' ? 0.5 : 0, // Hairline border for iOS if needed
        borderColor: '#E0E0E0',
    },
    sectionTitle: {
        fontSize: 18, // Slightly larger title
        fontWeight: '600', // Bolder
        color: TextColorPrimary,
        marginBottom: 15, // More space below title
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0', // Lighter separator
        paddingBottom: 10,
    },
    // Summary Row Styling
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', }, // alignItems: flex-start for long text
    summaryLabel: { fontSize: 14, color: TextColorSecondary, marginRight: 8, flexBasis: '35%', }, // Give label some basis
    summaryValue: { fontSize: 14, fontWeight: '500', color: TextColorPrimary, textAlign: 'right', flexShrink: 1, flexBasis: '60%', }, // Allow value to take more space
    addressValue: { textAlign: 'left', marginLeft: 'auto', }, // Align address left but keep it right overall
    idValue: { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 13 }, // Monospace for IDs
    dueDateValue: { fontWeight: 'bold', color: AccentColor },
    discountValue: { color: SuccessColor },
    // Status Badges
    statusBadge: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 15, alignSelf: 'flex-end', // Align badge to the right within its space
 },
    statusText: { fontSize: 12, fontWeight: 'bold', color: '#fff', },
    // Badge Colors (Adjust as needed)
    statusPending: { backgroundColor: '#FFA726' }, // Orange
    statusProcessing: { backgroundColor: '#42A5F5' }, // Blue
    statusShipped: { backgroundColor: '#81C784' }, // Lighter Green
    statusDelivered: { backgroundColor: '#90A4AE' }, // Grey Blue
    statusCancelled: { backgroundColor: '#EF5350' }, // Red
    statusUnknown: { backgroundColor: '#BDBDBD' }, // Grey
    statusActive: { backgroundColor: '#29B6F6' }, // Bright Blue
    statusFullyPaid: { backgroundColor: '#4CAF50' }, // Dark Green
    // Payment Sub-section Styling
    paymentSubSection: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f0f0f0', },
    paymentSubHeader: { fontSize: 15, fontWeight: '600', color: TextColorPrimary, marginBottom: 10, },
    paymentValueHighlight: { fontSize: 15, fontWeight: 'bold', color: AccentColor, },
    planDetailsBox: { marginTop: 10, marginBottom: 5, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 6, borderWidth: 1, borderColor: '#eee' },
    planDetailText: { fontSize: 13, color: TextColorSecondary, marginBottom: 4, lineHeight: 18 },
    linkText: { fontSize: 13, color: '#007AFF', marginTop: 5, fontStyle: 'italic', textAlign: 'right', }, // Link to schedule
    penaltyLabel: { color: AccentColor, fontWeight: '600' },
    penaltyValue: { color: AccentColor, fontWeight: 'bold' },
    // Installment Row Styling
    installmentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', flexWrap: 'nowrap' }, // No wrap needed here
    installmentColumn: { flex: 1, paddingHorizontal: 4, },
    installmentColumnStatus: { flexBasis: 'auto', alignItems: 'flex-end', paddingLeft: 8, }, // Status column less flexible
    installmentNumber: { fontSize: 13, fontWeight: '600', color: TextColorPrimary, marginBottom: 2, },
    installmentAmount: { fontSize: 13, color: TextColorPrimary, },
    installmentDueDate: { fontSize: 12, color: TextColorSecondary, marginBottom: 2, },
    paidAtText: { fontSize: 11, color: TextColorSecondary, fontStyle: 'italic', marginTop: 2, },
    penaltyText: { fontSize: 11, color: AccentColor, fontWeight: '500', marginTop: 3, },
    statusBadgeSmall: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, },
    statusTextSmall: { fontSize: 10, fontWeight: 'bold', color: '#fff', },
    statusPaid: { backgroundColor: SuccessColor }, // Consistent Green for paid
    statusInstallmentPending: { backgroundColor: '#FFA726'}, // Consistent Orange for pending
    // Items List Styling
    itemsListContainer: { marginTop: 5, },
    itemContainer: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', alignItems: 'center', },
    lastItemContainer: { borderBottomWidth: 0, },
    itemImage: { width: 55, height: 55, borderRadius: 8, marginRight: 15, backgroundColor: PlaceholderBgColor, },
    itemDetails: { flex: 1, justifyContent: 'center', marginRight: 8, },
    itemName: { fontSize: 15, fontWeight: '600', color: TextColorPrimary, marginBottom: 3, }, // Slightly larger item name
    itemQtyPrice: { fontSize: 13, color: TextColorSecondary, marginBottom: 3, },
    itemPrice: { fontSize: 13, color: TextColorSecondary, },
    itemPaymentMethod: { fontSize: 12, fontStyle: 'italic', color: TextColorSecondary, marginTop: 4, backgroundColor: '#f0f0f0', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' }, // Style payment method
    itemTotalValue: { fontSize: 15, fontWeight: 'bold', color: TextColorPrimary, textAlign: 'right', marginLeft: 10, }, // Bolder item total
    // Order Totals Styling
    orderTotals: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F0F0F0', }, // Lighter separator
    totalDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 10, },
    grandTotalLabel: { fontWeight: 'bold', fontSize: 16, color: TextColorPrimary },
    grandTotalValue: { fontWeight: 'bold', fontSize: 16, color: AccentColor },
    // Action Buttons Styling
    actionButton: {
         paddingVertical: 14, // Slightly more padding
         borderRadius: 10, // More rounded
         alignItems: 'center',
         justifyContent: 'center',
         marginTop: 20, marginHorizontal: 5, marginBottom: 10, // Consistent margins
         elevation: 3, minHeight: 50, // Min height for consistency
         shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3,
         backgroundColor: AccentColor, // Use Accent color
    },
    disabledButton: { backgroundColor: '#BDBDBD', elevation: 0, shadowOpacity: 0, }, // Consistent disabled style
    actionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', }, // Slightly larger text
    buttonContent: { flexDirection: 'row', alignItems: 'center', },
    buttonIcon: { marginRight: 10, }, // More space for icon
    // OTP Verification Section Styling
    otpVerificationContainer: {
        marginTop: 25, marginBottom: 15, marginHorizontal: 0, // No horizontal margin needed if section has padding
        paddingVertical: 20, paddingHorizontal: 15,
        backgroundColor: '#FFF8E1', // Light yellow background for emphasis
        borderRadius: 10,
        borderWidth: 1, borderColor: '#FFD54F', // Yellow border
        elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
    },
    otpInputLabel: { fontSize: 17, fontWeight: 'bold', color: TextColorPrimary, textAlign: 'center', marginBottom: 5, },
    otpInputSubLabel: { fontSize: 13, color: TextColorSecondary, textAlign: 'center', marginBottom: 15, },
    otpInputPaper: { backgroundColor: '#fff', marginBottom: 10, }, // White background for input itself
    otpInputContentStyle: { fontSize: 22, textAlign: 'center', letterSpacing: 10, fontWeight: 'bold' }, // Make OTP stand out
    otpErrorText: { color: AccentColor, fontSize: 14, textAlign: 'center', marginBottom: 8, fontWeight: '500' },
    otpReferenceText: { fontSize: 12, color: '#E65100', textAlign: 'center', fontStyle: 'italic', marginBottom: 15, }, // Different color for dev reference
    verifyOtpButton: {
        backgroundColor: SuccessColor, // Green for verification
        paddingVertical: 14, paddingHorizontal: 30,
        borderRadius: 10, elevation: 2, minHeight: 50,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2,
        alignSelf: 'center', width: '90%', maxWidth: 350, // Responsive width
        marginTop: 10,
    },
    // Final Status Display Styling
    finalStatusContainer: {
         marginTop: 20, marginBottom: 10, marginHorizontal: 5,
         paddingVertical: 15, paddingHorizontal: 20,
         alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
         backgroundColor: AppBackgroundColor, borderRadius: 10,
         elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1.5,
         borderWidth: Platform.OS === 'android' ? 0 : 1, borderColor: '#E0E0E0',
     },
    finalStatusLabel: { fontSize: 16, fontWeight: '600', color: TextColorPrimary, marginRight: 12, },
});