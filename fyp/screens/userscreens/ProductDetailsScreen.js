import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View, Text, StyleSheet, Image, FlatList, Dimensions,
    TouchableOpacity, Share, StatusBar, ScrollView, Modal,
    Alert, Animated, Platform, SafeAreaView, ActivityIndicator
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
// Import Ionicons for the cart icon
import { MaterialIcons, Feather, Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { getAuth } from 'firebase/auth';
import {
    collection, query, where, getDocs, limit, orderBy, documentId,
    doc, setDoc, updateDoc, arrayUnion, getDoc, serverTimestamp,
    onSnapshot , increment // Import onSnapshot for real-time cart count
} from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Ensure this path is correct

// --- Constants ---
const AppBackgroundColor = '#FFFFFF';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#666666';
const AccentColor = '#FF0000';
const AccentColor1 = '#D32F2F'; // Primary Red
const AccentDarkerColor = '#B71C1C'; // Darker Red for Gradient/Hover
const LightBorderColor = '#EEEEEE';
const PlaceholderBgColor = '#F0F0F0';
const RelatedSectionBgColor = '#FAFAFA';
const BnplPlanCardBg = '#F8F9FA';
const BnplPlanCardBorder = '#DEE2E6';
const BnplPlanIconColor = AccentColor;
const BnplPlanNameColor = TextColorPrimary;
const BnplPlanDetailColor = TextColorSecondary;
const BnplPlanDetailIconColor = '#757575';
const BnplPlanValueColor = TextColorPrimary;
// Remove ChatIconColor as it's replaced
// const ChatIconColor = '#616161'; // REMOVED
const CartIconColor = '#616161'; // Color for the new Cart Icon
const CartBadgeBackgroundColor = AccentColor; // Use AccentColor for badge
const CartBadgeTextColor = '#FFFFFF';
const BnplBadgeBg = '#FFF3E0';
const BnplBadgeText = '#E65100';
const CodBadgeBg = '#E3F2FD';
const CodBadgeText = '#1565C0';
const StarColor = '#FFC107';
const PlaceholderStarColor = '#E0E0E0';
const StrikethroughColor = '#999';
const DiscountedPriceColor = '#E53935';
const ModalSelectedBg = '#FFF0F0';
const ModalSelectedBorderColor = AccentColor;
const ModalSelectedTextColor = AccentColor;
const ModalProceedDisabledBg = '#FFCDD2';
const PopupBgColor = '#333333';
const PopupTextColor = '#FFFFFF';

// --- Asset Placeholders ---
const placeholderImage = require('../../assets/p3.jpg');
const defaultUserProfileImage = 'https://www.w3schools.com/w3images/avatar2.png';

// --- Dimensions & Layout ---
const { width: screenWidth } = Dimensions.get('window');
const GALLERY_HEIGHT = screenWidth * 0.9;
const MAX_INITIAL_REVIEWS = 3;
const RELATED_PRODUCTS_LIMIT = 6;
const CURRENCY_SYMBOL = 'RS';
const GRID_PADDING_HORIZONTAL = 15;
const CARD_MARGIN_HORIZONTAL = 4;
const NUM_COLUMNS = 2;
const relatedCardWidth = (screenWidth - (GRID_PADDING_HORIZONTAL * 2) - (CARD_MARGIN_HORIZONTAL * NUM_COLUMNS * 2)) / NUM_COLUMNS;

// --- Firestore Constants ---
const CARTS_COLLECTION = 'Carts'; // Added for consistency

// --- Helper Function for Date Formatting ---
// ... (keep formatDate function as is) ...
const formatDate = (date) => {
    if (!date || !(date instanceof Date)) {
        return null;
    }
    // Example format: "April 30, 2025" - Adjust 'en-US' and options as needed
    try {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    } catch (e) {
        console.error("Error formatting date:", e);
        return date.toISOString().split('T')[0]; // Fallback to ISO date part
    }
};

// --- Main Component ---
export default function ProductDetailsScreen() {
    // --- Navigation & Route ---
    const route = useRoute();
    const navigation = useNavigation();
    const auth = getAuth(); // Get auth instance
    const user = auth.currentUser; // Get current user

    // --- State Variables ---
    const [product, setProduct] = useState(null);
    const [isLoadingProduct, setIsLoadingProduct] = useState(true);
    const [isLoadingPlans, setIsLoadingPlans] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0); // For gallery pagination
    const [isWishlisted, setIsWishlisted] = useState(false); // Wishlist state
    const [showAllReviews, setShowAllReviews] = useState(false);
    const [relatedProducts, setRelatedProducts] = useState([]);
    const [loadingRelatedProducts, setLoadingRelatedProducts] = useState(true);
    const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
    const [selectedBnplPlan, setSelectedBnplPlan] = useState(null);
    const [actionType, setActionType] = useState(null); // 'addToCart' or 'buyNow'
    const [isProcessingCart, setIsProcessingCart] = useState(false);
    const [showAddedToCartPopup, setShowAddedToCartPopup] = useState(false);
    const popupOpacity = useRef(new Animated.Value(0)).current;
    const [fetchedReviews, setFetchedReviews] = useState([]);
    const [isLoadingReviews, setIsLoadingReviews] = useState(true);

    // *** ADDED State for Cart Item Count ***
    const [cartItemCount, setCartItemCount] = useState(0);
    // --- End State Variables ---

    // --- Refs ---
    const flatListRef = useRef(null);
    const videoRefs = useRef({});
    const popupTimeoutRef = useRef(null);
    // --- End Refs ---

    // --- Effects ---

    // Effect 1: Load Core Product Details & Plans
    // ... (keep this useEffect as is) ...
    useEffect(() => {
        const initialProductFromRoute = route.params?.product ?? null;
        const productIdFromRoute = route.params?.productId ?? null;

        // Reset state for the new product being loaded
        setIsLoadingProduct(true);
        setIsLoadingPlans(false);
        setProduct(null);
        setIsLoadingReviews(true); // Reset review loading state
        setFetchedReviews([]);      // Clear old reviews
        setShowAllReviews(false);   // Reset review visibility
        setRelatedProducts([]);
        setLoadingRelatedProducts(true);
        setSelectedBnplPlan(null);
        setSelectedPaymentMethod(null);
        setActiveIndex(0);
        setActionType(null);
        setIsProcessingCart(false);
        setShowAddedToCartPopup(false);
        // Cancel any pending popup animation timeout
        if (popupTimeoutRef.current) {
             clearTimeout(popupTimeoutRef.current);
        }

        // Function to process product data and fetch plans if needed
        const loadProductAndPlans = async (productData) => {
            if (!productData || !productData.id) {
                console.warn("loadProductAndPlans called with invalid product data");
                setIsLoadingProduct(false);
                setProduct(null);
                return;
            }

            // Sanitize and structure base product data
            const baseProduct = {
                ...productData,
                id: productData.id, // Ensure ID is present
                bnplAvailable: productData.paymentOption?.BNPL === true,
                codAvailable: productData.paymentOption?.COD === true,
                originalPrice: typeof productData.originalPrice === 'number' ? productData.originalPrice : null,
                discountedPrice: typeof productData.discountedPrice === 'number' ? productData.discountedPrice : null,
                // Ensure BNPLPlanIDs is an array of valid strings
                 BNPLPlanIDs: Array.isArray(productData.BNPLPlanIDs)
                    ? productData.BNPLPlanIDs.filter(id => typeof id === 'string' && id.trim() !== '')
                    : (Array.isArray(productData.BNPLPlans) // Fallback check if structure is different
                         ? productData.BNPLPlans.filter(id => typeof id === 'string' && id.trim() !== '')
                         : []),
                // Prefer pre-populated BNPLPlans if available and valid
                BNPLPlans: Array.isArray(productData.BNPLPlans) && productData.BNPLPlans.length > 0 && typeof productData.BNPLPlans[0] === 'object' && productData.BNPLPlans[0] !== null
                    ? productData.BNPLPlans
                    : [],
                name: productData.name || 'Unnamed Product',
                description: productData.description || '',
                media: productData.media || {},
                image: productData.image || productData.media?.images?.[0] || null, // Fallback logic for image
                category: productData.category || 'Uncategorized',
                rating: typeof productData.rating === 'number' ? productData.rating : null, // Use product's overall rating
                soldCount: typeof productData.soldCount === 'number' ? productData.soldCount : 0,
                // NOTE: We removed product.reviews here, as we fetch separately from the 'Reviews' collection
            };

            const needsPlanFetch = baseProduct.bnplAvailable && baseProduct.BNPLPlanIDs.length > 0 && baseProduct.BNPLPlans.length === 0;
            console.log(`Product ${baseProduct.id}: Initializing. Needs BNPL Plan Fetch: ${needsPlanFetch}`);

            setProduct(baseProduct); // Set the initial product data
            setIsLoadingProduct(false); // Product base data is loaded

            // Fetch detailed BNPL plans if needed
            if (needsPlanFetch) {
                console.log(`Product ${baseProduct.id}: Fetching BNPL plan details...`);
                setIsLoadingPlans(true);
                try {
                    const planPromises = baseProduct.BNPLPlanIDs.map(planId => {
                        if (!planId || typeof planId !== 'string') {
                            console.warn(`Invalid BNPL Plan ID encountered: ${planId}`);
                            return Promise.resolve(null); // Skip invalid IDs
                        }
                        const planRef = doc(db, 'BNPL_plans', planId.trim()); // Assuming collection name is 'BNPL_plans'
                        return getDoc(planRef);
                    });

                    const planSnapshots = await Promise.all(planPromises);
                    const detailedPlans = planSnapshots
                        .map(snap => snap?.exists() ? { id: snap.id, ...snap.data() } : null)
                        .filter(plan => plan !== null); // Filter out nulls from invalid IDs or non-existent docs

                    console.log(`Product ${baseProduct.id}: Fetched ${detailedPlans.length} BNPL plan details.`);
                    // Update product state only if it's still the same product being viewed
                    setProduct(prev => (prev?.id === baseProduct.id ? { ...prev, BNPLPlans: detailedPlans } : prev));
                } catch (planError) {
                    console.error(`Error fetching BNPL plans for product ${baseProduct.id}:`, planError);
                    // Update product state to reflect failed plan fetch
                    setProduct(prev => (prev?.id === baseProduct.id ? { ...prev, BNPLPlans: [] } : prev)); // Set empty array on error
                } finally {
                    setIsLoadingPlans(false); // Mark plan loading as complete
                }
            } else {
                setIsLoadingPlans(false); // No plans needed or already loaded
            }
        };

        // Determine how to load the product (from route params or by fetching ID)
        if (initialProductFromRoute) {
            console.log("Loading product from route parameters...");
            loadProductAndPlans(initialProductFromRoute);
        } else if (productIdFromRoute) {
            console.log(`Fetching product by ID: ${productIdFromRoute}...`);
            const fetchProductById = async () => {
                try {
                    const productRef = doc(db, 'Products', productIdFromRoute);
                    const docSnap = await getDoc(productRef);
                    if (docSnap.exists()) {
                        await loadProductAndPlans({ id: docSnap.id, ...docSnap.data() });
                    } else {
                        console.error(`Product with ID ${productIdFromRoute} not found in Firestore.`);
                        setProduct(null);
                        setIsLoadingProduct(false);
                        Alert.alert("Error", "Product not found.");
                    }
                } catch (error) {
                    console.error("Error fetching product by ID:", error);
                    setProduct(null);
                    setIsLoadingProduct(false);
                    Alert.alert("Error", "Failed to load product details. Please try again.");
                }
            };
            fetchProductById();
        } else {
            console.error("No product data or product ID provided to ProductDetailsScreen.");
            setIsLoadingProduct(false);
            setProduct(null);
            Alert.alert("Error", "Could not load product information.");
        }

        // Cleanup function for the effect
        return () => {
            // Clear any pending popup timeout when the component unmounts or params change
            if (popupTimeoutRef.current) {
                clearTimeout(popupTimeoutRef.current);
            }
            // You could potentially cancel ongoing fetches here if needed, e.g., using AbortController
        };
    }, [route.params?.product, route.params?.productId]);

    // Effect 2: Fetch Related Products
    // ... (keep this useEffect as is) ...
    useEffect(() => {
        // Don't fetch if product isn't loaded, doesn't have an ID or category
        if (!product || !product.id || !product.category || isLoadingProduct) {
             // If product loading finished but product is null, stop related loading too
            if (!isLoadingProduct && !product) {
                setLoadingRelatedProducts(false);
            }
            return;
        }

        const fetchRelated = async () => {
            console.log(`Fetching related products for category: ${product.category}, excluding product: ${product.id}`);
            setLoadingRelatedProducts(true);
            setRelatedProducts([]); // Clear previous related products

            try {
                const q = query(
                    collection(db, 'Products'),
                    where('category', '==', product.category), // Match category
                    where(documentId(), '!=', product.id),    // Exclude current product
                    orderBy(documentId()),                     // Necessary for inequality filter
                    limit(RELATED_PRODUCTS_LIMIT)              // Limit results
                );

                const querySnapshot = await getDocs(q);
                let fetchedProducts = querySnapshot.docs.map(docSnapshot => {
                    const d = docSnapshot.data();
                    // Structure related product data similar to main product for consistency
                    return {
                        id: docSnapshot.id,
                        name: d.name || 'Unnamed',
                        description: d.description || '',
                        category: d.category || 'Uncategorized',
                        originalPrice: typeof d.originalPrice === 'number' ? d.originalPrice : null,
                        discountedPrice: typeof d.discountedPrice === 'number' ? d.discountedPrice : null,
                        image: d.media?.images?.[0] || d.image || null, // Image fallback
                        media: d.media,
                        paymentOption: d.paymentOption,
                        // Keep BNPL structure minimal for related items unless needed
                        BNPLPlanIDs: Array.isArray(d.BNPLPlans) ? d.BNPLPlans.filter(id => typeof id === 'string' && id.trim() !== '') : [],
                        BNPLPlans: [], // Don't fetch full plans for related items initially
                        rating: typeof d.rating === 'number' ? d.rating : null,
                        soldCount: typeof d.soldCount === 'number' ? d.soldCount : 0,
                        bnplAvailable: d.paymentOption?.BNPL === true,
                        codAvailable: d.paymentOption?.COD === true,
                    };
                });

                 // Add a placeholder card if an odd number of items are fetched for grid alignment
                if (fetchedProducts.length > 0 && fetchedProducts.length < RELATED_PRODUCTS_LIMIT && fetchedProducts.length % NUM_COLUMNS !== 0) {
                     fetchedProducts.push({ id: `placeholder-${Date.now()}`, isPlaceholder: true });
                }

                setRelatedProducts(fetchedProducts);
                console.log(`Fetched ${querySnapshot.docs.length} related products.`);

            } catch (error) {
                console.error("Error fetching related products: ", error);
                setRelatedProducts([]); // Set empty on error
            } finally {
                setLoadingRelatedProducts(false);
            }
        };

        fetchRelated();

    }, [product?.id, product?.category, isLoadingProduct]);

    // Effect 3: Fetch Reviews
    // ... (keep this useEffect as is) ...
    useEffect(() => {
        // Don't fetch if we don't have a valid product ID
        if (!product?.id) {
            setIsLoadingReviews(false); // Not loading if no ID
            setFetchedReviews([]);      // Ensure reviews are empty
            return;
        }

        const fetchReviewsAndUsers = async () => {
            console.log(`Starting fetch for reviews and user data for productId: ${product.id}`);
            setIsLoadingReviews(true);
            setFetchedReviews([]); // Clear previous combined reviews before new fetch

            try {
                // === Step 1: Fetch Reviews ===
                const reviewsCollectionRef = collection(db, 'Reviews');
                const reviewsQuery = query(
                    reviewsCollectionRef,
                    where('productId', '==', product.id), // Filter by the current product's ID
                    orderBy('timestamp', 'desc')         // Order by timestamp, newest first
                    // limit(50) // Optional: Add a limit if performance becomes an issue
                );

                const reviewsSnapshot = await getDocs(reviewsQuery);
                // Process review data, convert timestamp
                const reviewsData = reviewsSnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id, // Firestore document ID
                        ...data,    // Spread all fields from the review document
                        // Safely convert Firestore Timestamp to JS Date object
                        timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : null
                    };
                });

                console.log(`Fetched ${reviewsData.length} review documents.`);

                // If no reviews found, stop here
                if (reviewsData.length === 0) {
                    setFetchedReviews([]); // Ensure state is empty array
                    setIsLoadingReviews(false); // Loading is complete
                    return; // Exit the function early
                }

                // === Step 2: Extract Unique User IDs from Fetched Reviews ===
                // Use a Set to automatically handle duplicates, filter out any falsy IDs
                const userIds = [...new Set(reviewsData.map(review => review.userId).filter(id => !!id))];

                console.log(`Found ${userIds.length} unique user IDs in reviews.`);

                // If reviews exist but none have valid user IDs (edge case)
                if (userIds.length === 0) {
                    console.warn("Reviews found, but no valid user IDs were present to fetch user data.");
                    setFetchedReviews(reviewsData); // Set the reviews without user info
                    setIsLoadingReviews(false); // Loading is complete
                    return; // Exit
                }

                // === Step 3: Fetch User Data for the Unique IDs ===
                const usersCollectionRef = collection(db, 'Users');
                const userDataMap = new Map(); // Use a Map for efficient O(1) lookups later { userId -> { name, profileImage } }

                // Firestore 'in' query limitation (currently 30 IDs per query in v9 SDK)
                const FIRESTORE_IN_QUERY_LIMIT = 30;
                const userQueryPromises = []; // Array to hold all query promises

                // Batch user ID fetches to respect the 'in' query limit
                for (let i = 0; i < userIds.length; i += FIRESTORE_IN_QUERY_LIMIT) {
                    const userIdChunk = userIds.slice(i, i + FIRESTORE_IN_QUERY_LIMIT);
                    if (userIdChunk.length > 0) {
                        console.log(`Querying Users collection for chunk of ${userIdChunk.length} IDs starting with ${userIdChunk[0]}`);
                        const usersQuery = query(
                            usersCollectionRef,
                            where(documentId(), 'in', userIdChunk) // Query by document ID (assumed to be the userId)
                        );
                        userQueryPromises.push(getDocs(usersQuery)); // Add the promise to the array
                    }
                }

                // Wait for all user data chunk fetches to complete
                const userSnapshotsArray = await Promise.all(userQueryPromises);

                // Process the results from all chunk queries
                userSnapshotsArray.forEach(userSnapshots => {
                    userSnapshots.docs.forEach(userDoc => {
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            // Store relevant user info in the map, using userDoc.id (which is the userId) as the key
                            userDataMap.set(userDoc.id, {
                                name: userData.name || 'Anonymous User', // Provide a fallback name
                                profileImage: userData.profileImage || null // Store null if profileImage is missing/undefined
                            });
                        } else {
                            // This case should be rare if review.userId is valid, but handle defensively
                            console.warn(`User document with ID ${userDoc.id} referenced in a review was not found.`);
                            // Optionally, you could set a default placeholder here too:
                            // userDataMap.set(userDoc.id, { name: 'User', profileImage: null });
                        }
                    });
                });

                console.log(`Successfully fetched and mapped data for ${userDataMap.size} users.`);

                // === Step 4: Merge User Data back into Review Objects ===
                const combinedReviews = reviewsData.map(review => {
                    const userInfo = userDataMap.get(review.userId); // Look up user data using userId
                    return {
                        ...review, // Keep all original review data
                        // Add userName and userProfileImage, providing defaults if userInfo wasn't found
                        userName: userInfo ? userInfo.name : 'User',
                        userProfileImage: userInfo ? userInfo.profileImage : null
                    };
                });

                // === Step 5: Update State with Combined Data ===
                setFetchedReviews(combinedReviews);

            } catch (error) {
                console.error("An error occurred during fetching reviews or user data: ", error);
                setFetchedReviews([]); // Ensure reviews are cleared on error
                // Optionally display an error message to the user
                // Alert.alert("Error", "Could not load review details. Please try again later.");
            } finally {
                // Ensure loading state is set to false regardless of success or failure
                setIsLoadingReviews(false);
            }
        };

        fetchReviewsAndUsers(); // Execute the async function

    }, [product?.id]);

    // *** ADDED Effect 4: Listen for Cart Updates ***
    useEffect(() => {
        if (user) {
            const cartDocRef = doc(db, CARTS_COLLECTION, user.uid);
            console.log(`Setting up cart listener for user: ${user.uid}`);

            const unsubscribe = onSnapshot(cartDocRef, (docSnap) => {
                let count = 0;
                if (docSnap.exists()) {
                    const items = docSnap.data()?.items;
                    if (Array.isArray(items)) {
                        // Calculate total quantity of all items
                        count = items.reduce((sum, item) => {
                            // Use quantity if it's a positive number, otherwise default to 1 (or 0 if preferred)
                            const quantity = (typeof item.quantity === 'number' && item.quantity > 0) ? item.quantity : 1;
                            return sum + quantity;
                        }, 0);
                    }
                }
                console.log(`Cart listener update: Item count set to ${count}`);
                setCartItemCount(count);
            }, (error) => {
                console.error("Error listening to cart updates:", error);
                // Optionally handle the error, e.g., set count to 0 or show a message
                setCartItemCount(0);
            });

            // Cleanup function: Unsubscribe when the component unmounts or user changes
            return () => {
                console.log("Unsubscribing from cart listener.");
                unsubscribe();
            };
        } else {
            // User is logged out, reset count
            console.log("User logged out, resetting cart count.");
            setCartItemCount(0);
            // No need to return an unsubscribe function as none was created
            return undefined;
        }
    }, [user]); // Dependency on user: Re-run if user logs in/out
    useEffect(() => {
        // Ensure the product is fully loaded, has an ID, and we are not in the loading state.
        // This prevents multiple increments or increments on failed loads.
        if (product && product.id && !isLoadingProduct) {
            const incrementProductView = async () => {
                const productRef = doc(db, 'Products', product.id);
                try {
                    // Atomically increment the viewCount field.
                    // If 'viewCount' doesn't exist, Firestore creates it and sets it to 1.
                    await updateDoc(productRef, {
                        viewCount: increment(1)
                        // Optionally, update a lastViewedAt timestamp:
                        // lastViewedAt: serverTimestamp()
                    });
                    console.log(`View count incremented for product ID: ${product.id}`);
                } catch (error) {
                    console.error("Error incrementing product view count:", error);
                    // This is often a non-critical error, so just logging might be sufficient.
                }
            };

            incrementProductView();
        }
    }, [product, isLoadingProduct]);
    // --- End Effects ---

    // --- Memos ---
    // ... (keep all existing useMemo hooks as they are) ...
    // Memoize gallery items based on product media/image
    const galleryItems = useMemo(() => {
        if (!product || (!product.media && !product.image)) {
             return [{ type: 'image', url: null, id: 'placeholder-img', isPlaceholder: true }];
        }
        const items = [];
        const seenUrls = new Set(); // Prevent duplicate images if listed in both media.images and product.image

        const addItem = (item) => {
             if (item.url && typeof item.url === 'string' && !seenUrls.has(item.url)) {
                 items.push(item);
                 seenUrls.add(item.url);
             } else if (item.isPlaceholder) { // Allow placeholder even if URL is null
                 items.push(item);
             }
        };

        // Add images from media.images array first
        if (product.media?.images && Array.isArray(product.media.images)) {
            product.media.images.forEach(url => addItem({ type: 'image', url: url, id: `img-${url}` }));
        }

        // Add video if available
        const videoUrl = product.media?.video;
        if (videoUrl) {
            addItem({ type: 'video', url: videoUrl, id: `vid-${videoUrl}` });
        }

        // Add fallback product.image if it exists and isn't already added
        if (product.image) {
            if (!seenUrls.has(product.image)) {
                 // Add fallback image to the beginning if no other images exist, else to the end
                if (items.filter(i => i.type === 'image').length === 0) {
                    items.unshift({ type: 'image', url: product.image, id: `img-fallback-${product.image}` });
                } else {
                    items.push({ type: 'image', url: product.image, id: `img-fallback-${product.image}` });
                }
                 seenUrls.add(product.image); // Mark as seen
            }
        }

        // If still no items after all checks, add the placeholder
        if (items.length === 0) {
            items.push({ type: 'image', url: null, id: 'placeholder-img', isPlaceholder: true });
        }
        return items;
    }, [product?.media, product?.image]);

    // Memoize price values and calculations
    const originalPriceValue = useMemo(() => product?.originalPrice, [product?.originalPrice]);
    const discountedPriceValue = useMemo(() => product?.discountedPrice, [product?.discountedPrice]);
    const hasDiscount = useMemo(() =>
        typeof originalPriceValue === 'number' &&
        typeof discountedPriceValue === 'number' &&
        discountedPriceValue < originalPriceValue,
        [originalPriceValue, discountedPriceValue]
    );
    const formatCurrency = (value) => {
         if (typeof value === 'number') { return `${CURRENCY_SYMBOL} ${value.toFixed(0)}`; }
         return null;
    };
    const mainDisplayOriginalPrice = useMemo(() => formatCurrency(originalPriceValue), [originalPriceValue]);
    const mainDisplayDiscountedPrice = useMemo(() => formatCurrency(discountedPriceValue), [discountedPriceValue]);
    const mainFinalDisplayPrice = useMemo(() => mainDisplayDiscountedPrice || mainDisplayOriginalPrice, [mainDisplayDiscountedPrice, mainDisplayOriginalPrice]);
    // Base price for calculations (BNPL, Cart) - use discounted if available, else original
    const basePriceForCalculations = useMemo(() =>
        (hasDiscount && typeof discountedPriceValue === 'number')
            ? discountedPriceValue
            : (typeof originalPriceValue === 'number')
                ? originalPriceValue
                : null, // Return null if no valid price exists
        [hasDiscount, discountedPriceValue, originalPriceValue]
    );

    // Memoize rating and sold count display values
    const averageRating = useMemo(() => typeof product?.rating === 'number' ? product.rating : null, [product?.rating]); // Use product's overall rating
    const soldCount = useMemo(() => product?.soldCount ?? 0, [product?.soldCount]);
    const displaySoldCount = useMemo(() => soldCount > 999 ? `${(soldCount / 1000).toFixed(1)}k` : soldCount.toString(), [soldCount]);

    // Memoize review lists (all fetched reviews and the displayed slice)
    const allReviews = useMemo(() => fetchedReviews, [fetchedReviews]); // The source is now the fetched state
    const displayReviews = useMemo(() =>
        showAllReviews ? allReviews : allReviews.slice(0, MAX_INITIAL_REVIEWS),
        [showAllReviews, allReviews] // Depends on fetched data and the toggle state
    );

    // Memoize BNPL availability and plan grouping
    const hasLoadedBnplOption = useMemo(() =>
        product?.bnplAvailable === true &&
        !isLoadingPlans && // Ensure plans aren't still loading
        Array.isArray(product.BNPLPlans) &&
        product.BNPLPlans.length > 0,
        [product?.bnplAvailable, product?.BNPLPlans, isLoadingPlans]
    );

    const bnplPlanGroups = useMemo(() => {
        if (!hasLoadedBnplOption || !product?.BNPLPlans) return {}; // Return empty if no plans or not loaded

        // Group plans by type (example grouping)
        return product.BNPLPlans.reduce((acc, plan) => {
            if (!plan || typeof plan !== 'object') return acc; // Skip invalid plan objects

            // Determine group title based on planType
            let type = 'Other Plans'; // Default group
            if (['Installment', 'BNPL', 'PayLater'].includes(plan.planType)) {
                type = 'Installment Plans';
            } else if (plan.planType === 'Fixed Duration') {
                type = 'Fixed Duration Plans';
            }
            // Could add more specific types if needed

            if (!acc[type]) { acc[type] = []; } // Initialize group array if it doesn't exist
            acc[type].push(plan);
            return acc;
        }, {});
    }, [hasLoadedBnplOption, product?.BNPLPlans]);
    // --- End Memos ---

    // --- Handlers ---
    // ... (keep toggleWishlist, shareProduct, onViewableItemsChanged, handlePlanSelection, openPaymentModal) ...
    const toggleWishlist = () => {
        // Placeholder: Implement actual wishlist logic (e.g., update Firestore)
        setIsWishlisted(!isWishlisted);
        console.log("Wishlist toggled");
    };

    const shareProduct = async () => {
        if (!product || !product.name) {
            Alert.alert("Error", "Product details not available for sharing.");
            return;
        }
        try {
            const message = `Check out this product: ${product.name}${mainFinalDisplayPrice ? ` - ${mainFinalDisplayPrice}` : ''}`;
            // Placeholder for a real product URL if available
            const url = product?.productUrl || 'https://yourapp.com'; // Replace with actual URL logic
            await Share.share({
                message: message,
                url: url, // Optional URL
                title: product.name // Optional title for some platforms
            });
        } catch (error) {
            console.error('Error sharing product:', error.message);
            if (error.code !== 'USER_CANCELLED_SHARE') {
               Alert.alert("Sharing Error", "Could not share the product at this time.");
            }
        }
    };

    // Handler for FlatList viewability changes (Gallery Pagination)
    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        if (viewableItems && viewableItems.length > 0 && viewableItems[0].index != null) {
            setActiveIndex(viewableItems[0].index);
        }
    }).current;
    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

    // Handler for selecting/deselecting a BNPL plan on the main screen
    const handlePlanSelection = (plan) => {
        if (selectedBnplPlan?.id === plan.id) {
            // Deselect if the same plan is tapped again
            setSelectedBnplPlan(null);
            // If BNPL was the selected method in modal, reset it (unlikely scenario here)
            if(selectedPaymentMethod === 'BNPL') setSelectedPaymentMethod(null);
        } else {
            setSelectedBnplPlan(plan);
            // Automatically select BNPL as payment method if a plan is chosen (for modal prep)
            setSelectedPaymentMethod('BNPL');
        }
    };

    // Opens the Payment Selection Modal
    const openPaymentModal = (type) => { // type is 'addToCart' or 'buyNow'
        if (!product || !product.id || isProcessingCart) return; // Prevent opening if processing or no product

        // Reset modal state before opening
        setSelectedPaymentMethod(null); // Start fresh unless a BNPL plan was pre-selected
        // If a BNPL plan was selected on the main page, pre-select BNPL in the modal
        if (selectedBnplPlan) {
            setSelectedPaymentMethod('BNPL');
        } else {
            // If COD is the *only* option available, pre-select it
            if (product.codAvailable && !hasLoadedBnplOption) {
                 setSelectedPaymentMethod('COD');
            }
        }

        setActionType(type); // Set the action context for the modal's proceed button
        setIsPaymentModalVisible(true);
        console.log(`Payment modal opened for action: ${type}`);
    };

      // Firestore Cart Logic (Handles adding/updating items in Firestore)
      const updateFirestoreCart = async (cartItemDetails) => {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
            Alert.alert("Login Required", "Please log in to add items to your cart.");
            return false; // Indicate failure
        }

        // Validate essential cart item details (Keep this validation)
        if (!cartItemDetails || !cartItemDetails.productId || typeof cartItemDetails.priceAtAddition !== 'number') {
            console.error("Invalid cart item data:", cartItemDetails);
            Alert.alert("Error", "Cannot add item to cart due to missing details.");
            return false;
        }
        if (cartItemDetails.paymentMethod === 'BNPL' && (!cartItemDetails.bnplPlan || !cartItemDetails.bnplPlan.id)) {
            console.error("Missing BNPL plan details for BNPL cart item:", cartItemDetails);
            Alert.alert("Error", "Please select a valid BNPL plan.");
            return false;
        }

        const cartDocRef = doc(db, CARTS_COLLECTION, user.uid); // Use constant
        console.log(`Attempting to update cart for user: ${user.uid}. Item: ${cartItemDetails.productId}, Method: ${cartItemDetails.paymentMethod}`);

        try {
            const cartSnap = await getDoc(cartDocRef);

            if (cartSnap.exists()) {
                // --- Cart Exists: Update items array ---
                console.log("Cart exists, attempting to update items.");
                const cartData = cartSnap.data();
                const items = cartData.items || [];
                let itemUpdated = false;
                let updatedItems = [];

                // Logic to find and potentially update existing item quantity
                if (cartItemDetails.paymentMethod === 'COD') {
                    const existingCodItemIndex = items.findIndex(item =>
                        item.productId === cartItemDetails.productId && item.paymentMethod === 'COD'
                    );
                    if (existingCodItemIndex > -1) {
                        updatedItems = items.map((item, index) =>
                            index === existingCodItemIndex ? { ...item, quantity: (item.quantity || 1) + 1 } : item
                        );
                        itemUpdated = true;
                        console.log("Increased quantity for existing COD item.");
                    }
                } else if (cartItemDetails.paymentMethod === 'BNPL') {
                    const planIdToAdd = cartItemDetails.bnplPlan.id;
                    const exactBnplItemIndex = items.findIndex(item =>
                        item.productId === cartItemDetails.productId &&
                        item.paymentMethod === 'BNPL' &&
                        item.bnplPlan?.id === planIdToAdd
                    );
                    if (exactBnplItemIndex > -1) {
                        updatedItems = items.map((item, index) =>
                            index === exactBnplItemIndex ? { ...item, quantity: (item.quantity || 1) + 1 } : item
                        );
                        itemUpdated = true;
                        console.log("Increased quantity for existing BNPL item with same plan.");
                    } else {
                         const anyOtherBnplItemExists = items.some(item =>
                             item.productId === cartItemDetails.productId && item.paymentMethod === 'BNPL'
                         );
                         if (anyOtherBnplItemExists) {
                             Alert.alert(
                                 "Plan Conflict",
                                 `"${cartItemDetails.productName}" is already in your cart with a different installment plan. Please remove the existing item or adjust its plan.`
                             );
                             return false;
                         }
                    }
                }

                if (!itemUpdated) {
                    // *** Add `addedAt` using client time when adding a NEW item to an EXISTING cart ***
                    // You can choose serverTimestamp here if needed via arrayUnion if structure allows,
                    // but client time is simpler and often sufficient.
                    const newItem = { ...cartItemDetails, addedAt: new Date() }; // Using client time
                    updatedItems = [...items, newItem];
                    console.log("Adding new item to existing cart.");
                }

                // Update Firestore document using updateDoc
                await updateDoc(cartDocRef, {
                    items: updatedItems,
                    lastUpdated: serverTimestamp() // Okay for top-level update
                });

            } else {
                // --- Cart Doesn't Exist: Create new cart ---
                console.log("Creating new cart for user and adding first item.");

                // *** FIX: Construct the item for the array *without* serverTimestamp() ***
                // The cartItemDetails object passed in should NOT contain serverTimestamp() itself.
                const itemForArray = {
                     ...cartItemDetails,
                     addedAt: new Date() // Use client timestamp for the first item's add time
                };

                await setDoc(cartDocRef, {
                    userId: user.uid,
                    items: [itemForArray],           // Use the item prepared for the array
                    createdAt: serverTimestamp(),   // OKAY: serverTimestamp() at top level
                    lastUpdated: serverTimestamp()  // OKAY: serverTimestamp() at top level
                });
            }

            console.log("Cart update/creation successful.");
            return true; // Indicate success

        } catch (error) {
            console.error("Firestore error updating/creating cart:", error);
            // Provide a more specific error message if possible
            Alert.alert("Cart Error", `Could not update your cart. ${error.message}`);
            return false; // Indicate failure
        }
    };

    // ... (keep triggerAddedToCartPopup, proceedDirectlyWithCOD_AddToCart, handleAddToCart, handleBuyNow) ...
        // Handler for showing the "Added to Cart" popup animation
    const triggerAddedToCartPopup = () => {
        if (popupTimeoutRef.current) { clearTimeout(popupTimeoutRef.current); } // Clear existing timeout
        popupOpacity.setValue(0); // Reset opacity
        setShowAddedToCartPopup(true);
        Animated.timing(popupOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        // Set timeout to hide the popup
        popupTimeoutRef.current = setTimeout(() => {
            Animated.timing(popupOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
                setShowAddedToCartPopup(false);
            });
        }, 2000); // Popup visible for 2 seconds
    };

    // Specific handler for adding to cart when ONLY COD is available (skips modal)
    const proceedDirectlyWithCOD_AddToCart = async () => {
        if (isProcessingCart || !product || !product.id) return;

        console.log("Proceeding directly with COD Add to Cart");
        setActionType('addToCart'); // Set context for loader
        setIsProcessingCart(true);

        const priceForCart = basePriceForCalculations;
        if (priceForCart === null) {
            Alert.alert("Error", "Product price information is missing.");
            setIsProcessingCart(false);
            setActionType(null);
            return;
        }

        // Construct the cart item object for COD
        const cartItem = {
            cartItemId: `${product.id}_COD_${Date.now()}`, // Unique ID for this cart instance
            productId: product.id,
            productName: product.name || 'Unnamed Product',
            image: galleryItems.find(item => item.type === 'image' && !item.isPlaceholder)?.url || placeholderImage, // Use first gallery image
            quantity: 1,
            paymentMethod: 'COD',
            priceAtAddition: Number(priceForCart.toFixed(2)), // Ensure price is number
            bnplPlan: null, // No BNPL plan for COD
            // addedAt will be set by updateFirestoreCart using serverTimestamp or new Date()
        };

        let success = false;
        try {
            success = await updateFirestoreCart(cartItem); // Call the Firestore update function
        } catch (error) {
            // Error already logged and alerted within updateFirestoreCart
            success = false;
        } finally {
            setIsProcessingCart(false); // Stop loading indicator
            setActionType(null);    // Clear action context
        }

        if (success) {
            triggerAddedToCartPopup(); // Show success popup
        }
    };

    // Main handler for the "Add to Cart" button press
    const handleAddToCart = () => {
        if (isProcessingCart || !product || !product.id) return; // Prevent action if busy or no product

        const canCOD = product.codAvailable === true;
        // Use hasLoadedBnplOption which checks availability, loading state, and plan presence
        const canBNPL = hasLoadedBnplOption;

        console.log(`Add to Cart pressed. COD available: ${canCOD}, BNPL available: ${canBNPL}`);

        // Case 1: No payment options available at all
        if (!canCOD && !canBNPL) {
            Alert.alert("Payment Unavailable", "Sorry, no payment options are currently available for this product.");
            return;
        }

        // Case 2: Only COD is available
        if (canCOD && !canBNPL) {
            // Directly add to cart using COD logic, skip modal
            proceedDirectlyWithCOD_AddToCart();
        }
        // Case 3: BNPL is available (either alone or with COD)
        else {
            // Open the modal to allow selection between COD (if available) and BNPL plans
            openPaymentModal('addToCart');
        }
    };

    // Main handler for the "Buy Now" button press
    const handleBuyNow = () => {
        if (isProcessingCart || !product || !product.id) return; // Prevent action if busy or no product

        console.log("Buy Now initiated");
        setActionType('buyNow'); // Set context immediately for potential loader

        const canCOD = product.codAvailable === true;
        const canBNPL = hasLoadedBnplOption;

        // Case 1: No payment options available
        if (!canCOD && !canBNPL) {
            Alert.alert("Payment Unavailable", "Cannot proceed with purchase, no payment options available.");
            setActionType(null); // Reset action type
            return;
        }

        // Case 2: Only COD is available
        if (canCOD && !canBNPL) {
            console.log("Buy Now with COD only - preparing direct navigation to checkout");
            setIsProcessingCart(true); // Show loader on button while preparing data

            const priceForCheckout = basePriceForCalculations;
            if (priceForCheckout === null) {
                Alert.alert("Error", "Product price information is missing.");
                setIsProcessingCart(false);
                setActionType(null);
                return;
            }

            // Prepare item data specifically for the Checkout screen
            const checkoutItem = {
                // Structure might differ based on CheckoutScreen needs, adjust accordingly
                id: product.id, // Assuming checkout uses product ID
                name: product.name || 'Unnamed Product',
                image: galleryItems.find(item => item.type === 'image' && !item.isPlaceholder)?.url || placeholderImage,
                quantity: 1,
                price: Number(priceForCheckout.toFixed(2)), // Final price for this item
                paymentMethod: 'COD',
                bnplPlan: null
            };

            console.log("Navigating to CheckoutScreen with COD item:", checkoutItem);
            // Use setTimeout to allow loader state to render before blocking UI with navigation
            setTimeout(() => {
                // Navigate to Checkout screen, passing the single item and total price
                navigation.navigate('CheckoutScreen', { // Ensure 'CheckoutScreen' is the correct route name
                    cartItems: [checkoutItem], // Pass as an array even if single item
                    totalPrice: checkoutItem.price * checkoutItem.quantity // Calculate total for checkout screen
                });
                // Reset state after navigation (or slightly delayed)
                setIsProcessingCart(false);
                setActionType(null);
            }, 50); // Small delay to ensure UI update

        }
        // Case 3: BNPL is available (either alone or with COD)
        else {
            console.log("Buy Now requires payment selection - opening modal.");
            // Open the modal for selection, passing 'buyNow' context
            openPaymentModal('buyNow');
            // Note: setActionType('buyNow') was already set at the start of this handler
        }
    };

    // *** REMOVE handleChat function ***
    // const handleChat = () => { ... }; // REMOVED

    // *** ADDED handler for Cart Icon press ***
    const handleGoToCart = () => {
        console.log("Cart icon pressed - Navigating to CartScreen and requesting header hide");
        // Pass a parameter to tell CartScreen to hide its header
        navigation.navigate('CartScreen', { hideHeader: true });
    };

    // ... (keep handleSeeMoreReviews, handleSeeLessReviews, handleProceedWithPayment) ...
    // Handlers for toggling review visibility
    const handleSeeMoreReviews = () => setShowAllReviews(true);
    const handleSeeLessReviews = () => setShowAllReviews(false);

    // Handler for the "Proceed" button inside the Payment Modal
    const handleProceedWithPayment = async () => {
        if (isProcessingCart) return; // Prevent double clicks

        // Validate selections
        if (!selectedPaymentMethod) {
            Alert.alert("Selection Required", "Please choose a payment method (COD or BNPL).");
            return;
        }
        if (selectedPaymentMethod === 'BNPL' && !selectedBnplPlan) {
            Alert.alert("Selection Required", "Please select an installment plan.");
            return;
        }
        if (!product || !product.id) {
            Alert.alert("Error", "Product details seem to be missing. Please try again.");
            return;
        }

        // Capture action type before async operations might clear it
        const currentAction = actionType;
        console.log(`Proceeding from modal with action: ${currentAction}, method: ${selectedPaymentMethod}`);

        setIsProcessingCart(true);     // Show loading state on modal button
        setIsPaymentModalVisible(false); // Close the modal immediately

        let finalPrice = null;
        let bnplDetailsForCartOrCheckout = null;
        const basePrice = basePriceForCalculations;

        if (basePrice === null) {
            Alert.alert("Error", "Cannot determine product price. Please try again.");
            setIsProcessingCart(false);
            setActionType(null);
            return;
        }

        // Calculate final price and gather BNPL details based on selection
        if (selectedPaymentMethod === 'COD') {
            finalPrice = basePrice;
        } else if (selectedPaymentMethod === 'BNPL' && selectedBnplPlan) {
            const rate = typeof selectedBnplPlan.interestRate === 'number' ? selectedBnplPlan.interestRate : 0;
            finalPrice = basePrice * (1 + (rate / 100)); // Calculate total price including interest

            // Structure BNPL details for storage/checkout
            const duration = typeof selectedBnplPlan.duration === 'number' ? selectedBnplPlan.duration : null;
            const planType = selectedBnplPlan.planType;
            let monthlyPayment = null;
            // Calculate monthly payment if applicable (not fixed duration, valid duration)
            if (planType !== 'Fixed Duration' && duration !== null && duration > 0) {
                 monthlyPayment = finalPrice / duration;
            }

            bnplDetailsForCartOrCheckout = {
                id: selectedBnplPlan.id,
                name: selectedBnplPlan.planName || 'Unnamed Plan',
                duration: duration,
                interestRate: rate,
                planType: planType,
                // Optionally include calculated monthly payment if needed downstream
                calculatedMonthly: monthlyPayment ? Number(monthlyPayment.toFixed(2)) : null,
            };
        }

        // Final price validation after calculation
        if (finalPrice === null || typeof finalPrice !== 'number') {
            Alert.alert("Error", "Could not calculate the final price for the selected option.");
            setIsProcessingCart(false);
            setActionType(null);
            return;
        }

        // --- Branch Logic: Add to Cart vs Buy Now ---

        if (currentAction === 'addToCart') {
            console.log("Modal Proceed: Action is Add to Cart");
            // Construct item details for the cart
             const cartItem = {
                cartItemId: `${product.id}_${selectedPaymentMethod}_${selectedBnplPlan?.id || 'NA'}_${Date.now()}`,
                productId: product.id,
                productName: product.name || 'Unnamed Product',
                image: galleryItems.find(item => item.type === 'image' && !item.isPlaceholder)?.url || placeholderImage,
                quantity: 1,
                paymentMethod: selectedPaymentMethod,
                priceAtAddition: Number(finalPrice.toFixed(2)), // Price at the time of adding
                bnplPlan: bnplDetailsForCartOrCheckout, // Include BNPL details if selected
            };

            let success = false;
            try {
                success = await updateFirestoreCart(cartItem); // Update the persistent cart
            } catch (e) {
                // Error handled within updateFirestoreCart
                success = false;
            } finally {
                setIsProcessingCart(false); // Reset loading state
                setActionType(null);      // Clear action context
            }

            if (success) {
                triggerAddedToCartPopup(); // Show success popup
            }
             // Error Alerts are handled within updateFirestoreCart

        } else if (currentAction === 'buyNow') {
            console.log("Modal Proceed: Action is Buy Now");
            // Construct item details specifically for checkout navigation
            const checkoutItem = {
                id: product.id,
                name: product.name || 'Unnamed Product',
                image: galleryItems.find(item => item.type === 'image' && !item.isPlaceholder)?.url || placeholderImage,
                quantity: 1,
                price: Number(finalPrice.toFixed(2)), // Final calculated price
                paymentMethod: selectedPaymentMethod,
                bnplPlan: bnplDetailsForCartOrCheckout // Pass selected plan details
            };

            console.log("Navigating to CheckoutScreen from Modal:", checkoutItem);
            // Use setTimeout to allow UI to unblock before navigating
            setTimeout(() => {
                navigation.navigate('CheckoutScreen', {
                    cartItems: [checkoutItem],
                    totalPrice: checkoutItem.price * checkoutItem.quantity
                });
                setIsProcessingCart(false); // Reset loading state after navigation starts
                setActionType(null);      // Clear action context
            }, 50);

        } else {
            // Should not happen, but handle defensively
            console.warn("Invalid action type detected in handleProceedWithPayment:", currentAction);
            setIsProcessingCart(false);
            setActionType(null);
        }
    };
    // --- End Handlers ---

    // --- Render Functions ---
    // ... (keep renderGalleryItem, renderTextPagination, renderPriceSection, renderBnplPlansSection, renderReviewCard, renderRelatedProductCard, renderRelatedProductsSection, renderPaymentModal) ...
    const renderGalleryItem = ({ item }) => {
        if (item.isPlaceholder || !item.url) {
            return <Image source={placeholderImage} style={styles.galleryItemImage} resizeMode="contain" />;
        }
        if (item.type === 'image') {
            return (
                <Image
                    source={{ uri: item.url }}
                    style={styles.galleryItemImage}
                    resizeMode="contain"
                    onError={(e) => console.error(`Image Load Error (${item.url}):`, e.nativeEvent.error)}
                />
            );
        }
        if (item.type === 'video') {
            return (
                <Video
                    ref={(ref) => videoRefs.current[item.id] = ref} // Store ref for potential controls
                    style={styles.galleryItemVideo}
                    source={{ uri: item.url }}
                    useNativeControls // Show default video controls
                    resizeMode={ResizeMode.CONTAIN}
                    onError={(e) => console.error(`Video Load Error (${item.url}):`, e)}
                    // Optionally: isLooping, shouldPlay={activeIndex === index} // Autoplay current video
                />
            );
        }
        return null; // Should not happen with current logic
    };

    // Renders the "1/3" pagination text for the gallery
    const renderTextPagination = () => {
        if (galleryItems.length <= 1) return null; // Hide if only one item
        return (
            <View style={styles.paginationTextContainer}>
                <Text style={styles.paginationText}>{activeIndex + 1}/{galleryItems.length}</Text>
            </View>
        );
    };

    // Renders the main price display (final price, optional original price)
    const renderPriceSection = () => {
        if (!mainFinalDisplayPrice) {
            return <Text style={styles.noPriceText}>Price unavailable</Text>;
        }
        return (
            <View style={styles.priceRow}>
                <Text style={styles.finalPrice}>{mainFinalDisplayPrice}</Text>
                {/* Show original price strikethrough only if there's a discount */}
                {hasDiscount && mainDisplayOriginalPrice && (
                    <Text style={styles.originalPrice}>{mainDisplayOriginalPrice}</Text>
                )}
            </View>
        );
    };

    // Renders the BNPL plan selection section on the main product page
    const renderBnplPlansSection = () => {
        if (isLoadingPlans) {
            return (
                <View style={styles.bnplSectionContainer}>
                    <Text style={styles.sectionTitle}>Available BNPL Plans</Text>
                    <ActivityIndicator style={{ marginTop: 20 }} size="small" color={AccentColor} />
                </View>
            );
        }
        // Don't render if BNPL isn't available, plans haven't loaded, or base price is missing
        if (!hasLoadedBnplOption || basePriceForCalculations === null) {
            return null;
        }
        // Don't render if, after loading, the plans array is unexpectedly empty
        if (!product?.BNPLPlans || product.BNPLPlans.length === 0) {
             // console.log("BNPL available but no valid plans found after loading.");
             return null;
        }

        // Helper to render a single plan card (used within the groups)
        const renderSinglePlanCard = (plan, index, isLastInGroup) => {
            if (!plan || typeof plan !== 'object' || !plan.id) return null; // Skip invalid plan data

            const isSelectedOnMain = selectedBnplPlan?.id === plan.id;
            const p = plan; // Alias for brevity
            const name = p.planName || 'Unnamed Plan';
            const duration = typeof p.duration === 'number' ? p.duration : null;
            const interestRate = typeof p.interestRate === 'number' ? p.interestRate : null;
            const interestRateDisplay = typeof interestRate === 'number' ? `${interestRate.toFixed(1)}%` : 'N/A';
            const planType = p.planType || 'General';
            const isFixedDuration = planType === 'Fixed Duration';
            const basePrice = basePriceForCalculations; // Already memoized

            let totalPriceNumeric = null;
            let formattedTotalPrice = null;
            let calculatedMonthlyPayment = null;

            // Calculate total price and monthly payment if possible
            if (typeof interestRate === 'number' && typeof basePrice === 'number') {
                totalPriceNumeric = basePrice * (1 + (interestRate / 100));
                formattedTotalPrice = formatCurrency(totalPriceNumeric);
                if (!isFixedDuration && duration !== null && duration > 0) {
                    calculatedMonthlyPayment = formatCurrency(totalPriceNumeric / duration);
                }
            } else if (interestRate === 0 && typeof basePrice === 'number') {
                 // Handle 0% interest case
                 totalPriceNumeric = basePrice;
                 formattedTotalPrice = formatCurrency(totalPriceNumeric);
                 if (!isFixedDuration && duration !== null && duration > 0) {
                     calculatedMonthlyPayment = formatCurrency(totalPriceNumeric / duration);
                 }
            }
             const numInstallments = !isFixedDuration && duration !== null ? duration : 1;


            return (
                <TouchableOpacity
                    key={plan.id}
                    style={[
                        styles.bnplPlanCard,
                        !isLastInGroup && styles.bnplPlanCardSeparator, // Add margin if not the last card in its group
                        isSelectedOnMain && styles.bnplPlanCardSelected // Highlight if selected
                    ]}
                    onPress={() => handlePlanSelection(plan)}
                    activeOpacity={0.7}
                >
                    {/* Plan Header (Icon + Name) */}
                    <View style={styles.bnplPlanHeader}>
                        <MaterialIcons name="payments" size={18} color={BnplPlanIconColor} style={styles.bnplPlanIcon} />
                        <Text style={styles.bnplPlanNameText}>{name}</Text>
                    </View>
                    {/* Plan Details */}
                    <View style={styles.bnplPlanDetails}>
                        {/* Row: Type */}
                        <View style={styles.detailRow}>
                            <MaterialIcons name="info-outline" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} />
                            <Text style={styles.bnplPlanDetailText}>Type: <Text style={styles.bnplPlanDetailValue}>{planType}</Text></Text>
                        </View>
                        {/* Row: Duration / Installments */}
                        {duration !== null && (
                            <View style={styles.detailRow}>
                                <MaterialIcons name="schedule" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} />
                                <Text style={styles.bnplPlanDetailText}>
                                    Duration: <Text style={styles.bnplPlanDetailValue}>{duration} {duration === 1 ? 'Month' : 'Months'}</Text>
                                    {isFixedDuration
                                        ? <Text style={styles.bnplPlanDetailValue}> (1 Payment)</Text>
                                        : <Text style={styles.bnplPlanDetailValue}> / {numInstallments} Installments</Text>
                                    }
                                </Text>
                            </View>
                        )}
                         {/* Row: Monthly Payment (if applicable) */}
                         {calculatedMonthlyPayment !== null && (
                            <View style={styles.detailRow}>
                                <MaterialIcons name="calculate" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} />
                                <Text style={styles.bnplPlanDetailText}>Est. Monthly: <Text style={styles.bnplPlanDetailValue}>{calculatedMonthlyPayment}</Text></Text>
                            </View>
                         )}
                         {/* Row: Interest Rate */}
                         <View style={styles.detailRow}>
                             <MaterialIcons name="percent" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} />
                             <Text style={styles.bnplPlanDetailText}>Interest Rate: <Text style={styles.bnplPlanDetailValue}>{interestRateDisplay}</Text></Text>
                         </View>
                         {/* Row: Total Price (if calculable) */}
                         {formattedTotalPrice !== null && (
                            <View style={styles.detailRow}>
                                <MaterialIcons name="monetization-on" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} />
                                <Text style={styles.bnplPlanDetailText}>Total Price: <Text style={styles.bnplPlanDetailValue}>{formattedTotalPrice}</Text></Text>
                            </View>
                         )}
                    </View>
                </TouchableOpacity>
            );
        };

        // Get the group titles (e.g., "Installment Plans", "Fixed Duration Plans")
        const groupKeys = Object.keys(bnplPlanGroups);
        if (groupKeys.length === 0) return null; // Should be covered by earlier checks, but good practice

        // Render the section with grouped plans
        return (
            <View style={styles.bnplSectionContainer}>
                <Text style={styles.sectionTitle}>Available BNPL Plans </Text>
                {groupKeys.map(groupTitle => (
                    <View key={groupTitle} style={styles.bnplGroupContainer}>
                        <Text style={styles.bnplGroupTitle}>{groupTitle}</Text>
                        {/* Render cards for each plan within the group */}
                        {bnplPlanGroups[groupTitle].map((plan, index, arr) =>
                            renderSinglePlanCard(plan, index, index === arr.length - 1) // Pass flag if it's the last item
                        )}
                    </View>
                ))}
            </View>
        );
    };

    // Renders a single Review Card using fetched review and user data
    const renderReviewCard = ({ item, index }) => {
        // item = { id, orderId, productId, rating, reviewText, timestamp(Date), userId, userName, userProfileImage }
        const totalDisplayedItems = displayReviews.length; // Use length of the list being rendered
        const isLastDisplayedItem = index === totalDisplayedItems - 1; // Check if it's the last *visible* item
        if (!item || !item.id) return null; // Basic validation

        const formattedDate = formatDate(item.timestamp); // Format the JS Date object

        // Determine the image source: User's image URL or the local default asset
        const imageSource = item.userProfileImage ? { uri: item.userProfileImage } : defaultUserProfileImage;

        return (
            <View style={[styles.reviewCard, isLastDisplayedItem && { borderBottomWidth: 0 }]}>
                {/* Top part: User Image, Name, Date */}
                <View style={styles.reviewHeader}>
                    <Image
                        source={imageSource}
                        style={styles.reviewerImage}
                        onError={(e) => console.log(`Image Error: Failed to load ${item.userProfileImage || 'default image'}`)}
                    />
                    <View style={styles.reviewerInfo}>
                        <Text style={styles.reviewerName} numberOfLines={1} ellipsizeMode="tail">
                            {item.userName || 'User'} {/* Display fetched name or fallback */}
                        </Text>
                        {formattedDate && <Text style={styles.reviewDate}>{formattedDate}</Text>}
                    </View>
                </View>

                {/* Middle part: Rating Stars */}
                <View style={styles.reviewRatingStars}>
                    {[...Array(5)].map((_, i) => (
                        <MaterialIcons
                            key={`star-${item.id}-${i}`} // Unique key using review ID and star index
                            name="star"
                            size={16}
                            color={i < (item.rating || 0) ? StarColor : PlaceholderStarColor} // Fill stars based on rating
                        />
                    ))}
                </View>

                {/* Bottom part: Review Text */}
                <Text style={styles.reviewText}>
                    {item.reviewText || 'No comment provided.'} {/* Display review text or fallback */}
                </Text>
            </View>
        );
    };

    // Renders a single card for the Related Products section
    const renderRelatedProductCard = ({ item }) => {
        // Handle placeholder card for grid alignment
        if (item.isPlaceholder) {
             return <View style={styles.relatedProductCardPlaceholder} />;
        }
        if (!item || !item.id) return null; // Skip if invalid item data

        // Determine price display for the related item
        const itemHasDiscount = typeof item.originalPrice === 'number' && typeof item.discountedPrice === 'number' && item.discountedPrice < item.originalPrice;
        const relatedOP = formatCurrency(item.originalPrice);
        const relatedDP = formatCurrency(item.discountedPrice);
        const relatedFinalPriceDisplay = relatedDP || relatedOP; // Show discounted if available, else original
        const relatedOriginalPriceDisplay = itemHasDiscount ? relatedOP : null; // Only show original if discounted

        // Determine payment badges
        const hasBnpl = item.bnplAvailable === true;
        const hasCod = item.codAvailable === true;

        return (
            <TouchableOpacity
                style={styles.relatedProductCard}
                // Navigate using 'push' to allow navigating to the same screen type
                onPress={() => {
                    if (!isProcessingCart) { // Prevent navigation while main actions are busy
                         // Pass the minimal required data (or full item) to the next screen
                        navigation.push('ProductDetails', { productId: item.id, product: item }); // Pass ID and potentially the basic data
                    }
                }}
                activeOpacity={0.8}
                disabled={isProcessingCart} // Disable touch while processing
            >
                {/* Image */}
                <Image
                    source={item.image ? { uri: item.image } : placeholderImage}
                    style={styles.relatedCardImage}
                    resizeMode="contain"
                />
                {/* Name */}
                <Text style={styles.relatedCardName} numberOfLines={1} ellipsizeMode="tail">
                    {item.name || ''}
                </Text>
                {/* Price */}
                <View style={styles.relatedCardPriceContainer}>
                    {relatedFinalPriceDisplay ? (
                        <Text style={styles.relatedCardDiscountedPrice}>{relatedFinalPriceDisplay}</Text>
                    ) : (
                        <View style={styles.relatedCardPricePlaceholder} /> // Placeholder if no price
                    )}
                    {relatedOriginalPriceDisplay && (
                        <Text style={styles.relatedCardStrikethroughPrice}>{relatedOriginalPriceDisplay}</Text>
                    )}
                </View>
                {/* Description (Optional) */}
                {item.description ? (
                    <Text style={styles.relatedCardDescription} numberOfLines={2} ellipsizeMode="tail">
                        {item.description}
                    </Text>
                ) : (
                    <View style={styles.relatedCardDescriptionPlaceholder} /> // Placeholder if no description
                )}
                {/* Badges (BNPL/COD) */}
                <View style={styles.relatedCardBadgesContainer}>
                    {hasBnpl ? (
                        <View style={styles.relatedCardBnplBadge}>
                            <MaterialIcons name="schedule" size={14} color={BnplBadgeText} />
                            <Text style={styles.relatedCardBnplText}>Installments</Text>
                        </View>
                    ) : hasCod ? ( // Show COD only if BNPL is not available
                        <View style={styles.relatedCardCodBadge}>
                            <MaterialIcons name="local-shipping" size={14} color={CodBadgeText} />
                            <Text style={styles.relatedCardCodText}>COD Available</Text>
                        </View>
                    ) : (
                        <View style={styles.relatedCardBadgePlaceholder} /> // Placeholder if neither
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    // Renders the entire "Related Products" section including title and FlatList
    const renderRelatedProductsSection = () => {
        if (loadingRelatedProducts) {
            return (
                <View style={styles.relatedLoadingContainer}>
                    <ActivityIndicator size="large" color={AccentColor} />
                    <Text style={styles.relatedLoadingText}>Finding Similar Items...</Text>
                </View>
            );
        }
        // Don't render the section if loading finished but no related products were found
        if (!relatedProducts || relatedProducts.length === 0) {
            return null;
        }

        return (
            <View style={styles.relatedProductsContainer}>
                <Text style={styles.relatedProductsTitle}>You Might Also Like</Text>
                <FlatList
                    data={relatedProducts}
                    renderItem={renderRelatedProductCard}
                    keyExtractor={(item) => item.id} // Use unique product ID or placeholder ID
                    numColumns={NUM_COLUMNS}
                    key={`related-grid-${NUM_COLUMNS}`} // Ensure key changes if numColumns changes
                    scrollEnabled={false} // Disable scrolling as it's inside the main ScrollView
                    contentContainerStyle={styles.relatedProductsGridContainer}
                />
                 {/* Add some padding at the bottom of the related section's background */}
                 <View style={styles.relatedProductsBottomPadding} />
            </View>
        );
    };

    // Renders the Payment Selection Modal
    const renderPaymentModal = () => {
        if (!product) return null; // Don't render if product data isn't available

        // Determine if the proceed button should be disabled
        const modalProceedDisabled = isProcessingCart || !selectedPaymentMethod || (selectedPaymentMethod === 'BNPL' && !selectedBnplPlan);

        // Check available options based on product data and loaded BNPL plans
        const hasCodOption = product?.codAvailable === true;
        const hasBnplOptionInModal = hasLoadedBnplOption; // Use the memoized value

        // Helper to format currency inside the modal plan rows
        const formatModalCurrency = (v) => (typeof v === 'number' ? `${CURRENCY_SYMBOL} ${v.toFixed(0)}` : null);

        // Renders a single BNPL plan row inside the modal's ScrollView
        const renderModalPlanRow = (plan) => {
            if (!plan || !plan.id || basePriceForCalculations === null) return null;

            const isSelected = selectedBnplPlan?.id === plan.id; // Check if this plan is the selected one
            const planName = plan.planName || 'Unnamed Plan';
            const duration = typeof plan.duration === 'number' ? plan.duration : null;
            const interestRateValue = typeof plan.interestRate === 'number' ? plan.interestRate : null;
            const interestRateDisplay = typeof interestRateValue === 'number' ? `${interestRateValue.toFixed(1)}%` : 'N/A';
            const planType = plan.planType || 'General';
            const isFixedDurationPlan = plan.planType === 'Fixed Duration';
            const basePrice = basePriceForCalculations;

            let totalPriceNumeric = null;
            let formattedTotalPriceWithInterest = null;
            let calculatedMonthlyPaymentModal = null;
            let numInstallments = !isFixedDurationPlan && duration !== null ? duration : 1;

            // Calculate total and monthly price for display
            if (typeof interestRateValue === 'number' && typeof basePrice === 'number') {
                totalPriceNumeric = basePrice * (1 + (interestRateValue / 100));
                formattedTotalPriceWithInterest = formatModalCurrency(totalPriceNumeric);
                if (!isFixedDurationPlan && duration !== null && duration > 0) {
                    calculatedMonthlyPaymentModal = formatModalCurrency(totalPriceNumeric / duration);
                }
            } else if (interestRateValue === 0 && typeof basePrice === 'number') {
                 totalPriceNumeric = basePrice;
                 formattedTotalPriceWithInterest = formatModalCurrency(totalPriceNumeric);
                 if (!isFixedDurationPlan && duration !== null && duration > 0) {
                     calculatedMonthlyPaymentModal = formatModalCurrency(totalPriceNumeric / duration);
                 }
            }


            return (
                <TouchableOpacity
                    key={plan.id}
                    style={[
                        styles.bnplPlanOption, // Base style for modal option
                        isSelected && styles.bnplPlanOptionSelected // Style for selected option
                    ]}
                    onPress={() => setSelectedBnplPlan(plan)} // Update selected plan state
                    activeOpacity={0.7}
                    disabled={isProcessingCart} // Disable if main action is processing
                >
                    <Text style={styles.bnplPlanNameModal}>{planName}</Text>
                    {/* Details container */}
                    <View style={styles.modalPlanDetailsContainer}>
                        {/* Row: Type */}
                        <View style={styles.modalDetailRow}><MaterialIcons name="info-outline" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} /><Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Type: </Text><Text style={styles.modalPlanDetailValue}>{planType}</Text></Text></View>
                        {/* Row: Duration/Installments */}
                        {duration !== null && (
                            <View style={styles.modalDetailRow}><MaterialIcons name="schedule" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} /><Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Duration: </Text><Text style={styles.modalPlanDetailValue}>{duration} {duration === 1 ? 'Month' : 'Months'}</Text>{isFixedDurationPlan ? (<Text style={styles.modalPlanDetailValue}> (1 Pay)</Text>) : (<Text style={styles.modalPlanDetailValue}> / {numInstallments} Ins</Text>)}</Text></View>
                        )}
                         {/* Row: Monthly Payment */}
                         {calculatedMonthlyPaymentModal !== null && (
                            <View style={styles.modalDetailRow}><MaterialIcons name="calculate" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} /><Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Est. Monthly: </Text><Text style={styles.modalPlanDetailValue}>{calculatedMonthlyPaymentModal}</Text></Text></View>
                         )}
                          {/* Row: Interest */}
                          <View style={styles.modalDetailRow}><MaterialIcons name="percent" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} /><Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Interest: </Text><Text style={styles.modalPlanDetailValue}>{interestRateDisplay}</Text></Text></View>
                          {/* Row: Total Price */}
                          {formattedTotalPriceWithInterest !== null && (
                            <View style={styles.modalDetailRow}><MaterialIcons name="monetization-on" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} /><Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Total Price: </Text><Text style={styles.modalPlanDetailValue}>{formattedTotalPriceWithInterest}</Text></Text></View>
                          )}
                    </View>
                </TouchableOpacity>
            );
        };

        // Function to close the modal (if not processing)
        const closeModal = () => {
            if (!isProcessingCart) {
                setIsPaymentModalVisible(false);
            }
        };

        // --- Modal JSX ---
        return (
            <Modal
                visible={isPaymentModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={closeModal} // For Android back button
            >
                {/* Backdrop */}
                <TouchableOpacity
                    style={styles.modalBackdrop}
                    activeOpacity={1}
                    onPressOut={closeModal} // Close when tapping backdrop
                />
                {/* Modal Content Container */}
                <View style={styles.modalContainer}>
                    {/* Close Button */}
                    <TouchableOpacity style={styles.modalCloseButton} onPress={closeModal} disabled={isProcessingCart}>
                        <MaterialIcons name="close" size={24} color={TextColorSecondary} />
                    </TouchableOpacity>
                    {/* Title */}
                    <Text style={styles.modalTitle}>Select Payment Option</Text>

                    {/* Payment Method Selection (COD / BNPL Buttons) */}
                    <View style={styles.paymentOptionsRowContainer}>
                        {/* COD Button (Render only if available) */}
                        {hasCodOption && (
                            <TouchableOpacity
                                style={[
                                    styles.paymentOptionButtonRow,
                                    selectedPaymentMethod === 'COD' && styles.paymentOptionSelected
                                ]}
                                onPress={() => { setSelectedPaymentMethod('COD'); setSelectedBnplPlan(null); /* Clear BNPL plan if COD selected */ }}
                                activeOpacity={0.7}
                                disabled={isProcessingCart}
                            >
                                <Text style={[styles.paymentOptionTextRow, selectedPaymentMethod === 'COD' && styles.paymentOptionTextSelected]}>
                                    Cash on Delivery
                                </Text>
                            </TouchableOpacity>
                        )}
                        {/* BNPL Button (Render only if available) */}
                        {hasBnplOptionInModal && (
                            <TouchableOpacity
                                style={[
                                    styles.paymentOptionButtonRow,
                                    selectedPaymentMethod === 'BNPL' && styles.paymentOptionSelected
                                ]}
                                onPress={() => { setSelectedPaymentMethod('BNPL'); /* Don't clear BNPL plan here */ }}
                                activeOpacity={0.7}
                                disabled={isProcessingCart}
                            >
                                <Text style={[styles.paymentOptionTextRow, selectedPaymentMethod === 'BNPL' && styles.paymentOptionTextSelected]}>
                                    Buy Now Pay Later
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Message if NO options are available */}
                    {!hasCodOption && !hasBnplOptionInModal && (
                        <Text style={styles.noPaymentOptionsText}>No payment options available for this item.</Text>
                    )}

                    {/* BNPL Plan Selection Area (Render only if BNPL method is selected & available) */}
                    {selectedPaymentMethod === 'BNPL' && hasBnplOptionInModal && (
                        <View style={styles.bnplPlanSelectionContainer}>
                            <Text style={styles.modalSubtitle}>Select Your Installment Plan</Text>
                            {isLoadingPlans ? (
                                <ActivityIndicator style={{ marginVertical: 20 }} size="small" color={AccentColor} />
                            ) : (
                                <ScrollView style={styles.bnplPlanScrollView} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                                    {Object.keys(bnplPlanGroups).length > 0 ? (
                                        // Render plans grouped by title
                                        Object.entries(bnplPlanGroups).map(([groupTitle, plans]) => (
                                            <View key={groupTitle} style={styles.modalPlanGroup}>
                                                <Text style={styles.modalPlanGroupTitle}>{groupTitle}</Text>
                                                {plans.map(renderModalPlanRow)}
                                            </View>
                                        ))
                                    ) : (
                                        <Text style={styles.noPaymentOptionsText}>No installment plans found.</Text> // Should ideally not show if hasBnplOptionInModal is true
                                    )}
                                </ScrollView>
                            )}
                        </View>
                    )}

                    {/* Proceed Button (Render only if at least one payment option exists) */}
                    {(hasCodOption || hasBnplOptionInModal) && (
                        <TouchableOpacity
                            style={[
                                styles.proceedButton,
                                modalProceedDisabled && styles.proceedButtonDisabled // Apply disabled style
                            ]}
                            onPress={handleProceedWithPayment}
                            disabled={modalProceedDisabled} // Disable button based on state
                            activeOpacity={modalProceedDisabled ? 1 : 0.7}
                        >
                            {isProcessingCart ? (
                                <ActivityIndicator size="small" color="#FFFFFF" /> // Show loader when processing
                            ) : (
                                // Dynamically set button text based on the action type
                                <Text style={styles.proceedButtonText}>
                                    {actionType === 'addToCart' ? 'Confirm & Add to Cart' : 'Confirm & Proceed to Buy'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </Modal>
        );
    };
    // --- End Render Functions ---

    // --- Loading / Error States ---
    // ... (keep loading/error states as is) ...
     if (isLoadingProduct) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <StatusBar barStyle="dark-content" backgroundColor={AppBackgroundColor} />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={AccentColor} />
                    <Text style={styles.errorText}>Loading Product Details...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // State 2: Product Failed to Load (product state is null after loading)
    if (!product) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <StatusBar barStyle="dark-content" backgroundColor={AppBackgroundColor} />
                <View style={styles.loadingContainer}>
                    <MaterialIcons name="error-outline" size={40} color={TextColorSecondary} />
                    <Text style={styles.errorText}>Product details could not be loaded.</Text>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
                        <Text style={{ color: AccentColor, fontWeight: 'bold' }}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // --- Main Return: Render the Product Details Screen ---
    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
            <StatusBar barStyle="dark-content" backgroundColor={AppBackgroundColor} />

            {/* Added to Cart Popup Animation */}
            {showAddedToCartPopup && (
                <Animated.View style={[styles.addedPopup, { opacity: popupOpacity }]}>
                    <MaterialIcons name="check-circle" size={18} color={PopupTextColor} style={{ marginRight: 8 }} />
                    <Text style={styles.popupText}>Added to Cart!</Text>
                </Animated.View>
            )}

            <ScrollView
                contentContainerStyle={styles.scrollContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled" // Example for potential future input fields
            >
                {/* Section 1: Product Gallery */}
                {/* ... (keep gallery section as is) ... */}
                 <View style={styles.galleryWrapper}>
                    <FlatList
                        ref={flatListRef}
                        data={galleryItems}
                        renderItem={renderGalleryItem}
                        keyExtractor={(item) => item.id} // Use unique IDs
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onViewableItemsChanged={onViewableItemsChanged}
                        viewabilityConfig={viewabilityConfig}
                        scrollEventThrottle={16} // Improve scroll performance
                        style={styles.galleryFlatList}
                        initialNumToRender={1}
                        maxToRenderPerBatch={1} // Render one item at a time for performance
                        windowSize={3} // Render items in a small window around the current one
                    />
                    <View style={styles.galleryOverlayContainer}>
                        {renderTextPagination()}
                    </View>
                </View>

                {/* Section 2: Core Product Info */}
                {/* ... (keep core info section as is) ... */}
                <View style={styles.contentContainer}>
                    {/* Product Name */}
                    <Text style={styles.productName}>{product.name}</Text>

                    {/* Rating / Sold Count Row */}
                    <View style={styles.reviewSectionHeaderInline}>
                        {averageRating !== null && (
                            <View style={styles.reviewOverallRating}>
                                <MaterialIcons name="star" size={16} color={StarColor} />
                                <Text style={styles.reviewOverallRatingText}>{averageRating.toFixed(1)}</Text>
                            </View>
                        )}
                         {/* Separator - conditional */}
                         {averageRating !== null && soldCount > 0 && <Text style={{ color: TextColorSecondary, marginHorizontal: 6 }}>|</Text> }
                        {soldCount > 0 && (
                            <Text style={styles.soldCountText}>{displaySoldCount} sold</Text>
                        )}
                    </View>

                    {/* Price / Wishlist / Share Row */}
                    <View style={styles.priceActionsRow}>
                        {renderPriceSection()}
                        <View style={styles.rightActionButtonsGroup}>
                            <TouchableOpacity onPress={toggleWishlist} style={styles.iconButton} activeOpacity={0.7}>
                                <MaterialIcons
                                    name={isWishlisted ? 'favorite' : 'favorite-border'}
                                    size={24}
                                    color={isWishlisted ? AccentColor : TextColorPrimary}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={shareProduct} style={[styles.iconButton, { marginLeft: 10 }]} activeOpacity={0.7}>
                                <Feather name="share-2" size={22} color={TextColorPrimary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Section 3: Description */}
                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.descriptionText}>
                        {product.description || 'No description available.'}
                    </Text>

                    {/* Section 4: BNPL Plans (Conditional Render) */}
                    {renderBnplPlansSection()}

                    {/* Section 5: Reviews */}
                    {/* ... (keep reviews section as is) ... */}
                    <View style={styles.reviewSectionWrapper}>
                        <Text style={styles.sectionTitle}>Reviews ({allReviews.length})</Text>

                        {/* Show loading indicator OR the reviews list */}
                        {isLoadingReviews ? (
                            <ActivityIndicator style={{ marginVertical: 20 }} size="small" color={AccentColor} />
                        ) : (
                            <FlatList
                                data={displayReviews} // Use the memoized slice (initial or all)
                                renderItem={renderReviewCard} // Use the card renderer with user data
                                keyExtractor={(item) => item.id} // Use unique Firestore review document ID
                                scrollEnabled={false} // Disable nested scrolling
                                ListEmptyComponent={ // Show if data is empty AFTER loading
                                    <Text style={styles.noReviewsText}>
                                        NO reviews yet!
                                    </Text>
                                }
                            />
                        )}

                        {/* "See More/Less" Button Logic */}
                        {!isLoadingReviews && allReviews.length > MAX_INITIAL_REVIEWS && (
                            <View>
                                {!showAllReviews ? (
                                    <TouchableOpacity style={styles.seeMoreButton} onPress={handleSeeMoreReviews} activeOpacity={0.7}>
                                        <Text style={styles.seeMoreButtonText}>See All {allReviews.length} Reviews</Text>
                                        <MaterialIcons name="keyboard-arrow-down" size={20} color={AccentColor} />
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity style={styles.seeMoreButton} onPress={handleSeeLessReviews} activeOpacity={0.7}>
                                        <Text style={styles.seeMoreButtonText}>Show Fewer Reviews</Text>
                                        <MaterialIcons name="keyboard-arrow-up" size={20} color={AccentColor} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>
                    {/* End Reviews Section */}
                </View>

                {/* Section 6: Related Products */}
                {renderRelatedProductsSection()}

                {/* Bottom Padding */}
                <View style={{height: 20}} />

            </ScrollView>

            {/* Fixed Bottom Button Bar *** MODIFIED *** */}
            <View style={styles.buttonContainer}>
                {/* Cart Icon Button (Replaces Chat) */}
                <TouchableOpacity
                    style={[styles.bottomButtonBase, styles.cartIconButton]} // Use new style
                    onPress={handleGoToCart}
                    activeOpacity={0.7}
                    disabled={isProcessingCart} // Disable if other actions are processing
                >
                    {/* Container for Icon and Badge */}
                    <View style={styles.cartIconContainer}>
                        <Ionicons name="cart-outline" size={26} color={CartIconColor} />
                        {/* Cart Badge - Renders only if count > 0 */}
                        {cartItemCount > 0 && (
                            <View style={styles.cartBadge}>
                                <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
                            </View>
                        )}
                    </View>
                    {/* Optional: Add Text below icon if desired
                    <Text style={styles.cartIconText}>Cart</Text>
                    */}
                </TouchableOpacity>

                {/* Add to Cart Button (Keep as is) */}
                <TouchableOpacity
                    style={[styles.bottomButtonBase, styles.cartButton, isProcessingCart && styles.buttonDisabledGeneric]}
                    onPress={handleAddToCart}
                    activeOpacity={0.7}
                    disabled={isProcessingCart}
                >
                    {isProcessingCart && actionType === 'addToCart' ? (
                        <ActivityIndicator size="small" color={AccentColor} />
                    ) : (
                        <Text style={[styles.buttonText, styles.cartButtonText]}>Add to Cart</Text>
                    )}
                </TouchableOpacity>

                {/* Buy Now Button (Keep as is) */}
                <TouchableOpacity
                    style={[styles.buyButtonContainer, isProcessingCart && styles.buttonDisabledGeneric]}
                    onPress={handleBuyNow}
                    activeOpacity={0.8}
                    disabled={isProcessingCart}
                >
                    <LinearGradient
                        colors={[AccentColor, AccentColor]}
                        style={styles.buyButtonGradient}
                        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                    >
                        {isProcessingCart && actionType === 'buyNow' ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <Text style={[styles.buttonText, styles.buyButtonText]}>Buy Now</Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* Payment Modal */}
            {renderPaymentModal()}

        </SafeAreaView>
    );
}

// --- Styles ---
// Includes styles for product details, gallery, pricing, reviews, related products, buttons, modal, and popup
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: AppBackgroundColor },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: AppBackgroundColor },
    errorText: { fontSize: 16, color: TextColorSecondary, textAlign: 'center', marginTop: 10 },
    scrollContainer: { paddingBottom: 100, backgroundColor: AppBackgroundColor },
    // Gallery Styles
    galleryWrapper: { backgroundColor: AppBackgroundColor, position: 'relative' },
    galleryFlatList: { width: screenWidth, height: GALLERY_HEIGHT },
    galleryItemImage: { width: screenWidth, height: GALLERY_HEIGHT, backgroundColor: PlaceholderBgColor },
    galleryItemVideo: { width: screenWidth, height: GALLERY_HEIGHT, backgroundColor: '#000' },
    galleryOverlayContainer: { position: 'absolute', bottom: 15, right: 15 },
    paginationTextContainer: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10 },
    paginationText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
    // Content Styles
    contentContainer: { paddingHorizontal: 20, paddingTop: 20 },
    productName: { fontSize: 24, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 8, lineHeight: 30 },
    reviewSectionHeaderInline: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' },
    reviewOverallRating: { flexDirection: 'row', alignItems: 'center', marginRight: 0, },
    reviewOverallRatingText: { fontSize: 14, fontWeight: 'bold', color: TextColorPrimary, marginLeft: 4, },
    soldCountText: { fontSize: 14, color: TextColorSecondary, },
    priceActionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, minHeight: 30 },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', flexShrink: 1, marginRight: 10 },
    finalPrice: { fontSize: 20, fontWeight: 'bold', color: AccentColor1 },
    originalPrice: { fontSize: 14, color: StrikethroughColor, textDecorationLine: 'line-through', marginLeft: 8 },
    noPriceText: { fontSize: 16, color: TextColorSecondary, fontStyle: 'italic' },
    rightActionButtonsGroup: { flexDirection: 'row', alignItems: 'center' },
    iconButton: { padding: 5 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 12, marginTop: 15 },
    descriptionText: { fontSize: 15, color: TextColorSecondary, lineHeight: 24, marginBottom: 25 },
    // BNPL Section Styles
    bnplSectionContainer: { marginTop: 10, marginBottom: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: LightBorderColor, },
    bnplGroupContainer: { marginBottom: 15, },
    bnplGroupTitle: { fontSize: 15, fontWeight: '600', color: TextColorSecondary, marginBottom: 10, },
    bnplPlanCard: { backgroundColor: BnplPlanCardBg, borderRadius: 8, borderWidth: 1, borderColor: BnplPlanCardBorder, paddingVertical: 12, paddingHorizontal: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1.5, elevation: 1, },
    bnplPlanCardSelected: { borderColor: AccentColor, backgroundColor: ModalSelectedBg, borderWidth: 1.5, shadowColor: AccentColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 4, },
    bnplPlanCardSeparator: { marginBottom: 12 },
    bnplPlanHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, },
    bnplPlanIcon: { marginRight: 10 },
    bnplPlanNameText: { fontSize: 16, fontWeight: '600', color: BnplPlanNameColor, flexShrink: 1 },
    bnplPlanDetails: { paddingLeft: 5, },
    detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7, },
    detailIcon: { marginRight: 8, width: 16, textAlign: 'center', color: BnplPlanDetailIconColor, },
    bnplPlanDetailText: { fontSize: 13, color: BnplPlanDetailColor, lineHeight: 19, flexShrink: 1, },
    bnplPlanDetailValue: { fontWeight: '600', color: BnplPlanValueColor, },
    // Review Section Styles
    reviewSectionWrapper: { marginBottom: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: LightBorderColor },
    reviewCard: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, },
    reviewerImage: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: PlaceholderBgColor },
    reviewerInfo: { flex: 1, justifyContent: 'center' },
    reviewerName: { fontSize: 14, fontWeight: '600', color: TextColorPrimary, marginBottom: 2 },
    reviewDate: { fontSize: 12, color: TextColorSecondary },
    reviewRatingStars: { flexDirection: 'row', marginBottom: 8, marginLeft: 52 },
    reviewText: { fontSize: 14, color: TextColorPrimary, lineHeight: 20, marginLeft: 52 },
    noReviewsText: { textAlign: 'center', color: TextColorSecondary, marginTop: 20, marginBottom: 20, fontStyle: 'italic' },
    seeMoreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginTop: 10, borderTopWidth: 1, borderTopColor: LightBorderColor },
    seeMoreButtonText: { fontSize: 15, fontWeight: '500', color: AccentColor, marginRight: 5 },
    // Related Products Styles
    relatedProductsContainer: { marginTop: 20, paddingTop: 20, paddingBottom: 0, borderTopWidth: 1, borderTopColor: '#E0E0E0', backgroundColor: RelatedSectionBgColor, },
    relatedProductsTitle: { fontSize: 18, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 15, paddingHorizontal: GRID_PADDING_HORIZONTAL, },
    relatedLoadingContainer: { minHeight: 280, justifyContent: 'center', alignItems: 'center', marginVertical: 20, backgroundColor: RelatedSectionBgColor, paddingHorizontal: GRID_PADDING_HORIZONTAL, },
    relatedLoadingText: { marginTop: 10, fontSize: 14, color: TextColorSecondary, },
    relatedProductsGridContainer: { paddingHorizontal: GRID_PADDING_HORIZONTAL - CARD_MARGIN_HORIZONTAL, },
    relatedProductCard: {
        backgroundColor: '#fff', borderRadius: 8, margin: CARD_MARGIN_HORIZONTAL, width: relatedCardWidth,
        paddingVertical: 12, paddingHorizontal: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2.00, // Slightly adjusted shadow
        minHeight: 300, alignItems: 'center', justifyContent: 'flex-start', overflow: 'hidden', // Prevent content spill
    },
    relatedProductCardPlaceholder: { margin: CARD_MARGIN_HORIZONTAL, width: relatedCardWidth, minHeight: 300, backgroundColor: 'transparent', }, // Placeholder takes space but is invisible
    relatedCardImage: { width: '100%', height: 120, borderRadius: 6, marginBottom: 10, backgroundColor: PlaceholderBgColor, alignSelf: 'center' },
    relatedCardName: { fontSize: 14, fontWeight: '600', color: TextColorPrimary, textAlign: 'center', minHeight: 18, marginBottom: 6, width: '100%', paddingHorizontal: 5, },
    relatedCardPriceContainer: { flexDirection: 'column', alignItems: 'center', minHeight: 35, marginBottom: 8, justifyContent: 'center', width: '100%', },
    relatedCardDiscountedPrice: { fontSize: 15, color: DiscountedPriceColor, fontWeight: 'bold', },
    relatedCardStrikethroughPrice: { textDecorationLine: 'line-through', color: StrikethroughColor, fontWeight: 'normal', fontSize: 13, marginTop: 2 },
    relatedCardPricePlaceholder: { height: 20, minHeight: 35 }, // Placeholder if no price
    relatedCardDescription: { fontSize: 11, color: TextColorSecondary, textAlign: 'center', marginBottom: 10, paddingHorizontal: 5, minHeight: 28, lineHeight: 14, width: '95%', },
    relatedCardDescriptionPlaceholder: { height: 28, marginBottom: 10, },
    relatedCardBadgesContainer: { flexDirection: 'row', justifyContent: 'center', width: '90%', marginTop: 'auto', marginBottom: 4, minHeight: 24, }, // Push badges to bottom
    relatedCardBnplBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: BnplBadgeBg, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, height: 24, alignSelf: 'center', },
    relatedCardBnplText: { fontSize: 11, color: BnplBadgeText, marginLeft: 4, fontWeight: '600', },
    relatedCardCodBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: CodBadgeBg, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, height: 24, alignSelf: 'center', },
    relatedCardCodText: { fontSize: 11, color: CodBadgeText, marginLeft: 4, fontWeight: '600', },
    relatedCardBadgePlaceholder: { height: 24, width: '80%', }, // Placeholder if no badge
    relatedProductsBottomPadding: { height: 15, backgroundColor: RelatedSectionBgColor }, // Padding inside the related section BG

    // --- Bottom Button Bar Styles (MODIFIED) ---
    buttonContainer: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        flexDirection: 'row', backgroundColor: AppBackgroundColor,
        paddingVertical: 8, paddingHorizontal: 8,
        paddingBottom: Platform.OS === 'ios' ? 30 : 12,
        borderTopWidth: 1, borderTopColor: LightBorderColor,
        alignItems: 'stretch', // Ensure buttons fill height
    },
    bottomButtonBase: {
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 4,
        overflow: 'hidden',
        height: 50, // Fixed height for buttons
    },
    // NEW STYLE for the Cart Icon Button
    cartIconButton: {
        flex: 0.6, // Takes similar space as old chat button
        backgroundColor: '#FAFAFA',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        // Removed paddingVertical from here, handled by cartIconContainer
    },
    // NEW STYLE for the container inside the cart button (for badge positioning)
    cartIconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative', // Needed for absolute positioning of the badge
        width: '100%',
        height: '100%',
    },
    // NEW STYLE for the Cart Badge
    cartBadge: {
        position: 'absolute',
        top: 5, // Adjust position as needed
        right: 8, // Adjust position as needed
        backgroundColor: CartBadgeBackgroundColor,
        borderRadius: 9, // Make it circular
        minWidth: 18, // Ensure minimum size for single digit
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 5, // Add some padding for multi-digit numbers
    },
    // NEW STYLE for the text inside the badge
    cartBadgeText: {
        color: CartBadgeTextColor,
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'center',
        lineHeight: 16, // Adjust line height for vertical centering if needed
    },
    // Optional: Style for text below cart icon if you add it
    // cartIconText: {
    //     color: CartIconColor,
    //     fontSize: 11,
    //     fontWeight: '600',
    //     marginTop: 2,
    // },
    // END NEW STYLES for Cart Icon Button

    cartButton: { // Keep Add to Cart button style
        flex: 1,
        flexDirection: 'row',
        backgroundColor: AppBackgroundColor,
        borderWidth: 1.5,
        borderColor: AccentColor,
    },
    cartButtonText: { // Keep Add to Cart text style
        color: AccentColor,
        fontSize: 16,
        fontWeight: 'bold',
    },
    buyButtonContainer: { // Keep Buy Now container style
        flex: 1,
        borderRadius: 10,
        marginHorizontal: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.20,
        shadowRadius: 3.84,
        elevation: 5,
    },
    buyButtonGradient: { // Keep Buy Now gradient style
        flex: 1,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
    },
    buyButtonText: { // Keep Buy Now text style
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonText: { // Keep generic button text style
        textAlign: 'center',
    },
    buttonDisabledGeneric: { // Keep disabled style
        opacity: 0.6,
    },
    // --- End Bottom Button Bar Styles ---

    // Modal Styles
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.5)', },
    modalContainer: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: AppBackgroundColor,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        paddingHorizontal: 20, paddingTop: 40, // Extra top padding for close button space
        paddingBottom: Platform.OS === 'ios' ? 40 : 30, // Safe area padding
        maxHeight: '85%', // Limit modal height
        shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 10,
    },
    modalCloseButton: { position: 'absolute', top: 10, right: 15, padding: 5, zIndex: 1, // Ensure close button is tappable
     },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: TextColorPrimary, textAlign: 'center', marginBottom: 20, },
    modalSubtitle: { fontSize: 16, fontWeight: '600', color: TextColorPrimary, marginBottom: 15, },
    paymentOptionsRowContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20, },
    paymentOptionButtonRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1.5, borderColor: LightBorderColor, borderRadius: 8, marginHorizontal: 5, minHeight: 44, // Ensure decent tap target size
     },
    paymentOptionSelected: { borderColor: ModalSelectedBorderColor, backgroundColor: ModalSelectedBg, },
    paymentOptionTextRow: { fontSize: 13, color: TextColorPrimary, textAlign: 'center', fontWeight: '500' },
    paymentOptionTextSelected: { fontWeight: 'bold', color: ModalSelectedTextColor, },
    noPaymentOptionsText: { fontSize: 14, color: TextColorSecondary, textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
    bnplPlanSelectionContainer: { borderTopWidth: 1, borderTopColor: LightBorderColor, paddingTop: 15, marginBottom: 20, flexShrink: 1, // Allow this section to shrink if content exceeds maxHeight
     },
    bnplPlanScrollView: { maxHeight: Platform.OS === 'ios' ? 250 : 200, // Adjust max height as needed
     },
    modalPlanGroup: { marginBottom: 15, },
    modalPlanGroupTitle: { fontSize: 13, fontWeight: 'bold', color: TextColorSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5, },
    bnplPlanOption: { padding: 12, borderWidth: 1, borderColor: LightBorderColor, borderRadius: 8, marginBottom: 12, },
    bnplPlanOptionSelected: { borderColor: ModalSelectedBorderColor, backgroundColor: ModalSelectedBg, borderWidth: 1.5 },
    bnplPlanNameModal: { fontSize: 15, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 10, },
    modalPlanDetailsContainer: { paddingLeft: 5, },
    modalDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, },
    modalDetailIcon: { marginRight: 8, width: 16, textAlign: 'center', color: BnplPlanDetailIconColor, },
    modalPlanDetailText: { fontSize: 12, color: TextColorSecondary, lineHeight: 18, flexShrink: 1, },
    modalPlanDetailLabel: { color: TextColorSecondary, }, // Keep label same color as text
    modalPlanDetailValue: { fontWeight: '600', color: TextColorPrimary, },
    proceedButton: { backgroundColor: AccentColor, paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginTop: 10, minHeight: 50, justifyContent: 'center', },
    proceedButtonDisabled: { backgroundColor: ModalProceedDisabledBg, // Use a lighter/disabled color
         opacity: 1, // Override generic opacity if needed, rely on color change
     },
    proceedButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', },
    // Added to Cart Popup Styles
    addedPopup: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 20, // Adjust top position as needed
        left: 20, right: 20, // Span across width with padding
        backgroundColor: PopupBgColor,
        paddingVertical: 12, paddingHorizontal: 15,
        borderRadius: 8,
        elevation: 10, // Android shadow
        shadowColor: '#000', // iOS shadow
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, // Ensure popup is on top
    },
    popupText: { color: PopupTextColor, fontSize: 15, fontWeight: '600', }
});