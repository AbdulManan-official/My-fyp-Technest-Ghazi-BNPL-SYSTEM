// CheckoutScreen.js
// Navigates to Confirmation Screen, Uses Real-time Data

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    Platform,
    Alert,
    ScrollView,
    ActivityIndicator,
    StatusBar, // Added StatusBar
} from 'react-native';
import {
    useNavigation,
    // useRoute, // We'll use the 'route' prop primarily for params
    useIsFocused,
} from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context'; // Using SafeAreaView

// --- Firebase Imports ---
import { db, auth } from '../../firebaseConfig'; // Adjust path as needed
import {
    doc,
    onSnapshot, // Import the real-time listener
} from 'firebase/firestore';

// --- Define Constants Locally ---
const AppBackgroundColor = '#FFFFFF';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#666666';
const AccentColor = '#FF0000';
const LightBorderColor = '#EEEEEE';
const PlaceholderBgColor = '#F0F0F0';
const DiscountedPriceColor = '#C70039';
const BnplPlanDetailColor = TextColorSecondary;
const BnplPlanValueColor = TextColorPrimary;
const BnplPlanIconColor = '#757575';
const ERROR_COLOR = '#D32F2F';
const ACCENT_COLOR_ADD = '#4CAF50';
const REMOVE_ICON_COLOR = '#757575';
// const QuantityButtonDisabledColor = '#cccccc'; // Appears unused
const ScreenBackgroundColor = '#F8F9FA';

// --- Placeholder Texts ---
const PLACEHOLDER_ADDRESS = 'Tap to add delivery address';
const PLACEHOLDER_PHONE = 'Tap to add phone';

// Placeholder image path
const placeholderImagePath = require('../../assets/p3.jpg'); // Adjust path as needed

// --- Currency Symbol ---
const CURRENCY_SYMBOL = 'PKR';

// --- Helper function to format address from structured data (Keep unchanged) ---
function formatAddressString(structuredAddr) {
    if (!structuredAddr) return null;
    const { street = '', city = '', state = '', postalCode = '' } =
        structuredAddr;
    let parts = [street, city, state]
        .map((part) => part?.trim())
        .filter(Boolean);
    let addressString = parts.join(', ');
    if (postalCode?.trim()) {
        addressString += ` (${postalCode.trim()})`;
    }
    return addressString || null;
}

// The 'route' prop is directly passed by React Navigation
export default function CheckoutScreen({ route }) {
    const navigation = useNavigation();
    const isFocused = useIsFocused();

    // Initialize cartItems from route.params received by this screen
    // The 'origin' parameter will be in route.params.origin
    const [cartItems, setCartItems] = useState(route.params?.cartItems ?? []);
    const [subTotal, setSubTotal] = useState(0);
    const [isLoadingUser, setIsLoadingUser] = useState(true);
    const [currentUserDetails, setCurrentUserDetails] = useState(null);

    const grandTotal = useMemo(() => subTotal, [subTotal]);

    useEffect(() => {
        let calculatedTotal = 0;
        cartItems.forEach((item) => {
            if (
                item &&
                typeof item.price === 'number' &&
                typeof item.quantity === 'number' &&
                item.quantity > 0
            ) {
                calculatedTotal += item.price * item.quantity;
            }
        });
        setSubTotal(calculatedTotal);
    }, [cartItems]);

    useEffect(() => {
        let unsubscribeSnapshot = null;
        const unsubscribeAuth = auth.onAuthStateChanged((userAuth) => {
            if (unsubscribeSnapshot) {
                console.log('[CheckoutScreen Auth/Snapshot Effect] Cleaning up previous listener.');
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }
            if (userAuth) {
                const userId = userAuth.uid;
                console.log(`[CheckoutScreen Auth/Snapshot Effect] User ${userId} logged in. Setting up listener.`);
                setIsLoadingUser(true);
                const userDocRef = doc(db, 'Users', userId);
                unsubscribeSnapshot = onSnapshot(
                    userDocRef,
                    (snapshot) => {
                        console.log('[CheckoutScreen Auth/Snapshot Effect] Received snapshot update.');
                        let processedData = null;
                        if (snapshot.exists()) {
                            const dbUserData = snapshot.data();
                            const name = dbUserData.name ?? userAuth.displayName ?? `User ${userId.substring(0, 5)}`;
                            const phone = dbUserData.phone ?? userAuth.phoneNumber ?? PLACEHOLDER_PHONE;
                            let addressString = PLACEHOLDER_ADDRESS;
                            let structuredAddress = null;
                            if (dbUserData.deliveryAddress) {
                                structuredAddress = dbUserData.deliveryAddress;
                                addressString = formatAddressString(structuredAddress) || PLACEHOLDER_ADDRESS;
                            }
                            processedData = {
                                uid: userId, name: name, phone: phone, address: addressString,
                                structuredAddress: structuredAddress, email: dbUserData.email || userAuth.email,
                            };
                        } else {
                            console.warn(`[CheckoutScreen Auth/Snapshot Effect] User document ${userId} missing.`);
                            processedData = {
                                uid: userId, name: userAuth.displayName ?? `User ${userId.substring(0, 5)}`,
                                phone: userAuth.phoneNumber ?? PLACEHOLDER_PHONE, address: PLACEHOLDER_ADDRESS,
                                structuredAddress: null, email: userAuth.email,
                            };
                        }
                        setCurrentUserDetails(processedData);
                        setIsLoadingUser(false);
                    },
                    (error) => {
                        console.error('[CheckoutScreen Auth/Snapshot Effect] Snapshot listener error:', error);
                        if (userAuth) { // Check if userAuth still exists before using its properties
                            setCurrentUserDetails({
                                uid: userAuth.uid, name: userAuth.displayName || `User ${userAuth.uid.substring(0, 5)}`,
                                address: 'Error loading address', phone: userAuth.phoneNumber || PLACEHOLDER_PHONE,
                                structuredAddress: null, email: userAuth.email,
                            });
                        }
                        setIsLoadingUser(false);
                    }
                );
            } else {
                console.log('[CheckoutScreen Auth/Snapshot Effect] No user logged in.');
                setCurrentUserDetails(null);
                setIsLoadingUser(false);
            }
        });
        return () => {
            console.log('[CheckoutScreen Auth/Snapshot Effect] Cleaning up listeners.');
            unsubscribeAuth();
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
            }
        };
    }, []);

    useEffect(() => {
        // Use 'route.params' from the prop for checking updatedUserDetails
        if (isFocused && route.params?.updatedUserDetails) {
            console.log('[CheckoutScreen Focus Effect] Clearing updatedUserDetails param.');
            navigation.setParams({ updatedUserDetails: undefined });
        }
    }, [isFocused, route.params?.updatedUserDetails, navigation]);

    const navigateToEditAddress = useCallback(() => {
        if (!currentUserDetails) {
            Alert.alert('Loading', 'User data is still loading.');
            return;
        }
        const currentDetails = {
            name: currentUserDetails.name,
            phone: currentUserDetails.phone === PLACEHOLDER_PHONE ? '' : currentUserDetails.phone,
            addressString: currentUserDetails.address === PLACEHOLDER_ADDRESS ? '' : currentUserDetails.address,
            structuredAddress: currentUserDetails.structuredAddress,
        };
        navigation.navigate('AddressEditScreen', {
            currentDetails: currentDetails,
            sourceScreen: 'CheckoutScreen', // This helps AddressEditScreen know where to return or what to do
        });
    }, [navigation, currentUserDetails]);

    const increaseQuantity = useCallback((itemId) => {
        setCartItems((currentItems) =>
            currentItems.map((item) =>
                // Use item.id or item.cartItemId consistently, assuming item.id is the product ID
                // and item.cartItemId is the unique ID within the cart if it exists
                (item.cartItemId || item.id) === itemId ? { ...item, quantity: (item.quantity || 0) + 1 } : item
            )
        );
    }, []);

    const confirmRemoveItem = useCallback((itemToRemove) => {
        Alert.alert(
            'Remove Item',
            `Remove ${itemToRemove.name || 'this item'}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    onPress: () =>
                        setCartItems((items) =>
                            items.filter((item) => (item.cartItemId || item.id) !== (itemToRemove.cartItemId || itemToRemove.id))
                        ),
                    style: 'destructive',
                },
            ],
            { cancelable: true }
        );
    }, []);

    const decreaseQuantity = useCallback((itemId) => {
        setCartItems((currentItems) => {
            const itemIndex = currentItems.findIndex((item) => (item.cartItemId || item.id) === itemId);
            if (itemIndex === -1) return currentItems; // Item not found
            const itemToUpdate = currentItems[itemIndex];
            if (itemToUpdate.quantity > 1) {
                const updatedItems = [...currentItems];
                updatedItems[itemIndex] = { ...itemToUpdate, quantity: itemToUpdate.quantity - 1 };
                return updatedItems;
            } else {
                confirmRemoveItem(itemToUpdate);
                return currentItems;
            }
        });
    }, [confirmRemoveItem]);


    const renderBnplDetails = useCallback((item) => {
        const { bnplPlan, quantity, price } = item;
        if (!bnplPlan || !bnplPlan.id || typeof price !== 'number' || typeof quantity !== 'number' || quantity <= 0) return null;
        const name = bnplPlan.name || 'Installment Plan';
        const duration = bnplPlan.duration;
        const interestRate = bnplPlan.interestRate;
        const planType = bnplPlan.planType || 'N/A';
        const formattedInterest = interestRate != null ? `${interestRate.toFixed(1)}%` : 'N/A';
        const isFixed = planType === 'Fixed Duration';
        const numInstallments = !isFixed && duration ? duration : 1;
        let currentMonthlyPayment = null;
        if (!isFixed && duration && duration > 0) {
            const currentTotalPriceWithInterest = price * quantity;
            const monthlyRaw = currentTotalPriceWithInterest / duration;
            currentMonthlyPayment = `${CURRENCY_SYMBOL} ${monthlyRaw.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        }
        return (
            <View style={styles.bnplDetailsContainer}>
                <Text style={styles.bnplPlanTitle}>Plan: {name}</Text>
                {planType !== 'N/A' && (<View style={styles.bnplDetailRow}><MaterialIcons name="info-outline" size={14} color={BnplPlanIconColor} style={styles.bnplDetailIcon} /><Text style={styles.bnplDetailText}>Type: <Text style={styles.bnplDetailValue}>{planType}</Text></Text></View>)}
                {duration != null && (<View style={styles.bnplDetailRow}><MaterialIcons name="schedule" size={14} color={BnplPlanIconColor} style={styles.bnplDetailIcon} /><Text style={styles.bnplDetailText}>Duration: <Text style={styles.bnplDetailValue}>{duration} {duration === 1 ? 'Month' : 'Months'}</Text>{isFixed ? (<Text style={styles.bnplDetailValue}> (1 Pay)</Text>) : (duration > 0 && (<Text style={styles.bnplDetailValue}> / {numInstallments} Inst.</Text>))}</Text></View>)}
                {currentMonthlyPayment && !isFixed && (<View style={styles.bnplDetailRow}><MaterialIcons name="calculate" size={14} color={BnplPlanIconColor} style={styles.bnplDetailIcon} /><Text style={styles.bnplDetailText}>Est. Monthly: <Text style={styles.bnplDetailValue}>{currentMonthlyPayment}</Text></Text></View>)}
                {interestRate !== null && (<View style={styles.bnplDetailRow}><MaterialIcons name="percent" size={14} color={BnplPlanIconColor} style={styles.bnplDetailIcon} /><Text style={styles.bnplDetailText}>Interest: <Text style={styles.bnplDetailValue}>{formattedInterest}</Text></Text></View>)}
            </View>
        );
    }, []);

    const renderCartItem = useCallback(({ item, index }) => {
        // Use item.cartItemId if available (from cart), otherwise fallback to item.id (product ID for "Buy Now")
        const uniqueItemId = item.cartItemId || item.id;
        if (!uniqueItemId || typeof item.price !== 'number' || typeof item.quantity !== 'number' || item.quantity <= 0) { return null; }

        const itemTotalPrice = item.price * item.quantity;
        const isBnpl = item.paymentMethod === 'BNPL' && item.bnplPlan;
        const isLastItem = index === cartItems.length - 1;
        return (
            <View style={[styles.cartItem, isLastItem && styles.lastCartItem]}>
                <Image source={item.image ? { uri: item.image } : placeholderImagePath} style={styles.productImage} onError={(e) => console.log(`ImgErr:${item.image}`, e.nativeEvent.error)} defaultSource={placeholderImagePath} />
                <View style={styles.details}>
                    <Text style={styles.productName} numberOfLines={1}>{item.name || 'Unnamed'}</Text>
                    <Text style={styles.productPrice}>{`${CURRENCY_SYMBOL} ${itemTotalPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}</Text>
                    {item.quantity > 1 && (<Text style={styles.unitPriceText}>{`(${CURRENCY_SYMBOL} ${item.price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} each)`}</Text>)}
                    <View style={styles.quantityControlContainer}>
                        <TouchableOpacity style={styles.quantityButton} onPress={() => decreaseQuantity(uniqueItemId)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 5 }}><Ionicons name="remove-circle-outline" size={26} color={ERROR_COLOR} /></TouchableOpacity>
                        <Text style={styles.quantityTextDisplay}>{item.quantity}</Text>
                        <TouchableOpacity style={styles.quantityButton} onPress={() => increaseQuantity(uniqueItemId)} hitSlop={{ top: 10, bottom: 10, left: 5, right: 10 }}><Ionicons name="add-circle-outline" size={26} color={ACCENT_COLOR_ADD} /></TouchableOpacity>
                    </View>
                    {isBnpl && renderBnplDetails(item)}
                </View>
                <TouchableOpacity style={styles.removeIconContainer} onPress={() => confirmRemoveItem(item)} hitSlop={{ top: 15, bottom: 15, left: 10, right: 10 }}><Ionicons name="trash-outline" size={24} color={REMOVE_ICON_COLOR} /></TouchableOpacity>
            </View>
        );
    }, [cartItems, increaseQuantity, decreaseQuantity, confirmRemoveItem, renderBnplDetails]);

    const handleProceedToConfirmation = useCallback(() => {
        const isAddressValid = currentUserDetails?.address && currentUserDetails.address !== PLACEHOLDER_ADDRESS;
        const isPhoneValid = currentUserDetails?.phone && currentUserDetails.phone !== PLACEHOLDER_PHONE;

        if (!currentUserDetails || !currentUserDetails.uid) { Alert.alert('Loading', 'User data still loading.'); return; }
        if (!isAddressValid || !isPhoneValid) { Alert.alert('Missing Information', 'Please add address & phone.', [{ text: "Add Address", onPress: navigateToEditAddress }, { text: "Cancel", style: "cancel" }]); return; }
        if (cartItems.length === 0) { Alert.alert('Empty Cart', 'Your cart is empty.'); return; }

        console.log("[CheckoutScreen] Navigating to Confirmation with origin:", route.params?.origin);
        navigation.navigate('OrderConfirmationScreen', {
            currentUserDetails: currentUserDetails,
            cartItems: cartItems,
            subTotal: subTotal,
            grandTotal: grandTotal,
            origin: route.params?.origin // Crucial: Pass the origin from the initial route params
        });
    }, [currentUserDetails, cartItems, subTotal, grandTotal, navigation, navigateToEditAddress, route.params?.origin]);

    if (isLoadingUser) {
        return (
            <SafeAreaView style={styles.safeAreaContainer}>
                <View style={styles.loadingContainer}><ActivityIndicator size="large" color={AccentColor} /><Text style={styles.loadingText}>Loading...</Text></View>
            </SafeAreaView>
        );
    }

    if (!currentUserDetails) {
        return (
            <SafeAreaView style={styles.safeAreaContainer}>
                <View style={styles.loadingContainer}>
                    <Ionicons name="log-in-outline" size={60} color={TextColorSecondary} />
                    <Text style={styles.errorText}>Please log in.</Text>
                    <TouchableOpacity style={styles.loginButton} onPress={() => navigation.navigate('Login')}><Text style={styles.loginButtonText}>Login</Text></TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const isAddressMissing = !currentUserDetails.address || currentUserDetails.address === PLACEHOLDER_ADDRESS;
    const isPhoneMissing = !currentUserDetails.phone || currentUserDetails.phone === PLACEHOLDER_PHONE;
    const isCheckoutDisabled = cartItems.length === 0 || isAddressMissing || isPhoneMissing;

    return (
        <SafeAreaView style={styles.safeAreaContainer}>
            <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContentContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <TouchableOpacity style={styles.userInfoContainer} onPress={navigateToEditAddress} activeOpacity={0.7} >
                    <Ionicons name="location-outline" size={24} color={TextColorSecondary} style={styles.infoIcon} />
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{currentUserDetails.name}</Text>
                        <Text style={styles.userAddress} numberOfLines={2}>{currentUserDetails.address}</Text>
                        <Text style={styles.userPhone}>{currentUserDetails.phone}</Text>
                    </View>
                    <Ionicons name="chevron-forward-outline" size={24} color={AccentColor} style={styles.chevronIcon}/>
                </TouchableOpacity>

                <Text style={styles.sectionTitle}>Order Items</Text>
                <View style={styles.cartListContainer}>
                    {cartItems.length === 0 ? (
                        <View style={styles.emptyCartContainer}>
                            <Ionicons name="cart-outline" size={50} color={TextColorSecondary} />
                            <Text style={styles.emptyCartText}>Cart is empty.</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Home')}><Text style={styles.browseProductsLink}>Browse Products</Text></TouchableOpacity>
                        </View>
                     ) : (
                        <FlatList
                            data={cartItems}
                            // Key extractor should use the same logic as item identification in quantity functions
                            keyExtractor={(item) => item.cartItemId || item.id?.toString() || `checkout-${item.name}-${Math.random()}`}
                            renderItem={renderCartItem}
                            scrollEnabled={false}
                        />
                    )}
                </View>

                <Text style={styles.sectionTitle}>Order Summary</Text>
                <View style={styles.summaryContainer}>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryText}>Subtotal:</Text>
                        <Text style={styles.summaryValue}>{`${CURRENCY_SYMBOL} ${subTotal.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0})}`}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.summaryRow}>
                        <Text style={styles.totalText}>Total:</Text>
                        <Text style={styles.totalValue}>{`${CURRENCY_SYMBOL} ${grandTotal.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0})}`}</Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={[ styles.paymentButton, isCheckoutDisabled && styles.disabledButton, ]}
                    onPress={handleProceedToConfirmation}
                    disabled={isCheckoutDisabled}
                    activeOpacity={0.8}
                >
                    <Text style={styles.paymentText}>Review Order</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    safeAreaContainer: {
        flex: 1,
        backgroundColor: ScreenBackgroundColor,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: ScreenBackgroundColor,
        padding: 20,
    },
    loadingText: {
        marginTop: 15,
        fontSize: 16,
        color: TextColorSecondary,
    },
    errorText: {
        fontSize: 16,
        color: ERROR_COLOR,
        textAlign: 'center',
        marginBottom: 20,
    },
    loginButton: {
        backgroundColor: AccentColor,
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 8,
    },
    loginButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    scrollView: {
        flex: 1,
    },
    scrollContentContainer: {
        padding: 15,
        paddingBottom: 30, // Ensures space at the bottom
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: TextColorPrimary,
        marginTop: 20,
        marginBottom: 12,
    },
    userInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: AppBackgroundColor,
        paddingVertical: 15,
        paddingHorizontal: 15,
        borderRadius: 12,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    infoIcon: {
        marginRight: 15,
    },
    userInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: TextColorPrimary,
        marginBottom: 4,
    },
    userAddress: {
        fontSize: 14,
        color: TextColorSecondary,
        lineHeight: 20,
        marginBottom: 4,
    },
    userPhone: {
        fontSize: 14,
        color: TextColorSecondary,
    },
    chevronIcon: {
        marginLeft: 10,
    },
    cartListContainer: {
        backgroundColor: AppBackgroundColor,
        borderRadius: 12,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
        overflow: 'hidden',
    },
    emptyCartContainer: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 20,
    },
    emptyCartText: {
        marginTop: 15,
        fontSize: 17,
        color: TextColorSecondary,
        textAlign: 'center',
    },
    browseProductsLink: {
        marginTop: 10,
        fontSize: 15,
        color: AccentColor,
        fontWeight: '600',
    },
    cartItem: {
        flexDirection: 'row',
        paddingVertical: 15,
        paddingHorizontal: 15,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: LightBorderColor,
        backgroundColor: AppBackgroundColor,
    },
    lastCartItem: {
        borderBottomWidth: 0,
    },
    productImage: {
        width: 70,
        height: 70,
        borderRadius: 8,
        marginRight: 15,
        backgroundColor: PlaceholderBgColor,
    },
    details: {
        flex: 1,
        justifyContent: 'center',
    },
    productName: {
        fontSize: 15,
        fontWeight: '600',
        color: TextColorPrimary,
        marginBottom: 4,
    },
    productPrice: {
        fontSize: 15,
        fontWeight: 'bold',
        color: DiscountedPriceColor,
        marginBottom: 2,
    },
    unitPriceText: {
        fontSize: 12,
        color: TextColorSecondary,
        marginBottom: 8,
    },
    quantityControlContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
    },
    quantityButton: {
        padding: 4,
        marginHorizontal: 8,
    },
    quantityTextDisplay: {
        fontSize: 16,
        fontWeight: '600',
        color: TextColorPrimary,
        minWidth: 30,
        textAlign: 'center',
        marginHorizontal: 5,
    },
    removeIconContainer: {
        paddingLeft: 10,
        paddingRight: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bnplDetailsContainer: {
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    bnplPlanTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: TextColorPrimary,
        marginBottom: 8,
    },
    bnplDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5,
    },
    bnplDetailIcon: {
        marginRight: 8,
        width: 16,
        textAlign: 'center',
    },
    bnplDetailText: {
        fontSize: 12,
        color: BnplPlanDetailColor,
        flexShrink: 1,
        lineHeight: 16,
    },
    bnplDetailValue: {
        fontWeight: '600',
        color: BnplPlanValueColor,
    },
    summaryContainer: {
        backgroundColor: AppBackgroundColor,
        padding: 20,
        borderRadius: 12,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    summaryText: {
        fontSize: 15,
        color: TextColorSecondary,
    },
    summaryValue: {
        fontSize: 15,
        fontWeight: '500',
        color: TextColorPrimary,
    },
    divider: {
        height: 1,
        backgroundColor: LightBorderColor,
        marginVertical: 12,
    },
    totalText: {
        fontSize: 17,
        fontWeight: 'bold',
        color: TextColorPrimary,
    },
    totalValue: {
        fontSize: 17,
        fontWeight: 'bold',
        color: AccentColor,
    },
    paymentButton: {
        backgroundColor: AccentColor,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        marginBottom: 10,
        shadowColor: AccentColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6,
        minHeight: 52,
    },
    disabledButton: {
        backgroundColor: '#BDBDBD',
        elevation: 0,
        shadowOpacity: 0,
    },
    paymentText: {
        color: 'white',
        fontSize: 17,
        fontWeight: 'bold',
    },
});