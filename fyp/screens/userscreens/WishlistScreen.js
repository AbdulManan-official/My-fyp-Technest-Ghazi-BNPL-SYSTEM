/**
 * WishlistScreen.js
 *
 * Displays the user's saved wishlist items fetched from Firestore.
 * Allows removing items or moving them to the cart.
 * Shows BNPL availability badge if stored in the wishlist item data.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { getAuth } from 'firebase/auth';
import {
    collection, query, getDocs, deleteDoc, doc,
    setDoc, updateDoc, arrayUnion, getDoc, serverTimestamp, orderBy
} from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Ensure this path is correct
import { MaterialIcons } from '@expo/vector-icons';

// --- Constants ---
const AppBackgroundColor = '#F2F2F2';
const CardBackgroundColor = '#FFFFFF'; // Standard white card background
const TextColorPrimary = '#333333';
const TextColorSecondary = '#666666';
const AccentColor = '#FF0000'; // Red for price, cart button
const PlaceholderBgColor = '#DDDDDD';
const RemoveButtonBg = '#E0E0E0';
const CURRENCY_SYMBOL = 'RS';
const SeparatorColor = '#EAEAEA'; // Color for the separator line
const BnplBadgeBg = '#E3F2FD'; // Match ProductDetailsScreen
const BnplBadgeText = '#1565C0'; // Match ProductDetailsScreen

// Placeholder image if item image fails or is missing
const placeholderImage = require('../../assets/p3.jpg'); // Ensure this path is correct

// --- Cart Update Utility ---
// Adds item to cart (defaults to COD method for wishlist move)
const updateFirestoreCart = async (cartItemDetails) => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
        console.error("User not logged in for cart update.");
        // Alert should be handled by the calling function (handleMoveToCart)
        return false;
    }
    if (!cartItemDetails?.productId || typeof cartItemDetails?.priceAtAddition !== 'number') {
        console.error("Invalid item data for cart update:", cartItemDetails);
        Alert.alert("Error", "Invalid item data."); // Alert here is okay as it's an internal error
        return false;
    }

    const cartDocRef = doc(db, "Carts", user.uid);
    console.log(`Updating cart for user: ${user.uid}, Product: ${cartItemDetails.productId}, Method: ${cartItemDetails.paymentMethod}`);

    try {
        const cartSnap = await getDoc(cartDocRef);
        if (cartSnap.exists()) { // Cart exists - Update
            const items = cartSnap.data().items || [];
            let updatedItems = [...items];
            let itemFoundAndUpdated = false;

            // Check if item (with COD) already exists to update quantity
            const existingIndex = items.findIndex(item =>
                item.productId === cartItemDetails.productId && item.paymentMethod === 'COD'
            );

            if (existingIndex > -1) { // Update quantity
                updatedItems[existingIndex] = { ...items[existingIndex], quantity: (items[existingIndex].quantity || 0) + 1 };
                itemFoundAndUpdated = true;
                console.log("COD Item quantity updated in cart.");
            }

            if (itemFoundAndUpdated) {
                await updateDoc(cartDocRef, { items: updatedItems, lastUpdated: serverTimestamp() });
            } else { // Add new item
                await updateDoc(cartDocRef, { items: arrayUnion({ ...cartItemDetails, quantity: 1, addedAt: serverTimestamp() }), lastUpdated: serverTimestamp() });
                console.log("New COD item added to existing cart.");
            }
            return true; // Success
        } else { // Cart doesn't exist - Create
            const initialCartItem = { ...cartItemDetails, quantity: 1, addedAt: serverTimestamp() };
            await setDoc(cartDocRef, { userId: user.uid, items: [initialCartItem], createdAt: serverTimestamp(), lastUpdated: serverTimestamp() });
            console.log("New cart created and COD item added.");
            return true; // Success
        }
    } catch (error) {
        console.error("Error updating/creating Firestore cart:", error);
        Alert.alert("Error", "Could not update your cart.");
        return false; // Failure
    }
};
// --- End Cart Update Utility ---


const WishlistScreen = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused(); // Hook to refetch when screen is focused
    const [wishlistItems, setWishlistItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true); // Controls initial loading indicator
    const [error, setError] = useState(null); // Stores error messages
    const [processingItemId, setProcessingItemId] = useState(null); // Tracks which item action is running

    // --- Fetch Wishlist Data ---
    const fetchWishlist = useCallback(async () => {
        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
            setError("Please log in to view your wishlist.");
            setIsLoading(false); // Stop loading
            setWishlistItems([]); // Clear items if user logged out
            return;
        }

        console.log(`Fetching wishlist for user: ${user.uid}`);
        setIsLoading(true); // Show loader
        setError(null); // Reset previous errors

        try {
            // Query the wishlist subcollection for the logged-in user
            const wishlistQuery = query(
                collection(db, 'Users', user.uid, 'wishlist'),
                orderBy('addedAt', 'desc') // Order by most recently added
            );
            const querySnapshot = await getDocs(wishlistQuery);

            // Map Firestore documents to state array, including the document ID
            const items = querySnapshot.docs.map(doc => ({
                id: doc.id, // Firestore document ID within the subcollection
                ...doc.data() // All fields stored in the document (productId, name, image, bnplAvailable, etc.)
            }));

            setWishlistItems(items);
            console.log(`Fetched ${items.length} wishlist items.`);

        } catch (err) {
            console.error("Error fetching wishlist:", err);
            setError("Could not load your wishlist. Please try again later.");
            setWishlistItems([]); // Clear items on error
        } finally {
            setIsLoading(false); // Hide loader after fetch attempt
        }
    }, []); // useCallback ensures function identity stability

    // --- useEffect to Fetch Data When Screen is Focused ---
    useEffect(() => {
        if (isFocused) {
            console.log("Wishlist screen focused, fetching data...");
            fetchWishlist(); // Fetch data when the screen comes into view
        } else {
             // Optional: Reset processing state if user navigates away during an action
             setProcessingItemId(null);
        }
    }, [isFocused, fetchWishlist]); // Re-run effect if focus state or fetchWishlist changes

    // --- Handle Remove from Wishlist ---
    const handleRemove = useCallback(async (wishlistItemId, productName) => {
        if (processingItemId) return; // Prevent concurrent actions

        // Confirmation Dialog
        Alert.alert(
            "Confirm Removal",
            `Are you sure you want to remove "${productName || 'this item'}" from your wishlist?`,
            [
                { text: "Cancel", style: "cancel", onPress: () => console.log("Removal cancelled") },
                {
                    text: "Remove", style: "destructive",
                    onPress: async () => {
                        setProcessingItemId(wishlistItemId); // Mark this item as being processed
                        const auth = getAuth();
                        const user = auth.currentUser;

                        if (!user) { // Should not happen if fetch succeeded, but good practice
                            Alert.alert("Error", "You must be logged in to modify your wishlist.");
                            setProcessingItemId(null);
                            return;
                        }

                        // Create a reference to the specific document in the subcollection
                        const wishlistItemRef = doc(db, 'Users', user.uid, 'wishlist', wishlistItemId);

                        try {
                            await deleteDoc(wishlistItemRef); // Delete the document
                            console.log(`Item ${wishlistItemId} removed from wishlist.`);
                            // Update UI optimistically by filtering the item out
                            setWishlistItems(prev => prev.filter(item => item.id !== wishlistItemId));
                            // Optional: Show a success toast message here
                        } catch (err) {
                            console.error("Error removing item from wishlist:", err);
                            Alert.alert("Error", "Could not remove item. Please try again.");
                        } finally {
                            setProcessingItemId(null); // Unmark item processing
                        }
                    }
                }
            ],
            { cancelable: true } // Allow dismissing alert by tapping outside on Android
        );
    }, [processingItemId]); // Dependency ensures we don't run multiple removes

    // --- Handle Move to Cart ---
    const handleMoveToCart = useCallback(async (item) => {
        if (processingItemId) return; // Prevent concurrent actions

        setProcessingItemId(item.id); // Mark item as processing
        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
            Alert.alert("Login Required", "Please log in to move items to your cart.");
            setProcessingItemId(null); return;
        }
        if (!item.productId) {
             Alert.alert("Error", "Cannot move to cart: Product ID missing.");
             setProcessingItemId(null); return;
        }

        // --- 1. Add to Cart ---
        // Determine the price to use (prefer discounted if available)
        const priceForCart = item.discountedPrice ?? item.originalPrice;
        if (typeof priceForCart !== 'number') {
             Alert.alert("Error", "Cannot move to cart: Item price is invalid.");
             setProcessingItemId(null); return;
        }

        // Prepare item details for the cart collection
        const cartItem = {
            productId: item.productId, // The ID of the product in the 'Products' collection
            productName: item.name || 'Unnamed Product',
            image: item.image || null, // Use image URL stored in wishlist item
            priceAtAddition: Number(priceForCart.toFixed(2)),
            paymentMethod: 'COD', // Defaulting to COD for "Move to Cart"
            bnplPlan: null, // No specific plan selected when moving from wishlist
        };

        const addedToCart = await updateFirestoreCart(cartItem);

        // --- 2. Remove from Wishlist (Only if successfully added to cart) ---
        if (addedToCart) {
            const wishlistItemRef = doc(db, 'Users', user.uid, 'wishlist', item.id); // Ref to item in wishlist
            try {
                await deleteDoc(wishlistItemRef); // Delete from wishlist
                console.log(`Item ${item.id} removed from wishlist after moving to cart.`);
                // Update UI optimistically
                setWishlistItems(prev => prev.filter(wishlistItem => wishlistItem.id !== item.id));
                Alert.alert("Success", `"${item.name || 'Item'}" moved to your cart.`);
            } catch (err) {
                console.error("Error removing item from wishlist after adding to cart:", err);
                Alert.alert("Partial Success", `"${item.name || 'Item'}" was added to cart, but couldn't be removed from wishlist automatically.`);
                // Item remains in wishlist UI here, user needs to remove manually or refresh
            } finally {
                 setProcessingItemId(null); // Unmark item processing
            }
        } else {
            // Adding to cart failed (updateFirestoreCart already showed an alert)
            setProcessingItemId(null); // Unmark item processing
        }
    }, [processingItemId]); // Dependency prevents concurrent actions

    // --- Navigate to Product Details ---
     const handleNavigateToDetails = (productId) => {
         if (!productId) {
             console.warn("Cannot navigate: Product ID is missing from wishlist item.");
             Alert.alert("Error", "Could not open product details.");
             return;
         }
         console.log(`Navigating to ProductDetails for productId: ${productId}`);
         navigation.navigate('ProductDetails', { productId: productId });
     };


    // --- Render Individual Wishlist Item ---
    const renderItem = ({ item }) => {
        const isProcessingThisItem = processingItemId === item.id;
        // Safely determine the display price string
        const displayPrice = item.finalDisplayPrice // Use pre-formatted if available from wishlist add
                             || (typeof item.discountedPrice === 'number' ? `${CURRENCY_SYMBOL} ${item.discountedPrice.toFixed(0)}`
                             : typeof item.originalPrice === 'number' ? `${CURRENCY_SYMBOL} ${item.originalPrice.toFixed(0)}`
                             : 'Price N/A'); // Fallback if no price found

        // Check if BNPL flag is explicitly true in the item data
        const isBnplAvailable = item.bnplAvailable === true;

        return (
             <TouchableOpacity
                activeOpacity={0.8} // Make touch feedback a bit more visible
                onPress={() => handleNavigateToDetails(item.productId)}
                disabled={isProcessingThisItem} // Disable touch navigation during actions
                style={styles.cardOuter}
             >
                <View style={styles.cardInner}>
                    {/* Product Image */}
                    <Image
                        source={item.image ? { uri: item.image } : placeholderImage}
                        style={styles.image}
                        onError={(e) => console.log(`Failed to load wishlist image: ${item.image}`, e.nativeEvent.error)}
                    />

                    {/* Info Column */}
                    <View style={styles.info}>
                        {/* Top section: Title, Price, Badge */}
                        <View>
                             {/* Title */}
                             <Text style={styles.title} numberOfLines={2}>{item.name || 'Unnamed Product'}</Text>
                             {/* Price */}
                             <Text style={styles.price}>{displayPrice}</Text>
                             {/* BNPL Badge (Conditional) */}
                             {isBnplAvailable && (
                                <View style={styles.badgeContainer}>
                                     <View style={styles.bnplBadge}>
                                         <MaterialIcons name="schedule" size={12} color={BnplBadgeText} style={styles.badgeIcon}/>
                                         <Text style={styles.bnplBadgeText}>BNPL Available</Text>
                                     </View>
                                </View>
                             )}
                        </View>

                        {/* Bottom section: Buttons */}
                        <View style={styles.buttons}>
                             {/* Move to Cart Button */}
                             <TouchableOpacity
                                 style={[styles.actionButton, styles.cartBtn, isProcessingThisItem && styles.buttonDisabled]}
                                 onPress={() => handleMoveToCart(item)}
                                 disabled={isProcessingThisItem}
                             >
                                 {/* Show ActivityIndicator only on this button if it's being processed */}
                                 {isProcessingThisItem ? (
                                     <ActivityIndicator size="small" color={CardBackgroundColor} />
                                 ) : (
                                     <Text style={styles.cartText}>Move to Cart</Text>
                                 )}
                             </TouchableOpacity>

                             {/* Remove Button */}
                             <TouchableOpacity
                                 style={[styles.actionButton, styles.removeBtn, isProcessingThisItem && styles.buttonDisabled]}
                                 onPress={() => handleRemove(item.id, item.name)}
                                 disabled={isProcessingThisItem} // Disable both buttons during action
                             >
                                 <Text style={styles.removeText}>Remove</Text>
                             </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    }


    // --- Conditional Rendering Logic ---

    // 1. Show Loader during initial fetch
    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={AccentColor} />
                <Text style={styles.loadingText}>Loading Wishlist...</Text>
            </View>
        );
    }

    // 2. Show Error message if fetch failed
    if (error) {
        return (
            <View style={styles.centered}>
                <MaterialIcons name="error-outline" size={40} color={TextColorSecondary} style={{ marginBottom: 15 }}/>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={fetchWishlist} style={styles.retryButton}>
                     <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // 3. Show Empty state if fetch succeeded but no items found
    if (wishlistItems.length === 0) {
         return (
             <View style={styles.centered}>
                <MaterialIcons name="favorite-border" size={60} color={TextColorSecondary} style={{ marginBottom: 15 }}/>
                <Text style={styles.emptyText}>Your wishlist is empty.</Text>
                <Text style={styles.emptySubText}>Tap the heart on products to add them here.</Text>
            </View>
        );
    }

    // 4. Show the FlatList if loading is done, no error, and items exist
    return (
        <View style={styles.container}>
            <FlatList
                data={wishlistItems}
                keyExtractor={(item) => item.id} // Use Firestore document ID as the key
                renderItem={renderItem}
                contentContainerStyle={styles.listContentContainer}
                ItemSeparatorComponent={() => <View style={styles.separator} />} // Visual separator
                // Optional Performance Props:
                // initialNumToRender={10}
                // maxToRenderPerBatch={10}
                // windowSize={21}
            />
        </View>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: AppBackgroundColor,
    },
    centered: { // Used for Loading, Error, Empty states
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: { // Optional loading text style
        marginTop: 10,
        fontSize: 14,
        color: TextColorSecondary,
    },
    errorText: {
        fontSize: 16,
        color: TextColorSecondary,
        textAlign: 'center',
        marginBottom: 15,
    },
    retryButton: {
        backgroundColor: AccentColor,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 5,
        marginTop: 10,
    },
    retryButtonText: {
        color: CardBackgroundColor,
        fontSize: 14,
        fontWeight: '500',
    },
    listContentContainer: {
        paddingBottom: 15, // Only bottom padding for the list itself
    },
    cardOuter: {
         backgroundColor: CardBackgroundColor, // Use constant
         // Removed horizontal margin for full width
         elevation: 1,
         shadowColor: '#000',
         shadowOffset: { width: 0, height: 1 },
         shadowOpacity: 0.05,
         shadowRadius: 1.0,
    },
    cardInner: {
        flexDirection: 'row',
        paddingHorizontal: 15, // Padding inside the card
        paddingVertical: 12, // Vertical padding inside card
    },
    image: {
        width: 90,
        height: 90,
        borderRadius: 6,
        backgroundColor: PlaceholderBgColor,
        resizeMode: 'contain',
        marginRight: 15, // Space between image and text
        alignSelf: 'center',
    },
    info: {
        flex: 1, // Take remaining width
        justifyContent: 'space-between', // Push content vertically apart
        paddingVertical: 0, // Minimal vertical padding within info if needed
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
        color: TextColorPrimary,
        marginBottom: 4,
        lineHeight: 20, // Adjust line height if needed
    },
    price: {
        fontSize: 14,
        fontWeight: 'bold',
        color: AccentColor,
        marginBottom: 8, // Space below price before badge/buttons
    },
    badgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10, // Space below badge(s) before buttons
        alignSelf: 'flex-start', // Prevent container stretching full width
    },
    bnplBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: BnplBadgeBg,
        borderRadius: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    badgeIcon: {
        marginRight: 5,
    },
    bnplBadgeText: {
        fontSize: 11,
        color: BnplBadgeText,
        fontWeight: '600',
    },
    buttons: {
        flexDirection: 'row',
        gap: 10, // Space between buttons
        alignItems: 'center',
        marginTop: 'auto', // Push buttons to bottom of info column
    },
    actionButton: {
         paddingVertical: 8,
         paddingHorizontal: 12,
         borderRadius: 5,
         minWidth: 80, // Ensure minimum touchable width
         alignItems: 'center',
         justifyContent: 'center',
         height: 32, // Fixed height for alignment
    },
    cartBtn: {
        backgroundColor: AccentColor,
    },
    cartText: {
        color: CardBackgroundColor, // White text on red button
        fontSize: 12,
        fontWeight: '500',
    },
    removeBtn: {
        backgroundColor: RemoveButtonBg, // Grey button
    },
    removeText: {
        color: TextColorPrimary, // Darker text on grey button
        fontSize: 12,
        fontWeight: '500',
    },
    buttonDisabled: {
        opacity: 0.6, // Visual feedback for disabled state
    },
    emptyText: {
        fontSize: 18,
        color: TextColorSecondary,
        marginBottom: 10,
        fontWeight: '500',
        textAlign: 'center',
    },
    emptySubText: {
        fontSize: 14,
        color: TextColorSecondary,
        textAlign: 'center',
    },
    separator: {
        height: 1, // Thin line separator
        backgroundColor: SeparatorColor, // Use separator color
    }
});

export default WishlistScreen;