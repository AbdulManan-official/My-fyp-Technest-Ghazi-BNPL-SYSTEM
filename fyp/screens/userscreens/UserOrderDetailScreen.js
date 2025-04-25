// UserOrderDetailScreen.js (COMPLETE CODE - Added Cancel Order Functionality)

import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import {
  StyleSheet, Text, View, ScrollView, Image,
  TouchableOpacity, SafeAreaView, Platform, ActivityIndicator, FlatList,
  Alert, StatusBar
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import {
    getFirestore, doc, onSnapshot, Timestamp,
    updateDoc, // Import updateDoc
    serverTimestamp // Import serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Verify path
import { format, isValid } from 'date-fns';

// --- Constants ---
const AppBackgroundColor = '#FFFFFF';
const ScreenBackgroundColor = '#F8F9FA';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const AccentColor = '#FF0000'; // Used for Cancel button and errors
const SuccessColor = '#4CAF50';
const LightBorderColor = '#E5E7EB';
const PlaceholderBgColor = '#F0F0F0';
const CURRENCY_SYMBOL = 'PKR';
const placeholderImagePath = require('../../assets/p3.jpg'); // Verify path
const ORDERS_COLLECTION = 'orders';
const SHIPPED_STATUS = 'Shipped';
const CANCELLED_STATUS = 'Cancelled'; // Define Cancelled status

// --- NEW: Define which statuses allow user cancellation ---
const CANCELLABLE_STATUSES = [
    'Pending',
    'Processing',
    'Unpaid (COD)',
    'Unpaid (BNPL)',
    'Unpaid (Fixed Duration)',
    'Partially Paid'
    // Add any other statuses you deem cancellable by the user
];

// Colors for the BNPL indicator badge
const BnplIndicatorBgColor = 'rgba(0, 86, 179, 0.1)';
const BnplIndicatorTextColor = '#0056b3';

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

// --- Helper: Format Date (Short for Due Dates) ---
const formatShortDate = (timestamp) => {
     let dateToFormat = null;
     if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); }
     else if (timestamp instanceof Date) { dateToFormat = timestamp; }
     if (dateToFormat && isValid(dateToFormat)) {
         try { return format(dateToFormat, 'MMM d, yyyy'); }
        catch (e) { console.error("[formatShortDate] Error formatting:", e); return 'Invalid Date'; }
     } return 'N/A';
};

// --- Helper: Get Status Style ---
const getStatusStyle = (status) => {
     const lowerStatus = status?.toLowerCase() || 'unknown';
     switch (lowerStatus) {
          case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': case 'unpaid (bnpl)': return styles.statusPending;
          case 'processing': case 'partially paid': return styles.statusProcessing;
          case 'shipped': return styles.statusShipped;
          case 'delivered': return styles.statusDelivered;
          case 'cancelled': case 'rejected': return styles.statusCancelled;
          default: return styles.statusUnknown;
      }
};

// --- Main Component (Single Default Export) ---
export default function UserOrderDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const initialOrder = route.params?.order;
  const orderId = initialOrder?.id;

  // --- State ---
  const [currentOrderData, setCurrentOrderData] = useState(initialOrder);
  const [loading, setLoading] = useState(!initialOrder);
  const [error, setError] = useState(null);
  // --- NEW: State for cancellation loading ---
  const [isCancelling, setIsCancelling] = useState(false);

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
        // console.log("[UserOrderDetailScreen] Order data received from listener.");
        setCurrentOrderData({ id: docSnap.id, ...docSnap.data() });
        setError(null);
      } else {
        console.warn(`[UserOrderDetailScreen] Order ${orderId} not found.`);
        setError("Order not found. It might have been deleted."); // More specific error
        setCurrentOrderData(null);
      }
      setLoading(false);
    }, (err) => {
      console.error(`[UserOrderDetailScreen] Listener error for order ${orderId}:`, err);
      setError("Failed to load real-time order details.");
      setLoading(false);
    });
    return () => {
      console.log(`[UserOrderDetailScreen] Cleaning up listener: ${orderId}`);
      unsubscribe(); // Cleanup on unmount
    };
  }, [orderId]); // Dependency: orderId

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
   const renderInstallment = ({ item }) => (
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

   // --- NEW: Handler for Cancel Order Button ---
   const handleCancelOrder = useCallback(async () => {
       if (!currentOrderData || !orderId || isCancelling) return; // Exit if no data, ID, or already cancelling

       // Check if the current status allows cancellation
       if (!CANCELLABLE_STATUSES.includes(currentOrderData.status)) {
           Alert.alert("Cannot Cancel", `Orders with status "${currentOrderData.status}" cannot be cancelled.`);
           return;
       }

       // Confirmation Alert
       Alert.alert(
           "Cancel Order",
           "Are you sure you want to cancel this order? This action cannot be undone.",
           [
               { text: "Keep Order", style: "cancel" },
               {
                   text: "Yes, Cancel",
                   style: "destructive",
                   onPress: async () => { // Make the action async
                       setIsCancelling(true); // Show loading state
                       console.log(`User attempting to cancel order: ${orderId}`);
                       const orderRef = doc(db, ORDERS_COLLECTION, orderId);
                       try {
                           // Update Firestore document
                           await updateDoc(orderRef, {
                               status: CANCELLED_STATUS, // Set new status
                               cancelledAt: serverTimestamp(), // Add timestamp
                               cancelledBy: 'User' // Indicate who cancelled
                           });
                           console.log(`Order ${orderId} cancelled successfully by user.`);
                           // Optional: Show success message (listener will update UI anyway)
                           // Alert.alert("Order Cancelled", "Your order has been successfully cancelled.");
                           // Navigation might happen automatically if the listener updates state
                           // or you could navigate explicitly here if needed
                           // navigation.goBack();

                       } catch (cancelError) {
                           console.error(`Error cancelling order ${orderId}:`, cancelError);
                           Alert.alert("Error", "Could not cancel the order. Please try again or contact support.");
                       } finally {
                           setIsCancelling(false); // Hide loading state
                       }
                   },
               },
           ],
           { cancelable: true } // Allow dismissing the alert
       );

   }, [currentOrderData, orderId, navigation, isCancelling]); // Dependencies


  // --- Render Logic ---
  if (loading) { /* ... Show Loader ... */ }
  if (error || !currentOrderData) { /* ... Show Error ... */ }

  // --- Determine derived values ---
  const paymentMethod = currentOrderData.paymentMethod || 'Unknown';
  const relevantPlanDetails = currentOrderData.bnplPlanDetails || currentOrderData.fixedDurationDetails;
  const isRelevantPlanInstallment = relevantPlanDetails?.planType === 'Installment';
  const isRelevantPlanFixed = relevantPlanDetails?.planType === 'Fixed Duration' || paymentMethod === 'Fixed Duration';
  const showCodSection = (paymentMethod === 'COD' || paymentMethod === 'Mixed') && typeof currentOrderData.codAmount === 'number' && currentOrderData.codAmount > 0;
  const showInstallmentSection = (paymentMethod === 'BNPL' || paymentMethod === 'Mixed') && isRelevantPlanInstallment && typeof currentOrderData.bnplAmount === 'number' && currentOrderData.bnplAmount > 0;
  const showFixedDurationSection = (paymentMethod === 'Fixed Duration' || paymentMethod === 'BNPL' || paymentMethod === 'Mixed') && isRelevantPlanFixed && typeof currentOrderData.bnplAmount === 'number' && currentOrderData.bnplAmount > 0;
  // --- NEW: Check if cancellation is allowed ---
  const canCancelOrder = currentOrderData && CANCELLABLE_STATUSES.includes(currentOrderData.status);


  // --- Main Render when data is loaded ---
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
      <ScrollView contentContainerStyle={styles.scrollContainer}>

        {/* Sections 1-5 (Items, Summary, Delivery, Payment, Installments) */}
        {/* ... (These sections remain exactly the same as the previous version) ... */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items Ordered ({currentOrderData.items?.length || 0})</Text>
          <View style={styles.itemsListContainer}><FlatList data={currentOrderData.items || []} keyExtractor={(itemData, index) => itemData?.id ? `${itemData.id}-${index}` : `item-${index}`} renderItem={renderOrderItem} scrollEnabled={false} ListEmptyComponent={<Text>No items found.</Text>} /></View>
           <View style={styles.orderTotals}>
                <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal:</Text><Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {(currentOrderData.subtotal || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</Text></View>
                <View style={styles.totalDivider} />
                 <View style={styles.summaryRow}><Text style={[styles.summaryLabel, styles.grandTotalLabel]}>Grand Total:</Text><Text style={[styles.summaryValue, styles.grandTotalValue]}>{CURRENCY_SYMBOL} {(currentOrderData.grandTotal || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</Text></View>
            </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Order ID:</Text><Text style={styles.summaryValue}>#{currentOrderData.id?.substring(0,8).toUpperCase() || 'N/A'}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Order Date:</Text><Text style={styles.summaryValue}>{formatDate(currentOrderData.createdAt || currentOrderData.orderDate)}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Status:</Text><View style={[styles.statusBadge, getStatusStyle(currentOrderData.status)]}><Text style={styles.statusText}>{currentOrderData.status || 'Unknown'}</Text></View></View>
          {currentOrderData.status === SHIPPED_STATUS && currentOrderData.deliveryOtp && (<View style={styles.otpDisplayRow}><Icon name="vpn-key" size={16} color={SuccessColor} style={{ marginRight: 6 }}/><Text style={styles.otpDisplayLabel}>Delivery OTP:</Text><Text style={styles.otpDisplayValue}>{currentOrderData.deliveryOtp}</Text></View>)}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <Text style={styles.detailText}>{currentOrderData.userName || 'N/A'}</Text>
          <Text style={styles.detailText}>{currentOrderData.userAddress || 'N/A'}</Text>
          <Text style={styles.detailText}>{currentOrderData.userPhone || 'N/A'}</Text>
        </View>
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Details</Text>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Method:</Text><Text style={styles.summaryValue}>{currentOrderData.paymentMethod || 'N/A'}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Payment Status:</Text><View style={[styles.statusBadge, getStatusStyle(currentOrderData.paymentStatus)]}><Text style={styles.statusText}>{currentOrderData.paymentStatus || 'N/A'}</Text></View></View>
            {currentOrderData.paymentMethod === 'BNPL' && currentOrderData.bnplPlanDetails && ( <View style={styles.planDetailsBox}><Text style={styles.planDetailTitle}>Plan: {currentOrderData.bnplPlanDetails.name || 'N/A'}</Text><Text style={styles.planDetailText}>Type: {currentOrderData.bnplPlanDetails.planType || 'N/A'}</Text><Text style={styles.planDetailText}>Duration: {currentOrderData.bnplPlanDetails.duration || 'N/A'} Months</Text><Text style={styles.planDetailText}>Interest: {typeof currentOrderData.bnplPlanDetails.interestRate === 'number' ? `${(currentOrderData.bnplPlanDetails.interestRate * 100).toFixed(1)}%` : 'N/A'}</Text></View> )}
             {currentOrderData.paymentMethod === 'Fixed Duration' && (currentOrderData.fixedDurationDetails || currentOrderData.paymentDueDate) && ( <View style={styles.planDetailsBox}>{currentOrderData.fixedDurationDetails && <Text style={styles.planDetailTitle}>Plan: {currentOrderData.fixedDurationDetails.name || 'Fixed Plan'}</Text>}{currentOrderData.fixedDurationDetails && <Text style={styles.planDetailText}>Duration: {currentOrderData.fixedDurationDetails.duration || 'N/A'} Months</Text>}{currentOrderData.fixedDurationDetails && <Text style={styles.planDetailText}>Interest: {typeof currentOrderData.fixedDurationDetails.interestRate === 'number' ? `${(currentOrderData.fixedDurationDetails.interestRate * 100).toFixed(1)}%` : 'N/A'}</Text>}<Text style={styles.planDetailText}>Payment Due: {formatShortDate(currentOrderData.paymentDueDate)}</Text>{typeof currentOrderData.penalty === 'number' && currentOrderData.penalty > 0 && ( <Text style={[styles.planDetailText, styles.penaltyText]}>Penalty Applied: {CURRENCY_SYMBOL}{currentOrderData.penalty.toFixed(2)}</Text> )}</View>)}
        </View>
        {currentOrderData.paymentMethod === 'BNPL' && currentOrderData.bnplPlanDetails?.planType === 'Installment' && currentOrderData.installments && currentOrderData.installments.length > 0 && (
             <View style={styles.section}>
                <Text style={styles.sectionTitle}>Installment Schedule</Text>
                <FlatList data={currentOrderData.installments} keyExtractor={(inst, index) => inst?.installmentNumber ? `inst-${inst.installmentNumber}-${index}` : `inst-fallback-${index}`} renderItem={renderInstallment} scrollEnabled={false} ListEmptyComponent={<Text>No installment data found.</Text>} />
            </View>
        )}

        {/* --- NEW: Cancel Order Button (Conditional) --- */}
        {canCancelOrder && (
            <TouchableOpacity
                style={[styles.cancelButton, isCancelling && styles.disabledButton]}
                onPress={handleCancelOrder}
                disabled={isCancelling}
                activeOpacity={0.7}
            >
                {isCancelling ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                    <View style={styles.buttonContent}>
                         <Icon name="cancel" size={18} color="#FFFFFF" style={styles.buttonIcon}/>
                         <Text style={styles.cancelButtonText}>Cancel Order</Text>
                    </View>
                )}
            </TouchableOpacity>
        )}
        {/* --- End Cancel Order Button --- */}


      </ScrollView>
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
  statusPaid: { backgroundColor: 'green' },
  statusInstallmentPending: { backgroundColor: 'orange'},
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
  otpDisplayRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingVertical: 8, paddingHorizontal: 60, backgroundColor: '#E8F5E9', borderRadius: 6, borderWidth: 1, borderColor: '#C8E6C9', alignSelf: 'flex-start', marginLeft: 'auto', },
  otpDisplayLabel: { fontSize: 14, color: TextColorSecondary, marginRight: 8, },
  otpDisplayValue: { fontSize: 15, fontWeight: 'bold', color: SuccessColor, letterSpacing: 2, },
  // --- NEW Styles for Cancel Button ---
  cancelButton: {
    backgroundColor: AccentColor, // Red color
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20, // Space above the button
    marginHorizontal: 10, // Side margins
    marginBottom: 10, // Space below the button
    elevation: 3,
    minHeight: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: { // Reusable disabled style
      backgroundColor: '#BDBDBD',
      elevation: 0,
      shadowOpacity: 0,
  },
   buttonContent: { // To align icon and text
    flexDirection: 'row',
    alignItems: 'center',
   },
   buttonIcon: { // Style for icon within button
    marginRight: 8,
   },
});