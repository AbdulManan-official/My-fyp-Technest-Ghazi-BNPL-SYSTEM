import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet, // Use StyleSheet from react-native
    FlatList,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons'; // Keep both icon sets
import { getAuth } from 'firebase/auth';
import { doc, getDoc, updateDoc, onSnapshot, arrayRemove, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Adjust path if needed

// --- Constants --- (Keep existing constants)
const CARTS_COLLECTION = 'Carts';
const PLACEHOLDER_IMAGE_URL = 'https://via.placeholder.com/150/CCCCCC/FFFFFF?text=No+Image';
const CURRENCY_SYMBOL = 'PKR';
const HEADER_COLOR = 'red';
const ACCENT_COLOR_CHECKOUT = '#007BFF';
const ACCENT_COLOR_ADD = '#007BFF';
const ERROR_COLOR = '#FF5733';
const BACKGROUND_COLOR = '#F5F5F5';
const CARD_BACKGROUND_COLOR = '#FFFFFF';
const BORDER_COLOR = '#E0E0E0';
const PRIMARY_TEXT_COLOR = '#000000';
const SECONDARY_TEXT_COLOR = 'gray';
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
    // --- State and Hooks (Keep unchanged) ---
    const [cartItems, setCartItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigation = useNavigation();
    const auth = getAuth();
    const user = auth.currentUser;

    // --- Firestore Listener Effect (Keep unchanged) ---
    useEffect(() => {
        if (!user) {
            setIsLoading(false); setError("Please log in to view your cart."); setCartItems([]); return;
        }
        setIsLoading(true); setError(null); const cartDocRef = doc(db, CARTS_COLLECTION, user.uid);
        const unsubscribe = onSnapshot(cartDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data(); const itemsArray = Array.isArray(data?.items) ? data.items : [];
                const validatedItems = itemsArray.map(item => ({ ...item, quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1, priceAtAddition: typeof item.priceAtAddition === 'number' ? item.priceAtAddition : 0, cartItemId: item.cartItemId || `${item.productId}_${Date.now()}`, productId: item.productId || 'unknown', productName: item.productName || 'Unknown Product', image: item.image || PLACEHOLDER_IMAGE_URL, bnplPlan: item.bnplPlan || null, paymentMethod: item.paymentMethod || 'COD', }));
                setCartItems(validatedItems);
            } else { setCartItems([]); }
            setIsLoading(false);
        }, (err) => { console.error("Error listening to cart updates:", err); setError("Failed to load cart items."); setIsLoading(false); });
        return () => { console.log("Unsubscribing from cart listener"); unsubscribe(); };
    }, [user]);

    // --- Firestore Update Functions ---
    const removeItem = async (itemToRemove) => { // (Keep unchanged)
        if (!user || !itemToRemove || !itemToRemove.cartItemId) { Alert.alert("Error", "Could not remove item."); return; }
        const cartDocRef = doc(db, CARTS_COLLECTION, user.uid);
        try {
            const currentCartSnap = await getDoc(cartDocRef);
            if (currentCartSnap.exists()) {
                const currentItems = currentCartSnap.data().items || [];
                const itemObjectToRemove = currentItems.find(item => item.cartItemId === itemToRemove.cartItemId);
                if (itemObjectToRemove) { await updateDoc(cartDocRef, { items: arrayRemove(itemObjectToRemove) }); }
                else { console.warn("Item to remove not found."); setCartItems(prev => prev.filter(i => i.cartItemId !== itemToRemove.cartItemId)); }
            }
        } catch (err) { console.error("Error removing item:", err); Alert.alert("Error", "Could not remove item."); }
    };

    // **** UPDATED: updateQuantity - Removed BNPL check ****
    const updateQuantity = async (cartItemId, action) => {
        if (!user || !cartItemId) { Alert.alert("Error", "Could not update quantity."); return; }

        // ** REMOVED Check: Allow update for BNPL items **

        const cartDocRef = doc(db, CARTS_COLLECTION, user.uid);
        try {
            const currentCartSnap = await getDoc(cartDocRef);
            if (!currentCartSnap.exists()) { console.error("Cart not found."); return; }

            const currentItems = currentCartSnap.data().items || [];
            const itemIndex = currentItems.findIndex(item => item.cartItemId === cartItemId);
            if (itemIndex === -1) { Alert.alert("Error", "Item not found."); return; }

            const currentItem = currentItems[itemIndex];
            const currentQuantity = currentItem.quantity || 1;
            let newQuantity = action === 'increase' ? currentQuantity + 1 : currentQuantity - 1;

            if (newQuantity < 1) {
                Alert.alert( "Remove Item?", `Remove "${currentItem.productName || 'this item'}"?`,
                    [ { text: "Cancel", style: "cancel" }, { text: "Remove", onPress: () => removeItem(currentItem), style: "destructive" } ] );
                return;
            }

            // Create updated array - only quantity changes
            const updatedItemsArray = currentItems.map((item, index) => {
                if (index === itemIndex) {
                    // Only update the quantity field
                    return { ...item, quantity: newQuantity };
                }
                return item;
            });

            // Update Firestore with the new array
            await updateDoc(cartDocRef, {
                items: updatedItemsArray,
                lastUpdated: serverTimestamp()
            });
            console.log(`Quantity updated for ${cartItemId} to ${newQuantity}.`);

        } catch (err) { console.error("Error updating quantity:", err); Alert.alert("Error", "Could not update quantity."); }
    };
    // **** END UPDATED updateQuantity ****

    // --- Calculations (Keep unchanged) ---
    const totalPrice = cartItems.reduce((acc, item) => {
        const price = typeof item.priceAtAddition === 'number' ? item.priceAtAddition : 0;
        const quantity = typeof item.quantity === 'number' ? item.quantity : 1;
        return acc + (price * quantity);
    }, 0);

    // --- Navigation Handlers (Keep unchanged) ---
     const handleCheckout = () => {
        if (!cartItems || cartItems.length === 0) { Alert.alert("Empty Cart", "Your cart is empty."); return; }
        navigation.navigate('CheckoutScreen', { cartItems: cartItems, totalPrice: totalPrice });
    };
    const handleProductPress = (item) => {
        navigation.navigate('ProductDetails', { productId: item.productId });
    };

    // --- Render Item Function for FlatList ---
    const renderCartItem = ({ item }) => {
        const imageUri = item.image || PLACEHOLDER_IMAGE_URL;
        const itemPricePerUnit = item.priceAtAddition || 0; // Price per unit (incl. interest for BNPL)
        const itemQuantity = item.quantity || 1;
        const itemTotalPrice = itemPricePerUnit * itemQuantity; // Total price for the line item
        const isBnpl = item.paymentMethod === 'BNPL';
        // ** REMOVED showQuantityControls - controls always shown **
        const bnplPlan = item.bnplPlan;

        const formatInterest = (rate) => (typeof rate === 'number' ? `${rate.toFixed(1)}%` : 'N/A');
        const formatDuration = (dur) => (typeof dur === 'number' ? `${dur} Month${dur === 1 ? '' : 's'}` : 'N/A');

        // **** Calculate TOTAL monthly payment dynamically ****
        let totalMonthlyPayment = null;
        if (isBnpl && bnplPlan && typeof bnplPlan.calculatedMonthly === 'number' && bnplPlan.planType !== 'Fixed Duration') {
            const singleUnitMonthly = bnplPlan.calculatedMonthly;
            totalMonthlyPayment = singleUnitMonthly * itemQuantity;
        }
        const formatTotalMonthly = (monthly) => (typeof monthly === 'number' ? `${CURRENCY_SYMBOL} ${monthly.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/mo` : null);
        // **** END Calculation ****

        return (
             <TouchableOpacity onPress={() => handleProductPress(item)} activeOpacity={0.8}>
                <View style={styles.cartItem}>
                    <Image source={{ uri: imageUri }} style={styles.productImage} />
                    <View style={styles.details}>
                        <Text style={styles.productName} numberOfLines={2}>{item.productName}</Text>

                        {/* Payment Method / BNPL Details */}
                        {isBnpl && bnplPlan ? (
                            <View style={localStyles.bnplDetailsContainer}>
                                <View style={[localStyles.badgeBase, localStyles.bnplBadge]}>
                                    <MaterialIcons name="schedule" size={12} color={BNPL_BADGE_TEXT} />
                                    <Text style={localStyles.badgeText}>BNPL</Text>
                                    {bnplPlan.name && <Text style={localStyles.badgeDetailText}> ({bnplPlan.name})</Text>}
                                </View>
                                <View style={localStyles.bnplPlanInfo}>
                                    {bnplPlan.planType && (<View style={localStyles.detailRow}><MaterialIcons name="info-outline" size={14} color={BNPL_DETAIL_ICON_COLOR} style={localStyles.detailIcon} /><Text style={localStyles.detailText}>Type: <Text style={localStyles.detailValue}>{bnplPlan.planType}</Text></Text></View> )}
                                    {bnplPlan.duration && (<View style={localStyles.detailRow}><MaterialIcons name="timer" size={14} color={BNPL_DETAIL_ICON_COLOR} style={localStyles.detailIcon} /><Text style={localStyles.detailText}>Duration: <Text style={localStyles.detailValue}>{formatDuration(bnplPlan.duration)}</Text></Text></View> )}
                                    {(bnplPlan.interestRate !== null && bnplPlan.interestRate !== undefined) && ( <View style={localStyles.detailRow}><MaterialIcons name="percent" size={14} color={BNPL_DETAIL_ICON_COLOR} style={localStyles.detailIcon} /><Text style={localStyles.detailText}>Interest: <Text style={localStyles.detailValue}>{formatInterest(bnplPlan.interestRate)}</Text></Text></View> )}

                                     {/* Conditional Payment Detail: One-time or Total Monthly */}
                                     {bnplPlan.planType === 'Fixed Duration' ? (
                                         <View style={localStyles.detailRow}>
                                             <MaterialIcons name="receipt-long" size={14} color={BNPL_DETAIL_ICON_COLOR} style={localStyles.detailIcon} />
                                             <Text style={localStyles.detailText}>Payment: <Text style={localStyles.detailValue}>One-time Payment</Text></Text>
                                         </View>
                                     // **** UPDATED: Display TOTAL monthly payment ****
                                     ) : formatTotalMonthly(totalMonthlyPayment) ? (
                                         <View style={localStyles.detailRow}>
                                             <MaterialIcons name="payments" size={14} color={BNPL_DETAIL_ICON_COLOR} style={localStyles.detailIcon} />
                                             {/* Changed label from "Est. Monthly" */}
                                             <Text style={localStyles.detailText}>Total Monthly: <Text style={localStyles.detailValue}>{formatTotalMonthly(totalMonthlyPayment)}</Text></Text>
                                         </View>
                                     // **** END UPDATE ****
                                     ) : null}
                                </View>
                            </View>
                        ) : item.paymentMethod === 'COD' ? (
                             <View style={[localStyles.badgeBase, localStyles.codBadge]}>
                                <MaterialIcons name="local-shipping" size={12} color={COD_BADGE_TEXT} />
                                <Text style={[localStyles.badgeText, { color: COD_BADGE_TEXT }]}>COD</Text>
                            </View>
                        ) : null }

                        {/* Display TOTAL price for the line item */}
                        <Text style={styles.productPrice}>
                            {CURRENCY_SYMBOL} {itemTotalPrice.toLocaleString()}
                        </Text>
                        {/* Display UNIT price */}
                         <Text style={localStyles.unitPriceText}>
                              ({CURRENCY_SYMBOL} {itemPricePerUnit.toLocaleString()} each {isBnpl ? 'incl. plan' : ''})
                         </Text>

                        {/* ** ALWAYS Render Quantity Controls ** */}
                        <View style={styles.quantityContainer}>
                            <TouchableOpacity onPress={() => updateQuantity(item.cartItemId, 'decrease')} style={styles.quantityButton}>
                                <Ionicons name="remove-circle" size={24} color={ERROR_COLOR} />
                            </TouchableOpacity>
                            <Text style={styles.quantityText}>{itemQuantity}</Text>
                            <TouchableOpacity onPress={() => updateQuantity(item.cartItemId, 'increase')} style={styles.quantityButton}>
                                <Ionicons name="add-circle" size={24} color={ACCENT_COLOR_ADD} />
                            </TouchableOpacity>
                        </View>
                         {/* ** END Always Render Quantity Controls ** */}
                    </View>
                     <TouchableOpacity onPress={() => removeItem(item)} style={styles.removeButton}>
                        <Ionicons name="trash" size={24} color={ERROR_COLOR} />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    // --- Main Render Logic (Keep unchanged structure) ---
    if (isLoading) { return (<View style={localStyles.centered}><ActivityIndicator size="large" color={HEADER_COLOR} /><Text style={localStyles.loadingText}>Loading Your Cart...</Text></View>); }
    if (error) { return (<View style={localStyles.centered}><MaterialIcons name="error-outline" size={40} color={ERROR_COLOR} /><Text style={localStyles.errorText}>{error}</Text></View>); }

    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}>
                <Text style={styles.header}>🛒 Your Cart</Text>
            </View>

            <View style={styles.listContainer}>
                {cartItems.length > 0 ? (
                    <FlatList
                        data={cartItems}
                        renderItem={renderCartItem}
                        keyExtractor={(item) => item.cartItemId}
                        contentContainerStyle={{ paddingBottom: 150 }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    />
                ) : (
                    <View style={localStyles.centered}>
                         <Ionicons name="cart-outline" size={60} color={SECONDARY_TEXT_COLOR} />
                        <Text style={styles.emptyCartText}>Your cart is empty 😞</Text>
                        <TouchableOpacity style={localStyles.shopNowButton} onPress={() => navigation.navigate('Home')}>
                             <Text style={localStyles.shopNowButtonText}>Start Shopping</Text>
                         </TouchableOpacity>
                    </View>
                )}
            </View>

            {cartItems.length > 0 && (
                <View style={styles.totalContainer}>
                     <View style={localStyles.totalRow}>
                         <Text style={localStyles.totalLabelText}>Subtotal:</Text>
                         <Text style={localStyles.totalValueText}>
                             {CURRENCY_SYMBOL} {totalPrice.toLocaleString()}
                         </Text>
                     </View>
                    <TouchableOpacity
                      style={styles.checkoutButton}
                      onPress={handleCheckout}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.checkoutText}>Checkout ({cartItems.length})</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

// --- Styles --- (Keep existing styles)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_COLOR, },
  headerContainer: { paddingVertical: 20, alignItems: 'center', backgroundColor: HEADER_COLOR, paddingTop: Platform.OS === 'ios' ? 50 : 25, paddingBottom: 15, },
  header: { fontSize: 22, fontWeight: 'bold', color: 'white', },
  listContainer: { flex: 1, marginHorizontal: 10, marginTop: 10, },
  cartItem: { flexDirection: 'row', padding: 10, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: BORDER_COLOR, backgroundColor: CARD_BACKGROUND_COLOR, borderRadius: 8, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, overflow: Platform.OS === 'android' ? 'hidden' : 'visible', },
  productImage: { width: 80, height: 80, borderRadius: 10, marginRight: 15, backgroundColor: '#EAEAEA', },
  details: { flex: 1, justifyContent: 'flex-start', marginRight: 5, },
  productName: { fontSize: 16, fontWeight: 'bold', color: PRIMARY_TEXT_COLOR, marginBottom: 4, },
  productPrice: { fontSize: 14, fontWeight: 'bold', color: PRICE_COLOR, marginTop: 4, marginBottom: 2, },
  quantityContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 6, },
  quantityButton: { padding: 5, },
  quantityText: { fontSize: 16, fontWeight: 'bold', marginHorizontal: 10, minWidth: 20, textAlign: 'center', color: PRIMARY_TEXT_COLOR, },
  removeButton: { padding: 10, alignSelf: 'center', marginLeft: 5, },
  totalContainer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 15, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 20, backgroundColor: CARD_BACKGROUND_COLOR, borderTopWidth: 1, borderTopColor: BORDER_COLOR, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4, },
  checkoutButton: { backgroundColor: ACCENT_COLOR_CHECKOUT, paddingVertical: 12, paddingHorizontal: 30, borderRadius: 5, width: '100%', alignItems: 'center', marginTop: 10, },
  checkoutText: { color: 'white', fontSize: 16, fontWeight: 'bold', },
  emptyCartText: { textAlign: 'center', fontSize: 18, color: SECONDARY_TEXT_COLOR, marginTop: 20, },
});
const localStyles = StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, marginTop: -50, },
    loadingText: { marginTop: 10, fontSize: 16, color: SECONDARY_TEXT_COLOR_ORIGINAL, },
    errorText: { marginTop: 10, fontSize: 16, color: ERROR_COLOR, textAlign: 'center', },
    shopNowButton: { marginTop: 25, backgroundColor: ACCENT_COLOR_CHECKOUT, paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25, },
    shopNowButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold', },
    badgeBase: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, marginTop: 6, marginBottom: 4, alignSelf: 'flex-start', },
    bnplBadge: { backgroundColor: BNPL_BADGE_BG, },
    codBadge: { backgroundColor: COD_BADGE_BG, },
    badgeText: { fontSize: 10, fontWeight: '600', marginLeft: 4, color: BNPL_BADGE_TEXT, },
    badgeDetailText: { fontSize: 10, fontWeight: 'normal', marginLeft: 3, color: SECONDARY_TEXT_COLOR_ORIGINAL, },
    bnplDetailsContainer: { marginTop: 4, marginBottom: 4, }, // Added bottom margin
    bnplPlanInfo: { marginTop: 6, paddingLeft: 5, marginLeft: 5, },
    detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3, },
    detailIcon: { marginRight: 6, width: 16, textAlign: 'center', color: BNPL_DETAIL_ICON_COLOR, },
    detailText: { fontSize: 11, color: BNPL_DETAIL_TEXT_COLOR, },
    detailValue: { fontWeight: '600', color: PRIMARY_TEXT_COLOR_ORIGINAL, marginLeft: 4, },
    unitPriceText: { fontSize: 12, color: SECONDARY_TEXT_COLOR_ORIGINAL, marginTop: 2, marginBottom: 4, },
    // Removed bnplQuantityText style
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, width: '100%', },
    totalLabelText: { fontSize: 16, color: SECONDARY_TEXT_COLOR_ORIGINAL, fontWeight: '500', },
    totalValueText: { fontSize: 18, fontWeight: 'bold', color: PRIMARY_TEXT_COLOR, },
});