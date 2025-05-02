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
// Import useRoute hook
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
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
    const route = useRoute(); // <-- Get route object

    // --- Determine if the custom header should be hidden ---
    // Check if the hideHeader param was passed and is true. Default to false.
    const hideHeader = route.params?.hideHeader ?? false;
    console.log(`CartScreen mounted. hideHeader parameter: ${hideHeader}`); // Optional: Log for debugging

    // --- Firestore Listener Effect ---
    useEffect(() => {
        if (!user) {
            setIsLoading(false); setError("Please log in to view your cart."); setCartItems([]); return;
        }
        setIsLoading(true); setError(null);
        const cartDocRef = doc(db, CARTS_COLLECTION, user.uid);
        console.log(`Setting up cart listener for user: ${user.uid}`);

        const unsubscribe = onSnapshot(cartDocRef, (docSnap) => {
            console.log("Cart listener received update.");
            if (docSnap.exists()) {
                const data = docSnap.data();
                const itemsArray = Array.isArray(data?.items) ? data.items : [];
                let itemIndex = 0;
                const validatedItems = itemsArray.map(item => {
                    // Generate a more robust fallback ID if cartItemId is missing
                    const generatedFallbackId = `${item.productId || 'unknown'}_${item.paymentMethod || 'unk'}_${item.bnplPlan?.id || 'NA'}_${itemIndex++}_${Date.now()}`; // Added timestamp for uniqueness
                    const finalCartItemId = item.cartItemId || generatedFallbackId;
                    if (!item.cartItemId) {
                        console.warn(`Cart item missing cartItemId, generated fallback: ${finalCartItemId}`, item);
                    }

                    const validatedImage = (typeof item.image === 'string' && item.image) ? item.image : PLACEHOLDER_IMAGE_URL;

                    // Ensure quantity is a positive number, default to 1
                    const validatedQuantity = (typeof item.quantity === 'number' && item.quantity > 0) ? item.quantity : 1;
                    if (validatedQuantity !== item.quantity) {
                        console.warn(`Corrected invalid quantity for item ${finalCartItemId}. Original: ${item.quantity}, Corrected: ${validatedQuantity}`);
                    }

                    // Ensure priceAtAddition is a number, default to 0
                    const validatedPrice = typeof item.priceAtAddition === 'number' ? item.priceAtAddition : 0;
                     if (validatedPrice !== item.priceAtAddition) {
                        console.warn(`Corrected invalid price for item ${finalCartItemId}. Original: ${item.priceAtAddition}, Corrected: ${validatedPrice}`);
                    }

                    return {
                        ...item,
                        cartItemId: finalCartItemId,
                        quantity: validatedQuantity,
                        priceAtAddition: validatedPrice,
                        productId: item.productId || 'unknown',
                        productName: item.productName || 'Unknown Product',
                        image: validatedImage,
                        bnplPlan: item.paymentMethod === 'BNPL' && item.bnplPlan ? {
                            id: item.bnplPlan.id || null,
                            name: item.bnplPlan.name || item.bnplPlan.planName || 'Installment Plan',
                            duration: typeof item.bnplPlan.duration === 'number' ? item.bnplPlan.duration : null,
                            interestRate: typeof item.bnplPlan.interestRate === 'number' ? item.bnplPlan.interestRate : null,
                            planType: item.bnplPlan.planType || 'Unknown',
                            calculatedMonthly: typeof item.bnplPlan.calculatedMonthly === 'number' ? item.bnplPlan.calculatedMonthly : null,
                        } : null,
                        paymentMethod: item.paymentMethod || 'COD', // Default to COD if missing
                    };
                });
                console.log(`Setting ${validatedItems.length} validated items.`);
                setCartItems(validatedItems);
            } else {
                console.log("Cart document does not exist, setting empty cart.");
                setCartItems([]);
            }
            setIsLoading(false);
        }, (err) => {
            console.error("Error listening to cart updates:", err);
            setError("Failed to load cart items. Please try again.");
            setIsLoading(false);
        });

        // Cleanup function
        return () => {
            console.log("Unsubscribing from cart listener");
            unsubscribe();
        };
    }, [user]); // Dependency array includes user

    // --- Firestore Update Functions ---

    const removeItem = (itemToRemove) => {
        if (!user || !itemToRemove || !itemToRemove.cartItemId) {
            Alert.alert("Error", "Could not remove item (Missing information).");
            console.error("removeItem called with invalid data:", { userId: user?.uid, itemToRemove });
            return;
        }

        Alert.alert(
            "Remove Item?",
            `Remove "${itemToRemove.productName || 'this item'}" from your cart?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    onPress: () => executeRemoval(itemToRemove), // Call the removal helper
                    style: "destructive"
                }
            ]
        );
    };

    const updateQuantity = async (cartItemId, action) => {
        if (!user || !cartItemId) { Alert.alert("Error", "Could not update quantity."); return; }
        const cartDocRef = doc(db, CARTS_COLLECTION, user.uid);
        try {
            const currentCartSnap = await getDoc(cartDocRef);
            if (!currentCartSnap.exists()) { console.error("Cart not found for update."); Alert.alert("Error", "Cart not found."); return; }

            const currentItems = currentCartSnap.data().items || [];
            const itemIndex = currentItems.findIndex(item => item.cartItemId === cartItemId);
            if (itemIndex === -1) { Alert.alert("Error", "Item not found in cart for update."); console.warn(`Item ${cartItemId} not found in Firestore for quantity update.`); return; }

            const currentItem = currentItems[itemIndex];
            const currentQuantity = currentItem.quantity || 1; // Default to 1 if quantity is missing/falsy
            let newQuantity = action === 'increase' ? currentQuantity + 1 : currentQuantity - 1;

            if (newQuantity < 1) {
                // Show confirmation to remove if quantity goes below 1
                Alert.alert(
                    "Remove Item?",
                    `Remove "${currentItem.productName || 'this item'}" from your cart?`,
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Remove", onPress: () => executeRemoval(currentItem), style: "destructive" }
                    ]
                 );
                return; // Stop execution, let the alert handle the removal flow
            }

            // Create the updated items array using map
            const updatedItemsArray = currentItems.map((item, index) => {
                if (index === itemIndex) {
                    return { ...item, quantity: newQuantity };
                }
                return item;
            });

            // Update Firestore document
            await updateDoc(cartDocRef, {
                items: updatedItemsArray,
                lastUpdated: serverTimestamp()
            });
            console.log(`Quantity updated for ${cartItemId} to ${newQuantity}. Firestore should trigger state update via onSnapshot.`);
             // No local state update needed here, onSnapshot will handle it.

        } catch (err) {
             console.error("Error updating quantity:", err);
             Alert.alert("Error", "Could not update item quantity. Please try again.");
        }
    };

    // Helper function for the core Firestore removal logic
    const executeRemoval = async (itemToRemove) => {
        if (!user || !itemToRemove || !itemToRemove.cartItemId) {
            console.error("executeRemoval called with invalid parameters:", { userId: user?.uid, itemToRemove });
            // Avoid Alert here as it's usually called from another action
            return;
        }
        console.log(`Executing removal for item: ${itemToRemove.cartItemId}`);
        const cartDocRef = doc(db, CARTS_COLLECTION, user.uid);
        try {
            const currentCartSnap = await getDoc(cartDocRef);
            if (currentCartSnap.exists()) {
                const currentItems = currentCartSnap.data().items || [];
                // Find the exact object in Firestore based on cartItemId to ensure correct removal
                const itemObjectToRemove = currentItems.find(item => item.cartItemId === itemToRemove.cartItemId);

                if (itemObjectToRemove) {
                    await updateDoc(cartDocRef, {
                        items: arrayRemove(itemObjectToRemove), // Use arrayRemove with the exact object
                        lastUpdated: serverTimestamp()
                    });
                    console.log(`Item removed via executeRemoval: ${itemToRemove.cartItemId}. Firestore should trigger state update.`);
                     // onSnapshot handles the UI update. No direct state manipulation needed.
                } else {
                    console.warn(`Item with cartItemId ${itemToRemove.cartItemId} not found in Firestore for executeRemoval (might be already removed).`);
                    // As a fallback, force local state update if Firestore seems out of sync
                     setCartItems(prev => prev.filter(i => i.cartItemId !== itemToRemove.cartItemId));
                }
            } else {
                console.warn("Cart document doesn't exist during executeRemoval.");
                 // Cart doc gone, clear local state too
                 setCartItems([]);
            }
        } catch (err) {
            console.error("Error during executeRemoval:", err);
            Alert.alert("Error", "Failed to remove item. Please try again.");
        }
    };


    // --- Calculations ---
    const totalPrice = cartItems.reduce((acc, item) => {
        const price = typeof item.priceAtAddition === 'number' ? item.priceAtAddition : 0;
        const quantity = typeof item.quantity === 'number' ? item.quantity : 1;
        return acc + (price * quantity);
    }, 0);

    // Calculates total number of *items*, considering quantity
    const totalQuantityCount = cartItems.reduce((acc, item) => {
        return acc + (item.quantity || 1); // Sum quantities
    }, 0);

    // Calculates the number of distinct product lines in the cart (ignores quantity)
    const distinctItemCount = cartItems.length;


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

        // Map items for checkout, ensuring structure is correct
        const itemsForCheckout = cartItems.map(item => {
             const planDetails = item.paymentMethod === 'BNPL' && item.bnplPlan ? {
                    id: item.bnplPlan.id,
                    name: item.bnplPlan.name,
                    duration: item.bnplPlan.duration,
                    interestRate: item.bnplPlan.interestRate,
                    planType: item.bnplPlan.planType,
                    calculatedMonthly: item.bnplPlan.calculatedMonthly, // Ensure this is passed if needed
                } : null;

             if (item.paymentMethod === 'BNPL' && !planDetails?.id) {
                 console.warn(`Missing BNPL Plan ID for cart item ${item.cartItemId} during checkout prep.`);
             }

            return {
                id: item.productId, // Usually product ID is needed
                cartItemId: item.cartItemId, // Pass cartItemId for potential reference
                name: item.productName,
                image: item.image,
                quantity: item.quantity,
                price: item.priceAtAddition, // Price per unit at time of addition
                paymentMethod: item.paymentMethod,
                bnplPlan: planDetails, // Pass BNPL details if applicable
            };
        });

        console.log(`Proceeding to checkout with ${itemsForCheckout.length} mapped items (total quantity ${totalQuantityCount}).`);
        navigation.navigate('CheckoutScreen', {
            cartItems: itemsForCheckout, // Pass the mapped items
            totalPrice: totalPrice // Pass the calculated total price
        });
    };

    const handleProductPress = (item) => {
        if (item && item.productId && item.productId !== 'unknown') {
             console.log(`Navigating to ProductDetails for productId: ${item.productId}`);
            navigation.navigate('ProductDetails', { productId: item.productId });
        } else {
            Alert.alert("Error", "Product details are unavailable.");
            console.warn("Attempted to navigate with invalid productId:", item?.productId);
        }
    };

    // --- Render Item Function for FlatList ---
    const renderCartItem = ({ item, index }) => {
        // Ensure item data is valid before rendering
        if (!item || !item.cartItemId) {
             console.error("renderCartItem called with invalid item:", item);
             return null; // Don't render if item is invalid
        }

        const imageUri = (typeof item.image === 'string' && item.image) ? item.image : PLACEHOLDER_IMAGE_URL;
        const itemPricePerUnit = item.priceAtAddition || 0;
        const itemQuantity = item.quantity || 1;
        const itemTotalPrice = itemPricePerUnit * itemQuantity;
        const isBnpl = item.paymentMethod === 'BNPL';
        const bnplPlan = item.bnplPlan;

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
                    <Image source={{ uri: imageUri }} style={styles.productImage} onError={(e) => console.warn(`Failed to load image: ${imageUri}`, e.nativeEvent.error)} />
                    <View style={styles.details}>
                        <Text style={styles.productName} numberOfLines={2}>{item.productName}</Text>

                        {/* Payment Method Display */}
                        {isBnpl && bnplPlan ? (
                            <View style={localStyles.bnplDetailsContainer}>
                                {/* Badge */}
                                <View style={[localStyles.badgeBase, localStyles.bnplBadge]}>
                                    <MaterialIcons name="schedule" size={12} color={BNPL_BADGE_TEXT} />
                                    <Text style={localStyles.badgeText}>{`Installments${bnplPlan.name ? ` (${bnplPlan.name})` : ''}`}</Text>
                                </View>
                                {/* Details */}
                                <View style={localStyles.bnplPlanInfo}>
                                    {bnplPlan.planType && bnplPlan.planType !== 'Unknown' && (<View style={localStyles.detailRow}><MaterialIcons name="info-outline" size={14} color={BNPL_DETAIL_ICON_COLOR} style={localStyles.detailIcon} /><Text style={localStyles.detailText}>Type: <Text style={localStyles.detailValue}>{bnplPlan.planType}</Text></Text></View> )}
                                    {bnplPlan.duration && (<View style={localStyles.detailRow}><MaterialIcons name="timer" size={14} color={BNPL_DETAIL_ICON_COLOR} style={localStyles.detailIcon} /><Text style={localStyles.detailText}>Duration: <Text style={localStyles.detailValue}>{formatDuration(bnplPlan.duration)}</Text></Text></View> )}
                                    {(bnplPlan.interestRate !== null) && ( <View style={localStyles.detailRow}><MaterialIcons name="percent" size={14} color={BNPL_DETAIL_ICON_COLOR} style={localStyles.detailIcon} /><Text style={localStyles.detailText}>Interest: <Text style={localStyles.detailValue}>{formatInterest(bnplPlan.interestRate)}</Text></Text></View> )}
                                    {/* Display Monthly/Total Payment */}
                                     {bnplPlan.planType === 'Fixed Duration' ? (
                                         <View style={localStyles.detailRow}><MaterialIcons name="receipt-long" size={14} color={BNPL_DETAIL_ICON_COLOR} style={localStyles.detailIcon} /><Text style={localStyles.detailText}>Payment: <Text style={localStyles.detailValue}>One-time Payment</Text></Text></View>
                                     ) : formattedTotalMonthly(totalMonthlyPayment) ? (
                                         <View style={localStyles.detailRow}><MaterialIcons name="payments" size={14} color={BNPL_DETAIL_ICON_COLOR} style={localStyles.detailIcon} /><Text style={localStyles.detailText}>Total Monthly: <Text style={localStyles.detailValue}>{formattedTotalMonthly(totalMonthlyPayment)}</Text></Text></View>
                                     ) : null}
                                </View>
                            </View>
                        ) : item.paymentMethod === 'COD' ? (
                             <View style={[localStyles.badgeBase, localStyles.codBadge]}><MaterialIcons name="local-shipping" size={12} color={COD_BADGE_TEXT} /><Text style={[localStyles.badgeText, { color: COD_BADGE_TEXT }]}>COD</Text></View>
                        ) : ( // Fallback for unknown/missing payment method
                             <View style={localStyles.badgeBase}><MaterialIcons name="help-outline" size={12} color={SECONDARY_TEXT_COLOR_ORIGINAL} /><Text style={[localStyles.badgeText, { color: SECONDARY_TEXT_COLOR_ORIGINAL }]}>Unknown Payment</Text></View>
                        )}

                        {/* Price Display */}
                        <Text style={styles.productPrice}>{`${CURRENCY_SYMBOL} ${itemTotalPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}</Text>
                        <Text style={localStyles.unitPriceText}>{`(${CURRENCY_SYMBOL} ${itemPricePerUnit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} each ${isBnpl ? 'incl. plan' : ''})`}</Text>

                        {/* Quantity Controls */}
                        <View style={styles.quantityContainer}>
                            <TouchableOpacity onPress={() => updateQuantity(item.cartItemId, 'decrease')} style={styles.quantityButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 5 }}><Ionicons name="remove-circle-outline" size={26} color={ERROR_COLOR} /></TouchableOpacity>
                            <Text style={styles.quantityText}>{itemQuantity}</Text>
                            <TouchableOpacity onPress={() => updateQuantity(item.cartItemId, 'increase')} style={styles.quantityButton} hitSlop={{ top: 10, bottom: 10, left: 5, right: 10 }}><Ionicons name="add-circle-outline" size={26} color={ACCENT_COLOR_ADD} /></TouchableOpacity>
                        </View>
                    </View>
                    {/* Remove Button */}
                     <TouchableOpacity onPress={() => removeItem(item)} style={styles.removeButton} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
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
                {/* --- Conditionally Render the Custom Header --- */}
                {!hideHeader && (
                    <View style={styles.headerContainer}>
                        <Text style={styles.header}>My Cart</Text>
                    </View>
                )}
                {/* --- End Conditional Header --- */}

                <View style={styles.listContainer}>
                    {cartItems.length > 0 ? (
                        <FlatList
                            data={cartItems}
                            renderItem={renderCartItem}
                            // Use cartItemId as key - ensure it's always unique
                            keyExtractor={(item) => item.cartItemId}
                            contentContainerStyle={styles.listContentContainer}
                            showsVerticalScrollIndicator={false}
                            ItemSeparatorComponent={() => <View style={styles.separator} />}
                        />
                    ) : (
                        // Empty Cart View
                        <View style={localStyles.centered}>
                             <Ionicons name="cart-outline" size={60} color={SECONDARY_TEXT_COLOR} />
                            <Text style={styles.emptyCartText}>Your cart is empty</Text>
                            <Text style={localStyles.emptyCartSubText}>Looks like you haven't added anything yet.</Text>
                            <TouchableOpacity style={localStyles.shopNowButton} onPress={() => navigation.navigate('Home')}><Text style={localStyles.shopNowButtonText}>Start Shopping</Text></TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Checkout Section (Only if cart has items) */}
                {cartItems.length > 0 && (
                    <View style={styles.totalContainer}>
                         <View style={localStyles.totalRow}>
                             <Text style={localStyles.totalLabelText}>Total</Text>
                             <Text style={localStyles.totalValueText}>{`${CURRENCY_SYMBOL} ${totalPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}</Text>
                         </View>
                         {/* Checkout Button shows distinct item count */}
                        <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout} activeOpacity={0.8}>
                            <Text style={styles.checkoutText}>{`Checkout (${distinctItemCount})`}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: HEADER_COLOR, // Color for notch area on iOS
    },
    container: {
        flex: 1,
        backgroundColor: BACKGROUND_COLOR,
        // Apply top radius only if the custom header ISN'T hidden OR if on Android (where SafeAreaView doesn't add bg color)
        // borderTopLeftRadius: Platform.OS === 'ios' ? 20 : 0, // <-- Removed conditional logic for simplicity, apply always if desired
        // borderTopRightRadius: Platform.OS === 'ios' ? 20 : 0, // <-- Removed conditional logic
        overflow: 'hidden', // Keep overflow hidden if using radius
    },
    headerContainer: {
        paddingBottom: 15,
        paddingTop: Platform.OS === 'ios' ? 10 : 25, // Adjust top padding for Android status bar if needed
        alignItems: 'center',
        backgroundColor: HEADER_COLOR,
        borderBottomLeftRadius: 15,
        borderBottomRightRadius: 15,
    },
    header: {
        fontSize: 20,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    listContainer: {
        flex: 1, // Takes remaining space
    },
    listContentContainer: {
        paddingHorizontal: 10,
        paddingTop: 10, // Add padding from top of the list area
        paddingBottom: 180, // Ensure space for the checkout footer
    },
    separator: {
        height: 1,
        backgroundColor: BORDER_COLOR,
        marginHorizontal: 0, // Extend full width within container padding
    },
    cartItem: {
        flexDirection: 'row',
        paddingVertical: 15,
        paddingHorizontal: 5, // Inner padding for item content
        alignItems: 'center',
        backgroundColor: CARD_BACKGROUND_COLOR,
        // Removed bottom radius, separator looks better now
    },
    lastCartItem: {
        // No border needed if using separator
    },
    productImage: {
        width: 75,
        height: 75,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: '#F0F0F0', // Placeholder BG
        borderWidth: 1,
        borderColor: BORDER_COLOR,
    },
    details: {
        flex: 1, // Take available space
        justifyContent: 'center',
        marginRight: 5, // Space before remove button
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
        marginTop: 8, // Space above price
        marginBottom: 4, // Space below price
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10, // Space above quantity controls
    },
    quantityButton: {
        padding: 6, // Hit area for buttons
    },
    quantityText: {
        fontSize: 16,
        fontWeight: '600',
        marginHorizontal: 12,
        minWidth: 25, // Ensure consistent width
        textAlign: 'center',
        color: PRIMARY_TEXT_COLOR,
    },
    removeButton: {
        padding: 10, // Hit area
        marginLeft: 8, // Space from details section
    },
    totalContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: Platform.OS === 'ios' ? 30 : 20, // Adjust for bottom safe area/navbar
        backgroundColor: CARD_BACKGROUND_COLOR, // White background for footer
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        elevation: 8, // Android shadow
        shadowColor: '#000', // iOS shadow
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
    },
    checkoutButton: {
        backgroundColor: ACCENT_COLOR_CHECKOUT,
        paddingVertical: 15,
        paddingHorizontal: 40,
        borderRadius: 10,
        alignSelf: 'center', // Center the button
        marginTop: 20, // Space between total row and button
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

// Local styles specific to this screen (loading, error, empty state, badges, etc.)
const localStyles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30, // Padding around the centered content
    },
    loadingText: {
        marginTop: 15,
        fontSize: 16,
        color: SECONDARY_TEXT_COLOR,
    },
    errorText: {
        marginTop: 15,
        fontSize: 16,
        color: ERROR_COLOR,
        textAlign: 'center',
    },
    emptyCartSubText: {
        fontSize: 14,
        color: SECONDARY_TEXT_COLOR,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 30,
    },
    shopNowButton: {
        backgroundColor: ACCENT_COLOR_CHECKOUT, // Use main accent color
        paddingVertical: 14,
        paddingHorizontal: 40,
        borderRadius: 10,
    },
    shopNowButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    badgeBase: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        paddingVertical: 4,
        paddingHorizontal: 8,
        marginTop: 6,
        marginBottom: 4,
        alignSelf: 'flex-start', // Align badge to the start of its container
    },
    bnplBadge: {
        backgroundColor: BNPL_BADGE_BG,
    },
    codBadge: {
        backgroundColor: COD_BADGE_BG,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '600',
        marginLeft: 5, // Space between icon and text
        color: BNPL_BADGE_TEXT, // Default color (overridden for COD)
    },
    bnplDetailsContainer: {
        marginTop: 4, // Space between product name and BNPL info
        marginBottom: 4,
    },
    bnplPlanInfo: {
        marginTop: 6, // Space between badge and details
        paddingLeft: 0, // No extra indent needed
        marginLeft: 0,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4, // Space between detail rows
    },
    detailIcon: {
        marginRight: 8,
        width: 16, // Fixed width for alignment
        textAlign: 'center',
        color: BNPL_DETAIL_ICON_COLOR,
    },
    detailText: {
        fontSize: 12,
        color: BNPL_DETAIL_TEXT_COLOR,
    },
    detailValue: {
        fontWeight: '600',
        color: PRIMARY_TEXT_COLOR_ORIGINAL, // Use original primary text color for values
        marginLeft: 4, // Space between label and value
    },
    unitPriceText: {
        fontSize: 12,
        color: SECONDARY_TEXT_COLOR, // Lighter text for unit price info
        marginTop: 2, // Small space below main price
        marginBottom: 6, // Space above quantity controls
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%', // Ensure it spans the container width
    },
    totalLabelText: {
        fontSize: 18,
        color: PRIMARY_TEXT_COLOR,
        fontWeight: '600',
    },
    totalValueText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: PRICE_COLOR, // Use the main price color for total
    },
});