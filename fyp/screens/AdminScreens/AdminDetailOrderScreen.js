// AdminDetailOrderScreen.js (Complete Code - Final Version - Single OTP - Button Hiding Fix)

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
const USERS_COLLECTION = 'Users';
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const SHIPPED_STATUS = 'Shipped';
const DELIVERED_STATUS = 'Delivered';
const PAID_STATUS = 'Paid'; // Used for overall paymentStatus AND installment status
const ACTIVE_STATUS = 'Active'; // Used for overall order status after 1st installment paid OR Fixed Duration delivered
const PENDING_STATUS = 'Pending'; // Used for installment status (default)
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
    } return 'N/A';
};

// --- Helper Function: Format Date (Short Date Only) ---
const formatShortDate = (timestamp) => {
    let dateToFormat = null;
    if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); }
    else if (timestamp instanceof Date) { dateToFormat = timestamp; }
    if (dateToFormat && isValid(dateToFormat)) {
        try { return format(dateToFormat, 'MMM d, yyyy'); }
        catch (e) { console.error("Error formatting short date:", e); return 'Invalid Date'; }
    } return 'N/A';
};


// --- Helper Function: Get Status Badge Style ---
const getStatusStyle = (status) => {
    const lowerStatus = status?.toLowerCase() || 'unknown';
    switch (lowerStatus) {
        case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': case 'unpaid (bnpl)': return styles.statusPending;
        case 'processing': case 'partially paid': return styles.statusProcessing;
        case 'shipped': return styles.statusShipped;
        case 'delivered': return styles.statusDelivered;
        case 'active': return styles.statusActive;
        case 'cancelled': case 'rejected': return styles.statusCancelled;
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
            } else {
                 console.log(`[getUserExpoToken] Invalid token format found for user ${userId}:`, token);
                 return null;
            }
        } return null;
    } catch (error) { console.error(`[getUserExpoToken] Error fetching token for user ${userId}:`, error); return null; }
}

// --- Main Component: AdminDetailOrderScreen ---
export default function AdminDetailOrderScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const initialOrder = route.params?.order;
    const orderId = initialOrder?.id;

    // --- State Variables ---
    const [currentOrderData, setCurrentOrderData] = useState(initialOrder);
    const [loading, setLoading] = useState(!initialOrder);
    const [error, setError] = useState(null);
    // Delivery OTP State
    const [isProcessingShip, setIsProcessingShip] = useState(false);
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
    const [enteredOtp, setEnteredOtp] = useState('');
    const [otpError, setOtpError] = useState('');

    // --- Effect: Setup Real-time Listener ---
    useEffect(() => {
        if (!orderId) { setError("Order ID not found."); setLoading(false); setCurrentOrderData(null); return; }
        setError(null);
        const orderRef = doc(db, ORDERS_COLLECTION, orderId);
        const unsubscribe = onSnapshot(orderRef,
            (docSnap) => {
                if (docSnap.exists()) {
                    const newData = { id: docSnap.id, ...docSnap.data() };
                    setCurrentOrderData(newData);
                    // Clear entered OTP if status is no longer 'Shipped'
                    if (newData.status !== SHIPPED_STATUS) {
                        setEnteredOtp(''); setOtpError('');
                    }
                    setError(null);
                } else { setError("Order data not found."); setCurrentOrderData(null); }
                setLoading(false);
            },
            (err) => { setError("Failed to load order details."); setLoading(false); console.error(`Listener error ${orderId}:`, err); }
        );
        return () => { unsubscribe(); };
    }, [orderId]);


    // --- Function to Send Shipping Notification ---
    const sendShippingNotification = async (userId, orderIdentifier, generatedOtp) => {
        console.log(`Attempting shipping notification for user ${userId}, order ${orderIdentifier}`);
        const userToken = await getUserExpoToken(userId);
        if (userToken) {
            const message = {
                to: userToken, sound: 'default', title: '🚚 Order Shipped!',
                body: `Your order #${orderIdentifier} is shipped! Delivery OTP: ${generatedOtp}. Give this to the rider.`,
                data: { orderId: orderId, type: 'shipping_update' }, priority: 'high', channelId: 'order-updates'
            };
            try {
                await axios.post(EXPO_PUSH_ENDPOINT, [message], { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Accept-encoding': 'gzip, deflate' }, timeout: 10000 });
                console.log(`Shipping notification sent for user ${userId}.`);
            } catch (error) { console.error(`Failed shipping notification to user ${userId}:`, error.response?.data || error.message || error); }
        } else { console.log(`No valid token for user ${userId}. Skipping notification.`); }
    };

    // --- Function to Send First Installment Paid Notification ---
    const sendFirstInstallmentPaidNotification = async (userId, orderIdentifier) => {
        console.log(`Attempting 1st installment paid notification for user ${userId}, order ${orderIdentifier}`);
        const userToken = await getUserExpoToken(userId);
        if (userToken) {
            const message = {
                to: userToken, sound: 'default', title: '✅ First Installment Paid!',
                body: `Payment for the first installment of your order #${orderIdentifier} has been confirmed. Your order is now active.`,
                data: { orderId: orderId, type: 'installment_update' }, priority: 'high', channelId: 'order-updates'
            };
            try {
                await axios.post(EXPO_PUSH_ENDPOINT, [message], { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Accept-encoding': 'gzip, deflate' }, timeout: 10000 });
                console.log(`First installment notification sent for user ${userId}.`);
            } catch (error) { console.error(`Failed 1st installment notification to user ${userId}:`, error.response?.data || error.message || error); }
        } else { console.log(`No valid token for user ${userId}. Skipping 1st installment notification.`); }
    };


    // --- Handler Function: Ship Order & Generate OTP ---
    const handleShipAndGenerateOtp = async () => {
         if (!currentOrderData?.id || !currentOrderData?.userId || isProcessingShip) return;
        const currentStatus = currentOrderData.status?.toLowerCase() || '';
        // Check status and if OTP already exists (re-check from state just before action)
        const shouldAllowShipping =
            ['pending', 'processing', 'unpaid (cod)', 'unpaid (fixed duration)', 'unpaid (bnpl)', 'active'].includes(currentStatus) &&
            !currentOrderData?.deliveryOtp;

        if (!shouldAllowShipping) {
             Alert.alert("Action Not Allowed", `Order cannot be shipped in status '${currentOrderData.status}' or OTP already exists.`);
             return;
        }

        setIsProcessingShip(true); // Show loading indicator in button
        const orderRef = doc(db, ORDERS_COLLECTION, currentOrderData.id);
        const newOtp = generateOtpValue();
        console.log(`Generated Delivery OTP for order ${currentOrderData.id}: ${newOtp}`);
        try {
            // Update status to Shipped and add OTP/timestamp
            await updateDoc(orderRef, { status: SHIPPED_STATUS, shippedAt: serverTimestamp(), deliveryOtp: newOtp });
            console.log(`Order ${currentOrderData.id} status updated to ${SHIPPED_STATUS} and Delivery OTP saved.`);
            // Notification happens after successful update
            await sendShippingNotification(currentOrderData.userId, currentOrderData.orderNumber || currentOrderData.id, newOtp);
            Alert.alert("Success", `Order marked as ${SHIPPED_STATUS}. Delivery OTP: ${newOtp}`);
        } catch (error) {
            console.error("Error marking order as shipped or saving OTP:", error);
            Alert.alert("Error", "Could not update the order status or save OTP.");
        } finally {
            setIsProcessingShip(false); // Hide loading indicator in button
        }
    };


    // --- Handler Function: Verify Delivery OTP & Complete Order ---
    const handleVerifyOtp = async () => {
        const storedOtp = currentOrderData?.deliveryOtp;
        const trimmedEnteredOtp = enteredOtp.trim();

        setOtpError('');
        if (!trimmedEnteredOtp) { setOtpError("Please enter the OTP."); return; }
        if (trimmedEnteredOtp.length !== OTP_LENGTH) { setOtpError(`OTP must be ${OTP_LENGTH} digits.`); return; }
        if (!storedOtp) { Alert.alert("Error", "No Delivery OTP found for this order."); return; }
        if (isVerifyingOtp) return;

        setIsVerifyingOtp(true);

        if (trimmedEnteredOtp === storedOtp) {
            console.log(`Delivery OTP Verified for order ${orderId}.`);
            const orderRef = doc(db, ORDERS_COLLECTION, currentOrderData.id);

            const isFixedDurationOrder = currentOrderData?.paymentMethod === 'Fixed Duration';
            const isBnplOrder = currentOrderData?.paymentMethod === 'BNPL';
            const firstInstallment = currentOrderData?.installments?.[0];
            const isFirstInstallmentUnpaid = firstInstallment && firstInstallment.status?.toLowerCase() !== PAID_STATUS.toLowerCase();

            let updateData = {};
            let successMessage = "";
            let notificationToSend = null;

            try {
                // Case 1: Fixed Duration Order
                if (isFixedDurationOrder) {
                    console.log("Handling Fixed Duration order completion (Set to Active).");
                    updateData = {
                        status: ACTIVE_STATUS,
                        deliveredAt: serverTimestamp(), // OK here
                        // Optionally remove OTP: deliveryOtp: deleteField()
                    };
                    successMessage = `OTP Verified! Order status set to ${ACTIVE_STATUS}. Payment remains pending.`;
                }
                // Case 2: BNPL Order with Unpaid First Installment
                else if (isBnplOrder && isFirstInstallmentUnpaid) {
                    console.log("Handling BNPL order - First installment unpaid. Marking paid and setting Active.");
                    const clientPaidAtTimestamp = Timestamp.now(); // Use client time for array field
                    const updatedInstallments = (currentOrderData.installments || []).map((inst, index) => {
                        if (index === 0) {
                            return { ...inst, status: PAID_STATUS, paidAt: clientPaidAtTimestamp };
                        }
                        return inst;
                    });
                    updateData = {
                        installments: updatedInstallments, // Update the array
                        status: ACTIVE_STATUS,             // Set overall status to Active
                        deliveredAt: serverTimestamp(),      // Mark as delivered too (server time ok)
                        // Optionally remove OTP: deliveryOtp: deleteField()
                        // DO NOT update overall paymentStatus or paymentReceivedAt yet
                    };
                    successMessage = "OTP Verified! First installment marked as paid. Order is now Active.";
                    notificationToSend = () => sendFirstInstallmentPaidNotification(currentOrderData.userId, currentOrderData.orderNumber || currentOrderData.id);
                }
                // Case 3: All other orders (COD, Standard, BNPL where 1st was already paid)
                else {
                    console.log("Handling standard order completion (Set to Delivered/Paid).");
                    updateData = {
                        status: DELIVERED_STATUS,
                        deliveredAt: serverTimestamp(), // OK here
                        paymentStatus: PAID_STATUS, // Mark fully paid on delivery
                        paymentReceivedAt: serverTimestamp(), // OK here
                         // Optionally remove OTP: deliveryOtp: deleteField()
                    };
                     successMessage = "OTP Verified! Order marked as Delivered and Paid.";
                }

                // Perform the Firestore update
                await updateDoc(orderRef, updateData);
                console.log(`Order ${orderId} updated successfully based on OTP verification logic.`);
                Alert.alert("Success", successMessage);
                setEnteredOtp(''); // Clear entered OTP

                // Send the relevant notification *after* successful update
                if (notificationToSend) {
                    await notificationToSend();
                }

            } catch (error) {
                console.error("Error updating order status after OTP verification:", error);
                Alert.alert("Error", "Could not update order status after verification.");
                setOtpError("Verification succeeded but failed to update status.");
            }
        } else {
            console.warn(`Incorrect Delivery OTP entered for order ${orderId}. Entered: ${trimmedEnteredOtp}, Expected: ${storedOtp}`);
            setOtpError("Incorrect OTP entered. Please try again.");
        }
        setIsVerifyingOtp(false);
    };


    // --- Render Functions ---
    const renderOrderItem = ({ item, index }) => {
          if (!item || typeof item.price !== 'number' || typeof item.quantity !== 'number') { return null; }
        const itemsArray = currentOrderData?.items || [];
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        const paymentMethod = item.paymentMethod || 'COD';
        let paymentDisplay = paymentMethod;
        if (paymentMethod === 'BNPL' && item.bnplPlan?.name) { paymentDisplay = item.bnplPlan.name; }
        else if (paymentMethod === 'BNPL') { paymentDisplay = 'BNPL Plan'; }
        else if (paymentMethod === 'Fixed Duration' && item.bnplPlan?.name) { paymentDisplay = item.bnplPlan.name; }
        else if (paymentMethod === 'Fixed Duration') { paymentDisplay = 'Fixed Duration'; }
        return (
            <View style={[styles.itemContainer, index === itemsArray.length - 1 && styles.lastItemContainer]}>
                <Image source={item.image ? { uri: item.image } : placeholderImagePath} style={styles.itemImage} defaultSource={placeholderImagePath} />
                <View style={styles.itemDetails}>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name || 'N/A'}</Text>
                    <Text style={styles.itemQtyPrice}>Qty: {item.quantity || 1}</Text>
                    <Text style={styles.itemPrice}>{CURRENCY_SYMBOL} {(item.price || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                    <Text style={styles.itemPaymentMethod}>Method: {paymentDisplay}</Text>
                </View>
                <Text style={styles.itemTotalValue}>{CURRENCY_SYMBOL} {itemTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
            </View>
        );
    };
    const renderInstallment = ({ item }) => {
         if (!item || typeof item.amount !== 'number') return null;
         const installmentStatus = item.status || PENDING_STATUS;
        return (
            <View style={styles.installmentRow}>
                <Text style={styles.installmentText}>Inst. #{item.installmentNumber || 'N/A'}</Text>
                <Text style={styles.installmentText}>{CURRENCY_SYMBOL} {item.amount?.toLocaleString(undefined, {maximumFractionDigits:0}) || 'N/A'}</Text>
                <Text style={styles.installmentText}>Due: {formatShortDate(item.dueDate)}</Text>
                <View style={[styles.statusBadgeSmall, getInstallmentStatusStyle(installmentStatus)]}>
                   <Text style={styles.statusTextSmall}>{installmentStatus}</Text>
                </View>
                {item.paidAt && isValid(item.paidAt.toDate ? item.paidAt.toDate() : item.paidAt) && (
                     <Text style={styles.paidAtText}>Paid: {formatShortDate(item.paidAt)}</Text>
                )}
                {typeof item.penalty === 'number' && item.penalty > 0 && (<Text style={styles.penaltyText}>Penalty: {CURRENCY_SYMBOL}{item.penalty.toFixed(2)}</Text>)}
            </View>
        );
    };
    // --- (End Render Functions) ---


    // --- Conditional Rendering Logic for Loading/Error ---
    if (loading) {
        return (<SafeAreaView style={styles.container}><ActivityIndicator size="large" color={AccentColor} style={styles.loader} /></SafeAreaView>);
    }
    if (error || !currentOrderData) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.errorText}>{error || "Order details could not be loaded."}</Text>
                    <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : null}>
                        <Text style={styles.errorLink}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // --- Determine derived values for UI rendering ---
    const currentStatusLower = currentOrderData.status?.toLowerCase() || '';
    // *** Updated Condition: Check status AND absence of existing delivery OTP ***
    const canMarkAsShipped =
        ['pending', 'processing', 'unpaid (cod)', 'unpaid (fixed duration)', 'unpaid (bnpl)', 'active'].includes(currentStatusLower) &&
        !currentOrderData?.deliveryOtp; // Do not show if OTP already exists in state

    const showDeliveryOtpVerification = currentStatusLower === SHIPPED_STATUS.toLowerCase() && !!currentOrderData.deliveryOtp;
    const paymentMethod = currentOrderData.paymentMethod || 'Unknown';
    const relevantPlanDetails = currentOrderData.bnplPlanDetails || currentOrderData.fixedDurationDetails;
    const isInstallmentOrder = paymentMethod === 'BNPL' || (paymentMethod === 'Mixed' && Array.isArray(currentOrderData.installments) && currentOrderData.installments.length > 0);
    const isFixedDurationOrder = paymentMethod === 'Fixed Duration';
    const showCodSection = (paymentMethod === 'COD' || paymentMethod === 'Mixed') && typeof currentOrderData.codAmount === 'number' && currentOrderData.codAmount > 0;
    const showInstallmentSection = isInstallmentOrder;
    const showFixedDurationSection = isFixedDurationOrder;


    // --- Main Screen Render ---
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                <ScrollView contentContainerStyle={styles.scrollContainer}>

                    {/* Section 1: Items */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Items Ordered ({currentOrderData.items?.length || 0})</Text>
                        <View style={styles.itemsListContainer}>
                            <FlatList
                                data={currentOrderData.items || []}
                                keyExtractor={(itemData, index) => itemData?.id ? `${itemData.id}-${index}` : `item-${index}`}
                                renderItem={renderOrderItem}
                                scrollEnabled={false}
                                ListEmptyComponent={<Text>No items found.</Text>}
                            />
                        </View>
                        <View style={styles.orderTotals}>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Subtotal:</Text>
                                <Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {(currentOrderData.subtotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                            </View>
                            {typeof currentOrderData.deliveryFee === 'number' && currentOrderData.deliveryFee > 0 && (
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Delivery Fee:</Text>
                                    <Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {currentOrderData.deliveryFee.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                                </View>
                            )}
                            <View style={styles.totalDivider} />
                            <View style={styles.summaryRow}>
                                <Text style={[styles.summaryLabel, styles.grandTotalLabel]}>Grand Total:</Text>
                                <Text style={[styles.summaryValue, styles.grandTotalValue]}>{CURRENCY_SYMBOL} {(currentOrderData.grandTotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Section 2: Order Summary */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Order Summary</Text>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Order ID:</Text>
                            <Text style={styles.summaryValue}>#{currentOrderData.id?.substring(0, 8).toUpperCase() || 'N/A'}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Order Date:</Text>
                            <Text style={styles.summaryValue}>{formatDate(currentOrderData.createdAt || currentOrderData.orderDate)}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Order Status:</Text>
                            <View style={[styles.statusBadge, getStatusStyle(currentOrderData.status)]}>
                                <Text style={styles.statusText}>{currentOrderData.status || 'Unknown'}</Text>
                            </View>
                        </View>
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
                            <Text style={styles.summaryValue}>{currentOrderData.userPhone || 'N/A'}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Address:</Text>
                            <Text style={[styles.summaryValue, styles.addressValue]}>{currentOrderData.userAddress || 'N/A'}</Text>
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

                        {/* Conditional: COD Section */}
                        {showCodSection && (
                            <View style={styles.paymentSubSection}>
                                <Text style={styles.paymentSubHeader}>Cash on Delivery</Text>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Amount Due (COD):</Text>
                                    <Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.codAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                                </View>
                            </View>
                        )}

                        {/* Conditional: Installment Section */}
                        {showInstallmentSection && (
                            <View style={styles.paymentSubSection}>
                                <Text style={styles.paymentSubHeader}>Installment Plan</Text>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Plan Amount (BNPL):</Text>
                                    <Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.bnplAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                                </View>
                                {relevantPlanDetails && (
                                    <View style={styles.planDetailsBox}>
                                        <Text style={styles.planDetailText}>Plan Name: {relevantPlanDetails.name || 'N/A'}</Text>
                                        <Text style={styles.planDetailText}>Duration: {relevantPlanDetails.duration || 'N/A'} Months</Text>
                                        <Text style={styles.planDetailText}>Interest: {typeof relevantPlanDetails.interestRate === 'number' ? `${(relevantPlanDetails.interestRate * 100).toFixed(1)}%` : 'N/A'}</Text>
                                    </View>
                                )}
                                {currentOrderData.firstInstallmentPaymentPreference && (
                                    <View style={styles.summaryRow}>
                                        <Text style={styles.summaryLabel}>1st Inst. Pref:</Text>
                                        <Text style={styles.summaryValue}>{currentOrderData.firstInstallmentPaymentPreference}</Text>
                                    </View>
                                )}
                                {(currentOrderData.installments?.length > 0) && <Text style={styles.linkText}>(See Full Schedule Below)</Text>}
                            </View>
                        )}

                        {/* Conditional: Fixed Duration Section */}
                        {showFixedDurationSection && (
                            <View style={styles.paymentSubSection}>
                                <Text style={styles.paymentSubHeader}>Fixed Duration Plan</Text>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Plan Amount:</Text>
                                    <Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.fixedDurationAmountDue ?? currentOrderData.bnplAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                                </View>
                                {relevantPlanDetails && (
                                    <View style={styles.planDetailsBox}>
                                        <Text style={styles.planDetailText}>Plan Name: {relevantPlanDetails.name || 'N/A'}</Text>
                                        <Text style={styles.planDetailText}>Duration: {relevantPlanDetails.duration || 'N/A'} Months</Text>
                                        <Text style={styles.planDetailText}>Interest: {typeof relevantPlanDetails.interestRate === 'number' ? `${(relevantPlanDetails.interestRate * 100).toFixed(1)}%` : 'N/A'}</Text>
                                    </View>
                                )}
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Payment Due Date:</Text>
                                    <Text style={styles.summaryValue}>{formatShortDate(currentOrderData.paymentDueDate)}</Text>
                                </View>
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
                                ListEmptyComponent={<Text>No installment data found.</Text>}
                             />
                        </View>
                    )}

                    {/* Button: Mark as Shipped & Generate OTP */}
                    {/* Render based on the updated canMarkAsShipped condition */}
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
                            <Text style={styles.otpInputLabel}>Enter Delivery OTP Received by User</Text>
                            <PaperInput
                                label={`Enter ${OTP_LENGTH}-Digit Delivery OTP`}
                                mode="outlined"
                                style={styles.otpInputPaper}
                                value={enteredOtp}
                                onChangeText={setEnteredOtp}
                                keyboardType="number-pad"
                                maxLength={OTP_LENGTH}
                                editable={!isVerifyingOtp}
                                outlineColor={LightBorderColor}
                                activeOutlineColor={FocusedBorderColor}
                                theme={{ colors: { primary: FocusedBorderColor, text: TextColorPrimary, placeholder: TextColorSecondary } }}
                                onSubmitEditing={handleVerifyOtp}
                                error={!!otpError}
                                contentStyle={styles.otpInputContentStyle}
                            />
                            {otpError ? <Text style={styles.otpErrorText}>{otpError}</Text> : null}
                            <Text style={styles.otpReferenceText}>Expected: {currentOrderData.deliveryOtp}</Text>
                            <TouchableOpacity
                                style={[
                                    styles.verifyOtpButton,
                                    isVerifyingOtp && styles.disabledButton,
                                    (!enteredOtp || enteredOtp.length !== OTP_LENGTH) && styles.disabledButton
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

                    {/* Display Final Status */}
                    {!canMarkAsShipped && !showDeliveryOtpVerification && currentOrderData.status && (
                        <View style={styles.finalStatusContainer}>
                            <Text style={styles.finalStatusLabel}>Order Status:</Text>
                            <View style={[styles.statusBadge, getStatusStyle(currentOrderData.status)]}>
                                <Text style={styles.statusText}>{currentOrderData.status}</Text>
                            </View>
                        </View>
                    )}

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: ScreenBackgroundColor, },
    scrollContainer: { flexGrow: 1, padding: 15, paddingBottom: 40, paddingTop: 20 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    errorText: { fontSize: 16, color: AccentColor, marginBottom: 15, textAlign: 'center' },
    errorLink: { fontSize: 16, color: '#007AFF', fontWeight: 'bold' },
    section: { backgroundColor: AppBackgroundColor, borderRadius: 8, padding: 15, marginBottom: 15, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1.5, borderWidth: Platform.OS === 'android' ? 0 : 1, borderColor: '#E0E0E0', },
    sectionTitle: { fontSize: 17, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 8, },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', },
    summaryLabel: { fontSize: 14, color: TextColorSecondary, marginRight: 5 },
    summaryValue: { fontSize: 14, fontWeight: '500', color: TextColorPrimary, textAlign: 'right', flexShrink: 1, },
    addressValue: { textAlign: 'left', marginLeft: 'auto', flexBasis: '70%', },
    statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, alignSelf: 'flex-start', },
    statusText: { fontSize: 12, fontWeight: 'bold', color: '#fff', },
    statusPending: { backgroundColor: '#FFA726' }, statusProcessing: { backgroundColor: '#42A5F5' }, statusShipped: { backgroundColor: '#66BB6A' }, statusDelivered: { backgroundColor: '#78909C' }, statusCancelled: { backgroundColor: '#EF5350' }, statusUnknown: { backgroundColor: '#BDBDBD' },
    statusActive: { backgroundColor: '#29B6F6' },
    paymentSubSection: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f0f0f0', },
    paymentSubHeader: { fontSize: 15, fontWeight: '600', color: TextColorPrimary, marginBottom: 10, },
    paymentValueHighlight: { fontSize: 14, fontWeight: 'bold', color: AccentColor, },
    planDetailsBox: { marginTop: 10, marginBottom: 5, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 6, borderWidth: 1, borderColor: '#eee' },
    planDetailText: { fontSize: 13, color: TextColorSecondary, marginBottom: 4, lineHeight: 18 },
    linkText: { fontSize: 13, color: '#007AFF', marginTop: 5, fontStyle: 'italic', }, // Fixed color
    penaltyLabel: { color: AccentColor },
    penaltyValue: { color: AccentColor, fontWeight: 'bold' },
    installmentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee', flexWrap: 'wrap' },
    installmentText: { fontSize: 13, color: TextColorSecondary, paddingRight: 5, marginBottom: 3, marginTop: 3, },
    paidAtText: { fontSize: 11, color: TextColorSecondary, fontStyle: 'italic', width: '100%', textAlign: 'right', marginTop: 2, },
    statusBadgeSmall: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 10, marginVertical: 3, },
    statusTextSmall: { fontSize: 10, fontWeight: 'bold', color: '#fff', },
    statusPaid: { backgroundColor: SuccessColor },
    statusInstallmentPending: { backgroundColor: '#FFA726'},
    itemsListContainer: { marginTop: 5, },
    itemContainer: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center', },
    lastItemContainer: { borderBottomWidth: 0, },
    itemImage: { width: 50, height: 50, borderRadius: 6, marginRight: 12, backgroundColor: PlaceholderBgColor, },
    itemDetails: { flex: 1, justifyContent: 'center', marginRight: 8, },
    itemName: { fontSize: 14, fontWeight: '600', color: TextColorPrimary, marginBottom: 3, },
    itemQtyPrice: { fontSize: 13, color: TextColorSecondary, },
    itemPrice: { fontSize: 13, color: TextColorSecondary, marginTop: 2, },
    itemPaymentMethod: { fontSize: 11, fontStyle: 'italic', color: TextColorSecondary, marginTop: 4, },
    itemTotalValue: { fontSize: 14, fontWeight: 'bold', color: TextColorPrimary, textAlign: 'right', marginLeft: 10, },
    orderTotals: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#eee', },
    totalDivider: { height: 1, backgroundColor: '#eee', marginVertical: 8, },
    grandTotalLabel: { fontWeight: 'bold', fontSize: 16, color: TextColorPrimary },
    grandTotalValue: { fontWeight: 'bold', fontSize: 16, color: AccentColor },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    actionButton: {
        paddingVertical: 12,
        borderRadius: 8, alignItems: 'center', justifyContent: 'center',
        marginTop: 20, marginHorizontal: 10, marginBottom: 10, elevation: 3, minHeight: 48,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 2.5,
        backgroundColor: AccentColor, // Default Red (Ship button)
    },
    disabledButton: { backgroundColor: '#BDBDBD', elevation: 0, shadowOpacity: 0, }, // Used when isProcessingShip is true OR button is disabled
    actionButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold', },
    buttonContent: { flexDirection: 'row', alignItems: 'center', },
    buttonIcon: { marginRight: 8, },
    otpVerificationContainer: {
        marginTop: 25, marginBottom: 15, marginHorizontal: 5,
        paddingVertical: 20, paddingHorizontal: 15,
        backgroundColor: AppBackgroundColor,
        borderRadius: 10, borderWidth: Platform.OS === 'android' ? 0 : 1, borderColor: LightBorderColor,
        elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
    },
    otpInputLabel: {
        fontSize: 16, fontWeight: 'bold', color: TextColorPrimary, textAlign: 'center', marginBottom: 15,
    },
    otpInputPaper: {
        backgroundColor: '#fff',
        marginBottom: 10,
    },
    otpInputContentStyle: {
        fontSize: 20, textAlign: 'center', letterSpacing: 8, paddingHorizontal: 0,
    },
    otpErrorText: { color: AccentColor, fontSize: 13, textAlign: 'center', marginBottom: 8, },
    otpReferenceText: {
        fontSize: 12, color: TextColorSecondary, textAlign: 'center', fontStyle: 'italic', marginBottom: 15,
    },
    verifyOtpButton: {
        backgroundColor: SuccessColor, // Green button
        paddingVertical: 12, paddingHorizontal: 30,
        borderRadius: 8, elevation: 2,
        minHeight: 48,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2,
        alignSelf: 'center',
        width: '80%',
        maxWidth: 300,
        marginTop: 5,
    },
    finalStatusContainer: { marginTop: 20, marginBottom: 10, marginHorizontal: 10, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', },
    finalStatusLabel: { fontSize: 16, fontWeight: '600', color: TextColorPrimary, marginRight: 10, },
});