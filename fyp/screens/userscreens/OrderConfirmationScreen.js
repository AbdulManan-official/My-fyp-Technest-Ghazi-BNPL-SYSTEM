// OrderConfirmationScreen.js (Complete Code - Checks Existing Orders)

import React, { useState, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
    Alert, ScrollView, ActivityIndicator, StatusBar, Platform,
    SafeAreaView
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { db, auth } from '../../firebaseConfig'; // Adjust path if needed
import {
    doc, serverTimestamp, addDoc, collection, query, where,
    documentId, getDocs, updateDoc, Timestamp, getFirestore, limit // Import necessary Firestore functions
} from 'firebase/firestore';
import axios from 'axios';
import { format } from 'date-fns'; // Ensure installed

// --- Constants ---
const AppBackgroundColor = '#FFFFFF';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#666666';
const AccentColor = '#FF0000';
const LightBorderColor = '#EEEEEE';
const PlaceholderBgColor = '#F0F0F0';
const ScreenBackgroundColor = '#F8F9FA';
const BnplPlanDetailColor = TextColorSecondary;
const BnplPlanValueColor = TextColorPrimary;
const BnplPlanIconColor = '#757575';
const placeholderImagePath = require('../../assets/p3.jpg'); // Adjust path
const CURRENCY_SYMBOL = 'PKR';
const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const ERROR_COLOR = '#D32F2F';
const CARTS_COLLECTION = 'Carts';
const ORDERS_COLLECTION = 'orders';
// Define statuses that indicate an INCOMPLETE BNPL/Fixed order
const INCOMPLETE_BNPL_FIXED_STATUSES = [
    'Partially Paid',
    'Unpaid (Fixed Duration)',
    'Overdue',
    // Add other statuses like 'Pending Payment Confirmation' if needed
];
const BNPL_FIXED_METHODS = ['BNPL', 'Fixed Duration'];


// --- Helper: Fetch Admin Tokens ---
async function getAdminExpoTokens() {
    const tokens = [];
    console.log('[getAdminExpoTokens] Fetching...');
    try {
        const dbInstance = getFirestore();
        const adminQuery = query(collection(dbInstance, 'Admin'), where('role', '==', 'admin'));
        const adminSnapshot = await getDocs(adminQuery);
        if (adminSnapshot.empty) { console.log('[getAdminExpoTokens] No admins found.'); return []; }
        const adminUserIds = adminSnapshot.docs.map((d) => d.id);
        const MAX_IDS_PER_QUERY = 30; const tokenPromises = [];
        for (let i = 0; i < adminUserIds.length; i += MAX_IDS_PER_QUERY) {
            const batchIds = adminUserIds.slice(i, i + MAX_IDS_PER_QUERY);
            const tokensQuery = query( collection(dbInstance, 'Admin'), where(documentId(), 'in', batchIds) );
            tokenPromises.push(getDocs(tokensQuery));
        }
        const snapshots = await Promise.all(tokenPromises);
        snapshots.forEach((tokensSnapshot) => {
            tokensSnapshot.forEach((adminDoc) => {
                const token = adminDoc.data()?.expoPushToken;
                if ( token && typeof token === 'string' && token.startsWith('ExponentPushToken[') ) { tokens.push(token); }
                else { console.warn( `[getAdminExpoTokens] Admin ${adminDoc.id} invalid token.` ); }
            });
        });
        console.log(`[getAdminExpoTokens] Found ${tokens.length} tokens.`);
    } catch (error) { console.error('[getAdminExpoTokens] Error:', error); }
    return tokens;
}

// --- Helper: Render BNPL Details ---
const renderBnplDetailsSection = (item) => {
    const { bnplPlan, quantity, price } = item;
    if (!bnplPlan?.id || typeof price !== 'number' || typeof quantity !== 'number' || quantity <= 0) return null;
    const name = bnplPlan.name || 'Installment Plan'; const duration = bnplPlan.duration; const interestRate = bnplPlan.interestRate; const planType = bnplPlan.planType || 'N/A';
    const formattedInterest = interestRate != null ? `${(interestRate ).toFixed(1)}%` : 'N/A'; const isFixed = planType === 'Fixed Duration'; const numInstallments = !isFixed && duration ? duration : 1;
    let currentMonthlyPayment = null;
    if (!isFixed && duration > 0) { const currentTotalPrice = price * quantity; const monthlyRaw = currentTotalPrice / duration; currentMonthlyPayment = `${CURRENCY_SYMBOL} ${monthlyRaw.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
    return (
        <View style={styles.bnplDetailsContainer}>
            <Text style={styles.bnplPlanTitle}>Payment Plan: {name}</Text>
            {planType !== 'N/A' && (<View style={styles.bnplDetailRow}><Icon name="info-outline" size={14} color={BnplPlanIconColor} style={styles.bnplDetailIcon} /><Text style={styles.bnplDetailText}>Type:{' '}<Text style={styles.bnplDetailValue}>{planType}</Text></Text></View>)}
            {duration && (<View style={styles.bnplDetailRow}><Icon name="schedule" size={14} color={BnplPlanIconColor} style={styles.bnplDetailIcon} /><Text style={styles.bnplDetailText}>Duration:{' '}<Text style={styles.bnplDetailValue}>{duration} {duration === 1 ? 'Month' : 'Months'}</Text>{isFixed ? (<Text style={styles.bnplDetailValue}> (1 Payment)</Text>) : (<Text style={styles.bnplDetailValue}>{' '}/ {numInstallments} Inst.</Text>)}</Text></View>)}
            {currentMonthlyPayment && !isFixed && (<View style={styles.bnplDetailRow}><Icon name="calculate" size={14} color={BnplPlanIconColor} style={styles.bnplDetailIcon} /><Text style={styles.bnplDetailText}>Est. Monthly:{' '}<Text style={styles.bnplDetailValue}>{currentMonthlyPayment}</Text></Text></View>)}
            {interestRate !== null && (<View style={styles.bnplDetailRow}><Icon name="percent" size={14} color={BnplPlanIconColor} style={styles.bnplDetailIcon} /><Text style={styles.bnplDetailText}>Interest:{' '}<Text style={styles.bnplDetailValue}>{formattedInterest}</Text></Text></View>)}
        </View>
    );
};

// --- Helper: Calculate Due Date ---
const calculateDueDate = (baseDateInput, monthOffset) => {
    let baseDate; if (baseDateInput instanceof Timestamp) { baseDate = baseDateInput.toDate(); } else if (baseDateInput instanceof Date) { baseDate = new Date(baseDateInput.getTime()); } else { baseDate = new Date(); } if (typeof monthOffset === 'number' && monthOffset >= 0) { baseDate.setMonth(baseDate.getMonth() + monthOffset); } return Timestamp.fromDate(baseDate);
};

// --- Helper: Generate BNPL Schedule (Excludes First) ---
const generateRemainingBnplInstallments = (bnplTotal, bnplPlanDetails, orderTimestampInput) => {
    if (!bnplPlanDetails || bnplPlanDetails.planType !== 'Installment' || !bnplPlanDetails.duration || bnplPlanDetails.duration <= 1 || bnplTotal <= 0) { return []; }
    let orderDate; if (orderTimestampInput instanceof Timestamp) { orderDate = orderTimestampInput.toDate(); } else if (orderTimestampInput instanceof Date) { orderDate = new Date(orderTimestampInput.getTime()); } else { orderDate = new Date(); } const installments = []; const duration = bnplPlanDetails.duration; const total = Number(bnplTotal); const installmentAmount = Math.round((total / duration) * 100) / 100;
    for (let i = 1; i < duration; i++) { const dueDate = new Date(orderDate); dueDate.setMonth(orderDate.getMonth() + i + 1); installments.push({ installmentNumber: i + 1, amount: parseFloat(installmentAmount.toFixed(2)), dueDate: Timestamp.fromDate(dueDate), paid: false, paidAt: null, penalty: 0, status: 'Pending' }); }
    if (installments.length > 0) { const firstInstallmentAmount = installmentAmount; const remainingCalculatedTotal = installments.reduce((sum, inst) => sum + inst.amount, 0); const totalCalculated = firstInstallmentAmount + remainingCalculatedTotal; const difference = Math.round((total - totalCalculated) * 100) / 100; if (difference !== 0) { installments[installments.length - 1].amount = Math.round((installments[installments.length - 1].amount + difference) * 100) / 100; } }
    console.log("[ConfirmScreen] Generated REMAINING BNPL Installments:", installments); return installments;
};

// --- Main Component ---
export default function OrderConfirmationScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { currentUserDetails, cartItems = [], subTotal = 0, grandTotal = 0 } = route.params || {};
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const totalItemCount = useMemo(() => cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0), [cartItems]);

    // --- Render Confirmation Item ---
    const renderConfirmationItem = useCallback( ({ item, index }) => {
            if (!item?.id || typeof item.price !== 'number' || typeof item.quantity !== 'number' || item.quantity <= 0) return null;
            const itemTotalPrice = item.price * item.quantity; const isLastItem = index === cartItems.length - 1; const isBnpl = item.paymentMethod === 'BNPL' && item.bnplPlan;
            return (
                <View style={[styles.cartItem, isLastItem && styles.lastCartItem]}>
                    <Image source={ item.image ? { uri: item.image } : placeholderImagePath } style={styles.productImage} defaultSource={placeholderImagePath} onError={() => console.warn(`Image failed: ${item.image}`)} />
                    <View style={styles.itemDetails}>
                        <Text style={styles.productName} numberOfLines={2}>{item.name || 'Unnamed Product'}</Text>
                        <Text style={styles.itemQuantityPrice}>Qty: {item.quantity} x{' '}{`${CURRENCY_SYMBOL} ${item.price.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`}</Text>
                        <Text style={styles.itemSubtotal}>Item Total:{' '}<Text style={styles.itemSubtotalValue}>{`${CURRENCY_SYMBOL} ${itemTotalPrice.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`}</Text></Text>
                        {isBnpl && renderBnplDetailsSection(item)}
                    </View>
                </View>
            );
        }, [cartItems]
    );

    // --- Handle Confirm & Place Order (with Existing Order Check) ---
    const handleConfirmAndPlaceOrder = useCallback(async () => {
        if (!currentUserDetails?.uid || !cartItems?.length) { Alert.alert('Error', 'User details or cart items missing.'); return; }

        setIsPlacingOrder(true);
        const userId = currentUserDetails.uid;
        let newOrderId = null;
        const firestoreWriteTimestamp = serverTimestamp();
        const jsOrderPlacementDate = new Date();

        try {
            // --- Check 1: Does the NEW order contain BNPL/Fixed items? ---
            const newOrderHasBnplOrFixed = cartItems.some(item =>
                item.paymentMethod === 'BNPL' || item.paymentMethod === 'Fixed Duration' // Adjust if Fixed Duration is per-item
            );

            // --- Check 2: If yes, query for existing INCOMPLETE BNPL/Fixed orders ---
            if (newOrderHasBnplOrFixed) {
                console.log("[ConfirmScreen] Checking for existing incomplete BNPL/Fixed orders...");
                const ordersRef = collection(db, ORDERS_COLLECTION);
                // ** THIS QUERY MAY REQUIRE A COMPOSITE INDEX IN FIRESTORE **
                // Fields: userId (==), paymentMethod (in), paymentStatus (in)
                const qExisting = query(
                    ordersRef,
                    where('userId', '==', userId),
                    where('paymentMethod', 'in', BNPL_FIXED_METHODS),
                    where('paymentStatus', 'in', INCOMPLETE_BNPL_FIXED_STATUSES),
                    limit(1) // Only need to know if one exists
                );

                const existingIncompleteSnapshot = await getDocs(qExisting);

                if (!existingIncompleteSnapshot.empty) {
                    // BLOCK ORDER PLACEMENT
                    console.warn(`[ConfirmScreen] User ${userId} has active BNPL/Fixed order. Blocking.`);
                    Alert.alert(
                        'Order Restriction',
                        'Please complete your existing BNPL or Fixed Duration payments before placing a new order with these options.',
                        [{ text: 'OK' }]
                    );
                    setIsPlacingOrder(false); // Stop loading
                    return; // EXIT FUNCTION
                } else {
                    console.log("[ConfirmScreen] No existing incomplete BNPL/Fixed orders found.");
                }
            }
            // --- End Check for Existing Orders ---


            // --- Determine Order Characteristics (if proceeding) ---
            const codItems = cartItems.filter(item => item.paymentMethod === 'COD');
            const bnplItems = cartItems.filter(item => item.paymentMethod === 'BNPL' && item.bnplPlan);
            const bnplSubTotal = bnplItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const codSubTotal = codItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const firstBnplItem = bnplItems.length > 0 ? bnplItems[0] : null;
            const relevantBnplPlan = firstBnplItem?.bnplPlan || null;
            const planType = relevantBnplPlan?.planType;
            let overallPaymentMethod = bnplItems.length > 0 ? 'BNPL' : (codItems.length > 0 ? 'COD' : 'Unknown');
            if (bnplItems.length > 0 && codItems.length > 0) overallPaymentMethod = 'Mixed';
            let overallPaymentStatus = 'Pending'; let orderSpecificData = {}; let fullInstallmentSchedule = [];

            if ( (overallPaymentMethod === 'BNPL' || overallPaymentMethod === 'Mixed') && relevantBnplPlan) {
                const bnplPlanDetails = { id: relevantBnplPlan.id || null, name: relevantBnplPlan.name || 'BNPL Plan', duration: relevantBnplPlan.duration, interestRate: relevantBnplPlan.interestRate ?? 0, planType: planType };
                if (planType === 'Installment' && relevantBnplPlan.duration > 0 && bnplSubTotal > 0) {
                    overallPaymentStatus = overallPaymentMethod === 'Mixed' ? 'Mixed (COD/BNPL Pending)' : 'Partially Paid'; // Adjust status for mixed
                    const firstInstallmentAmount = parseFloat((bnplSubTotal / relevantBnplPlan.duration).toFixed(2)); // Based on BNPL total
                    const remainingInstallments = generateRemainingBnplInstallments(bnplSubTotal, relevantBnplPlan, jsOrderPlacementDate); // Based on BNPL total
                    const firstInstallment = { installmentNumber: 1, amount: firstInstallmentAmount, dueDate: Timestamp.fromDate(jsOrderPlacementDate), paid: true, paidAt: Timestamp.fromDate(jsOrderPlacementDate), penalty: 0, status: 'Paid' };
                    fullInstallmentSchedule = [firstInstallment, ...remainingInstallments];
                    if (fullInstallmentSchedule.length > 1) { const totalCalculated = fullInstallmentSchedule.reduce((sum, inst) => sum + inst.amount, 0); const difference = Math.round((bnplSubTotal - totalCalculated) * 100) / 100; if (difference !== 0) { fullInstallmentSchedule[fullInstallmentSchedule.length - 1].amount = Math.round((fullInstallmentSchedule[fullInstallmentSchedule.length - 1].amount + difference) * 100) / 100; } }
                    orderSpecificData = { paymentStatus: overallPaymentStatus, bnplPlanDetails: bnplPlanDetails, installments: fullInstallmentSchedule };
                } else if (planType === 'Fixed Duration' && relevantBnplPlan.duration > 0 && bnplSubTotal > 0) {
                    overallPaymentMethod = 'Fixed Duration'; // Can be primary if only fixed duration items exist
                    overallPaymentStatus = overallPaymentMethod === 'Mixed' ? 'Mixed (COD/Fixed Pending)' : 'Unpaid (Fixed Duration)';
                    const dueDate = calculateDueDate(jsOrderPlacementDate, relevantBnplPlan.duration);
                    orderSpecificData = { paymentStatus: overallPaymentStatus, fixedDurationDetails: bnplPlanDetails, paymentDueDate: dueDate, penalty: 0, fixedDurationAmountDue: bnplSubTotal };
                } else { overallPaymentStatus = 'Pending Review'; orderSpecificData = { paymentStatus: overallPaymentStatus, bnplPlanDetails: bnplPlanDetails }; }
            } else if (overallPaymentMethod === 'COD') { overallPaymentStatus = 'Unpaid (COD)'; orderSpecificData = { paymentStatus: overallPaymentStatus };
            } else { overallPaymentMethod = 'Unknown'; overallPaymentStatus = 'Pending Review'; orderSpecificData = { paymentStatus: overallPaymentStatus }; }

            // Step 1: Prepare Order Data
            const orderDetailsToSave = {
                userId: userId, userName: currentUserDetails.name, userAddress: currentUserDetails.address, userPhone: currentUserDetails.phone,
                items: cartItems.map((item) => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity, image: item.image || null, paymentMethod: item.paymentMethod || 'COD', ...(item.paymentMethod === 'BNPL' && item.bnplPlan && { bnplPlan: { id: item.bnplPlan.id, name: item.bnplPlan.name, duration: item.bnplPlan.duration, interestRate: item.bnplPlan.interestRate, planType: item.bnplPlan.planType } }) })),
                subtotal: subTotal, grandTotal: grandTotal, codAmount: codSubTotal, bnplAmount: bnplSubTotal,
                status: 'Pending', createdAt: firestoreWriteTimestamp, orderDate: firestoreWriteTimestamp, paymentMethod: overallPaymentMethod, ...orderSpecificData
            };

            // Step 2: Save Order
            console.log('[ConfirmScreen] Saving order:', orderDetailsToSave);
            const orderCollectionRef = collection(db, ORDERS_COLLECTION);
            const docRef = await addDoc(orderCollectionRef, orderDetailsToSave);
            newOrderId = docRef.id;
            if (!newOrderId) throw new Error('Failed to get Order ID.');
            console.log('[ConfirmScreen] Order saved:', newOrderId);

            // Step 3: Clear Cart
            try { const cartDocRef = doc(db, CARTS_COLLECTION, userId); await updateDoc(cartDocRef, { items: [], lastUpdated: serverTimestamp() }); console.log(`[ConfirmScreen] Cart cleared.`); }
            catch (cartError) { console.error('[ConfirmScreen] Failed cart clear:', cartError); }

            // Step 4: Send Admin Notifications
            getAdminExpoTokens().then((adminTokens) => {
                 if (!adminTokens?.length) { console.warn('[ConfirmScreen] No admin tokens.'); return; }
                 const messages = adminTokens.map((token) => { if (!token?.startsWith('ExponentPushToken[')) return null; return { to: token, sound: 'default', title: '🚀 New Order Received!', body: `Order #${newOrderId.substring(0,6)}... from ${currentUserDetails.name}. Total: ${CURRENCY_SYMBOL} ${grandTotal.toLocaleString(undefined,{minimumFractionDigits:0, maximumFractionDigits:0})}`, data: { orderId: newOrderId, type: 'new_order' }, priority: 'high', channelId: 'new-orders' }; }).filter(Boolean);
                 if (messages.length > 0) {
                     console.log(`[ConfirmScreen] Sending ${messages.length} notifications...`);
                     axios.post(EXPO_PUSH_ENDPOINT, messages, { headers: { 'Accept': 'application/json', 'Accept-encoding': 'gzip, deflate', 'Content-Type': 'application/json', Host: 'exp.host'}, timeout: 15000 })
                          .then(response => console.log("[ConfirmScreen] Expo API Response Status:", response.status))
                          .catch((err) => console.error('[ConfirmScreen] Axios notification error:', err.response?.data || err.message));
                 }
             }).catch((tokenError) => console.error('[ConfirmScreen] Error fetching admin tokens:', tokenError));

            // Step 5: Show Success & Navigate
            setIsPlacingOrder(false);
            Alert.alert('Order Placed!', `Order (#${newOrderId.substring(0, 8)}...) confirmed.`, [ { text: 'OK', onPress: () => navigation.popToTop() } ]);

        } catch (error) {
            console.error('[ConfirmScreen] Error placing order:', error);
             if (error.code === 'permission-denied') { Alert.alert('Permission Error', 'Could not check existing orders. Please try again.'); }
             else { Alert.alert('Order Failed', `Could not place order. ${error.message || 'Please try again.'}`); }
            setIsPlacingOrder(false);
        }
    }, [currentUserDetails, cartItems, subTotal, grandTotal, navigation]);


    // --- Loading/Error Check ---
    if (!currentUserDetails || !cartItems) {
        return ( <SafeAreaView style={styles.container}><View style={styles.loadingContainer}><Text style={styles.errorText}>Error: Missing order details.</Text><TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.errorLink}>Go Back</Text></TouchableOpacity></View></SafeAreaView> );
    }

    // --- Render ---
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContentContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Delivery Address Section */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Delivery Address</Text>
                    <View style={styles.addressBox}>
                         <Icon name="location-pin" size={24} color={TextColorSecondary} style={styles.addressIcon} />
                         <View style={styles.addressTextContainer}>
                             <Text style={styles.addressName}>{currentUserDetails.name || 'N/A'}</Text>
                             <Text style={styles.addressDetail}>{currentUserDetails.address || 'N/A'}</Text>
                             <Text style={styles.addressDetail}>Phone: {currentUserDetails.phone || 'N/A'}</Text>
                         </View>
                     </View>
                </View>
                {/* Order Items Section */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Order Items ({totalItemCount})</Text>
                    <View style={styles.cartListContainer}>
                        <FlatList data={cartItems} keyExtractor={(item) => item.cartItemId || item.id?.toString() || `confirm-${Math.random()}`} renderItem={renderConfirmationItem} scrollEnabled={false} />
                    </View>
                </View>
                {/* Order Summary Section */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Order Summary</Text>
                    <View style={styles.summaryBox}>
                         <View style={styles.summaryRow}><Text style={styles.summaryText}>Subtotal:</Text><Text style={styles.summaryValue}>{`${CURRENCY_SYMBOL} ${subTotal.toLocaleString(undefined,{minimumFractionDigits: 0, maximumFractionDigits: 0})}`}</Text></View>
                         <View style={styles.summaryRow}><Text style={styles.summaryText}>Total Items:</Text><Text style={styles.summaryValue}>{String(totalItemCount)}</Text></View>
                         <View style={styles.divider} />
                         <View style={styles.summaryRow}><Text style={styles.totalText}>Grand Total:</Text><Text style={styles.totalValue}>{`${CURRENCY_SYMBOL} ${grandTotal.toLocaleString(undefined,{minimumFractionDigits: 0, maximumFractionDigits: 0})}`}</Text></View>
                    </View>
                </View>
            </ScrollView>
            {/* Confirm Button Fixed at Bottom */}
            <View style={styles.footer}>
                <TouchableOpacity style={[styles.confirmButton, isPlacingOrder && styles.disabledButton]} onPress={handleConfirmAndPlaceOrder} disabled={isPlacingOrder} activeOpacity={0.8}>
                    {isPlacingOrder ? (<ActivityIndicator size="small" color="#FFFFFF" />) : (<Text style={styles.confirmButtonText}>Confirm & Place Order</Text>)}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: ScreenBackgroundColor, },
    scrollView: { flex: 1, },
    scrollContentContainer: { flexGrow: 1, paddingHorizontal: 15, paddingTop: 20, paddingBottom: 90, },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
    errorText: { fontSize: 16, color: ERROR_COLOR, textAlign: 'center', marginBottom: 15, },
    errorLink: { fontSize: 16, color: AccentColor, fontWeight: 'bold', },
    sectionContainer: { marginBottom: 25, },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: TextColorPrimary, marginBottom: 12, },
    addressBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: AppBackgroundColor, padding: 15, borderRadius: 10, borderWidth: 1, borderColor: LightBorderColor, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1, },
    addressIcon: { marginRight: 15, color: TextColorSecondary, },
    addressTextContainer: { flex: 1, },
    addressName: { fontSize: 16, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 5, },
    addressDetail: { fontSize: 14, color: TextColorSecondary, lineHeight: 20, marginBottom: 3, },
    cartListContainer: { backgroundColor: AppBackgroundColor, borderRadius: 10, borderWidth: 1, borderColor: LightBorderColor, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1, },
    cartItem: { flexDirection: 'row', padding: 15, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: LightBorderColor, backgroundColor: AppBackgroundColor, },
    lastCartItem: { borderBottomWidth: 0, },
    productImage: { width: 60, height: 60, borderRadius: 8, marginRight: 15, backgroundColor: PlaceholderBgColor, },
    itemDetails: { flex: 1, marginRight: 10, },
    productName: { fontSize: 15, fontWeight: '600', color: TextColorPrimary, marginBottom: 5, },
    itemQuantityPrice: { fontSize: 14, color: TextColorSecondary, marginBottom: 5, },
    itemSubtotal: { fontSize: 14, color: TextColorSecondary, marginTop: 2, },
    itemSubtotalValue: { fontWeight: 'bold', color: TextColorPrimary, },
    bnplDetailsContainer: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F0F0F0', },
    bnplPlanTitle: { fontSize: 13, fontWeight: '600', color: TextColorPrimary, marginBottom: 6, },
    bnplDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, },
    bnplDetailIcon: { marginRight: 6, width: 16, textAlign: 'center', },
    bnplDetailText: { fontSize: 12, color: BnplPlanDetailColor, flexShrink: 1, lineHeight: 16, },
    bnplDetailValue: { fontWeight: '600', color: BnplPlanValueColor, },
    summaryBox: { backgroundColor: AppBackgroundColor, padding: 15, borderRadius: 10, borderWidth: 1, borderColor: LightBorderColor, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1, },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, },
    summaryText: { fontSize: 15, color: TextColorSecondary, },
    summaryValue: { fontSize: 15, fontWeight: '500', color: TextColorPrimary, },
    divider: { height: 1, backgroundColor: LightBorderColor, marginVertical: 10, },
    totalText: { fontSize: 17, fontWeight: 'bold', color: TextColorPrimary, },
    totalValue: { fontSize: 17, fontWeight: 'bold', color: AccentColor, },
    footer: { padding: 15, paddingBottom: Platform.OS === 'ios' ? 30 : 20, backgroundColor: AppBackgroundColor, borderTopWidth: 1, borderTopColor: LightBorderColor, },
    confirmButton: { backgroundColor: AccentColor, paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 52, shadowColor: AccentColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6, },
    disabledButton: { backgroundColor: '#BDBDBD', elevation: 0, shadowOpacity: 0, },
    confirmButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold', },
});