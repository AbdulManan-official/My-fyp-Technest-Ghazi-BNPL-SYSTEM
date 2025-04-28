// SchedulesDetailScreen.js - FINAL COMPLETE CODE v14 - Text Warning FINAL CHECK, Full Code
// Displays full details, handles payments & notifications with improved UI.
// Header statuses arranged horizontally. Totals moved. Text rendering corrected.
// All functionality included.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    StyleSheet, Text, View, SafeAreaView,
    ActivityIndicator, TouchableOpacity, StatusBar, ScrollView,
    Image, Alert, Platform, AppState, Animated // Ensure Animated is imported
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons'; // Ensure both icon sets are imported
import * as Progress from 'react-native-progress'; // Ensure Progress is imported
import {
    getFirestore, collection, query, where, Timestamp,
    onSnapshot, doc, updateDoc, getDocs, writeBatch // Ensure all Firestore functions are imported
} from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig'; // Verify path
import { format, isValid, isPast, differenceInDays, isToday, isTomorrow, startOfDay } from 'date-fns'; // Ensure all date-fns functions are imported
import { useStripe } from '@stripe/stripe-react-native'; // Ensure Stripe hook is imported
import axios from 'axios'; // Ensure axios is imported

// --- Constants ---
const AppBackgroundColor = '#FFFFFF';
const ScreenBackgroundColor = '#F8F9FA';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const AccentColor = '#FF4500'; // Main accent color used across the screen
const ProgressBarColor = AccentColor;
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
const CardBorderColor = '#EAEAEA';
const SubtleDividerColor = '#F0F0F0';
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
const placeholderImagePath = require('../../assets/p3.jpg'); // **** ADJUST PATH ****
const PAYMENT_API_ENDPOINT = "https://back.txyber.com/create-payment-intent"; // <--- !!! UPDATE THIS !!!
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

// --- Helper Functions ---

const formatShortDate = (timestamp) => {
    let dateToFormat = null;
    if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); }
    else if (timestamp instanceof Date) { dateToFormat = timestamp; }
    else if (timestamp && typeof timestamp.toDate === 'function') { try { dateToFormat = timestamp.toDate(); } catch (e) {} }
    if (dateToFormat && isValid(dateToFormat)) { try { return format(dateToFormat, 'MMM d, yyyy'); } catch (e) { return 'Invalid Date'; } }
    return 'N/A';
};

const getOverallStatusColor = (status) => {
    const lowerStatus = status?.toLowerCase() || 'unknown';
    switch (lowerStatus) {
        case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': case 'unpaid (bnpl)': return PendingColor;
        case 'processing': return ProcessingColor;
        case PARTIALLY_PAID_STATUS.toLowerCase(): return PartiallyPaidColor;
        case 'shipped': return ShippedColor;
        case ACTIVE_ORDER_STATUS.toLowerCase(): return ActiveColor;
        case 'delivered': case 'completed': return DeliveredColor;
        case 'cancelled': case 'rejected': return CancelledColor;
        case PAID_STATUS.toLowerCase(): return PaidColor;
        default: return UnknownColor;
    }
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

const calculateInstallmentProgress = (installments = []) => {
    if (!Array.isArray(installments) || installments.length === 0) {
        return { paidCount: 0, totalCount: 0, progress: 0, nextDueDate: null, nextAmount: null, totalPaidAmount: 0 };
    }
    const totalCount = installments.length;
    let paidCount = 0; let totalPaidAmount = 0; let nextDueDate = null; let nextAmount = null; let foundNext = false;
    installments.forEach(inst => {
        if (inst.status?.toLowerCase() === PAID_STATUS.toLowerCase()) {
            paidCount++;
            if (typeof inst.amount === 'number') { totalPaidAmount += inst.amount; }
        } else if (!foundNext) {
            nextDueDate = inst.dueDate; nextAmount = inst.amount; foundNext = true;
        }
    });
    const progress = totalCount > 0 ? paidCount / totalCount : 0;
    return { paidCount, totalCount, progress, nextDueDate, nextAmount, totalPaidAmount };
};

const calculateRemainingAmount = (orderData) => {
    if (!orderData || typeof orderData.grandTotal !== 'number') return 0;
    const paymentStatus = orderData.paymentStatus?.toLowerCase();
    if (paymentStatus === PAID_STATUS.toLowerCase()) return 0;
    let remainingCalculated = 0;
    if (orderData.codAmount && !orderData.codPaymentReceivedAt) {
        remainingCalculated += orderData.codAmount;
    }
    if (Array.isArray(orderData.installments)) {
        orderData.installments.forEach(inst => {
            if (inst.status?.toLowerCase() !== PAID_STATUS.toLowerCase()) {
                 if (typeof inst.amount === 'number') { remainingCalculated += inst.amount; }
                 if (typeof inst.penalty === 'number' && inst.penalty > 0) { remainingCalculated += inst.penalty; }
            }
        });
    }
    const hasFixedComp = !!orderData.fixedDurationAmountDue || !!orderData.paymentDueDate;
    const isFixedPaid = !!orderData.paymentReceivedAt;
    if (hasFixedComp && !isFixedPaid) {
         if (typeof (orderData.fixedDurationAmountDue ?? orderData.bnplAmount) === 'number') {
             remainingCalculated += (orderData.fixedDurationAmountDue ?? orderData.bnplAmount ?? 0);
         }
         if (typeof orderData.penalty === 'number' && orderData.penalty > 0) {
             remainingCalculated += orderData.penalty;
         }
    }
    return Math.max(0, remainingCalculated);
};

const formatTimeRemaining = (dueDateTimestamp) => {
    let dueDate = null;
    if (dueDateTimestamp && typeof dueDateTimestamp.toDate === 'function') { try { dueDate = dueDateTimestamp.toDate(); } catch (e) { return "Invalid Date"; } }
    else if (dueDateTimestamp instanceof Date) { dueDate = dueDateTimestamp; }
    if (!dueDate || !isValid(dueDate)) return "Due date N/A";
    const now = new Date();
    const dueDateStart = startOfDay(dueDate);
    const nowStart = startOfDay(now);
    if (isPast(dueDateStart) && !isToday(dueDateStart)) { const daysOverdue = differenceInDays(nowStart, dueDateStart); return `Overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`; }
    if (isToday(dueDateStart)) return "Due today";
    if (isTomorrow(dueDateStart)) return "Due tomorrow";
    const daysRemaining = differenceInDays(dueDateStart, nowStart);
    if (daysRemaining >= 0) { return `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left`; }
    return formatShortDate(dueDateTimestamp);
};

// --- Animated Component (Corrected for Text Warning) ---
const AnimatedTimeRemaining = ({ timeString, isOverdue }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        const animation = Animated.loop( Animated.sequence([ Animated.timing(pulseAnim, { toValue: 1.06, duration: 800, useNativeDriver: true }), Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }), ]), );
        animation.start();
        return () => animation.stop();
    }, [pulseAnim]);
    const textColor = isOverdue ? OverdueColor : TextColorPrimary;
    return (
        <Animated.View style={[styles.timeRemainingAnimatedContainer, { transform: [{ scale: pulseAnim }] }]}>
            <MaterialIcons name="timer" size={15} color={textColor} style={styles.iconStyle} />
            <Text style={[styles.detailValueDate, { color: textColor }]}>{timeString || ''}</Text>
        </Animated.View>
     );
};

// --- Admin Notification Helpers ---
async function getAdminExpoTokens() {
    const tokens = [];
    console.log('[getAdminExpoTokens] Fetching admin push tokens...');
    try {
        const adminRef = collection(db, ADMIN_COLLECTION);
        const q = query(adminRef, where("role", "==", "admin"));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) { console.log(`[getAdminExpoTokens] No admins found in "${ADMIN_COLLECTION}".`); return []; }
        querySnapshot.forEach((doc) => { const token = doc.data()?.expoPushToken; if (token && typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))) { tokens.push(token); } });
        console.log(`[getAdminExpoTokens] Found ${tokens.length} valid tokens.`);
    } catch (error) { console.error("[getAdminExpoTokens] Error:", error); }
    return tokens;
}

async function sendAdminPaymentNotification(orderId, userName, amountPaid, paymentMethod) {
    const adminTokens = await getAdminExpoTokens();
    if (!adminTokens || adminTokens.length === 0) { console.log("[AdminPaymentNotify] No tokens."); return; }
    const messages = adminTokens.map(token => ({ to: token, sound: 'default', title: '💰 Payment Received!', body: `User ${userName || 'N/A'} paid ${CURRENCY_SYMBOL}${amountPaid?.toLocaleString()} for ${paymentMethod} Order #${orderId.substring(0,6).toUpperCase()}. Check details.`, data: { orderId: orderId, type: 'payment_received' }, priority: 'high', channelId: 'admin-notifications' }));
    try { console.log(`[AdminPaymentNotify] Sending ${messages.length} notifications...`); await axios.post(EXPO_PUSH_ENDPOINT, messages, { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Accept-encoding': 'gzip, deflate' }, timeout: 10000 }); console.log(`[AdminPaymentNotify] Sent for order ${orderId}.`); }
    catch (error) { console.error(`[AdminPaymentNotify] Failed for ${orderId}:`, error.response?.data || error.message); }
}
// --- End Admin Notification Helpers ---

// --- Main Detail Screen Component ---
export default function SchedulesDetailScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const initialOrder = route.params?.order;
    const [order, setOrder] = useState(initialOrder); // Use 'order' state
    const { initPaymentSheet, presentPaymentSheet, loading: stripeLoadingHook } = useStripe();
    const [payingItemId, setPayingItemId] = useState(null);
    const [localError, setLocalError] = useState(null);
    const appState = useRef(AppState.currentState);
    const listenerUnsubscribeRef = useRef(null);

    // --- Real-time Listener ---
    useEffect(() => {
        if (!order?.id) { if (!initialOrder) setLocalError("Order details missing."); return; }
        const orderRef = doc(db, ORDERS_COLLECTION, order.id);
        let unsubscribe = null;
        const setupListener = () => {
            if (listenerUnsubscribeRef.current) listenerUnsubscribeRef.current();
             unsubscribe = onSnapshot(orderRef, (docSnap) => {
                if (docSnap.exists()) { setOrder({ id: docSnap.id, ...docSnap.data() }); setLocalError(null); }
                else { setLocalError("This order may have been deleted."); }
            }, (error) => { setLocalError("Real-time update failed."); });
            listenerUnsubscribeRef.current = unsubscribe;
        };
        const subscription = AppState.addEventListener('change', nextAppState => { if ( appState.current.match(/inactive|background/) && nextAppState === 'active' ) { setupListener(); } else if (nextAppState.match(/inactive|background/)) { if (listenerUnsubscribeRef.current) { listenerUnsubscribeRef.current(); listenerUnsubscribeRef.current = null; } } appState.current = nextAppState; });
        if (appState.current === 'active') { setupListener(); }
        return () => { subscription.remove(); if (listenerUnsubscribeRef.current) { listenerUnsubscribeRef.current(); listenerUnsubscribeRef.current = null;} };
    }, [order?.id]);


    // --- Payment Initialization and Execution ---
    const initializeAndPay = async (currentOrderData, amountToPay, paymentTypeLabel, installmentDetails = null) => {
        const orderId = currentOrderData.id;
        const paymentAttemptId = `${orderId}-${paymentTypeLabel}-${installmentDetails?.installmentNumber ?? 'fixed'}`;
        if (!amountToPay || amountToPay <= 0) { Alert.alert("Error", "Invalid payment amount."); return; }
        if (payingItemId) { Alert.alert("Payment In Progress"); return; }
        if (stripeLoadingHook) { Alert.alert("Initializing"); return;}
        if (!auth.currentUser) { Alert.alert("Error", "Login required."); return; }

        setPayingItemId(paymentAttemptId);
        setLocalError(null);
        try {
            const response = await axios.post(PAYMENT_API_ENDPOINT, {
                amount: Math.round(amountToPay * 100), currency: CURRENCY_CODE.toLowerCase(),
                orderId: currentOrderData.id, userId: auth.currentUser.uid,
                paymentDescription: `Payment for Order #${currentOrderData.orderNumber || currentOrderData.id} - ${paymentTypeLabel}`,
                customerName: currentOrderData.userName || 'N/A', customerEmail: auth.currentUser.email || undefined,
                metadata: { order_id: currentOrderData.id, user_id: auth.currentUser.uid, payment_type: paymentTypeLabel, installment_number: installmentDetails?.installmentNumber ?? null }
            });
            const { clientSecret, ephemeralKey, customer, error: backendError } = response.data;
            if (backendError || !clientSecret) throw new Error(backendError || "Payment setup failed on server.");

            const { error: initError } = await initPaymentSheet({
                merchantDisplayName: "Txyber", paymentIntentClientSecret: clientSecret,
                customerId: customer, customerEphemeralKeySecret: ephemeralKey,
                allowsDelayedPaymentMethods: false,
            });
            if (initError) throw new Error(`Payment sheet setup failed: ${initError.localizedMessage || initError.message}`);

            const { error: paymentError } = await presentPaymentSheet();
            if (paymentError) {
                if (paymentError.code === 'Canceled') { Alert.alert("Payment Canceled"); }
                else { throw new Error(`Payment failed: ${paymentError.localizedMessage || paymentError.message}`); }
            } else {
                Alert.alert("Payment Successful!");
                await updateFirestoreAfterPayment(currentOrderData, amountToPay, paymentTypeLabel, installmentDetails);
            }
        } catch (error) { console.error(`Payment error for ${paymentAttemptId}:`, error); Alert.alert("Payment Error", error.message || "An unexpected error occurred."); setLocalError(`Payment failed: ${error.message}`);
        } finally { setPayingItemId(null); }
    };


    // --- Firestore Update Function ---
    const updateFirestoreAfterPayment = async (orderData, paidAmount, paymentType, paidInstallment = null) => {
        const orderRef = doc(db, ORDERS_COLLECTION, orderData.id);
        const batch = writeBatch(db);
        try {
            const now = Timestamp.now(); let updates = {}; let shouldNotifyAdmin = false;
            let currentInstallments = orderData.installments || [];
            let newInstallments = JSON.parse(JSON.stringify(currentInstallments));

            if (paymentType === 'Installment' && paidInstallment) {
                const index = newInstallments.findIndex(inst => inst.installmentNumber === paidInstallment.installmentNumber);
                if (index !== -1) {
                    if (newInstallments[index].status?.toLowerCase() === PAID_STATUS.toLowerCase()) { return; }
                    newInstallments[index].status = PAID_STATUS; newInstallments[index].paid = true; newInstallments[index].paidAt = now;
                    updates.installments = newInstallments;
                    const allInstallmentsPaid = newInstallments.every(inst => inst.status?.toLowerCase() === PAID_STATUS.toLowerCase());
                    const hasFixedComp = !!orderData.fixedDurationAmountDue || !!orderData.paymentDueDate;
                    const isFixedCompPaid = !!orderData.paymentReceivedAt;
                    const codPaid = !orderData.codAmount || !!orderData.codPaymentReceivedAt;
                    if (allInstallmentsPaid && codPaid && (!hasFixedComp || isFixedCompPaid)) {
                        updates.paymentStatus = PAID_STATUS; updates.paymentReceivedAt = updates.paymentReceivedAt || now;
                        if (orderData.status !== COMPLETED_ORDER_STATUS) { updates.status = COMPLETED_ORDER_STATUS; updates.deliveredAt = orderData.deliveredAt || now; }
                        shouldNotifyAdmin = true;
                    } else { updates.paymentStatus = PARTIALLY_PAID_STATUS; }
                } else { return; }
            } else if (paymentType === 'Fixed Duration') {
                 updates.paymentReceivedAt = now;
                 const hasInst = Array.isArray(newInstallments) && newInstallments.length > 0;
                 let allInstPaid = !hasInst || newInstallments.every(inst => inst.status?.toLowerCase() === PAID_STATUS.toLowerCase());
                 const codPaid = !orderData.codAmount || !!orderData.codPaymentReceivedAt;
                 if (allInstPaid && codPaid) {
                     updates.paymentStatus = PAID_STATUS;
                     if (orderData.status !== COMPLETED_ORDER_STATUS) { updates.status = COMPLETED_ORDER_STATUS; updates.deliveredAt = orderData.deliveredAt || now; }
                     shouldNotifyAdmin = true;
                 } else { updates.paymentStatus = PARTIALLY_PAID_STATUS; }
            } else { return; }

            if (Object.keys(updates).length > 0) {
                 batch.update(orderRef, updates);
                 await batch.commit();
                 if (shouldNotifyAdmin) {
                     await sendAdminPaymentNotification(orderData.orderNumber || orderData.id, orderData.userName || 'user', paidAmount, orderData.paymentMethod);
                 }
            }
        } catch (error) { console.error(`Firestore update error ${orderData.id}:`, error); Alert.alert("Update Error", "Payment successful, but order update failed."); }
    };

    // --- Payment Button Handlers ---
    const handlePayInstallment = (installment) => {
        if (!installment || typeof installment.amount !== 'number' || installment.amount <= 0) { Alert.alert("Invalid Installment"); return; }
        const amountToPay = installment.amount + (installment.penalty || 0);
        initializeAndPay(order, amountToPay, 'Installment', installment);
    };
    const handlePayFixedDuration = (amountDue) => {
         if (typeof amountDue !== 'number' || amountDue <= 0) { Alert.alert("Invalid Amount"); return; }
         const amountToPay = amountDue + (order.penalty || 0);
        initializeAndPay(order, amountToPay, 'Fixed Duration');
    };


    // --- Loading/Error State ---
    if (!order && !localError) { return ( <SafeAreaView style={styles.centeredContainer}> <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} /> {initialOrder === undefined ? <Text style={styles.errorText}>Order details not found.</Text> : <ActivityIndicator size="large" color={AccentColor} />} {initialOrder === undefined && navigation.canGoBack() && (<TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.backButtonText}>Go Back</Text></TouchableOpacity>)} </SafeAreaView> ); }
    else if (!order && localError) { return ( <SafeAreaView style={styles.centeredContainer}> <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} /> <MaterialIcons name="error-outline" size={60} color={OverdueColor} /> <Text style={styles.errorText}>{localError}</Text> {navigation.canGoBack() && (<TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.backButtonText}>Go Back</Text></TouchableOpacity>)} </SafeAreaView> ); }

    // --- Derive data ---
    const paymentMethod = order.paymentMethod || 'Unknown';
    const isInstallmentPlan = paymentMethod === BNPL_TYPE;
    const isFixedDurationPlan = paymentMethod === FIXED_TYPE;
    const isMixedPlan = paymentMethod === MIXED_TYPE;
    const hasCodComponent = typeof order.codAmount === 'number' && order.codAmount > 0;
    const hasInstallmentComponent = Array.isArray(order.installments) && order.installments.length > 0;
    const hasFixedDurationComponent = !!order.paymentDueDate || !!order.fixedDurationAmountDue;
    const showCodSection = (isMixedPlan && hasCodComponent) || (order.paymentMethod === 'COD');
    const showInstallmentSection = isInstallmentPlan || (isMixedPlan && hasInstallmentComponent);
    const showFixedDurationSection = isFixedDurationPlan || (isMixedPlan && hasFixedDurationComponent);
    const displayId = order.orderNumber ? `#${order.orderNumber}` : `#${order.id.substring(0, 6).toUpperCase()}`;
    const firstItem = order.items?.[0];
    const imageSource = firstItem?.image ? { uri: firstItem.image } : placeholderImagePath;
    const orderStatus = order.status || 'Unknown';
    const paymentStatus = order.paymentStatus || 'N/A';
    const { paidCount, totalCount, progress } = showInstallmentSection ? calculateInstallmentProgress(order.installments) : { paidCount: 0, totalCount: 0, progress: 0 };
    const remainingAmount = calculateRemainingAmount(order);
    const firstUnpaidInstallment = showInstallmentSection && totalCount > paidCount ? (order.installments || []).find(inst => inst.status?.toLowerCase() !== PAID_STATUS.toLowerCase()) : null;
    const fixedDueDate = showFixedDurationSection ? order.paymentDueDate : null;
    const fixedAmountDue = showFixedDurationSection ? (order.fixedDurationAmountDue ?? order.bnplAmount ?? 0) : 0;
    const fixedAmountToPay = fixedAmountDue + (order.penalty || 0);
    const isFixedPaid = showFixedDurationSection && !!order.paymentReceivedAt;
    const timeRemainingString = fixedDueDate ? formatTimeRemaining(fixedDueDate) : "";
    const isFixedOverdue = !isFixedPaid && fixedDueDate && isValid(fixedDueDate?.toDate ? fixedDueDate.toDate() : fixedDueDate) ? isPast(startOfDay(fixedDueDate.toDate())) && !isToday(startOfDay(fixedDueDate.toDate())) : false;
    const isAnyPaymentProcessing = !!payingItemId;
    const isPayingThisInstallment = firstUnpaidInstallment && payingItemId === `${order.id}-Installment-${firstUnpaidInstallment.installmentNumber}`;
    const isPayingThisFixed = !isFixedPaid && payingItemId === `${order.id}-Fixed Duration-fixed`;
    const disableButton = stripeLoadingHook || isAnyPaymentProcessing;


    // --- Main Render ---
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
            <ScrollView contentContainerStyle={styles.scrollContainer}>

                {/* Error Banner */}
                {localError && order ? ( <View style={styles.errorBanner}><Text style={styles.errorBannerText}>⚠️ {localError}</Text></View> ) : null}

                 {/* Section 1: Order Header & Status */}
                 <View style={styles.section}>
                    <View style={styles.headerProductInfo}>
                        <Image source={imageSource} style={styles.headerImage} defaultSource={placeholderImagePath}/>
                        <View style={styles.headerTextContainer}>
                             <Text style={styles.headerProductName} numberOfLines={2}>{firstItem?.name || 'Order Item(s)'}</Text>
                             <Text style={styles.headerOrderId}>Order ID: {displayId}</Text>
                             <Text style={styles.headerOrderDate}>Ordered on: {formatShortDate(order.createdAt)}</Text>
                        </View>
                    </View>
                    <View style={styles.headerStatusRow}>
                         <View style={[styles.statusBadgeOverall, getOverallStatusStyle(paymentStatus)]}>
                           <MaterialCommunityIcons name="credit-card-check-outline" size={13} color="#fff" style={styles.badgeIcon}/>
                           <Text style={styles.statusBadgeText}><Text style={styles.badgeLabel}>Payment: </Text>{paymentStatus}</Text>
                       </View>
                        <View style={[styles.statusBadgeOverall, getOverallStatusStyle(orderStatus)]}>
                            <MaterialCommunityIcons name="package-variant-closed" size={13} color="#fff" style={styles.badgeIcon}/>
                            <Text style={styles.statusBadgeText}><Text style={styles.badgeLabel}>Order: </Text>{orderStatus}</Text>
                       </View>
                       <View style={[styles.statusBadgeOverall, styles.paymentMethodBadge]}>
                            <MaterialIcons name="payment" size={13} color="#fff" style={styles.badgeIcon}/>
                            <Text style={styles.statusBadgeText}>{paymentMethod}</Text>
                       </View>
                   </View>
                 </View>

                {/* Section 2: Payment Breakdown & Totals */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment Breakdown</Text>

                    {/* --- COD Component --- */}
                    {showCodSection ? (
                        <View style={styles.componentSubSection}>
                             <Text style={styles.componentTitle}>Cash on Delivery</Text>
                            <View style={styles.detailRow}><Text style={styles.detailLabel}>COD Amount:</Text><Text style={styles.detailValueEmphasized}>{CURRENCY_SYMBOL}{(order.codAmount || 0).toLocaleString()}</Text></View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>COD Status:</Text>
                                <Text style={styles.detailValue}>{order.codPaymentReceivedAt ? `Paid (${formatShortDate(order.codPaymentReceivedAt)})` : 'Pending at Delivery'}</Text>
                            </View>
                        </View>
                    ) : null }

                    {/* --- Installment Component --- */}
                    {showInstallmentSection ? (
                        <View style={[styles.componentSubSection, showCodSection && styles.componentSpacing]}>
                            <Text style={styles.componentTitle}>Installment Plan</Text>
                             {totalCount > 0 ? (
                                 <View style={styles.progressSection}>
                                    <View style={styles.progressTextContainer}>
                                        <Text style={styles.progressText}>Payment Progress</Text>
                                        <Text style={styles.progressCountText}>{paidCount} / {totalCount} Paid</Text>
                                    </View>
                                    <Progress.Bar progress={progress} width={null} height={8} color={ProgressBarColor} unfilledColor="#E9ECEF" borderRadius={5} borderWidth={0} style={styles.progressBar}/>
                                 </View>
                              ) : null }
                             {(order.installments && order.installments.length > 0) ? (
                                 order.installments.map((installment, index, arr) => {
                                     const instStatus = installment.status || PENDING_STATUS;
                                     const isInstPaid = instStatus.toLowerCase() === PAID_STATUS.toLowerCase();
                                     const instDueDate = installment.dueDate;
                                     const isInstOverdue = !isInstPaid && instDueDate && isValid(instDueDate?.toDate ? instDueDate.toDate() : instDueDate) ? isPast(startOfDay(instDueDate.toDate())) && !isToday(startOfDay(instDueDate.toDate())) : false;
                                     const penaltyComp = typeof installment.penalty === 'number' && installment.penalty > 0 ? (<Text style={styles.penaltyText}><MaterialIcons name="warning" size={12} color={OverdueColor} />{` Penalty: ${CURRENCY_SYMBOL}${installment.penalty.toFixed(0)}`}</Text>) : null;
                                     const paidDateComp = isInstPaid && installment.paidAt ? (<Text style={styles.paidAtText}><MaterialIcons name="check-circle" size={11} color={SuccessColor} />{` Paid: ${formatShortDate(installment.paidAt)}`}</Text>) : null;
                                     const isLastInstallment = index === arr.length - 1;
                                     return (
                                         <View key={`inst-${order.id}-${index}`} style={[styles.installmentRow, isLastInstallment && styles.installmentRow_lastChild]}>
                                             <View style={styles.installmentLeft}>
                                                 <Text style={styles.installmentNumber}>Installment #{installment.installmentNumber || index + 1}</Text>
                                                 <Text style={styles.installmentAmount}>{CURRENCY_SYMBOL} {installment.amount?.toLocaleString() ?? 'N/A'}</Text>
                                                 {penaltyComp}
                                             </View>
                                             <View style={styles.installmentRight}>
                                                 <View style={[styles.statusBadgeSmall, getInstallmentStatusStyle(instStatus)]}>
                                                     <Text style={styles.statusTextSmall}>{instStatus}</Text>
                                                 </View>
                                                 <Text style={[styles.installmentDueDate, isInstOverdue && styles.overdueText]}>
                                                     <MaterialIcons name="date-range" size={12} color={isInstOverdue ? OverdueColor : TextColorSecondary} />
                                                     {` ${formatShortDate(instDueDate)} ${isInstOverdue ? '(Overdue)' : ''}`}
                                                 </Text>
                                                 {paidDateComp}
                                             </View>
                                         </View>
                                     );
                                 })
                             ) : ( <Text style={styles.noScheduleText}>No installment details found.</Text> )}
                        </View>
                    ) : null }

                    {/* --- Fixed Duration Component --- */}
                    {showFixedDurationSection ? (
                        <View style={[styles.componentSubSection, (showCodSection || showInstallmentSection) && styles.componentSpacing]}>
                            <Text style={styles.componentTitle}>Fixed Duration Payment</Text>
                            <View style={styles.detailRow}><Text style={styles.detailLabel}>Amount Due:</Text><Text style={styles.detailValueEmphasized}>{CURRENCY_SYMBOL}{fixedAmountDue.toLocaleString()}</Text></View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Payment Due:</Text>
                                <View style={styles.fixedDueDateContainer}>
                                    <AnimatedTimeRemaining timeString={timeRemainingString} isOverdue={isFixedOverdue && !isFixedPaid} />
                                    <Text style={styles.absoluteDateText}>({formatShortDate(fixedDueDate)})</Text>
                                </View>
                            </View>
                            {typeof order.penalty === 'number' && order.penalty > 0 ? (
                                <View style={styles.detailRow}>
                                    <Text style={[styles.detailLabel, styles.penaltyLabel]}><MaterialIcons name="warning" size={14} color={OverdueColor} /> Penalty:</Text>
                                    <Text style={[styles.detailValue, styles.penaltyValue]}>{CURRENCY_SYMBOL}{order.penalty.toFixed(0)}</Text>
                                </View>
                            ) : null }
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Payment Status:</Text>
                                {isFixedPaid ? ( order.paymentReceivedAt ? (<Text style={styles.paidText}><MaterialIcons name="check-circle" size={14} color={SuccessColor} /> Paid ({formatShortDate(order.paymentReceivedAt)})</Text>) : (<Text style={styles.paidText}><MaterialIcons name="check-circle" size={14} color={SuccessColor} /> Paid</Text>) ) : (<Text style={styles.detailValue}>Pending</Text>)}
                             </View>
                        </View>
                    ) : null }

                    {/* --- Order Totals Sub-Section --- */}
                    <View style={styles.orderTotalsSubSection}>
                         <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal:</Text><Text style={styles.totalValue}>{CURRENCY_SYMBOL}{order.subtotal?.toLocaleString() ?? 'N/A'}</Text></View>
                         {typeof order.deliveryFee === 'number' && order.deliveryFee > 0 ? (
                             <View style={styles.totalRow}><Text style={styles.totalLabel}>Delivery Fee:</Text><Text style={styles.totalValue}>{CURRENCY_SYMBOL}{order.deliveryFee.toLocaleString()}</Text></View>
                         ) : null }
                         <View style={styles.totalDivider} />
                         <View style={styles.totalRow}><Text style={styles.grandTotalLabel}>Grand Total:</Text><Text style={styles.grandTotalValue}>{CURRENCY_SYMBOL}{order.grandTotal?.toLocaleString() ?? 'N/A'}</Text></View>
                          {paymentStatus?.toLowerCase() !== PAID_STATUS.toLowerCase() && remainingAmount > 0 ? (
                               <View style={[styles.totalRow, styles.remainingRow]}>
                                    <Text style={styles.remainingLabel}>Total Remaining:</Text>
                                    <Text style={[styles.totalValue, styles.remainingAmountHighlight]}>{CURRENCY_SYMBOL}{remainingAmount.toLocaleString() ?? 'N/A'}</Text>
                               </View>
                           ) : null }
                     </View>
                     {/* --- END Order Totals Sub-Section --- */}


                     {/* --- Pay Buttons Area --- */}
                     <View style={styles.payButtonContainer}>
                         {showInstallmentSection && firstUnpaidInstallment && remainingAmount > 0 ? (
                            <TouchableOpacity style={[styles.payButton, disableButton && styles.payButtonDisabled]} onPress={() => handlePayInstallment(firstUnpaidInstallment)} disabled={disableButton} >
                                {isPayingThisInstallment ? (<ActivityIndicator size="small" color="#FFFFFF" />) : ( <View style={styles.payButtonContent}><MaterialIcons name="payment" size={18} color="#FFFFFF" style={styles.payButtonIcon} /><Text style={styles.payButtonText}>{`Pay Installment (${CURRENCY_SYMBOL}${(firstUnpaidInstallment.amount + (firstUnpaidInstallment.penalty || 0))?.toLocaleString()})`}</Text></View> )}
                            </TouchableOpacity>
                         ) : null }
                         {showFixedDurationSection && !isFixedPaid && fixedAmountDue > 0 ? (
                            <TouchableOpacity style={[styles.payButton, disableButton && styles.payButtonDisabled, showInstallmentSection && firstUnpaidInstallment && styles.secondaryPayButton]} onPress={() => handlePayFixedDuration(fixedAmountDue)} disabled={disableButton} >
                                {isPayingThisFixed ? (<ActivityIndicator size="small" color="#FFFFFF" />) : ( <View style={styles.payButtonContent}><MaterialIcons name="event-available" size={18} color="#FFFFFF" style={styles.payButtonIcon} /><Text style={styles.payButtonText}>{`Pay Fixed Amount (${CURRENCY_SYMBOL}${fixedAmountToPay.toLocaleString()})`}</Text></View> )}
                            </TouchableOpacity>
                         ): null }
                     </View>
                     {/* --- END Pay Buttons Area --- */}

                </View>
                {/* End Payment Breakdown Section */}

            </ScrollView>
        </SafeAreaView>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: ScreenBackgroundColor },
    scrollContainer: { flexGrow: 1, paddingVertical: 15, paddingHorizontal: 10 },
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: ScreenBackgroundColor },
    errorText: { color: OverdueColor, fontSize: 16, textAlign: 'center', marginBottom: 20 },
    backButton: { backgroundColor: AccentColor, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6, marginTop: 10 },
    backButtonText: { color: '#fff', fontWeight: 'bold' },
    errorBanner: { backgroundColor: '#FFF3E0', paddingVertical: 8, paddingHorizontal: 15, marginHorizontal: 5, marginBottom: 15, borderRadius: 6, borderWidth: 1, borderColor: '#FFCC80' },
    errorBannerText: { color: '#E65100', fontSize: 13, textAlign: 'center' },
    section: { backgroundColor: AppBackgroundColor, borderRadius: 10, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, borderWidth: 1, borderColor: CardBorderColor, padding: 15, },
    headerSection: { paddingBottom: 10 },
    headerProductInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, },
    headerImage: { width: 65, height: 65, borderRadius: 8, marginRight: 15, backgroundColor: PlaceholderBgColor },
    headerTextContainer: { flex: 1, justifyContent: 'center' },
    headerProductName: { fontSize: 18, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 4, lineHeight: 24 },
    headerOrderId: { fontSize: 13, color: TextColorSecondary, marginBottom: 4 },
    headerOrderDate: { fontSize: 13, color: TextColorSecondary },
    headerStatusRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: SubtleDividerColor, },
    statusBadgeOverall: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, marginRight: 8, marginBottom: 8, },
    badgeLabel: { fontSize: 10, fontWeight: '500', color: 'rgba(255, 255, 255, 0.8)', marginRight: 3, },
    statusBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold', },
    badgeIcon: { marginRight: 4 },
    statusBadgePending: { backgroundColor: PendingColor }, statusBadgeProcessing: { backgroundColor: ProcessingColor }, statusBadgePartiallyPaid: { backgroundColor: ProcessingColor }, statusBadgeShipped: { backgroundColor: ShippedColor }, statusBadgeActive: { backgroundColor: ActiveColor }, statusBadgeDelivered: { backgroundColor: DeliveredColor }, statusBadgeCancelled: { backgroundColor: CancelledColor }, statusBadgePaid: { backgroundColor: PaidColor }, statusBadgeUnknown: { backgroundColor: UnknownColor },
    paymentMethodBadge: { backgroundColor: PlanAmountColor },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 15, },
    componentSubSection: { paddingBottom: 15, marginBottom: 15, borderBottomWidth: 1, borderBottomColor: SubtleDividerColor, },
    componentSubSection_lastChild: { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 5 },
    componentTitle: { fontSize: 16, fontWeight: '600', color: TextColorPrimary, marginBottom: 15 },
    progressSection: { marginVertical: 15, paddingHorizontal: 5 },
    progressTextContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    progressText: { fontSize: 13, color: TextColorSecondary },
    progressCountText: { fontSize: 13, color: TextColorPrimary, fontWeight: '500' },
    progressBar: { height: 8, borderRadius: 4 },
    installmentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
    installmentRow_lastChild: { borderBottomWidth: 0 },
    installmentLeft: { flex: 1.2, marginRight: 10 },
    installmentRight: { flex: 1, alignItems: 'flex-end' },
    installmentNumber: { fontSize: 14, fontWeight: '600', color: TextColorPrimary, marginBottom: 4 },
    installmentAmount: { fontSize: 14, color: TextColorSecondary, marginBottom: 4 },
    penaltyText: { fontSize: 12, color: OverdueColor, marginTop: 3, fontStyle: 'italic', display: 'flex', alignItems: 'center' },
    statusBadgeSmall: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, marginBottom: 5 },
    statusTextSmall: { fontSize: 11, fontWeight: 'bold', color: '#fff' },
    installmentDueDate: { fontSize: 12, color: TextColorSecondary, textAlign: 'right', display: 'flex', alignItems: 'center' },
    paidAtText: { fontSize: 11, color: SuccessColor, fontStyle: 'italic', marginTop: 4, textAlign: 'right', display: 'flex', alignItems: 'center' },
    statusPaidInstallment: { backgroundColor: SuccessColor },
    statusPendingInstallment: { backgroundColor: PendingColor },
    noScheduleText: { color: TextColorSecondary, fontStyle: 'italic', paddingVertical: 15, textAlign: 'center' },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingVertical: 2 },
    detailLabel: { fontSize: 14, color: TextColorSecondary, marginRight: 10 },
    detailValue: { fontSize: 14, fontWeight: '500', color: TextColorPrimary, textAlign: 'right', flexShrink: 1 },
    codAmountValue: { fontSize: 14, fontWeight: '600', color: TextColorPrimary, textAlign: 'right' },
    detailValueEmphasized: { fontSize: 15, fontWeight: '600', color: TextColorPrimary, textAlign: 'right' },
    fixedDueDateContainer: { alignItems: 'flex-end' },
    timeRemainingAnimatedContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
    iconStyle: { marginRight: 4 },
    absoluteDateText: { fontSize: 11, color: TextColorSecondary, fontStyle: 'italic', textAlign: 'right' },
    overdueText: { color: OverdueColor, fontWeight: 'bold' },
    paidText: { fontSize: 14, fontWeight: 'bold', color: SuccessColor, textAlign: 'right', display: 'flex', alignItems: 'center' },
    penaltyLabel: { color: OverdueColor, display: 'flex', alignItems: 'center' },
    penaltyValue: { color: OverdueColor, fontWeight: 'bold', textAlign: 'right' },
    detailValueDate: { fontSize: 14, fontWeight: '600', textAlign: 'right' },
    orderTotalsSubSection: { marginTop: 15, paddingTop: 15, paddingHorizontal: 0, paddingBottom: 10, borderBottomWidth: 0, marginBottom: 0},
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    totalLabel: { fontSize: 14, color: TextColorSecondary },
    totalValue: { fontSize: 14, fontWeight: '500', color: TextColorPrimary },
    remainingAmountHighlight: { fontWeight: 'bold', color: AccentColor, fontSize: 16 },
    remainingRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: SubtleDividerColor },
    remainingLabel: { fontSize: 15, fontWeight: 'bold', color: TextColorPrimary },
    grandTotalLabel: { fontWeight: 'bold', fontSize: 16, color: TextColorPrimary },
    grandTotalValue: { fontWeight: 'bold', fontSize: 16, color: AccentColor },
    totalDivider: { height: 1, backgroundColor: SubtleDividerColor, marginVertical: 10 },
    payButtonContainer: { marginTop: 20, paddingHorizontal: 0 },
    payButton: { backgroundColor: AccentColor, paddingVertical: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginBottom: 10, minHeight: 50, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, },
    payButtonContent: { flexDirection: 'row', alignItems: 'center' },
    payButtonIcon: { marginRight: 8 },
    payButtonDisabled: { backgroundColor: TextColorSecondary, opacity: 0.7, elevation: 0 },
    payButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    secondaryPayButton: { }, // Removed margin, default marginBottom on payButton handles spacing
});