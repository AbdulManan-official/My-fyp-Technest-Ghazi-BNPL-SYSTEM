// AdminDetailOrderScreen.js (COMPLETE - No Header, Real-time, Mark Shipped + Notify)

import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Image, TouchableOpacity,
  SafeAreaView, Platform, ActivityIndicator, FlatList, Alert, StatusBar
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons as IconMUI } from '@expo/vector-icons'; // Use MaterialIcons
import IconFA from 'react-native-vector-icons/FontAwesome'; // Use FontAwesome for buttons
// Import Firestore functions
import { getFirestore, doc, updateDoc, onSnapshot, Timestamp, serverTimestamp, getDoc, collection } from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Verify path
import axios from 'axios'; // For notifications
import { format, isValid } from 'date-fns'; // For date formatting

// --- Constants ---
const AppBackgroundColor = '#FFFFFF';
const ScreenBackgroundColor = '#F8F9FA';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const AccentColor = '#FF0000'; // Or your app's accent color
const LightBorderColor = '#E5E7EB';
const PlaceholderBgColor = '#F0F0F0';
const CURRENCY_SYMBOL = 'PKR';
const placeholderImagePath = require('../../assets/p3.jpg'); // Verify path
const ORDERS_COLLECTION = 'orders';
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const SHIPPED_STATUS = 'Shipped'; // Status string

// --- Helper: Format Date (Full) ---
const formatDate = (timestamp) => {
    let dateToFormat = null; if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); } else if (timestamp instanceof Date) { dateToFormat = timestamp; } if (dateToFormat && isValid(dateToFormat)) { try { return format(dateToFormat, 'MMM d, yyyy, h:mm a'); } catch (e) { return 'Invalid Date'; } } return 'N/A';
};

// --- Helper: Format Date (Short) ---
const formatShortDate = (timestamp) => {
     let dateToFormat = null; if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); } else if (timestamp instanceof Date) { dateToFormat = timestamp; } if (dateToFormat && isValid(dateToFormat)) { try { return format(dateToFormat, 'MMM d, yyyy'); } catch (e) { return 'Invalid Date'; } } return 'N/A';
};

// --- Helper: Get Status Style ---
const getStatusStyle = (status) => {
     const lowerStatus = status?.toLowerCase() || 'unknown'; switch (lowerStatus) { case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': return styles.statusPending; case 'processing': case 'partially paid': return styles.statusProcessing; case 'shipped': return styles.statusShipped; case 'delivered': return styles.statusDelivered; case 'cancelled': case 'rejected': return styles.statusCancelled; default: return styles.statusUnknown; }
};

// --- Helper: Fetch User Token ---
async function getUserExpoToken(userId) {
    if (!userId) { console.error("[getUserExpoToken] userId missing."); return null; }
    let token = null;
    try {
        const userDocRef = doc(db, "Users", userId); const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) { token = userDocSnap.data()?.expoPushToken; if (token && typeof token === 'string' && token.startsWith('ExponentPushToken[')) { return token; } else if (token) { console.warn(`[getUserExpoToken] Invalid format: ${userId}`, token); return null; } else { console.warn(`[getUserExpoToken] Token missing: ${userId}.`); return null; }
        } else { console.warn(`[getUserExpoToken] User doc not found: ${userId}`); return null; }
    } catch (error) { console.error(`[getUserExpoToken] Error fetching token: ${userId}`, error); return null; }
}

// --- Main Component ---
export default function AdminDetailOrderScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const initialOrder = route.params?.order; // Get initial order passed
  const orderId = initialOrder?.id; // Get order ID

  // --- State ---
  const [currentOrderData, setCurrentOrderData] = useState(initialOrder); // Holds real-time data
  const [loading, setLoading] = useState(!initialOrder); // Loading state
  const [error, setError] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false); // Loader for button

  // --- Effect: Real-time Listener for THIS Order ---
  useEffect(() => {
    if (!orderId) { setError("Order ID not found."); setLoading(false); setCurrentOrderData(null); return; }
    // Don't set loading=true if we already have initial data, listener will update
    // setLoading(true);
    setError(null);
    console.log(`[AdminDetailOrder] Setting up listener for order: ${orderId}`);
    const orderRef = doc(db, ORDERS_COLLECTION, orderId);
    const unsubscribe = onSnapshot(orderRef, (docSnap) => {
      if (docSnap.exists()) { setCurrentOrderData({ id: docSnap.id, ...docSnap.data() }); setError(null); }
      else { setError("Order not found."); setCurrentOrderData(null); } setLoading(false);
    }, (err) => { setError("Failed load details."); setLoading(false); console.error("Listener error:", err); });
    return () => unsubscribe();
  }, [orderId]);

  // --- Function to Send Shipping Notification ---
  const sendShippingNotification = async (userId, orderIdentifier) => {
      console.log(`Attempting shipping notification for user ${userId}, order ${orderIdentifier}`); const userToken = await getUserExpoToken(userId);
      if (userToken) { const message = { to: userToken, sound: 'default', title: '🚚 Order Shipped!', body: `Your order #${orderIdentifier} has shipped!`, data: { orderId: orderId, type: 'shipping_update' }, priority: 'high', channelId: 'order-updates' };
          console.log("Sending shipping notification payload:", JSON.stringify(message, null, 2));
          try { await axios.post(EXPO_PUSH_ENDPOINT, [message], { headers: { 'Accept': 'application/json','Content-Type': 'application/json','Accept-encoding': 'gzip, deflate'}, timeout: 10000 }); console.log(`Shipping notification sent to user ${userId}.`); }
          catch (error) { console.error(`Failed shipping notification: ${userId}:`, error.response?.data || error.message); }
      } else { console.warn(`No token for user ${userId}. Skipping notification.`); }
  };

  // --- Handle Mark as Shipped ---
  const handleMarkAsShipped = async () => {
    if (!currentOrderData?.id || !currentOrderData?.userId || isUpdatingStatus) return;
    const currentStatus = currentOrderData.status?.toLowerCase();
    if (['shipped', 'delivered', 'cancelled', 'rejected'].includes(currentStatus)) { Alert.alert("Action Not Allowed", `Order status is already '${currentOrderData.status}'.`); return; }
    setIsUpdatingStatus(true); const orderRef = doc(db, ORDERS_COLLECTION, currentOrderData.id);
    try {
      await updateDoc(orderRef, { status: SHIPPED_STATUS, shippedAt: serverTimestamp() });
      console.log(`Order ${currentOrderData.id} marked as ${SHIPPED_STATUS}.`);
      await sendShippingNotification(currentOrderData.userId, currentOrderData.orderNumber || currentOrderData.id);
      Alert.alert("Success", `Order marked as ${SHIPPED_STATUS} and user notified.`);
    } catch (error) { console.error("Error marking as shipped:", error); Alert.alert("Error", "Could not update status."); }
    finally { setIsUpdatingStatus(false); }
  };

  // --- Render Individual Item ---
  const renderOrderItem = ({ item, index }) => {
     if (!item || typeof item.price !== 'number' || typeof item.quantity !== 'number') return null;
     const itemsArray = currentOrderData?.items || [];
     const itemTotal = (item.price || 0) * (item.quantity || 1);
     const paymentMethod = item.paymentMethod || 'COD'; let paymentDisplay = paymentMethod;
     if (paymentMethod === 'BNPL' && item.bnplPlan) { paymentDisplay = item.bnplPlan.name || 'BNPL Plan'; } else if (paymentMethod === 'Fixed Duration') { paymentDisplay = item.bnplPlan?.name || 'Fixed Duration'; }
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

  // --- Render Logic ---
  if (loading) { return ( <SafeAreaView style={styles.container}><ActivityIndicator size="large" color={AccentColor} style={styles.loader} /></SafeAreaView> ); }
  if (error || !currentOrderData) { return ( <SafeAreaView style={styles.container}><View style={styles.loadingContainer}><Text style={styles.errorText}>{error || "Order details not found."}</Text><TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.errorLink}>Go Back</Text></TouchableOpacity></View></SafeAreaView> ); }

  // Determine if Mark as Shipped button should be shown
  const canMarkAsShipped = ['pending', 'processing'].includes(currentOrderData.status?.toLowerCase());

  // --- Main Render when data is loaded ---
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
      {/* Header is Removed */}

      <ScrollView contentContainerStyle={styles.scrollContainer}>

        {/* Items Ordered Section (First) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items Ordered ({currentOrderData.items?.length || 0})</Text>
          <View style={styles.itemsListContainer}>
            <FlatList
              data={currentOrderData.items || []}
              keyExtractor={(itemData, index) => itemData?.id ? `${itemData.id}-${index}` : `item-${index}`}
              renderItem={renderOrderItem}
              scrollEnabled={false}
            />
          </View>
           <View style={styles.orderTotals}>
                <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal:</Text><Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {(currentOrderData.subtotal || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</Text></View>
                <View style={styles.totalDivider} />
                 <View style={styles.summaryRow}><Text style={[styles.summaryLabel, styles.grandTotalLabel]}>Grand Total:</Text><Text style={[styles.summaryValue, styles.grandTotalValue]}>{CURRENCY_SYMBOL} {(currentOrderData.grandTotal || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</Text></View>
            </View>
        </View>

        {/* Order Summary Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Order ID:</Text><Text style={styles.summaryValue}>#{currentOrderData.id?.substring(0,8).toUpperCase() || 'N/A'}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Order Date:</Text><Text style={styles.summaryValue}>{formatDate(currentOrderData.createdAt || currentOrderData.orderDate)}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Status:</Text><View style={[styles.statusBadge, getStatusStyle(currentOrderData.status)]}><Text style={styles.statusText}>{currentOrderData.status || 'Unknown'}</Text></View></View>
        </View>

        {/* Customer Information */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Information</Text>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Name:</Text><Text style={styles.summaryValue}>{currentOrderData.userName || 'N/A'}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Phone:</Text><Text style={styles.summaryValue}>{currentOrderData.userPhone || 'N/A'}</Text></View>
            <View>
                <Text style={styles.summaryLabel}>Address:</Text>
                <Text style={[styles.summaryValue, styles.addressValue]}>{currentOrderData.userAddress || 'N/A'}</Text>
            </View>
         </View>

        {/* Payment Information */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Details</Text>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Method:</Text><Text style={styles.summaryValue}>{currentOrderData.paymentMethod || 'N/A'}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Payment Status:</Text><Text style={styles.summaryValue}>{currentOrderData.paymentStatus || 'N/A'}</Text></View>
            {/* BNPL Plan Details */}
            {currentOrderData.paymentMethod === 'BNPL' && currentOrderData.bnplPlanDetails && (<View style={styles.planDetailsBox}><Text style={styles.planDetailTitle}>Plan: {currentOrderData.bnplPlanDetails.name || 'N/A'}</Text><Text style={styles.planDetailText}>Type: {currentOrderData.bnplPlanDetails.planType || 'N/A'}</Text><Text style={styles.planDetailText}>Duration: {currentOrderData.bnplPlanDetails.duration || 'N/A'} Months</Text><Text style={styles.planDetailText}>Interest: {typeof currentOrderData.bnplPlanDetails.interestRate === 'number' ? `${(currentOrderData.bnplPlanDetails.interestRate * 100).toFixed(1)}%` : 'N/A'}</Text></View>)}
            {/* Fixed Duration Details */}
             {currentOrderData.paymentMethod === 'Fixed Duration' && (currentOrderData.fixedDurationDetails || currentOrderData.paymentDueDate) && (<View style={styles.planDetailsBox}>{currentOrderData.fixedDurationDetails && <Text style={styles.planDetailTitle}>Plan: {currentOrderData.fixedDurationDetails.name || 'Fixed Plan'}</Text>}{currentOrderData.fixedDurationDetails && <Text style={styles.planDetailText}>Duration: {currentOrderData.fixedDurationDetails.duration || 'N/A'} Months</Text>}{currentOrderData.fixedDurationDetails && <Text style={styles.planDetailText}>Interest: {typeof currentOrderData.fixedDurationDetails.interestRate === 'number' ? `${(currentOrderData.fixedDurationDetails.interestRate * 100).toFixed(1)}%` : 'N/A'}</Text>}<Text style={styles.planDetailText}>Payment Due: {formatShortDate(currentOrderData.paymentDueDate)}</Text>{typeof currentOrderData.penalty === 'number' && currentOrderData.penalty > 0 && (<Text style={[styles.planDetailText, styles.penaltyText]}>Penalty Applied: {CURRENCY_SYMBOL}{currentOrderData.penalty.toFixed(2)}</Text>)}</View>)}
        </View>

        {/* BNPL Installment Schedule */}
        {currentOrderData.paymentMethod === 'BNPL' && currentOrderData.bnplPlanDetails?.planType === 'Installment' && currentOrderData.installments?.length > 0 && (
             <View style={styles.section}><Text style={styles.sectionTitle}>Installment Schedule</Text><FlatList data={currentOrderData.installments} keyExtractor={(inst, index) => inst?.installmentNumber ? `inst-${inst.installmentNumber}-${index}` : `inst-fallback-${index}`} renderItem={renderInstallment} scrollEnabled={false}/></View>
        )}

         {/* Action Button: Mark as Shipped */}
         {canMarkAsShipped && (
             <TouchableOpacity style={[styles.actionButton, isUpdatingStatus && styles.disabledButton]} onPress={handleMarkAsShipped} disabled={isUpdatingStatus} activeOpacity={0.7} >
                 {isUpdatingStatus ? (<ActivityIndicator color="#FFF" size="small" />) : (<Text style={styles.actionButtonText}>Mark as Shipped & Notify</Text>)}
             </TouchableOpacity>
         )}

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
  backButtonError: { padding: 8, }, // Renamed for clarity
  headerTitleError: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '600', color: TextColorPrimary, marginRight: 30 + 8 }, // Adjusted margin for centering
  section: { backgroundColor: AppBackgroundColor, borderRadius: 8, padding: 15, marginBottom: 15, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1.5, borderWidth: 1, borderColor: LightBorderColor, },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: LightBorderColor, paddingBottom: 8, },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, },
  summaryLabel: { fontSize: 14, color: TextColorSecondary, flexShrink: 1, marginRight: 5 },
  summaryValue: { fontSize: 14, fontWeight: '500', color: TextColorPrimary, textAlign: 'right', flexShrink: 1, },
  addressValue: { textAlign: 'left', }, // Keep address left-aligned
  totalValue: { fontWeight: 'bold', fontSize: 16, color: AccentColor, },
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
  actionButton: { backgroundColor: '#42A5F5', paddingVertical: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 20, marginHorizontal: 10, marginBottom: 10, elevation: 3, minHeight: 48, },
  disabledButton: { backgroundColor: '#BDBDBD', elevation: 0, },
  actionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', },
});