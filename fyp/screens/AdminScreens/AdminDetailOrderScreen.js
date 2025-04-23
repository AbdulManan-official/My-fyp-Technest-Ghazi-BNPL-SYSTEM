// AdminDetailOrderScreen.js (COMPLETE - Final Version)

import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Image, TouchableOpacity,
  SafeAreaView, Platform, ActivityIndicator, FlatList, Alert, StatusBar
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons as IconMUI } from '@expo/vector-icons'; // Use MaterialIcons
// Import Firestore functions for database interactions
import { getFirestore, doc, updateDoc, onSnapshot, Timestamp, serverTimestamp, getDoc, collection } from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Verify path to your Firebase config
import axios from 'axios'; // For sending push notifications
import { format, isValid } from 'date-fns'; // For formatting dates

// --- Constants ---
const AppBackgroundColor = '#FFFFFF'; // Background for sections
const ScreenBackgroundColor = '#F8F9FA'; // Overall screen background
const TextColorPrimary = '#212121'; // Main text color
const TextColorSecondary = '#6B7280'; // Lighter text color for labels, dates etc.
const AccentColor = '#FF0000'; // Your app's primary accent color (e.g., Red)
const LightBorderColor = '#E5E7EB'; // Color for borders and dividers
const PlaceholderBgColor = '#F0F0F0'; // Background for image placeholders
const CURRENCY_SYMBOL = 'PKR'; // Currency symbol used in the app
const placeholderImagePath = require('../../assets/p3.jpg'); // Verify path to your placeholder image
const ORDERS_COLLECTION = 'orders'; // Firestore collection name for orders
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send"; // Expo's push notification endpoint
const SHIPPED_STATUS = 'Shipped'; // String value for the 'Shipped' status
// Colors for the BNPL indicator badge in the item list
const BnplIndicatorBgColor = 'rgba(0, 86, 179, 0.1)'; // Light blue background
const BnplIndicatorTextColor = '#0056b3';         // Dark blue text/icon

// --- Helper Function: Format Date (Full with Time) ---
const formatDate = (timestamp) => {
    let dateToFormat = null;
    // Convert Firestore Timestamp or JS Date to JS Date object
    if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); }
    else if (timestamp instanceof Date) { dateToFormat = timestamp; }
    // Check if valid and format
    if (dateToFormat && isValid(dateToFormat)) {
        try { return format(dateToFormat, 'MMM d, yyyy, h:mm a'); } // e.g., Jan 1, 2023, 5:30 PM
        catch (e) { console.error("Error formatting date:", e); return 'Invalid Date'; }
    }
    return 'N/A'; // Return N/A if input is invalid
};

// --- Helper Function: Format Date (Short Date Only) ---
const formatShortDate = (timestamp) => {
    let dateToFormat = null;
    if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); }
    else if (timestamp instanceof Date) { dateToFormat = timestamp; }
    if (dateToFormat && isValid(dateToFormat)) {
        try { return format(dateToFormat, 'MMM d, yyyy'); } // e.g., Jan 1, 2023
        catch (e) { console.error("Error formatting short date:", e); return 'Invalid Date'; }
    }
    return 'N/A';
};

// --- Helper Function: Get Status Badge Style ---
// Returns the appropriate style object for the status badge based on the status string.
const getStatusStyle = (status) => {
    const lowerStatus = status?.toLowerCase() || 'unknown'; // Handle null/undefined and case-insensitivity
    switch (lowerStatus) {
        // Group similar statuses for consistent styling
        case 'pending':
        case 'unpaid (cod)':
        case 'unpaid (fixed duration)':
        case 'unpaid (bnpl)':
            return styles.statusPending; // Orange
        case 'processing':
        case 'partially paid':
            return styles.statusProcessing; // Blue
        case 'shipped':
            return styles.statusShipped; // Green
        case 'delivered':
            return styles.statusDelivered; // Grey
        case 'cancelled':
        case 'rejected': // Group terminal negative statuses
            return styles.statusCancelled; // Red
        default: // Fallback for 'Unknown' or unexpected statuses
            return styles.statusUnknown; // Light Grey
    }
};

// --- Helper Function: Fetch User's Expo Push Token ---
// Retrieves the push token from the 'Users' collection for sending notifications.
async function getUserExpoToken(userId) {
    if (!userId) {
        console.error("[getUserExpoToken] Cannot fetch token: userId is missing."); // Log critical error
        return null;
    }
    let token = null;
    try {
        const userDocRef = doc(db, "Users", userId); // Assumes user data is in 'Users' collection
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            token = userDocSnap.data()?.expoPushToken;
            // Validate token format before returning
            if (token && typeof token === 'string' && token.startsWith('ExponentPushToken[')) {
                // console.log(`[getUserExpoToken] Found valid token for user ${userId}.`); // Optional success log kept commented
                return token;
            } else {
                // Invalid format or missing token field - warnings removed
                return null;
            }
        } else {
            // User document not found - warning removed
            return null;
        }
    } catch (error) {
        // Log actual exceptions during the Firestore fetch operation
        console.error(`[getUserExpoToken] Error fetching token for user ${userId}:`, error);
        return null;
    }
}

// --- Main Component: AdminDetailOrderScreen ---
export default function AdminDetailOrderScreen() {
  const route = useRoute(); // Hook to access navigation parameters
  const navigation = useNavigation(); // Hook to access navigation actions
  const initialOrder = route.params?.order; // Get the initial order data passed from the previous screen
  const orderId = initialOrder?.id; // Extract the order ID

  // --- State Variables ---
  const [currentOrderData, setCurrentOrderData] = useState(initialOrder); // Holds the latest order data (updated by listener)
  const [loading, setLoading] = useState(!initialOrder); // True if initial data wasn't passed or listener is fetching
  const [error, setError] = useState(null); // Stores any error message during data fetching
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false); // Tracks loading state for the "Mark as Shipped" button

  // --- Effect: Setup Real-time Listener for this Specific Order ---
  useEffect(() => {
    // Ensure we have an order ID before proceeding
    if (!orderId) {
        setError("Order ID not found in navigation parameters.");
        setLoading(false);
        setCurrentOrderData(null); // Clear any potentially stale initial data
        return; // Exit effect
    }

    // Clear any previous error and set up the listener
    setError(null);
    console.log(`[AdminDetailOrder] Setting up real-time listener for order ID: ${orderId}`);

    // Create a reference to the specific order document in Firestore
    const orderRef = doc(db, ORDERS_COLLECTION, orderId);

    // Attach the `onSnapshot` listener
    const unsubscribe = onSnapshot(orderRef,
      (docSnap) => { // Success callback
        if (docSnap.exists()) {
            // Update state with the latest data including the ID and ALL fields
            setCurrentOrderData({ id: docSnap.id, ...docSnap.data() });
            setError(null); // Clear any previous 'not found' error
            // console.log(`[AdminDetailOrder] Data updated for order: ${orderId}`); // Optional log
        } else {
            // Document doesn't exist (e.g., deleted)
            setError("Order data could not be found. It might have been deleted.");
            setCurrentOrderData(null); // Clear data
            console.warn(`[AdminDetailOrder] Document snapshot does not exist for order: ${orderId}`);
        }
        setLoading(false); // Stop loading indicator
      },
      (err) => { // Error callback
        setError("Failed to load order details in real-time.");
        setLoading(false); // Stop loading indicator
        console.error(`[AdminDetailOrder] Firestore listener error for order ${orderId}:`, err);
      }
    );

    // Return the unsubscribe function to be called when the component unmounts or orderId changes
    return () => {
        console.log(`[AdminDetailOrder] Unsubscribing from listener for order: ${orderId}`);
        unsubscribe();
    };
  }, [orderId]); // Dependency array: re-run effect if orderId changes


  // --- Function to Send Shipping Notification to User ---
  const sendShippingNotification = async (userId, orderIdentifier) => {
      console.log(`Attempting to send shipping notification for user ${userId}, order ${orderIdentifier}`);
      // Fetch the user's push token
      const userToken = await getUserExpoToken(userId);

      if (userToken) {
          // Construct the notification payload
          const message = {
              to: userToken,
              sound: 'default',
              title: '🚚 Order Shipped!',
              body: `Your order #${orderIdentifier} has shipped and is on its way!`,
              data: { orderId: orderId, type: 'shipping_update' }, // Optional data payload for handling taps
              priority: 'high', // iOS priority
              channelId: 'order-updates' // Android channel ID (ensure channel is created)
          };

          // console.log("Sending shipping notification payload:", JSON.stringify(message, null, 2)); // Optional detailed log
          try {
              // Send the notification via Expo's push API using axios
              await axios.post(EXPO_PUSH_ENDPOINT, [message], { // Send as an array
                  headers: {
                      'Accept': 'application/json',
                      'Content-Type': 'application/json',
                      'Accept-encoding': 'gzip, deflate', // Recommended headers
                  },
                  timeout: 10000 // 10 second timeout
              });
              console.log(`Shipping notification POST request successful for user ${userId}.`);
          } catch (error) {
              // Log detailed error information if the request fails
              console.error(`Failed to send shipping notification to user ${userId}:`, error.response?.data || error.message || error);
          }
      } else {
          // Log if no valid token was found
          console.log(`No valid push token found for user ${userId}. Skipping shipping notification.`);
      }
  };

  // --- Handler Function: Mark Order as Shipped ---
  const handleMarkAsShipped = async () => {
    // Basic validation and prevent double-clicks
    if (!currentOrderData?.id || !currentOrderData?.userId || isUpdatingStatus) return;

    // Check if the order is already in a terminal state
    const currentStatus = currentOrderData.status?.toLowerCase();
    if (['shipped', 'delivered', 'cancelled', 'rejected'].includes(currentStatus)) {
        Alert.alert("Action Not Allowed", `This order's status is already '${currentOrderData.status}'. Cannot mark as shipped again.`);
        return;
    }

    setIsUpdatingStatus(true); // Show loading indicator on the button
    const orderRef = doc(db, ORDERS_COLLECTION, currentOrderData.id);

    try {
        // Update the order document in Firestore
        await updateDoc(orderRef, {
            status: SHIPPED_STATUS, // Set the new status
            shippedAt: serverTimestamp() // Add a timestamp for when it was shipped
        });
        console.log(`Order ${currentOrderData.id} status updated to ${SHIPPED_STATUS} in Firestore.`);

        // Attempt to send notification (awaits completion of token fetch and POST)
        await sendShippingNotification(
            currentOrderData.userId,
            currentOrderData.orderNumber || currentOrderData.id // Use orderNumber if available
        );

        // Show success feedback to the admin
        Alert.alert("Success", `Order marked as ${SHIPPED_STATUS} and notification sent (if token available).`);

    } catch (error) {
        console.error("Error marking order as shipped:", error);
        Alert.alert("Error", "Could not update the order status. Please try again.");
    } finally {
        setIsUpdatingStatus(false); // Hide loading indicator on the button
    }
  };

  // --- Render Function for Items in the Order ---
  const renderOrderItem = ({ item, index }) => {
     // Basic validation for item data
     if (!item || typeof item.price !== 'number' || typeof item.quantity !== 'number') {
         console.warn("Skipping render for invalid order item:", item);
         return null;
     }
     const itemsArray = currentOrderData?.items || []; // Get items array for checking last item
     const itemTotal = (item.price || 0) * (item.quantity || 1); // Calculate item total safely

     // Determine how to display the payment method for this specific item
     const paymentMethod = item.paymentMethod || 'COD'; // Default to COD if missing
     let paymentDisplay = paymentMethod;
     if (paymentMethod === 'BNPL' && item.bnplPlan?.name) { paymentDisplay = item.bnplPlan.name; }
     else if (paymentMethod === 'BNPL') { paymentDisplay = 'BNPL Plan';}
     else if (paymentMethod === 'Fixed Duration' && item.bnplPlan?.name) { paymentDisplay = item.bnplPlan.name;}
     else if (paymentMethod === 'Fixed Duration') { paymentDisplay = 'Fixed Duration';}

     return (
          // Apply specific style if it's the last item (to remove border)
          <View style={[styles.itemContainer, index === itemsArray.length - 1 && styles.lastItemContainer]}>
              {/* Product Image */}
              <Image
                source={item.image ? { uri: item.image } : placeholderImagePath}
                style={styles.itemImage}
                defaultSource={placeholderImagePath} // Placeholder during load/error
              />
              {/* Item Text Details */}
              <View style={styles.itemDetails}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name || 'N/A'}</Text>
                  <Text style={styles.itemQtyPrice}>Qty: {item.quantity || 1}</Text>
                  <Text style={styles.itemPrice}>{CURRENCY_SYMBOL} {(item.price || 0).toLocaleString(undefined, {maximumFractionDigits:0})}</Text>
                  {/* Display the specific payment method for this item */}
                  <Text style={styles.itemPaymentMethod}>Method: {paymentDisplay}</Text>
              </View>
             {/* Item Total Price (Quantity * Price) */}
             <Text style={styles.itemTotalValue}>{CURRENCY_SYMBOL} {itemTotal.toLocaleString(undefined, {maximumFractionDigits:0})}</Text>
          </View>
       );
  };

   // --- Render Function for BNPL Installment Rows ---
   const renderInstallment = ({ item }) => (
      <View style={styles.installmentRow}>
          <Text style={styles.installmentText}>Inst. #{item.installmentNumber || 'N/A'}</Text>
          <Text style={styles.installmentText}>{CURRENCY_SYMBOL} {item.amount?.toLocaleString(undefined, {maximumFractionDigits:0}) || 'N/A'}</Text>
          <Text style={styles.installmentText}>Due: {formatShortDate(item.dueDate)}</Text>
          {/* Small status badge for installment */}
          <View style={[styles.statusBadgeSmall, item.paid ? styles.statusPaid : styles.statusInstallmentPending]}>
             <Text style={styles.statusTextSmall}>{item.paid ? 'Paid' : 'Pending'}</Text>
          </View>
          {/* Display penalty if applicable */}
          {typeof item.penalty === 'number' && item.penalty > 0 && (
              <Text style={styles.penaltyText}>Penalty: {CURRENCY_SYMBOL}{item.penalty.toFixed(2)}</Text>
          )}
      </View>
   );

  // --- Conditional Rendering Logic ---
  // Show loading indicator if loading state is true
  if (loading) {
      return (
          <SafeAreaView style={styles.container}>
              <ActivityIndicator size="large" color={AccentColor} style={styles.loader} />
          </SafeAreaView>
      );
  }
  // Show error message if an error occurred or data is missing
  if (error || !currentOrderData) {
      return (
          <SafeAreaView style={styles.container}>
              <View style={styles.loadingContainer}>
                  <Text style={styles.errorText}>{error || "Order details could not be loaded."}</Text>
                  {/* Provide a way back if possible */}
                  <TouchableOpacity onPress={() => navigation.goBack()}>
                      <Text style={styles.errorLink}>Go Back</Text>
                  </TouchableOpacity>
              </View>
          </SafeAreaView>
      );
  }

  // --- Determine derived values after data is confirmed loaded ---
  // Check if the 'Mark as Shipped' button should be enabled based on current status
  const canMarkAsShipped = ['pending', 'processing'].includes(currentOrderData.status?.toLowerCase());

  // Determine payment method specifics for easier conditional rendering
  const paymentMethod = currentOrderData.paymentMethod || 'Unknown';
  // Get the relevant plan details object (either bnplPlanDetails or fixedDurationDetails)
  const relevantPlanDetails = currentOrderData.bnplPlanDetails || currentOrderData.fixedDurationDetails;
  // Check the type of the relevant plan
  const isRelevantPlanInstallment = relevantPlanDetails?.planType === 'Installment';
  const isRelevantPlanFixed = relevantPlanDetails?.planType === 'Fixed Duration' || paymentMethod === 'Fixed Duration';

  // Determine which payment detail sections to show based on method, plan type, and amounts
  const showCodSection =
    (paymentMethod === 'COD' || paymentMethod === 'Mixed') &&
    typeof currentOrderData.codAmount === 'number' &&
    currentOrderData.codAmount > 0;

  const showInstallmentSection =
    (paymentMethod === 'BNPL' || paymentMethod === 'Mixed') &&
    isRelevantPlanInstallment &&
    typeof currentOrderData.bnplAmount === 'number' &&
    currentOrderData.bnplAmount > 0;

  const showFixedDurationSection =
    (paymentMethod === 'Fixed Duration' || paymentMethod === 'BNPL' || paymentMethod === 'Mixed') &&
    isRelevantPlanFixed &&
    typeof currentOrderData.bnplAmount === 'number' &&
    currentOrderData.bnplAmount > 0;


  // --- Main Screen Render ---
  return (
    <SafeAreaView style={styles.container}>
      {/* Set Status Bar style for this screen */}
      <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />

      {/* Use ScrollView as the main container for potentially long content */}
      <ScrollView contentContainerStyle={styles.scrollContainer}>

        {/* Section 1: Items Ordered */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items Ordered ({currentOrderData.items?.length || 0})</Text>
          {/* FlatList to render the list of items (scroll disabled as it's inside ScrollView) */}
          <View style={styles.itemsListContainer}>
            <FlatList
                data={currentOrderData.items || []}
                keyExtractor={(itemData, index) => itemData?.id ? `${itemData.id}-${index}` : `item-${index}`} // Robust key
                renderItem={renderOrderItem}
                scrollEnabled={false} // Important inside ScrollView
            />
          </View>
          {/* Order Totals (Subtotal, Grand Total) */}
          <View style={styles.orderTotals}>
            <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal:</Text>
                <Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {(currentOrderData.subtotal || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, styles.grandTotalLabel]}>Grand Total:</Text>
                <Text style={[styles.summaryValue, styles.grandTotalValue]}>{CURRENCY_SYMBOL} {(currentOrderData.grandTotal || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</Text>
            </View>
          </View>
        </View>

        {/* Section 2: Order Summary */}
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
                {/* Status Badge with dynamic styling */}
                <View style={[styles.statusBadge, getStatusStyle(currentOrderData.status)]}>
                    <Text style={styles.statusText}>{currentOrderData.status || 'Unknown'}</Text>
                </View>
            </View>
        </View>

        {/* Section 3: Customer Information */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Information</Text>
            <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Name:</Text>
                <Text style={styles.summaryValue}>{currentOrderData.userName || 'N/A'}</Text>
            </View>
            <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Phone:</Text>
                <Text style={styles.summaryValue}>{currentOrderData.userPhone || 'N/A'}</Text>
            </View>
            {/* Address Row (Modified for inline display) */}
            <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Address:</Text>
                <Text style={[styles.summaryValue, styles.addressValue]}>{currentOrderData.userAddress || 'N/A'}</Text>
            </View>
         </View>

        {/* Section 4: Enhanced Payment Information */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Details</Text>
            {/* Common Payment Info */}
            <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Method:</Text>
                <Text style={styles.summaryValue}>{paymentMethod}</Text>
            </View>
            <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Payment Status:</Text>
                <Text style={[styles.summaryValue, styles.paymentStatusValue]}>{currentOrderData.paymentStatus || 'N/A'}</Text>
            </View>

            {/* Conditionally Render COD Details */}
            {showCodSection && (
                <View style={styles.paymentSubSection}>
                    <Text style={styles.paymentSubHeader}>Cash on Delivery</Text>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Amount Due (COD):</Text>
                        <Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.codAmount || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</Text>
                    </View>
                </View>
            )}

            {/* Conditionally Render Installment Plan Details */}
            {showInstallmentSection && (
                <View style={styles.paymentSubSection}>
                    <Text style={styles.paymentSubHeader}>Installment Plan</Text>
                     {/* Explicitly show bnplAmount */}
                     <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Plan Amount (BNPL):</Text>
                        <Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.bnplAmount || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</Text>
                    </View>
                    {/* Display Plan Specifics if available */}
                    {relevantPlanDetails && (
                        <View style={styles.planDetailsBox}>
                            <Text style={styles.planDetailText}>Plan Name: {relevantPlanDetails.name || 'N/A'}</Text>
                            <Text style={styles.planDetailText}>Duration: {relevantPlanDetails.duration || 'N/A'} Months</Text>
                            <Text style={styles.planDetailText}>Interest: {typeof relevantPlanDetails.interestRate === 'number' ? `${(relevantPlanDetails.interestRate * 100).toFixed(1)}%` : 'N/A'}</Text>
                        </View>
                    )}
                     {/* Show User's Preference for First Installment Payment */}
                    {currentOrderData.firstInstallmentPaymentPreference && (
                         <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>1st Inst. Pref:</Text>
                            <Text style={styles.summaryValue}>{currentOrderData.firstInstallmentPaymentPreference}</Text>
                         </View>
                    )}
                     {/* Link to the schedule section below */}
                     <Text style={styles.linkText}>(See Full Schedule Below)</Text>
                </View>
            )}

            {/* Conditionally Render Fixed Duration Plan Details */}
            {showFixedDurationSection && (
                <View style={styles.paymentSubSection}>
                    <Text style={styles.paymentSubHeader}>Fixed Duration Plan</Text>
                     {/* Explicitly show bnplAmount */}
                     <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Plan Amount:</Text>
                        <Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.bnplAmount || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</Text>
                    </View>
                    {/* Display Plan Specifics if available */}
                     {relevantPlanDetails && (
                        <View style={styles.planDetailsBox}>
                             <Text style={styles.planDetailText}>Plan Name: {relevantPlanDetails.name || 'N/A'}</Text>
                             <Text style={styles.planDetailText}>Duration: {relevantPlanDetails.duration || 'N/A'} Months</Text>
                             <Text style={styles.planDetailText}>Interest: {typeof relevantPlanDetails.interestRate === 'number' ? `${(relevantPlanDetails.interestRate * 100).toFixed(1)}%` : 'N/A'}</Text>
                        </View>
                    )}
                    {/* Display Due Date */}
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Payment Due Date:</Text>
                        <Text style={styles.summaryValue}>{formatShortDate(currentOrderData.paymentDueDate)}</Text>
                    </View>
                     {/* Optional: Show fixedDurationAmountDue if different from bnplAmount */}
                     {typeof currentOrderData.fixedDurationAmountDue === 'number' && currentOrderData.fixedDurationAmountDue !== currentOrderData.bnplAmount && (
                         <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Specific Amt Due:</Text>
                            <Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {currentOrderData.fixedDurationAmountDue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                        </View>
                     )}
                    {/* Display Penalty if applied */}
                    {typeof currentOrderData.penalty === 'number' && currentOrderData.penalty > 0 && (
                        <View style={styles.summaryRow}>
                            <Text style={[styles.summaryLabel, styles.penaltyLabel]}>Penalty Applied:</Text>
                            <Text style={[styles.summaryValue, styles.penaltyValue]}>{CURRENCY_SYMBOL}{currentOrderData.penalty.toFixed(2)}</Text>
                        </View>
                     )}
                </View>
            )}
        </View>


        {/* Section 5: BNPL Installment Schedule (Conditional) */}
        {/* Show this section only if it's an installment plan and has installments */}
        {showInstallmentSection && currentOrderData.installments?.length > 0 && (
             <View style={styles.section}>
                 <Text style={styles.sectionTitle}>Installment Schedule</Text>
                 {/* FlatList to render the installments */}
                 <FlatList
                    data={currentOrderData.installments}
                    keyExtractor={(inst, index) => inst?.installmentNumber ? `inst-${inst.installmentNumber}-${index}` : `inst-fallback-${index}`} // Robust key
                    renderItem={renderInstallment}
                    scrollEnabled={false} // Important inside ScrollView
                />
            </View>
        )}

         {/* Action Button: Mark as Shipped (Conditional) */}
         {/* Show button only if the order status allows shipping */}
         {canMarkAsShipped && (
             <TouchableOpacity
                style={[styles.actionButton, isUpdatingStatus && styles.disabledButton]} // Apply disabled style when updating
                onPress={handleMarkAsShipped}
                disabled={isUpdatingStatus} // Disable button during update
                activeOpacity={0.7}
            >
                 {/* Show ActivityIndicator or Text based on loading state */}
                 {isUpdatingStatus ? (
                     <ActivityIndicator color="#FFF" size="small" />
                 ) : (
                     <Text style={styles.actionButtonText}>Mark as Shipped & Notify</Text>
                 )}
             </TouchableOpacity>
         )}

      </ScrollView>
    </SafeAreaView>
  );
};

// --- Styles ---
// StyleSheet definition - no changes from the previous version
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ScreenBackgroundColor, },
  scrollContainer: { flexGrow: 1, padding: 15, paddingBottom: 40, paddingTop: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, color: AccentColor, marginBottom: 15, textAlign: 'center' },
  errorLink: { fontSize: 16, color: '#007AFF', fontWeight: 'bold' },
  section: { backgroundColor: AppBackgroundColor, borderRadius: 8, padding: 15, marginBottom: 15, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1.5, borderWidth: 1, borderColor: LightBorderColor, },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: LightBorderColor, paddingBottom: 8, },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'nowrap' },
  summaryLabel: { fontSize: 14, color: TextColorSecondary, marginRight: 8, lineHeight: 20 },
  summaryValue: { fontSize: 14, fontWeight: '500', color: TextColorPrimary, textAlign: 'right', flex: 1, lineHeight: 20 },
  addressValue: { textAlign: 'right', },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, marginLeft: 8 },
  statusText: { fontSize: 12, fontWeight: 'bold', color: '#fff', },
  statusPending: { backgroundColor: '#FFA726' }, statusProcessing: { backgroundColor: '#42A5F5' }, statusShipped: { backgroundColor: '#66BB6A' }, statusDelivered: { backgroundColor: '#78909C' }, statusCancelled: { backgroundColor: '#EF5350' }, statusUnknown: { backgroundColor: '#BDBDBD' },
  paymentStatusValue: { fontWeight: 'bold' },
  paymentSubSection: { marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0', },
  paymentSubHeader: { fontSize: 15, fontWeight: '600', color: TextColorPrimary, marginBottom: 10, },
  paymentValueHighlight: { fontSize: 15, fontWeight: 'bold', color: '#000000', textAlign: 'right', flex: 1, },
  planDetailsBox: { marginTop: 8, marginBottom: 8, padding: 10, backgroundColor: '#f9f9f9', borderRadius: 6, borderWidth: 1, borderColor: '#eee', },
  planDetailText: { fontSize: 13, color: TextColorSecondary, marginBottom: 4, lineHeight: 18, },
  linkText: { fontSize: 12, color: '#007AFF', fontStyle: 'italic', textAlign: 'right', marginTop: 5, },
  penaltyLabel: { color: AccentColor, },
  penaltyValue: { color: AccentColor, fontWeight: 'bold', textAlign: 'right', flex: 1, },
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
  actionButton: { backgroundColor: '#42A5F5', paddingVertical: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 20, marginHorizontal: 10, marginBottom: 10, elevation: 3, minHeight: 48, },
  disabledButton: { backgroundColor: '#BDBDBD', elevation: 0, },
  actionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', },
});