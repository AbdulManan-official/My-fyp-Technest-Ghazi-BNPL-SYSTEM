// UserBNPLSchedules.js - FINAL COMPLETE CODE V13 (Corrected Admin Token Fetching)
// Shows All BNPL/Fixed/Mixed Orders, Full Details Inline, Separated Progress Bar for Installments,
// Animated Timer for Fixed Duration, Pay Buttons, No Header, Specific Empty State, Stripe Integration

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    StyleSheet, Text, View, FlatList, SafeAreaView,
    ActivityIndicator, TouchableOpacity, StatusBar, RefreshControl,
    Image, Alert,
    Animated // For Fixed Duration Timer Animation
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Progress from 'react-native-progress'; // Needed for Installment Progress Bar
import {
    getFirestore, collection, query, where, Timestamp,
    onSnapshot, doc, updateDoc, getDocs // Import getDocs for admin token query
} from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig'; // Ensure path is correct
import { format, isValid, isPast, differenceInDays, isToday, isTomorrow, startOfDay } from 'date-fns';
import { useStripe } from '@stripe/stripe-react-native'; // Stripe Hook
import axios from 'axios'; // For API calls

// --- Constants ---
const AppBackgroundColor = '#FFFFFF';
const ScreenBackgroundColor = '#F8F9FA';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const AccentColor = '#FF4500'; // User theme color
const ProgressBarColor = AccentColor;
const SuccessColor = '#4CAF50';
const PendingColor = '#FFA726';
const OverdueColor = '#D32F2F';
const ProcessingColor = '#42A5F5';
const ActiveColor = '#29B6F6';
const ShippedColor = '#66BB6A';
const DeliveredColor = '#78909C';
const UnknownColor = '#BDBDBD';
const PlanAmountColor = '#0056b3';
const PlaceholderBgColor = '#F0F0F0';
const ORDERS_COLLECTION = 'orders';
const ADMIN_COLLECTION = 'Admin'; // *** CORRECTED Collection Name for Admins ***
const CURRENCY_SYMBOL = 'PKR';
const BNPL_TYPE = 'BNPL';
const FIXED_TYPE = 'Fixed Duration';
const MIXED_TYPE = 'Mixed';
const PAID_STATUS = 'Paid';
const PENDING_STATUS = 'Pending';
const PARTIALLY_PAID_STATUS = 'Partially Paid';
const ACTIVE_ORDER_STATUS = 'Active';
const COMPLETED_ORDER_STATUS = 'Delivered'; // Final status after full payment
const placeholderImagePath = require('../../assets/p3.jpg'); // *** ADJUST PATH IF NEEDED ***
const PAYMENT_API_ENDPOINT = "https://back.txyber.com/create-payment-intent"; // *** Your Backend API ***
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send"; // Expo endpoint

// --- Helper Functions ---
const formatShortDate = (timestamp) => {
    let dateToFormat = null;
    if (timestamp && typeof timestamp.toDate === 'function') { try { dateToFormat = timestamp.toDate(); } catch (e) {console.warn("TS Conversion Error:", e)} }
    else if (timestamp instanceof Date) { dateToFormat = timestamp; }
    if (dateToFormat && isValid(dateToFormat)) { try { return format(dateToFormat, 'MMM d, yyyy'); } catch (e) { return 'Invalid Date'; }}
    return 'N/A';
};
const getOverallStatusColor = (status) => {
    const lowerStatus = status?.toLowerCase() || 'unknown';
    switch (lowerStatus) { case 'pending': return PendingColor; case 'processing': case PARTIALLY_PAID_STATUS.toLowerCase(): return ProcessingColor; case 'active': return ActiveColor; case 'shipped': return ShippedColor; case 'delivered': return DeliveredColor; case 'cancelled': case 'rejected': return OverdueColor; case 'paid': return SuccessColor; default: return UnknownColor; }
};
const getInstallmentStatusStyle = (status) => {
    return (status?.toLowerCase() === PAID_STATUS.toLowerCase()) ? styles.statusPaidInstallment : styles.statusPendingInstallment;
};
const calculateInstallmentProgress = (installments = []) => {
    if (!installments || !Array.isArray(installments) || installments.length === 0) return { paidCount: 0, totalCount: 0, progress: 0, nextDueDate: null, nextAmount: null };
    const totalCount = installments.length; let paidCount = 0; let nextDueDate = null; let nextAmount = null; let foundNext = false;
    installments.forEach(inst => { if (inst.status?.toLowerCase() === PAID_STATUS.toLowerCase()) { paidCount++; } else if (!foundNext) { nextDueDate = inst.dueDate; nextAmount = inst.amount; foundNext = true; } });
    const progress = totalCount > 0 ? paidCount / totalCount : 0;
    return { paidCount, totalCount, progress, nextDueDate, nextAmount };
};
const calculateRemainingAmount = (schedule) => {
     if (!schedule) return 0; const paymentMethod = schedule.paymentMethod; const paymentStatus = schedule.paymentStatus?.toLowerCase();
     if (paymentStatus === PAID_STATUS.toLowerCase()) return 0;
     if (paymentMethod === BNPL_TYPE) { const totalBnplAmount = schedule.bnplAmount || 0; let paidAmount = 0; schedule.installments?.forEach(inst => { if (inst.status?.toLowerCase() === PAID_STATUS.toLowerCase() && typeof inst.amount === 'number') { paidAmount += inst.amount; } }); const remaining = totalBnplAmount - paidAmount; return remaining >= 0 ? remaining : 0; }
     else if (paymentMethod === FIXED_TYPE) { return schedule.fixedDurationAmountDue ?? schedule.bnplAmount ?? schedule.grandTotal ?? 0; }
     else if (paymentMethod === MIXED_TYPE) { let remainingBnpl = 0; let remainingFixed = 0; if (Array.isArray(schedule.installments) && schedule.installments.length > 0) { const totalBnplAmount = schedule.bnplAmount || 0; let paidBnplAmount = 0; schedule.installments.forEach(inst => { if (inst.status?.toLowerCase() === PAID_STATUS.toLowerCase() && typeof inst.amount === 'number') { paidBnplAmount += inst.amount; } }); remainingBnpl = totalBnplAmount - paidBnplAmount; remainingBnpl = remainingBnpl >= 0 ? remainingBnpl : 0; } const fixedAmountDue = schedule.fixedDurationAmountDue ?? schedule.bnplAmount ?? 0; if (fixedAmountDue > 0 && paymentStatus !== PAID_STATUS.toLowerCase() && paymentStatus !== PARTIALLY_PAID_STATUS.toLowerCase()) { remainingFixed = fixedAmountDue; } else if (fixedAmountDue > 0 && paymentStatus === PARTIALLY_PAID_STATUS.toLowerCase() && (Array.isArray(schedule.installments) && schedule.installments.every(i => i.status?.toLowerCase() === PAID_STATUS.toLowerCase()))) { remainingFixed = fixedAmountDue; } return remainingBnpl + remainingFixed; }
     return schedule.grandTotal || 0;
};
const formatTimeRemaining = (dueDateTimestamp) => {
    let dueDate = null; if (dueDateTimestamp && typeof dueDateTimestamp.toDate === 'function') { try { dueDate = dueDateTimestamp.toDate(); } catch (e) { return "Invalid Date"; } } else if (dueDateTimestamp instanceof Date) { dueDate = dueDateTimestamp; } if (!dueDate || !isValid(dueDate)) return "Due date N/A"; const now = new Date(); const dueDateStart = startOfDay(dueDate); const nowStart = startOfDay(now); if (isPast(dueDateStart) && !isToday(dueDateStart)) { const daysOverdue = differenceInDays(nowStart, dueDateStart); return `Overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`; } if (isToday(dueDateStart)) return "Due today"; if (isTomorrow(dueDateStart)) return "Due tomorrow"; const daysRemaining = differenceInDays(dueDateStart, nowStart); if (daysRemaining >= 0) { return `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left`; } return formatShortDate(dueDateTimestamp);
};

// --- Animated Component for Time Remaining ---
const AnimatedTimeRemaining = ({ timeString, isOverdue }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => { Animated.loop( Animated.sequence([ Animated.timing(pulseAnim, { toValue: 1.06, duration: 800, useNativeDriver: true }), Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }), ]), { iterations: -1 } ).start(); }, [pulseAnim]);
    const textColor = isOverdue ? OverdueColor : TextColorPrimary;
    return (<Animated.View style={[styles.timeRemainingAnimatedContainer, { transform: [{ scale: pulseAnim }] }]}><MaterialIcons name="timer" size={15} color={textColor} style={styles.iconStyle} /><Text style={[styles.detailValueDate, { color: textColor }]}>{timeString}</Text></Animated.View>);
};

// --- *** UPDATED Admin Notification Helper Functions *** ---
async function getAdminExpoTokens() {
    const tokens = [];
    console.log('[getAdminExpoTokens] Fetching admin push tokens...');
    try {
        // *** Query the CORRECT 'Admin' collection ***
        const adminRef = collection(db, ADMIN_COLLECTION);
        const q = query(adminRef, where("role", "==", "admin")); // Assuming role field exists
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.log(`[getAdminExpoTokens] No documents found in "${ADMIN_COLLECTION}" collection with role "admin".`);
            return [];
        }

        querySnapshot.forEach((doc) => {
            const token = doc.data()?.expoPushToken;
            if (token && typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))) {
                tokens.push(token);
                 console.log(`[getAdminExpoTokens] Added token for admin ${doc.id}`);
            } else {
                 console.log(`[getAdminExpoTokens] Found admin ${doc.id} but token is invalid or missing.`);
            }
        });
        console.log(`[getAdminExpoTokens] Found ${tokens.length} valid admin tokens.`);
    } catch (error) {
        console.error("[getAdminExpoTokens] Error fetching admin tokens:", error);
    }
    return tokens;
}

async function sendAdminPaymentNotification(orderId, userName, amountPaid, paymentMethod) {
    const adminTokens = await getAdminExpoTokens(); // Uses the corrected function above
    if (!adminTokens || adminTokens.length === 0) { console.log("[AdminPaymentNotify] No valid admin tokens found."); return; }
    const messages = adminTokens.map(token => ({ to: token, sound: 'default', title: '💰 Payment Completed', body: `Final payment of ${CURRENCY_SYMBOL}${amountPaid?.toLocaleString()} received from ${userName || 'user'} for ${paymentMethod} Order #${orderId.substring(0, 6).toUpperCase()}. Order marked as ${COMPLETED_ORDER_STATUS}.`, data: { orderId: orderId, type: 'order_completed' }, priority: 'high', channelId: 'admin-notifications' }));
    try { console.log(`[AdminPaymentNotify] Sending ${messages.length} completion notifications...`); await axios.post(EXPO_PUSH_ENDPOINT, messages, { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Accept-encoding': 'gzip, deflate', }, timeout: 10000 }); console.log(`[AdminPaymentNotify] Notifications sent for order ${orderId}.`); }
    catch (error) { console.error(`[AdminPaymentNotify] Failed for order ${orderId}:`, error.response?.data || error.message); }
}
// --- End Admin Notification Helpers ---


// --- Main Component ---
export default function UserBNPLSchedules() {
    const navigation = useNavigation();
    const { initPaymentSheet, presentPaymentSheet, loading: stripeLoadingHook } = useStripe();
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dbError, setDbError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [userId, setUserId] = useState(null);
    const listenerUnsubscribeRef = useRef(null);
    const [payingItemId, setPayingItemId] = useState(null);

    // --- Effect 1: Monitor Authentication State ---
    useEffect(() => {
        console.log("[UserSchedules] Attaching Auth listener.");
        const unsubscribeAuth = auth.onAuthStateChanged(user => {
            const currentUid = user ? user.uid : null;
            console.log("[UserSchedules] Auth State Changed. User ID:", currentUid);
            if (currentUid !== userId) {
                setUserId(currentUid);
                if (!currentUid) { setError("Please log in to view your schedules."); setLoading(false); setSchedules([]); setRefreshing(false); if (listenerUnsubscribeRef.current) { listenerUnsubscribeRef.current(); listenerUnsubscribeRef.current = null; } }
                else { setDbError(null); if(schedules.length === 0) setLoading(true); }
            }
        });
        return () => { console.log("[UserSchedules] Cleaning up Auth Listener."); unsubscribeAuth(); };
    }, [userId, schedules.length]);

    // --- Effect 2 / Function: Setup Firestore Listener ---
    const setupScheduleListener = useCallback(() => {
        if (!userId) { console.log("[UserSchedules] No userId."); setSchedules([]); setLoading(false); setRefreshing(false); if (listenerUnsubscribeRef.current) { listenerUnsubscribeRef.current(); listenerUnsubscribeRef.current = null; } return null; }
        if (!refreshing && schedules.length === 0) setLoading(true);
        setDbError(null);
        console.log(`[UserSchedules] Setting up listener for user ${userId}.`);
        if (listenerUnsubscribeRef.current) { listenerUnsubscribeRef.current(); listenerUnsubscribeRef.current = null; }
        const ordersRef = collection(db, ORDERS_COLLECTION);
        const q = query(ordersRef, where("userId", "==", userId));
        console.log("[UserSchedules] Attaching Firestore listener...");
        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log(`[UserSchedules] Snapshot: Received ${snapshot.docs.length} total orders.`);
            let allUserOrders = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })).filter(order => order.createdAt);
            let paymentPlanOrders = allUserOrders.filter(order => order.paymentMethod === BNPL_TYPE || order.paymentMethod === FIXED_TYPE || order.paymentMethod === MIXED_TYPE );
            paymentPlanOrders.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
            console.log(`[UserSchedules] Filtered to ${paymentPlanOrders.length} BNPL/Fixed/Mixed.`);
            setSchedules(paymentPlanOrders); setLoading(false); setRefreshing(false);
        }, (err) => { console.error("[UserSchedules] Listener error:", err); setDbError("Could not update schedules. Check connection."); setLoading(false); setRefreshing(false); });
        listenerUnsubscribeRef.current = unsubscribe;
        return unsubscribe;
    }, [userId, refreshing, schedules.length]);

    // --- Effect 3: Manage Listener Lifecycle ---
    useFocusEffect(useCallback(() => { console.log("[UserSchedules] Screen focused."); const unsub = setupScheduleListener(); return () => { if (unsub) { console.log("[UserSchedules] Screen blurred."); unsub(); listenerUnsubscribeRef.current = null; } }; }, [setupScheduleListener]));

    // --- Handle Pull-to-Refresh ---
    const onRefresh = useCallback(() => { if (!userId) { setRefreshing(false); return; } console.log("[UserSchedules] Manual refresh."); setRefreshing(true); setupScheduleListener(); const timeout = setTimeout(() => { if (refreshing) setRefreshing(false); }, 8000); return () => clearTimeout(timeout); }, [userId, refreshing, setupScheduleListener]);

    // --- Handle Navigation ---
    const handleSchedulePress = (scheduleItem) => { navigation.navigate('UserOrderDetailScreen', { orderId: scheduleItem.id }); };

    // --- Stripe Payment Logic ---
    const initializeAndPay = async (order, amountToPay, paymentType, installment = null) => {
        const orderId = order.id;
        const paymentAttemptId = `${orderId}-${paymentType}-${installment?.installmentNumber ?? 'fixed'}`;
        if (!amountToPay || amountToPay <= 0) { Alert.alert("Error", "Invalid payment amount specified."); return; }
        if (payingItemId) { Alert.alert("Payment In Progress", "Please wait..."); return; }
        if (stripeLoadingHook) { Alert.alert("Initializing", "Payment system loading..."); return;}

        setPayingItemId(paymentAttemptId);
        try {
            const response = await axios.post(PAYMENT_API_ENDPOINT, { amount: amountToPay });
            const { clientSecret } = response.data;
            if (!clientSecret) throw new Error("Payment setup failed: Missing client secret.");
            const { error: initError } = await initPaymentSheet({ merchantDisplayName: "Txyber", paymentIntentClientSecret: clientSecret, allowsDelayedPaymentMethods: true });
            if (initError) throw new Error(`Payment sheet setup failed: ${initError.localizedMessage || initError.message}`);
            const { error: paymentError } = await presentPaymentSheet();
            if (paymentError) { if (paymentError.code === 'Canceled') { Alert.alert("Payment Canceled"); } else { throw new Error(`Payment failed: ${paymentError.localizedMessage || paymentError.message}`); } }
            else { Alert.alert("Payment Successful"); await updateFirestoreAfterPayment(order, amountToPay, paymentType, installment); }
        } catch (error) { console.error(`Payment error for ${paymentAttemptId}:`, error); Alert.alert("Payment Error", error.message || "Unexpected error."); }
        finally { setPayingItemId(null); }
    };

    // --- Firestore Update Function ---
    const updateFirestoreAfterPayment = async (order, paidAmount, paymentType, paidInstallment = null) => {
        console.log(`Updating Firestore for Order ${order.id}, Type: ${paymentType}`);
        const orderRef = doc(db, ORDERS_COLLECTION, order.id);
        try {
            const now = Timestamp.now(); let updates = {}; let shouldNotifyAdmin = false;
            const latestOrderData = schedules.find(s => s.id === order.id) || order;
            let currentInstallments = latestOrderData.installments || []; let newInstallments = JSON.parse(JSON.stringify(currentInstallments));

            if (paymentType === 'Installment' && paidInstallment) {
                const index = newInstallments.findIndex(inst => inst.installmentNumber === paidInstallment.installmentNumber);
                if (index !== -1) {
                    if (newInstallments[index].status?.toLowerCase() === PAID_STATUS.toLowerCase()) { console.warn(`Inst ${paidInstallment.installmentNumber} already paid.`); return; }
                    newInstallments[index].status = PAID_STATUS; newInstallments[index].paidAt = now; updates.installments = newInstallments;
                    const allInstallmentsPaid = newInstallments.every(inst => inst.status?.toLowerCase() === PAID_STATUS.toLowerCase());
                    if (allInstallmentsPaid) {
                        const hasFixedComp = !!latestOrderData.fixedDurationAmountDue || !!latestOrderData.paymentDueDate;
                        const isFixedCompPaid = latestOrderData.paymentStatus === PAID_STATUS || (latestOrderData.paymentStatus === PARTIALLY_PAID_STATUS && !hasFixedComp);
                        if (latestOrderData.paymentMethod === BNPL_TYPE || (latestOrderData.paymentMethod === MIXED_TYPE && !hasFixedComp) || (latestOrderData.paymentMethod === MIXED_TYPE && hasFixedComp && isFixedCompPaid)) {
                            updates.paymentStatus = PAID_STATUS; updates.paymentReceivedAt = now;
                            if (latestOrderData.status !== COMPLETED_ORDER_STATUS) { updates.status = COMPLETED_ORDER_STATUS; updates.deliveredAt = latestOrderData.deliveredAt || now; }
                            shouldNotifyAdmin = true;
                        } else if (latestOrderData.paymentMethod === MIXED_TYPE && hasFixedComp && !isFixedCompPaid) { updates.paymentStatus = PARTIALLY_PAID_STATUS; }
                    } else { if(latestOrderData.paymentMethod === MIXED_TYPE || latestOrderData.paymentMethod === BNPL_TYPE) { if(latestOrderData.paymentStatus !== PAID_STATUS){ updates.paymentStatus = PARTIALLY_PAID_STATUS; } } }
                } else { console.error("Paid installment not found!"); return; }
            } else if (paymentType === 'Fixed Duration') {
                 const hasInst = Array.isArray(newInstallments) && newInstallments.length > 0; let allInstPaid = !hasInst || newInstallments.every(inst => inst.status?.toLowerCase() === PAID_STATUS.toLowerCase());
                 if (allInstPaid) { updates.paymentStatus = PAID_STATUS; updates.paymentReceivedAt = now; if (latestOrderData.status !== COMPLETED_ORDER_STATUS) { updates.status = COMPLETED_ORDER_STATUS; updates.deliveredAt = latestOrderData.deliveredAt || now; } shouldNotifyAdmin = true; }
                 else { updates.paymentStatus = PARTIALLY_PAID_STATUS; }
            } else { console.warn("Unknown payment type"); return; }

            if (Object.keys(updates).length > 0) {
                 await updateDoc(orderRef, updates); console.log(`Firestore updated: Order ${order.id}`);
                 if (shouldNotifyAdmin) { console.log(`Order ${order.id} completed, notifying admin...`); await sendAdminPaymentNotification(order.id, latestOrderData.userName || order.userName, paidAmount, latestOrderData.paymentMethod); }
            } else { console.log("No Firestore updates needed."); }
        } catch (error) { console.error(`Firestore update error ${order.id}:`, error); Alert.alert("Update Error", "Payment successful, but order update failed."); }
    };

    // --- Payment Button Handlers ---
    const handlePayInstallment = (order, installment) => { initializeAndPay(order, installment.amount, 'Installment', installment); };
    const handlePayFixedDuration = (order, amount) => { initializeAndPay(order, amount, 'Fixed Duration'); };

    // --- Render Function for Each Schedule Item ---
    const renderScheduleItem = ({ item: schedule }) => {
        const paymentMethod = schedule.paymentMethod || 'Unknown';
        const isInstallmentPlan = paymentMethod === BNPL_TYPE;
        const isFixedDurationPlan = paymentMethod === FIXED_TYPE;
        const isMixedPlan = paymentMethod === MIXED_TYPE;
        const hasCodComponent = isMixedPlan && typeof schedule.codAmount === 'number' && schedule.codAmount > 0;
        const hasInstallmentComponent = isMixedPlan && Array.isArray(schedule.installments) && schedule.installments.length > 0;
        const hasFixedDurationComponent = isMixedPlan && (!!schedule.paymentDueDate || !!schedule.fixedDurationAmountDue);
        const displayId = schedule.orderNumber ? `#${schedule.orderNumber}` : `#${schedule.id.substring(0, 6).toUpperCase()}`;
        const firstItem = schedule.items?.[0];
        const imageSource = firstItem?.image ? { uri: firstItem.image } : placeholderImagePath;
        const orderStatus = schedule.status || 'Unknown';
        const paymentStatus = schedule.paymentStatus || 'N/A';
        const remainingAmount = calculateRemainingAmount(schedule);

        const { paidCount, totalCount, progress } = (isInstallmentPlan || hasInstallmentComponent) ? calculateInstallmentProgress(schedule.installments) : { paidCount: 0, totalCount: 0, progress: 0 };
        const firstUnpaidInstallment = (isInstallmentPlan || hasInstallmentComponent) && totalCount > paidCount ? (schedule.installments || []).find(inst => inst.status?.toLowerCase() !== PAID_STATUS.toLowerCase()) : null;

        const fixedDueDate = (isFixedDurationPlan || hasFixedDurationComponent) ? schedule.paymentDueDate : null;
        const fixedAmount = (isFixedDurationPlan || hasFixedDurationComponent) ? (schedule.fixedDurationAmountDue ?? schedule.bnplAmount ?? 0) : 0;
        const isFixedPaid = paymentStatus?.toLowerCase() === PAID_STATUS.toLowerCase() || (isMixedPlan && !hasFixedDurationComponent && paymentStatus?.toLowerCase() === PARTIALLY_PAID_STATUS.toLowerCase());
        const timeRemainingString = fixedDueDate ? formatTimeRemaining(fixedDueDate) : "";
        const isFixedOverdue = fixedDueDate && isValid(fixedDueDate.toDate? fixedDueDate.toDate() : fixedDueDate) ? isPast(startOfDay(fixedDueDate.toDate? fixedDueDate.toDate() : fixedDueDate)) && !isToday(startOfDay(fixedDueDate.toDate? fixedDueDate.toDate() : fixedDueDate)) : false;

        const isAnyPaymentProcessing = !!payingItemId;
        const isPayingThisInstallment = firstUnpaidInstallment && payingItemId === `${schedule.id}-Installment-${firstUnpaidInstallment.installmentNumber}`;
        const isPayingThisFixed = !isFixedPaid && payingItemId === `${schedule.id}-Fixed Duration-fixed`;
        const disableButton = isAnyPaymentProcessing || stripeLoadingHook;

        return (
            <View style={styles.scheduleItemContainer}>
                {/* Touchable Header Part */}
                <TouchableOpacity onPress={() => handleSchedulePress(schedule)} activeOpacity={0.7} style={styles.itemHeaderTouchable}>
                     <View style={styles.itemHeaderContent}>
                         <Image source={imageSource} style={styles.itemImage} defaultSource={placeholderImagePath}/>
                         <View style={styles.itemHeaderText}>
                             <Text style={styles.orderIdText}>{displayId}</Text>
                             <Text style={styles.productNameText} numberOfLines={1}>{firstItem?.name || 'Order Item'}</Text>
                              <View style={styles.subHeaderInfo}>
                                 <Text style={styles.orderDateText}>Ordered: {formatShortDate(schedule.createdAt)}</Text>
                                 <Text style={[styles.paymentStatusText, {color: getOverallStatusColor(paymentStatus)}]}> ({paymentStatus})</Text>
                              </View>
                         </View>
                          <View style={styles.overallStatusContainer}>
                               <Text style={styles.paymentMethodLabel}>{paymentMethod === MIXED_TYPE ? 'Mixed Payment' : paymentMethod}</Text>
                               <Text style={[styles.overallStatusText, { color: getOverallStatusColor(orderStatus) }]}>{orderStatus}</Text>
                          </View>
                     </View>
                </TouchableOpacity>

                <View style={styles.divider} />

                 {/* --- COD Section (for Mixed) --- */}
                 {hasCodComponent && (
                    <View style={styles.componentSection}>
                        <Text style={styles.componentTitle}>Cash on Delivery</Text>
                        <View style={styles.detailRow}><Text style={styles.detailLabel}>COD Amount:</Text><Text style={styles.codAmountValue}>{CURRENCY_SYMBOL}{(schedule.codAmount || 0).toLocaleString()}</Text></View>
                        <View style={styles.detailRow}><Text style={styles.detailLabel}>COD Status:</Text><Text style={styles.detailValue}>{schedule.codPaymentReceivedAt ? `Paid (${formatShortDate(schedule.codPaymentReceivedAt)})` : 'Pending at Delivery'}</Text></View>
                    </View>
                 )}

                {/* --- Installment Section (for BNPL or Mixed) --- */}
                {(isInstallmentPlan || hasInstallmentComponent) && (
                    <View style={[styles.componentSection, hasCodComponent && styles.componentSpacing]}>
                        <Text style={styles.componentTitle}>Installment Plan</Text>
                        <View style={styles.progressSection}>
                            <View style={styles.progressWrapper}><Progress.Bar progress={progress} width={null} height={10} color={ProgressBarColor} unfilledColor="#E0E0E0" borderRadius={5} borderWidth={0} style={styles.progressBar}/><Text style={styles.progressPercentageText}>{Math.round(progress * 100)}%</Text></View>
                             <Text style={styles.progressText}>{paidCount} of {totalCount} installments paid</Text>
                        </View>
                        {schedule.installments && schedule.installments.length > 0 ? ( schedule.installments.map((installment, index) => { const instStatus = installment.status || PENDING_STATUS; const isInstPaid = instStatus.toLowerCase() === PAID_STATUS.toLowerCase(); const isInstOverdue = !isInstPaid && installment.dueDate && isValid(installment.dueDate.toDate ? installment.dueDate.toDate() : installment.dueDate) ? isPast(startOfDay(installment.dueDate.toDate ? installment.dueDate.toDate() : installment.dueDate)) && !isToday(startOfDay(installment.dueDate.toDate ? installment.dueDate.toDate() : installment.dueDate)): false; return ( <View key={`inst-${schedule.id}-${index}`} style={styles.fullInstallmentRow}><View style={styles.installmentRowLeft}><Text style={styles.installmentNumber}>#{installment.installmentNumber || index + 1}</Text><Text style={styles.installmentAmount}>{CURRENCY_SYMBOL} {installment.amount?.toLocaleString() ?? 'N/A'}</Text>{typeof installment.penalty === 'number' && installment.penalty > 0 && (<Text style={styles.penaltyText}>Penalty: {CURRENCY_SYMBOL}{installment.penalty.toFixed(0)}</Text>)}</View><View style={styles.installmentRowRight}><View style={[styles.statusBadgeSmall, getInstallmentStatusStyle(instStatus)]}><Text style={styles.statusTextSmall}>{instStatus}</Text></View><Text style={[styles.installmentDueDate, isInstOverdue && styles.overdueText]}>Due: {formatShortDate(installment.dueDate)} {isInstOverdue ? '(Overdue)' : ''}</Text>{isInstPaid && installment.paidAt && (<Text style={styles.paidAtText}>Paid: {formatShortDate(installment.paidAt)}</Text>)}</View></View> ); }) ) : ( <Text style={styles.noScheduleText}>No installment details.</Text> )}
                        {firstUnpaidInstallment && remainingAmount > 0 && (<TouchableOpacity style={[styles.payButton, disableButton && styles.payButtonDisabled]} onPress={() => handlePayInstallment(schedule, firstUnpaidInstallment)} disabled={disableButton}>{isPayingThisInstallment ? (<ActivityIndicator size="small" color="#FFFFFF" />) : (<Text style={styles.payButtonText}>Pay Next ({CURRENCY_SYMBOL}{firstUnpaidInstallment.amount?.toLocaleString()})</Text>)}</TouchableOpacity> )}
                    </View>
                 )}

                 {/* --- Fixed Duration Section (for Fixed or Mixed) --- */}
                 {(isFixedDurationPlan || hasFixedDurationComponent) && (
                     <View style={[styles.componentSection, (hasCodComponent || hasInstallmentComponent) && styles.componentSpacing]}>
                         <Text style={styles.componentTitle}>Fixed Duration Payment</Text>
                         <View style={styles.detailRow}><Text style={styles.detailLabel}>Amount Due:</Text><Text style={styles.detailValueAmount}>{CURRENCY_SYMBOL}{fixedAmount.toLocaleString()}</Text></View>
                         <View style={styles.detailRow}>
                             <Text style={styles.detailLabel}>Payment Due:</Text>
                             <View style={styles.fixedDueDateContainer}>
                                <AnimatedTimeRemaining timeString={timeRemainingString} isOverdue={isFixedOverdue && !isFixedPaid} />
                                <Text style={styles.absoluteDateText}>({formatShortDate(fixedDueDate)})</Text>
                             </View>
                         </View>
                         {typeof schedule.penalty === 'number' && schedule.penalty > 0 && (<View style={styles.detailRow}><Text style={[styles.detailLabel, styles.penaltyLabel]}>Penalty:</Text><Text style={[styles.detailValue, styles.penaltyValue]}>{CURRENCY_SYMBOL}{schedule.penalty.toFixed(0)}</Text></View>)}
                         { isFixedPaid && schedule.paymentReceivedAt ? (<View style={styles.detailRow}><Text style={styles.detailLabel}>Payment Status:</Text><Text style={styles.paidText}>Paid ({formatShortDate(schedule.paymentReceivedAt)})</Text></View>) : isFixedPaid && !schedule.paymentReceivedAt ? (<View style={styles.detailRow}><Text style={styles.detailLabel}>Payment Status:</Text><Text style={styles.paidText}>Paid</Text></View>) : (<View style={styles.detailRow}><Text style={styles.detailLabel}>Payment Status:</Text><Text style={styles.detailValue}>Pending</Text></View>) }
                         {!isFixedPaid && fixedAmount > 0 && ( <TouchableOpacity style={[styles.payButton, disableButton && styles.payButtonDisabled]} onPress={() => handlePayFixedDuration(schedule, fixedAmount)} disabled={disableButton}>{isPayingThisFixed ? (<ActivityIndicator size="small" color="#FFFFFF" />) : (<Text style={styles.payButtonText}>Pay Now ({CURRENCY_SYMBOL}{fixedAmount.toLocaleString()})</Text>)}</TouchableOpacity> )}
                    </View>
                 )}

                 {/* Order Totals & Overall Remaining */}
                  <View style={[styles.orderTotalsSection, styles.componentSection]}>
                     <View style={styles.totalRow}><Text style={styles.totalLabel}>Order Total:</Text><Text style={styles.totalValue}>{CURRENCY_SYMBOL}{schedule.grandTotal?.toLocaleString() ?? 'N/A'}</Text></View>
                     {paymentStatus?.toLowerCase() !== PAID_STATUS.toLowerCase() && remainingAmount > 0 && (
                          <View style={styles.totalRow}><Text style={styles.totalLabel}>Total Remaining:</Text><Text style={[styles.totalValue, styles.remainingAmountHighlight]}>{CURRENCY_SYMBOL}{remainingAmount.toLocaleString() ?? 'N/A'}</Text></View>
                      )}
                 </View>

            </View>
        );
     };

    // --- Calculate if there are any *active* schedules for the empty state message ---
    const hasActiveSchedules = useMemo(() => { return schedules.some(schedule => schedule.status?.toLowerCase() === ACTIVE_ORDER_STATUS.toLowerCase()); }, [schedules]);

    // --- Loading / Error / Empty States ---
    if (loading && schedules.length === 0 && !refreshing) { return (<SafeAreaView style={styles.centeredContainer}><ActivityIndicator size="large" color={AccentColor} /></SafeAreaView>); }
    if (dbError && !loading && !refreshing && schedules.length === 0) { return (<SafeAreaView style={styles.centeredContainer}><MaterialIcons name="error-outline" size={60} color={OverdueColor} /><Text style={styles.errorText}>{dbError}</Text>{dbError !== "Please log in to view your schedules." && ( <TouchableOpacity onPress={setupScheduleListener} style={styles.retryButton}><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity>)}</SafeAreaView>); }

    // --- Main Render ---
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
            {dbError && !loading && schedules.length > 0 && (<View style={styles.errorBanner}><Text style={styles.errorBannerText}>⚠️ {dbError}</Text></View>)}
            <FlatList
                data={schedules}
                renderItem={renderScheduleItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[styles.listContainer, schedules.length === 0 && styles.emptyListContainer]}
                ListEmptyComponent={ !loading && !dbError ? (<View style={styles.emptyContainer}><MaterialIcons name="receipt-long" size={60} color="#CED4DA" /><Text style={styles.emptyText}>{schedules.length > 0 && !hasActiveSchedules ? "You have no currently active payment schedules." : "You have no Installment or Fixed Duration payment plans."}</Text></View>) : null }
                refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AccentColor]} tintColor={AccentColor} /> }
            />
        </SafeAreaView>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: ScreenBackgroundColor },
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    listContainer: { paddingHorizontal: 10, paddingVertical: 15, flexGrow: 1 },
    scheduleItemContainer: { backgroundColor: AppBackgroundColor, borderRadius: 12, marginBottom: 18, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 2.5, borderWidth: 1, borderColor: '#eee'},
    itemHeaderTouchable: { paddingVertical: 12, paddingHorizontal: 12 },
    itemHeaderContent: { flexDirection: 'row', alignItems: 'center' },
    itemImage: { width: 55, height: 55, borderRadius: 8, marginRight: 12, backgroundColor: PlaceholderBgColor },
    itemHeaderText: { flex: 1 },
    orderIdText: { fontSize: 13, color: TextColorSecondary, marginBottom: 2 },
    productNameText: { fontSize: 15, fontWeight: '600', color: TextColorPrimary, marginBottom: 3 },
    subHeaderInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 2, flexWrap: 'wrap' },
    orderDateText: { fontSize: 11, color: TextColorSecondary, marginRight: 5 },
    paymentStatusText: { fontSize: 11, fontWeight: 'bold', fontStyle: 'italic' },
    overallStatusContainer: { marginLeft: 8, alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch' },
    paymentMethodLabel: { fontSize: 10, color: TextColorSecondary, marginBottom: 4, fontWeight: '500', textAlign: 'right'},
    overallStatusText: { fontSize: 12, fontWeight: 'bold', textAlign: 'right' },
    divider: { height: 1, backgroundColor: '#F0F0F0' },
    detailsContainer: { paddingHorizontal: 0, paddingBottom: 0, paddingTop: 0 },
    componentSection: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 },
    componentSpacing: { marginTop: 10, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
    componentTitle: { fontSize: 14, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 10, borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 5 },
    progressSection: { marginBottom: 15, paddingBottom: 10 },
    progressWrapper: { position: 'relative', height: 10, marginBottom: 4, borderRadius: 5, backgroundColor: '#E0E0E0', overflow: 'hidden' },
    progressBar: { height: '100%', borderRadius: 5 },
    progressPercentageText: { position: 'absolute', right: 5, top: -2, fontSize: 9, fontWeight: 'bold', color: '#FFF', textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1, backgroundColor: 'transparent' },
    progressText: { fontSize: 12, color: TextColorSecondary, textAlign: 'center' },
    fullInstallmentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', alignItems: 'center' },
    installmentRowLeft: { flex: 1.5, marginRight: 5 },
    installmentRowRight: { flex: 1, alignItems: 'flex-end' },
    installmentNumber: { fontSize: 13, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 2 },
    installmentAmount: { fontSize: 13, color: TextColorSecondary, marginBottom: 2 },
    penaltyText: { fontSize: 11, color: OverdueColor, fontStyle: 'italic' },
    statusBadgeSmall: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 10, marginBottom: 3 },
    statusTextSmall: { fontSize: 10, fontWeight: 'bold', color: '#fff' },
    installmentDueDate: { fontSize: 12, color: TextColorSecondary },
    paidAtText: { fontSize: 11, color: TextColorSecondary, fontStyle: 'italic', marginTop: 2 },
    statusPaidInstallment: { backgroundColor: SuccessColor },
    statusPendingInstallment: { backgroundColor: PendingColor },
    noScheduleText: { color: TextColorSecondary, fontStyle: 'italic', paddingVertical: 10, textAlign: 'center' },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingVertical: 2 },
    detailLabel: { fontSize: 14, color: TextColorSecondary, marginRight: 5 },
    codAmountValue: { fontSize: 14, fontWeight: 'bold', color: TextColorPrimary, textAlign: 'right' },
    detailValueAmount: { fontSize: 15, fontWeight: '600', color: TextColorPrimary, textAlign: 'right' },
    detailValueDate: { fontSize: 14, fontWeight: '600', textAlign: 'right' },
    detailValue: { fontSize: 14, fontWeight: '500', color: TextColorSecondary, textAlign: 'right' },
    fixedDueDateContainer: { alignItems: 'flex-end' },
    timeRemainingAnimatedContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
    iconStyle: { marginRight: 4 },
    absoluteDateText: { fontSize: 11, color: TextColorSecondary, fontStyle: 'italic', textAlign: 'right' },
    overdueText: { color: OverdueColor, fontWeight: 'bold' },
    paidText: { fontSize: 14, fontWeight: 'bold', color: SuccessColor, textAlign: 'right' },
    penaltyLabel: { color: OverdueColor },
    penaltyValue: { color: OverdueColor, fontWeight: 'bold', textAlign: 'right' },
    orderTotalsSection: { marginTop: 15, paddingTop: 12, paddingBottom: 5, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    totalLabel: { fontSize: 14, color: TextColorSecondary },
    totalValue: { fontSize: 14, fontWeight: '500', color: TextColorPrimary },
    remainingAmountHighlight: { fontWeight: 'bold', color: AccentColor },
    payButton: { backgroundColor: AccentColor, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 6, alignItems: 'center', marginTop: 15, marginHorizontal: 12, marginBottom: 5 },
    payButtonDisabled: { backgroundColor: TextColorSecondary },
    payButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
    errorText: { color: OverdueColor, fontSize: 16, textAlign: 'center', marginTop: 15 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyListContainer: { flexGrow: 1 },
    emptyText: { textAlign: 'center', fontSize: 16, color: TextColorSecondary, marginTop: 15 },
    retryButton: { backgroundColor: AccentColor, paddingVertical: 10, paddingHorizontal: 25, borderRadius: 6, marginTop: 20 },
    retryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
    errorBanner: { backgroundColor: '#FFF3E0', paddingVertical: 8, paddingHorizontal: 15 },
    errorBannerText: { color: '#E65100', fontSize: 13, textAlign: 'center' },
});