// UserOrderDetailScreen.js
// (COMPLETE CODE - Incorporating All Features & Fixes - Product Review Stats Added - Order Cancellation Added)

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
    collection, query, where, getDocs, // Ensure getDocs is imported
    updateDoc, // <<< ADDED for product updates AND order cancellation
    increment, // <<< ADDED for atomic increments
    getDoc as getSingleDoc // <<< ADDED to fetch product after increment (aliased to avoid name clash if any)
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
const AccentColor = '#FF0000'; // Used for errors, potentially highlights, cancel button
const SuccessColor = '#4CAF50'; // Used for success states, paid status
const ActiveStatusColor = '#29B6F6';
const PendingStatusColor = '#FFA726'; // Orange for pending
const LightBorderColor = '#E5E7EB'; // Subtle borders
const PlaceholderBgColor = '#F0F0F0'; 
const cancel_color= '#EF5350';// Image placeholder background

// Data & Logic Constants
const CURRENCY_SYMBOL = 'PKR';
const placeholderImagePath = require('../../assets/p3.jpg'); // **** ADJUST PATH IF NEEDED ****
const ORDERS_COLLECTION = 'orders';
const REVIEWS_COLLECTION = 'Reviews';
const ADMIN_COLLECTION = 'Admin'; // Collection where admin users (with role='admin') are stored
const USERS_COLLECTION = 'Users'; // General users collection
const PRODUCTS_COLLECTION_NAME = 'Products'; // <<< ENSURE THIS MATCHES YOUR PRODUCTS COLLECTION NAME
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send"; // Expo API

// Status Constants (Ensure these match Firestore values)
const SHIPPED_STATUS = 'Shipped';
const ACTIVE_STATUS = 'Active'; // Example if you have an 'Active' BNPL status
const PAID_STATUS = 'Paid';
const PENDING_STATUS = 'Pending'; // Default/Initial status for many things
const PARTIALLY_PAID_STATUS = 'Partially Paid';
const COMPLETED_ORDER_STATUS = 'Delivered'; // Status required to show review forms
const CANCELLED_STATUS = 'Cancelled'; // Example - Used for order cancellation
const REJECTED_STATUS = 'Rejected'; // Example

// Payment Method Constants (Ensure these match Firestore values)
const COD_METHOD = 'COD';
const BNPL_METHOD = 'BNPL'; // Keep the constant as BNPL for logic, but display "Installment"
const FIXED_DURATION_METHOD = 'Fixed Duration';
const MIXED_METHOD = 'Mixed';

// --- Helper Functions ---
const formatDate = (timestamp) => {
    let dateToFormat = null;
    if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); }
    else if (timestamp instanceof Date) { dateToFormat = timestamp; }
    else if (timestamp && typeof timestamp.toDate === 'function') {
        try { dateToFormat = timestamp.toDate(); } catch (e) { console.warn("toDate conversion failed", e); }
    }
    if (dateToFormat && isValid(dateToFormat)) {
        try { return format(dateToFormat, 'MMM d, yyyy, h:mm a'); }
        catch (e) { console.error("[formatDate] Error formatting:", e); return 'Invalid Date'; }
    }
    return 'N/A';
};

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

const getStatusStyle = (status) => {
     const lowerStatus = status?.toLowerCase() || 'unknown';
     switch (lowerStatus) {
          case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': case 'unpaid (bnpl)':
          case 'unpaid (installment)': return styles.statusPending;
          case 'processing': case PARTIALLY_PAID_STATUS.toLowerCase(): return styles.statusProcessing;
          case SHIPPED_STATUS.toLowerCase(): return styles.statusShipped;
          case ACTIVE_STATUS.toLowerCase(): return styles.statusActive;
          case COMPLETED_ORDER_STATUS.toLowerCase(): return styles.statusDelivered;
          case CANCELLED_STATUS.toLowerCase(): case REJECTED_STATUS.toLowerCase(): return styles.statusCancelled; // <<< Ensure CANCELLED_STATUS uses AccentColor via styles.statusCancelled
          case PAID_STATUS.toLowerCase(): return styles.statusPaidBadge;
          default: return styles.statusUnknown;
      }
};

const getInstallmentStatusStyle = (status) => {
    return (status?.toLowerCase() === PAID_STATUS.toLowerCase()) ? styles.statusPaid : styles.statusInstallmentPending;
};

async function getAdminExpoTokens() {
    const adminTokens = [];
    try {
        const q = query(collection(db, ADMIN_COLLECTION), where("role", "==", "admin"));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) { console.log(`[getAdminExpoTokens] No admin users found with role='admin'.`); return []; }
        querySnapshot.forEach((doc) => {
            const adminData = doc.data(); const token = adminData?.expoPushToken;
            if (token && typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))) {
                adminTokens.push(token);
            } else { console.log(`[getAdminExpoTokens] Invalid or missing token for admin ${doc.id}. Token value:`, token); }
        });
        console.log(`[getAdminExpoTokens] Found ${adminTokens.length} valid admin tokens.`);
        return adminTokens;
    } catch (error) { console.error("[getAdminExpoTokens] Error fetching admin tokens:", error); return []; }
}

async function sendExpoPushNotification(pushTokens, title, body, data = {}) {
    if (!Array.isArray(pushTokens) || pushTokens.length === 0) { console.log("[sendExpoPushNotification] Skipping: No push tokens provided."); return; }
    const validTokens = pushTokens.filter(token => token && typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')));
    if (validTokens.length === 0) { console.log("[sendExpoPushNotification] Skipping: No valid push tokens after filtering."); return; }
    const messages = validTokens.map(token => ({ to: token, sound: 'default', title: title, body: body, data: data, priority: 'normal', channelId: 'admin-notifications' }));
    console.log(`[sendExpoPushNotification] Sending ${messages.length} push notification(s)...`);
    try {
        await axios.post(EXPO_PUSH_ENDPOINT, messages, { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Accept-encoding': 'gzip, deflate' }, timeout: 15000 });
        console.log("[sendExpoPushNotification] Push notifications sent successfully via Expo API.");
    } catch (error) { console.error("[sendExpoPushNotification] Error sending push notifications via Expo API:", error.response?.data || error.message || error); }
}

// --- Main Component ---
export default function UserOrderDetailScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const initialOrder = route.params?.order;
    const orderId = initialOrder?.id;

    const [currentOrderData, setCurrentOrderData] = useState(initialOrder);
    const [loadingOrder, setLoadingOrder] = useState(!initialOrder);
    const [orderError, setOrderError] = useState(null);
    const [reviewedProductIds, setReviewedProductIds] = useState(new Set());
    const [loadingReviews, setLoadingReviews] = useState(true);
    const [reviewError, setReviewError] = useState(null);
    const [isCancellingOrder, setIsCancellingOrder] = useState(false); // <<< ADDED for cancellation loading state

    const reviewerId = currentOrderData?.userId;
    const reviewerName = currentOrderData?.userName || 'A user';

    useEffect(() => {
        if (!orderId) {
            setOrderError("Order details could not be loaded (No ID provided)."); setLoadingOrder(false); setCurrentOrderData(null); return;
        }
        setOrderError(null); setLoadingOrder(true);
        const orderRef = doc(db, ORDERS_COLLECTION, orderId);
        const unsubscribe = onSnapshot(orderRef, (docSnap) => {
            if (docSnap.exists()) {
                setCurrentOrderData({ id: docSnap.id, ...docSnap.data() }); setOrderError(null);
            } else {
                console.warn(`[UserOrderDetailScreen] Order ${orderId} not found in Firestore.`); setOrderError("Order not found. It might have been deleted."); setCurrentOrderData(null);
            }
            setLoadingOrder(false);
        }, (err) => {
            console.error(`[UserOrderDetailScreen] Listener error for order ${orderId}:`, err); setOrderError("Failed to load real-time order details. Check connection."); setLoadingOrder(false);
        });
        return () => unsubscribe();
    }, [orderId]);

    useEffect(() => {
        if (!orderId || !reviewerId) { setLoadingReviews(false); return; }
        setLoadingReviews(true); setReviewError(null); const reviewedIds = new Set();
        const reviewsQuery = query(collection(db, REVIEWS_COLLECTION), where("orderId", "==", orderId), where("userId", "==", reviewerId));
        getDocs(reviewsQuery)
            .then((querySnapshot) => {
                querySnapshot.forEach((doc) => { if (doc.data().productId) { reviewedIds.add(doc.data().productId); } });
                setReviewedProductIds(reviewedIds);
            })
            .catch((err) => {
                console.error(`Error fetching reviewed product IDs for order ${orderId}:`, err); setReviewError("Could not load previous review information."); setReviewedProductIds(new Set());
            })
            .finally(() => { setLoadingReviews(false); });
    }, [orderId, reviewerId]);

    const handleReviewSuccess = useCallback(async (submittedProductId, ratingValue) => {
        console.log(`[ReviewSuccess] START - Product ID: ${submittedProductId}, Order ID: ${orderId}, Rating: ${ratingValue}`);
        if (!submittedProductId) {
            console.error("[ReviewSuccess] ERROR: submittedProductId is missing or invalid.");
            Alert.alert("Error", "Could not process review: Product ID missing.");
            return;
        }
        if (typeof ratingValue !== 'number' || ratingValue < 1 || ratingValue > 5) {
            console.error(`[ReviewSuccess] ERROR: ratingValue is invalid. Received: ${ratingValue} (type: ${typeof ratingValue})`);
            Alert.alert("Error", "Could not process review: Invalid rating value. Please rate between 1 and 5.");
            return;
        }
        setReviewedProductIds(prevIds => new Set(prevIds).add(submittedProductId));
        if (Platform.OS === 'android') {
            ToastAndroid.show('Thanks for your review!', ToastAndroid.SHORT);
        } else {
            Alert.alert("Review Submitted", "Thanks for your feedback!");
        }
        try {
            const productRef = doc(db, PRODUCTS_COLLECTION_NAME, submittedProductId);
            await updateDoc(productRef, { reviewCount: increment(1), totalRatingSum: increment(ratingValue) });
            const updatedProductSnap = await getSingleDoc(productRef);
            if (updatedProductSnap.exists()) {
                const productData = updatedProductSnap.data();
                const newReviewCount = productData.reviewCount;
                const newTotalRatingSum = productData.totalRatingSum;
                if (typeof newReviewCount === 'number' && newReviewCount > 0 && typeof newTotalRatingSum === 'number') {
                    const newAverageRating = parseFloat((newTotalRatingSum / newReviewCount).toFixed(1));
                    await updateDoc(productRef, { averageRating: newAverageRating });
                    console.log(`[ProductReviewStats] SUCCESS: Updated averageRating for product ${submittedProductId} to: ${newAverageRating}`);
                } else {
                    console.warn(`[ProductReviewStats] WARN: Product ${submittedProductId} has invalid stats for average calculation after increment.`);
                }
            } else {
                console.error(`[ProductReviewStats] CRITICAL ERROR: Product ${submittedProductId} NOT FOUND after increment.`);
            }
        } catch (productUpdateError) {
            console.error(`[ProductReviewStats] FAILED to update product review statistics for ${submittedProductId}. Error:`, productUpdateError);
        }
        try {
            if (!currentOrderData || !currentOrderData.items) {
                console.warn("[handleReviewSuccess - AdminNotify] Cannot send notification: currentOrderData or items missing.");
                return;
            }
            const reviewedItem = currentOrderData.items.find(item => (item.productId || item.id) === submittedProductId);
            const productName = reviewedItem?.name || 'Unknown Product';
            const orderDisplayId = currentOrderData.orderNumber ? `#${currentOrderData.orderNumber}` : `ID...${currentOrderData.id.slice(-6)}`;
            const notificationTitle = `New Review Submitted!`;
            const notificationBody = `${reviewerName} rated "${productName}" ${ratingValue} stars (Order ${orderDisplayId}).`;
            const notificationData = { orderId: currentOrderData.id, productId: submittedProductId, type: 'new_review' };
            const adminTokens = await getAdminExpoTokens();
            if (adminTokens.length > 0) {
                await sendExpoPushNotification(adminTokens, notificationTitle, notificationBody, notificationData);
            }
        } catch (adminNotifyError) {
            console.error("[handleReviewSuccess - AdminNotify] Failed to send admin notification:", adminNotifyError);
        }
        console.log("[ReviewSuccess] END");
    }, [currentOrderData, orderId, reviewerName]);

    // <<< ADDED FUNCTION TO HANDLE ORDER CANCELLATION >>>
    const handleCancelOrder = useCallback(async () => {
        if (!currentOrderData || !orderId) {
            Alert.alert("Error", "Order details are not available to process cancellation.");
            return;
        }

        if (currentOrderData.status !== PENDING_STATUS) {
            Alert.alert("Cannot Cancel Order", "This order can no longer be cancelled as its status is not 'Pending'.");
            return;
        }

        Alert.alert(
            "Confirm Cancellation",
            "Are you sure you want to cancel this order? This action cannot be undone.",
            [
                { text: "No, Keep Order", style: "cancel", onPress: () => {} },
                {
                    text: "Yes, Cancel Order",
                    style: "destructive",
                    onPress: async () => {
                        setIsCancellingOrder(true);
                        try {
                            const orderRef = doc(db, ORDERS_COLLECTION, orderId);
                            await updateDoc(orderRef, {
                                status: CANCELLED_STATUS,
                                lastUpdatedAt: Timestamp.now(),
                                cancelledAt: Timestamp.now(),
                                cancellationReason: "Cancelled by user",
                            });

                            if (Platform.OS === 'android') {
                                ToastAndroid.show('Order cancelled successfully.', ToastAndroid.SHORT);
                            } else {
                                Alert.alert("Success", "Order has been cancelled.");
                            }

                            // Notify admins about the cancellation
                            try {
                                const orderDisplayId = currentOrderData.orderNumber ? `#${currentOrderData.orderNumber}` : `ID...${currentOrderData.id.slice(-6)}`;
                                const userNameForNotif = currentOrderData.userName || 'A user';
                                const notificationTitle = `Order Cancelled by User`;
                                const notificationBody = `Order ${orderDisplayId} has been cancelled by ${userNameForNotif}.`;
                                const notificationData = { orderId: currentOrderData.id, type: 'order_cancelled_by_user' };

                                const adminTokens = await getAdminExpoTokens();
                                if (adminTokens.length > 0) {
                                    await sendExpoPushNotification(adminTokens, notificationTitle, notificationBody, notificationData);
                                    console.log("[handleCancelOrder - AdminNotify] Admin cancellation notification dispatched.");
                                } else {
                                    console.log("[handleCancelOrder - AdminNotify] No admin tokens found for cancellation notification.");
                                }
                            } catch (adminNotifyError) {
                                console.error("[handleCancelOrder - AdminNotify] Failed to send admin cancellation notification:", adminNotifyError);
                            }
                            // onSnapshot will update the UI
                        } catch (error) {
                            console.error("Error cancelling order:", error);
                            Alert.alert("Cancellation Failed", "Could not cancel the order. Please try again or contact support.");
                        } finally {
                            setIsCancellingOrder(false);
                        }
                    },
                },
            ],
            { cancelable: true }
        );
    }, [orderId, currentOrderData]); // <<< END ADDED FUNCTION >>>


    const renderOrderItem = ({ item, index }) => {
        if (!item || typeof item.price !== 'number' || typeof item.quantity !== 'number') {
            console.warn("Skipping renderOrderItem due to missing/invalid data:", item); return null;
        }
        const itemsArray = currentOrderData?.items || [];
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        const itemPaymentMethod = item.paymentMethod || 'N/A';
        let paymentDisplay = itemPaymentMethod;
        if (itemPaymentMethod === BNPL_METHOD && item.bnplPlan) { paymentDisplay = item.bnplPlan.name || 'Installment Plan'; }
        else if (itemPaymentMethod === FIXED_DURATION_METHOD && item.bnplPlan) { paymentDisplay = item.bnplPlan?.name || FIXED_DURATION_METHOD; }
        const productIdentifier = item.productId || item.id;
        if (!productIdentifier) { console.warn("Skipping renderOrderItem, productIdentifier missing:", item); return null; }
        const displayMethodText = paymentDisplay === BNPL_METHOD ? 'Installment' : paymentDisplay;

        return (
            <View style={[styles.itemContainer, index === itemsArray.length - 1 && styles.lastItemContainer]}>
                <Image source={item.image ? { uri: item.image } : placeholderImagePath} style={styles.itemImage} defaultSource={placeholderImagePath} />
                <View style={styles.itemDetails}>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name || 'N/A'}</Text>
                    <Text style={styles.itemQtyPrice}>Qty: {item.quantity || 1}</Text>
                    <Text style={styles.itemPrice}>{CURRENCY_SYMBOL} {(item.price || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                    {displayMethodText !== COD_METHOD && displayMethodText !== 'N/A' && (
                        <Text style={styles.itemPaymentMethod}>Method: {displayMethodText}</Text>
                    )}
                </View>
                <Text style={styles.itemTotalValue}>{CURRENCY_SYMBOL} {itemTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
            </View>
        );
    };

    const renderInstallment = ({ item }) => {
        if (!item || typeof item.amount !== 'number') { console.warn("Skipping renderInstallment, missing/invalid data:", item); return null; }
        const installmentStatus = item.status || PENDING_STATUS;
        const isPaid = installmentStatus.toLowerCase() === PAID_STATUS.toLowerCase();
        const paidDate = item.paidAt;
        return (
            <View style={styles.installmentRow}>
                <View style={styles.installmentLeft}><Text style={styles.installmentText}>Inst. #{item.installmentNumber || 'N/A'}</Text><Text style={styles.installmentAmount}>{CURRENCY_SYMBOL} {item.amount?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 'N/A'}</Text></View>
                <View style={styles.installmentRight}><Text style={styles.installmentDueDate}>Due: {formatShortDate(item.dueDate)}</Text><View style={[styles.statusBadgeSmall, getInstallmentStatusStyle(installmentStatus)]}><Text style={styles.statusTextSmall}>{installmentStatus}</Text></View>{isPaid && paidDate && (<Text style={styles.paidAtText}>Paid: {formatShortDate(paidDate)}</Text>)}{typeof item.penalty === 'number' && item.penalty > 0 && (<Text style={styles.penaltyText}>Penalty: {CURRENCY_SYMBOL}{item.penalty.toFixed(0)}</Text>)}</View>
            </View>
        );
    };

    if (loadingOrder) {
        return (<SafeAreaView style={styles.container}><StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} /><View style={styles.loadingContainer}><ActivityIndicator size="large" color={AccentColor} /><Text style={styles.loadingText}>Loading Order Details...</Text></View></SafeAreaView>);
    }
    if (orderError || !currentOrderData) {
        return (<SafeAreaView style={styles.container}><StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} /><View style={styles.loadingContainer}><Text style={styles.errorText}>{orderError || "Order details could not be loaded or the order does not exist."}</Text>{navigation.canGoBack() && (<TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.backButtonText}>Go Back</Text></TouchableOpacity>)}</View></SafeAreaView>);
    }

    const paymentMethod = currentOrderData.paymentMethod || 'Unknown';
    const relevantPlanDetails = currentOrderData.bnplPlanDetails || currentOrderData.fixedDurationDetails;
    const showCodSection = (paymentMethod === COD_METHOD || paymentMethod === MIXED_METHOD) && typeof currentOrderData.codAmount === 'number' && currentOrderData.codAmount > 0;
    const showInstallmentSection = (paymentMethod === BNPL_METHOD || paymentMethod === MIXED_METHOD) && Array.isArray(currentOrderData.installments) && currentOrderData.installments.length > 0;
    const showFixedDurationSection = (paymentMethod === FIXED_DURATION_METHOD) || (paymentMethod === MIXED_METHOD && (!!currentOrderData?.paymentDueDate || !!currentOrderData?.fixedDurationDetails));
    const isOrderComplete = currentOrderData.status === COMPLETED_ORDER_STATUS;
    const allProductIdsInOrder = (currentOrderData.items || []).map(item => item.productId || item.id).filter(id => !!id);
    const uniqueProductIdsInOrder = [...new Set(allProductIdsInOrder)];
    const uniqueProductIdsToReview = isOrderComplete && !loadingReviews && !reviewError ? uniqueProductIdsInOrder.filter(productId => !reviewedProductIds.has(productId)) : [];
    const allUniqueProductsReviewed = isOrderComplete && !loadingReviews && !reviewError && uniqueProductIdsInOrder.length > 0 && uniqueProductIdsToReview.length === 0;
    const paymentMethodDisplayText = paymentMethod === BNPL_METHOD ? 'Installment' : paymentMethod;

    // <<< ADDED: Determine if order can be cancelled >>>
    const canCancelOrder = currentOrderData.status === PENDING_STATUS;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
            <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Items Ordered ({currentOrderData.items?.length || 0})</Text>
                    <View style={styles.itemsListContainer}>
                        <FlatList data={currentOrderData.items || []} renderItem={renderOrderItem} keyExtractor={(itemData, index) => `${itemData?.productId || itemData?.id || 'item'}-${index}`} scrollEnabled={false} ListEmptyComponent={<Text style={styles.emptyListText}>No items found in this order.</Text>} />
                    </View>
                    <View style={styles.orderTotals}>
                        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal:</Text><Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {(currentOrderData.subtotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>
                        {typeof currentOrderData.deliveryFee === 'number' && currentOrderData.deliveryFee > 0 && (<View style={styles.summaryRow}><Text style={styles.summaryLabel}>Delivery Fee:</Text><Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {currentOrderData.deliveryFee.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>)}
                        <View style={styles.totalDivider} />
                        <View style={styles.summaryRow}><Text style={[styles.summaryLabel, styles.grandTotalLabel]}>Grand Total:</Text><Text style={[styles.summaryValue, styles.grandTotalValue]}>{CURRENCY_SYMBOL} {(currentOrderData.grandTotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Order Summary</Text>
                    <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Order ID:</Text><Text style={styles.summaryValue}>#{currentOrderData.orderNumber || currentOrderData.id?.substring(0, 8).toUpperCase() || 'N/A'}</Text></View>
                    <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Order Date:</Text><Text style={styles.summaryValue}>{formatDate(currentOrderData.createdAt || currentOrderData.orderDate)}</Text></View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Status:</Text>
                        <View style={[styles.statusBadge, getStatusStyle(currentOrderData.status)]}>
                            <Text style={styles.statusText}>{currentOrderData.status || 'Unknown'}</Text>
                        </View>
                    </View>
                    {currentOrderData.status === SHIPPED_STATUS && currentOrderData.deliveryOtp && (<View style={styles.otpDisplayRow}><IconMUI name="vpn-key" size={16} color={SuccessColor} style={styles.otpIcon} /><Text style={styles.otpDisplayLabel}>Delivery OTP:</Text><Text style={styles.otpDisplayValue}>{currentOrderData.deliveryOtp}</Text></View>)}
                    
                    {/* <<< ADDED CANCEL ORDER BUTTON RENDER >>> */}
                    {canCancelOrder && (
                        <TouchableOpacity
                            style={[styles.cancelOrderButton, isCancellingOrder && styles.disabledButton]}
                            onPress={handleCancelOrder}
                            disabled={isCancellingOrder}
                        >
                            {isCancellingOrder ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.cancelOrderButtonText}>Cancel Order</Text>
                            )}
                        </TouchableOpacity>
                    )}
                    {/* <<< END ADDED CANCEL ORDER BUTTON RENDER >>> */}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Delivery Address</Text>
                    <Text style={styles.detailText}>{currentOrderData.userName || 'N/A'}</Text>
                    <Text style={styles.detailText}>{currentOrderData.userAddress || 'N/A'}</Text>
                    <Text style={styles.detailText}>{currentOrderData.userPhone || 'N/A'}</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment Details</Text>
                    <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Method:</Text><Text style={styles.summaryValue}>{paymentMethodDisplayText}</Text></View>
                    <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Payment Status:</Text><View style={[styles.statusBadge, getStatusStyle(currentOrderData.paymentStatus)]}><Text style={styles.statusText}>{currentOrderData.paymentStatus || 'N/A'}</Text></View></View>
                    {showCodSection && (
                        <View style={styles.paymentSubSection}><Text style={styles.paymentSubHeader}>Cash on Delivery</Text><View style={styles.summaryRow}><Text style={styles.summaryLabel}>Amount Due (COD):</Text><Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.codAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>{currentOrderData.codPaymentReceivedAt && (<View style={styles.summaryRow}><Text style={styles.summaryLabel}>COD Paid At:</Text><Text style={styles.summaryValue}>{formatDate(currentOrderData.codPaymentReceivedAt)}</Text></View>)}</View>
                    )}
                    {showInstallmentSection && (
                        <View style={styles.paymentSubSection}><Text style={styles.paymentSubHeader}>Installment Plan Details</Text><View style={styles.summaryRow}><Text style={styles.summaryLabel}>Plan Amount (Installment):</Text><Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.bnplAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>
                        {relevantPlanDetails && (<View style={styles.planDetailsBox}><Text style={styles.planDetailTitle}>Plan: {relevantPlanDetails.name || 'N/A'}</Text><Text style={styles.planDetailText}>Duration: {relevantPlanDetails.duration || 'N/A'} Months</Text>{typeof relevantPlanDetails.interestRate === 'number' && (<Text style={styles.planDetailText}>Interest: {(relevantPlanDetails.interestRate ).toFixed(1)}%</Text>)}</View>)}
                        {(currentOrderData.installments?.length > 0) && (<Text style={styles.linkText}>(See Full Schedule Below)</Text>)}</View>
                    )}
                    {showFixedDurationSection && (
                        <View style={styles.paymentSubSection}><Text style={styles.paymentSubHeader}>Fixed Duration Plan Details</Text><View style={styles.summaryRow}><Text style={styles.summaryLabel}>Plan Amount:</Text><Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.fixedDurationAmountDue ?? currentOrderData.bnplAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>
                        <View style={styles.planDetailsBox}>{relevantPlanDetails && <Text style={styles.planDetailTitle}>Plan: {relevantPlanDetails.name || 'Fixed Plan'}</Text>}{relevantPlanDetails?.duration && <Text style={styles.planDetailText}>Duration: {relevantPlanDetails.duration} Months</Text>}{typeof relevantPlanDetails?.interestRate === 'number' && (<Text style={styles.planDetailText}>Interest: {(relevantPlanDetails.interestRate).toFixed(1)}%</Text>)}<Text style={styles.planDetailText}>Payment Due: {formatShortDate(currentOrderData.paymentDueDate)}</Text>{typeof currentOrderData.penalty === 'number' && currentOrderData.penalty > 0 && (<Text style={[styles.planDetailText, styles.penaltyText]}>Penalty Applied: {CURRENCY_SYMBOL}{currentOrderData.penalty.toFixed(0)}</Text>)}</View></View>
                    )}
                </View>

                {showInstallmentSection && currentOrderData.installments && currentOrderData.installments.length > 0 && (
                    <View style={styles.section}><Text style={styles.sectionTitle}>Installment Schedule</Text><FlatList data={currentOrderData.installments} keyExtractor={(inst, index) => inst?.installmentNumber ? `inst-${inst.installmentNumber}-${index}` : `inst-fallback-${index}`} renderItem={renderInstallment} scrollEnabled={false} ListEmptyComponent={<Text style={styles.emptyListText}>No installment data found.</Text>} /></View>
                )}

                {isOrderComplete && (
                    <View style={styles.section}>
                        {loadingReviews && (<View style={styles.reviewLoadingContainer}><ActivityIndicator color={AccentColor} size="small"/><Text style={styles.reviewStatusText}>Loading review status...</Text></View>)}
                        {!loadingReviews && reviewError && (<View style={styles.reviewErrorContainer}><Text style={styles.errorText}>{reviewError}</Text></View>)}
                        {!loadingReviews && !reviewError && (
                            <>
                                {uniqueProductIdsToReview.length > 0 && (
                                    <><Text style={styles.sectionTitle}>Leave Reviews ({uniqueProductIdsToReview.length} remaining)</Text>
                                    {uniqueProductIdsToReview.map((productId, index) => {
                                        const itemData = (currentOrderData.items || []).find(item => (item.productId || item.id) === productId);
                                        if (!itemData) return null;
                                        return (
                                            <View key={productId} style={styles.reviewItemContainer}>
                                                <View style={styles.reviewItemHeader}><Image source={itemData.image ? { uri: itemData.image } : placeholderImagePath} style={styles.reviewItemImage} defaultSource={placeholderImagePath}/><Text style={styles.reviewItemName} numberOfLines={2}>{itemData.name || 'N/A'}</Text></View>
                                                <ReviewForm orderId={currentOrderData.id} reviewerId={reviewerId} productId={productId} onReviewSubmitSuccess={handleReviewSuccess} />
                                                {index < uniqueProductIdsToReview.length - 1 && <View style={styles.reviewItemDivider} />}
                                            </View>
                                        );
                                    })}</>
                                )}
                                {allUniqueProductsReviewed && (<><Text style={styles.sectionTitle}>Reviews Submitted</Text><Text style={styles.reviewNotAvailableText}>Thank you for reviewing your items!</Text></>)}
                                {isOrderComplete && !loadingReviews && !reviewError && uniqueProductIdsInOrder.length === 0 && (<Text style={styles.reviewNotAvailableText}>There are no items in this order available for review.</Text>)}
                             </>
                        )}
                    </View>
                )}
                <View style={{ height: 20 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: ScreenBackgroundColor },
    scrollContainer: { flexGrow: 1, padding: 15, paddingBottom: 40, paddingTop: 15 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: ScreenBackgroundColor },
    loadingText: { marginTop: 10, color: TextColorSecondary, fontSize: 14 },
    errorText: { fontSize: 16, color: AccentColor, marginBottom: 15, textAlign: 'center', lineHeight: 22 },
    backButton: { backgroundColor: AccentColor, paddingVertical: 10, paddingHorizontal: 25, borderRadius: 6 },
    backButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    section: { backgroundColor: AppBackgroundColor, borderRadius: 8, padding: 15, marginBottom: 15, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1.5, borderWidth: Platform.OS === 'ios' ? 1 : 0, borderColor: LightBorderColor, },
    sectionTitle: { fontSize: 17, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 8 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' },
    summaryLabel: { fontSize: 14, color: TextColorSecondary, marginRight: 5 },
    summaryValue: { fontSize: 14, fontWeight: '500', color: TextColorPrimary, textAlign: 'right', flexShrink: 1 },
    statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, alignSelf: 'flex-start' },
    statusText: { fontSize: 12, fontWeight: 'bold', color: '#fff' },
    statusPending: { backgroundColor: PendingStatusColor }, statusProcessing: { backgroundColor: '#42A5F5' }, statusShipped: { backgroundColor: '#66BB6A' }, statusDelivered: { backgroundColor: '#78909C' }, statusCancelled: { backgroundColor: cancel_color }, statusUnknown: { backgroundColor: '#BDBDBD' }, statusActive: { backgroundColor: ActiveStatusColor }, statusPaidBadge: { backgroundColor: SuccessColor },
    detailText: { fontSize: 14, color: TextColorPrimary, lineHeight: 20, marginBottom: 4 },
    paymentSubSection: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
    paymentSubHeader: { fontSize: 15, fontWeight: '600', color: TextColorPrimary, marginBottom: 10 },
    paymentValueHighlight: { fontSize: 14, fontWeight: 'bold', color: AccentColor },
    planDetailsBox: { marginTop: 10, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 6, borderWidth: 1, borderColor: '#eee' },
    planDetailTitle: { fontSize: 14, fontWeight: '600', color: TextColorPrimary, marginBottom: 6 },
    planDetailText: { fontSize: 13, color: TextColorSecondary, marginBottom: 4, lineHeight: 18 },
    linkText: { fontSize: 13, color: '#007AFF', marginTop: 5, fontStyle: 'italic' },
    installmentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee', flexWrap: 'wrap' },
    installmentLeft: { flex: 1, paddingRight: 10 },
    installmentRight: { alignItems: 'flex-end', minWidth: 100 },
    installmentText: { fontSize: 13, color: TextColorSecondary, marginBottom: 4 },
    installmentAmount: { fontSize: 13, fontWeight: '500', color: TextColorPrimary },
    installmentDueDate: { fontSize: 12, color: TextColorSecondary, marginBottom: 4, textAlign: 'right' },
    statusBadgeSmall: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 10, marginBottom: 4, alignSelf: 'flex-end' },
    statusTextSmall: { fontSize: 10, fontWeight: 'bold', color: '#fff' },
    statusPaid: { backgroundColor: SuccessColor }, statusInstallmentPending: { backgroundColor: PendingStatusColor },
    paidAtText: { fontSize: 11, color: TextColorSecondary, fontStyle: 'italic', textAlign: 'right', marginTop: 2 },
    penaltyText: { fontSize: 11, color: AccentColor, fontStyle: 'italic', textAlign: 'right', marginTop: 2 },
    itemsListContainer: { marginTop: 5 },
    itemContainer: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
    lastItemContainer: { borderBottomWidth: 0 },
    itemImage: { width: 50, height: 50, borderRadius: 6, marginRight: 12, backgroundColor: PlaceholderBgColor },
    itemDetails: { flex: 1, justifyContent: 'center', marginRight: 8 },
    itemName: { fontSize: 14, fontWeight: '600', color: TextColorPrimary, marginBottom: 3 },
    itemQtyPrice: { fontSize: 13, color: TextColorSecondary },
    itemPrice: { fontSize: 13, color: TextColorSecondary, marginTop: 2 },
    itemPaymentMethod: { fontSize: 11, fontStyle: 'italic', color: TextColorSecondary, marginTop: 4 },
    itemTotalValue: { fontSize: 14, fontWeight: 'bold', color: TextColorPrimary, textAlign: 'right', marginLeft: 10 },
    orderTotals: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#eee' },
    totalDivider: { height: 1, backgroundColor: '#eee', marginVertical: 8 },
    grandTotalLabel: { fontWeight: 'bold', fontSize: 16, color: TextColorPrimary },
    grandTotalValue: { fontWeight: 'bold', fontSize: 16, color: AccentColor },
    otpDisplayRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#E8F5E9', borderRadius: 6, borderWidth: 1, borderColor: '#C8E6C9', alignSelf: 'center', maxWidth: '80%'},
    otpIcon: { marginRight: 6 },
    otpDisplayLabel: { fontSize: 14, color: TextColorSecondary, marginRight: 8 },
    otpDisplayValue: { fontSize: 15, fontWeight: 'bold', color: SuccessColor, letterSpacing: 2 },
    emptyListText: { color: TextColorSecondary, fontStyle: 'italic', textAlign: 'center', paddingVertical: 10 },
    reviewLoadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, minHeight: 60 },
    reviewStatusText: { marginLeft: 10, fontSize: 14, color: TextColorSecondary, fontStyle: 'italic' },
    reviewErrorContainer: { paddingVertical: 20, alignItems: 'center', minHeight: 60 },
    reviewItemContainer: { marginBottom: 15, paddingBottom: 15 },
    reviewItemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingHorizontal: 5 },
    reviewItemImage: { width: 45, height: 45, borderRadius: 4, marginRight: 12, backgroundColor: PlaceholderBgColor },
    reviewItemName: { flex: 1, fontSize: 15, fontWeight: '600', color: TextColorPrimary, lineHeight: 20 },
    reviewItemDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 10, marginLeft: -15, marginRight: -15 },
    reviewNotAvailableText: { fontSize: 13, fontStyle: 'italic', color: TextColorSecondary, textAlign: 'center', paddingVertical: 15, lineHeight: 18 },

    // <<< ADDED STYLES FOR CANCEL BUTTON >>>
    cancelOrderButton: {
        backgroundColor: AccentColor,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 15, // Margin from the status or OTP row
    },
    cancelOrderButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: 'bold',
    },
    disabledButton: {
        opacity: 0.7, // Standard way to show disabled state
    },
    // <<< END ADDED STYLES >>>
});