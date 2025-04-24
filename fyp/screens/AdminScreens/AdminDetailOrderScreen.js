// AdminDetailOrderScreen.js (COMPLETE - CORRECTED: Using PaperInput for OTP)

import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet, Text, View, ScrollView, Image, TouchableOpacity,
    SafeAreaView, Platform, ActivityIndicator, FlatList, Alert, StatusBar,
    KeyboardAvoidingView // Import KeyboardAvoidingView
    // Removed standard TextInput import
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons as IconMUI } from '@expo/vector-icons';
// *** Import PaperInput ***
import { TextInput as PaperInput } from 'react-native-paper'; // Use PaperInput
// Import Firestore functions
import {
    getFirestore, doc, updateDoc, onSnapshot, Timestamp,
    serverTimestamp, getDoc, collection
    // deleteField // Uncomment if you want to delete OTP after delivery
} from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Verify path
import axios from 'axios'; // For sending push notifications
import { format, isValid } from 'date-fns'; // For formatting dates

// --- Constants ---
const AppBackgroundColor = '#FFFFFF';
const ScreenBackgroundColor = '#F8F9FA';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const AccentColor = '#FF0000'; // Red accent for actions AND focused input border/label
const SuccessColor = '#4CAF50'; // Green for success/verification button
const LightBorderColor = '#BDBDBD'; // Default border color for PaperInput outline
const FocusedBorderColor = AccentColor; // Red border on focus for PaperInput outline
const PlaceholderBgColor = '#F0F0F0';
const CURRENCY_SYMBOL = 'PKR';
const placeholderImagePath = require('../../assets/p3.jpg'); // Verify path
const ORDERS_COLLECTION = 'orders';
const USERS_COLLECTION = 'Users'; // Needed for token fetching
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const SHIPPED_STATUS = 'Shipped';
const DELIVERED_STATUS = 'Delivered'; // Status after OTP verification
const PAID_STATUS = 'Paid'; // Define the 'Paid' status constant
const OTP_LENGTH = 6; // Length of the delivery OTP

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
        case 'shipped': return styles.statusShipped; // Distinct style for Shipped
        case 'delivered': return styles.statusDelivered;
        case 'cancelled': case 'rejected': return styles.statusCancelled;
        default: return styles.statusUnknown;
    }
};

// --- Helper Function: Fetch User's Expo Push Token ---
async function getUserExpoToken(userId) {
    if (!userId) { console.error("[getUserExpoToken] userId missing."); return null; }
    try {
        const userDocRef = doc(db, USERS_COLLECTION, userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const token = userDocSnap.data()?.expoPushToken;
            if (token && typeof token === 'string' && token.startsWith('ExponentPushToken[')) { return token; }
            return null; // Invalid format or missing
        } return null; // User doc not found
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
    const [isProcessingShip, setIsProcessingShip] = useState(false);
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
    const [enteredOtp, setEnteredOtp] = useState('');
    const [otpError, setOtpError] = useState('');
    // isOtpInputFocused state is not needed with PaperInput

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
                    if ([DELIVERED_STATUS, PAID_STATUS].includes(newData.status) || [DELIVERED_STATUS, PAID_STATUS].includes(newData.paymentStatus)) {
                        setEnteredOtp('');
                        setOtpError('');
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
                data: { orderId: orderId, type: 'shipping_update' },
                priority: 'high', channelId: 'order-updates'
            };
            try {
                await axios.post(EXPO_PUSH_ENDPOINT, [message], { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Accept-encoding': 'gzip, deflate' }, timeout: 10000 });
                console.log(`Shipping notification sent for user ${userId}.`);
            } catch (error) { console.error(`Failed shipping notification to user ${userId}:`, error.response?.data || error.message || error); }
        } else { console.log(`No valid token for user ${userId}. Skipping notification.`); }
    };


    // --- Handler Function: Ship Order & Generate OTP ---
    const handleShipAndGenerateOtp = async () => {
        if (!currentOrderData?.id || !currentOrderData?.userId || isProcessingShip) return;
        const currentStatus = currentOrderData.status?.toLowerCase() || '';
        if (!['pending', 'processing', 'unpaid (cod)', 'unpaid (fixed duration)', 'unpaid (bnpl)'].includes(currentStatus)) {
            Alert.alert("Action Not Allowed", `Cannot ship order with status '${currentOrderData.status}'.`);
            return;
        }
        setIsProcessingShip(true);
        const orderRef = doc(db, ORDERS_COLLECTION, currentOrderData.id);
        const newOtp = generateOtpValue();
        console.log(`Generated OTP for order ${currentOrderData.id}: ${newOtp}`);
        try {
            await updateDoc(orderRef, { status: SHIPPED_STATUS, shippedAt: serverTimestamp(), deliveryOtp: newOtp });
            console.log(`Order ${currentOrderData.id} status updated to ${SHIPPED_STATUS} and OTP saved.`);
            await sendShippingNotification(currentOrderData.userId, currentOrderData.orderNumber || currentOrderData.id, newOtp);
            Alert.alert("Success", `Order marked as ${SHIPPED_STATUS}. Delivery OTP: ${newOtp}`);
        } catch (error) {
            console.error("Error marking order as shipped or saving OTP:", error);
            Alert.alert("Error", "Could not update the order status or save OTP.");
        } finally {
            setIsProcessingShip(false);
        }
    };


    // --- Handler Function: Verify OTP & Complete Order ---
    const handleVerifyOtp = async () => {
        const storedOtp = currentOrderData?.deliveryOtp;
        const trimmedEnteredOtp = enteredOtp.trim();
        setOtpError('');
        if (!trimmedEnteredOtp) { setOtpError("Please enter the OTP."); return; }
        if (trimmedEnteredOtp.length !== OTP_LENGTH) { setOtpError(`OTP must be ${OTP_LENGTH} digits.`); return; }
        if (!storedOtp) { Alert.alert("Error", "No Delivery OTP found stored for this order."); return; }
        if (isVerifyingOtp) return;

        setIsVerifyingOtp(true);
        if (trimmedEnteredOtp === storedOtp) {
            console.log(`OTP Verified for order ${orderId}. Marking as Delivered and Paid.`);
            const orderRef = doc(db, ORDERS_COLLECTION, currentOrderData.id);
            try {
                await updateDoc(orderRef, {
                    status: DELIVERED_STATUS,
                    deliveredAt: serverTimestamp(),
                    paymentStatus: PAID_STATUS,
                    paymentReceivedAt: serverTimestamp(),
                    // deliveryOtp: deleteField()
                });
                console.log(`Order ${orderId} status updated to ${DELIVERED_STATUS} and payment marked as ${PAID_STATUS}.`);
                Alert.alert("Success", "OTP Verified! Order marked as Delivered and Paid.");
                setEnteredOtp('');
            } catch (error) {
                console.error("Error updating order status/payment to Delivered/Paid:", error);
                Alert.alert("Error", "Could not update order status/payment after OTP verification.");
                setOtpError("Verification succeeded but failed to update status/payment.");
            }
        } else {
            console.warn(`Incorrect OTP entered for order ${orderId}. Entered: ${trimmedEnteredOtp}, Expected: ${storedOtp}`);
            setOtpError("Incorrect OTP entered. Please try again.");
        }
        setIsVerifyingOtp(false);
    };


    // --- Render Functions (Unchanged) ---
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
        return (
            <View style={styles.installmentRow}>
                <Text style={styles.installmentText}>Inst. #{item.installmentNumber || 'N/A'}</Text>
                <Text style={styles.installmentText}>{CURRENCY_SYMBOL} {item.amount?.toLocaleString(undefined, {maximumFractionDigits:0}) || 'N/A'}</Text>
                <Text style={styles.installmentText}>Due: {formatShortDate(item.dueDate)}</Text>
                <View style={[styles.statusBadgeSmall, item.paid ? styles.statusPaid : styles.statusInstallmentPending]}>
                   <Text style={styles.statusTextSmall}>{item.paid ? 'Paid' : 'Pending'}</Text>
                </View>
                {typeof item.penalty === 'number' && item.penalty > 0 && (<Text style={styles.penaltyText}>Penalty: {CURRENCY_SYMBOL}{item.penalty.toFixed(2)}</Text>)}
            </View>
        );
    };
    // --- (End Render Functions) ---


    // --- Conditional Rendering Logic ---
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

    // --- Determine derived values ---
    const canMarkAsShipped = ['pending', 'processing', 'unpaid (cod)', 'unpaid (fixed duration)', 'unpaid (bnpl)'].includes(currentOrderData.status?.toLowerCase() || '');
    const showOtpVerificationSection = currentOrderData.status === SHIPPED_STATUS && !!currentOrderData.deliveryOtp;
    const paymentMethod = currentOrderData.paymentMethod || 'Unknown';
    const relevantPlanDetails = currentOrderData.bnplPlanDetails || currentOrderData.fixedDurationDetails;
    const isRelevantPlanInstallment = relevantPlanDetails?.planType === 'Installment';
    const isRelevantPlanFixed = relevantPlanDetails?.planType === 'Fixed Duration' || paymentMethod === 'Fixed Duration';
    const showCodSection = (paymentMethod === 'COD' || paymentMethod === 'Mixed') && typeof currentOrderData.codAmount === 'number' && currentOrderData.codAmount > 0;
    const showInstallmentSection = (paymentMethod === 'BNPL' || paymentMethod === 'Mixed') && isRelevantPlanInstallment && typeof currentOrderData.bnplAmount === 'number' && currentOrderData.bnplAmount > 0;
    const showFixedDurationSection = (paymentMethod === 'Fixed Duration' || paymentMethod === 'BNPL' || paymentMethod === 'Mixed') && isRelevantPlanFixed && typeof currentOrderData.bnplAmount === 'number' && currentOrderData.bnplAmount > 0;

    // --- Main Screen Render ---
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <ScrollView contentContainerStyle={styles.scrollContainer}>

                    {/* Sections 1-4 (Items, Summary, Customer, Payment) */}
                     <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Items Ordered ({currentOrderData.items?.length || 0})</Text>
                        <View style={styles.itemsListContainer}><FlatList data={currentOrderData.items || []} keyExtractor={(itemData, index) => itemData?.id ? `${itemData.id}-${index}` : `item-${index}`} renderItem={renderOrderItem} scrollEnabled={false} ListEmptyComponent={<Text>No items found.</Text>} /></View>
                        <View style={styles.orderTotals}>
                            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal:</Text><Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {(currentOrderData.subtotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>
                            <View style={styles.totalDivider} />
                            <View style={styles.summaryRow}><Text style={[styles.summaryLabel, styles.grandTotalLabel]}>Grand Total:</Text><Text style={[styles.summaryValue, styles.grandTotalValue]}>{CURRENCY_SYMBOL} {(currentOrderData.grandTotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>
                        </View>
                    </View>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Order Summary</Text>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Order ID:</Text><Text style={styles.summaryValue}>#{currentOrderData.id?.substring(0, 8).toUpperCase() || 'N/A'}</Text></View>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Order Date:</Text><Text style={styles.summaryValue}>{formatDate(currentOrderData.createdAt || currentOrderData.orderDate)}</Text></View>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Status:</Text><View style={[styles.statusBadge, getStatusStyle(currentOrderData.status)]}><Text style={styles.statusText}>{currentOrderData.status || 'Unknown'}</Text></View></View>
                    </View>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Customer Information</Text>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Name:</Text><Text style={styles.summaryValue}>{currentOrderData.userName || 'N/A'}</Text></View>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Phone:</Text><Text style={styles.summaryValue}>{currentOrderData.userPhone || 'N/A'}</Text></View>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Address:</Text><Text style={[styles.summaryValue, styles.addressValue]}>{currentOrderData.userAddress || 'N/A'}</Text></View>
                    </View>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Payment Details</Text>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Method:</Text><Text style={styles.summaryValue}>{paymentMethod}</Text></View>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Payment Status:</Text>
                             {/* Apply status styling to Payment Status */}
                            <View style={[styles.statusBadge, getStatusStyle(currentOrderData.paymentStatus)]}><Text style={styles.statusText}>{currentOrderData.paymentStatus || 'N/A'}</Text></View>
                        </View>
                        {showCodSection && (<View style={styles.paymentSubSection}><Text style={styles.paymentSubHeader}>Cash on Delivery</Text><View style={styles.summaryRow}><Text style={styles.summaryLabel}>Amount Due (COD):</Text><Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.codAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View></View>)}
                        {showInstallmentSection && (<View style={styles.paymentSubSection}><Text style={styles.paymentSubHeader}>Installment Plan</Text><View style={styles.summaryRow}><Text style={styles.summaryLabel}>Plan Amount (BNPL):</Text><Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.bnplAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>{relevantPlanDetails && (<View style={styles.planDetailsBox}><Text style={styles.planDetailText}>Plan Name: {relevantPlanDetails.name || 'N/A'}</Text><Text style={styles.planDetailText}>Duration: {relevantPlanDetails.duration || 'N/A'} Months</Text><Text style={styles.planDetailText}>Interest: {typeof relevantPlanDetails.interestRate === 'number' ? `${(relevantPlanDetails.interestRate * 100).toFixed(1)}%` : 'N/A'}</Text></View>)}{currentOrderData.firstInstallmentPaymentPreference && (<View style={styles.summaryRow}><Text style={styles.summaryLabel}>1st Inst. Pref:</Text><Text style={styles.summaryValue}>{currentOrderData.firstInstallmentPaymentPreference}</Text></View>)}<Text style={styles.linkText}>(See Full Schedule Below)</Text></View>)}
                        {showFixedDurationSection && (<View style={styles.paymentSubSection}><Text style={styles.paymentSubHeader}>Fixed Duration Plan</Text><View style={styles.summaryRow}><Text style={styles.summaryLabel}>Plan Amount:</Text><Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.bnplAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>{relevantPlanDetails && (<View style={styles.planDetailsBox}><Text style={styles.planDetailText}>Plan Name: {relevantPlanDetails.name || 'N/A'}</Text><Text style={styles.planDetailText}>Duration: {relevantPlanDetails.duration || 'N/A'} Months</Text><Text style={styles.planDetailText}>Interest: {typeof relevantPlanDetails.interestRate === 'number' ? `${(relevantPlanDetails.interestRate * 100).toFixed(1)}%` : 'N/A'}</Text></View>)}<View style={styles.summaryRow}><Text style={styles.summaryLabel}>Payment Due Date:</Text><Text style={styles.summaryValue}>{formatShortDate(currentOrderData.paymentDueDate)}</Text></View>{typeof currentOrderData.fixedDurationAmountDue === 'number' && currentOrderData.fixedDurationAmountDue !== currentOrderData.bnplAmount && (<View style={styles.summaryRow}><Text style={styles.summaryLabel}>Specific Amt Due:</Text><Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {currentOrderData.fixedDurationAmountDue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>)}{typeof currentOrderData.penalty === 'number' && currentOrderData.penalty > 0 && (<View style={styles.summaryRow}><Text style={[styles.summaryLabel, styles.penaltyLabel]}>Penalty Applied:</Text><Text style={[styles.summaryValue, styles.penaltyValue]}>{CURRENCY_SYMBOL}{currentOrderData.penalty.toFixed(2)}</Text></View>)}</View>)}
                    </View>

                    {/* Section 5: BNPL Installment Schedule (Conditional) */}
                    {showInstallmentSection && currentOrderData.installments?.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Installment Schedule</Text>
                            <FlatList data={currentOrderData.installments} keyExtractor={(inst, index) => inst?.installmentNumber ? `inst-${inst.installmentNumber}-${index}` : `inst-fallback-${index}`} renderItem={renderInstallment} scrollEnabled={false} ListEmptyComponent={<Text>No installment data found.</Text>} />
                        </View>
                    )}

                    {/* Action Button: Mark as Shipped & Generate OTP (Conditional) */}
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
                                    <Text style={styles.actionButtonText}>Ship & Generate OTP</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    )}

                    {/* --- OTP Verification Section using PaperInput --- */}
                    {showOtpVerificationSection && (
                        <View style={styles.otpVerificationContainer}>
                             <Text style={styles.otpInputLabel}>Enter OTP Received by User</Text>
                             <PaperInput
                                label={`Enter ${OTP_LENGTH}-Digit OTP`}
                                mode="outlined"
                                style={styles.otpInputPaper} // Specific style for PaperInput
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
                                // Use contentStyle for internal text styling if needed (may vary by Paper version)
                                contentStyle={styles.otpInputContentStyle}
                            />
                            {otpError ? <Text style={styles.otpErrorText}>{otpError}</Text> : null}
                            {/* Display expected OTP for Admin Reference */}
                            <Text style={styles.otpReferenceText}>Expected: {currentOrderData.deliveryOtp}</Text>
                            <TouchableOpacity
                                style={[
                                    styles.verifyOtpButton, // Green button
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
                                        <Text style={styles.actionButtonText}>Verify OTP</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Display Final Status */}
                    {!canMarkAsShipped && !showOtpVerificationSection && currentOrderData.status && (
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
    simpleHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 10, backgroundColor: AppBackgroundColor, borderBottomWidth: 1, borderBottomColor: LightBorderColor, },
    backButtonError: { padding: 8, marginRight: 10, },
    headerTitleError: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '600', color: TextColorPrimary, marginRight: 40, },
    section: { backgroundColor: AppBackgroundColor, borderRadius: 8, padding: 15, marginBottom: 15, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1.5, borderWidth: 1, borderColor: LightBorderColor, },
    sectionTitle: { fontSize: 17, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: LightBorderColor, paddingBottom: 8, },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, },
    summaryLabel: { fontSize: 14, color: TextColorSecondary, marginRight: 5 },
    summaryValue: { fontSize: 14, fontWeight: '500', color: TextColorPrimary, textAlign: 'right', flexShrink: 1, },
    statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, },
    statusText: { fontSize: 12, fontWeight: 'bold', color: '#fff', },
    statusPending: { backgroundColor: '#FFA726' }, statusProcessing: { backgroundColor: '#42A5F5' }, statusShipped: { backgroundColor: '#66BB6A' }, statusDelivered: { backgroundColor: '#78909C' }, statusCancelled: { backgroundColor: '#EF5350' }, statusUnknown: { backgroundColor: '#BDBDBD' },
    detailText: { fontSize: 14, color: TextColorPrimary, lineHeight: 20, marginBottom: 4, },
    planDetailsBox: { marginTop: 10, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 6, borderWidth: 1, borderColor: '#eee' },
    planDetailTitle: { fontSize: 14, fontWeight: '600', color: TextColorPrimary, marginBottom: 6 },
    planDetailText: { fontSize: 13, color: TextColorSecondary, marginBottom: 4, lineHeight: 18 },
    installmentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: LightBorderColor, flexWrap: 'wrap' },
    installmentText: { fontSize: 13, color: TextColorSecondary, flexShrink: 1, paddingRight: 5, marginBottom: 3, marginTop: 3, textAlign: 'left' },
    statusBadgeSmall: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 10, marginVertical: 3, },
    statusTextSmall: { fontSize: 10, fontWeight: 'bold', color: '#fff', },
    statusPaid: { backgroundColor: 'green' }, statusInstallmentPending: { backgroundColor: 'orange'},
    penaltyText: { fontSize: 11, color: AccentColor, fontStyle: 'italic', marginLeft: 5, textAlign: 'right', },
    itemsListContainer: { marginTop: 5, },
    itemContainer: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: LightBorderColor, alignItems: 'center', },
    lastItemContainer: { borderBottomWidth: 0, },
    itemImage: { width: 50, height: 50, borderRadius: 6, marginRight: 12, backgroundColor: PlaceholderBgColor, },
    itemDetails: { flex: 1, justifyContent: 'center', },
    itemName: { fontSize: 14, fontWeight: '600', color: TextColorPrimary, marginBottom: 3, },
    itemQtyPrice: { fontSize: 13, color: TextColorSecondary, },
    itemPrice: { fontSize: 13, color: TextColorSecondary, marginTop: 2, },
    itemPaymentMethod: { fontSize: 11, fontStyle: 'italic', color: TextColorSecondary, marginTop: 4, },
    itemTotalValue: { fontSize: 14, fontWeight: 'bold', color: TextColorPrimary, textAlign: 'right', marginLeft: 10, },
    orderTotals: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: LightBorderColor, },
    totalDivider: { height: 1, backgroundColor: LightBorderColor, marginVertical: 8, },
    grandTotalLabel: { fontWeight: 'bold', fontSize: 16, color: TextColorPrimary },
    grandTotalValue: { fontWeight: 'bold', fontSize: 16, color: AccentColor },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    // --- Action Button Styles ---
    actionButton: {
        backgroundColor: AccentColor, // Ship button is Red
        paddingVertical: 12,
        borderRadius: 8, alignItems: 'center', justifyContent: 'center',
        marginTop: 20, marginHorizontal: 10, marginBottom: 10, elevation: 3, minHeight: 48,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 2.5,
    },
    disabledButton: { backgroundColor: '#BDBDBD', elevation: 0, shadowOpacity: 0, },
    actionButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold', },
    buttonContent: { flexDirection: 'row', alignItems: 'center', },
    buttonIcon: { marginRight: 8, },
    // --- OTP Verification Styles (Using PaperInput) ---
    otpVerificationContainer: {
        marginTop: 25, marginBottom: 15, marginHorizontal: 5,
        paddingVertical: 20, paddingHorizontal: 15,
        backgroundColor: AppBackgroundColor,
        borderRadius: 10, borderWidth: 1, borderColor: LightBorderColor,
        elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
    },
    otpInputLabel: { // Label Text above the input
        fontSize: 16, fontWeight: 'bold', color: TextColorPrimary, textAlign: 'center', marginBottom: 15,
    },
    otpInputPaper: { // Style specifically for PaperInput
        backgroundColor: '#fff', // White background for input area
        marginBottom: 10, // Space below input
        // Height/Padding managed by PaperInput's "outlined" mode
    },
    otpInputContentStyle: { // Style passed to PaperInput's contentStyle prop
        fontSize: 20, // Larger font size for OTP digits
        textAlign: 'center', // Center text horizontally
        letterSpacing: 8, // Space out digits
        paddingHorizontal: 0, // Remove internal padding if needed
    },
    otpErrorText: { color: AccentColor, fontSize: 13, textAlign: 'center', marginBottom: 8, },
    otpReferenceText: { // Style for showing the expected OTP
        fontSize: 12, color: TextColorSecondary, textAlign: 'center', fontStyle: 'italic', marginBottom: 15,
    },
    verifyOtpButton: { // Button below input
        backgroundColor: SuccessColor, // Green verification button
        paddingVertical: 12, paddingHorizontal: 30,
        borderRadius: 8, elevation: 2,
        minHeight: 48,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2,
        alignSelf: 'center',
        width: '80%',
        maxWidth: 300,
        marginTop: 5, // Space above button
    },
    finalStatusContainer: { marginTop: 20, marginBottom: 10, marginHorizontal: 10, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', },
    finalStatusLabel: { fontSize: 16, fontWeight: '600', color: TextColorPrimary, marginRight: 10, },
});