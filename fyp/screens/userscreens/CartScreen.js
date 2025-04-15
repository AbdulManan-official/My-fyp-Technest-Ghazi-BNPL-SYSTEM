import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
    SafeAreaView // Import SafeAreaView
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, updateDoc, onSnapshot, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Adjust path if needed

// --- Constants ---
const CARTS_COLLECTION = 'Carts';
const PLACEHOLDER_IMAGE_URL = 'https://via.placeholder.com/150/CCCCCC/FFFFFF?text=No+Image';
const CURRENCY_SYMBOL = 'PKR';
const HEADER_COLOR = '#FF0000';
const ACCENT_COLOR_CHECKOUT = '#FF0000';
const ACCENT_COLOR_ADD = '#4CAF50';
const ERROR_COLOR = '#D32F2F';
const BACKGROUND_COLOR = '#F8F9FA';
const CARD_BACKGROUND_COLOR = '#FFFFFF';
const BORDER_COLOR = '#EEEEEE';
const PRIMARY_TEXT_COLOR = '#212121';
const SECONDARY_TEXT_COLOR = '#757575';
const PRICE_COLOR = '#C70039';
const BNPL_BADGE_BG = '#E3F2FD';
const BNPL_BADGE_TEXT = '#1565C0';
const COD_BADGE_BG = '#FFF3E0';
const COD_BADGE_TEXT = '#EF6C00';
const BNPL_DETAIL_ICON_COLOR = '#546E7A';
const BNPL_DETAIL_TEXT_COLOR = '#455A64';
const PRIMARY_TEXT_COLOR_ORIGINAL = '#212121';
const SECONDARY_TEXT_COLOR_ORIGINAL = '#666666';


export default function CartScreen() {
    // --- State and Hooks ---
    const [cartItems, setCartItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigation = useNavigation();
    const auth = getAuth();
    const user = auth.currentUser;

    // --- Firestore Listener Effect ---
    useEffect(() => {
        if (!user) {
            setIsLoading(false); setError("Please log in to view your cart."); setCartItems([]); return;
        }
        setIsLoading(true); setError(null); const cartDocRef = doc(db, CARTS_COLLECTION, user.uid);
        const unsubscribe = onSnapshot(cartDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data(); const itemsArray = Array.isArray(data?.items) ? data.items : [];
                let itemIndex = 0; // Counter for fallback key generation if needed
                const validatedItems = itemsArray.map(item => {
                     // *** REFINED cartItemId generation ***
                    // Prefer existing cartItemId, otherwise generate a more robust fallback
                    const generatedFallbackId = `${item.productId || 'unknown'}_${item.paymentMethod || 'unk'}_${item.bnplPlan?.id || 'NA'}_${itemIndex++}`;
                    const finalCartItemId = item.cartItemId || generatedFallbackId;

                    return {
                        ...item,
                        cartItemId: finalCartItemId, // Use the final determined ID
                        quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
                        priceAtAddition: typeof item.priceAtAddition === 'number' ? item.priceAtAddition : 0,
                        productId: item.productId || 'unknown',
                        productName: item.productName || 'Unknown Product',
                        image: item.image || PLACEHOLDER_IMAGE_URL,
                        bnplPlan: item.paymentMethod === 'BNPL' && item.bnplPlan ? {
                            id: item.bnplPlan.id || null,
                            name: item.bnplPlan.name || item.bnplPlan.planName || 'Installment Plan',
                            duration: typeof item.bnplPlan.duration === 'number' ? item.bnplPlan.duration : null,
                            interestRate: typeof item.bnplPlan.interestRate === 'number' ? item.bnplPlan.interestRate : null,
                            planType: item.bnplPlan.planType || 'Unknown',
                            calculatedMonthly: typeof item.bnplPlan.calculatedMonthly === 'number' ? item.bnplPlan.calculatedMonthly : null,
                        } : null,
                        paymentMethod: item.paymentMethod || 'COD',
                    };
                });
                setCartItems(validatedItems);
            } else { setCartItems([]); }
            setIsLoading(false);
        }, (err) => { console.error("Error listening to cart updates:", err); setError("Failed to load cart items."); setIsLoading(false); });
        return () => { console.log("Unsubscribing from cart listener"); unsubscribe(); };
    }, [user]);

    // --- Firestore Update Functions ---
    const removeItem = async (itemToRemove) => {
        // Ensure we use the correct cartItemId for removal
        if (!user || !itemToRemove || !itemToRemove.cartItemId) {
            Alert.alert("Error", "Could not remove item (Missing ID).");
            return;
        }
        const cartDocRef = doc(db, CARTS_COLLECTION, user.uid);
        try {
            const currentCartSnap = await getDoc(cartDocRef);
            if (currentCartSnap.exists()) {
                const currentItems = currentCartSnap.data().items || [];
                 // Find the exact object based on the UNIQUE cartItemId
                const itemObjectToRemove = currentItems.find(item => item.cartItemId === itemToRemove.cartItemId);

                if (itemObjectToRemove) {
                    await updateDoc(cartDocRef, {
                        items: arrayRemove(itemObjectToRemove),
                        lastUpdated: serverTimestamp()
                    });
                    console.log(`Item removed: ${itemToRemove.cartItemId}`);
                     // No need to update local state here, onSnapshot will handle it
                } else {
                     // This case means the item might already be removed or the ID is wrong
                     console.warn(`Item with cartItemId ${itemToRemove.cartItemId} not found in Firestore for removal.`);
                     // Force local state update just in case onSnapshot missed it
                     setCartItems(prev => prev.filter(i => i.cartItemId !== itemToRemove.cartItemId));
                }
            } else {
                 console.warn("Cart document doesn't exist while trying to remove.");
            }
        } catch (err) { console.error("Error removing item:", err); Alert.alert("Error", "Could not remove item."); }
    };


    const updateQuantity = async (cartItemId, action) => {
        if (!user || !cartItemId) { Alert.alert("Error", "Could not update quantity."); return; }
        const cartDocRef = doc(db, CARTS_COLLECTION, user.uid);
        try {
            const currentCartSnap = await getDoc(cartDocRef);
            if (!currentCartSnap.exists()) { console.error("Cart not found for update."); return; }

            const currentItems = currentCartSnap.data().items || [];
            const itemIndex = currentItems.findIndex(item => item.cartItemId === cartItemId); // Use unique cartItemId
            if (itemIndex === -1) { Alert.alert("Error", "Item not found in cart for update."); return; }

            const currentItem = currentItems[itemIndex];
            const currentQuantity = currentItem.quantity || 1;
            let newQuantity = action === 'increase' ? currentQuantity + 1 : currentQuantity - 1;

            if (newQuantity < 1) {
                Alert.alert( "Remove Item?", `Remove "${currentItem.productName || 'this item'}" from your cart?`,
                    [ { text: "Cancel", style: "cancel" }, { text: "Remove", onPress: () => removeItem(currentItem), style: "destructive" } ] );
                return;
            }

            // Create the updated items array
            const updatedItemsArray = currentItems.map((item, index) => {
                if (index === itemIndex) {
                    // Only update quantity, keep other fields including cartItemId
                    return { ...item, quantity: newQuantity };
                }
                return item;
            });

            await updateDoc(cartDocRef, {
                items: updatedItemsArray,
                lastUpdated: serverTimestamp()
            });
            console.log(`Quantity updated for ${cartItemId} to ${newQuantity}.`);
             // No need to update local state here, onSnapshot will handle it

        } catch (err) { console.error("Error updating quantity:", err); Alert.alert("Error", "Could not update quantity."); }
    };


    // --- Calculations ---
    const totalPrice = cartItems.reduce((acc, item) => {
        const price = typeof item.priceAtAddition === 'number' ? item.priceAtAddition : 0;
        const quantity = typeof item.quantity === 'number' ? item.quantity : 1;
        return acc + (price * quantity);
    }, 0);

    const totalQuantityCount = cartItems.reduce((acc, item) => {
        return acc + (item.quantity || 1);
    }, 0);

    // --- Navigation Handlers ---
     const handleCheckout = () => {
        if (!cartItems || cartItems.length === 0) {
            Alert.alert("Empty Cart", "Your cart is empty.");
            return;
        }
        const bnplItems = cartItems.filter(item => item.paymentMethod === 'BNPL');
        const bnplItemCount = bnplItems.length;
        if (bnplItemCount > 1) {
            Alert.alert(
                "Multiple Installment Items",
                "You can only checkout with one item on an installment plan at a time. Please remove additional installment items from your cart before proceeding.",
                [{ text: "OK" }]
            );
            return;
        }

        // Prepare items for CheckoutScreen (ensure data is consistent)
        const itemsForCheckout = cartItems.map(item => {
            // Double-check bnplPlan structure before passing
             const planDetails = item.paymentMethod === 'BNPL' && item.bnplPlan ? {
                    id: item.bnplPlan.id,
                    name: item.bnplPlan.name,
                    duration: item.bnplPlan.duration,
                    interestRate: item.bnplPlan.interestRate,
                    planType: item.bnplPlan.planType,
                    calculatedMonthly: item.bnplPlan.calculatedMonthly,
                } : null;

             if (item.paymentMethod === 'BNPL' && !planDetails?.id) {
                 console.warn(`Missing BNPL Plan ID for cart item ${item.cartItemId} during checkout prep.`);
                 // Optionally handle this case, e.g., show an error or default plan?
                 // For now, it will pass null as bnplPlan
             }

            return {
                id: item.productId,
                cartItemId: item.cartItemId, // Pass the unique cart ID
                name: item.productName,
                image: item.image,
                quantity: item.quantity,
                price: item.priceAtAddition,
                paymentMethod: item.paymentMethod,
                bnplPlan: planDetails, // Pass the verified/structured plan
            };
        });

        console.log(`Proceeding to checkout with ${itemsForCheckout.length} mapped items.`);
        navigation.navigate('CheckoutScreen', {
            cartItems: itemsForCheckout,
            totalPrice: totalPrice
        });
    };

    const handleProductPress = (item) => {
        if (item && item.productId && item.productId !== 'unknown') {
            navigation.navigate('ProductDetails', { productId: item.productId });
        } else {
            Alert.alert("Error", "Product details are unavailable.");
            console.warn("Attempted to navigate with invalid productId:", item?.productId);
        }
    };

    // --- Render Item Function for FlatList ---
    const renderCartItem = ({ item, index }) => {
        const imageUri = item.image || PLACEHOLDER_IMAGE_URL;
        const itemPricePerUnit = item.priceAtAddition || 0;
        const itemQuantity = item.quantity || 1;
        const itemTotalPrice = itemPricePerUnit * itemQuantity;
        const isBnpl = item.paymentMethod === 'BNPL';
        const bnplPlan = item.bnplPlan; // Use the already validated bnplPlan from state

        const formatInterest = (rate) => (typeof rate === 'number' ? `${rate.toFixed(1)}%` : 'N/A');
        const formatDuration = (dur) => (typeof dur === 'number' ? `${dur} Month${dur === 1 ? '' : 's'}` : 'N/A');

        let totalMonthlyPayment = null;
        if (isBnpl && bnplPlan && typeof bnplPlan.calculatedMonthly === 'number' && bnplPlan.planType !== 'Fixed Duration') {
            totalMonthlyPayment = bnplPlan.calculatedMonthly * itemQuantity;
        }
        const formattedTotalMonthly = (monthly) => (typeof monthly === 'number' ? `${CURRENCY_SYMBOL} ${monthly.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo` : null);

        const isLastItem = index === cartItems.length - 1;

        return (
             <TouchableOpacity onPress={() => handleProductPress(item)} activeOpacity={0.8}>
                <View style={[styles.cartItem, isLastItem && styles.lastCartItem]}>
                    <Image source={{ uri: imageUri }} style={styles.productImage} />
                    <View style={styles.details}>
                        <Text style={styles.productName} numberOfLines={2}>{item.productName}</Text>

                        {isBnpl && bnplPlan ? (
                            <View style={localStyles.bnplDetailsContainer}>
                                <View style={[localStyles.badgeBase, localStyles.bnplBadge]}>
                                    <MaterialIcons name="schedule" size={12} color={BNPL_BADGE_TEXT} />
                                    <Text style={localStyles.badgeText}>
                                        {`Installments${bnplPlan.name ? ` (${bnplPlan.name})` : ''}`}
                                    </Text>
                                </View>
                                <View style={localStyles.bnplPlanInfo}>
                                    {bnplPlan.planType && bnplPlan.planType !== 'Unknown' && (<View style={localStyles.detailRow}><MaterialIcons name="info-outline" size={14} color={BNPL_DETAIL_ICON_COLOR} style={localStyles.detailIcon} /><Text style={localStyles.detailText}>Type: <Text style={localStyles.detailValue}>{bnplPlan.planType}</Text></Text></View> )}
                                    {bnplPlan.duration && (<View style={localStyles.detailRow}><MaterialIcons name="timer" size={14} color={BNPL_DETAIL_ICON_COLOR} style={localStyles.detailIcon} /><Text style={localStyles.detailText}>Duration: <Text style={localStyles.detailValue}>{formatDuration(bnplPlan.duration)}</Text></Text></View> )}
                                    {(bnplPlan.interestRate !== null) && ( <View style={localStyles.detailRow}><MaterialIcons name="percent" size={14} color={BNPL_DETAIL_ICON_COLOR} style={localStyles.detailIcon} /><Text style={localStyles.detailText}>Interest: <Text style={localStyles.detailValue}>{formatInterest(bnplPlan.interestRate)}</Text></Text></View> )}
                                     {bnplPlan.planType === 'Fixed Duration' ? (
                                         <View style={localStyles.detailRow}>
                                             <MaterialIcons name="receipt-long" size={14} color={BNPL_DETAIL_ICON_COLOR} style={localStyles.detailIcon} />
                                             <Text style={localStyles.detailText}>Payment: <Text style={localStyles.detailValue}>One-time Payment</Text></Text>
                                         </View>
                                     ) : formattedTotalMonthly(totalMonthlyPayment) ? (
                                         <View style={localStyles.detailRow}>
                                             <MaterialIcons name="payments" size={14} color={BNPL_DETAIL_ICON_COLOR} style={localStyles.detailIcon} />
                                             <Text style={localStyles.detailText}>Total Monthly: <Text style={localStyles.detailValue}>{formattedTotalMonthly(totalMonthlyPayment)}</Text></Text>
                                         </View>
                                     ) : null}
                                </View>
                            </View>
                        ) : item.paymentMethod === 'COD' ? (
                             <View style={[localStyles.badgeBase, localStyles.codBadge]}>
                                <MaterialIcons name="local-shipping" size={12} color={COD_BADGE_TEXT} />
                                <Text style={[localStyles.badgeText, { color: COD_BADGE_TEXT }]}>COD</Text>
                            </View>
                        ) : (
                             <View style={localStyles.badgeBase}>
                                 <MaterialIcons name="help-outline" size={12} color={SECONDARY_TEXT_COLOR_ORIGINAL} />
                                 <Text style={[localStyles.badgeText, { color: SECONDARY_TEXT_COLOR_ORIGINAL }]}>Unknown Payment</Text>
                             </View>
                        )}

                        <Text style={styles.productPrice}>
                            {`${CURRENCY_SYMBOL} ${itemTotalPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                        </Text>
                         <Text style={localStyles.unitPriceText}>
                              {`(${CURRENCY_SYMBOL} ${itemPricePerUnit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} each ${isBnpl ? 'incl. plan' : ''})`}
                         </Text>

                        <View style={styles.quantityContainer}>
                            <TouchableOpacity
                                onPress={() => updateQuantity(item.cartItemId, 'decrease')} // Use unique cartItemId
                                style={styles.quantityButton}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 5 }}
                            >
                                <Ionicons name="remove-circle-outline" size={26} color={ERROR_COLOR} />
                            </TouchableOpacity>
                            <Text style={styles.quantityText}>{itemQuantity}</Text>
                             <TouchableOpacity
                                onPress={() => updateQuantity(item.cartItemId, 'increase')} // Use unique cartItemId
                                style={styles.quantityButton}
                                hitSlop={{ top: 10, bottom: 10, left: 5, right: 10 }}
                            >
                                <Ionicons name="add-circle-outline" size={26} color={ACCENT_COLOR_ADD} />
                            </TouchableOpacity>
                        </View>
                    </View>
                     <TouchableOpacity
                         onPress={() => removeItem(item)} // Pass the full item with cartItemId
                         style={styles.removeButton}
                         hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <Ionicons name="trash-outline" size={24} color={SECONDARY_TEXT_COLOR} />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };


    // --- Main Render Logic ---
    if (isLoading) { return (<View style={localStyles.centered}><ActivityIndicator size="large" color={HEADER_COLOR} /><Text style={localStyles.loadingText}>Loading Your Cart...</Text></View>); }
    if (error) { return (<View style={localStyles.centered}><MaterialIcons name="error-outline" size={40} color={ERROR_COLOR} /><Text style={localStyles.errorText}>{error}</Text></View>); }

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.headerContainer}>
                    <Text style={styles.header}>My Cart</Text>
                </View>

                {/* Cart List or Empty Message */}
                <View style={styles.listContainer}>
                    {cartItems.length > 0 ? (
                        <FlatList
                            data={cartItems}
                            renderItem={renderCartItem}
                            // *** Ensure keyExtractor uses the validated cartItemId ***
                            keyExtractor={(item) => item.cartItemId}
                            contentContainerStyle={styles.listContentContainer}
                            showsVerticalScrollIndicator={false}
                            ItemSeparatorComponent={() => <View style={styles.separator} />}
                        />
                    ) : (
                        <View style={localStyles.centered}>
                             <Ionicons name="cart-outline" size={60} color={SECONDARY_TEXT_COLOR} />
                            <Text style={styles.emptyCartText}>Your cart is empty</Text>
                            <Text style={localStyles.emptyCartSubText}>Looks like you haven't added anything yet.</Text>
                            <TouchableOpacity style={localStyles.shopNowButton} onPress={() => navigation.navigate('Home')}>
                                 <Text style={localStyles.shopNowButtonText}>Start Shopping</Text>
                             </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Footer: Total and Checkout Button */}
                {cartItems.length > 0 && (
                    <View style={styles.totalContainer}>
                         <View style={localStyles.totalRow}>
                             <Text style={localStyles.totalLabelText}>Total</Text>
                             <Text style={localStyles.totalValueText}>
                                 {`${CURRENCY_SYMBOL} ${totalPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                             </Text>
                         </View>
                        <TouchableOpacity
                          style={styles.checkoutButton}
                          onPress={handleCheckout}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.checkoutText}>{`Checkout (${cartItems.length})`}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

// --- Styles (Keep unchanged) ---
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: HEADER_COLOR,
    },
    container: {
        flex: 1,
        backgroundColor: BACKGROUND_COLOR,
        borderTopLeftRadius: Platform.OS === 'ios' ? 20 : 0,
        borderTopRightRadius: Platform.OS === 'ios' ? 20 : 0,
        overflow: 'hidden',
    },
    headerContainer: {
        paddingBottom: 15,
        paddingTop: Platform.OS === 'ios' ? 10 : 15,
        alignItems: 'center',
        backgroundColor: HEADER_COLOR,borderBottomLeftRadius: 15, borderBottomRightRadius: 15, 
    },
    header: {
        fontSize: 20,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    listContainer: {
        flex: 1,
    },
    listContentContainer: {
        paddingHorizontal: 10,
        paddingTop: 10,
        paddingBottom: 180,
    },
    separator: {
        height: 1,
        backgroundColor: BORDER_COLOR,
        marginHorizontal: 0,
    },
    cartItem: {
        flexDirection: 'row',
        paddingVertical: 15,
        paddingHorizontal: 5,
        alignItems: 'center',
        backgroundColor: CARD_BACKGROUND_COLOR,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    lastCartItem: {
       // No specific style needed here anymore
    },
    productImage: {
        width: 75,
        height: 75,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: '#F0F0F0',
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    details: {
        flex: 1,
        justifyContent: 'center',
        marginRight: 5,
    },
    productName: {
        fontSize: 15,
        fontWeight: '600',
        color: PRIMARY_TEXT_COLOR,
        marginBottom: 5,
    },
    productPrice: {
        fontSize: 15,
        fontWeight: 'bold',
        color: PRICE_COLOR,
        marginTop: 8,
        marginBottom: 4,
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    quantityButton: {
        padding: 6,
    },
    quantityText: {
        fontSize: 16,
        fontWeight: '600',
        marginHorizontal: 12,
        minWidth: 25,
        textAlign: 'center',
        color: PRIMARY_TEXT_COLOR,
    },
    removeButton: {
        padding: 10,
        marginLeft: 8,
    },
    totalContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: Platform.OS === 'ios' ? 30 : 20,
        backgroundColor: CARD_BACKGROUND_COLOR,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
    },
    checkoutButton: {
        backgroundColor: ACCENT_COLOR_CHECKOUT,
        paddingVertical: 15,
        paddingHorizontal: 40,
        borderRadius: 10,
        alignSelf: 'center',
        marginTop: 20,
    },
    checkoutText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    emptyCartText: {
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '600',
        color: PRIMARY_TEXT_COLOR,
        marginTop: 25,
    },
});

const localStyles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    loadingText: { marginTop: 15, fontSize: 16, color: SECONDARY_TEXT_COLOR, },
    errorText: { marginTop: 15, fontSize: 16, color: ERROR_COLOR, textAlign: 'center', },
    emptyCartSubText: {
        fontSize: 14,
        color: SECONDARY_TEXT_COLOR,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 30,
    },
    shopNowButton: {
        backgroundColor: ACCENT_COLOR_CHECKOUT,
        paddingVertical: 14,
        paddingHorizontal: 40,
        borderRadius: 10,
    },
    shopNowButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold', },
    badgeBase: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingVertical: 4, paddingHorizontal: 8, marginTop: 6, marginBottom: 4, alignSelf: 'flex-start', },
    bnplBadge: { backgroundColor: BNPL_BADGE_BG, },
    codBadge: { backgroundColor: COD_BADGE_BG, },
    badgeText: { fontSize: 11, fontWeight: '600', marginLeft: 5, color: BNPL_BADGE_TEXT, },
    badgeDetailText: { fontSize: 11, fontWeight: 'normal', marginLeft: 3, color: SECONDARY_TEXT_COLOR, },
    bnplDetailsContainer: { marginTop: 4, marginBottom: 4, },
    bnplPlanInfo: { marginTop: 6, paddingLeft: 0, marginLeft: 0, },
    detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, },
    detailIcon: { marginRight: 8, width: 16, textAlign: 'center', color: BNPL_DETAIL_ICON_COLOR, },
    detailText: { fontSize: 12, color: BNPL_DETAIL_TEXT_COLOR, },
    detailValue: { fontWeight: '600', color: PRIMARY_TEXT_COLOR_ORIGINAL, marginLeft: 4, },
    unitPriceText: { fontSize: 12, color: SECONDARY_TEXT_COLOR, marginTop: 2, marginBottom: 6, },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    totalLabelText: {
        fontSize: 18,
        color: PRIMARY_TEXT_COLOR,
        fontWeight: '600',
    },
    totalValueText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: PRICE_COLOR,
    },
});