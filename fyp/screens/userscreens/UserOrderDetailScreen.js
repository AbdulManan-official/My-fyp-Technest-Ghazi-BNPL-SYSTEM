// UserOrderDetailScreen.js (COMPLETE CODE - Added Fixed Duration Amount Display)

import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Image,
  TouchableOpacity, SafeAreaView, Platform, ActivityIndicator, FlatList,
  Alert, StatusBar
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons as Icon } from '@expo/vector-icons'; // Using MaterialIcons
import { getFirestore, doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Verify path
import { format, isValid } from 'date-fns';

// --- Constants ---
const AppBackgroundColor = '#FFFFFF';
const ScreenBackgroundColor = '#F8F9FA';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const AccentColor = '#FF0000';
const SuccessColor = '#4CAF50'; // For OTP display emphasis & Paid status
const ActiveStatusColor = '#29B6F6'; // Light blue for Active status
const PendingStatusColor = '#FFA726'; // Orange for Pending status
const LightBorderColor = '#E5E7EB';
const PlaceholderBgColor = '#F0F0F0';
const CURRENCY_SYMBOL = 'PKR';
const placeholderImagePath = require('../../assets/p3.jpg'); // Verify path
const ORDERS_COLLECTION = 'orders';
const SHIPPED_STATUS = 'Shipped';
const ACTIVE_STATUS = 'Active';
const PAID_STATUS = 'Paid';
const PENDING_STATUS = 'Pending';
const PARTIALLY_PAID_STATUS = 'Partially Paid'; // Added for Mixed Orders display

// --- Helper: Format Date (Full Timestamp) ---
const formatDate = (timestamp) => {
    let dateToFormat = null;
    if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); }
    else if (timestamp instanceof Date) { dateToFormat = timestamp; }
    if (dateToFormat && isValid(dateToFormat)) {
        try { return format(dateToFormat, 'MMM d, yyyy, h:mm a'); }
        catch (e) { console.error("[formatDate] Error formatting:", e); return 'Invalid Date'; }
    } return 'N/A';
};

// --- Helper: Format Date (Short for Due Dates/Paid Dates) ---
const formatShortDate = (timestamp) => {
     let dateToFormat = null;
     if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); }
     else if (timestamp instanceof Date) { dateToFormat = timestamp; }
     if (dateToFormat && isValid(dateToFormat)) {
         try { return format(dateToFormat, 'MMM d, yyyy'); }
        catch (e) { console.error("[formatShortDate] Error formatting:", e); return 'Invalid Date'; }
     } return 'N/A';
};

// --- Helper: Get Overall Order/Payment Status Style ---
const getStatusStyle = (status) => {
     const lowerStatus = status?.toLowerCase() || 'unknown';
     switch (lowerStatus) {
          case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': case 'unpaid (bnpl)': return styles.statusPending;
          case 'processing': case PARTIALLY_PAID_STATUS.toLowerCase(): return styles.statusProcessing; // Include Partially Paid
          case 'shipped': return styles.statusShipped;
          case 'active': return styles.statusActive;
          case 'delivered': return styles.statusDelivered;
          case 'cancelled': case 'rejected': return styles.statusCancelled;
          default: return styles.statusUnknown;
      }
};

// --- Helper: Get Installment Status Style ---
const getInstallmentStatusStyle = (status) => {
    return (status?.toLowerCase() === PAID_STATUS.toLowerCase()) ? styles.statusPaid : styles.statusInstallmentPending;
};


// --- Main Component (Single Default Export) ---
export default function UserOrderDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation(); // Still keep navigation for potential Go Back in error state
  const initialOrder = route.params?.order;
  const orderId = initialOrder?.id;

  // --- State ---
  const [currentOrderData, setCurrentOrderData] = useState(initialOrder);
  const [loading, setLoading] = useState(!initialOrder);
  const [error, setError] = useState(null);

  // --- Effect: Real-time Listener for Order Details ---
  useEffect(() => {
    if (!orderId) {
      console.error("[UserOrderDetailScreen] No Order ID found.");
      setError("Order details could not be loaded (No ID).");
      setLoading(false);
      setCurrentOrderData(null);
      return;
    }
    setError(null);
    console.log(`[UserOrderDetailScreen] Setting up listener for order: ${orderId}`);
    const orderRef = doc(db, ORDERS_COLLECTION, orderId);
    const unsubscribe = onSnapshot(orderRef, (docSnap) => {
      if (docSnap.exists()) {
        setCurrentOrderData({ id: docSnap.id, ...docSnap.data() });
        setError(null);
      } else {
        console.warn(`[UserOrderDetailScreen] Order ${orderId} not found.`);
        setError("Order not found. It might have been deleted.");
        setCurrentOrderData(null);
      }
      setLoading(false);
    }, (err) => {
      console.error(`[UserOrderDetailScreen] Listener error for order ${orderId}:`, err);
      setError("Failed to load real-time order details.");
      setLoading(false);
    });
    return () => {
      unsubscribe();
    };
  }, [orderId]);

  // --- Render Individual Item ---
  const renderOrderItem = ({ item, index }) => {
     if (!item || typeof item.price !== 'number' || typeof item.quantity !== 'number') { return null; }
     const itemsArray = currentOrderData?.items || [];
     const itemTotal = (item.price || 0) * (item.quantity || 1);
     const paymentMethod = item.paymentMethod || 'COD';
     let paymentDisplay = paymentMethod;
     if (paymentMethod === 'BNPL' && item.bnplPlan) { paymentDisplay = item.bnplPlan.name || 'BNPL Plan'; }
     else if (paymentMethod === 'Fixed Duration') { paymentDisplay = item.bnplPlan?.name || 'Fixed Duration'; }
     return (
          <View style={[styles.itemContainer, index === itemsArray.length - 1 && styles.lastItemContainer]}>
              <Image source={item.image ? { uri: item.image } : placeholderImagePath} style={styles.itemImage} defaultSource={placeholderImagePath} />
              <View style={styles.itemDetails}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name || 'N/A'}</Text>
                  <Text style={styles.itemQtyPrice}>Qty: {item.quantity || 1}</Text>
                  <Text style={styles.itemPrice}>{CURRENCY_SYMBOL} {(item.price || 0).toLocaleString(undefined, {maximumFractionDigits:0})}</Text>
                  <Text style={styles.itemPaymentMethod}>Method: {paymentDisplay}</Text>
              </View>
             <Text style={styles.itemTotalValue}>{CURRENCY_SYMBOL} {itemTotal.toLocaleString(undefined, {maximumFractionDigits:0})}</Text>
          </View>
       );
  };


   // --- Render Individual BNPL Installment ---
   const renderInstallment = ({ item }) => {
       if (!item || typeof item.amount !== 'number') return null;
       const installmentStatus = item.status || PENDING_STATUS;
       const isPaid = installmentStatus.toLowerCase() === PAID_STATUS.toLowerCase();
       const paidDate = item.paidAt;

      return (
        <View style={styles.installmentRow}>
            <Text style={styles.installmentText}>Inst. #{item.installmentNumber || 'N/A'}</Text>
            <Text style={styles.installmentText}>{CURRENCY_SYMBOL} {item.amount?.toLocaleString(undefined, {maximumFractionDigits:0}) || 'N/A'}</Text>
            <Text style={styles.installmentText}>Due: {formatShortDate(item.dueDate)}</Text>
            <View style={[styles.statusBadgeSmall, getInstallmentStatusStyle(installmentStatus)]}>
               <Text style={styles.statusTextSmall}>{installmentStatus}</Text>
            </View>
            {isPaid && paidDate && isValid(paidDate.toDate ? paidDate.toDate() : paidDate) && (
                 <Text style={styles.paidAtText}>Paid: {formatShortDate(paidDate)}</Text>
            )}
            {typeof item.penalty === 'number' && item.penalty > 0 && (<Text style={styles.penaltyText}>Penalty: {CURRENCY_SYMBOL}{item.penalty.toFixed(2)}</Text>)}
        </View>
       );
   };


  // --- Render Logic ---
  if (loading) {
      return (
          <SafeAreaView style={styles.container}>
              <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
              <View style={styles.loadingContainer}>
                 <ActivityIndicator size="large" color={AccentColor} />
                 <Text style={{marginTop: 10, color: TextColorSecondary}}>Loading Order Details...</Text>
              </View>
          </SafeAreaView>
      );
  }

  if (error || !currentOrderData) {
     return (
      <SafeAreaView style={styles.container}>
         <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
         {/* Stack Navigator provides header */}
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error || "Order details could not be loaded."}</Text>
          {navigation.canGoBack() && (
             <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.errorLink}>Go Back</Text>
             </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // --- Determine derived values ---
  const paymentMethod = currentOrderData.paymentMethod || 'Unknown';
  const relevantPlanDetails = currentOrderData.bnplPlanDetails || currentOrderData.fixedDurationDetails;
  const isRelevantPlanInstallment = relevantPlanDetails?.planType === 'Installment' || paymentMethod === 'BNPL';
  const isRelevantPlanFixed = relevantPlanDetails?.planType === 'Fixed Duration' || paymentMethod === 'Fixed Duration';
  const showCodSection = (paymentMethod === 'COD' || paymentMethod === 'Mixed') && typeof currentOrderData.codAmount === 'number' && currentOrderData.codAmount > 0;
  const showInstallmentSection = (paymentMethod === 'BNPL' || paymentMethod === 'Mixed') && isRelevantPlanInstallment;
  const showFixedDurationSection = (paymentMethod === 'Fixed Duration') || (paymentMethod === 'Mixed' && (!!currentOrderData?.paymentDueDate || !!currentOrderData?.fixedDurationDetails));


  // --- Main Render when data is loaded ---
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
      {/* Stack Navigator provides header */}
      <ScrollView contentContainerStyle={styles.scrollContainer}>

        {/* Items Ordered Section */}
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
                    <Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {(currentOrderData.subtotal || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</Text>
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
                    <Text style={[styles.summaryValue, styles.grandTotalValue]}>{CURRENCY_SYMBOL} {(currentOrderData.grandTotal || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</Text>
                </View>
            </View>
        </View>


        {/* Order Summary Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Order ID:</Text>
            <Text style={styles.summaryValue}>#{currentOrderData.id?.substring(0,8).toUpperCase() || 'N/A'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Order Date:</Text>
            <Text style={styles.summaryValue}>{formatDate(currentOrderData.createdAt || currentOrderData.orderDate)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Status:</Text>
            <View style={[styles.statusBadge, getStatusStyle(currentOrderData.status)]}>
                 <Text style={styles.statusText}>{currentOrderData.status || 'Unknown'}</Text>
             </View>
          </View>

          {/* Display Delivery OTP only when shipped */}
          {currentOrderData.status === SHIPPED_STATUS && currentOrderData.deliveryOtp && (
            <View style={styles.otpDisplayRow}>
                <Icon name="vpn-key" size={16} color={SuccessColor} style={{ marginRight: 6 }}/>
                <Text style={styles.otpDisplayLabel}>Delivery OTP:</Text>
                <Text style={styles.otpDisplayValue}>{currentOrderData.deliveryOtp}</Text>
            </View>
          )}
        </View>

        {/* Delivery Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <Text style={styles.detailText}>{currentOrderData.userName || 'N/A'}</Text>
          <Text style={styles.detailText}>{currentOrderData.userAddress || 'N/A'}</Text>
          <Text style={styles.detailText}>{currentOrderData.userPhone || 'N/A'}</Text>
        </View>

        {/* Payment Information */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Details</Text>
            <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Method:</Text>
                <Text style={styles.summaryValue}>{paymentMethod}</Text>
            </View>
             <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Payment Status:</Text>
                <View style={[styles.statusBadge, getStatusStyle(currentOrderData.paymentStatus)]}><Text style={styles.statusText}>{currentOrderData.paymentStatus || 'N/A'}</Text></View>
            </View>

             {/* Conditional: COD Section Details */}
             {showCodSection && (
                 <View style={styles.paymentSubSection}>
                     <Text style={styles.paymentSubHeader}>Cash on Delivery</Text>
                     <View style={styles.summaryRow}>
                         <Text style={styles.summaryLabel}>Amount Due (COD):</Text>
                         <Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.codAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                     </View>
                     {currentOrderData.codPaymentReceivedAt && (
                          <View style={styles.summaryRow}>
                              <Text style={styles.summaryLabel}>COD Paid At:</Text>
                              <Text style={styles.summaryValue}>{formatDate(currentOrderData.codPaymentReceivedAt)}</Text>
                          </View>
                      )}
                 </View>
             )}

            {/* Conditional: BNPL/Installment Plan Details */}
            {showInstallmentSection && ( // Show this section if it's BNPL or Mixed w/ Installments
                 <View style={styles.paymentSubSection}>
                     <Text style={styles.paymentSubHeader}>Installment Plan Details</Text>
                     {/* Always show the amount if the section is shown */}
                     <View style={styles.summaryRow}>
                         <Text style={styles.summaryLabel}>Plan Amount (BNPL):</Text>
                         <Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.bnplAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                     </View>
                     {/* Conditionally show plan details if they exist */}
                     {relevantPlanDetails && relevantPlanDetails.planType === 'Installment' && ( // Check type here too
                         <View style={styles.planDetailsBox}>
                            <Text style={styles.planDetailTitle}>Plan: {relevantPlanDetails.name || 'N/A'}</Text>
                            <Text style={styles.planDetailText}>Duration: {relevantPlanDetails.duration || 'N/A'} Months</Text>
                            <Text style={styles.planDetailText}>Interest: {typeof relevantPlanDetails.interestRate === 'number' ? `${(relevantPlanDetails.interestRate * 100).toFixed(1)}%` : 'N/A'}</Text>
                         </View>
                      )}
                      {/* Show link only if installments exist */}
                      {(currentOrderData.installments?.length > 0) && <Text style={styles.linkText}>(See Full Schedule Below)</Text>}
                 </View>
            )}

            {/* Conditional: Fixed Duration Details */}
             {showFixedDurationSection && ( // Show this section if it's Fixed Duration or Mixed w/ Fixed
                 <View style={styles.paymentSubSection}>
                    <Text style={styles.paymentSubHeader}>Fixed Duration Plan Details</Text>
                    {/* *** ADDED Amount display here *** */}
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Plan Amount:</Text>
                        <Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.fixedDurationAmountDue ?? currentOrderData.bnplAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                    </View>
                     <View style={styles.planDetailsBox}>
                         {relevantPlanDetails && <Text style={styles.planDetailTitle}>Plan: {relevantPlanDetails.name || 'Fixed Plan'}</Text>}
                         {relevantPlanDetails && <Text style={styles.planDetailText}>Duration: {relevantPlanDetails.duration || 'N/A'} Months</Text>}
                         {relevantPlanDetails && <Text style={styles.planDetailText}>Interest: {typeof relevantPlanDetails.interestRate === 'number' ? `${(relevantPlanDetails.interestRate ).toFixed(1)}%` : 'N/A'}</Text>}
                         <Text style={styles.planDetailText}>Payment Due: {formatShortDate(currentOrderData.paymentDueDate)}</Text>
                         {typeof currentOrderData.penalty === 'number' && currentOrderData.penalty > 0 && (
                             <Text style={[styles.planDetailText, styles.penaltyText]}>Penalty Applied: {CURRENCY_SYMBOL}{currentOrderData.penalty.toFixed(2)}</Text>
                         )}
                     </View>
                 </View>
            )}
        </View>

        {/* BNPL Installment Schedule */}
        {showInstallmentSection && currentOrderData.installments && currentOrderData.installments.length > 0 && (
             <View style={styles.section}>
                <Text style={styles.sectionTitle}>Installment Schedule</Text>
                <FlatList
                    data={currentOrderData.installments}
                    keyExtractor={(inst, index) => inst?.installmentNumber ? `inst-${inst.installmentNumber}-${index}` : `inst-fallback-${index}`}
                    renderItem={renderInstallment}
                    scrollEnabled={false}
                    ListEmptyComponent={<Text>No installment data found.</Text>}
                />
            </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ScreenBackgroundColor, },
  scrollContainer: { flexGrow: 1, padding: 15, paddingBottom: 40, paddingTop: 15 },
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
  statusPending: { backgroundColor: PendingStatusColor },
  statusProcessing: { backgroundColor: '#42A5F5' }, // Used for Processing & Partially Paid
  statusShipped: { backgroundColor: '#66BB6A' },
  statusDelivered: { backgroundColor: '#78909C' },
  statusCancelled: { backgroundColor: AccentColor },
  statusUnknown: { backgroundColor: '#BDBDBD' },
  statusActive: { backgroundColor: ActiveStatusColor },
  detailText: { fontSize: 14, color: TextColorPrimary, lineHeight: 20, marginBottom: 4, },
  paymentSubSection: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f0f0f0', },
  paymentSubHeader: { fontSize: 15, fontWeight: '600', color: TextColorPrimary, marginBottom: 10, },
  paymentValueHighlight: { fontSize: 14, fontWeight: 'bold', color: AccentColor, },
  planDetailsBox: { marginTop: 10, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 6, borderWidth: 1, borderColor: '#eee' },
  planDetailTitle: { fontSize: 14, fontWeight: '600', color: TextColorPrimary, marginBottom: 6 },
  planDetailText: { fontSize: 13, color: TextColorSecondary, marginBottom: 4, lineHeight: 18 },
  linkText: { fontSize: 13, color: '#007AFF', marginTop: 5, fontStyle: 'italic', },
  penaltyText: { fontSize: 11, color: AccentColor, fontStyle: 'italic', marginLeft: 5, textAlign: 'right', width: '100%' },
  installmentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee', flexWrap: 'wrap' },
  installmentText: { fontSize: 13, color: TextColorSecondary, paddingRight: 5, marginBottom: 3, marginTop: 3, },
  statusBadgeSmall: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 10, marginVertical: 3, },
  statusTextSmall: { fontSize: 10, fontWeight: 'bold', color: '#fff', },
  statusPaid: { backgroundColor: SuccessColor },
  statusInstallmentPending: { backgroundColor: PendingStatusColor },
  paidAtText: { fontSize: 11, color: TextColorSecondary, fontStyle: 'italic', width: '100%', textAlign: 'right', marginTop: 2, },
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
  otpDisplayRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingVertical: 8, paddingHorizontal: 60, backgroundColor: '#E8F5E9', borderRadius: 6, borderWidth: 1, borderColor: '#C8E6C9', alignSelf: 'flex-start', },
  otpDisplayLabel: { fontSize: 14, color: TextColorSecondary, marginRight: 8, },
  otpDisplayValue: { fontSize: 15, fontWeight: 'bold', color: SuccessColor, letterSpacing: 2, },
});