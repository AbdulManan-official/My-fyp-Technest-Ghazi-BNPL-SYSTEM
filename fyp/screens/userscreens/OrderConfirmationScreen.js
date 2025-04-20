// OrderConfirmationScreen.js
// Final review, places order, sends notification, clears cart, reduced bottom space, formatted code.

import React, { useState, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    Alert,
    ScrollView,
    ActivityIndicator,
    StatusBar,
    Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons as Icon } from '@expo/vector-icons'; // Using MaterialIcons aliased as Icon
import { SafeAreaView } from 'react-native-safe-area-context';

// --- Firebase Imports ---
import { db, auth } from '../../firebaseConfig'; // Adjust path
import {
    doc,
    serverTimestamp,
    addDoc,
    collection,
    query,
    where,
    documentId,
    getDocs,
    updateDoc, // Import updateDoc for cart clearing
} from 'firebase/firestore';

// --- Other Imports & Constants ---
import axios from 'axios'; // Needed for sending notifications
const AppBackgroundColor = '#FFFFFF';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#666666';
const AccentColor = '#FF0000';
const LightBorderColor = '#EEEEEE';
const PlaceholderBgColor = '#F0F0F0';
const ScreenBackgroundColor = '#F8F9FA';
const BnplPlanDetailColor = TextColorSecondary; // BNPL Style Colors
const BnplPlanValueColor = TextColorPrimary;
const BnplPlanIconColor = '#757575';
const placeholderImagePath = require('../../assets/p3.jpg'); // Adjust path
const CURRENCY_SYMBOL = 'PKR';
const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send'; // Endpoint for Expo Push API
const ERROR_COLOR = '#D32F2F'; // For error text
const CARTS_COLLECTION = 'Carts'; // Define Cart Collection Name

// --- Helper: Fetch Admin Tokens ---
async function getAdminExpoTokens() {
    const tokens = [];
    console.log('[getAdminExpoTokens] Fetching...');
    try {
        const adminQuery = query(
            collection(db, 'Admin'),
            where('role', '==', 'admin')
        );
        const adminSnapshot = await getDocs(adminQuery);
        if (adminSnapshot.empty) {
            console.log('[getAdminExpoTokens] No admins found.');
            return [];
        }
        const adminUserIds = adminSnapshot.docs.map((d) => d.id);
        const MAX_IDS_PER_QUERY = 30; // Firestore 'in' query limit
        const tokenPromises = [];
        for (let i = 0; i < adminUserIds.length; i += MAX_IDS_PER_QUERY) {
            const batchIds = adminUserIds.slice(i, i + MAX_IDS_PER_QUERY);
            const tokensQuery = query(
                collection(db, 'Admin'),
                where(documentId(), 'in', batchIds)
            );
            tokenPromises.push(getDocs(tokensQuery));
        }
        const snapshots = await Promise.all(tokenPromises);
        snapshots.forEach((tokensSnapshot) => {
            tokensSnapshot.forEach((adminDoc) => {
                const token = adminDoc.data()?.expoPushToken;
                if (
                    token &&
                    typeof token === 'string' &&
                    token.startsWith('ExponentPushToken[')
                ) {
                    tokens.push(token);
                } else {
                    console.warn(
                        `[getAdminExpoTokens] Admin ${adminDoc.id} missing/invalid token.`
                    );
                }
            });
        });
        console.log(`[getAdminExpoTokens] Found ${tokens.length} tokens.`);
    } catch (error) {
        console.error('[getAdminExpoTokens] Error:', error);
    }
    return tokens;
}

// --- Helper: Render BNPL Details ---
const renderBnplDetailsSection = (item) => {
    const { bnplPlan, quantity, price } = item;
    if (
        !bnplPlan ||
        !bnplPlan.id ||
        typeof price !== 'number' ||
        typeof quantity !== 'number' ||
        quantity <= 0
    ) {
        return null;
    }

    const name = bnplPlan.name || 'Installment Plan';
    const duration = bnplPlan.duration;
    const interestRate = bnplPlan.interestRate;
    const planType = bnplPlan.planType || 'N/A';
    const formattedInterest =
        interestRate != null ? `${(interestRate * 100).toFixed(1)}%` : 'N/A';
    const isFixed = planType === 'Fixed Duration';
    const numInstallments = !isFixed && duration ? duration : 1;
    let currentMonthlyPayment = null;

    if (!isFixed && duration && duration > 0) {
        const currentTotalPrice = price * quantity;
        const monthlyRaw = currentTotalPrice / duration;
        currentMonthlyPayment = `${CURRENCY_SYMBOL} ${monthlyRaw.toLocaleString(
            undefined,
            { minimumFractionDigits: 0, maximumFractionDigits: 0 }
        )}`;
    }

    return (
        <View style={styles.bnplDetailsContainer}>
            <Text style={styles.bnplPlanTitle}>Payment Plan: {name}</Text>
            {planType !== 'N/A' && (
                <View style={styles.bnplDetailRow}>
                    <Icon
                        name="info-outline"
                        size={14}
                        color={BnplPlanIconColor}
                        style={styles.bnplDetailIcon}
                    />
                    <Text style={styles.bnplDetailText}>
                        Type:{' '}
                        <Text style={styles.bnplDetailValue}>{planType}</Text>
                    </Text>
                </View>
            )}
            {duration && (
                <View style={styles.bnplDetailRow}>
                    <Icon
                        name="schedule"
                        size={14}
                        color={BnplPlanIconColor}
                        style={styles.bnplDetailIcon}
                    />
                    <Text style={styles.bnplDetailText}>
                        Duration:{' '}
                        <Text style={styles.bnplDetailValue}>
                            {duration} {duration === 1 ? 'Month' : 'Months'}
                        </Text>
                        {isFixed ? (
                            <Text style={styles.bnplDetailValue}> (1 Payment)</Text>
                        ) : (
                            <Text style={styles.bnplDetailValue}>
                                {' '}
                                / {numInstallments} Inst.
                            </Text>
                        )}
                    </Text>
                </View>
            )}
            {currentMonthlyPayment && !isFixed && (
                <View style={styles.bnplDetailRow}>
                    <Icon
                        name="calculate"
                        size={14}
                        color={BnplPlanIconColor}
                        style={styles.bnplDetailIcon}
                    />
                    <Text style={styles.bnplDetailText}>
                        Est. Monthly:{' '}
                        <Text style={styles.bnplDetailValue}>
                            {currentMonthlyPayment}
                        </Text>
                    </Text>
                </View>
            )}
            {interestRate !== null && (
                <View style={styles.bnplDetailRow}>
                    <Icon
                        name="percent"
                        size={14}
                        color={BnplPlanIconColor}
                        style={styles.bnplDetailIcon}
                    />
                    <Text style={styles.bnplDetailText}>
                        Interest:{' '}
                        <Text style={styles.bnplDetailValue}>
                            {formattedInterest}
                        </Text>
                    </Text>
                </View>
            )}
        </View>
    );
};

export default function OrderConfirmationScreen() {
    const navigation = useNavigation();
    const route = useRoute();

    // Get Data Passed from CheckoutScreen
    const {
        currentUserDetails,
        cartItems = [],
        subTotal = 0,
        grandTotal = 0,
    } = route.params || {};

    // State for this screen
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);

    // Calculate total number of items
    const totalItemCount = useMemo(() => {
        return cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
    }, [cartItems]);

    // Render Cart Item Display with Full Details
    const renderConfirmationItem = useCallback(
        ({ item, index }) => {
            if (
                !item ||
                !item.id ||
                typeof item.price !== 'number' ||
                typeof item.quantity !== 'number' ||
                item.quantity <= 0
            ) {
                return null;
            }
            const itemTotalPrice = item.price * item.quantity;
            const isLastItem = index === cartItems.length - 1;
            const isBnpl = item.paymentMethod === 'BNPL' && item.bnplPlan;

            return (
                <View
                    style={[styles.cartItem, isLastItem && styles.lastCartItem]}
                >
                    <Image
                        source={
                            item.image
                                ? { uri: item.image }
                                : placeholderImagePath
                        }
                        style={styles.productImage}
                        defaultSource={placeholderImagePath}
                        onError={() =>
                            console.warn(`Image load failed: ${item.image}`)
                        }
                    />
                    <View style={styles.itemDetails}>
                        <Text style={styles.productName} numberOfLines={2}>
                            {item.name || 'Unnamed Product'}
                        </Text>
                        <Text style={styles.itemQuantityPrice}>
                            Qty: {item.quantity} x{' '}
                            {`${CURRENCY_SYMBOL} ${item.price.toLocaleString(
                                undefined,
                                {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                }
                            )}`}
                        </Text>
                        <Text style={styles.itemSubtotal}>
                            Item Total:{' '}
                            <Text style={styles.itemSubtotalValue}>{`${CURRENCY_SYMBOL} ${itemTotalPrice.toLocaleString(
                                undefined,
                                {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                }
                            )}`}</Text>
                        </Text>
                        {isBnpl && renderBnplDetailsSection(item)}
                    </View>
                </View>
            );
        },
        [cartItems]
    );

    // Handle ACTUAL Order Placement and Notification
    const handleConfirmAndPlaceOrder = useCallback(async () => {
        // Validation
        if (
            !currentUserDetails ||
            !currentUserDetails.uid ||
            !currentUserDetails.address ||
            !currentUserDetails.phone
        ) {
            Alert.alert('Error', 'User details missing or incomplete.');
            return;
        }
        if (!cartItems || cartItems.length === 0) {
            Alert.alert('Error', 'Cannot place an order with an empty cart.');
            return;
        }

        setIsPlacingOrder(true);
        const userId = currentUserDetails.uid;
        let newOrderId = null;

        try {
            // Step 1: Prepare Order Data
            const orderDetailsToSave = {
                userId: userId,
                userName: currentUserDetails.name,
                userAddress: currentUserDetails.address,
                userPhone: currentUserDetails.phone,
                items: cartItems.map((item) => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    image: item.image || null,
                    ...(item.paymentMethod === 'BNPL' &&
                        item.bnplPlan && {
                            paymentMethod: 'BNPL',
                            bnplPlan: {
                                id: item.bnplPlan.id,
                                name: item.bnplPlan.name,
                                duration: item.bnplPlan.duration,
                                interestRate: item.bnplPlan.interestRate,
                                planType: item.bnplPlan.planType,
                            },
                        }),
                })),
                subtotal: subTotal, // Keep subtotal if needed for records
                grandTotal: grandTotal,
                status: 'Pending',
                createdAt: serverTimestamp(),
            };

            // Step 2: Save Order to Firestore
            console.log('[ConfirmScreen] Saving order...');
            const orderCollectionRef = collection(db, 'orders');
            const docRef = await addDoc(orderCollectionRef, orderDetailsToSave);
            newOrderId = docRef.id;
            if (!newOrderId) throw new Error('Failed to get Order ID.');
            console.log('[ConfirmScreen] Order saved:', newOrderId);

            // Step 3: Clear User's Cart in Firestore
            try {
                console.log(`[ConfirmScreen] Clearing cart for user: ${userId}`);
                const cartDocRef = doc(db, CARTS_COLLECTION, userId);
                await updateDoc(cartDocRef, {
                    items: [], // Set items to an empty array
                    lastUpdated: serverTimestamp(),
                });
                console.log(`[ConfirmScreen] Cart cleared successfully.`);
            } catch (cartError) {
                console.error(
                    '[ConfirmScreen] Failed to clear cart after order placement:',
                    cartError
                );
                // Log but don't stop the flow
            }

            // Step 4: Send Admin Notifications (Async)
            getAdminExpoTokens()
                .then((adminTokens) => {
                    if (!adminTokens || adminTokens.length === 0) {
                        console.warn(
                            '[ConfirmScreen] No admin tokens found for notification.'
                        );
                        return;
                    }
                    console.log(
                        `[ConfirmScreen] Preparing ${adminTokens.length} notifications...`
                    );
                    const messages = adminTokens
                        .map((token) => {
                            if (
                                !token ||
                                typeof token !== 'string' ||
                                !token.startsWith('ExponentPushToken[')
                            )
                                return null;
                            return {
                                to: token,
                                sound: 'default',
                                title: '🚀 New Order Received!',
                                body: `Order #${newOrderId.substring(
                                    0,
                                    6
                                )}... from ${
                                    currentUserDetails.name
                                }. Total: ${CURRENCY_SYMBOL} ${grandTotal.toLocaleString(
                                    undefined,
                                    {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 0,
                                    }
                                )}`,
                                data: { orderId: newOrderId, type: 'new_order' },
                                priority: 'high',
                                channelId: 'new-orders',
                            };
                        })
                        .filter((msg) => msg !== null);

                    if (messages.length > 0) {
                        console.log(
                            `[ConfirmScreen] Sending ${messages.length} notifications...`
                        );
                        axios
                            .post(EXPO_PUSH_ENDPOINT, messages, {
                                headers: {
                                    Accept: 'application/json',
                                    'Accept-encoding': 'gzip, deflate',
                                    'Content-Type': 'application/json',
                                    Host: 'exp.host',
                                },
                                timeout: 15000,
                            })
                            .catch((err) =>
                                console.error(
                                    '[ConfirmScreen] Axios notification send error:',
                                    err.response?.data || err.message || err
                                )
                            );
                    }
                })
                .catch((tokenError) =>
                    console.error(
                        '[ConfirmScreen] Error fetching admin tokens for notification:',
                        tokenError
                    )
                );

            // Step 5: Show Success & Navigate
            Alert.alert(
                'Order Placed!',
                `Order (#${newOrderId}) confirmed.`,
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.popToTop(), // Go home
                    },
                ]
            );
        } catch (error) {
            console.error('[ConfirmScreen] Error placing order:', error);
            Alert.alert(
                'Order Failed',
                `Could not place order. ${error.message || ''}`
            );
        } finally {
            setIsPlacingOrder(false);
        }
    }, [currentUserDetails, cartItems, subTotal, grandTotal, navigation]);

    // --- Loading/Error Check ---
    if (!currentUserDetails || !cartItems) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.errorText}>
                        Error: Missing order details.
                    </Text>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.errorLink}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // --- Render ---
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar
                barStyle="dark-content"
                backgroundColor={ScreenBackgroundColor}
            />
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContentContainer}
                showsVerticalScrollIndicator={false} // Hide scrollbar if preferred
                keyboardShouldPersistTaps="handled" // Dismiss keyboard on tap
            >
                {/* Sections */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Delivery Address</Text>
                    <View style={styles.addressBox}>
                        <Icon
                            name="location-pin"
                            size={24}
                            color={TextColorSecondary}
                            style={styles.addressIcon}
                        />
                        <View style={styles.addressTextContainer}>
                            <Text style={styles.addressName}>
                                {currentUserDetails.name}
                            </Text>
                            <Text style={styles.addressDetail}>
                                {currentUserDetails.address}
                            </Text>
                            <Text style={styles.addressDetail}>
                                Phone: {currentUserDetails.phone}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Order Items</Text>
                    <View style={styles.cartListContainer}>
                        <FlatList
                            data={cartItems}
                            keyExtractor={(item) =>
                                item.cartItemId ||
                                item.id?.toString() ||
                                `confirm-${Math.random()}`
                            }
                            renderItem={renderConfirmationItem}
                            scrollEnabled={false} // Important: disable FlatList scroll inside ScrollView
                        />
                    </View>
                </View>

                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Order Summary</Text>
                    <View style={styles.summaryBox}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryText}>Subtotal:</Text>
                            <Text style={styles.summaryValue}>{`${CURRENCY_SYMBOL} ${subTotal.toLocaleString(
                                undefined,
                                {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                }
                            )}`}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryText}>Total Items:</Text>
                            <Text style={styles.summaryValue}>
                                {totalItemCount}
                            </Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.summaryRow}>
                            <Text style={styles.totalText}>Total:</Text>
                            <Text style={styles.totalValue}>{`${CURRENCY_SYMBOL} ${grandTotal.toLocaleString(
                                undefined,
                                {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                }
                            )}`}</Text>
                        </View>
                    </View>
                </View>

                {/* Flex expander removed as flexGrow: 1 handles spacing */}
                {/* <View style={styles.flexExpander} /> */}
            </ScrollView>

            {/* Confirm Button Fixed at Bottom */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[
                        styles.confirmButton,
                        isPlacingOrder && styles.disabledButton,
                    ]}
                    onPress={handleConfirmAndPlaceOrder}
                    disabled={isPlacingOrder}
                    activeOpacity={0.8}
                >
                    {isPlacingOrder ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <Text style={styles.confirmButtonText}>
                            Confirm & Place Order
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: ScreenBackgroundColor,
    },
    scrollView: {
        flex: 1,
    },
    scrollContentContainer: {
        flexGrow: 1, // Make content area flexible
        paddingHorizontal: 15,
        paddingTop: 20,
        paddingBottom: 20, // Reduced bottom padding
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 16,
        color: ERROR_COLOR,
        textAlign: 'center',
        marginBottom: 15,
    },
    errorLink: {
        fontSize: 16,
        color: AccentColor,
        fontWeight: 'bold',
    },
    sectionContainer: {
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: TextColorPrimary,
        marginBottom: 12,
    },
    addressBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: AppBackgroundColor,
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: LightBorderColor,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    addressIcon: {
        marginRight: 15,
        color: TextColorSecondary,
    },
    addressTextContainer: {
        flex: 1,
    },
    addressName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: TextColorPrimary,
        marginBottom: 5,
    },
    addressDetail: {
        fontSize: 14,
        color: TextColorSecondary,
        lineHeight: 20,
        marginBottom: 3,
    },
    cartListContainer: {
        backgroundColor: AppBackgroundColor,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: LightBorderColor,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    cartItem: {
        flexDirection: 'row',
        padding: 15,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: LightBorderColor,
        backgroundColor: AppBackgroundColor,
    },
    lastCartItem: {
        borderBottomWidth: 0,
    },
    productImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 15,
        backgroundColor: PlaceholderBgColor,
    },
    itemDetails: {
        flex: 1,
        marginRight: 10,
    },
    productName: {
        fontSize: 15,
        fontWeight: '600',
        color: TextColorPrimary,
        marginBottom: 5,
    },
    itemQuantityPrice: {
        fontSize: 14,
        color: TextColorSecondary,
        marginBottom: 5,
    },
    itemSubtotal: {
        fontSize: 14,
        color: TextColorSecondary,
        marginTop: 2,
    },
    itemSubtotalValue: {
        fontWeight: 'bold',
        color: TextColorPrimary,
    },
    bnplDetailsContainer: {
        marginTop: 10,
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
    summaryBox: {
        backgroundColor: AppBackgroundColor,
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: LightBorderColor,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
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
    // Removed flexExpander style
    footer: {
        // Position fixed at the bottom is implied by layout structure
        padding: 15,
        paddingBottom: Platform.OS === 'ios' ? 30 : 20, // Handle safe area inset
        backgroundColor: AppBackgroundColor,
        borderTopWidth: 1,
        borderTopColor: LightBorderColor,
        // Remove width: '100%', position: 'absolute', bottom: 0 if they were causing issues
    },
    confirmButton: {
        backgroundColor: AccentColor,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 52,
        shadowColor: AccentColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 6,
    },
    disabledButton: {
        backgroundColor: '#BDBDBD',
        elevation: 0,
        shadowOpacity: 0,
    },
    confirmButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: 'bold',
    },
});