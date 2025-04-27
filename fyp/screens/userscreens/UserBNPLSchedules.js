// UserBNPLSchedules.js - FINAL COMPLETE CODE V4 (Verified - Text Rendering Checked)
// Shows All BNPL/Fixed/Mixed Orders, Full Details Inline, Separated Progress Bar for Installments,
// Animated Timer for Fixed Duration, Pay Buttons, No Header, Specific Empty State

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
    onSnapshot // Use onSnapshot for real-time updates
} from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig'; // Ensure path is correct
import { format, isValid, isPast, differenceInDays, isToday, isTomorrow, startOfDay } from 'date-fns';

// --- Constants ---
const AppBackgroundColor = '#FFFFFF';
const ScreenBackgroundColor = '#F8F9FA';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const AccentColor = '#FF4500'; // User theme color
const ProgressBarColor = AccentColor; // Color for the progress bar
const SuccessColor = '#4CAF50'; // For Paid status
const PendingColor = '#FFA726'; // For Pending status
const OverdueColor = '#D32F2F';
const ProcessingColor = '#42A5F5'; // For Processing/Partially Paid
const ActiveColor = '#29B6F6';    // For Active order status
const ShippedColor = '#66BB6A'; // For Shipped status
const DeliveredColor = '#78909C'; // For Delivered status
const UnknownColor = '#BDBDBD'; // For Unknown status
const PlanAmountColor = '#0056b3'; // Blue for plan amounts
const PlaceholderBgColor = '#F0F0F0';
const ORDERS_COLLECTION = 'orders';
const CURRENCY_SYMBOL = 'PKR';
const BNPL_TYPE = 'BNPL';
const FIXED_TYPE = 'Fixed Duration';
const MIXED_TYPE = 'Mixed';
const PAID_STATUS = 'Paid';
const PENDING_STATUS = 'Pending';
const PARTIALLY_PAID_STATUS = 'Partially Paid';
const ACTIVE_ORDER_STATUS = 'Active'; // For checking in empty state
const placeholderImagePath = require('../../assets/p3.jpg'); // *** ADJUST PATH IF NEEDED ***

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
     else if (paymentMethod === MIXED_TYPE) { let remainingBnpl = 0; let remainingFixed = 0; if (Array.isArray(schedule.installments) && schedule.installments.length > 0) { const totalBnplAmount = schedule.bnplAmount || 0; let paidBnplAmount = 0; schedule.installments.forEach(inst => { if (inst.status?.toLowerCase() === PAID_STATUS.toLowerCase() && typeof inst.amount === 'number') { paidBnplAmount += inst.amount; } }); remainingBnpl = totalBnplAmount - paidBnplAmount; remainingBnpl = remainingBnpl >= 0 ? remainingBnpl : 0; } const fixedAmountDue = schedule.fixedDurationAmountDue ?? schedule.bnplAmount ?? 0; if (fixedAmountDue > 0 && paymentStatus !== PAID_STATUS.toLowerCase()) { remainingFixed = fixedAmountDue; } return remainingBnpl + remainingFixed; }
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
    // Ensure all rendered output is within valid components
    return (
        <Animated.View style={[styles.timeRemainingAnimatedContainer, { transform: [{ scale: pulseAnim }] }]}>
            <MaterialIcons name="timer" size={15} color={textColor} style={styles.iconStyle} />
            <Text style={[styles.detailValueDate, { color: textColor }]}>{timeString}</Text>
        </Animated.View>
    );
};

// --- Main Component ---
export default function UserBNPLSchedules() {
    const navigation = useNavigation();
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [userId, setUserId] = useState(null);
    const listenerUnsubscribeRef = useRef(null);

    // --- Effect 1: Monitor Authentication State ---
    useEffect(() => {
        console.log("[UserSchedules] Attaching Auth listener.");
        const unsubscribeAuth = auth.onAuthStateChanged(user => {
            const currentUid = user ? user.uid : null;
            console.log("[UserSchedules] Auth State Changed. User ID:", currentUid);
            if (currentUid !== userId) {
                setUserId(currentUid);
                if (!currentUid) { setError("Please log in to view your schedules."); setLoading(false); setSchedules([]); setRefreshing(false); if (listenerUnsubscribeRef.current) { listenerUnsubscribeRef.current(); listenerUnsubscribeRef.current = null; } }
                else { setError(null); if(schedules.length === 0) setLoading(true); }
            }
        });
        return () => { console.log("[UserSchedules] Cleaning up Auth Listener."); unsubscribeAuth(); };
    }, [userId, schedules.length]);

    // --- Effect 2 / Function: Setup Firestore Listener ---
    const setupScheduleListener = useCallback(() => {
        if (!userId) { console.log("[UserSchedules] No userId."); setSchedules([]); setLoading(false); setRefreshing(false); if (listenerUnsubscribeRef.current) { listenerUnsubscribeRef.current(); listenerUnsubscribeRef.current = null; } return null; }
        if (!refreshing && schedules.length === 0) setLoading(true);
        setError(null);
        console.log(`[UserSchedules] Setting up listener for user ${userId}.`);
        if (listenerUnsubscribeRef.current) { listenerUnsubscribeRef.current(); listenerUnsubscribeRef.current = null; }

        const ordersRef = collection(db, ORDERS_COLLECTION);
        const q = query(ordersRef, where("userId", "==", userId));

        console.log("[UserSchedules] Attaching Firestore listener...");
        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log(`[UserSchedules] Snapshot: ${snapshot.docs.length} total orders.`);
            let allUserOrders = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })).filter(order => order.createdAt);

            // Filter for BNPL/Fixed/Mixed orders (any status)
            let paymentPlanOrders = allUserOrders.filter(order =>
                order.paymentMethod === BNPL_TYPE || order.paymentMethod === FIXED_TYPE || order.paymentMethod === MIXED_TYPE
            );

            // Sort client-side
            paymentPlanOrders.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));

            console.log(`[UserSchedules] Filtered to ${paymentPlanOrders.length} BNPL/Fixed/Mixed.`);
            setSchedules(paymentPlanOrders);
            setLoading(false); setRefreshing(false);

        }, (err) => {
            console.error("[UserSchedules] Listener error:", err);
            setError("Could not update schedules. Check connection.");
            setLoading(false); setRefreshing(false);
        });

        listenerUnsubscribeRef.current = unsubscribe;
        return unsubscribe;

    }, [userId, refreshing, schedules.length]);

    // --- Effect 3: Manage Listener Lifecycle ---
    useFocusEffect(useCallback(() => { console.log("[UserSchedules] Screen focused."); setupScheduleListener(); return () => { if (listenerUnsubscribeRef.current) { console.log("[UserSchedules] Screen blurred."); listenerUnsubscribeRef.current(); listenerUnsubscribeRef.current = null; } }; }, [setupScheduleListener]));

    // --- Handle Pull-to-Refresh ---
    const onRefresh = useCallback(() => { if (!userId) { setRefreshing(false); return; } console.log("[UserSchedules] Manual refresh."); setRefreshing(true); setupScheduleListener(); const timeout = setTimeout(() => { if (refreshing) setRefreshing(false); }, 8000); return () => clearTimeout(timeout); }, [userId, refreshing, setupScheduleListener]);

    // --- Handle Navigation ---
    const handleSchedulePress = (scheduleItem) => { navigation.navigate('UserOrderDetailScreen', { orderId: scheduleItem.id }); };

    // --- Placeholder Payment Handlers ---
    const handlePayInstallment = (orderId, installment) => { Alert.alert("Payment Action", `Pay Installment #${installment.installmentNumber} (${CURRENCY_SYMBOL}${installment.amount?.toLocaleString()})`); };
    const handlePayFixedDuration = (orderId, amount) => { Alert.alert("Payment Action", `Pay Fixed Amount (${CURRENCY_SYMBOL}${amount?.toLocaleString()})`); };

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
        const firstUnpaidInstallment = (isInstallmentPlan || hasInstallmentComponent) && totalCount > paidCount ? schedule.installments.find(inst => inst.status?.toLowerCase() !== PAID_STATUS.toLowerCase()) : null;
        const fixedDueDate = (isFixedDurationPlan || hasFixedDurationComponent) ? schedule.paymentDueDate : null;
        const fixedAmount = (isFixedDurationPlan || hasFixedDurationComponent) ? (schedule.fixedDurationAmountDue ?? schedule.bnplAmount ?? 0) : 0;
        const isFixedPaid = paymentStatus?.toLowerCase() === PAID_STATUS.toLowerCase() || (isMixedPlan && !hasFixedDurationComponent);
        const timeRemainingString = fixedDueDate ? formatTimeRemaining(fixedDueDate) : "";
        const isFixedOverdue = fixedDueDate && isValid(fixedDueDate.toDate? fixedDueDate.toDate() : fixedDueDate) ? isPast(startOfDay(fixedDueDate.toDate? fixedDueDate.toDate() : fixedDueDate)) && !isToday(startOfDay(fixedDueDate.toDate? fixedDueDate.toDate() : fixedDueDate)) : false;

        // Ensure all text is wrapped
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
                            <View style={styles.progressWrapper}>
                                <Progress.Bar progress={progress} width={null} height={10} color={ProgressBarColor} unfilledColor="#E0E0E0" borderRadius={5} borderWidth={0} style={styles.progressBar}/>
                                <Text style={styles.progressPercentageText}>{Math.round(progress * 100)}%</Text>
                            </View>
                             <Text style={styles.progressText}>{paidCount} of {totalCount} installments paid</Text>
                        </View>
                        {schedule.installments && schedule.installments.length > 0 ? ( schedule.installments.map((installment, index) => { const instStatus = installment.status || PENDING_STATUS; const isInstPaid = instStatus.toLowerCase() === PAID_STATUS.toLowerCase(); const isInstOverdue = !isInstPaid && installment.dueDate && isValid(installment.dueDate.toDate ? installment.dueDate.toDate() : installment.dueDate) ? isPast(startOfDay(installment.dueDate.toDate ? installment.dueDate.toDate() : installment.dueDate)) && !isToday(startOfDay(installment.dueDate.toDate ? installment.dueDate.toDate() : installment.dueDate)): false; return ( <View key={`inst-${schedule.id}-${index}`} style={styles.fullInstallmentRow}><View style={styles.installmentRowLeft}><Text style={styles.installmentNumber}>#{installment.installmentNumber || index + 1}</Text><Text style={styles.installmentAmount}>{CURRENCY_SYMBOL} {installment.amount?.toLocaleString() ?? 'N/A'}</Text>{typeof installment.penalty === 'number' && installment.penalty > 0 && (<Text style={styles.penaltyText}>Penalty: {CURRENCY_SYMBOL}{installment.penalty.toFixed(0)}</Text>)}</View><View style={styles.installmentRowRight}><View style={[styles.statusBadgeSmall, getInstallmentStatusStyle(instStatus)]}><Text style={styles.statusTextSmall}>{instStatus}</Text></View><Text style={[styles.installmentDueDate, isInstOverdue && styles.overdueText]}>Due: {formatShortDate(installment.dueDate)} {isInstOverdue ? '(Overdue)' : ''}</Text>{isInstPaid && installment.paidAt && (<Text style={styles.paidAtText}>Paid: {formatShortDate(installment.paidAt)}</Text>)}</View></View> ); }) ) : ( <Text style={styles.noScheduleText}>No installment details.</Text> )}
                        {firstUnpaidInstallment && (schedule.bnplAmount > 0) && (<TouchableOpacity style={styles.payButton} onPress={() => handlePayInstallment(schedule.id, firstUnpaidInstallment)}><Text style={styles.payButtonText}>Pay Next Installment ({CURRENCY_SYMBOL}{firstUnpaidInstallment.amount?.toLocaleString()})</Text></TouchableOpacity> )}
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
                         {!isFixedPaid && fixedAmount > 0 && ( <TouchableOpacity style={styles.payButton} onPress={() => handlePayFixedDuration(schedule.id, fixedAmount)}><Text style={styles.payButtonText}>Pay Now ({CURRENCY_SYMBOL}{fixedAmount.toLocaleString()})</Text></TouchableOpacity> )}
                    </View>
                 )}

                 {/* Order Totals & Overall Remaining */}
                  <View style={[styles.orderTotalsSection, styles.componentSection]}>
                     <View style={styles.totalRow}><Text style={styles.totalLabel}>Order Total:</Text><Text style={styles.totalValue}>{CURRENCY_SYMBOL}{schedule.grandTotal?.toLocaleString() ?? 'N/A'}</Text></View>
                     {paymentStatus?.toLowerCase() !== PAID_STATUS.toLowerCase() && remainingAmount > 0 && (
                          <View style={styles.totalRow}><Text style={styles.totalLabel}>Total Remaining:</Text><Text style={[styles.totalValue, styles.remainingAmountHighlight]}>{CURRENCY_SYMBOL}{remainingAmount.toLocaleString() ?? 'N/A'}</Text></View>
                      )}
                 </View>

            </View> // Closing View for scheduleItemContainer
        );
     };

    // --- Calculate if there are any *active* schedules for the empty state message ---
    const hasActiveSchedules = useMemo(() => {
        return schedules.some(schedule => schedule.status?.toLowerCase() === ACTIVE_ORDER_STATUS.toLowerCase());
    }, [schedules]);

    // --- Loading / Error / Empty States ---
    if (loading && schedules.length === 0 && !refreshing) { return (<SafeAreaView style={styles.centeredContainer}><ActivityIndicator size="large" color={AccentColor} /></SafeAreaView>); }
    if (error && !loading && !refreshing && schedules.length === 0) { return (<SafeAreaView style={styles.centeredContainer}><MaterialIcons name="error-outline" size={60} color={OverdueColor} /><Text style={styles.errorText}>{error}</Text>{error !== "Please log in to view your schedules." && ( <TouchableOpacity onPress={setupScheduleListener} style={styles.retryButton}><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity>)}</SafeAreaView>); }

    // --- Main Render ---
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
            {/* Error Banner for non-blocking errors */}
            {error && !loading && schedules.length > 0 && (<View style={styles.errorBanner}><Text style={styles.errorBannerText}>⚠️ {error}</Text></View>)}
            <FlatList
                data={schedules}
                renderItem={renderScheduleItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[styles.listContainer, schedules.length === 0 && styles.emptyListContainer]} // Apply empty style when needed
                ListEmptyComponent={
                    !loading && !error ? ( // Only show empty state if not loading and no error blocked loading
                        <View style={styles.emptyContainer}>
                             <MaterialIcons name="receipt-long" size={60} color="#CED4DA" />
                             <Text style={styles.emptyText}>
                                 {schedules.length > 0 && !hasActiveSchedules
                                     ? "You have no currently active payment schedules."
                                     : "You have no Installment or Fixed Duration payment plans."
                                 }
                             </Text>
                        </View>
                    ) : null // Otherwise, Loading/Error component is shown
                 }
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
    planTitle: { fontSize: 15, fontWeight: '600', color: TextColorPrimary, marginBottom: 12 }, // Keep if needed, but componentTitle is primary
    // Installment Styles
    progressSection: { marginBottom: 15, paddingBottom: 10 }, // Removed bottom border
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
    // Fixed Duration Styles
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
    // Order Totals Section
    orderTotalsSection: { marginTop: 15, paddingTop: 12, paddingBottom: 5, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0' }, // Added horizontal padding
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }, // Increased vertical spacing
    totalLabel: { fontSize: 14, color: TextColorSecondary },
    totalValue: { fontSize: 14, fontWeight: '500', color: TextColorPrimary },
    remainingAmountHighlight: { fontWeight: 'bold', color: AccentColor },
    // Payment Button Styles
    payButton: { backgroundColor: AccentColor, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 6, alignItems: 'center', marginTop: 15, marginHorizontal: 12, marginBottom: 5 }, // Adjusted margin
    payButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
    // Other Styles
    errorText: { color: OverdueColor, fontSize: 16, textAlign: 'center', marginTop: 15 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyListContainer: { flexGrow: 1 }, // Ensure empty component can center
    emptyText: { textAlign: 'center', fontSize: 16, color: TextColorSecondary, marginTop: 15 },
    retryButton: { backgroundColor: AccentColor, paddingVertical: 10, paddingHorizontal: 25, borderRadius: 6, marginTop: 20 },
    retryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
    errorBanner: { backgroundColor: '#FFF3E0', paddingVertical: 8, paddingHorizontal: 15 },
    errorBannerText: { color: '#E65100', fontSize: 13, textAlign: 'center' },
});