// UserSchedulesProgressDetails.js
// Displays details and schedule progress for BNPL/Fixed Duration orders

import React from 'react';
import {
    StyleSheet, Text, View, SafeAreaView, ScrollView, FlatList,
    ActivityIndicator, TouchableOpacity, StatusBar, Image,Platform
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons'; // Optional: For icons
import { Timestamp } from 'firebase/firestore'; // Only needed if you re-fetch or manipulate timestamps significantly
import { format, isValid } from 'date-fns';

// --- Constants (Adapt from previous screens) ---
const AppBackgroundColor = '#FFFFFF';
const ScreenBackgroundColor = '#F8F9FA';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const AccentColor = '#FF0000'; // Or your theme color
const SuccessColor = '#4CAF50'; // For 'Paid' status
const PendingColor = '#FFA726'; // For 'Pending' installment status
const CURRENCY_SYMBOL = 'PKR';
const BNPL_TYPE = 'BNPL';
const FIXED_TYPE = 'Fixed Duration';
const INSTALLMENT_LABEL = 'Installment';
const PAID_STATUS = 'Paid';
const PENDING_STATUS = 'Pending';

// --- Helper Functions (Copied/Adapted for consistency) ---
const formatShortDate = (timestamp) => {
    let dateToFormat = null;
    // Handle Timestamps passed directly or nested within the order object
    if (timestamp && typeof timestamp.toDate === 'function') {
        try { dateToFormat = timestamp.toDate(); } catch (e) {}
    } else if (timestamp instanceof Date) { // Handle JS Dates
        dateToFormat = timestamp;
    }
    if (dateToFormat && isValid(dateToFormat)) {
        try { return format(dateToFormat, 'MMM d, yyyy'); }
        catch (e) { return 'Invalid Date'; }
    }
    return 'N/A'; // More specific than 'Pending Date' here
};

const formatDateAndTime = (timestamp) => {
    let dateToFormat = null;
     if (timestamp && typeof timestamp.toDate === 'function') {
        try { dateToFormat = timestamp.toDate(); } catch (e) {}
    } else if (timestamp instanceof Date) {
        dateToFormat = timestamp;
    }
    if (dateToFormat && isValid(dateToFormat)) {
        try { return format(dateToFormat, 'MMM d, yyyy, h:mm a'); }
        catch (e) { return 'Invalid Date'; }
    }
    return 'N/A';
};

// Consistent Status Badge Styles
const getOverallStatusStyle = (status) => { /* ... copy from AdminSideUserSchedulesProgress ... */
    const lowerStatus = status?.toLowerCase() || 'unknown';
    switch (lowerStatus) {
        case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': case 'unpaid (bnpl)': return styles.statusPending;
        case 'processing': case 'partially paid': return styles.statusProcessing;
        case 'shipped': return styles.statusShipped;
        case 'delivered': return styles.statusDelivered;
        case 'active': return styles.statusActive;
        case 'cancelled': case 'rejected': return styles.statusCancelled;
        case 'paid': return styles.statusPaidOverall; // Use distinct paid color if needed
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
    const navigation = useNavigation(); // In case you add actions later
    const order = route.params?.order; // Get the full order object

    // --- Render Fallback if order data is missing ---
    if (!order || !order.id) {
        return (
            <SafeAreaView style={styles.centeredContainer}>
                <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
                <Text style={styles.errorText}>Order details not found.</Text>
                {/* Optional: Add a button to go back */}
                 <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                     <Text style={styles.backButtonText}>Go Back</Text>
                 </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // Determine Payment Type and Display Label
    const paymentMethod = order.paymentMethod || 'Unknown';
    const isInstallmentPlan = paymentMethod === BNPL_TYPE;
    const isFixedDurationPlan = paymentMethod === FIXED_TYPE;
    const displayPaymentLabel = isInstallmentPlan ? INSTALLMENT_LABEL : paymentMethod;

    // Derived values for display
    const displayId = order.orderNumber ? `#${order.orderNumber}` : `#${order.id.substring(0, 6).toUpperCase()}`;
    const orderStatus = order.status || 'Unknown';
    const paymentStatus = order.paymentStatus || 'N/A';

    // --- Render Function for Installment Item ---
    const renderInstallmentItem = ({ item, index }) => {
        if (!item || typeof item.amount !== 'number') return null;
        const installmentStatus = item.status || PENDING_STATUS;
        const isPaid = installmentStatus.toLowerCase() === PAID_STATUS.toLowerCase();

        return (
            <View style={styles.installmentRow}>
                 <View style={styles.installmentLeft}>
                    <Text style={styles.installmentNumber}>Inst. #{item.installmentNumber || index + 1}</Text>
                     <Text style={styles.installmentAmount}>
                         {CURRENCY_SYMBOL} {item.amount?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 'N/A'}
                     </Text>
                      {typeof item.penalty === 'number' && item.penalty > 0 && (
                         <Text style={styles.penaltyText}>Penalty: {CURRENCY_SYMBOL}{item.penalty.toFixed(0)}</Text>
                      )}
                 </View>
                 <View style={styles.installmentRight}>
                     <View style={[styles.statusBadgeSmall, getInstallmentStatusStyle(installmentStatus)]}>
                         <Text style={styles.statusTextSmall}>{installmentStatus}</Text>
                     </View>
                     <Text style={styles.installmentDueDate}>Due: {formatShortDate(item.dueDate)}</Text>
                     {isPaid && item.paidAt && (
                         <Text style={styles.paidAtText}>Paid: {formatShortDate(item.paidAt)}</Text>
                     )}
                 </View>
            </View>
        );
    };


    // --- Main Render ---
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
            {/* Consider adding a custom header component here if needed */}

            <ScrollView contentContainerStyle={styles.scrollContainer}>

                {/* Section 1: Basic Order Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Order Summary</Text>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Order ID:</Text>
                        <Text style={styles.detailValue}>{displayId}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Order Date:</Text>
                        <Text style={styles.detailValue}>{formatDateAndTime(order.createdAt || order.orderDate)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Order Status:</Text>
                        <View style={[styles.statusBadge, getOverallStatusStyle(orderStatus)]}>
                            <Text style={styles.statusText}>{orderStatus}</Text>
                        </View>
                    </View>
                     <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Payment Status:</Text>
                         {/* Use overall status style for payment status too, or create specific ones */}
                        <View style={[styles.statusBadge, getOverallStatusStyle(paymentStatus)]}>
                            <Text style={styles.statusText}>{paymentStatus}</Text>
                        </View>
                    </View>
                     <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Payment Method:</Text>
                        <Text style={styles.detailValue}>{displayPaymentLabel}</Text>
                    </View>
                     <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Grand Total:</Text>
                        <Text style={[styles.detailValue, styles.totalValueHighlight]}>
                             {CURRENCY_SYMBOL} {(order.grandTotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                         </Text>
                    </View>
                </View>

                {/* Section 2: Customer Info */}
                <View style={styles.section}>
                     <Text style={styles.sectionTitle}>Customer Information</Text>
                     <View style={styles.detailRow}>
                         <Text style={styles.detailLabel}>Name:</Text>
                         <Text style={styles.detailValue}>{order.userName || 'N/A'}</Text>
                     </View>
                     <View style={styles.detailRow}>
                         <Text style={styles.detailLabel}>Phone:</Text>
                         <Text style={styles.detailValue}>{order.userPhone || 'N/A'}</Text>
                     </View>
                      {/* Optional: Address
                      <View style={[styles.detailRow, styles.addressRow]}>
                         <Text style={styles.detailLabel}>Address:</Text>
                         <Text style={[styles.detailValue, styles.addressValue]}>{order.userAddress || 'N/A'}</Text>
                     </View> */}
                </View>


                {/* Section 3: Payment Schedule Details (Conditional) */}
                {isInstallmentPlan && (
                    <View style={styles.section}>
                         <Text style={styles.sectionTitle}>Installment Schedule</Text>
                         <View style={styles.detailRow}>
                             <Text style={styles.detailLabel}>Total Plan Amount:</Text>
                             <Text style={[styles.detailValue, styles.planAmountHighlight]}>
                                 {CURRENCY_SYMBOL} {(order.bnplAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </Text>
                        </View>
                         {/* Add plan details like name/duration if available */}
                         {order.bnplPlanDetails && (
                            <View style={styles.planDetailsBox}>
                                <Text style={styles.planDetailText}>Plan: {order.bnplPlanDetails.name || 'N/A'}</Text>
                                <Text style={styles.planDetailText}>Duration: {order.bnplPlanDetails.duration || 'N/A'} Months</Text>
                                {/* Add other details like interest rate */}
                            </View>
                         )}

                        <FlatList
                            data={order.installments || []}
                            renderItem={renderInstallmentItem}
                            keyExtractor={(item, index) => item?.installmentNumber ? `inst-${item.installmentNumber}-${index}` : `inst-${index}`}
                            scrollEnabled={false} // Important inside ScrollView
                            ListEmptyComponent={<Text style={styles.emptyListText}>No installment details found.</Text>}
                            ItemSeparatorComponent={() => <View style={styles.installmentSeparator} />}
                        />
                    </View>
                )}

                {isFixedDurationPlan && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Fixed Duration Payment Details</Text>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Amount Due:</Text>
                            <Text style={[styles.detailValue, styles.planAmountHighlight]}>
                                 {CURRENCY_SYMBOL} {(order.fixedDurationAmountDue ?? order.bnplAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </Text>
                        </View>
                         <View style={styles.detailRow}>
                             <Text style={styles.detailLabel}>Due Date:</Text>
                             <Text style={[styles.detailValue, styles.dueDateHighlight]}>{formatShortDate(order.paymentDueDate)}</Text>
                         </View>
                         {typeof order.penalty === 'number' && order.penalty > 0 && (
                             <View style={styles.detailRow}>
                                 <Text style={[styles.detailLabel, styles.penaltyLabel]}>Penalty Applied:</Text>
                                 <Text style={[styles.detailValue, styles.penaltyValue]}>
                                     {CURRENCY_SYMBOL}{order.penalty.toFixed(0)}
                                 </Text>
                             </View>
                         )}
                         {/* Add plan details if available */}
                         {order.fixedDurationDetails && (
                            <View style={styles.planDetailsBox}>
                                <Text style={styles.planDetailText}>Plan: {order.fixedDurationDetails.name || 'Fixed Plan'}</Text>
                                {/* Add other details */}
                            </View>
                         )}
                          {/* Add payment received date if paid */}
                          {order.paymentStatus?.toLowerCase() === PAID_STATUS.toLowerCase() && order.paymentReceivedAt && (
                             <View style={styles.detailRow}>
                                 <Text style={styles.detailLabel}>Paid At:</Text>
                                 <Text style={styles.detailValue}>{formatDateAndTime(order.paymentReceivedAt)}</Text>
                             </View>
                         )}
                    </View>
                )}

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
    section: {
        backgroundColor: AppBackgroundColor,
        borderRadius: 8,
        padding: 15,
        marginBottom: 15,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1.5,
        borderWidth: Platform.OS === 'android' ? 0 : 1, // Consider Platform.OS specific border
        borderColor: '#E0E0E0',
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: TextColorPrimary,
        marginBottom: 15, // Increased spacing
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 10, // Increased spacing
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10, // Consistent spacing
        paddingVertical: 2, // Slight vertical padding
    },
    addressRow: { alignItems: 'flex-start' }, // Allow address to wrap
    detailLabel: {
        fontSize: 14,
        color: TextColorSecondary,
        marginRight: 10,
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '500',
        color: TextColorPrimary,
        textAlign: 'right',
        flexShrink: 1, // Allow text to shrink/wrap if needed
    },
    addressValue: { textAlign: 'left', marginLeft: 'auto', flexBasis: '70%' },
    totalValueHighlight: { color: AccentColor, fontWeight: 'bold', fontSize: 15 },
    planAmountHighlight: { color: '#0056b3', fontWeight: 'bold' }, // Blue for plan amounts
    dueDateHighlight: { fontWeight: 'bold', color: AccentColor },
    statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
    statusText: { fontSize: 12, fontWeight: 'bold', color: '#fff' },
    emptyListText: { textAlign: 'center', color: TextColorSecondary, paddingVertical: 15 },
    planDetailsBox: {
        marginTop: 5, marginBottom: 15, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 6, borderWidth: 1, borderColor: '#eee'
    },
    planDetailText: { fontSize: 13, color: TextColorSecondary, marginBottom: 4, lineHeight: 18 },

    // --- Installment Styles ---
    installmentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        alignItems: 'center',
    },
    installmentSeparator: { height: 1, backgroundColor: '#f0f0f0' },
    installmentLeft: {
        flex: 1, // Allow shrinking/growing
        marginRight: 10,
    },
    installmentRight: {
        alignItems: 'flex-end',
        minWidth: 90, // Ensure space for badge/dates
    },
    installmentNumber: { fontSize: 14, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 4 },
    installmentAmount: { fontSize: 14, color: TextColorSecondary, marginBottom: 4 },
    installmentDueDate: { fontSize: 12, color: TextColorSecondary, marginTop: 4 },
    paidAtText: { fontSize: 11, color: TextColorSecondary, fontStyle: 'italic', marginTop: 3 },
    penaltyText: { fontSize: 12, color: AccentColor, marginTop: 2, fontWeight: '500' },
    statusBadgeSmall: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, marginBottom: 3 },
    statusTextSmall: { fontSize: 11, fontWeight: 'bold', color: '#fff' },
    statusPaidInstallment: { backgroundColor: SuccessColor },
    statusPendingInstallment: { backgroundColor: PendingColor },

     // --- Fixed Duration Styles ---
     penaltyLabel: { color: AccentColor },
     penaltyValue: { color: AccentColor, fontWeight: 'bold' },

    // --- Shared Status Badge Colors --- (Use distinct overall paid if desired)
    statusPending: { backgroundColor: '#FFA726' },
    statusProcessing: { backgroundColor: '#42A5F5' },
    statusShipped: { backgroundColor: '#66BB6A' },
    statusDelivered: { backgroundColor: '#78909C' },
    statusActive: { backgroundColor: '#29B6F6' },
    statusCancelled: { backgroundColor: '#EF5350' },
    statusPaidOverall: { backgroundColor: '#1E88E5' }, // Example: Darker blue for overall paid
    statusUnknown: { backgroundColor: '#BDBDBD' },
});