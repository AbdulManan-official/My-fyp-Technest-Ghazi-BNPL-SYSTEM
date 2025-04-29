// UserOrderDetailScreen.js (COMPLETE CODE - Reviewed for Text Warnings)

import React, { useState, useEffect } from 'react';
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
    collection, query, where, getDocs
} from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Verify path
import { format, isValid } from 'date-fns';
import ReviewForm from './../../Components/ReviewForm'; // Verify path

// --- Constants ---
const AppBackgroundColor = '#FFFFFF';
const ScreenBackgroundColor = '#F8F9FA';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const AccentColor = '#FF0000';
const SuccessColor = '#4CAF50';
const ActiveStatusColor = '#29B6F6';
const PendingStatusColor = '#FFA726';
const LightBorderColor = '#E5E7EB';
const PlaceholderBgColor = '#F0F0F0';
const CURRENCY_SYMBOL = 'PKR';
const placeholderImagePath = require('../../assets/p3.jpg'); // Verify path
const ORDERS_COLLECTION = 'orders';
const REVIEWS_COLLECTION = 'Reviews';
const SHIPPED_STATUS = 'Shipped';
const ACTIVE_STATUS = 'Active';
const PAID_STATUS = 'Paid';
const PENDING_STATUS = 'Pending';
const PARTIALLY_PAID_STATUS = 'Partially Paid';
const COMPLETED_ORDER_STATUS = 'Delivered';

// --- Helper Functions ---
const formatDate = (timestamp) => {
    let dateToFormat = null;
    if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); }
    else if (timestamp instanceof Date) { dateToFormat = timestamp; }
    if (dateToFormat && isValid(dateToFormat)) {
        try { return format(dateToFormat, 'MMM d, yyyy, h:mm a'); }
        catch (e) { console.error("[formatDate] Error formatting:", e); return 'Invalid Date'; }
    } return 'N/A';
};

const formatShortDate = (timestamp) => {
     let dateToFormat = null;
     if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); }
     else if (timestamp instanceof Date) { dateToFormat = timestamp; }
     if (dateToFormat && isValid(dateToFormat)) {
         try { return format(dateToFormat, 'MMM d, yyyy'); }
        catch (e) { console.error("[formatShortDate] Error formatting:", e); return 'Invalid Date'; }
     } return 'N/A';
};

const getStatusStyle = (status) => {
     const lowerStatus = status?.toLowerCase() || 'unknown';
     switch (lowerStatus) {
          case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': case 'unpaid (bnpl)': return styles.statusPending;
          case 'processing': case PARTIALLY_PAID_STATUS.toLowerCase(): return styles.statusProcessing;
          case 'shipped': return styles.statusShipped;
          case 'active': return styles.statusActive;
          case COMPLETED_ORDER_STATUS.toLowerCase(): return styles.statusDelivered;
          case 'cancelled': case 'rejected': return styles.statusCancelled;
          default: return styles.statusUnknown;
      }
};

const getInstallmentStatusStyle = (status) => {
    return (status?.toLowerCase() === PAID_STATUS.toLowerCase()) ? styles.statusPaid : styles.statusInstallmentPending;
};

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

    const reviewerId = currentOrderData?.userId;

    // Effect: Listener for Order Details
    useEffect(() => {
        if (!orderId) {
            setOrderError("Order details could not be loaded (No ID).");
            setLoadingOrder(false);
            setCurrentOrderData(null);
            return;
        }
        setOrderError(null);
        setLoadingOrder(true);

        const orderRef = doc(db, ORDERS_COLLECTION, orderId);
        const unsubscribe = onSnapshot(orderRef, (docSnap) => {
            if (docSnap.exists()) {
                setCurrentOrderData({ id: docSnap.id, ...docSnap.data() });
                setOrderError(null);
            } else {
                console.warn(`[UserOrderDetailScreen] Order ${orderId} not found.`);
                setOrderError("Order not found.");
                setCurrentOrderData(null);
            }
            setLoadingOrder(false);
        }, (err) => {
            console.error(`[UserOrderDetailScreen] Listener error for order ${orderId}:`, err);
            setOrderError("Failed to load real-time order details.");
            setCurrentOrderData(null);
            setLoadingOrder(false);
        });
        return () => unsubscribe();
    }, [orderId]);

    // Effect: Fetch IDs of Already Reviewed Products
    useEffect(() => {
        if (!orderId || !reviewerId) {
            setLoadingReviews(false);
            return;
        }

        setLoadingReviews(true);
        setReviewError(null);
        const reviewedIds = new Set();

        const reviewsQuery = query(
            collection(db, REVIEWS_COLLECTION),
            where("orderId", "==", orderId),
            where("userId", "==", reviewerId)
        );

        getDocs(reviewsQuery)
            .then((querySnapshot) => {
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.productId) {
                        reviewedIds.add(data.productId);
                    }
                });
                setReviewedProductIds(reviewedIds);
            })
            .catch((err) => {
                console.error(`Error fetching reviewed product IDs for order ${orderId}:`, err);
                setReviewError("Could not load previous review information.");
                setReviewedProductIds(new Set());
            })
            .finally(() => {
                setLoadingReviews(false);
            });

    }, [orderId, reviewerId]);

    // Callback for ReviewForm Success
    const handleReviewSuccess = (submittedProductId) => {
        console.log(`Review success callback for Product ID: ${submittedProductId} in Order: ${orderId}`);
        setReviewedProductIds(prevIds => new Set(prevIds).add(submittedProductId));

        if (Platform.OS === 'android') {
            ToastAndroid.show('Thanks for your review!', ToastAndroid.SHORT);
        } else {
            Alert.alert("Review Submitted", "Thanks for your feedback!");
        }
    };

    // Render Function: Order Item
    const renderOrderItem = ({ item, index }) => {
        // Basic validation for item data
        if (!item || typeof item.price !== 'number' || typeof item.quantity !== 'number') {
            console.warn("Skipping renderOrderItem due to missing data:", item);
            return null;
        }
        const itemsArray = currentOrderData?.items || [];
        const itemTotal = (item.price || 0) * (item.quantity || 1);
        const paymentMethod = item.paymentMethod || 'COD';
        let paymentDisplay = paymentMethod;
        if (paymentMethod === 'BNPL' && item.bnplPlan) { paymentDisplay = item.bnplPlan.name || 'BNPL Plan'; }
        else if (paymentMethod === 'Fixed Duration') { paymentDisplay = item.bnplPlan?.name || 'Fixed Duration'; }
        // Ensure productIdentifier exists for keyExtractor later
        const productIdentifier = item.productId || item.id;
        if (!productIdentifier) {
             console.warn("Skipping renderOrderItem because productIdentifier is missing:", item);
             return null;
        }

        return (
            <View style={[styles.itemContainer, index === itemsArray.length - 1 && styles.lastItemContainer]}>
                <Image source={item.image ? { uri: item.image } : placeholderImagePath} style={styles.itemImage} defaultSource={placeholderImagePath} />
                <View style={styles.itemDetails}>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name || 'N/A'}</Text>
                    <Text style={styles.itemQtyPrice}>Qty: {item.quantity || 1}</Text>
                    <Text style={styles.itemPrice}>{CURRENCY_SYMBOL} {(item.price || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                    <Text style={styles.itemPaymentMethod}>Method: {paymentDisplay}</Text>
                </View>
                <Text style={styles.itemTotalValue}>{CURRENCY_SYMBOL} {itemTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
            </View>
        );
    };

    // Render Function: Installment Row
    const renderInstallment = ({ item }) => {
        if (!item || typeof item.amount !== 'number') return null;
        const installmentStatus = item.status || PENDING_STATUS;
        const isPaid = installmentStatus.toLowerCase() === PAID_STATUS.toLowerCase();
        const paidDate = item.paidAt;
        return (
            <View style={styles.installmentRow}>
                <Text style={styles.installmentText}>Inst. #{item.installmentNumber || 'N/A'}</Text>
                <Text style={styles.installmentText}>{CURRENCY_SYMBOL} {item.amount?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || 'N/A'}</Text>
                <Text style={styles.installmentText}>Due: {formatShortDate(item.dueDate)}</Text>
                <View style={[styles.statusBadgeSmall, getInstallmentStatusStyle(installmentStatus)]}>
                    <Text style={styles.statusTextSmall}>{installmentStatus}</Text>
                </View>
                {isPaid && paidDate && isValid(paidDate.toDate ? paidDate.toDate() : paidDate) && (
                    <Text style={styles.paidAtText}>Paid: {formatShortDate(paidDate)}</Text>
                )}
                {typeof item.penalty === 'number' && item.penalty > 0 && (
                     <Text style={styles.penaltyText}>Penalty: {CURRENCY_SYMBOL}{item.penalty.toFixed(2)}</Text>
                )}
            </View>
        );
    };

    // Loading / Error Screens
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

    if (orderError || !currentOrderData) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
                <View style={styles.loadingContainer}>
                    <Text style={styles.errorText}>{orderError || "Order details could not be loaded."}</Text>
                    {navigation.canGoBack() && (
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Text style={styles.errorLink}>Go Back</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </SafeAreaView>
        );
    }

    // --- Derived Values for Rendering ---
    const paymentMethod = currentOrderData.paymentMethod || 'Unknown';
    const relevantPlanDetails = currentOrderData.bnplPlanDetails || currentOrderData.fixedDurationDetails;
    const isRelevantPlanInstallment = relevantPlanDetails?.planType === 'Installment' || paymentMethod === 'BNPL';
    const showCodSection = (paymentMethod === 'COD' || paymentMethod === 'Mixed') && typeof currentOrderData.codAmount === 'number' && currentOrderData.codAmount > 0;
    const showInstallmentSection = (paymentMethod === 'BNPL' || paymentMethod === 'Mixed') && isRelevantPlanInstallment && Array.isArray(currentOrderData.installments);
    const showFixedDurationSection = (paymentMethod === 'Fixed Duration') || (paymentMethod === 'Mixed' && (!!currentOrderData?.paymentDueDate || !!currentOrderData?.fixedDurationDetails));

    const isOrderComplete = currentOrderData.status === COMPLETED_ORDER_STATUS;

    // Logic for Unique Product Reviews
    const allProductIdsInOrder = (currentOrderData.items || [])
        .map(item => item.productId || item.id)
        .filter(id => !!id);
    const uniqueProductIdsInOrder = [...new Set(allProductIdsInOrder)];

    const uniqueProductIdsToReview = isOrderComplete && !loadingReviews && !reviewError
        ? uniqueProductIdsInOrder.filter(productId => !reviewedProductIds.has(productId))
        : [];

    const allUniqueProductsReviewed = isOrderComplete &&
                                    !loadingReviews &&
                                    !reviewError &&
                                    uniqueProductIdsInOrder.length > 0 &&
                                    uniqueProductIdsToReview.length === 0;


    // --- Main Render ---
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
            {/* Added keyboardShouldPersistTaps for better keyboard handling with forms */}
            <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">

                {/* Section 1: Items Ordered */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Items Ordered ({currentOrderData.items?.length || 0})</Text>
                     <View style={styles.itemsListContainer}>
                        <FlatList
                             data={currentOrderData.items || []}
                             renderItem={renderOrderItem}
                             keyExtractor={(itemData, index) => `${itemData?.productId || itemData?.id || 'item'}-${index}`}
                             scrollEnabled={false}
                             ListEmptyComponent={<Text style={styles.emptyListText}>No items found.</Text>}
                        />
                    </View>
                    <View style={styles.orderTotals}>
                         <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal:</Text><Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {(currentOrderData.subtotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>
                         {typeof currentOrderData.deliveryFee === 'number' && currentOrderData.deliveryFee > 0 && (
                             <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Delivery Fee:</Text><Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {currentOrderData.deliveryFee.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>
                         )}
                         <View style={styles.totalDivider} />
                         <View style={styles.summaryRow}><Text style={[styles.summaryLabel, styles.grandTotalLabel]}>Grand Total:</Text><Text style={[styles.summaryValue, styles.grandTotalValue]}>{CURRENCY_SYMBOL} {(currentOrderData.grandTotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>
                    </View>
                </View>

                {/* Section 2: Order Summary */}
                 <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Order Summary</Text>
                    <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Order ID:</Text><Text style={styles.summaryValue}>#{currentOrderData.id?.substring(0, 8).toUpperCase() || 'N/A'}</Text></View>
                    <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Order Date:</Text><Text style={styles.summaryValue}>{formatDate(currentOrderData.createdAt || currentOrderData.orderDate)}</Text></View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Status:</Text>
                        <View style={[styles.statusBadge, getStatusStyle(currentOrderData.status)]}><Text style={styles.statusText}>{currentOrderData.status || 'Unknown'}</Text></View>
                    </View>
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
                    <Text style={styles.detailText}>{currentOrderData.userName || 'N/A'}</Text>
                    <Text style={styles.detailText}>{currentOrderData.userAddress || 'N/A'}</Text>
                    <Text style={styles.detailText}>{currentOrderData.userPhone || 'N/A'}</Text>
                </View>

                {/* Section 4: Payment Information */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment Details</Text>
                    <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Method:</Text><Text style={styles.summaryValue}>{paymentMethod}</Text></View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Payment Status:</Text>
                        <View style={[styles.statusBadge, getStatusStyle(currentOrderData.paymentStatus)]}><Text style={styles.statusText}>{currentOrderData.paymentStatus || 'N/A'}</Text></View>
                    </View>

                    {/* COD Subsection */}
                    {showCodSection && (
                        <View style={styles.paymentSubSection}>
                            <Text style={styles.paymentSubHeader}>Cash on Delivery</Text>
                            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Amount Due (COD):</Text><Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.codAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>
                            {currentOrderData.codPaymentReceivedAt && (
                                <View style={styles.summaryRow}><Text style={styles.summaryLabel}>COD Paid At:</Text><Text style={styles.summaryValue}>{formatDate(currentOrderData.codPaymentReceivedAt)}</Text></View>
                            )}
                        </View>
                    )}
                    {/* Installment Subsection */}
                    {showInstallmentSection && (
                        <View style={styles.paymentSubSection}>
                            <Text style={styles.paymentSubHeader}>Installment Plan Details</Text>
                            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Plan Amount (BNPL):</Text><Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.bnplAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>
                            {relevantPlanDetails && isRelevantPlanInstallment && (
                                <View style={styles.planDetailsBox}>
                                    <Text style={styles.planDetailTitle}>Plan: {relevantPlanDetails.name || 'N/A'}</Text>
                                    <Text style={styles.planDetailText}>Duration: {relevantPlanDetails.duration || 'N/A'} Months</Text>
                                    <Text style={styles.planDetailText}>Interest: {typeof relevantPlanDetails.interestRate === 'number' ? `${(relevantPlanDetails.interestRate * 100).toFixed(1)}%` : 'N/A'}</Text>
                                </View>
                            )}
                            {(currentOrderData.installments?.length > 0) && <Text style={styles.linkText}>(See Full Schedule Below)</Text>}
                        </View>
                     )}
                     {/* Fixed Duration Subsection */}
                    {showFixedDurationSection && (
                        <View style={styles.paymentSubSection}>
                            <Text style={styles.paymentSubHeader}>Fixed Duration Plan Details</Text>
                            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Plan Amount:</Text><Text style={styles.paymentValueHighlight}>{CURRENCY_SYMBOL} {(currentOrderData.fixedDurationAmountDue ?? currentOrderData.bnplAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text></View>
                            <View style={styles.planDetailsBox}>
                                {relevantPlanDetails && <Text style={styles.planDetailTitle}>Plan: {relevantPlanDetails.name || 'Fixed Plan'}</Text>}
                                {relevantPlanDetails && <Text style={styles.planDetailText}>Duration: {relevantPlanDetails.duration || 'N/A'} Months</Text>}
                                {relevantPlanDetails && <Text style={styles.planDetailText}>Interest: {typeof relevantPlanDetails.interestRate === 'number' ? `${(relevantPlanDetails.interestRate * 100).toFixed(1)}%` : 'N/A'}</Text>}
                                <Text style={styles.planDetailText}>Payment Due: {formatShortDate(currentOrderData.paymentDueDate)}</Text>
                                {typeof currentOrderData.penalty === 'number' && currentOrderData.penalty > 0 && (
                                    <Text style={[styles.planDetailText, styles.penaltyText]}>Penalty Applied: {CURRENCY_SYMBOL}{currentOrderData.penalty.toFixed(2)}</Text>
                                )}
                            </View>
                        </View>
                     )}
                 </View>

                {/* Section 5: Installment Schedule */}
                {showInstallmentSection && currentOrderData.installments && currentOrderData.installments.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Installment Schedule</Text>
                        <FlatList
                            data={currentOrderData.installments}
                            keyExtractor={(inst, index) => inst?.installmentNumber ? `inst-${inst.installmentNumber}-${index}` : `inst-fallback-${index}`}
                            renderItem={renderInstallment}
                            scrollEnabled={false}
                            ListEmptyComponent={<Text style={styles.emptyListText}>No installment data found.</Text>}
                        />
                    </View>
                )}

                {/* Section 6: Review Section (Unique Per-Product) */}
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
                                {/* Ensure error message is wrapped */}
                                <Text style={styles.errorText}>{reviewError}</Text>
                            </View>
                        )}

                        {/* Only proceed if review status is loaded without errors */}
                        {!loadingReviews && !reviewError && (
                            <>
                                {/* Case 1: There are unique products left to review */}
                                {uniqueProductIdsToReview.length > 0 && (
                                    <>
                                        {/* Ensure dynamic count is wrapped */}
                                        <Text style={styles.sectionTitle}>Leave Reviews ({uniqueProductIdsToReview.length} remaining)</Text>
                                        {uniqueProductIdsToReview.map((productId, index) => {
                                            const itemData = (currentOrderData.items || []).find(item => (item.productId || item.id) === productId);
                                            if (!itemData) return null; // Explicitly return null if no item data found

                                            return (
                                                <View key={productId} style={styles.reviewItemContainer}>
                                                    <View style={styles.reviewItemHeader}>
                                                         <Image source={itemData.image ? { uri: itemData.image } : placeholderImagePath} style={styles.reviewItemImage} defaultSource={placeholderImagePath}/>
                                                         <Text style={styles.reviewItemName} numberOfLines={2}>{itemData.name || 'N/A'}</Text>
                                                    </View>
                                                    <ReviewForm
                                                        orderId={currentOrderData.id}
                                                        reviewerId={reviewerId}
                                                        productId={productId}
                                                        onReviewSubmitSuccess={handleReviewSuccess}
                                                    />
                                                    {/* Render divider only if it's not the last item */}
                                                    {index < uniqueProductIdsToReview.length - 1 && <View style={styles.reviewItemDivider} />}
                                                </View>
                                            );
                                        })}
                                    </>
                                )}

                                {/* Case 2: Order complete, status loaded, all unique products reviewed */}
                                {allUniqueProductsReviewed && (
                                    <>
                                        <Text style={styles.sectionTitle}>Reviews Submitted</Text>
                                        <Text style={styles.reviewNotAvailableText}>Thank you for reviewing your items!</Text>
                                    </>
                                )}

                                {/* Case 3: Order complete, but no unique products found */}
                                {isOrderComplete && !loadingReviews && !reviewError && uniqueProductIdsInOrder.length === 0 && (
                                     <Text style={styles.reviewNotAvailableText}>There are no items in this order available for review.</Text>
                                )}
                             </>
                        )}
                    </View>
                )}
                {/* --- End Review Section --- */}

            </ScrollView>
        </SafeAreaView>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: ScreenBackgroundColor, },
    scrollContainer: { flexGrow: 1, padding: 15, paddingBottom: 40, paddingTop: 15 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    loadingText: { marginTop: 10, color: TextColorSecondary },
    errorText: { fontSize: 16, color: AccentColor, marginBottom: 15, textAlign: 'center' },
    errorLink: { fontSize: 16, color: '#007AFF', fontWeight: 'bold' },
    section: { backgroundColor: AppBackgroundColor, borderRadius: 8, padding: 15, marginBottom: 15, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1.5, borderWidth: Platform.OS === 'android' ? 0 : 1, borderColor: LightBorderColor, }, // Used LightBorderColor
    sectionTitle: { fontSize: 17, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 8, },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', },
    summaryLabel: { fontSize: 14, color: TextColorSecondary, marginRight: 5 },
    summaryValue: { fontSize: 14, fontWeight: '500', color: TextColorPrimary, textAlign: 'right', flexShrink: 1, },
    statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, alignSelf: 'flex-start', },
    statusText: { fontSize: 12, fontWeight: 'bold', color: '#fff', },
    statusPending: { backgroundColor: PendingStatusColor },
    statusProcessing: { backgroundColor: '#42A5F5' },
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
    installmentText: { fontSize: 13, color: TextColorSecondary, paddingRight: 5, marginBottom: 3, marginTop: 3, flexShrink: 1, },
    statusBadgeSmall: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 10, marginVertical: 3, alignSelf: 'center' },
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
    otpDisplayRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#E8F5E9', borderRadius: 6, borderWidth: 1, borderColor: '#C8E6C9', alignSelf: 'flex-start', },
    otpIcon: { marginRight: 6 },
    otpDisplayLabel: { fontSize: 14, color: TextColorSecondary, marginRight: 8, },
    otpDisplayValue: { fontSize: 15, fontWeight: 'bold', color: SuccessColor, letterSpacing: 2, },
    emptyListText: { color: TextColorSecondary, fontStyle: 'italic', textAlign: 'center', paddingVertical: 10, },

    // --- Review Section Specific Styles ---
    reviewLoadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, minHeight: 60 }, // Added minHeight
    reviewStatusText: { marginLeft: 10, fontSize: 14, color: TextColorSecondary, fontStyle: 'italic' },
    reviewErrorContainer: { paddingVertical: 20, alignItems: 'center', minHeight: 60 }, // Added minHeight
    reviewItemContainer: { marginBottom: 15, paddingBottom: 15, },
    reviewItemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingHorizontal: 5, },
    reviewItemImage: { width: 45, height: 45, borderRadius: 4, marginRight: 12, backgroundColor: PlaceholderBgColor, },
    reviewItemName: { flex: 1, fontSize: 15, fontWeight: '600', color: TextColorPrimary, lineHeight: 20, },
    reviewItemDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 10, marginLeft: -15, marginRight: -15, }, // Stretch divider
    reviewNotAvailableText: { fontSize: 13, fontStyle: 'italic', color: TextColorSecondary, textAlign: 'center', paddingVertical: 15, lineHeight: 18 },
});