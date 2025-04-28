// UserSchedulesProgressDetails.js - COMPLETE CODE V12 (Final Version with All Features)
// Includes Countdown Timer, specific RED highlights/actions, GREEN Paid Date, Icons, Expo Notification placeholders.
// Uses Status Badge colors from reference. Highlights next installment with RED BORDER ONLY (#FF0000). Buttons use Bright Red (#FF0000).
// Shows Remaining Plan Amount below Total Plan Amount. Added border & margin to installment items. Taller Progress Bar.
// Ensures DB update before local state change. Consistent address display.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    StyleSheet, Text, View, SafeAreaView, ScrollView, FlatList,
    ActivityIndicator, TouchableOpacity, StatusBar, Image, Platform, Alert
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons'; // Using FontAwesome5 for icons
import {
    getFirestore, doc, updateDoc, Timestamp, // Ensure Timestamp is imported
    getDoc, // Added for fetching user token
} from 'firebase/firestore';
import { format, isValid, differenceInMilliseconds } from 'date-fns';
import axios from 'axios'; // Added for sending notifications
import { db } from '../../firebaseConfig'; // **** MAKE SURE THIS PATH IS CORRECT ****

// --- Constants ---
// Base UI Colors
const AppBackgroundColor = '#FFFFFF';
const ScreenBackgroundColor = '#F8F9FA';
const CardBackgroundColor = '#FFFFFF';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const PlanAmountColor = '#0056b3';    // Dark Blue for plan amounts
const ProgressBarBackgroundColor = '#E9ECEF'; // Light Gray background for progress bar track

// Status Colors from Reference Code
const PendingColor = '#FFA726';         // Orange (#FFA726)
const ProcessingColor = '#42A5F5';      // Blue (#42A5F5) - Used for Partially Paid too
const ShippedColor = '#66BB6A';         // Greenish (#66BB6A)
const DeliveredColor = '#78909C';       // Gray-Blue (#78909C)
const ActiveColor = '#29B6F6';          // Light Blue (#29B6F6)
const CancelledColor = '#EF5350';       // Red (#EF5350) - Used for Cancelled/Rejected status, Penalty, Due Date, Timer, Back Btn, Total Highlight
const PaidColor = '#4CAF50';            // Green (#4CAF50) - Used for Paid status, Paid Date Text
const UnknownColor = '#BDBDBD';         // Gray (#BDBDBD)

// Action/Highlight Colors - Specific Reds as requested
const ActionButtonRed = '#FF0000';       // BRIGHT RED (#FF0000) for Buttons, Progress Bar Fill, Highlight Text & BORDER
// const HighlightBgColor = '#FEE2E2';   // Removed - No background fill for highlight needed

// Other Essential Constants
const CURRENCY_SYMBOL = 'PKR';
const BNPL_TYPE = 'BNPL';
const FIXED_TYPE = 'Fixed Duration';
const COD_TYPE = 'COD';
const MIXED_TYPE = 'Mixed';
const INSTALLMENT_LABEL = 'Installment';
const PAID_STATUS = 'Paid';
const PENDING_STATUS = 'Pending';
const PARTIALLY_PAID_STATUS = 'Partially Paid';
const DELIVERED_STATUS = 'Delivered';
const ORDERS_COLLECTION = 'orders';
const USERS_COLLECTION = 'Users'; // Firestore collection for user data (tokens)
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send"; // Expo API endpoint

const ONE_SECOND = 1000;
const ONE_MINUTE = ONE_SECOND * 60;
const ONE_HOUR = ONE_MINUTE * 60;
const ONE_DAY = ONE_HOUR * 24;


// --- Helper Functions ---

/**
 * Formats a Firestore Timestamp or Date object into 'MMM d, yyyy' format.
 * @param {Timestamp|Date|null|undefined} timestamp The timestamp or date object.
 * @returns {string} Formatted date string or 'N/A'.
 */
const formatShortDate = (timestamp) => {
    let dateToFormat = null;
    if (timestamp && typeof timestamp.toDate === 'function') { // Firestore Timestamp
        try { dateToFormat = timestamp.toDate(); } catch (e) { console.warn("Timestamp toDate conversion error", e); }
    } else if (timestamp instanceof Date) { // JavaScript Date object
        dateToFormat = timestamp;
    }
    // Check if we have a valid date object before formatting
    if (dateToFormat && isValid(dateToFormat)) {
        try { return format(dateToFormat, 'MMM d, yyyy'); } catch (e) { return 'Invalid Date'; }
    }
    return 'N/A'; // Return 'N/A' for invalid or null inputs
};

/**
 * Formats a Firestore Timestamp or Date object into 'MMM d, yyyy, h:mm a' format.
 * @param {Timestamp|Date|null|undefined} timestamp The timestamp or date object.
 * @returns {string} Formatted date and time string or 'N/A'.
 */
const formatDateAndTime = (timestamp) => {
    let dateToFormat = null;
    if (timestamp && typeof timestamp.toDate === 'function') { // Firestore Timestamp
        try { dateToFormat = timestamp.toDate(); } catch (e) { console.warn("Timestamp toDate conversion error (DateTime)", e); }
    } else if (timestamp instanceof Date) { // JavaScript Date object
        dateToFormat = timestamp;
    }
    // Check if we have a valid date object before formatting
    if (dateToFormat && isValid(dateToFormat)) {
        try { return format(dateToFormat, 'MMM d, yyyy, h:mm a'); } catch (e) { return 'Invalid Date'; }
    }
    return 'N/A'; // Return 'N/A' for invalid or null inputs
};

/**
 * Returns the appropriate style object for the overall order/payment status badge.
 * Uses the color scheme defined in the constants, derived from the reference code.
 * @param {string|null|undefined} status The status string.
 * @returns {object} Style object for the badge background.
 */
const getOverallStatusStyle = (status) => {
    const lowerStatus = status?.toLowerCase() || 'unknown';
    switch (lowerStatus) {
        case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': case 'unpaid (bnpl)': return styles.statusPending;
        case 'processing': case PARTIALLY_PAID_STATUS.toLowerCase(): return styles.statusProcessing; // Map partially paid to processing color
        case 'shipped': return styles.statusShipped;
        case 'delivered': return styles.statusDelivered;
        case 'active': return styles.statusActive;
        case 'cancelled': case 'rejected': return styles.statusCancelled;
        case PAID_STATUS.toLowerCase(): return styles.statusPaid; // Use the specific 'Paid' style from reference
        default: return styles.statusUnknown;
    }
};

/**
 * Returns the appropriate style object for an individual installment status badge.
 * @param {string|null|undefined} status The status string ('Paid' or 'Pending').
 * @returns {object} Style object for the badge background.
 */
const getInstallmentStatusStyle = (status) => {
    // Use specific styles defined at the bottom matching PaidColor and PendingColor
    return (status?.toLowerCase() === PAID_STATUS.toLowerCase())
        ? styles.statusPaidInstallment   // Style using PaidColor (Green)
        : styles.statusPendingInstallment; // Style using PendingColor (Orange)
};

/**
 * Formats the time difference into a readable countdown string (e.g., "2d 5h 10m left").
 * Handles overdue and due now cases.
 * @param {number} milliseconds The time difference in milliseconds.
 * @returns {string} Formatted countdown string, "Due Now", or "Overdue".
 */
const formatTimeDifference = (milliseconds) => {
    if (milliseconds <= 0) {
        // If slightly negative due to timing, show "Due Now" for a short grace period (e.g., 1 minute)
        if (milliseconds > -ONE_MINUTE) {
            return "Due Now";
        }
        return "Overdue"; // If truly past due
    }

    // Calculate days, hours, minutes
    const days = Math.floor(milliseconds / ONE_DAY);
    const hours = Math.floor((milliseconds % ONE_DAY) / ONE_HOUR);
    const minutes = Math.floor((milliseconds % ONE_HOUR) / ONE_MINUTE);

    // Build the string parts
    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    // If less than a minute left, show seconds instead
    if (parts.length === 0) {
        const seconds = Math.floor((milliseconds % ONE_MINUTE) / ONE_SECOND);
        if (seconds > 0) return `${seconds}s left`;
        return "Due Now"; // If exactly 0 or very close
    }

    // Join the parts with spaces and add "left"
    return parts.join(' ') + " left";
};

/**
 * Fetches the Expo Push Token for a given user ID from Firestore.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<string|null>} The push token or null if not found/error.
 */
async function getUserExpoToken(userId) {
    if (!userId) {
        console.error("[getUserExpoToken] Attempted to fetch token with missing userId.");
        return null;
    }
    try {
        const userDocRef = doc(db, USERS_COLLECTION, userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const token = userDocSnap.data()?.expoPushToken;
            // Basic validation for Expo token format
            if (token && typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))) {
                console.log(`[getUserExpoToken] Found token for user ${userId}.`);
                 return token;
            } else {
                 console.log(`[getUserExpoToken] Invalid or missing token found for user ${userId}. Token value:`, token);
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

/**
 * Sends a push notification via the Expo Push API.
 * @param {string} pushToken - The recipient's Expo Push Token.
 * @param {string} title - The notification title.
 * @param {string} body - The notification body.
 * @param {object} [data={}] - Optional data payload.
 */
async function sendExpoPushNotification(pushToken, title, body, data = {}) {
    if (!pushToken) {
        console.log("Skipping notification: No push token provided.");
        return;
    }
    const message = {
        to: pushToken,
        sound: 'default',
        title: title,
        body: body,
        data: data, // Include extra data if needed by the app when notification is opened
        priority: 'high', // Or 'normal'
        channelId: 'payment-confirmations', // Ensure this channel is created on the client-side (Android)
    };

    console.log(`Sending push notification to token: ${pushToken.substring(0,25)}...`);

    try {
        await axios.post(EXPO_PUSH_ENDPOINT, [message], {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Accept-encoding': 'gzip, deflate', // Recommended by Expo docs
            },
            timeout: 10000, // 10 second timeout
        });
        console.log("Push notification sent successfully via Expo API.");
    } catch (error) {
        console.error("Error sending push notification via Expo API:", error.response?.data || error.message || error);
        // Consider more specific error handling based on Expo's response codes if needed
        // e.g., if (error.response?.data?.errors?.[0]?.code === 'PUSH_TOO_MANY_EXPERIENCE_IDS') { ... }
    }
}
// --- End Helper Functions ---


// --- Main Component Definition ---
export default function UserSchedulesProgressDetails() {
    // --- Hooks ---
    const route = useRoute(); // Access navigation parameters
    const navigation = useNavigation(); // Access navigation object (e.g., for goBack)
    const initialOrder = route.params?.order; // Get the order object passed from the previous screen

    // --- Component State ---
    const [order, setOrder] = useState(initialOrder); // Local state for the order details, allows UI updates
    const [isLoading, setIsLoading] = useState(false); // Global loading state for any Firestore update operation
    const [updatingInstallmentIndex, setUpdatingInstallmentIndex] = useState(null); // Track which specific installment button is loading
    const [timeLeft, setTimeLeft] = useState(''); // State to hold the formatted countdown string for the next installment
    const timerIntervalRef = useRef(null); // Ref to hold the interval ID for cleanup on unmount/update

    // --- Effect to Sync Local State with Route Params ---
    // If the screen receives new params (e.g., navigating again with updated data), update local state.
    useEffect(() => {
        if (initialOrder) { // Only update if initialOrder is valid
            setOrder(initialOrder);
        }
    }, [initialOrder]); // Dependency array: run effect when initialOrder changes

    // --- Memoized Calculations for Performance ---
    // Calculate the index of the next installment that needs payment
    const nextPendingInstallmentIndex = useMemo(() => {
        if (!order?.installments) return -1; // Handle case where installments array is missing
        // Find the index of the first installment whose status is not 'Paid' (case-insensitive)
        return order.installments.findIndex(inst => inst.status?.toLowerCase() !== PAID_STATUS.toLowerCase());
    }, [order?.installments]); // Recalculate only if the installments array changes

    // Count how many installments have been paid
    const paidInstallmentCount = useMemo(() => {
        if (!order?.installments) return 0; // Handle missing installments array
        // Filter the array for 'Paid' status and get the length
        return order.installments.filter(inst => inst.status?.toLowerCase() === PAID_STATUS.toLowerCase()).length;
    }, [order?.installments]); // Recalculate only if installments change

    // Get the total number of installments
    const totalInstallmentCount = order?.installments?.length || 0;

    // Calculate the progress percentage for the visual progress bar
    const progressPercent = useMemo(() => {
        if (totalInstallmentCount === 0) return 0; // Avoid division by zero
        // Calculate percentage
        return (paidInstallmentCount / totalInstallmentCount) * 100;
    }, [paidInstallmentCount, totalInstallmentCount]); // Recalculate if counts change

    // Calculate Remaining Installment Amount
    const remainingInstallmentAmount = useMemo(() => {
        if (!order?.installments || order.installments.length === 0) return 0;
        // Sum the amounts of installments that are NOT paid
        return order.installments.reduce((sum, inst) => {
            if (inst.status?.toLowerCase() !== PAID_STATUS.toLowerCase() && typeof inst.amount === 'number') {
                return sum + inst.amount;
            }
            return sum;
        }, 0); // Start sum at 0
    }, [order?.installments]); // Recalculate if installments change

    // --- Effect for Countdown Timer ---
    // This effect sets up and cleans up the interval timer for the countdown display.
    useEffect(() => {
        // Clear any existing timer interval when the component re-renders or dependencies change
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        setTimeLeft(''); // Reset the display initially

        // Check if there is a valid next pending installment to calculate time for
        if (nextPendingInstallmentIndex >= 0 && order?.installments?.[nextPendingInstallmentIndex]) {
            const nextInstallment = order.installments[nextPendingInstallmentIndex];
            const dueDateTimestamp = nextInstallment.dueDate; // Get the due date (Timestamp or Date)

            // Convert Firestore Timestamp or check JS Date validity
            let dueDate = null;
            if (dueDateTimestamp && typeof dueDateTimestamp.toDate === 'function') {
                try { dueDate = dueDateTimestamp.toDate(); } catch (e) { console.warn("Timer: Invalid due date format for conversion"); }
            } else if (dueDateTimestamp instanceof Date && isValid(dueDateTimestamp)) {
                 dueDate = dueDateTimestamp; // Already a valid JS Date
            }

            // Proceed only if we have a valid JS Date object
            if (dueDate && isValid(dueDate)) {
                // Function to calculate and update the time difference
                const updateTimer = () => {
                    const now = new Date(); // Get current time
                    const diff = differenceInMilliseconds(dueDate, now); // Calculate difference

                    // Update the state with the formatted time string
                    setTimeLeft(formatTimeDifference(diff));

                    // Stop the timer if the due date has passed
                    if (diff <= 0 && timerIntervalRef.current) {
                        clearInterval(timerIntervalRef.current);
                        timerIntervalRef.current = null;
                    }
                };

                updateTimer(); // Run immediately to set the initial value
                // Set up an interval to update the timer every second
                // Store the interval ID in the ref so it can be cleared later
                timerIntervalRef.current = setInterval(updateTimer, ONE_SECOND);
            } else {
                setTimeLeft('Invalid Date'); // Show error if due date is invalid
            }
        }

        // Cleanup Function: This runs when the component unmounts or before the effect runs again
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current); // Clear the interval to prevent memory leaks
            }
        };
    }, [order?.installments, nextPendingInstallmentIndex]); // Rerun effect if installments or the next index changes


    // --- Fallback Render for Missing Order Data ---
    // If the order data wasn't passed correctly, show an error message.
    if (!order || !order.id) {
        return (
             <SafeAreaView style={styles.centeredContainer}>
                <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
                {/* Use CancelledColor (#EF5350) which matches the old PenaltyDueDateColor */}
                <MaterialIcons name="error-outline" size={60} color={CancelledColor} />
                <Text style={styles.errorText}>Order details are missing or invalid.</Text>
                {/* Provide a way back if possible */}
                {navigation.canGoBack() && (
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </TouchableOpacity>
                )}
            </SafeAreaView>
        );
    }

    // --- Function to Recalculate Overall Payment/Order Status ---
    // This logic determines if the order is 'Paid', 'Partially Paid', or still 'Pending'/'Unpaid'
    // It also potentially updates the main order status (e.g., to 'Delivered').
    const checkAndUpdateOverallPaymentStatus = useCallback((updatedOrderData) => {
        // Safety check for input data
        if (!updatedOrderData) return { paymentStatus: PENDING_STATUS, status: PENDING_STATUS };

        const {
            paymentMethod, installments, codAmount, codPaymentReceivedAt,
            fixedDurationAmountDue, paymentDueDate, paymentReceivedAt
        } = updatedOrderData;

        let allPaid = true; // Assume everything is paid until proven otherwise
        let finalOrderStatus = updatedOrderData.status || PENDING_STATUS; // Start with the current status

        // 1. Check Installments: If any installment exists and is not 'Paid', it's not fully paid.
        if (Array.isArray(installments) && installments.length > 0) {
            if (!installments.every(inst => inst.status?.toLowerCase() === PAID_STATUS.toLowerCase())) {
                allPaid = false;
            }
        } else if(paymentMethod === BNPL_TYPE) {
             // If it's explicitly BNPL but has no installments, treat as not fully paid (data inconsistency likely)
             allPaid = false;
        }

        // 2. Check Fixed Duration Part: If a fixed payment is defined but not paid, it's not fully paid.
        const hasFixed = paymentMethod === FIXED_TYPE || (paymentMethod === MIXED_TYPE && (!!paymentDueDate || typeof fixedDurationAmountDue === 'number'));
        if (hasFixed && !paymentReceivedAt) {
             allPaid = false;
        }

        // 3. Check COD Part: If COD is defined but not paid, it's not fully paid.
        const hasCOD = paymentMethod === MIXED_TYPE && typeof codAmount === 'number' && codAmount > 0;
        if (hasCOD && !codPaymentReceivedAt) {
             allPaid = false;
        }

        // Determine the final Payment Status and Order Status based on 'allPaid'
        let newPaymentStatus = updatedOrderData.paymentStatus || PENDING_STATUS;
        if (allPaid) {
            newPaymentStatus = PAID_STATUS; // If all components are paid, set status to 'Paid'
            // Check if the order status can be moved to 'Delivered' (or maybe just 'Paid')
            const eligibleForDeliveryUpdate = !['cancelled', 'rejected', DELIVERED_STATUS.toLowerCase(), PAID_STATUS.toLowerCase()].includes(finalOrderStatus?.toLowerCase());
            if (eligibleForDeliveryUpdate) {
                 finalOrderStatus = DELIVERED_STATUS; // Consider changing this to PAID_STATUS if delivery is separate
             }
        } else {
             // Not all paid, check if *any* payment has occurred
             const anyInstallmentPaid = Array.isArray(installments) && installments.some(inst => inst.status?.toLowerCase() === PAID_STATUS.toLowerCase());
             if (paymentReceivedAt || codPaymentReceivedAt || anyInstallmentPaid) {
                 newPaymentStatus = PARTIALLY_PAID_STATUS; // If some payment made, it's 'Partially Paid'
             } else {
                 // If nothing has been paid yet, keep the original specific pending status
                 newPaymentStatus = updatedOrderData.paymentStatus;
             }
        }
        // Return the calculated statuses
        return { paymentStatus: newPaymentStatus, status: finalOrderStatus };
    }, []); // Empty dependency array because it uses the passed argument, not external state/props directly


    // --- Handler for Marking Fixed Duration Payment as Paid ---
    const handleMarkFixedPaid = async () => {
        // Prevent action if already paid, another operation is loading, or order is missing
        if (!order || order.paymentReceivedAt || isLoading) {
             if(order?.paymentReceivedAt) Alert.alert("Info", "Fixed duration payment is already marked as paid.");
             return;
        }

        // Confirmation dialog
        Alert.alert(
            "Confirm Payment Received", // Dialog Title
            `Mark the Fixed Duration payment of ${CURRENCY_SYMBOL}${order.fixedDurationAmountDue?.toLocaleString() ?? order.bnplAmount?.toLocaleString() ?? 'N/A'} as received?`, // Dialog Message
            [
                { text: "Cancel", style: "cancel" }, // Cancel Button
                {
                    text: "Confirm & Update", // Confirm Button
                    onPress: async () => { // Action on confirmation
                        setIsLoading(true); // Set loading state
                        const orderRef = doc(db, ORDERS_COLLECTION, order.id); // Reference to the Firestore document
                        const paidAtTimestamp = Timestamp.now(); // Record the time of payment

                        try {
                            // Prepare the basic update data
                            const baseUpdateData = { paymentReceivedAt: paidAtTimestamp };
                            // Calculate the potentially new overall statuses based on this update
                            const tempUpdatedOrder = { ...order, ...baseUpdateData }; // Simulate the update
                            const { paymentStatus: newPaymentStatus, status: newOrderStatus } = checkAndUpdateOverallPaymentStatus(tempUpdatedOrder);

                            // *** CRITICAL: Update Firestore FIRST ***
                            // Combine base data with calculated statuses for the update
                            await updateDoc(orderRef, {
                                ...baseUpdateData, // paymentReceivedAt
                                paymentStatus: newPaymentStatus, // Updated payment status
                                status: newOrderStatus // Updated order status
                            });
                            console.log("Firestore updated successfully for Fixed Duration payment.");

                            // *** THEN: Update Local UI State ***
                            // Create the final state object AFTER successful DB update
                            const finalUpdatedOrder = { ...order, ...baseUpdateData, paymentStatus: newPaymentStatus, status: newOrderStatus };
                            setOrder(finalUpdatedOrder); // Update the local 'order' state

                            Alert.alert("Success", "Fixed duration payment marked as paid.");

                            // *** Trigger Notification ***
                            if (finalUpdatedOrder.userId) { // Ensure userId exists before attempting notification
                                const userToken = await getUserExpoToken(finalUpdatedOrder.userId); // Fetch token
                                if (userToken) {
                                     await sendExpoPushNotification( // Send notification
                                         userToken,
                                         `Payment Received! (Order #${finalUpdatedOrder.orderNumber || finalUpdatedOrder.id.substring(0, 6)})`,
                                         `Admin confirmed your fixed payment of ${CURRENCY_SYMBOL}${finalUpdatedOrder.fixedDurationAmountDue?.toLocaleString() ?? finalUpdatedOrder.bnplAmount?.toLocaleString() ?? 'N/A'}.`,
                                         { orderId: finalUpdatedOrder.id, type: 'paymentConfirmation' } // Optional data payload
                                     );
                                 }
                            } else {
                                console.warn("Cannot send fixed payment notification: userId missing.");
                            }

                        } catch (error) {
                             // Handle potential Firestore errors
                             console.error("Error marking fixed duration paid:", error);
                             Alert.alert("Error", "DATABASE UPDATE FAILED. Payment status not updated. Please check connection and try again.");
                        } finally {
                            setIsLoading(false); // Ensure loading state is reset
                        }
                    }
                }
            ]
        );
    };

    // --- Handler for Marking an Installment as Paid ---
    const handleMarkInstallmentPaid = async (installmentIndex) => {
        // Validate inputs and state
        if (!order || !order.installments || !order.installments[installmentIndex] || isLoading) return;

        // Ensure admin is marking the *next* pending installment
        if (installmentIndex !== nextPendingInstallmentIndex) {
             Alert.alert("Info", `Please mark payments in order. The next due installment is #${nextPendingInstallmentIndex >= 0 ? (order.installments[nextPendingInstallmentIndex]?.installmentNumber || nextPendingInstallmentIndex + 1) : 'N/A'}.`);
             return;
        }

        const installmentToUpdate = order.installments[installmentIndex];
        // Check if this installment is already marked as paid
        if (installmentToUpdate.status?.toLowerCase() === PAID_STATUS.toLowerCase()) {
             Alert.alert("Info", "This installment is already marked as paid.");
             return;
        }

        // Confirmation dialog
        Alert.alert(
            "Confirm Payment Received", // Dialog Title
            `Mark Installment #${installmentToUpdate.installmentNumber || installmentIndex + 1} (${CURRENCY_SYMBOL}${installmentToUpdate.amount?.toLocaleString()}) as received?`, // Dialog Message
            [
                { text: "Cancel", style: "cancel" }, // Cancel Button
                {
                    text: "Confirm & Update", // Confirm Button
                    onPress: async () => { // Action on confirmation
                        setUpdatingInstallmentIndex(installmentIndex); // Show loader on this specific installment button
                        setIsLoading(true); // Set global loading state
                        const orderRef = doc(db, ORDERS_COLLECTION, order.id); // Firestore doc ref
                        const paidAtTimestamp = Timestamp.now(); // Payment time
                        let updatedInstallments = []; // Define outside try block for notification access

                        try {
                             // Create the new, updated array of installments
                             updatedInstallments = order.installments.map((inst, index) =>
                                 (index === installmentIndex)
                                     ? { ...inst, status: PAID_STATUS, paidAt: paidAtTimestamp } // Update the target installment
                                     : inst // Keep others unchanged
                             );

                             // Calculate the potentially new overall statuses based on this update
                             const tempUpdatedOrder = { ...order, installments: updatedInstallments }; // Simulate update
                             const { paymentStatus: newPaymentStatus, status: newOrderStatus } = checkAndUpdateOverallPaymentStatus(tempUpdatedOrder);

                             // *** CRITICAL: Update Firestore FIRST ***
                             // Pass the entire updated installments array and calculated statuses
                             await updateDoc(orderRef, {
                                 installments: updatedInstallments,
                                 paymentStatus: newPaymentStatus,
                                 status: newOrderStatus
                             });
                             console.log(`Firestore updated successfully for Installment #${installmentIndex + 1}.`);

                             // *** THEN: Update Local UI State ***
                             // Create the final state object AFTER successful DB update
                             const finalUpdatedOrder = { ...order, installments: updatedInstallments, paymentStatus: newPaymentStatus, status: newOrderStatus };
                             setOrder(finalUpdatedOrder); // Update local state

                             Alert.alert("Success", `Installment #${installmentToUpdate.installmentNumber || installmentIndex + 1} marked as paid.`);

                             // *** Trigger Notification ***
                             if (finalUpdatedOrder.userId) { // Ensure userId exists
                                const userToken = await getUserExpoToken(finalUpdatedOrder.userId); // Fetch token
                                if (userToken) {
                                     const currentInstallmentNumber = installmentToUpdate.installmentNumber || installmentIndex + 1;
                                     let notificationBody = `Admin confirmed payment for Installment #${currentInstallmentNumber} (${CURRENCY_SYMBOL}${installmentToUpdate.amount?.toLocaleString()}) on Order #${finalUpdatedOrder.orderNumber || finalUpdatedOrder.id.substring(0,6)}.`;

                                     // Find the next pending installment *in the updated array*
                                     const nextIndexAfterUpdate = updatedInstallments.findIndex(inst => inst.status?.toLowerCase() !== PAID_STATUS.toLowerCase());
                                     if (nextIndexAfterUpdate >= 0) { // If a next pending installment exists
                                         const nextInstallmentDetails = updatedInstallments[nextIndexAfterUpdate];
                                         const nextDueDateFormatted = formatShortDate(nextInstallmentDetails.dueDate);
                                         notificationBody += ` Next due: ${nextDueDateFormatted}.`;
                                     } else {
                                        // This was the last installment paid
                                        notificationBody += ` All installments for this order are now paid!`;
                                     }

                                     await sendExpoPushNotification( // Send notification
                                         userToken,
                                         `Installment #${currentInstallmentNumber} Paid`, // Notification Title
                                         notificationBody, // Constructed Body
                                         { orderId: finalUpdatedOrder.id, installmentNumber: currentInstallmentNumber, type: 'installmentConfirmation' } // Optional data
                                     );
                                 }
                             } else {
                                console.warn("Cannot send installment notification: userId missing.");
                             }

                        } catch (error) {
                             // Handle potential Firestore errors
                             console.error("Error marking installment paid:", error);
                             Alert.alert("Error", "DATABASE UPDATE FAILED. Installment status not updated. Please check connection and try again.");
                        } finally {
                            // Reset loading states
                            setIsLoading(false);
                             setUpdatingInstallmentIndex(null);
                        }
                    }
                }
            ]
        );
    };


    // --- Determine Payment Method and Components (Safe access with ?. ) ---
    // These values are derived from the local 'order' state and used for rendering decisions
    const paymentMethod = order?.paymentMethod || 'Unknown';
    const isPureInstallment = paymentMethod === BNPL_TYPE;
    const isPureFixed = paymentMethod === FIXED_TYPE;
    const isMixed = paymentMethod === MIXED_TYPE;
    // Check if specific payment components are defined in the order data
    const hasCodComponentDefined = typeof order?.codAmount === 'number' && order.codAmount > 0;
    const hasInstallmentComponentDefined = Array.isArray(order?.installments) && order.installments.length > 0;
    const hasFixedDurationComponentDefined = !!order?.paymentDueDate || !!order?.fixedDurationAmountDue || !!order?.fixedDurationDetails;
    // Determine which sections to show based on defined components
    const showCodSection = hasCodComponentDefined;
    const showInstallmentSection = hasInstallmentComponentDefined;
    const showFixedDurationSection = hasFixedDurationComponentDefined;

    // Determine the label to display for the payment method
    let displayPaymentLabel = paymentMethod;
    if (isPureInstallment) displayPaymentLabel = INSTALLMENT_LABEL; // Use 'Installment' label for BNPL

    // Format display values safely
    const displayId = order?.orderNumber ? `#${order.orderNumber}` : `#${order?.id?.substring(0, 6).toUpperCase() || 'N/A'}`;
    const orderStatus = order?.status || 'Unknown';
    const paymentStatus = order?.paymentStatus || 'N/A';
    const relevantPlanDetails = order?.bnplPlanDetails || order?.fixedDurationDetails; // Get plan details object


    // --- Render Function for Individual Installment Item ---
    // This function is passed to the FlatList to render each row
    const renderInstallmentItem = ({ item, index }) => {
        // Basic validation for the installment item data
        if (!item || typeof item.amount !== 'number') return null; // Don't render if data is invalid

        const installmentStatus = item.status || PENDING_STATUS; // Default to Pending if status is missing
        const isPaid = installmentStatus.toLowerCase() === PAID_STATUS.toLowerCase();
        const isNextPending = index === nextPendingInstallmentIndex; // Is this the specific installment that's due next?
        const isUpdatingThis = updatingInstallmentIndex === index; // Is this specific item's button currently loading?

        return (
            // Apply highlight style (light red background only, subtle border) if it's the next pending installment
            <View style={[styles.installmentRow, isNextPending && styles.nextInstallmentHighlight]}>
                 {/* Left Column: Installment Number, Amount, Penalty */}
                 <View style={styles.installmentLeft}>
                    {/* Apply bright red text color to the number if it's the next pending */}
                    <Text style={[styles.installmentNumber, isNextPending && styles.nextInstallmentText]}>
                        Inst. #{item.installmentNumber || index + 1} {/* Use provided number or index */}
                    </Text>
                    <Text style={styles.installmentAmount}>{CURRENCY_SYMBOL} {item.amount?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 'N/A'}</Text>
                    {/* Display penalty amount if it exists and is greater than 0 */}
                    {typeof item.penalty === 'number' && item.penalty > 0 && (<Text style={styles.penaltyText}>Penalty: {CURRENCY_SYMBOL}{item.penalty.toFixed(0)}</Text>)}
                 </View>

                 {/* Right Column: Status Badge, Due Date / Paid Date / Timer, Action Button */}
                 <View style={styles.installmentRight}>
                     {/* Status Badge (Green for Paid, Orange for Pending) */}
                     <View style={[styles.statusBadgeSmall, getInstallmentStatusStyle(installmentStatus)]}><Text style={styles.statusTextSmall}>{installmentStatus}</Text></View>

                     {/* Due Date with Icon */}
                     <View style={styles.dateRow}>
                        <FontAwesome5 name="calendar-alt" size={11} color={TextColorSecondary} style={styles.dateIcon} />
                        <Text style={styles.installmentDueDate}>Due: {formatShortDate(item.dueDate)}</Text>
                     </View>

                     {/* Conditional Display: Timer or Paid Date */}
                     {/* Show Timer only for the next pending installment if time is calculated */}
                     {isNextPending && !isPaid && timeLeft ? (
                        <Text style={styles.timerText}>{timeLeft}</Text>
                     ) : null }
                     {/* Show paid date (GREEN) with check icon only if paid and date exists */}
                     {isPaid && item.paidAt && (
                        <View style={styles.dateRow}>
                             <FontAwesome5 name="check-circle" size={11} color={PaidColor} style={styles.dateIcon} />
                             <Text style={styles.paidDateTextGreen}>Paid: {formatShortDate(item.paidAt)}</Text>
                        </View>
                      )}

                     {/* "Mark Paid" Button (Bright Red): Show ONLY for the next pending installment */}
                     {isNextPending && !isPaid && (
                         <TouchableOpacity
                             style={[styles.markPaidButtonSmall, (isLoading && !isUpdatingThis) && styles.disabledButton]} // Dim if another action is loading
                             onPress={() => handleMarkInstallmentPaid(index)}
                             disabled={isLoading} // Disable button during any loading operation
                         >
                            {/* Show ActivityIndicator if this specific button was pressed */}
                            {isUpdatingThis ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.markPaidButtonTextSmall}>Mark Paid</Text> // Show button text
                            )}
                         </TouchableOpacity>
                     )}
                 </View>
            </View>
        );
    };

    // --- Main JSX Render Structure ---
    return (
        <SafeAreaView style={styles.container}>
            {/* Configure Status Bar */}
            <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
            {/* Use ScrollView to allow content to scroll if it exceeds screen height */}
            <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">

                 {/* Card 1: Order Summary */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Order Summary</Text>
                    {/* Detail Rows for Order Info */}
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Order ID</Text><Text style={styles.detailValue}>{displayId}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Order Date</Text><Text style={styles.detailValue}>{formatDateAndTime(order?.createdAt || order?.orderDate)}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Order Status</Text><View style={[styles.statusBadge, getOverallStatusStyle(orderStatus)]}><Text style={styles.statusText}>{orderStatus}</Text></View></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Payment Status</Text><View style={[styles.statusBadge, getOverallStatusStyle(paymentStatus)]}><Text style={styles.statusText}>{paymentStatus}</Text></View></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Payment Method</Text><Text style={styles.detailValue}>{displayPaymentLabel}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Grand Total</Text><Text style={[styles.detailValue, styles.totalValueHighlight]}>{CURRENCY_SYMBOL} {(order?.grandTotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>
                </View>

                {/* Card 2: Customer Information */}
                 <View style={styles.card}>
                     <Text style={styles.cardTitle}>Customer Information</Text>
                     {/* Detail Rows with Icons */}
                     <View style={styles.detailRow}><FontAwesome5 name="user-circle" size={16} color={TextColorSecondary} style={styles.iconStyle}/><Text style={styles.detailLabel}>Name</Text><Text style={styles.detailValue}>{order?.userName || 'N/A'}</Text></View>
                     <View style={styles.detailRow}><FontAwesome5 name="phone" size={16} color={TextColorSecondary} style={styles.iconStyle}/><Text style={styles.detailLabel}>Phone</Text><Text style={styles.detailValue}>{order?.userPhone || 'N/A'}</Text></View>
                     {/* Display User ID if it exists */}
                     {order?.userId && <View style={styles.detailRow}><FontAwesome5 name="id-badge" size={16} color={TextColorSecondary} style={styles.iconStyle}/><Text style={styles.detailLabel}>User ID</Text><Text style={[styles.detailValue, {fontSize: 12}]}>{order.userId}</Text></View>}
                     {/* Address Row using standard detailRow/detailValue */}
                     <View style={styles.detailRow}>
                        <FontAwesome5 name="map-marker-alt" size={16} color={TextColorSecondary} style={[styles.iconStyle, {marginTop: 2}]}/>
                        <Text style={styles.detailLabel}>Address</Text>
                        <Text style={styles.detailValue}>{order?.userAddress || 'N/A'}</Text>
                    </View>
                 </View>

                {/* Card 3: Payment Breakdown */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Payment Breakdown</Text>

                    {/* --- COD Component (Conditional Rendering) --- */}
                    {showCodSection && (
                         <View style={styles.paymentSubSection}>
                             <Text style={styles.paymentSubHeader}>Cash on Delivery Portion</Text>
                             <View style={styles.detailRow}><Text style={styles.detailLabel}>Amount Due (COD)</Text><Text style={styles.codAmountValue}>{CURRENCY_SYMBOL} {(order?.codAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>
                             {/* Show paid date or pending status */}
                             {order?.codPaymentReceivedAt ? (
                                 <View style={styles.detailRow}><Text style={styles.detailLabel}>COD Paid At</Text><Text style={styles.detailValue}>{formatDateAndTime(order.codPaymentReceivedAt)}</Text></View>
                             ) : (
                                 <View style={styles.detailRow}><Text style={styles.detailLabel}>Status</Text><Text style={styles.pendingTextCod}>Pending Collection</Text></View>
                             )}
                        </View>
                    )}

                    {/* --- Installment Component (Conditional Rendering) --- */}
                    {showInstallmentSection && (
                        <View style={[styles.paymentSubSection, showCodSection && styles.subSectionSpacing]}>
                            <Text style={styles.paymentSubHeader}>Installment Plan</Text>
                             {/* Display textual progress */}
                             <Text style={styles.installmentProgressText}>
                                {paidInstallmentCount} of {totalInstallmentCount} Installments Paid
                             </Text>

                            {/* --- Visual Progress Bar (Bright Red Fill) --- */}
                            {totalInstallmentCount > 0 && ( // Only show if there are installments
                                <View style={styles.progressBarContainer}>
                                    <View style={styles.progressBarBackground}>
                                        {/* The fill width dynamically set by progressPercent */}
                                        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                                    </View>
                                </View>
                            )}
                            {/* --- End Progress Bar --- */}

                             {/* Display BNPL Plan details and Remaining Amount */}
                             {relevantPlanDetails && (isPureInstallment || hasInstallmentComponentDefined) && (
                                <View style={styles.planDetailsBox}>
                                    {/* Display Total Plan Amount */}
                                    <View style={styles.detailRow}>
                                        <Text style={[styles.summaryLabel, styles.planLabel]}>Total Plan Amount:</Text>
                                        <Text style={styles.planAmountHighlight}>{CURRENCY_SYMBOL} {(order?.bnplAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                                    </View>
                                    {/* Display Remaining Amount Below Total */}
                                    {totalInstallmentCount > 0 && remainingInstallmentAmount >= 0 && (
                                        <View style={[styles.detailRow, { borderBottomWidth: 0, paddingTop: 4 }]}>
                                             <Text style={[styles.summaryLabel, styles.remainingAmountLabel]}>Amount Remaining:</Text>
                                             <Text style={[styles.summaryValue, styles.remainingAmountValue]}>{CURRENCY_SYMBOL} {remainingInstallmentAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                                         </View>
                                     )}
                                    {/* Other Plan Details */}
                                    <Text style={styles.planDetailText}><Text style={styles.planLabel}>Plan Name:</Text> {relevantPlanDetails.name || 'N/A'}</Text>
                                    <Text style={styles.planDetailText}><Text style={styles.planLabel}>Duration:</Text> {relevantPlanDetails.duration || 'N/A'} Months</Text>
                                </View>
                             )}

                            {/* Render the FlatList of installment items */}
                            {hasInstallmentComponentDefined && order?.installments ? (
                                <FlatList
                                    data={order.installments}
                                    renderItem={renderInstallmentItem} // Use the function defined above
                                    keyExtractor={(item, index) => item?.installmentNumber ? `inst-${item.installmentNumber}-${index}` : `inst-${index}`} // Unique key for each row
                                    scrollEnabled={false} // Important inside ScrollView
                                    ListEmptyComponent={<Text style={styles.emptyListText}>Installment details missing.</Text>} // Message if array is empty
                                    style={styles.installmentListStyle} // Container style for the list
                                />
                            ) : (
                                // Message if installments are expected but missing, or not applicable
                                <Text style={styles.emptyListText}>{paymentMethod === BNPL_TYPE ? 'Installment schedule missing.' : 'No installments for this order.'}</Text>
                            )}
                         </View>
                    )}

                    {/* --- Fixed Duration Component (Conditional Rendering) --- */}
                    {showFixedDurationSection && (
                        <View style={[styles.paymentSubSection, (showCodSection || showInstallmentSection) && styles.subSectionSpacing]}>
                            <Text style={styles.paymentSubHeader}>Fixed Duration Payment</Text>
                             {/* Display Fixed Duration Plan details if available */}
                             {relevantPlanDetails && (isPureFixed || hasFixedDurationComponentDefined) && relevantPlanDetails.name && (
                                 <View style={styles.planDetailsBox}>
                                     <Text style={styles.planDetailText}><Text style={styles.planLabel}>Plan:</Text> {relevantPlanDetails.name}</Text>
                                 </View>
                             )}
                            {/* Display fixed payment details */}
                            <View style={styles.detailRow}><Text style={styles.detailLabel}>Amount Due (Fixed)</Text><Text style={styles.planAmountHighlight}>{CURRENCY_SYMBOL} {(order?.fixedDurationAmountDue ?? order?.bnplAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>
                            <View style={styles.detailRow}><Text style={styles.detailLabel}>Due Date</Text><Text style={[styles.detailValue, styles.dueDateHighlight]}>{formatShortDate(order?.paymentDueDate)}</Text></View>
                            {/* Display Penalty for Fixed Duration if applicable */}
                            {typeof order?.penalty === 'number' && order.penalty > 0 && (
                                 <View style={styles.detailRow}>
                                     <Text style={[styles.detailLabel, styles.penaltyLabel]}>Penalty</Text>
                                     <Text style={[styles.detailValue, styles.penaltyValue]}>{CURRENCY_SYMBOL}{order.penalty.toFixed(0)}</Text>
                                 </View>
                            )}

                             {/* --- Show Paid Info OR the BRIGHT RED "Mark Payment Received" Button --- */}
                             {order?.paymentReceivedAt ? (
                                 <View style={styles.detailRow}><Text style={styles.detailLabel}>Paid At</Text><Text style={styles.detailValue}>{formatDateAndTime(order.paymentReceivedAt)}</Text></View>
                             ) : (
                                 <View style={styles.buttonContainerFixed}>
                                     {/* The main action button */}
                                     <TouchableOpacity
                                         style={[styles.markPaidButtonLarge, isLoading && styles.disabledButton]} // Apply disabled style if loading
                                         onPress={handleMarkFixedPaid}
                                         disabled={isLoading} // Disable button during any loading operation
                                     >
                                         {/* Show loader only if this button's action is running */}
                                         {isLoading && updatingInstallmentIndex === null ? (
                                             <ActivityIndicator size="small" color="#fff" />
                                         ) : (
                                             <Text style={styles.markPaidButtonTextLarge}>Mark Payment Received</Text>
                                         )}
                                     </TouchableOpacity>
                                 </View>
                             )}
                        </View>
                    )}
                </View>
                {/* Add some padding at the very bottom of the scroll view for better UX */}
                <View style={{ height: 20 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    // Overall container styles
    container: { flex: 1, backgroundColor: ScreenBackgroundColor },
    scrollContainer: { flexGrow: 1, paddingVertical: 15, paddingHorizontal: 10 },
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: ScreenBackgroundColor },

    // Error and Back Button Styles
    errorText: { color: CancelledColor, fontSize: 16, textAlign: 'center', marginBottom: 20 }, // Use CancelledColor (#EF5350)
    backButton: { backgroundColor: CancelledColor, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6 }, // Use CancelledColor (#EF5350)
    backButtonText: { color: '#fff', fontWeight: 'bold' },

    // Card Styling for Sections
    card: {
        backgroundColor: CardBackgroundColor, borderRadius: 8, padding: 15, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, borderWidth: Platform.OS === 'android' ? 0 : 1, borderColor: '#E0E0E0',
    },
    cardTitle: {
        fontSize: 18, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10,
    },

    // Detail Row Styling (Label-Value pairs)
    detailRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', minHeight: 35, // Ensure rows have a minimum height
    },
    // Removed addressDetailRow style
    iconStyle: { // Style for icons next to labels
        marginRight: 10, width: 20, // Consistent icon width
        textAlign: 'center', color: TextColorSecondary, // Match secondary text color
    },
    detailLabel: { // Style for the label part (e.g., "Name:")
        fontSize: 14, color: TextColorSecondary, marginRight: 5, // Small space after label
    },
    summaryLabel: { // Base style for summary rows
        fontSize: 14, color: TextColorSecondary, marginRight: 5
    },
    detailValue: { // Style for the value part (e.g., "John Doe", Phone, Address)
        fontSize: 14, fontWeight: '500', // Slightly bolder than label
        color: TextColorPrimary, textAlign: 'right', // Align values to the right
        flexShrink: 1, // Allow text to shrink if needed
        flex: 1, // Allow text to take remaining space
        marginLeft: 10, // Minimum space before the value
    },
     summaryValue: { // Base style for summary values
         fontSize: 14, fontWeight: '500', color: TextColorPrimary, textAlign: 'right', flexShrink: 1,
    },
    // Removed addressValue style

    // Highlight Styles
    totalValueHighlight: { color: CancelledColor, fontWeight: 'bold', fontSize: 15 }, // Use CancelledColor (#EF5350) for total amount
    planAmountHighlight: { color: PlanAmountColor, fontWeight: 'bold', fontSize: 14 }, // Blue plan amount
    dueDateHighlight: { fontWeight: 'bold', color: CancelledColor }, // Use CancelledColor (#EF5350) for due date text
    remainingAmountLabel: { fontWeight: 'bold', color: TextColorPrimary, fontSize: 14 }, // Style for Remaining Amount Label
    remainingAmountValue: { fontWeight: 'bold', color: CancelledColor, fontSize: 15 }, // Style for Remaining Amount Value (#EF5350)

    // Status Badge Styles (Overall Status)
    statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, alignSelf: 'flex-end' },
    statusText: { fontSize: 12, fontWeight: 'bold', color: '#fff' }, // White text generally works well

    // Status Badge Styles (Small, for Installments)
    statusBadgeSmall: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, marginBottom: 3 },
    statusTextSmall: { fontSize: 11, fontWeight: 'bold', color: '#fff' }, // White text for small badges too

    // Payment Breakdown Section Styles
    paymentSubSection: { marginTop: 10, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#eee' }, // Separator for payment types
    subSectionSpacing: { marginTop: 25 }, // Vertical space between payment types (COD, Installment, Fixed)
    paymentSubHeader: { fontSize: 16, fontWeight: '600', color: TextColorPrimary, marginBottom: 12 },
    codAmountValue: { fontSize: 14, fontWeight: 'bold', color: TextColorPrimary, textAlign: 'right', flex: 1 },
    pendingTextCod: { fontSize: 13, color: PendingColor, fontWeight: '500', fontStyle: 'italic', textAlign: 'right', flex: 1 }, // Use Pending Color for COD text

    // Plan Details Box Styling
    planDetailsBox: { marginTop: 5, marginBottom: 15, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 6, borderWidth: 1, borderColor: '#eee' },
    planDetailText: { fontSize: 13, color: TextColorSecondary, marginBottom: 4, lineHeight: 18 },
    planLabel: { fontWeight: 'bold', color: TextColorPrimary }, // Make label part bold

    // Installment List Specific Styles
    installmentProgressText: { fontSize: 14, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 10, textAlign: 'center', paddingTop: 5, },
    emptyListText: { textAlign: 'center', color: TextColorSecondary, paddingVertical: 15 }, // Message when list is empty
    installmentListStyle: { marginTop: 10 }, // Container for the FlatList
    installmentRow: { // Style for each row in the installment list
        flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', borderRadius: 6,
        marginBottom: 8, // Increased Margin Below Item
        borderWidth: 1, // Keep border width
        borderColor: '#f0f0f0', // Default Subtle Border
        backgroundColor: CardBackgroundColor, // Ensure background for highlight effect
    },
    nextInstallmentHighlight: { // Applied to the row of the next pending installment
        // Removed background color change
        borderColor: ActionButtonRed, // ** Bright Red (#FF0000) Border **
    },
    installmentLeft: { flex: 1, marginRight: 10 }, // Left part of the row
    installmentRight: { alignItems: 'flex-end', minWidth: 100 }, // Right part, aligned to end
    installmentNumber: { fontSize: 14, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 4 },
    nextInstallmentText: { // Applied to the installment number text when highlighted
        color: ActionButtonRed // Bright Red (#FF0000) Text
    },
    installmentAmount: { fontSize: 14, color: TextColorSecondary, marginBottom: 4 },
    dateRow: { // Container for Icon + Date Text
        flexDirection: 'row', alignItems: 'center', marginTop: 4,
    },
    dateIcon: { // Style for the calendar/check icon
        marginRight: 4, width: 12, textAlign: 'center',
    },
    installmentDueDate: { fontSize: 12, color: TextColorSecondary },
    paidDateTextGreen: { // Specific style to make paid date text green
        color: PaidColor, // Use the green 'Paid' color constant
        fontWeight: '500', fontSize: 11, fontStyle: 'italic',
    },
    timerText: { // Style for the countdown timer text
        fontSize: 11, color: CancelledColor, fontWeight: 'bold', marginTop: 4, fontStyle: 'italic', // Use CancelledColor Red (#EF5350)
    },
    penaltyText: { fontSize: 12, color: CancelledColor, marginTop: 2, fontWeight: '500' }, // Use CancelledColor Red (#EF5350) for penalty text
    penaltyLabel: { color: CancelledColor, fontWeight: 'bold' }, // Use CancelledColor Red (#EF5350) for penalty label
    penaltyValue: { color: CancelledColor, fontWeight: 'bold', textAlign: 'right', flex: 1 }, // Use CancelledColor Red (#EF5350) for penalty value

    // --- Button Styles ---
    buttonContainerFixed: { // Container for the main "Mark Payment Received" button
        marginTop: 20, alignItems: 'center', // Center the button horizontally
    },
    markPaidButtonLarge: { // Style for the main button (Fixed Duration)
        backgroundColor: ActionButtonRed, // Bright Red (#FF0000) Background
        paddingVertical: 10, paddingHorizontal: 25, borderRadius: 6, minWidth: 150, justifyContent: 'center', alignItems: 'center', minHeight: 40,
    },
     markPaidButtonTextLarge: { color: '#fff', fontWeight: 'bold', fontSize: 14, },
    markPaidButtonSmall: { // Style for the smaller button within installment rows
        backgroundColor: ActionButtonRed, // Bright Red (#FF0000) Background
        paddingVertical: 5, paddingHorizontal: 12, borderRadius: 4, marginTop: 8, minWidth: 80, justifyContent: 'center', alignItems: 'center', minHeight: 30,
    },
    markPaidButtonTextSmall: { color: '#fff', fontWeight: 'bold', fontSize: 12, },
    disabledButton: { // Style applied when buttons are disabled (e.g., during loading)
        backgroundColor: '#A5A5A5', // Gray background
        opacity: 0.7, // Make it slightly transparent
    },

    // --- Progress Bar Styles ---
    progressBarContainer: {
        height: 14, // Increased Height
        backgroundColor: ProgressBarBackgroundColor, // Background color of the track
        borderRadius: 7, // Adjust rounding for new height
        marginVertical: 15, // Vertical spacing
        marginHorizontal: 5, // Horizontal spacing from card edges
        overflow: 'hidden', // Clip the fill to rounded corners
    },
    progressBarBackground: { // Optional inner background view
        flex: 1,
    },
    progressBarFill: { // The colored part indicating progress
        backgroundColor: ActionButtonRed, // Bright Red (#FF0000) Fill Color
        height: '100%', // Fill the container height
        borderRadius: 7, // Match container rounding
    },

    // --- Status Badge Color Definitions (Based on Reference) ---
    statusPending: { backgroundColor: PendingColor },        // Orange (#FFA726)
    statusProcessing: { backgroundColor: ProcessingColor },  // Blue (#42A5F5) - Used for Partially Paid too
    statusShipped: { backgroundColor: ShippedColor },        // Greenish (#66BB6A)
    statusDelivered: { backgroundColor: DeliveredColor },    // Gray-Blue (#78909C)
    statusActive: { backgroundColor: ActiveColor },          // Light Blue (#29B6F6)
    statusCancelled: { backgroundColor: CancelledColor },    // Red (#EF5350)
    statusPaid: { backgroundColor: PaidColor },              // Green (#4CAF50) - Used for Overall Paid status
    statusUnknown: { backgroundColor: UnknownColor },        // Gray (#BDBDBD)
    // Specific styles for installment status badges using reference colors
    statusPaidInstallment: { backgroundColor: PaidColor },     // Green (#4CAF50)
    statusPendingInstallment: { backgroundColor: PendingColor },// Orange (#FFA726)
});