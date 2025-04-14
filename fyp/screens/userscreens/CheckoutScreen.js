import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
    Platform, Alert, ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

// --- Define Constants Locally ---
const AppBackgroundColor = '#FFFFFF';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#666666';
const AccentColor = '#D32F2F';
const LightBorderColor = '#EEEEEE';
const PlaceholderBgColor = '#F0F0F0';
const DiscountedPriceColor = '#E53935';
const BnplPlanDetailColor = TextColorSecondary;
const BnplPlanValueColor = TextColorPrimary;
const BnplPlanIconColor = '#757575';
const QuantityButtonColor = AccentColor;
const QuantityButtonDisabledColor = '#cccccc';

// Placeholder image path
const placeholderImagePath = require('../../assets/p3.jpg'); // Adjust path as needed

// --- Currency Symbol ---
const CURRENCY_SYMBOL = 'PKR'; // Or 'RS'

export default function CheckoutScreen({ route }) {
    const navigation = useNavigation();

    const [cartItems, setCartItems] = useState(route.params?.cartItems ?? []);
    const [subTotal, setSubTotal] = useState(0);

    const shippingFee = useMemo(() => (subTotal > 5000 ? 0 : 300), [subTotal]);
    const taxRate = 0.05;
    const tax = useMemo(() => subTotal * taxRate, [subTotal]);
    const grandTotal = useMemo(() => subTotal + tax + shippingFee, [subTotal, tax, shippingFee]);

    useEffect(() => {
        let calculatedTotal = 0;
        cartItems.forEach(item => {
            if (item && typeof item.price === 'number' && typeof item.quantity === 'number') {
                calculatedTotal += item.price * item.quantity;
            }
        });
        setSubTotal(calculatedTotal);
    }, [cartItems]);

    const user = { name: 'Jane Doe', address: '456 Market St, Lahore, Pakistan', phone: '+92 311 9876543' };

    const increaseQuantity = (itemId) => {
        setCartItems(currentItems =>
            currentItems.map(item =>
                item.id === itemId
                    ? { ...item, quantity: (item.quantity || 0) + 1 }
                    : item
            )
        );
    };

    const decreaseQuantity = (itemId) => {
        setCartItems(currentItems => {
            const itemToUpdate = currentItems.find(item => item.id === itemId);
            if (!itemToUpdate) return currentItems;
            if (itemToUpdate.quantity > 1) {
                return currentItems.map(item =>
                    item.id === itemId
                        ? { ...item, quantity: item.quantity - 1 }
                        : item
                );
            } else {
                Alert.alert("Remove Item", `Remove ${itemToUpdate.name} from your order?`,
                    [{ text: "Cancel", style: "cancel" }, { text: "Remove", onPress: () => setCartItems(items => items.filter(item => item.id !== itemId)), style: "destructive" }]
                );
                return currentItems;
            }
        });
    };

    // --- ** MODIFIED ** Function to render BNPL details ---
    const renderBnplDetails = (item) => { // Accept full item
        const { bnplPlan, quantity, price } = item; // Destructure needed props

        if (!bnplPlan || !bnplPlan.id || typeof price !== 'number' || typeof quantity !== 'number') return null;

        const name = bnplPlan.name || 'BNPL Plan';
        const duration = typeof bnplPlan.duration === 'number' ? bnplPlan.duration : null;
        const interestRate = typeof bnplPlan.interestRate === 'number' ? bnplPlan.interestRate : null;
        // Note: We don't use bnplPlan.calculatedMonthly anymore, we recalculate based on current quantity
        const planType = bnplPlan.planType || 'N/A';

        const formattedInterest = interestRate !== null ? `${interestRate.toFixed(1)}%` : 'N/A';
        const isFixed = planType === 'Fixed Duration';
        const numInstallments = !isFixed && duration ? duration : 1;

        // ** Recalculate Monthly based on current total price and duration **
        let currentMonthlyPayment = null;
        if (!isFixed && duration && duration > 0) {
            const currentTotalPrice = price * quantity; // Total price for current quantity
            const monthlyRaw = currentTotalPrice / duration;
            currentMonthlyPayment = `${CURRENCY_SYMBOL} ${monthlyRaw.toFixed(0)}`;
        }

        return (
            <View style={styles.bnplDetailsContainer}>
                <Text style={styles.bnplPlanTitle}>Payment Plan: {name}</Text>
                <View style={styles.bnplDetailRow}><MaterialIcons name="info-outline" size={14} color={BnplPlanIconColor} style={styles.bnplDetailIcon} /><Text style={styles.bnplDetailText}>Type: <Text style={styles.bnplDetailValue}>{planType}</Text></Text></View>
                {duration && (<View style={styles.bnplDetailRow}><MaterialIcons name="schedule" size={14} color={BnplPlanIconColor} style={styles.bnplDetailIcon} /><Text style={styles.bnplDetailText}>Duration: <Text style={styles.bnplDetailValue}>{duration} {duration === 1 ? 'Month' : 'Months'}</Text>{isFixed ? (<Text style={styles.bnplDetailValue}> (1 Pay)</Text>) : (<Text style={styles.bnplDetailValue}> / {numInstallments} Installments</Text>)}</Text></View>)}
                {/* Show recalculated monthly payment */}
                {currentMonthlyPayment && !isFixed && (
                    <View style={styles.bnplDetailRow}>
                         <MaterialIcons name="calculate" size={14} color={BnplPlanIconColor} style={styles.bnplDetailIcon} />
                         <Text style={styles.bnplDetailText}>Est. Monthly: <Text style={styles.bnplDetailValue}>{currentMonthlyPayment}</Text></Text>
                    </View>
                 )}
                <View style={styles.bnplDetailRow}><MaterialIcons name="percent" size={14} color={BnplPlanIconColor} style={styles.bnplDetailIcon} /><Text style={styles.bnplDetailText}>Interest: <Text style={styles.bnplDetailValue}>{formattedInterest}</Text></Text></View>
            </View>
        );
    };

    // --- ** MODIFIED ** Render Cart Item ---
    const renderCartItem = ({ item }) => {
        if (!item || !item.id || typeof item.price !== 'number' || typeof item.quantity !== 'number') { console.warn("Invalid cart item data:", item); return null; }
        const itemTotalPrice = item.price * item.quantity;
        const isBnpl = item.paymentMethod === 'BNPL' && item.bnplPlan;

        return (
            <View style={styles.cartItem}>
                <Image
                    source={item.image ? { uri: item.image } : placeholderImagePath}
                    style={styles.productImage}
                    onError={(e) => console.log(`Img Err: ${item.image}`, e.nativeEvent.error)}
                />
                <View style={styles.details}>
                    <Text style={styles.productName} numberOfLines={1}>{item.name || 'Unnamed Product'}</Text>
                    <Text style={styles.productPrice}>
                        {CURRENCY_SYMBOL} {itemTotalPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </Text>
                    {item.quantity > 1 && (
                        <Text style={styles.unitPriceText}>
                            ({CURRENCY_SYMBOL} {item.price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} each)
                        </Text>
                    )}
                    <View style={styles.quantityControlContainer}>
                        <TouchableOpacity style={styles.quantityButton} onPress={() => decreaseQuantity(item.id)}>
                            <Ionicons name={item.quantity === 1 ? "trash-outline" : "remove-outline"} size={18} color={item.quantity === 1 ? AccentColor : QuantityButtonColor} />
                        </TouchableOpacity>
                        <Text style={styles.quantityTextDisplay}>{item.quantity}</Text>
                        <TouchableOpacity style={styles.quantityButton} onPress={() => increaseQuantity(item.id)}>
                            <Ionicons name="add-outline" size={18} color={QuantityButtonColor} />
                        </TouchableOpacity>
                    </View>
                    {/* Pass the full item to renderBnplDetails */}
                    {isBnpl && renderBnplDetails(item)}
                </View>
            </View>
        );
    };


    return (
        <View style={styles.outerContainer}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* User Details Section */}
                <View style={styles.userInfoContainer}>
                    <Ionicons name="location-outline" size={24} color={TextColorSecondary} style={styles.infoIcon} />
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>{user.name}</Text>
                        <Text style={styles.userAddress} numberOfLines={1}>{user.address}</Text>
                        <Text style={styles.userPhone}>{user.phone}</Text>
                    </View>
                    <TouchableOpacity onPress={() => console.log("Edit Address Tapped")}>
                        <Ionicons name="chevron-forward-outline" size={24} color={AccentColor} style={styles.chevronIcon} />
                    </TouchableOpacity>
                </View>

                {/* Cart Items Section */}
                <Text style={styles.sectionTitle}>Order Items</Text>
                <View style={styles.cartContainer}>
                    {cartItems.length === 0 ? (
                        <Text style={styles.emptyCartText}>Your cart is empty.</Text>
                    ) : (
                        <FlatList
                            data={cartItems}
                            keyExtractor={(item, index) => item.id?.toString() ?? `checkout-${index}`}
                            renderItem={renderCartItem}
                            scrollEnabled={false}
                        />
                    )}
                </View>

                {/* Order Summary Section */}
                <Text style={styles.sectionTitle}>Order Summary</Text>
                <View style={styles.summaryContainer}>
                    <View style={styles.summaryRow}><Text style={styles.summaryText}>Subtotal:</Text><Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {subTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Text></View>
                    <View style={styles.summaryRow}><Text style={styles.summaryText}>Tax ({ (taxRate * 100).toFixed(0) }%):</Text><Text style={styles.summaryValue}>{CURRENCY_SYMBOL} {tax.toFixed(0)}</Text></View>
                    <View style={styles.summaryRow}><Text style={styles.summaryText}>Shipping:</Text><Text style={styles.summaryValue}>{shippingFee === 0 ? 'Free' : `${CURRENCY_SYMBOL} ${shippingFee}`}</Text></View>
                    <View style={styles.divider} />
                    <View style={styles.summaryRow}><Text style={styles.totalText}>Total:</Text><Text style={styles.totalValue}>{CURRENCY_SYMBOL} {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Text></View>
                </View>

                {/* Proceed to Payment Button */}
                <TouchableOpacity
                    style={[styles.paymentButton, cartItems.length === 0 && styles.disabledButton]}
                    onPress={() => { console.log("Proceed to Payment Pressed"); console.log("Order Details:", { user, items: cartItems, summary: { subtotal: subTotal, tax: tax, shipping: shippingFee, grandTotal: grandTotal } }); Alert.alert('Payment', 'Proceeding to Payment Gateway...'); /* navigation.navigate('PaymentScreen', { orderDetails: ... }); */}}
                    disabled={cartItems.length === 0}
                >
                    <Text style={styles.paymentText}>Proceed to Payment</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

// Styles
const styles = StyleSheet.create({
    outerContainer: {
      flex: 1,
      backgroundColor: '#F8F9FA',
    },
    scrollView: {
        flex: 1,
    },
    scrollContentContainer: {
        padding: 10,
        paddingBottom: 30,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: TextColorPrimary,
        marginLeft: 5,
        marginTop: 15,
        marginBottom: 8,
    },
    userInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: AppBackgroundColor,
        padding: 15,
        borderRadius: 12,
        marginBottom: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        borderWidth: 1,
        borderColor: LightBorderColor,
    },
    infoIcon: {
        marginRight: 12,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: TextColorPrimary,
    },
    userAddress: {
        fontSize: 14,
        color: TextColorSecondary,
        marginTop: 2,
    },
    userPhone: {
        fontSize: 14,
        color: TextColorSecondary,
        marginTop: 2,
    },
    chevronIcon: {
        marginLeft: 10,
    },
    cartContainer: {
        backgroundColor: AppBackgroundColor,
        borderRadius: 12,
        marginBottom: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        borderWidth: 1,
        borderColor: LightBorderColor,
        padding: 5,
    },
    emptyCartText: {
        textAlign: 'center',
        paddingVertical: 30,
        fontSize: 16,
        color: TextColorSecondary,
    },
    cartItem: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 10,
        alignItems: 'center', // Vertically center image and details block
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    productImage: {
        width: 65,
        height: 65,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: PlaceholderBgColor,
        // marginTop: 0, // Removed marginTop as alignItems: center handles it
    },
    details: {
        flex: 1,
        justifyContent: 'center', // Center content vertically within details if needed
    },
    productName: {
        fontSize: 15,
        fontWeight: '600',
        color: TextColorPrimary,
        marginBottom: 3,
    },
    productPrice: {
        fontSize: 14,
        fontWeight: 'bold',
        color: DiscountedPriceColor,
        marginBottom: 1,
    },
    unitPriceText: {
        fontSize: 12,
        color: TextColorSecondary,
        marginBottom: 5,
    },
    quantityControlContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
        marginBottom: 8,
    },
    quantityButton: {
        borderWidth: 1,
        borderColor: LightBorderColor,
        borderRadius: 16, // Make it rounder
        padding: 6,      // Adjust padding
        marginHorizontal: 10, // Increase spacing
        backgroundColor: '#fff', // White background
    },
    quantityTextDisplay: {
        fontSize: 15,
        fontWeight: '600',
        color: TextColorPrimary,
        minWidth: 25,
        textAlign: 'center',
    },
    quantityText: { // Keep original style if needed elsewhere, but renamed display one
        fontSize: 13,
        color: TextColorSecondary,
    },
    bnplDetailsContainer: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    bnplPlanTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: TextColorPrimary,
        marginBottom: 6,
    },
    bnplDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    bnplDetailIcon: {
        marginRight: 6,
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
        padding: 15,
        borderRadius: 12,
        marginBottom: 15,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        borderWidth: 1,
        borderColor: LightBorderColor,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
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
        backgroundColor: '#E0E0E0',
        marginVertical: 10,
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
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
        marginHorizontal: 5,
        marginBottom: 10,
        elevation: 3,
    },
    disabledButton: {
        backgroundColor: '#BDBDBD',
        elevation: 0,
    },
    paymentText: {
        color: 'white',
        fontSize: 17,
        fontWeight: 'bold',
    },
});