// SchedulesDetailScreen.js - NEW Detail Screen

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    StyleSheet, Text, View, FlatList, SafeAreaView,
    ActivityIndicator, TouchableOpacity, StatusBar, ScrollView, // Use ScrollView
    Image, Alert,
    Animated
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native'; // Import useRoute
import { MaterialIcons } from '@expo/vector-icons';
import * as Progress from 'react-native-progress';
import {
    getFirestore, collection, query, where, Timestamp,
    onSnapshot, doc, updateDoc, getDocs
} from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { format, isValid, isPast, differenceInDays, isToday, isTomorrow, startOfDay } from 'date-fns';
import { useStripe } from '@stripe/stripe-react-native';
import axios from 'axios';

// --- Constants (Copy from UserBNPLSchedules) ---
const AppBackgroundColor = '#FFFFFF';
const ScreenBackgroundColor = '#F8F9FA';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const AccentColor = '#FF4500';
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
const USERS_COLLECTION = 'Users';
const CURRENCY_SYMBOL = 'PKR';
const BNPL_TYPE = 'BNPL';
const FIXED_TYPE = 'Fixed Duration';
const MIXED_TYPE = 'Mixed';
const PAID_STATUS = 'Paid';
const PENDING_STATUS = 'Pending';
const PARTIALLY_PAID_STATUS = 'Partially Paid';
const COMPLETED_ORDER_STATUS = 'Delivered';
const placeholderImagePath = require('../../assets/p3.jpg'); // Adjust path
const PAYMENT_API_ENDPOINT = "https://back.txyber.com/create-payment-intent";
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

// --- Helper Functions (Copy from UserBNPLSchedules) ---
const formatShortDate = (timestamp) => { /* ... */ };
const getOverallStatusColor = (status) => { /* ... */ };
const getInstallmentStatusStyle = (status) => { /* ... */ };
const calculateInstallmentProgress = (installments = []) => { /* ... */ };
const calculateRemainingAmount = (schedule) => { /* ... */ };
const formatTimeRemaining = (dueDateTimestamp) => { /* ... */ };
async function getAdminExpoTokens() { /* ... */ }
async function sendAdminPaymentNotification(orderId, userName, amountPaid, paymentMethod) { /* ... */ }

// --- Animated Component for Time Remaining --- (Copy from UserBNPLSchedules)
const AnimatedTimeRemaining = ({ timeString, isOverdue }) => { /* ... */ };

// --- Main Detail Screen Component ---
export default function SchedulesDetailScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const initialSchedule = route.params?.schedule; // Receive the 'schedule' object

    const { initPaymentSheet, presentPaymentSheet, loading: stripeLoadingHook } = useStripe();
    // Use state to hold the schedule data, allowing for potential future updates if needed
    const [schedule, setSchedule] = useState(initialSchedule);
    const [payingItemId, setPayingItemId] = useState(null); // For payment button loading state
    const [localError, setLocalError] = useState(null); // Errors specific to this screen/actions

     // Optional: Set up a listener for this specific order if real-time updates ARE needed on the detail screen
     useEffect(() => {
        if (!schedule?.id) return; // Exit if no valid schedule ID

        const orderRef = doc(db, ORDERS_COLLECTION, schedule.id);
        const unsubscribe = onSnapshot(orderRef, (docSnap) => {
            if (docSnap.exists()) {
                console.log(`[SchedulesDetailScreen] Received update for ${schedule.id}`);
                setSchedule({ id: docSnap.id, ...docSnap.data() }); // Update local state
                setLocalError(null);
            } else {
                console.warn(`[SchedulesDetailScreen] Order ${schedule.id} snapshot doesn't exist.`);
                setLocalError("Order data might be outdated or deleted.");
            }
        }, (error) => {
            console.error(`[SchedulesDetailScreen] Listener error for ${schedule.id}:`, error);
            setLocalError("Failed to get real-time updates.");
        });

        // Cleanup listener on unmount
        return () => unsubscribe();

     }, [schedule?.id]); // Re-run if the schedule ID changes (shouldn't happen often)


    // --- Placeholder Payment Handlers (Copied from UserBNPLSchedules) ---
    // These now operate on the 'schedule' state object
    const initializeAndPay = async (order, amountToPay, paymentType, installment = null) => { /* ... (Keep the exact Stripe logic) ... */ };
    const updateFirestoreAfterPayment = async (order, paidAmount, paymentType, paidInstallment = null) => { /* ... (Keep the exact Firestore update logic) ... */ };
    const handlePayInstallment = (installment) => { initializeAndPay(schedule, installment.amount, 'Installment', installment); };
    const handlePayFixedDuration = (amount) => { initializeAndPay(schedule, amount, 'Fixed Duration'); };


    // --- Loading/Error State for initial load ---
    if (!schedule) {
        // This case handles if navigation param was missing
        return (
            <SafeAreaView style={styles.centeredContainer}>
                <Text style={styles.errorText}>Schedule details not available.</Text>
                 <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.backButtonText}>Go Back</Text></TouchableOpacity>
            </SafeAreaView>
        );
    }

    // --- Derive necessary data from the schedule state object ---
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

    // --- Main Render for Detail Screen ---
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
            {/* Stack Navigator provides header */}
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                {/* Display localError if listener fails */}
                 {localError && (<View style={styles.errorBanner}><Text style={styles.errorBannerText}>⚠️ {localError}</Text></View>)}

                 {/* --- Section 1: Order Header Info (Similar to list item header) --- */}
                 <View style={styles.section}>
                    <View style={styles.itemHeaderContent}>
                        <Image source={imageSource} style={styles.itemImageLarge} defaultSource={placeholderImagePath}/>
                        <View style={styles.itemHeaderText}>
                             <Text style={styles.orderIdTextLarge}>{displayId}</Text>
                             <Text style={styles.productNameTextLarge} numberOfLines={2}>{firstItem?.name || 'Order Item'}</Text>
                              <View style={styles.subHeaderInfo}><Text style={styles.orderDateTextLarge}>Ordered: {formatShortDate(schedule.createdAt)}</Text></View>
                        </View>
                        <View style={styles.overallStatusContainer}>
                            <Text style={styles.paymentMethodLabel}>{paymentMethod === MIXED_TYPE ? 'Mixed Payment' : paymentMethod}</Text>
                            <Text style={[styles.overallStatusTextLarge, { color: getOverallStatusColor(orderStatus) }]}>{orderStatus}</Text>
                            <Text style={[styles.paymentStatusText, {color: getOverallStatusColor(paymentStatus)}]}>({paymentStatus})</Text>
                        </View>
                    </View>
                 </View>

                {/* Section 2: Payment Breakdown */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment Details</Text>

                     {/* --- COD Component --- */}
                    {hasCodComponent && (
                        <View style={styles.componentSection}>
                            <Text style={styles.componentTitle}>Cash on Delivery</Text>
                            <View style={styles.detailRow}><Text style={styles.detailLabel}>COD Amount:</Text><Text style={styles.codAmountValue}>{CURRENCY_SYMBOL}{(schedule.codAmount || 0).toLocaleString()}</Text></View>
                            <View style={styles.detailRow}><Text style={styles.detailLabel}>COD Status:</Text><Text style={styles.detailValue}>{schedule.codPaymentReceivedAt ? `Paid (${formatShortDate(schedule.codPaymentReceivedAt)})` : 'Pending at Delivery'}</Text></View>
                        </View>
                    )}

                    {/* --- Installment Component --- */}
                    {(isInstallmentPlan || hasInstallmentComponent) && (
                        <View style={[styles.componentSection, hasCodComponent && styles.componentSpacing]}>
                            <Text style={styles.componentTitle}>Installment Plan</Text>
                            <View style={styles.progressSection}>
                                <View style={styles.progressWrapper}><Progress.Bar progress={progress} width={null} height={10} color={ProgressBarColor} unfilledColor="#E0E0E0" borderRadius={5} borderWidth={0} style={styles.progressBar}/><Text style={styles.progressPercentageText}>{Math.round(progress * 100)}%</Text></View>
                                <Text style={styles.progressText}>{paidCount} of {totalCount} installments paid</Text>
                            </View>
                            {schedule.installments && schedule.installments.length > 0 ? ( schedule.installments.map((installment, index) => { const instStatus = installment.status || PENDING_STATUS; const isInstPaid = instStatus.toLowerCase() === PAID_STATUS.toLowerCase(); const isInstOverdue = !isInstPaid && installment.dueDate && isValid(installment.dueDate.toDate ? installment.dueDate.toDate() : installment.dueDate) ? isPast(startOfDay(installment.dueDate.toDate ? installment.dueDate.toDate() : installment.dueDate)) && !isToday(startOfDay(installment.dueDate.toDate ? installment.dueDate.toDate() : installment.dueDate)): false; return ( <View key={`inst-${schedule.id}-${index}`} style={styles.fullInstallmentRow}><View style={styles.installmentRowLeft}><Text style={styles.installmentNumber}>#{installment.installmentNumber || index + 1}</Text><Text style={styles.installmentAmount}>{CURRENCY_SYMBOL} {installment.amount?.toLocaleString() ?? 'N/A'}</Text>{typeof installment.penalty === 'number' && installment.penalty > 0 && (<Text style={styles.penaltyText}>Penalty: {CURRENCY_SYMBOL}{installment.penalty.toFixed(0)}</Text>)}</View><View style={styles.installmentRowRight}><View style={[styles.statusBadgeSmall, getInstallmentStatusStyle(instStatus)]}><Text style={styles.statusTextSmall}>{instStatus}</Text></View><Text style={[styles.installmentDueDate, isInstOverdue && styles.overdueText]}>Due: {formatShortDate(installment.dueDate)} {isInstOverdue ? '(Overdue)' : ''}</Text>{isInstPaid && installment.paidAt && (<Text style={styles.paidAtText}>Paid: {formatShortDate(installment.paidAt)}</Text>)}</View></View> ); }) ) : ( <Text style={styles.noScheduleText}>No installment details.</Text> )}
                            {firstUnpaidInstallment && (schedule.bnplAmount > 0) && (<TouchableOpacity style={[styles.payButton, disableButton && styles.payButtonDisabled]} onPress={() => handlePayInstallment(firstUnpaidInstallment)} disabled={disableButton}>{isPayingThisInstallment ? (<ActivityIndicator size="small" color="#FFFFFF" />) : (<Text style={styles.payButtonText}>Pay Next ({CURRENCY_SYMBOL}{firstUnpaidInstallment.amount?.toLocaleString()})</Text>)}</TouchableOpacity> )}
                        </View>
                    )}

                     {/* --- Fixed Duration Component --- */}
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
                            {!isFixedPaid && fixedAmount > 0 && ( <TouchableOpacity style={[styles.payButton, disableButton && styles.payButtonDisabled]} onPress={() => handlePayFixedDuration(fixedAmount)} disabled={disableButton}>{isPayingThisFixed ? (<ActivityIndicator size="small" color="#FFFFFF" />) : (<Text style={styles.payButtonText}>Pay Now ({CURRENCY_SYMBOL}{fixedAmount.toLocaleString()})</Text>)}</TouchableOpacity> )}
                        </View>
                    )}
                </View>

                {/* Section 4: Totals */}
                 <View style={styles.section}>
                     <Text style={styles.sectionTitle}>Order Totals</Text>
                     <View style={styles.detailRow}><Text style={styles.totalLabel}>Subtotal:</Text><Text style={styles.totalValue}>{CURRENCY_SYMBOL}{schedule.subtotal?.toLocaleString() ?? 'N/A'}</Text></View>
                     {typeof schedule.deliveryFee === 'number' && schedule.deliveryFee > 0 && (<View style={styles.detailRow}><Text style={styles.totalLabel}>Delivery Fee:</Text><Text style={styles.totalValue}>{CURRENCY_SYMBOL}{schedule.deliveryFee.toLocaleString()}</Text></View>)}
                     <View style={styles.totalDivider} />
                     <View style={styles.detailRow}><Text style={styles.grandTotalLabel}>Grand Total:</Text><Text style={styles.grandTotalValue}>{CURRENCY_SYMBOL}{schedule.grandTotal?.toLocaleString() ?? 'N/A'}</Text></View>
                      {paymentStatus?.toLowerCase() !== PAID_STATUS.toLowerCase() && remainingAmount > 0 && (
                           <View style={[styles.detailRow, styles.remainingRow]}>
                                <Text style={styles.remainingLabel}>Total Amount Remaining:</Text>
                                <Text style={styles.remainingAmountHighlight}>{CURRENCY_SYMBOL}{remainingAmount.toLocaleString() ?? 'N/A'}</Text>
                           </View>
                       )}
                 </View>

            </ScrollView>
        </SafeAreaView>
    );
}

// --- Styles --- (Adapted from UserOrderDetailScreen and UserBNPLSchedules)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: ScreenBackgroundColor },
    scrollContainer: { flexGrow: 1, padding: 15, paddingBottom: 40 }, // Added paddingBottom
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    errorText: { color: AccentColor, fontSize: 16, textAlign: 'center', marginBottom: 20 },
    backButton: { backgroundColor: AccentColor, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6 },
    backButtonText: { color: '#fff', fontWeight: 'bold' },
    errorBanner: { backgroundColor: '#FFF3E0', paddingVertical: 8, paddingHorizontal: 15, marginBottom: 10 }, // Added marginBottom
    errorBannerText: { color: '#E65100', fontSize: 13, textAlign: 'center' },
    section: { backgroundColor: AppBackgroundColor, borderRadius: 10, padding: 15, marginBottom: 18, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, borderWidth: 1, borderColor: '#eee' },
    sectionTitle: { fontSize: 17, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
    // Header Info Styles
    itemHeaderContent: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 }, // Added marginBottom
    itemImageLarge: { width: 60, height: 60, borderRadius: 8, marginRight: 15, backgroundColor: PlaceholderBgColor },
    itemHeaderText: { flex: 1 },
    orderIdTextLarge: { fontSize: 14, color: TextColorSecondary, marginBottom: 3 },
    productNameTextLarge: { fontSize: 16, fontWeight: '600', color: TextColorPrimary, marginBottom: 4 },
    subHeaderInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 2, flexWrap: 'wrap' },
    orderDateTextLarge: { fontSize: 12, color: TextColorSecondary, marginRight: 6 },
    paymentStatusText: { fontSize: 11, fontWeight: 'bold', fontStyle: 'italic' },
    overallStatusContainer: { marginLeft: 8, alignItems: 'flex-end', justifyContent: 'center' },
    paymentMethodLabel: { fontSize: 10, color: TextColorSecondary, marginBottom: 4, fontWeight: '500', textAlign: 'right'},
    overallStatusTextLarge: { fontSize: 13, fontWeight: 'bold', textAlign: 'right' },
     // General Detail Rows
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingVertical: 2 },
    addressDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, paddingVertical: 2 },
    detailLabel: { fontSize: 14, color: TextColorSecondary, marginRight: 10, flexShrink: 0 },
    detailValue: { fontSize: 14, fontWeight: '500', color: TextColorPrimary, textAlign: 'right', flexShrink: 1 },
    addressValue: { fontSize: 14, fontWeight: '500', color: TextColorPrimary, textAlign: 'left', flex: 1, marginLeft: 5 },
    totalValueHighlight: { color: AccentColor, fontWeight: 'bold', fontSize: 15 },
    statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, alignSelf: 'flex-end' },
    statusText: { fontSize: 12, fontWeight: 'bold', color: '#fff' },
    // Payment Breakdown Styles
    paymentSubSection: { paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
    subSectionSpacing: { marginTop: 20 },
    paymentSubHeader: { fontSize: 16, fontWeight: '600', color: TextColorPrimary, marginBottom: 12 },
    codAmountValue: { fontSize: 14, fontWeight: 'bold', color: TextColorPrimary },
    planAmountHighlight: { color: PlanAmountColor, fontWeight: 'bold' },
    dueDateHighlight: { fontWeight: 'bold', color: AccentColor },
    planDetailsBox: { marginTop: 5, marginBottom: 15, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 6, borderWidth: 1, borderColor: '#eee' },
    planDetailText: { fontSize: 13, color: TextColorSecondary, marginBottom: 4, lineHeight: 18 },
    emptyListText: { textAlign: 'center', color: TextColorSecondary, paddingVertical: 15 },
    installmentListStyle: { marginTop: 10 },
    // Installment Styles
    installmentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, alignItems: 'center' },
    installmentSeparator: { height: 1, backgroundColor: '#f0f0f0' },
    installmentLeft: { flex: 1, marginRight: 10 },
    installmentRight: { alignItems: 'flex-end', minWidth: 90 },
    installmentNumber: { fontSize: 14, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 4 },
    installmentAmount: { fontSize: 14, color: TextColorSecondary, marginBottom: 4 },
    installmentDueDate: { fontSize: 12, color: TextColorSecondary, marginTop: 4 },
    paidAtText: { fontSize: 11, color: TextColorSecondary, fontStyle: 'italic', marginTop: 3 },
    penaltyText: { fontSize: 12, color: OverdueColor, marginTop: 2, fontWeight: '500' },
    statusBadgeSmall: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, marginBottom: 3 },
    statusTextSmall: { fontSize: 11, fontWeight: 'bold', color: '#fff' },
    statusPaidInstallment: { backgroundColor: SuccessColor },
    statusPendingInstallment: { backgroundColor: PendingColor },
    // Fixed Duration Styles
     penaltyLabel: { color: OverdueColor },
     penaltyValue: { color: OverdueColor, fontWeight: 'bold' },
     fixedDueDateContainer: { alignItems: 'flex-end' },
     timeRemainingAnimatedContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
     iconStyle: { marginRight: 4 },
     absoluteDateText: { fontSize: 11, color: TextColorSecondary, fontStyle: 'italic', textAlign: 'right' },
     overdueText: { color: OverdueColor, fontWeight: 'bold' },
     paidText: { fontSize: 14, fontWeight: 'bold', color: SuccessColor, textAlign: 'right' },
     detailValueDate: { fontSize: 14, fontWeight: '600', textAlign: 'right' }, // For animated timer text also
     // Order Totals Section
     orderTotalsSection: { marginTop: 15, paddingTop: 12, paddingBottom: 5, paddingHorizontal: 0 }, // No horizontal padding needed if within section
     totalDivider: { height: 1, backgroundColor: '#eee', marginVertical: 10 },
     grandTotalLabel: { fontWeight: 'bold', fontSize: 16, color: TextColorPrimary },
     grandTotalValue: { fontWeight: 'bold', fontSize: 16, color: AccentColor },
     remainingRow: { marginTop: 8 },
     remainingLabel: { fontSize: 15, fontWeight: 'bold', color: TextColorPrimary },
     remainingAmountHighlight: { fontSize: 15, fontWeight: 'bold', color: AccentColor },
     // Pay Button
     payButton: { backgroundColor: AccentColor, paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, alignItems: 'center', marginTop: 20, marginHorizontal: 12 }, // Increased margin
     payButtonDisabled: { backgroundColor: TextColorSecondary },
     payButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    // Status Badge Colors
    statusPending: { backgroundColor: PendingColor }, statusProcessing: { backgroundColor: ProcessingColor }, statusPartiallyPaid: { backgroundColor: ProcessingColor }, statusShipped: { backgroundColor: ShippedColor }, statusDelivered: { backgroundColor: DeliveredColor }, statusActive: { backgroundColor: ActiveColor }, statusCancelled: { backgroundColor: OverdueColor }, statusPaidOverall: { backgroundColor: SuccessColor }, statusUnknown: { backgroundColor: UnknownColor },
});