// UserOrderDetailScreen.js (COMPLETE CODE - Incorporating All Features & Fixes)
// Includes: Real-time order updates, review submission (per unique product),
// review status checking, admin notification on review submission (corrected logic),
// AND display change from "BNPL" to "Installment".

import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet, Text, View, ScrollView, Image,
    TouchableOpacity, SafeAreaView, Platform, ActivityIndicator, FlatList,
    Alert,
    ToastAndroid,
    StatusBar
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons as IconMUI } from '@expo/vector-icons';
import {
    getFirestore, doc, onSnapshot, Timestamp,
    collection, query, where, getDocs // Ensure getDocs is imported
} from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Verify path, adjust if necessary
import { format, isValid } from 'date-fns';
import ReviewForm from './../../Components/ReviewForm'; // Verify path, adjust if necessary
import axios from 'axios'; // For sending notifications

// --- Constants ---
// UI Colors
const AppBackgroundColor = '#FFFFFF';
const ScreenBackgroundColor = '#F8F9FA';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const AccentColor = '#FF0000'; // Used for errors, potentially highlights
const SuccessColor = '#4CAF50'; // Used for success states, paid status
const ActiveStatusColor = '#29B6F6';
const PendingStatusColor = '#FFA726'; // Orange for pending
const LightBorderColor = '#E5E7EB'; // Subtle borders
const PlaceholderBgColor = '#F0F0F0'; // Image placeholder background

// Data & Logic Constants
const CURRENCY_SYMBOL = 'PKR';
const placeholderImagePath = require('../../assets/p3.jpg'); // **** ADJUST PATH IF NEEDED ****
const ORDERS_COLLECTION = 'orders';
const REVIEWS_COLLECTION = 'Reviews';
const ADMIN_COLLECTION = 'Admin'; // Collection where admin users (with role='admin') are stored
const USERS_COLLECTION = 'Users'; // General users collection
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send"; // Expo API

// Status Constants (Ensure these match Firestore values)
const SHIPPED_STATUS = 'Shipped';
const ACTIVE_STATUS = 'Active'; // Example if you have an 'Active' BNPL status
const PAID_STATUS = 'Paid';
const PENDING_STATUS = 'Pending'; // Default/Initial status for many things
const PARTIALLY_PAID_STATUS = 'Partially Paid';
const COMPLETED_ORDER_STATUS = 'Delivered'; // Status required to show review forms
const CANCELLED_STATUS = 'Cancelled'; // Example
const REJECTED_STATUS = 'Rejected'; // Example

// Payment Method Constants (Ensure these match Firestore values)
const COD_METHOD = 'COD';
const BNPL_METHOD = 'BNPL'; // Keep the constant as BNPL for logic, but display "Installment"
const FIXED_DURATION_METHOD = 'Fixed Duration';
const MIXED_METHOD = 'Mixed';

// --- Helper Functions ---

/**
 * Formats a Firestore Timestamp or JS Date into 'MMM d, yyyy, h:mm a'
 */
const formatDate = (timestamp) => {
    let dateToFormat = null;
    if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); }
    else if (timestamp instanceof Date) { dateToFormat = timestamp; }
    // Handle cases where timestamp might be an object with toDate but not a Timestamp instance
    else if (timestamp && typeof timestamp.toDate === 'function') {
        try { dateToFormat = timestamp.toDate(); } catch (e) { console.warn("toDate conversion failed", e); }
    }

    if (dateToFormat && isValid(dateToFormat)) {
        try { return format(dateToFormat, 'MMM d, yyyy, h:mm a'); }
        catch (e) { console.error("[formatDate] Error formatting:", e); return 'Invalid Date'; }
    }
    return 'N/A';
};

/**
 * Formats a Firestore Timestamp or JS Date into 'MMM d, yyyy'
 */
const formatShortDate = (timestamp) => {
     let dateToFormat = null;
     if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); }
     else if (timestamp instanceof Date) { dateToFormat = timestamp; }
     else if (timestamp && typeof timestamp.toDate === 'function') {
        try { dateToFormat = timestamp.toDate(); } catch (e) { console.warn("toDate conversion failed (short)", e); }
    }

     if (dateToFormat && isValid(dateToFormat)) {
         try { return format(dateToFormat, 'MMM d, yyyy'); }
        catch (e) { console.error("[formatShortDate] Error formatting:", e); return 'Invalid Date'; }
     }
     return 'N/A';
};

/**
 * Returns appropriate style object for OVERALL order/payment status badges.
 */
const getStatusStyle = (status) => {
     const lowerStatus = status?.toLowerCase() || 'unknown';
     // Map various potential status strings to badge styles
     switch (lowerStatus) {
          case 'pending':
          case 'unpaid (cod)':
          case 'unpaid (fixed duration)':
          case 'unpaid (bnpl)': // Keep checking for the underlying status string if it exists
          case 'unpaid (installment)': // Add this if your data might actually contain 'Installment'
              return styles.statusPending; // Use Orange
          case 'processing': // Example status
              return styles.statusProcessing; // Blue
          case PARTIALLY_PAID_STATUS.toLowerCase():
              return styles.statusProcessing; // Blue for partially paid too
          case SHIPPED_STATUS.toLowerCase():
              return styles.statusShipped; // Greenish
          case ACTIVE_STATUS.toLowerCase():
              return styles.statusActive; // Light Blue
          case COMPLETED_ORDER_STATUS.toLowerCase(): // Treat 'Delivered' as completed
              return styles.statusDelivered; // Gray-Blue
          case CANCELLED_STATUS.toLowerCase():
          case REJECTED_STATUS.toLowerCase():
              return styles.statusCancelled; // Red
          case PAID_STATUS.toLowerCase():
                return styles.statusPaidBadge; // Use specific Green for Paid
          default:
              return styles.statusUnknown; // Gray
      }
};

/**
 * Returns appropriate style object for INDIVIDUAL installment status badges.
 */
const getInstallmentStatusStyle = (status) => {
    // Simple check: Paid (Green) or Pending (Orange)
    return (status?.toLowerCase() === PAID_STATUS.toLowerCase())
        ? styles.statusPaid // Use Green
        : styles.statusInstallmentPending; // Use Orange
};


/**
 * Fetches Expo Push Tokens for all users marked as admins in the ADMIN_COLLECTION.
 * Assumes admin users have role == "admin" in their document.
 * (Aligned with SchedulesDetailScreen.js logic)
 * @returns {Promise<string[]>} A promise that resolves to an array of valid Expo push tokens.
 */
async function getAdminExpoTokens() {
    const adminTokens = [];
    try {
        // Query the ADMIN_COLLECTION for role == "admin"
        const q = query(collection(db, ADMIN_COLLECTION), where("role", "==", "admin"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.log(`[getAdminExpoTokens] No admin users found with role='admin' in the '${ADMIN_COLLECTION}' collection.`);
            return [];
        }

        querySnapshot.forEach((doc) => {
            const adminData = doc.data();
            const token = adminData?.expoPushToken;
            // Basic validation for Expo token format
            if (token && typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))) {
                adminTokens.push(token);
                // console.log(`[getAdminExpoTokens] Found valid token for admin: ${doc.id}`); // Optional: reduce logging
            } else {
                 console.log(`[getAdminExpoTokens] Invalid or missing token for admin ${doc.id}. Token value:`, token);
            }
        });

        console.log(`[getAdminExpoTokens] Found ${adminTokens.length} valid admin tokens.`);
        return adminTokens;

    } catch (error) {
        console.error("[getAdminExpoTokens] Error fetching admin tokens:", error);
        return []; // Return empty array on error
    }
}

/**
 * Sends push notifications via the Expo Push API.
 * @param {string[]} pushTokens - Array of recipient Expo Push Tokens.
 * @param {string} title - The notification title.
 * @param {string} body - The notification body.
 * @param {object} [data={}] - Optional data payload.
 */
async function sendExpoPushNotification(pushTokens, title, body, data = {}) {
    if (!Array.isArray(pushTokens) || pushTokens.length === 0) {
        console.log("[sendExpoPushNotification] Skipping notification: No push tokens provided.");
        return;
    }

    // Filter out invalid tokens immediately (basic check)
    const validTokens = pushTokens.filter(token =>
        token && typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))
    );

    if (validTokens.length === 0) {
        console.log("[sendExpoPushNotification] Skipping notification: No valid push tokens after filtering.");
        return;
    }

    // Construct messages for Expo's batch endpoint
    const messages = validTokens.map(token => ({
        to: token,
        sound: 'default',
        title: title,
        body: body,
        data: data,
        priority: 'normal', // 'high' for important alerts
        channelId: 'admin-notifications', // Use a specific channel for admin alerts on Android
    }));

    console.log(`[sendExpoPushNotification] Sending ${messages.length} push notification(s)...`);

    try {
        // Use Expo's batch endpoint
        await axios.post(EXPO_PUSH_ENDPOINT, messages, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Accept-encoding': 'gzip, deflate', // Recommended by Expo
            },
            timeout: 15000, // Slightly longer timeout for batch requests
        });
        console.log("[sendExpoPushNotification] Push notifications sent successfully via Expo API.");
    } catch (error) {
        console.error("[sendExpoPushNotification] Error sending push notifications via Expo API:", error.response?.data || error.message || error);
        // Consider logging specific error details if available, e.g., error.response.data.errors
    }
}

// --- Main Component ---
export default function UserOrderDetailScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const initialOrder = route.params?.order; // Get initial order data passed via navigation
    const orderId = initialOrder?.id; // Extract Order ID

    // --- State ---
    const [currentOrderData, setCurrentOrderData] = useState(initialOrder); // Holds the latest order details
    const [loadingOrder, setLoadingOrder] = useState(!initialOrder); // Loading state for initial fetch/listener setup
    const [orderError, setOrderError] = useState(null); // Stores errors related to fetching order data

    const [reviewedProductIds, setReviewedProductIds] = useState(new Set()); // Stores IDs of products already reviewed for this order
    const [loadingReviews, setLoadingReviews] = useState(true); // Loading state for fetching review status
    const [reviewError, setReviewError] = useState(null); // Stores errors related to fetching review status

    // --- Derived State ---
    const reviewerId = currentOrderData?.userId; // User ID of the person who placed the order
    const reviewerName = currentOrderData?.userName || 'A user'; // User name for notifications

    // --- Effects ---

    // Effect 1: Real-time Listener for Order Details
    useEffect(() => {
        // Ensure we have an Order ID to listen to
        if (!orderId) {
            setOrderError("Order details could not be loaded (No ID provided).");
            setLoadingOrder(false);
            setCurrentOrderData(null); // Clear stale data if any
            return; // Stop the effect
        }

        // Reset state for new listener setup
        setOrderError(null);
        setLoadingOrder(true);

        // Create reference to the specific order document in Firestore
        const orderRef = doc(db, ORDERS_COLLECTION, orderId);

        // Set up the real-time listener
        const unsubscribe = onSnapshot(orderRef,
            (docSnap) => { // Success callback
                if (docSnap.exists()) {
                    // Document found, update state with latest data
                    setCurrentOrderData({ id: docSnap.id, ...docSnap.data() });
                    setOrderError(null); // Clear any previous error
                } else {
                    // Document doesn't exist (might have been deleted)
                    console.warn(`[UserOrderDetailScreen] Order ${orderId} not found in Firestore.`);
                    setOrderError("Order not found. It might have been deleted.");
                    setCurrentOrderData(null); // Clear data
                }
                setLoadingOrder(false); // Data loaded or confirmed not found
            },
            (err) => { // Error callback
                console.error(`[UserOrderDetailScreen] Listener error for order ${orderId}:`, err);
                setOrderError("Failed to load real-time order details. Check connection.");
                // Optionally keep potentially stale data: setCurrentOrderData(null);
                setLoadingOrder(false); // Stop loading on error
            }
        );

        // Cleanup function: Unsubscribe from the listener when the component unmounts
        // or when the orderId changes (triggering the effect to re-run)
        return () => unsubscribe();

    }, [orderId]); // Dependency: Re-run effect only if the orderId changes

    // Effect 2: Fetch IDs of Products Already Reviewed for this Order
    useEffect(() => {
        // Need orderId and reviewerId to query reviews specific to this user/order
        if (!orderId || !reviewerId) {
            setLoadingReviews(false); // Can't fetch without IDs
            return;
        }

        // Reset review loading state
        setLoadingReviews(true);
        setReviewError(null);
        const reviewedIds = new Set(); // Use a Set for efficient checking later

        // Construct the Firestore query
        const reviewsQuery = query(
            collection(db, REVIEWS_COLLECTION),
            where("orderId", "==", orderId), // Match reviews for this specific order
            where("userId", "==", reviewerId) // Match reviews by this specific user
        );

        // Execute the query
        getDocs(reviewsQuery)
            .then((querySnapshot) => {
                // Process the results
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.productId) { // If the review doc has a productId...
                        reviewedIds.add(data.productId); // ...add it to our set
                    }
                });
                setReviewedProductIds(reviewedIds); // Update state with the set of reviewed IDs
            })
            .catch((err) => {
                // Handle errors during fetching
                console.error(`Error fetching reviewed product IDs for order ${orderId}:`, err);
                setReviewError("Could not load previous review information.");
                setReviewedProductIds(new Set()); // Reset to empty set on error
            })
            .finally(() => {
                // Always set loading to false when done (success or error)
                setLoadingReviews(false);
            });

    }, [orderId, reviewerId]); // Dependencies: Re-fetch if orderId or reviewerId changes

    // --- Callbacks ---

    /**
     * Callback function passed to ReviewForm. Triggered on successful review submission.
     * Updates local state and sends notification to admins.
     */
    const handleReviewSuccess = useCallback(async (submittedProductId) => {
        console.log(`Review success callback invoked for Product ID: ${submittedProductId} in Order: ${orderId}`);

        // 1. Update Local UI State Immediately (Optimistic Update)
        // Add the newly reviewed product ID to the set so its form disappears
        setReviewedProductIds(prevIds => new Set(prevIds).add(submittedProductId));

        // 2. Show User Confirmation Message
        if (Platform.OS === 'android') {
            ToastAndroid.show('Thanks for your review!', ToastAndroid.SHORT);
        } else {
            Alert.alert("Review Submitted", "Thanks for your feedback!");
        }

        // 3. Prepare and Send Admin Notification (Best Effort - should not block UI)
        try {
            // Ensure necessary data is available
            if (!currentOrderData || !currentOrderData.items) {
                console.warn("[handleReviewSuccess] Cannot send notification: currentOrderData or items missing.");
                return;
            }

            // Find the product details for the notification message
            const reviewedItem = currentOrderData.items.find(item => (item.productId || item.id) === submittedProductId);
            const productName = reviewedItem?.name || 'Unknown Product';
            // Create a display-friendly order identifier
            const orderDisplayId = currentOrderData.orderNumber ? `#${currentOrderData.orderNumber}` : `ID...${currentOrderData.id.slice(-6)}`;

            // Construct notification content
            const notificationTitle = `New Review Submitted!`;
            const notificationBody = `${reviewerName} reviewed "${productName}" from Order ${orderDisplayId}.`;
            const notificationData = { // Optional data payload for admin app navigation/handling
                orderId: currentOrderData.id,
                productId: submittedProductId,
                type: 'new_review' // Identifier for this type of notification
            };

            // Fetch admin tokens using the corrected helper function
            const adminTokens = await getAdminExpoTokens();

            if (adminTokens.length > 0) {
                // Send notifications if tokens were found
                await sendExpoPushNotification(
                    adminTokens,
                    notificationTitle,
                    notificationBody,
                    notificationData
                );
                console.log("[handleReviewSuccess] Admin review notifications dispatched.");
            } else {
                // Log if no admins were found to notify (could be expected)
                console.log("[handleReviewSuccess] No admin tokens found to send review notification.");
            }
        } catch (error) {
            // Log errors during notification process but don't crash the user experience
            console.error("[handleReviewSuccess] Failed to send admin notification:", error);
        }

    }, [currentOrderData, orderId, reviewerName]); // Dependencies for useCallback

    // --- Render Functions ---

    /**
     * Renders a single item row within the "Items Ordered" FlatList.
     */
    const renderOrderItem = ({ item, index }) => {
        // Basic validation for essential item data
        if (!item || typeof item.price !== 'number' || typeof item.quantity !== 'number') {
            console.warn("Skipping renderOrderItem due to missing/invalid data:", item);
            return null; // Don't render incomplete items
        }
        const itemsArray = currentOrderData?.items || []; // Get items for checking last item
        const itemTotal = (item.price || 0) * (item.quantity || 1);

        // Determine how to display the payment method for this specific item (if applicable)
        const itemPaymentMethod = item.paymentMethod || 'N/A'; // Get method if stored per item
        let paymentDisplay = itemPaymentMethod;

        // *** CHANGE: Display "Installment Plan" instead of "BNPL Plan" as fallback ***
        if (itemPaymentMethod === BNPL_METHOD && item.bnplPlan) { // If BNPL and plan info exists
             paymentDisplay = item.bnplPlan.name || 'Installment Plan'; // Use plan name or default "Installment Plan"
        } else if (itemPaymentMethod === FIXED_DURATION_METHOD && item.bnplPlan) { // Also check bnplPlan for Fixed? (Adjust if needed)
             paymentDisplay = item.bnplPlan?.name || FIXED_DURATION_METHOD;
        }
        // Ensure a unique identifier for the keyExtractor
        const productIdentifier = item.productId || item.id; // Prefer productId, fallback to item.id (if unique)
        if (!productIdentifier) {
             console.warn("Skipping renderOrderItem because productIdentifier (productId or id) is missing:", item);
             return null; // Cannot render without a key
        }

        // *** CHANGE: Conditionally display "Installment" instead of "BNPL" for item method ***
        const displayMethodText = paymentDisplay === BNPL_METHOD ? 'Installment' : paymentDisplay;

        // JSX for the item row
        return (
            <View style={[styles.itemContainer, index === itemsArray.length - 1 && styles.lastItemContainer]}>
                {/* Product Image */}
                <Image
                    source={item.image ? { uri: item.image } : placeholderImagePath}
                    style={styles.itemImage}
                    defaultSource={placeholderImagePath} // Show placeholder while loading/if no image
                />
                {/* Product Details */}
                <View style={styles.itemDetails}>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name || 'N/A'}</Text>
                    <Text style={styles.itemQtyPrice}>Qty: {item.quantity || 1}</Text>
                    <Text style={styles.itemPrice}>{CURRENCY_SYMBOL} {(item.price || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                    {/* Conditionally show item payment method if it's different from COD or known */}
                    {/* *** CHANGE: Use displayMethodText which handles BNPL -> Installment *** */}
                    {displayMethodText !== COD_METHOD && displayMethodText !== 'N/A' && (
                        <Text style={styles.itemPaymentMethod}>Method: {displayMethodText}</Text>
                    )}
                </View>
                {/* Item Total Price */}
                <Text style={styles.itemTotalValue}>{CURRENCY_SYMBOL} {itemTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
            </View>
        );
    };

    /**
     * Renders a single installment row within the "Installment Schedule" FlatList.
     */
    const renderInstallment = ({ item }) => {
        // Basic validation
        if (!item || typeof item.amount !== 'number') {
             console.warn("Skipping renderInstallment due to missing/invalid data:", item);
             return null;
        }
        // Determine status and if paid
        const installmentStatus = item.status || PENDING_STATUS; // Default to Pending
        const isPaid = installmentStatus.toLowerCase() === PAID_STATUS.toLowerCase();
        const paidDate = item.paidAt; // Get paid date if available

        // JSX for the installment row
        return (
            <View style={styles.installmentRow}>
                {/* Left side: Inst#, Amount */}
                <View style={styles.installmentLeft}>
                     <Text style={styles.installmentText}>Inst. #{item.installmentNumber || 'N/A'}</Text>
                     <Text style={styles.installmentAmount}>{CURRENCY_SYMBOL} {item.amount?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 'N/A'}</Text>
                </View>
                 {/* Right side: Due Date, Status, Paid Date, Penalty */}
                 <View style={styles.installmentRight}>
                    <Text style={styles.installmentDueDate}>Due: {formatShortDate(item.dueDate)}</Text>
                    {/* Status Badge */}
                    <View style={[styles.statusBadgeSmall, getInstallmentStatusStyle(installmentStatus)]}>
                        <Text style={styles.statusTextSmall}>{installmentStatus}</Text>
                    </View>
                    {/* Paid Date (only if paid and date is valid) */}
                    {isPaid && paidDate && (
                        <Text style={styles.paidAtText}>Paid: {formatShortDate(paidDate)}</Text>
                    )}
                    {/* Penalty (only if exists and > 0) */}
                    {typeof item.penalty === 'number' && item.penalty > 0 && (
                         <Text style={styles.penaltyText}>Penalty: {CURRENCY_SYMBOL}{item.penalty.toFixed(0)}</Text> // Use 0 decimal places for PKR
                    )}
                 </View>
            </View>
        );
    };

    // --- Loading / Error Screens ---
    // Show loading indicator while order data is being fetched initially
    if (loadingOrder) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={AccentColor} />
                    <Text style={styles.loadingText}>Loading Order Details...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Show error message if fetching failed or order not found
    if (orderError || !currentOrderData) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
                <View style={styles.loadingContainer}>
                    <Text style={styles.errorText}>{orderError || "Order details could not be loaded or the order does not exist."}</Text>
                    {/* Allow user to navigate back if possible */}
                    {navigation.canGoBack() && (
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Text style={styles.backButtonText}>Go Back</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </SafeAreaView>
        );
    }

    // --- Derived Values for Rendering ---
    // Calculate these values based on the currentOrderData state before rendering the main JSX
    const paymentMethod = currentOrderData.paymentMethod || 'Unknown';
    const relevantPlanDetails = currentOrderData.bnplPlanDetails || currentOrderData.fixedDurationDetails; // Get plan details if available
    // Determine if plan is specifically installment type (using the BNPL_METHOD constant for logic)
    const isRelevantPlanInstallment = relevantPlanDetails?.planType === 'Installment' || paymentMethod === BNPL_METHOD;
    // Flags to conditionally show payment breakdown sections
    const showCodSection = (paymentMethod === COD_METHOD || paymentMethod === MIXED_METHOD) && typeof currentOrderData.codAmount === 'number' && currentOrderData.codAmount > 0;
    // Show installment section if method is BNPL (logic constant) or Mixed AND installments array exists
    const showInstallmentSection = (paymentMethod === BNPL_METHOD || paymentMethod === MIXED_METHOD) && Array.isArray(currentOrderData.installments) && currentOrderData.installments.length > 0;
    const showFixedDurationSection = (paymentMethod === FIXED_DURATION_METHOD) || (paymentMethod === MIXED_METHOD && (!!currentOrderData?.paymentDueDate || !!currentOrderData?.fixedDurationDetails));

    // Flag to determine if the review section should be shown
    const isOrderComplete = currentOrderData.status === COMPLETED_ORDER_STATUS;

    // Logic for handling unique product reviews
    const allProductIdsInOrder = (currentOrderData.items || [])
        .map(item => item.productId || item.id) // Get product identifier
        .filter(id => !!id); // Filter out any null/undefined IDs
    const uniqueProductIdsInOrder = [...new Set(allProductIdsInOrder)]; // Get only unique IDs

    // Determine which unique products *still need* a review
    const uniqueProductIdsToReview = isOrderComplete && !loadingReviews && !reviewError
        ? uniqueProductIdsInOrder.filter(productId => !reviewedProductIds.has(productId)) // Filter out already reviewed IDs
        : []; // Don't show review forms if order not complete or reviews loading/error

    // Determine if all unique products *have* been reviewed (for showing completion message)
    const allUniqueProductsReviewed = isOrderComplete &&
                                    !loadingReviews &&
                                    !reviewError &&
                                    uniqueProductIdsInOrder.length > 0 && // Must have products in the order
                                    uniqueProductIdsToReview.length === 0; // And none left to review

    // *** CHANGE: Determine the display text for the payment method ***
    const paymentMethodDisplayText = paymentMethod === BNPL_METHOD ? 'Installment' : paymentMethod;


    // --- Main Render ---
    // REMINDER: Ensure ALL text, even conditional text or variables, is inside <Text> tags.
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
            {/* Use ScrollView for content that might exceed screen height */}
            {/* keyboardShouldPersistTaps helps with input fields inside scroll views (like in ReviewForm) */}
            <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">

                {/* Section 1: Items Ordered */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Items Ordered ({currentOrderData.items?.length || 0})</Text>
                     <View style={styles.itemsListContainer}>
                        {/* Use FlatList for efficient rendering of potentially long item lists */}
                        <FlatList
                             data={currentOrderData.items || []}
                             renderItem={renderOrderItem} // Function to render each item
                             keyExtractor={(itemData, index) => `${itemData?.productId || itemData?.id || 'item'}-${index}`} // Unique key for each row
                             scrollEnabled={false} // Disable FlatList scrolling inside ScrollView
                             ListEmptyComponent={<Text style={styles.emptyListText}>No items found in this order.</Text>} // Message if items array is empty
                        />
                    </View>
                    {/* Order Totals Area */}
                    <View style={styles.orderTotals}>
                         {/* Subtotal */}
                         <View style={styles.summaryRow}>
                             <Text style={styles.summaryLabel}>Subtotal:</Text>
                             <Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {(currentOrderData.subtotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                         </View>
                         {/* Delivery Fee (Conditional) */}
                         {typeof currentOrderData.deliveryFee === 'number' && currentOrderData.deliveryFee > 0 && (
                             <View style={styles.summaryRow}>
                                 <Text style={styles.summaryLabel}>Delivery Fee:</Text>
                                 <Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {currentOrderData.deliveryFee.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                             </View>
                         )}
                         {/* Divider */}
                         <View style={styles.totalDivider} />
                         {/* Grand Total */}
                         <View style={styles.summaryRow}>
                             <Text style={[styles.summaryLabel, styles.grandTotalLabel]}>Grand Total:</Text>
                             <Text style={[styles.summaryValue, styles.grandTotalValue]}>{CURRENCY_SYMBOL} {(currentOrderData.grandTotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                         </View>
                    </View>
                </View>

                {/* Section 2: Order Summary */}
                 <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Order Summary</Text>
                    <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Order ID:</Text><Text style={styles.summaryValue}>#{currentOrderData.orderNumber || currentOrderData.id?.substring(0, 8).toUpperCase() || 'N/A'}</Text></View>
                    <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Order Date:</Text><Text style={styles.summaryValue}>{formatDate(currentOrderData.createdAt || currentOrderData.orderDate)}</Text></View>
                    {/* Order Status Badge */}
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Status:</Text>
                        <View style={[styles.statusBadge, getStatusStyle(currentOrderData.status)]}>
                            <Text style={styles.statusText}>{currentOrderData.status || 'Unknown'}</Text>
                        </View>
                    </View>
                    {/* Delivery OTP (Conditional) */}
                    {currentOrderData.status === SHIPPED_STATUS && currentOrderData.deliveryOtp && (
                        <View style={styles.otpDisplayRow}>
                            <IconMUI name="vpn-key" size={16} color={SuccessColor} style={styles.otpIcon} />
                            <Text style={styles.otpDisplayLabel}>Delivery OTP:</Text>
                            <Text style={styles.otpDisplayValue}>{currentOrderData.deliveryOtp}</Text>
                        </View>
                    )}
                </View>

                {/* Section 3: Delivery Information */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Delivery Address</Text>
                    {/* Ensure all pieces of address info are within <Text> */}
                    <Text style={styles.detailText}>{currentOrderData.userName || 'N/A'}</Text>
                    <Text style={styles.detailText}>{currentOrderData.userAddress || 'N/A'}</Text>
                    <Text style={styles.detailText}>{currentOrderData.userPhone || 'N/A'}</Text>
                </View>

                {/* Section 4: Payment Information */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment Details</Text>
                    {/* Overall Payment Method and Status */}
                    {/* *** CHANGE: Use paymentMethodDisplayText *** */}
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Method:</Text>
                        <Text style={styles.summaryValue}>{paymentMethodDisplayText}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Payment Status:</Text>
                        <View style={[styles.statusBadge, getStatusStyle(currentOrderData.paymentStatus)]}>
                            <Text style={styles.statusText}>{currentOrderData.paymentStatus || 'N/A'}</Text>
                        </View>
                    </View>

                    {/* Conditional Subsections for different payment types */}
                    {/* COD Subsection */}
                    {showCodSection && (
                        <View style={styles.paymentSubSection}>
                            <Text style={styles.paymentSubHeader}>Cash on Delivery</Text>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Amount Due (COD):</Text>
                                <Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.codAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                            </View>
                            {/* Show paid date if COD payment received */}
                            {currentOrderData.codPaymentReceivedAt && (
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>COD Paid At:</Text>
                                    <Text style={styles.summaryValue}>{formatDate(currentOrderData.codPaymentReceivedAt)}</Text>
                                </View>
                            )}
                        </View>
                    )}
                    {/* Installment Subsection */}
                    {/* Logic check (showInstallmentSection) still uses BNPL_METHOD */}
                    {showInstallmentSection && (
                        <View style={styles.paymentSubSection}>
                             {/* *** CHANGE: Display "Installment" in header *** */}
                            <Text style={styles.paymentSubHeader}>Installment Plan Details</Text>
                            <View style={styles.summaryRow}>
                                {/* *** CHANGE: Display "Installment" in label *** */}
                                <Text style={styles.summaryLabel}>Plan Amount (Installment):</Text>
                                {/* Value still uses bnplAmount field */}
                                <Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.bnplAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                            </View>
                            {/* Display Plan Details if available (using relevantPlanDetails which checks bnplPlanDetails) */}
                            {relevantPlanDetails && (
                                <View style={styles.planDetailsBox}>
                                    <Text style={styles.planDetailTitle}>Plan: {relevantPlanDetails.name || 'N/A'}</Text>
                                    <Text style={styles.planDetailText}>Duration: {relevantPlanDetails.duration || 'N/A'} Months</Text>
                                    {/* Conditionally show interest rate */}
                                    {typeof relevantPlanDetails.interestRate === 'number' && (
                                        <Text style={styles.planDetailText}>Interest: {(relevantPlanDetails.interestRate * 100).toFixed(1)}%</Text>
                                    )}
                                </View>
                            )}
                            {/* Link to full schedule if installments exist */}
                            {(currentOrderData.installments?.length > 0) && (
                                <Text style={styles.linkText}>(See Full Schedule Below)</Text>
                            )}
                        </View>
                     )}
                     {/* Fixed Duration Subsection */}
                    {showFixedDurationSection && (
                        <View style={styles.paymentSubSection}>
                            <Text style={styles.paymentSubHeader}>Fixed Duration Plan Details</Text>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Plan Amount:</Text>
                                {/* Using ?? to fallback from fixedDurationAmountDue to bnplAmount if needed */}
                                <Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.fixedDurationAmountDue ?? currentOrderData.bnplAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                            </View>
                            {/* Display Plan Details if available */}
                            <View style={styles.planDetailsBox}>
                                {relevantPlanDetails && <Text style={styles.planDetailTitle}>Plan: {relevantPlanDetails.name || 'Fixed Plan'}</Text>}
                                {relevantPlanDetails?.duration && <Text style={styles.planDetailText}>Duration: {relevantPlanDetails.duration} Months</Text>}
                                {typeof relevantPlanDetails?.interestRate === 'number' && (
                                    <Text style={styles.planDetailText}>Interest: {(relevantPlanDetails.interestRate * 100).toFixed(1)}%</Text>
                                )}
                                <Text style={styles.planDetailText}>Payment Due: {formatShortDate(currentOrderData.paymentDueDate)}</Text>
                                {/* Show penalty if applied */}
                                {typeof currentOrderData.penalty === 'number' && currentOrderData.penalty > 0 && (
                                    <Text style={[styles.planDetailText, styles.penaltyText]}>Penalty Applied: {CURRENCY_SYMBOL}{currentOrderData.penalty.toFixed(0)}</Text> // Use 0 decimals
                                )}
                            </View>
                        </View>
                     )}
                 </View>

                {/* Section 5: Installment Schedule (Conditional) */}
                {/* Logic check (showInstallmentSection) still uses BNPL_METHOD */}
                {showInstallmentSection && currentOrderData.installments && currentOrderData.installments.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Installment Schedule</Text>
                        {/* FlatList to render the installments */}
                        <FlatList
                            data={currentOrderData.installments}
                            keyExtractor={(inst, index) => inst?.installmentNumber ? `inst-${inst.installmentNumber}-${index}` : `inst-fallback-${index}`} // Unique key
                            renderItem={renderInstallment} // Function to render each row
                            scrollEnabled={false} // Disable scrolling inside ScrollView
                            ListEmptyComponent={<Text style={styles.emptyListText}>No installment data found.</Text>} // Message if empty
                        />
                    </View>
                )}

                {/* Section 6: Review Section (Conditional based on order status) */}
                {isOrderComplete && (
                    <View style={styles.section}>
                        {/* Handle Loading and Error states for fetching review status */}
                        {loadingReviews && (
                            <View style={styles.reviewLoadingContainer}>
                                <ActivityIndicator color={AccentColor} size="small"/>
                                <Text style={styles.reviewStatusText}>Loading review status...</Text>
                            </View>
                        )}
                        {!loadingReviews && reviewError && (
                            <View style={styles.reviewErrorContainer}>
                                {/* Ensure error message is wrapped in Text */}
                                <Text style={styles.errorText}>{reviewError}</Text>
                            </View>
                        )}

                        {/* Only proceed if review status is loaded without errors */}
                        {!loadingReviews && !reviewError && (
                            <>
                                {/* Case 1: There are unique products left to review */}
                                {uniqueProductIdsToReview.length > 0 && (
                                    <>
                                        {/* Ensure dynamic count is wrapped in Text */}
                                        <Text style={styles.sectionTitle}>Leave Reviews ({uniqueProductIdsToReview.length} remaining)</Text>
                                        {/* Map over the products needing review */}
                                        {uniqueProductIdsToReview.map((productId, index) => {
                                            // Find the item data to display image/name
                                            const itemData = (currentOrderData.items || []).find(item => (item.productId || item.id) === productId);
                                            if (!itemData) return null; // Should not happen if IDs are derived correctly, but safe check

                                            return (
                                                // Container for each product's review form
                                                <View key={productId} style={styles.reviewItemContainer}>
                                                    {/* Header showing product image and name */}
                                                    <View style={styles.reviewItemHeader}>
                                                         <Image source={itemData.image ? { uri: itemData.image } : placeholderImagePath} style={styles.reviewItemImage} defaultSource={placeholderImagePath}/>
                                                         <Text style={styles.reviewItemName} numberOfLines={2}>{itemData.name || 'N/A'}</Text>
                                                    </View>
                                                    {/* Render the actual ReviewForm component */}
                                                    <ReviewForm
                                                        orderId={currentOrderData.id}
                                                        reviewerId={reviewerId}
                                                        productId={productId}
                                                        onReviewSubmitSuccess={handleReviewSuccess} // Pass the callback
                                                    />
                                                    {/* Render divider between forms (optional) */}
                                                    {index < uniqueProductIdsToReview.length - 1 && <View style={styles.reviewItemDivider} />}
                                                </View>
                                            );
                                        })}
                                    </>
                                )}

                                {/* Case 2: Order complete, status loaded, ALL unique products reviewed */}
                                {allUniqueProductsReviewed && (
                                    <>
                                        <Text style={styles.sectionTitle}>Reviews Submitted</Text>
                                        {/* Ensure completion message is wrapped in Text */}
                                        <Text style={styles.reviewNotAvailableText}>Thank you for reviewing your items!</Text>
                                    </>
                                )}

                                {/* Case 3: Order complete, but no unique products found in the order to review */}
                                {isOrderComplete && !loadingReviews && !reviewError && uniqueProductIdsInOrder.length === 0 && (
                                     /* Ensure this message is wrapped in Text */
                                     <Text style={styles.reviewNotAvailableText}>There are no items in this order available for review.</Text>
                                )}
                             </>
                        )}
                    </View>
                )}
                {/* --- End Review Section --- */}

                {/* Add some bottom padding inside the scroll view */}
                 <View style={{ height: 20 }} />

            </ScrollView>
        </SafeAreaView>
    );
};

// --- Styles ---
// Consistent styling for the screen elements
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: ScreenBackgroundColor },
    scrollContainer: { flexGrow: 1, padding: 15, paddingBottom: 40, paddingTop: 15 }, // Add padding
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: ScreenBackgroundColor },
    loadingText: { marginTop: 10, color: TextColorSecondary, fontSize: 14 },
    errorText: { fontSize: 16, color: AccentColor, marginBottom: 15, textAlign: 'center', lineHeight: 22 },
    backButton: { backgroundColor: AccentColor, paddingVertical: 10, paddingHorizontal: 25, borderRadius: 6 },
    backButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    // Section Card Styling
    section: {
        backgroundColor: AppBackgroundColor,
        borderRadius: 8,
        padding: 15,
        marginBottom: 15,
        // Shadows for depth
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1.5,
        // Optional border for iOS
        borderWidth: Platform.OS === 'ios' ? 1 : 0,
        borderColor: LightBorderColor,
    },
    sectionTitle: { fontSize: 17, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 8 },
    // Summary Row Styling (Label + Value)
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }, // Allow wrapping
    summaryLabel: { fontSize: 14, color: TextColorSecondary, marginRight: 5 },
    summaryValue: { fontSize: 14, fontWeight: '500', color: TextColorPrimary, textAlign: 'right', flexShrink: 1 }, // Allow value to shrink if needed
    // Status Badge Styling
    statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, alignSelf: 'flex-start' }, // Align badge to start of its container space
    statusText: { fontSize: 12, fontWeight: 'bold', color: '#fff' }, // White text generally good for badges
    // Specific Badge Colors (Map to getStatusStyle results)
    statusPending: { backgroundColor: PendingStatusColor }, // Orange
    statusProcessing: { backgroundColor: '#42A5F5' }, // Blue
    statusShipped: { backgroundColor: '#66BB6A' }, // Greenish
    statusDelivered: { backgroundColor: '#78909C' }, // Gray-Blue
    statusCancelled: { backgroundColor: AccentColor }, // Red
    statusUnknown: { backgroundColor: '#BDBDBD' }, // Gray
    statusActive: { backgroundColor: ActiveStatusColor }, // Light Blue
    statusPaidBadge: { backgroundColor: SuccessColor }, // Specific Green for Paid
    // Detail Text Styling (e.g., Address)
    detailText: { fontSize: 14, color: TextColorPrimary, lineHeight: 20, marginBottom: 4 },
    // Payment Breakdown Subsection Styling
    paymentSubSection: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
    paymentSubHeader: { fontSize: 15, fontWeight: '600', color: TextColorPrimary, marginBottom: 10 },
    paymentValueHighlight: { fontSize: 14, fontWeight: 'bold', color: AccentColor }, // Highlight amounts
    planDetailsBox: { marginTop: 10, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 6, borderWidth: 1, borderColor: '#eee' },
    planDetailTitle: { fontSize: 14, fontWeight: '600', color: TextColorPrimary, marginBottom: 6 },
    planDetailText: { fontSize: 13, color: TextColorSecondary, marginBottom: 4, lineHeight: 18 },
    linkText: { fontSize: 13, color: '#007AFF', marginTop: 5, fontStyle: 'italic' }, // Blue link style
    // Installment Row Styling
    installmentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee', flexWrap: 'wrap' }, // Allow wrapping
    installmentLeft: { flex: 1, paddingRight: 10 }, // Take up available space
    installmentRight: { alignItems: 'flex-end', minWidth: 100 }, // Align content to the right
    installmentText: { fontSize: 13, color: TextColorSecondary, marginBottom: 4 },
    installmentAmount: { fontSize: 13, fontWeight: '500', color: TextColorPrimary },
    installmentDueDate: { fontSize: 12, color: TextColorSecondary, marginBottom: 4, textAlign: 'right' },
    statusBadgeSmall: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 10, marginBottom: 4, alignSelf: 'flex-end' }, // Align badge right
    statusTextSmall: { fontSize: 10, fontWeight: 'bold', color: '#fff' },
    statusPaid: { backgroundColor: SuccessColor }, // Green
    statusInstallmentPending: { backgroundColor: PendingStatusColor }, // Orange
    paidAtText: { fontSize: 11, color: TextColorSecondary, fontStyle: 'italic', textAlign: 'right', marginTop: 2 },
    penaltyText: { fontSize: 11, color: AccentColor, fontStyle: 'italic', textAlign: 'right', marginTop: 2 },
    // Items List Styling
    itemsListContainer: { marginTop: 5 },
    itemContainer: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
    lastItemContainer: { borderBottomWidth: 0 }, // Remove border for last item
    itemImage: { width: 50, height: 50, borderRadius: 6, marginRight: 12, backgroundColor: PlaceholderBgColor },
    itemDetails: { flex: 1, justifyContent: 'center', marginRight: 8 }, // Take remaining space
    itemName: { fontSize: 14, fontWeight: '600', color: TextColorPrimary, marginBottom: 3 },
    itemQtyPrice: { fontSize: 13, color: TextColorSecondary },
    itemPrice: { fontSize: 13, color: TextColorSecondary, marginTop: 2 },
    itemPaymentMethod: { fontSize: 11, fontStyle: 'italic', color: TextColorSecondary, marginTop: 4 },
    itemTotalValue: { fontSize: 14, fontWeight: 'bold', color: TextColorPrimary, textAlign: 'right', marginLeft: 10 }, // Align total right
    // Order Totals Styling
    orderTotals: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#eee' },
    totalDivider: { height: 1, backgroundColor: '#eee', marginVertical: 8 },
    grandTotalLabel: { fontWeight: 'bold', fontSize: 16, color: TextColorPrimary },
    grandTotalValue: { fontWeight: 'bold', fontSize: 16, color: AccentColor }, // Highlight Grand Total
    // OTP Display Styling
    otpDisplayRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingVertical: 8, paddingHorizontal: 60, backgroundColor: '#E8F5E9', borderRadius: 6, borderWidth: 1, borderColor: '#C8E6C9', alignSelf: 'flex-start' },
    otpIcon: { marginRight: 6 },
    otpDisplayLabel: { fontSize: 14, color: TextColorSecondary, marginRight: 8 },
    otpDisplayValue: { fontSize: 15, fontWeight: 'bold', color: SuccessColor, letterSpacing: 2 },
    emptyListText: { color: TextColorSecondary, fontStyle: 'italic', textAlign: 'center', paddingVertical: 10 },
    // Review Section Specific Styles
    reviewLoadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, minHeight: 60 },
    reviewStatusText: { marginLeft: 10, fontSize: 14, color: TextColorSecondary, fontStyle: 'italic' },
    reviewErrorContainer: { paddingVertical: 20, alignItems: 'center', minHeight: 60 },
    reviewItemContainer: { marginBottom: 15, paddingBottom: 15 }, // Spacing for each review form item
    reviewItemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingHorizontal: 5 },
    reviewItemImage: { width: 45, height: 45, borderRadius: 4, marginRight: 12, backgroundColor: PlaceholderBgColor },
    reviewItemName: { flex: 1, fontSize: 15, fontWeight: '600', color: TextColorPrimary, lineHeight: 20 },
    reviewItemDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 10, marginLeft: -15, marginRight: -15 }, // Full width divider if needed
    reviewNotAvailableText: { fontSize: 13, fontStyle: 'italic', color: TextColorSecondary, textAlign: 'center', paddingVertical: 15, lineHeight: 18 },
});