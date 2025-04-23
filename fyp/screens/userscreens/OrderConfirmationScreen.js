// OrderConfirmationScreen.js (COMPLETE - Fixed Cart Clearing & Empty Cart Handling)

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
    documentId, getDocs, updateDoc, Timestamp, getFirestore, limit,
    setDoc // *** Import setDoc ***
} from 'firebase/firestore';
import axios from 'axios';

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

// Define statuses that indicate an INCOMPLETE BNPL/Fixed order for the check
const INCOMPLETE_BNPL_FIXED_STATUSES = [
    'Partially Paid', 'Unpaid (Fixed Duration)', 'Overdue',
    'Unpaid (BNPL)', 'Pending First Installment',
];
const BNPL_FIXED_METHODS = ['BNPL', 'Fixed Duration'];


// --- Helper: Fetch Admin Tokens ---
async function getAdminExpoTokens() {
    const tokens = [];
    console.log('[getAdminExpoTokens] Fetching admin push tokens...');
    try {
        const dbInstance = getFirestore();
        const adminQuery = query(collection(dbInstance, 'Admin'), where('role', '==', 'admin'));
        const adminSnapshot = await getDocs(adminQuery);
        if (adminSnapshot.empty) {
            console.log('[getAdminExpoTokens] No admin users found.');
            return [];
        }
        const adminUserIds = adminSnapshot.docs.map((d) => d.id);
        const MAX_IDS_PER_QUERY = 30;
        const tokenPromises = [];
        for (let i = 0; i < adminUserIds.length; i += MAX_IDS_PER_QUERY) {
            const batchIds = adminUserIds.slice(i, i + MAX_IDS_PER_QUERY);
            const tokensQuery = query(
                collection(dbInstance, 'Admin'),
                where(documentId(), 'in', batchIds)
            );
            tokenPromises.push(getDocs(tokensQuery));
        }
        const snapshots = await Promise.all(tokenPromises);
        snapshots.forEach((tokensSnapshot) => {
            tokensSnapshot.forEach((adminDoc) => {
                const token = adminDoc.data()?.expoPushToken;
                if (token && typeof token === 'string' && token.startsWith('ExponentPushToken[')) {
                    tokens.push(token);
                }
            });
        });
        console.log(`[getAdminExpoTokens] Found ${tokens.length} valid admin tokens.`);
    } catch (error) {
        console.error('[getAdminExpoTokens] Error fetching admin tokens:', error);
    }
    return tokens;
}


// --- Helper: Render BNPL Details ---
const renderBnplDetailsSection = (item) => {
     const { bnplPlan, quantity, price } = item;
    if (!bnplPlan?.id || typeof price !== 'number' || typeof quantity !== 'number' || quantity <= 0) return null;
    const name = bnplPlan.name || 'Installment Plan';
    const duration = bnplPlan.duration;
    const interestRate = bnplPlan.interestRate;
    const planType = bnplPlan.planType || 'N/A';
    const formattedInterest = interestRate != null ? `${(interestRate).toFixed(1)}%` : 'N/A';
    const isFixed = planType === 'Fixed Duration';
    const numInstallments = !isFixed && duration ? duration : 1;
    let currentMonthlyPayment = null;
    if (!isFixed && duration > 0) {
        const currentTotalPrice = price * quantity;
        const monthlyRaw = currentTotalPrice / duration;
        currentMonthlyPayment = `${CURRENCY_SYMBOL} ${monthlyRaw.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return (
        <View style={styles.bnplDetailsContainer}>
            <Text style={styles.bnplPlanTitle}>Payment Plan: {name}</Text>
            {planType !== 'N/A' && (<View style={styles.bnplDetailRow}><Icon name="info-outline" size={14} color={BnplPlanIconColor} style={styles.bnplDetailIcon} /><Text style={styles.bnplDetailText}>Type:{' '}<Text style={styles.bnplDetailValue}>{planType}</Text></Text></View>)}
            {duration != null && duration > 0 && (<View style={styles.bnplDetailRow}><Icon name="schedule" size={14} color={BnplPlanIconColor} style={styles.bnplDetailIcon} /><Text style={styles.bnplDetailText}>Duration:{' '}<Text style={styles.bnplDetailValue}>{duration} {duration === 1 ? 'Month' : 'Months'}</Text>{isFixed ? (<Text style={styles.bnplDetailValue}> (1 Payment)</Text>) : (<Text style={styles.bnplDetailValue}>{' '}/ {numInstallments} Inst.</Text>)}</Text></View>)}
            {currentMonthlyPayment && !isFixed && (<View style={styles.bnplDetailRow}><Icon name="calculate" size={14} color={BnplPlanIconColor} style={styles.bnplDetailIcon} /><Text style={styles.bnplDetailText}>Est. Monthly:{' '}<Text style={styles.bnplDetailValue}>{currentMonthlyPayment}</Text></Text></View>)}
            {interestRate !== null && (<View style={styles.bnplDetailRow}><Icon name="percent" size={14} color={BnplPlanIconColor} style={styles.bnplDetailIcon} /><Text style={styles.bnplDetailText}>Interest:{' '}<Text style={styles.bnplDetailValue}>{formattedInterest}</Text></Text></View>)}
        </View>
    );
};


// --- Helper: Calculate Due Date ---
const calculateDueDate = (baseDateInput, monthOffset) => {
    let baseDate;
    if (baseDateInput instanceof Timestamp) { baseDate = baseDateInput.toDate(); }
    else if (baseDateInput instanceof Date) { baseDate = new Date(baseDateInput.getTime()); }
    else { console.warn("[calculateDueDate] Invalid baseDateInput provided, using current date."); baseDate = new Date(); }
    if (typeof monthOffset === 'number' && monthOffset >= 0) { baseDate.setMonth(baseDate.getMonth() + monthOffset); }
    else if (typeof monthOffset === 'number') { console.warn("[calculateDueDate] Negative monthOffset provided:", monthOffset); }
    return Timestamp.fromDate(baseDate);
};


// --- Helper: Generate ALL BNPL Installments (Initially Unpaid) ---
const generateBnplInstallments = (bnplTotal, bnplPlanDetails, orderTimestampInput) => {
     if (!bnplPlanDetails || bnplPlanDetails.planType !== 'Installment' || !bnplPlanDetails.duration || bnplPlanDetails.duration <= 0 || bnplTotal <= 0) { return []; }
    let orderDate;
    if (orderTimestampInput instanceof Timestamp) { orderDate = orderTimestampInput.toDate(); }
    else if (orderTimestampInput instanceof Date) { orderDate = new Date(orderTimestampInput.getTime()); }
    else { orderDate = new Date(); }
    const installments = []; const duration = bnplPlanDetails.duration; const total = Number(bnplTotal);
    const installmentAmount = Math.round((total / duration) * 100) / 100;
    if (isNaN(installmentAmount) || installmentAmount < 0) {
         console.error("[generateBnplInstallments] Invalid installment amount calculated. Aborting.");
         return [];
    }
    for (let i = 0; i < duration; i++) {
        const dueDate = calculateDueDate(orderDate, i + 1);
        installments.push({ installmentNumber: i + 1, amount: parseFloat(installmentAmount.toFixed(2)), dueDate: dueDate, paid: false, paidAt: null, penalty: 0, status: 'Pending' });
    }
    if (installments.length > 0) {
        const totalCalculated = installments.reduce((sum, inst) => sum + inst.amount, 0);
        const difference = Math.round((total - totalCalculated) * 100) / 100;
        if (difference !== 0) {
             const adjustedAmount = Math.round((installments[installments.length - 1].amount + difference) * 100) / 100;
             if (adjustedAmount >= 0) {
                 installments[installments.length - 1].amount = adjustedAmount;
             } else {
                 console.warn("[generateBnplInstallments] Final installment adjustment resulted in negative amount. Setting to 0.");
                 installments[installments.length - 1].amount = 0;
             }
        }
    }
    console.log("[ConfirmScreen] Generated BNPL Installments (all initially unpaid):", installments);
    return installments;
};


// --- Main Component ---
export default function OrderConfirmationScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { currentUserDetails, cartItems = [], subTotal = 0, grandTotal = 0 } = route.params || {};
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);

    const totalItemCount = useMemo(() => {
        if (!Array.isArray(cartItems)) return 0;
        return cartItems.reduce((sum, item) => sum + (item?.quantity || 0), 0);
    }, [cartItems]);

    const isCartEmpty = !cartItems || cartItems.length === 0;

    // --- Render Confirmation Item ---
    const renderConfirmationItem = useCallback(({ item, index }) => {
             if (!item?.id || typeof item.price !== 'number' || typeof item.quantity !== 'number' || item.quantity <= 0) { console.warn("Skipping rendering invalid cart item:", item); return null; }
            const itemTotalPrice = item.price * item.quantity;
            const isLastItem = index === cartItems.length - 1;
            const isBnpl = item.paymentMethod === 'BNPL' && item.bnplPlan;
            return (
                <View style={[styles.cartItem, isLastItem && styles.lastCartItem]}>
                    <Image source={item.image ? { uri: item.image } : placeholderImagePath} style={styles.productImage} defaultSource={placeholderImagePath} onError={(e) => console.warn(`Image failed to load: ${item.image || 'N/A'}`, e.nativeEvent.error)} />
                    <View style={styles.itemDetails}>
                        <Text style={styles.productName} numberOfLines={2}>{item.name || 'Unnamed Product'}</Text>
                        <Text style={styles.itemQuantityPrice}>Qty: {item.quantity} x{' '}{`${CURRENCY_SYMBOL} ${item.price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}</Text>
                        <Text style={styles.itemSubtotal}>Item Total:{' '}<Text style={styles.itemSubtotalValue}>{`${CURRENCY_SYMBOL} ${itemTotalPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}</Text></Text>
                        {isBnpl && renderBnplDetailsSection(item)}
                    </View>
                </View>
            );
        }, [cartItems] // Keep dependencies specific
    );


    // --- Handle Confirm & Place Order ---
    const handleConfirmAndPlaceOrder = useCallback(async () => {
        // Enhanced Initial Check
        if (!currentUserDetails?.uid || !Array.isArray(cartItems) || cartItems.length === 0) {
            Alert.alert('Error', 'Cannot place order: User details missing or cart is empty.');
            console.warn("Order placement stopped due to missing details or empty cart.", { hasUser: !!currentUserDetails?.uid, cartLength: cartItems?.length });
            setIsPlacingOrder(false);
            return;
        }

        setIsPlacingOrder(true);
        const userId = currentUserDetails.uid;
        let newOrderId = null;
        const firestoreWriteTimestamp = serverTimestamp();
        const jsOrderPlacementDate = new Date();

        try {
            // === Check for Existing Incomplete BNPL/Fixed Orders ===
            const newOrderHasBnplOrFixed = cartItems.some(item => item?.paymentMethod === 'BNPL' || item?.paymentMethod === 'Fixed Duration');
            if (newOrderHasBnplOrFixed) {
                 console.log("[ConfirmScreen] Checking for existing incomplete BNPL/Fixed orders for user:", userId);
                const ordersRef = collection(db, ORDERS_COLLECTION);
                const qExisting = query( ordersRef, where('userId', '==', userId), where('paymentMethod', 'in', BNPL_FIXED_METHODS), where('paymentStatus', 'in', INCOMPLETE_BNPL_FIXED_STATUSES), limit(1) );
                 try {
                    const existingIncompleteSnapshot = await getDocs(qExisting);
                    if (!existingIncompleteSnapshot.empty) {
                        console.warn(`[ConfirmScreen] User ${userId} has an active incomplete BNPL/Fixed order. Blocking new order.`);
                        Alert.alert( 'Order Restriction', 'You have an existing payment plan that is not yet complete. Please settle your current BNPL or Fixed Duration payments before placing a new order with these options.', [{ text: 'OK' }] );
                        setIsPlacingOrder(false); return;
                    } else { console.log("[ConfirmScreen] No existing incomplete BNPL/Fixed orders found. Proceeding."); }
                 } catch (queryError) {
                     console.error("[ConfirmScreen] Error querying existing orders:", queryError);
                     Alert.alert('Error', 'Could not verify existing payments. Please check your connection and try again.');
                     setIsPlacingOrder(false); return;
                 }
            }
            // === End Existing Order Check ===

            // === Determine Order Characteristics ===
            const codItems = cartItems.filter(item => item?.paymentMethod === 'COD');
            const bnplItems = cartItems.filter(item => item?.paymentMethod === 'BNPL' && item.bnplPlan);
            const bnplSubTotal = bnplItems.reduce((sum, item) => sum + ((item?.price || 0) * (item?.quantity || 0)), 0);
            const codSubTotal = codItems.reduce((sum, item) => sum + ((item?.price || 0) * (item?.quantity || 0)), 0);
            const firstBnplItem = bnplItems.length > 0 ? bnplItems[0] : null;
            const relevantBnplPlan = firstBnplItem?.bnplPlan || null;
            const planType = relevantBnplPlan?.planType;
            let overallPaymentMethod = 'Unknown';
            if (bnplItems.length > 0 && codItems.length > 0) { overallPaymentMethod = 'Mixed'; }
            else if (bnplItems.length > 0) { overallPaymentMethod = relevantBnplPlan?.planType === 'Fixed Duration' ? 'Fixed Duration' : 'BNPL'; }
            else if (codItems.length > 0) { overallPaymentMethod = 'COD'; }
            let overallPaymentStatus = 'Pending';
            let orderSpecificData = {};
            let fullInstallmentSchedule = [];
            const isBnplInstallmentOrder = ( (overallPaymentMethod === 'BNPL' || overallPaymentMethod === 'Mixed') && planType === 'Installment' );

            if (relevantBnplPlan && (overallPaymentMethod === 'BNPL' || overallPaymentMethod === 'Mixed' || overallPaymentMethod === 'Fixed Duration')) {
                const bnplPlanDetails = { id: relevantBnplPlan.id || null, name: relevantBnplPlan.name || 'Payment Plan', duration: relevantBnplPlan.duration, interestRate: relevantBnplPlan.interestRate ?? 0, planType: planType };
                if (planType === 'Installment' && relevantBnplPlan.duration > 0 && bnplSubTotal > 0) {
                    overallPaymentStatus = overallPaymentMethod === 'Mixed' ? 'Mixed (COD/BNPL Pending)' : 'Unpaid (BNPL)';
                    fullInstallmentSchedule = generateBnplInstallments(bnplSubTotal, relevantBnplPlan, jsOrderPlacementDate);
                    orderSpecificData = { paymentStatus: overallPaymentStatus, bnplPlanDetails: bnplPlanDetails, installments: fullInstallmentSchedule };
                } else if (planType === 'Fixed Duration' && relevantBnplPlan.duration >= 0 && bnplSubTotal > 0) {
                    // Ensure method is set correctly if not mixed
                    if(overallPaymentMethod !== 'Mixed') overallPaymentMethod = 'Fixed Duration';
                    overallPaymentStatus = overallPaymentMethod === 'Mixed' ? 'Mixed (COD/Fixed Pending)' : 'Unpaid (Fixed Duration)';
                    const dueDate = calculateDueDate(jsOrderPlacementDate, relevantBnplPlan.duration > 0 ? relevantBnplPlan.duration : 1); // Handle duration 0
                    orderSpecificData = { paymentStatus: overallPaymentStatus, fixedDurationDetails: bnplPlanDetails, paymentDueDate: dueDate, penalty: 0, fixedDurationAmountDue: bnplSubTotal };
                } else {
                    overallPaymentStatus = 'Pending Review';
                    orderSpecificData = { paymentStatus: overallPaymentStatus, bnplPlanDetails: bnplPlanDetails };
                }
            } else if (overallPaymentMethod === 'COD') {
                overallPaymentStatus = 'Unpaid (COD)';
                orderSpecificData = { paymentStatus: overallPaymentStatus };
            } else {
                overallPaymentMethod = 'Unknown';
                overallPaymentStatus = 'Pending Review';
                orderSpecificData = { paymentStatus: overallPaymentStatus };
            }
            // --- End Payment Method Logic ---

            // === Step 1: Prepare Order Data for Firestore ===
            let firstInstallmentPref = null;
            if (isBnplInstallmentOrder) {
                firstInstallmentPref = 'Pending Choice';
            }
            const orderDetailsToSave = {
                userId: userId, userName: currentUserDetails.name || 'N/A', userAddress: currentUserDetails.address || 'N/A', userPhone: currentUserDetails.phone || 'N/A',
                items: cartItems.map((item) => ({ // Safely map items
                    id: item?.id || null, name: item?.name || 'N/A', price: item?.price || 0, quantity: item?.quantity || 0, image: item?.image || null, paymentMethod: item?.paymentMethod || 'COD',
                    ...(item?.paymentMethod === 'BNPL' && item.bnplPlan && { bnplPlan: { id: item.bnplPlan.id, name: item.bnplPlan.name, duration: item.bnplPlan.duration, interestRate: item.bnplPlan.interestRate, planType: item.bnplPlan.planType } })
                 })).filter(item => item.id && item.quantity > 0), // Ensure valid items are saved
                subtotal: subTotal, grandTotal: grandTotal, codAmount: codSubTotal, bnplAmount: bnplSubTotal,
                status: 'Pending', createdAt: firestoreWriteTimestamp, orderDate: firestoreWriteTimestamp, paymentMethod: overallPaymentMethod,
                ...orderSpecificData,
                firstInstallmentPaymentPreference: firstInstallmentPref
            };

             // Final check before saving
             if (!orderDetailsToSave.items || orderDetailsToSave.items.length === 0) {
                  throw new Error("Order contains no valid items after processing.");
             }


            // === Step 2: Save Order to Firestore ===
            console.log('[ConfirmScreen] Attempting to save order:', orderDetailsToSave);
            const orderCollectionRef = collection(db, ORDERS_COLLECTION);
            const docRef = await addDoc(orderCollectionRef, orderDetailsToSave);
            newOrderId = docRef.id;
            if (!newOrderId) { throw new Error('Failed to get Order ID after saving.'); }
            console.log('[ConfirmScreen] Order successfully saved with ID:', newOrderId);


            // === Step 3: Clear User's Cart (Using setDoc) ===
            try {
                const cartDocRef = doc(db, CARTS_COLLECTION, userId);
                // Use setDoc with merge to handle missing cart document gracefully
                await setDoc(cartDocRef,
                    { items: [], lastUpdated: serverTimestamp() },
                    { merge: true }
                );
                console.log(`[ConfirmScreen] Cart document ensured empty for user ${userId}.`);
            } catch (cartError) {
                // Log error if setDoc fails (e.g., permission issues)
                console.error('[ConfirmScreen] Error ensuring user cart was empty after order placement:', cartError);
            }
            // --- END MODIFICATION ---


            // === Step 4: Send Admin Push Notifications ===
            getAdminExpoTokens().then((adminTokens) => {
                if (!adminTokens || adminTokens.length === 0) { console.warn('[ConfirmScreen] No admin tokens found or fetched. Skipping notification.'); return; }
                const messages = adminTokens.map((token) => { if (!token?.startsWith('ExponentPushToken[')) return null; return { to: token, sound: 'default', title: '🚀 New Order Received!', body: `Order #${newOrderId.substring(0, 6)}... from ${currentUserDetails.name || 'User'}. Total: ${CURRENCY_SYMBOL} ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, data: { orderId: newOrderId, type: 'new_order' }, priority: 'high', channelId: 'new-orders' }; }).filter(Boolean);
                if (messages.length > 0) {
                    console.log(`[ConfirmScreen] Sending ${messages.length} push notifications to admins...`);
                    axios.post(EXPO_PUSH_ENDPOINT, messages, { headers: { 'Accept': 'application/json', 'Accept-encoding': 'gzip, deflate', 'Content-Type': 'application/json', 'Host': 'exp.host' }, timeout: 15000 })
                    .then(response => { console.log("[ConfirmScreen] Expo Push API Response Status:", response.status); })
                    .catch((err) => { console.error('[ConfirmScreen] Axios error sending push notification:', err.response?.data || err.message); });
                } else { console.log('[ConfirmScreen] No valid admin notification messages to send.'); }
            }).catch((tokenError) => { console.error('[ConfirmScreen] Error occurred during the process of fetching admin tokens for notification:', tokenError); });


            // === Step 5: Show Success Message & Handle User Choice (with Update) ===
             setIsPlacingOrder(false);
            if (isBnplInstallmentOrder) {
                Alert.alert( 'Order Placed & First Installment', `Your Order (#${newOrderId.substring(0, 8)}...) has been confirmed.\n\nHow would you like to handle the first installment payment?`,
                    [
                        { text: 'Pay Now', onPress: async () => { console.log(`[ConfirmScreen] User chose 'Pay Now' for order ${newOrderId}.`); try { const orderDocRef = doc(db, ORDERS_COLLECTION, newOrderId); await updateDoc(orderDocRef, { firstInstallmentPaymentPreference: 'Pay Now' }); console.log(`[ConfirmScreen] Order ${newOrderId} preference updated to 'Pay Now'.`); } catch (updateError) { console.error(`[ConfirmScreen] Error updating order preference to 'Pay Now':`, updateError); } finally { navigation.popToTop(); } } },
                        { text: 'Pay at Delivery', onPress: async () => { console.log(`[ConfirmScreen] User chose 'Pay at Delivery' for order ${newOrderId}.`); try { const orderDocRef = doc(db, ORDERS_COLLECTION, newOrderId); await updateDoc(orderDocRef, { firstInstallmentPaymentPreference: 'Pay at Delivery' }); console.log(`[ConfirmScreen] Order ${newOrderId} preference updated to 'Pay at Delivery'.`); } catch (updateError) { console.error(`[ConfirmScreen] Error updating order preference to 'Pay at Delivery':`, updateError); } finally { navigation.popToTop(); } } }
                    ],
                    { cancelable: false }
                );
            } else {
                Alert.alert( 'Order Placed Successfully!', `Your Order (#${newOrderId.substring(0, 8)}...) has been confirmed.`, [ { text: 'OK', onPress: () => navigation.popToTop() } ], { cancelable: false } );
            }

        } catch (error) {
             console.error('[ConfirmScreen] Critical error during order placement process:', error);
            setIsPlacingOrder(false);
            let errorMessage = 'Could not place your order due to an unexpected issue. Please try again.';
            if (error.code === 'permission-denied') { errorMessage = 'Permission Error: Could not save the order or check existing payments. Please ensure you are logged in with the correct account and try again.'; }
            else if (error.message?.includes('Firestore Index Required') || error.message?.includes('requires an index')) { errorMessage = 'There was a problem checking your payment history. Please try again shortly. (Index error possible)'; }
            else if (error.message) { errorMessage = `Failed to place order: ${error.message}`; }
            Alert.alert('Order Placement Failed', errorMessage);
        }
    }, [currentUserDetails, cartItems, subTotal, grandTotal, navigation]);


    // --- Loading/Error Check before main render ---
    if (!currentUserDetails) {
         return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.errorText}>Error: User details are missing.</Text>
                    <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.errorLink}>Go Back</Text></TouchableOpacity>
                </View>
            </SafeAreaView>
         );
    }

    // --- Empty Cart Check ---
    if (isCartEmpty) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
                <View style={styles.emptyCartContainer}>
                    <Icon name="remove-shopping-cart" size={60} color={TextColorSecondary} />
                    <Text style={styles.emptyCartText}>Your cart is empty.</Text>
                    <Text style={styles.emptyCartSubText}>Add items to your cart before placing an order.</Text>
                    <TouchableOpacity style={styles.goBackButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.goBackButtonText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }


    // --- Render Main Screen (Only if cart is NOT empty) ---
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContentContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
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
                        <FlatList data={cartItems} keyExtractor={(item) => item.cartItemId || item.id?.toString() || `confirm-item-${Math.random()}`} renderItem={renderConfirmationItem} scrollEnabled={false} ListEmptyComponent={<Text style={styles.emptyListText}>No items in order.</Text>} />
                    </View>
                </View>

                {/* Order Summary Section */}
                <View style={styles.sectionContainer}>
                     <Text style={styles.sectionTitle}>Order Summary</Text>
                    <View style={styles.summaryBox}>
                         <View style={styles.summaryRow}><Text style={styles.summaryText}>Subtotal:</Text><Text style={styles.summaryValue}>{`${CURRENCY_SYMBOL} ${subTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}</Text></View>
                         <View style={styles.summaryRow}><Text style={styles.summaryText}>Total Items:</Text><Text style={styles.summaryValue}>{String(totalItemCount)}</Text></View>
                         <View style={styles.divider} />
                         <View style={styles.summaryRow}><Text style={styles.totalText}>Grand Total:</Text><Text style={styles.totalValue}>{`${CURRENCY_SYMBOL} ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}</Text></View>
                    </View>
                </View>
            </ScrollView>

            {/* Footer Area with Confirm Button */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[ styles.confirmButton, (isPlacingOrder || isCartEmpty) && styles.disabledButton ]}
                    onPress={handleConfirmAndPlaceOrder}
                    disabled={isPlacingOrder || isCartEmpty}
                    activeOpacity={0.8}
                >
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
    emptyCartContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, },
    emptyCartText: { fontSize: 18, fontWeight: '600', color: TextColorPrimary, marginTop: 20, marginBottom: 8, textAlign: 'center', },
    emptyCartSubText: { fontSize: 14, color: TextColorSecondary, textAlign: 'center', marginBottom: 30, },
    goBackButton: { backgroundColor: AccentColor, paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8, },
    goBackButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', },
    sectionContainer: { marginBottom: 25, },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: TextColorPrimary, marginBottom: 12, },
    addressBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: AppBackgroundColor, padding: 15, borderRadius: 10, borderWidth: 1, borderColor: LightBorderColor, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, },
    addressIcon: { marginRight: 15, color: TextColorSecondary, },
    addressTextContainer: { flex: 1, },
    addressName: { fontSize: 16, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 5, },
    addressDetail: { fontSize: 14, color: TextColorSecondary, lineHeight: 20, marginBottom: 3, },
    cartListContainer: { backgroundColor: AppBackgroundColor, borderRadius: 10, borderWidth: 1, borderColor: LightBorderColor, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, },
    cartItem: { flexDirection: 'row', padding: 15, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: LightBorderColor, backgroundColor: AppBackgroundColor, },
    lastCartItem: { borderBottomWidth: 0, },
    emptyListText: { padding: 20, textAlign: 'center', color: TextColorSecondary, },
    productImage: { width: 60, height: 60, borderRadius: 8, marginRight: 15, backgroundColor: PlaceholderBgColor, },
    itemDetails: { flex: 1, justifyContent: 'center', },
    productName: { fontSize: 15, fontWeight: '600', color: TextColorPrimary, marginBottom: 5, },
    itemQuantityPrice: { fontSize: 14, color: TextColorSecondary, marginBottom: 5, },
    itemSubtotal: { fontSize: 14, color: TextColorSecondary, marginTop: 2, },
    itemSubtotalValue: { fontWeight: 'bold', color: TextColorPrimary, },
    bnplDetailsContainer: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F0F0F0', },
    bnplPlanTitle: { fontSize: 13, fontWeight: '600', color: TextColorPrimary, marginBottom: 6, },
    bnplDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, },
    bnplDetailIcon: { marginRight: 6, width: 16, textAlign: 'center', color: BnplPlanIconColor, },
    bnplDetailText: { fontSize: 12, color: BnplPlanDetailColor, flexShrink: 1, lineHeight: 16, },
    bnplDetailValue: { fontWeight: '600', color: BnplPlanValueColor, },
    summaryBox: { backgroundColor: AppBackgroundColor, padding: 15, borderRadius: 10, borderWidth: 1, borderColor: LightBorderColor, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center', },
    summaryText: { fontSize: 15, color: TextColorSecondary, },
    summaryValue: { fontSize: 15, fontWeight: '500', color: TextColorPrimary, },
    divider: { height: 1, backgroundColor: LightBorderColor, marginVertical: 10, },
    totalText: { fontSize: 17, fontWeight: 'bold', color: TextColorPrimary, },
    totalValue: { fontSize: 17, fontWeight: 'bold', color: AccentColor, },
    footer: { paddingHorizontal: 15, paddingTop: 15, paddingBottom: Platform.OS === 'ios' ? 30 : 20, backgroundColor: AppBackgroundColor, borderTopWidth: 1, borderTopColor: LightBorderColor, },
    confirmButton: { backgroundColor: AccentColor, paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 52, shadowColor: AccentColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6, },
    disabledButton: { backgroundColor: '#BDBDBD', elevation: 0, shadowOpacity: 0, }, // Style for disabled button
    confirmButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold', },
});