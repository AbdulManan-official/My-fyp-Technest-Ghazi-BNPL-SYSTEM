// UserSchedulesProgressDetails.js - FINAL COMPLETE CODE (Corrected Address Alignment & Text Warning Fix)
// Displays details and schedule progress for BNPL, Fixed Duration, AND MIXED orders

import React from 'react';
import {
    StyleSheet, Text, View, SafeAreaView, ScrollView, FlatList,
    ActivityIndicator, TouchableOpacity, StatusBar, Image, Platform
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import { format, isValid } from 'date-fns';

// --- Constants ---
const AppBackgroundColor = '#FFFFFF';
const ScreenBackgroundColor = '#F8F9FA';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const AccentColor = '#FF0000';
const SuccessColor = '#4CAF50';
const PendingColor = '#FFA726';
const ProcessingColor = '#42A5F5';
const ActiveColor = '#29B6F6';
const OverdueColor = '#D32F2F';
const ShippedColor = '#66BB6A';
const DeliveredColor = '#78909C';
const UnknownColor = '#BDBDBD';
const PlanAmountColor = '#0056b3';
const CURRENCY_SYMBOL = 'PKR';
const BNPL_TYPE = 'BNPL';
const FIXED_TYPE = 'Fixed Duration';
const COD_TYPE = 'COD';
const MIXED_TYPE = 'Mixed';
const INSTALLMENT_LABEL = 'Installment';
const PAID_STATUS = 'Paid';
const PENDING_STATUS = 'Pending';
const PARTIALLY_PAID_STATUS = 'Partially Paid';

// --- Helper Functions ---
const formatShortDate = (timestamp) => {
    let dateToFormat = null;
    if (timestamp && typeof timestamp.toDate === 'function') { try { dateToFormat = timestamp.toDate(); } catch (e) {console.warn("TS Date conversion error", e)} }
    else if (timestamp instanceof Date) { dateToFormat = timestamp; }
    if (dateToFormat && isValid(dateToFormat)) { try { return format(dateToFormat, 'MMM d, yyyy'); } catch (e) { return 'Invalid Date'; } }
    return 'N/A';
};

const formatDateAndTime = (timestamp) => {
    let dateToFormat = null;
    if (timestamp && typeof timestamp.toDate === 'function') { try { dateToFormat = timestamp.toDate(); } catch (e) {console.warn("TS DateTime conversion error", e)} }
    else if (timestamp instanceof Date) { dateToFormat = timestamp; }
    if (dateToFormat && isValid(dateToFormat)) { try { return format(dateToFormat, 'MMM d, yyyy, h:mm a'); } catch (e) { return 'Invalid Date'; } }
    return 'N/A';
};

const getOverallStatusStyle = (status) => {
    const lowerStatus = status?.toLowerCase() || 'unknown';
    switch (lowerStatus) {
        case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': case 'unpaid (bnpl)': return styles.statusPending;
        case 'processing': return styles.statusProcessing;
        case PARTIALLY_PAID_STATUS.toLowerCase(): return styles.statusPartiallyPaid;
        case 'shipped': return styles.statusShipped;
        case 'active': return styles.statusActive;
        case 'delivered': return styles.statusDelivered;
        case 'cancelled': case 'rejected': return styles.statusCancelled;
        case 'paid': return styles.statusPaidOverall;
        default: return styles.statusUnknown;
    }
};

const getInstallmentStatusStyle = (status) => {
    return (status?.toLowerCase() === PAID_STATUS.toLowerCase()) ? styles.statusPaidInstallment : styles.statusPendingInstallment;
};
// --- End Helper Functions ---


// --- Main Component ---
export default function UserSchedulesProgressDetails() {
    const route = useRoute();
    const navigation = useNavigation();
    const order = route.params?.order;

    // --- Render Fallback ---
    if (!order || !order.id) {
        return (
            <SafeAreaView style={styles.centeredContainer}>
                <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
                <MaterialIcons name="error-outline" size={60} color={AccentColor} />
                <Text style={styles.errorText}>Order details are missing or invalid.</Text>
                {navigation.canGoBack() && (
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </TouchableOpacity>
                )}
            </SafeAreaView>
        );
    }

    // --- Determine Payment Method and Components ---
    const paymentMethod = order.paymentMethod || 'Unknown';
    const isPureInstallment = paymentMethod === BNPL_TYPE;
    const isPureFixed = paymentMethod === FIXED_TYPE;
    const isMixed = paymentMethod === MIXED_TYPE;
    const hasCodComponent = typeof order.codAmount === 'number' && order.codAmount > 0;
    const hasInstallmentComponent = Array.isArray(order.installments) && order.installments.length > 0;
    const hasFixedDurationComponent = !!order.paymentDueDate || !!order.fixedDurationAmountDue || !!order.fixedDurationDetails;
    const showCodSection = (isMixed && hasCodComponent);
    const showInstallmentSection = isPureInstallment || (isMixed && hasInstallmentComponent);
    const showFixedDurationSection = isPureFixed || (isMixed && hasFixedDurationComponent);
    let displayPaymentLabel = paymentMethod;
    if (isPureInstallment) displayPaymentLabel = INSTALLMENT_LABEL;
    const displayId = order.orderNumber ? `#${order.orderNumber}` : `#${order.id.substring(0, 6).toUpperCase()}`;
    const orderStatus = order.status || 'Unknown';
    const paymentStatus = order.paymentStatus || 'N/A';
    const relevantPlanDetails = order.bnplPlanDetails || order.fixedDurationDetails;

    // --- Render Function for Installment Item ---
    const renderInstallmentItem = ({ item, index }) => {
        if (!item || typeof item.amount !== 'number') return null;
        const installmentStatus = item.status || PENDING_STATUS;
        const isPaid = installmentStatus.toLowerCase() === PAID_STATUS.toLowerCase();
        return (
            <View style={styles.installmentRow}>
                 <View style={styles.installmentLeft}>
                    <Text style={styles.installmentNumber}>Inst. #{item.installmentNumber || index + 1}</Text>
                    <Text style={styles.installmentAmount}>{CURRENCY_SYMBOL} {item.amount?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 'N/A'}</Text>
                    {typeof item.penalty === 'number' && item.penalty > 0 && (<Text style={styles.penaltyText}>Penalty: {CURRENCY_SYMBOL}{item.penalty.toFixed(0)}</Text>)}
                 </View>
                 <View style={styles.installmentRight}>
                     <View style={[styles.statusBadgeSmall, getInstallmentStatusStyle(installmentStatus)]}><Text style={styles.statusTextSmall}>{installmentStatus}</Text></View>
                     <Text style={styles.installmentDueDate}>Due: {formatShortDate(item.dueDate)}</Text>
                     {isPaid && item.paidAt && (<Text style={styles.paidAtText}>Paid: {formatShortDate(item.paidAt)}</Text>)}
                 </View>
            </View>
        );
    };

    // --- Main Render ---
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
            <ScrollView contentContainerStyle={styles.scrollContainer}>

                {/* Section 1: Basic Order Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Order Summary</Text>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Order ID:</Text><Text style={styles.detailValue}>{displayId}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Order Date:</Text><Text style={styles.detailValue}>{formatDateAndTime(order.createdAt || order.orderDate)}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Order Status:</Text><View style={[styles.statusBadge, getOverallStatusStyle(orderStatus)]}><Text style={styles.statusText}>{orderStatus}</Text></View></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Payment Status:</Text><View style={[styles.statusBadge, getOverallStatusStyle(paymentStatus)]}><Text style={styles.statusText}>{paymentStatus}</Text></View></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Payment Method:</Text><Text style={styles.detailValue}>{displayPaymentLabel}</Text></View>
                    <View style={styles.detailRow}><Text style={styles.detailLabel}>Grand Total:</Text><Text style={[styles.detailValue, styles.totalValueHighlight]}>{CURRENCY_SYMBOL} {(order.grandTotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>
                </View>

                {/* Section 2: Customer Info */}
                <View style={styles.section}>
                     <Text style={styles.sectionTitle}>Customer Information</Text>
                     <View style={styles.detailRow}><Text style={styles.detailLabel}>Name:</Text><Text style={styles.detailValue}>{order.userName || 'N/A'}</Text></View>
                     <View style={styles.detailRow}><Text style={styles.detailLabel}>Phone:</Text><Text style={styles.detailValue}>{order.userPhone || 'N/A'}</Text></View>
                     {/* Address Row - Corrected Alignment */}
                      <View style={styles.addressDetailRow}>
                         <Text style={styles.detailLabel}>Address:</Text>
                         <Text style={styles.addressValue}>{order.userAddress || 'N/A'}</Text>
                     </View>
                </View>

                {/* Section 3: Payment Details */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment Breakdown</Text>
                    {/* --- COD Component --- */}
                    {showCodSection && (
                         <View style={styles.paymentSubSection}>
                            <Text style={styles.paymentSubHeader}>Cash on Delivery Portion</Text>
                            <View style={styles.detailRow}><Text style={styles.detailLabel}>Amount Due (COD):</Text><Text style={styles.codAmountValue}>{CURRENCY_SYMBOL} {(order.codAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>
                            {order.codPaymentReceivedAt && (<View style={styles.detailRow}><Text style={styles.detailLabel}>COD Paid At:</Text><Text style={styles.detailValue}>{formatDateAndTime(order.codPaymentReceivedAt)}</Text></View>)}
                        </View>
                    )}
                    {/* --- Installment Component --- */}
                    {showInstallmentSection && (
                        <View style={[styles.paymentSubSection, showCodSection && styles.subSectionSpacing]}>
                            <Text style={styles.paymentSubHeader}>Installment Plan Details</Text>
                            <View style={styles.detailRow}><Text style={styles.detailLabel}>Plan Amount (Installments):</Text><Text style={styles.planAmountHighlight}>{CURRENCY_SYMBOL} {(order.bnplAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>
                            {relevantPlanDetails && (isPureInstallment || hasInstallmentComponent) && ( <View style={styles.planDetailsBox}><Text style={styles.planDetailText}>Plan: {relevantPlanDetails.name || 'N/A'}</Text><Text style={styles.planDetailText}>Duration: {relevantPlanDetails.duration || 'N/A'} Months</Text></View> )}
                            {hasInstallmentComponent ? (
                                <FlatList data={order.installments || []} renderItem={renderInstallmentItem} keyExtractor={(item, index) => item?.installmentNumber ? `inst-${item.installmentNumber}-${index}` : `inst-${index}`} scrollEnabled={false} ListEmptyComponent={<Text style={styles.emptyListText}>Installment details missing.</Text>} ItemSeparatorComponent={() => <View style={styles.installmentSeparator} />} style={styles.installmentListStyle} />
                            ) : ( <Text style={styles.emptyListText}>No installment schedule found.</Text> )}
                        </View>
                    )}
                    {/* --- Fixed Duration Component --- */}
                    {showFixedDurationSection && (
                        <View style={[styles.paymentSubSection, (showCodSection || showInstallmentSection) && styles.subSectionSpacing]}>
                            <Text style={styles.paymentSubHeader}>Fixed Duration Payment Details</Text>
                            <View style={styles.detailRow}><Text style={styles.detailLabel}>Amount Due (Fixed):</Text><Text style={styles.planAmountHighlight}>{CURRENCY_SYMBOL} {(order.fixedDurationAmountDue ?? order.bnplAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>
                            <View style={styles.detailRow}><Text style={styles.detailLabel}>Due Date:</Text><Text style={[styles.detailValue, styles.dueDateHighlight]}>{formatShortDate(order.paymentDueDate)}</Text></View>
                            {typeof order.penalty === 'number' && order.penalty > 0 && (<View style={styles.detailRow}><Text style={[styles.detailLabel, styles.penaltyLabel]}>Penalty:</Text><Text style={[styles.detailValue, styles.penaltyValue]}>{CURRENCY_SYMBOL}{order.penalty.toFixed(0)}</Text></View>)}
                             {relevantPlanDetails && (isPureFixed || hasFixedDurationComponent) && ( <View style={styles.planDetailsBox}><Text style={styles.planDetailText}>Plan: {relevantPlanDetails.name || 'Fixed Plan'}</Text></View> )}
                            {order.paymentStatus?.toLowerCase() === PAID_STATUS.toLowerCase() && order.paymentReceivedAt && (<View style={styles.detailRow}><Text style={styles.detailLabel}>Paid At:</Text><Text style={styles.detailValue}>{formatDateAndTime(order.paymentReceivedAt)}</Text></View>)}
                        </View>
                    )}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: ScreenBackgroundColor },
    scrollContainer: { flexGrow: 1, padding: 15, paddingBottom: 30 },
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    errorText: { color: AccentColor, fontSize: 16, textAlign: 'center', marginBottom: 20 },
    backButton: { backgroundColor: AccentColor, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6 },
    backButtonText: { color: '#fff', fontWeight: 'bold' },
    section: { backgroundColor: AppBackgroundColor, borderRadius: 8, padding: 15, marginBottom: 15, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1.5, borderWidth: Platform.OS === 'android' ? 0 : 1, borderColor: '#E0E0E0' },
    sectionTitle: { fontSize: 17, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingVertical: 2 },
    // Specific style for address row to handle wrapping
    addressDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start', // Align items to the top for multi-line text
        marginBottom: 10,
        paddingVertical: 2,
    },
    detailLabel: { fontSize: 14, color: TextColorSecondary, marginRight: 10, flexShrink: 0 }, // Prevent label from shrinking
    detailValue: { fontSize: 14, fontWeight: '500', color: TextColorPrimary, textAlign: 'right', flexShrink: 1 },
    // Address value specific style
    addressValue: {
        fontSize: 14,
        fontWeight: '500',
        color: TextColorPrimary,
        textAlign: 'left', // Align address text to the left
        flex: 1, // Allow it to take remaining space
        marginLeft: 5, // Add some space from the label
    },
    totalValueHighlight: { color: AccentColor, fontWeight: 'bold', fontSize: 15 },
    planAmountHighlight: { color: PlanAmountColor, fontWeight: 'bold' },
    dueDateHighlight: { fontWeight: 'bold', color: AccentColor },
    statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, alignSelf: 'flex-end' }, // Align badge to right within its row space
    statusText: { fontSize: 12, fontWeight: 'bold', color: '#fff' },
    paymentSubSection: { paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
    subSectionSpacing: { marginTop: 20 },
    paymentSubHeader: { fontSize: 16, fontWeight: '600', color: TextColorPrimary, marginBottom: 12 },
    codAmountValue: { fontSize: 14, fontWeight: 'bold', color: TextColorPrimary },
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
    // Status Badge Colors
    statusPending: { backgroundColor: PendingColor },
    statusProcessing: { backgroundColor: ProcessingColor },
    statusPartiallyPaid: { backgroundColor: ProcessingColor }, // Use Processing color
    statusShipped: { backgroundColor: ShippedColor },
    statusDelivered: { backgroundColor: DeliveredColor },
    statusActive: { backgroundColor: ActiveColor },
    statusCancelled: { backgroundColor: OverdueColor },
    statusPaidOverall: { backgroundColor: SuccessColor },
    statusUnknown: { backgroundColor: UnknownColor },
});