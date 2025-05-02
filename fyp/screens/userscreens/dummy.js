import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Share,
    StatusBar,
    FlatList,
    Dimensions,
    Platform,
    ActivityIndicator,
    Modal,
    Alert,
    Animated,
    Pressable // Use Pressable for better feedback on main buttons
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { getAuth } from 'firebase/auth';
import {
    collection, query, where, getDocs, limit, orderBy, documentId,
    doc, setDoc, updateDoc, arrayUnion, getDoc, serverTimestamp, Timestamp, // Import Timestamp
    deleteDoc // <<<--- ADDED for Wishlist
} from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Ensure this path is correct

// --- Constants ---
const AppBackgroundColor = '#FFFFFF';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#666666';
const AccentColor = '#D32F2F'; // Original Primary Red (Used for non-interactive accents like price, wishlist icon)
const AccentDarkerColor = '#B71C1C'; // Kept for potential other uses
const LightBorderColor = '#EEEEEE';
const PlaceholderBgColor = '#F0F0F0';
const RelatedSectionBgColor = '#FAFAFA';
const BnplPlanCardBg = '#F8F9FA';
const BnplPlanCardBorder = '#DEE2E6';
const BnplPlanIconColor = AccentColor; // Keep original accent inside plan card details
const BnplPlanNameColor = TextColorPrimary;
const BnplPlanDetailColor = TextColorSecondary;
const BnplPlanDetailIconColor = '#757575';
const BnplPlanValueColor = TextColorPrimary;
const ChatIconColor = '#424242';
const BnplBadgeBg = '#E3F2FD';
const BnplBadgeText = '#1565C0';
const CodBadgeBg = '#FFF3E0';
const CodBadgeText = '#EF6C00';
const StarColor = '#FFC107';
const PlaceholderStarColor = '#E0E0E0';
const StrikethroughColor = '#999';
const DiscountedPriceColor = '#E53935'; // Distinct red for discounted prices
const ModalSelectedBg = '#FFF0F0'; // Light red background for selections (provides contrast)
const ModalProceedDisabledBg = '#FFCDD2'; // Disabled button background (light red tone)
const PopupBgColor = '#333333';
const PopupTextColor = '#FFFFFF';

// *** Bright Red for Buttons and Selections ***
const BrightRedButtonColor = '#FF0000';
const BrightRedGradientEndColor = '#E60000'; // Slightly darker red for gradient end

// Assume placeholder images exist at these paths
const placeholderImage = require('../../assets/p3.jpg'); // MAKE SURE THIS PATH IS CORRECT
// *** UPDATED: Define dummyProfilePic for review rendering fallback ***
const dummyProfilePic = 'https://www.w3schools.com/w3images/avatar2.png'; // CREATE OR REPLACE WITH YOUR DUMMY AVATAR
const defaultProfileImage = 'https://www.w3schools.com/w3images/avatar2.png'; // Keep this for potential direct use if needed
const { width: screenWidth } = Dimensions.get('window');
const GALLERY_HEIGHT = screenWidth * 0.9;
const MAX_INITIAL_REVIEWS = 2; // Show max 2 reviews initially
const RELATED_PRODUCTS_LIMIT = 6;
const CURRENCY_SYMBOL = 'RS'; // Or your desired currency symbol
const GRID_PADDING_HORIZONTAL = 15;
const CARD_MARGIN_HORIZONTAL = 4;
const NUM_COLUMNS = 2;
const totalPadding = GRID_PADDING_HORIZONTAL * 2;
const spaceBetweenColumns = CARD_MARGIN_HORIZONTAL * 2 * (NUM_COLUMNS - 1);
const availableWidth = screenWidth - totalPadding;
const relatedCardWidth = (availableWidth - spaceBetweenColumns) / NUM_COLUMNS;


export default function ProductDetailsScreen() {
    const route = useRoute();
    const navigation = useNavigation();

    // --- State Variables ---
    const [product, setProduct] = useState(null);
    const [isLoadingProduct, setIsLoadingProduct] = useState(true);
    const [isLoadingPlans, setIsLoadingPlans] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
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

    // *** State for Reviews (includes user info now) ***
    const [reviews, setReviews] = useState([]); // Holds fetched reviews with user details
    const [isLoadingReviews, setIsLoadingReviews] = useState(false); // Loading status for reviews
    const [reviewsError, setReviewsError] = useState(null); // Error state for reviews

    // *** State for Wishlist ***
    const [isWishlisted, setIsWishlisted] = useState(false); // Reflects Firestore state
    const [isProcessingWishlist, setIsProcessingWishlist] = useState(false); // Loading state for wishlist action
    const [wishlistDocId, setWishlistDocId] = useState(null); // Stores Firestore doc ID for deletion
    const [checkingWishlist, setCheckingWishlist] = useState(true); // State for initial wishlist check
    // --- End State Variables ---

    // --- Refs ---
    const flatListRef = useRef(null);
    const videoRefs = useRef({});
    const popupTimeoutRef = useRef(null);
    // --- End Refs ---

    // --- Effects ---
    // Effect 1: Load Product Details & BNPL Plans
    useEffect(() => {
        const initialProductFromRoute = route.params?.product ?? null;
        const productIdFromRoute = route.params?.productId ?? null;

        const loadProductAndPlans = async (productData) => {
             if (!productData || !productData.id) {
                console.warn("loadProductAndPlans called with invalid data", productData);
                setIsLoadingProduct(false); setProduct(null); return;
            }
            // --- Product Data Normalization ---
            const baseProduct = {
                 id: productData.id, // Ensure ID is always present
                 bnplAvailable: productData.paymentOption?.BNPL === true,
                 codAvailable: productData.paymentOption?.COD === true,
                 originalPrice: typeof productData.originalPrice === 'number' ? productData.originalPrice : null,
                 discountedPrice: typeof productData.discountedPrice === 'number' ? productData.discountedPrice : null,
                 // Handle both potential BNPL ID array names, filtering invalid entries
                 BNPLPlanIDs: Array.isArray(productData.BNPLPlanIDs)
                     ? productData.BNPLPlanIDs.filter(id => typeof id === 'string' && id.trim() !== '')
                     : (Array.isArray(productData.BNPLPlans) ? productData.BNPLPlans.filter(id => typeof id === 'string' && id.trim() !== '') : []),
                 // Use pre-fetched plan objects if available and valid, otherwise empty array
                 BNPLPlans: Array.isArray(productData.BNPLPlans) && productData.BNPLPlans.length > 0 && typeof productData.BNPLPlans[0] === 'object' && productData.BNPLPlans[0] !== null
                     ? productData.BNPLPlans
                     : [],
                 name: productData.name || 'Unnamed Product',
                 description: productData.description || '',
                 media: productData.media || {},
                 // Determine primary image: check media.images first, then top-level image
                 image: productData.media?.images?.[0] || productData.image || null,
                 category: productData.category || 'Uncategorized',
                 rating: typeof productData.rating === 'number' ? productData.rating : null, // Pre-calculated rating fallback
                 soldCount: typeof productData.soldCount === 'number' ? productData.soldCount : 0,
                 // Add any other relevant fields here...
             };
             // --- End Normalization ---

             const needsPlanFetch = baseProduct.bnplAvailable && baseProduct.BNPLPlanIDs.length > 0 && baseProduct.BNPLPlans.length === 0;
             console.log(`Product ${baseProduct.id}: Initializing. Needs Plan Fetch: ${needsPlanFetch}`);

             setProduct(baseProduct); // Set the normalized product
             setIsLoadingProduct(false); // Product base data is loaded

             // --- Fetch BNPL Plans if needed ---
             if (needsPlanFetch) {
                 console.log(`Product ${baseProduct.id}: Fetching ${baseProduct.BNPLPlanIDs.length} plans...`);
                 setIsLoadingPlans(true);
                 try {
                     const planPromises = baseProduct.BNPLPlanIDs.map(planId => {
                         if (!planId || typeof planId !== 'string') return Promise.resolve(null); // Skip invalid IDs
                         const planRef = doc(db, 'BNPL_plans', planId.trim());
                         return getDoc(planRef);
                     });
                     const planSnapshots = await Promise.all(planPromises);
                     const detailedPlans = planSnapshots
                         .map(snap => snap?.exists() ? { id: snap.id, ...snap.data() } : null)
                         .filter(plan => plan !== null); // Filter out non-existent plans
                     console.log(`Product ${baseProduct.id}: Fetched ${detailedPlans.length} detailed plans.`);
                     // Update state safely, ensuring it's still the same product being viewed
                     setProduct(prev => prev?.id === baseProduct.id ? { ...prev, BNPLPlans: detailedPlans } : prev);
                 } catch (planError) {
                     console.error(`Error fetching BNPL plans for product ${baseProduct.id}:`, planError);
                     // Set plans to empty array on error, but keep the rest of the product data
                     setProduct(prev => prev?.id === baseProduct.id ? { ...prev, BNPLPlans: [] } : prev);
                 } finally {
                     setIsLoadingPlans(false);
                 }
             } else {
                 setIsLoadingPlans(false); // No fetch needed or plans already present
             }
        };

        // --- Reset State on Navigation/Param Change ---
        console.log("ProductDetailsScreen effect running due to route change.");
        setProduct(null); setIsLoadingProduct(true); setIsLoadingPlans(false);
        setRelatedProducts([]); setLoadingRelatedProducts(true); setSelectedBnplPlan(null);
        setSelectedPaymentMethod(null); setActiveIndex(0); setActionType(null);
        setIsProcessingCart(false); setShowAddedToCartPopup(false);
        setReviews([]); setIsLoadingReviews(false); setReviewsError(null); setShowAllReviews(false);
        // Reset Wishlist State
        setIsWishlisted(false); setWishlistDocId(null); setIsProcessingWishlist(false); setCheckingWishlist(true);


        // --- Determine How to Load Product ---
        if (initialProductFromRoute && initialProductFromRoute.id) {
             console.log("Loading product from route params:", initialProductFromRoute.id);
             loadProductAndPlans(initialProductFromRoute);
        } else if (productIdFromRoute) {
             console.log("Loading product by ID:", productIdFromRoute);
             const fetchProductById = async () => {
                try {
                    const productRef = doc(db, 'Products', productIdFromRoute);
                    const docSnap = await getDoc(productRef);
                    if (docSnap.exists()) {
                        await loadProductAndPlans({ id: docSnap.id, ...docSnap.data() });
                    } else {
                        console.error(`Product with ID ${productIdFromRoute} not found.`);
                        setProduct(null); setIsLoadingProduct(false);
                        Alert.alert("Error", "Product not found.");
                    }
                } catch (error) {
                    console.error("Error fetching product by ID:", error);
                    setProduct(null); setIsLoadingProduct(false);
                    Alert.alert("Error", "Failed to load product details.");
                }
             };
             fetchProductById();
        } else {
            console.error("No product data or ID provided in route params.");
            setIsLoadingProduct(false); setProduct(null);
            Alert.alert("Error", "Could not load product information.");
        }

        // Cleanup popup timeout if component unmounts or effect re-runs
        return () => {
            if (popupTimeoutRef.current) {
                clearTimeout(popupTimeoutRef.current);
            }
        };
    }, [route.params?.product, route.params?.productId]); // Re-run if product object or ID changes


    // Effect 2: Fetch Reviews and User Data when Product ID is available
    useEffect(() => {
        // Only fetch if product is loaded and has an ID
        if (!isLoadingProduct && product && product.id) {
            const fetchReviewsAndUsers = async (productIdToFetch) => {
                console.log(`Fetching reviews for productId: ${productIdToFetch}`);
                setIsLoadingReviews(true);
                setReviewsError(null);
                setReviews([]); // Clear previous reviews

                try {
                    // 1. Fetch Reviews for the specific product, ordered by timestamp
                    const reviewsQuery = query(
                        collection(db, 'Reviews'),
                        where('productId', '==', productIdToFetch),
                        orderBy('timestamp', 'desc')
                    );
                    const reviewsSnapshot = await getDocs(reviewsQuery);
                    const reviewDocsData = reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    if (reviewDocsData.length === 0) {
                         console.log(`No reviews found for product ${productIdToFetch}.`);
                         setIsLoadingReviews(false);
                         return; // Exit early if no reviews
                    }

                    // 2. Extract Unique User IDs from reviews, filtering invalid ones
                    const userIds = [
                        ...new Set( // Use Set for automatic uniqueness
                            reviewDocsData
                                .map(data => data.userId)
                                .filter(id => typeof id === 'string' && id.trim() !== '') // Ensure valid string IDs
                        )
                    ];

                    // 3. Fetch User Data (if any valid user IDs were found)
                    const userDataMap = {}; // To store fetched user data { userId: { name, profileImage } }
                    if (userIds.length > 0) {
                        console.log(`Fetching user data for ${userIds.length} unique reviewers.`);
                        // Firestore 'in' query limitation: Can handle up to 30 IDs per query.
                        // If expecting more, chunk the userIds array into groups of 30.
                        // Simple approach for <= 30 reviewers:
                         try {
                            // Query the Users collection where the document ID is in our list of userIds
                            const usersQuery = query(collection(db, 'Users'), where(documentId(), 'in', userIds));
                            const usersSnapshot = await getDocs(usersQuery);

                            usersSnapshot.forEach(userDoc => {
                                const userData = userDoc.data();
                                userDataMap[userDoc.id] = {
                                    name: userData?.name || 'Anonymous User', // Provide a fallback name
                                    profileImage: userData?.profileImage || null // Store URL or null
                                };
                            });
                            console.log(`Successfully fetched data for ${usersSnapshot.size} users.`);
                         } catch (userFetchError) {
                            console.error("Error fetching user data for reviews:", userFetchError);
                            // Proceed without user data; reviews will show defaults.
                         }
                    }

                    // 4. Combine Review and User Data, formatting timestamp
                    const combinedReviews = reviewDocsData.map((data) => {
                         // Basic validation for essential review fields
                         if (!data.rating || !data.reviewText || !data.timestamp || !data.userId) {
                             console.warn("Skipping review due to missing essential data:", data.id);
                             return null; // Skip this review if critical data is missing
                         }

                         // Format timestamp safely
                         let formattedDate = 'Date unavailable';
                         try {
                             if (data.timestamp instanceof Timestamp) {
                                 formattedDate = data.timestamp.toDate().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
                             } else if (data.timestamp) { // Attempt to parse if not a Timestamp object
                                 const dateObj = new Date(data.timestamp);
                                 if (!isNaN(dateObj)) { // Check if the date is valid
                                     formattedDate = dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
                                 }
                             }
                         } catch (e) {
                             console.error("Error formatting timestamp for review:", data.id, e);
                         }

                         // Get user details from the map or use defaults
                         const userDetails = userDataMap[data.userId] || { name: 'Anonymous User', profileImage: null };

                         return {
                             id: data.id,
                             rating: data.rating,
                             comment: data.reviewText,
                             date: formattedDate,
                             name: userDetails.name, // Use fetched name
                             profileImage: userDetails.profileImage, // Use fetched image URL (or null)
                             userId: data.userId // Keep userId if needed later
                         };
                     }).filter(review => review !== null); // Filter out any reviews that were skipped (returned null)

                    setReviews(combinedReviews);
                    console.log(`Processed ${combinedReviews.length} valid reviews with user data.`);

                } catch (error) {
                    console.error(`Error fetching reviews for product ${productIdToFetch}:`, error);
                    setReviewsError("Could not load reviews at this time.");
                    setReviews([]); // Clear reviews on error
                } finally {
                    setIsLoadingReviews(false);
                }
            };
            // Call the fetch function with the current product's ID
            fetchReviewsAndUsers(product.id);
        } else {
             // Reset reviews if product is loading or not available
             setReviews([]);
             setIsLoadingReviews(false);
             setReviewsError(null);
        }
    }, [product?.id, isLoadingProduct]); // Re-run if product ID changes or loading status changes


    // Effect 3: Fetch Related Products
    useEffect(() => {
        // Guard: Only run if product is loaded, has ID and category
        if (isLoadingProduct || !product || !product.id || !product.category) {
            if (!isLoadingProduct && !product) {
                setLoadingRelatedProducts(false); // Stop loading if product failed to load
            }
            return;
        }

        const fetchRelated = async () => {
            console.log(`Fetching related products for category: ${product.category}, excluding current product: ${product.id}`);
            setLoadingRelatedProducts(true);
            setRelatedProducts([]); // Clear previous related products

            try {
                const q = query(
                    collection(db, 'Products'),
                    where('category', '==', product.category), // Match category
                    where(documentId(), '!=', product.id), // Exclude current product
                    orderBy(documentId()), // Need an orderBy for the inequality filter
                    limit(RELATED_PRODUCTS_LIMIT) // Limit results
                );

                const querySnapshot = await getDocs(q);
                let fetched = querySnapshot.docs.map(docSnapshot => {
                    const d = docSnapshot.data();
                    // Normalize related product data for consistency
                    return {
                        id: docSnapshot.id,
                        name: d.name || 'Unnamed Product',
                        description: d.description || '',
                        category: d.category || 'Uncategorized',
                        originalPrice: typeof d.originalPrice === 'number' ? d.originalPrice : null,
                        discountedPrice: typeof d.discountedPrice === 'number' ? d.discountedPrice : null,
                        image: d.media?.images?.[0] || d.image || null, // Prioritize media images
                        media: d.media, // Include media object if needed later
                        paymentOption: d.paymentOption, // Include payment options
                        // Extract BNPL IDs carefully, avoid fetching full plans here for performance
                        BNPLPlanIDs: Array.isArray(d.BNPLPlans) ? d.BNPLPlans.filter(id => typeof id === 'string' && id.trim() !== '') : [],
                        BNPLPlans: [], // Keep this empty for related cards
                        rating: typeof d.rating === 'number' ? d.rating : null,
                        soldCount: typeof d.soldCount === 'number' ? d.soldCount : 0,
                        bnplAvailable: d.paymentOption?.BNPL === true, // Pre-calculate flags
                        codAvailable: d.paymentOption?.COD === true,
                        // Add other fields needed for the related card display
                    };
                });

                 // Optional: Add a placeholder if the number of items is odd to fill the grid row
                 if (fetched.length > 0 && fetched.length < RELATED_PRODUCTS_LIMIT && fetched.length % NUM_COLUMNS !== 0) {
                    // Add placeholders to make the grid look even
                    const placeholdersToAdd = NUM_COLUMNS - (fetched.length % NUM_COLUMNS);
                    for (let i = 0; i < placeholdersToAdd; i++) {
                         fetched.push({ id: `placeholder-${Date.now()}-${i}`, isPlaceholder: true });
                    }
                 }

                setRelatedProducts(fetched);
                console.log(`Fetched ${querySnapshot.docs.length} related products.`);
            } catch (error) {
                console.error("Error fetching related products: ", error);
                setRelatedProducts([]); // Clear on error
            } finally {
                setLoadingRelatedProducts(false);
            }
        };

        fetchRelated();
    }, [product?.id, product?.category, isLoadingProduct]); // Re-run if product ID or category changes, or loading state finishes


    // *** Effect 4: Check Initial Wishlist Status ***
    useEffect(() => {
        // Reset wishlist status when product potentially changes (handled in Effect 1 now)
        // setIsWishlisted(false);
        // setWishlistDocId(null);
        // setIsProcessingWishlist(false);
        // setCheckingWishlist(true); // Start check when product is available

        const auth = getAuth();
        const user = auth.currentUser;
        const currentProductId = product?.id; // Get product ID safely after product state is set

        // Only proceed if we have a user, a product ID, and the product isn't loading anymore
        if (user && currentProductId && !isLoadingProduct) {
            setCheckingWishlist(true); // Indicate check is starting
            console.log(`Checking wishlist status for product ${currentProductId} and user ${user.uid}`);

            const wishlistQuery = query(
                collection(db, 'Users', user.uid, 'wishlist'),
                where('productId', '==', currentProductId),
                limit(1) // We only need to know if *at least one* exists
            );

            getDocs(wishlistQuery)
                .then((querySnapshot) => {
                    if (!querySnapshot.empty) {
                        const doc = querySnapshot.docs[0];
                        console.log(`Product ${currentProductId} FOUND in wishlist (Doc ID: ${doc.id}).`);
                        setIsWishlisted(true);
                        setWishlistDocId(doc.id); // Store the Firestore document ID for potential deletion
                    } else {
                        console.log(`Product ${currentProductId} NOT found in wishlist.`);
                        setIsWishlisted(false);
                        setWishlistDocId(null);
                    }
                })
                .catch((error) => {
                    console.error("Error checking wishlist status:", error);
                    // Keep state as false in case of error, maybe show a toast later
                    setIsWishlisted(false);
                    setWishlistDocId(null);
                })
                .finally(() => {
                    setCheckingWishlist(false); // Mark checking as complete
                });
        } else {
            // If no user, no product ID, or product still loading, don't check yet or reset
            if (!isLoadingProduct) { // Only stop checking if product loading is finished
                 console.log("Wishlist check skipped: No user or product ID available after product load.");
                 setIsWishlisted(false); // Ensure reset if user logs out or product is invalid
                 setWishlistDocId(null);
                 setCheckingWishlist(false); // Mark checking as complete (or not needed)
            } else {
                 console.log("Wishlist check deferred: Product still loading.");
                 // Keep checkingWishlist true until product loads
            }
        }

    }, [product?.id, isLoadingProduct]); // Re-run if the product ID changes or product loading finishes
    // --- End Effects ---


    // --- Memos ---
    // Memoize gallery items
    const galleryItems = useMemo(() => {
         if (!product || (!product.media && !product.image)) {
             return [{ type: 'image', url: null, id: 'placeholder-img', isPlaceholder: true }];
         }
         const items = [];
         const seenUrls = new Set(); // Prevent duplicates if URL appears in multiple places

         const addItem = (item) => {
             if (item.url && typeof item.url === 'string' && !seenUrls.has(item.url)) {
                 items.push(item);
                 seenUrls.add(item.url);
             } else if (item.isPlaceholder) {
                 items.push(item); // Allow placeholder if needed
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

         // Add fallback top-level image if it wasn't already in media.images
         if (product.image) {
             const fallbackAlreadyAdded = items.some(item => item.type === 'image' && item.url === product.image);
             if (!fallbackAlreadyAdded) {
                 // Prioritize putting the fallback image first if no other images exist
                 if (items.filter(i => i.type === 'image').length === 0) {
                     items.unshift({ type: 'image', url: product.image, id: `img-fallback-${product.image}` });
                     seenUrls.add(product.image);
                 } else {
                     addItem({ type: 'image', url: product.image, id: `img-fallback-${product.image}` });
                 }
             }
         }

         // Ensure there's at least one item (placeholder if all else fails)
         if (items.length === 0) {
             items.push({ type: 'image', url: null, id: 'placeholder-img', isPlaceholder: true });
         }

         return items;
    }, [product?.media, product?.image]); // Depends on media object and fallback image

    // Memoize price values for calculations and display
    const originalPriceValue = useMemo(() => product?.originalPrice, [product?.originalPrice]);
    const discountedPriceValue = useMemo(() => product?.discountedPrice, [product?.discountedPrice]);
    const hasDiscount = useMemo(() =>
        typeof originalPriceValue === 'number' &&
        typeof discountedPriceValue === 'number' &&
        discountedPriceValue < originalPriceValue,
        [originalPriceValue, discountedPriceValue]
    );

    // Memoize formatted display prices
    const mainDisplayOriginalPrice = useMemo(() =>
        typeof originalPriceValue === 'number' ? `${CURRENCY_SYMBOL} ${originalPriceValue.toFixed(0)}` : null,
        [originalPriceValue]
    );
    const mainDisplayDiscountedPrice = useMemo(() =>
        typeof discountedPriceValue === 'number' ? `${CURRENCY_SYMBOL} ${discountedPriceValue.toFixed(0)}` : null,
        [discountedPriceValue]
    );
    const mainFinalDisplayPrice = useMemo(() =>
        mainDisplayDiscountedPrice || mainDisplayOriginalPrice,
        [mainDisplayDiscountedPrice, mainDisplayOriginalPrice]
    );

    // Base price for BNPL calculations and adding to cart (use discounted if available, else original)
    const basePriceForCalculations = useMemo(() =>
        (hasDiscount && typeof discountedPriceValue === 'number')
            ? discountedPriceValue
            : (typeof originalPriceValue === 'number')
                ? originalPriceValue
                : null, // Return null if no valid price exists
        [hasDiscount, discountedPriceValue, originalPriceValue]
    );

    // Memoize average rating from fetched reviews (fallback to product.rating)
    const averageRating = useMemo(() => {
        if (reviews && reviews.length > 0) {
            const validReviews = reviews.filter(review => typeof review.rating === 'number');
            if (validReviews.length === 0) return product?.rating ?? null; // Fallback if no valid ratings in fetched reviews
            const sum = validReviews.reduce((acc, review) => acc + review.rating, 0);
            const avg = sum / validReviews.length;
            return isNaN(avg) ? (product?.rating ?? null) : avg; // Final check and fallback
        }
        // If reviews haven't loaded or are empty, use the pre-calculated product rating if available
        if (typeof product?.rating === 'number') return product.rating;
        return null; // No rating available
    }, [reviews, product?.rating]); // Depends on fetched reviews and product data fallback

    // Memoize sold count and its display format
    const soldCount = useMemo(() => product?.soldCount ?? 0, [product?.soldCount]);
    const displaySoldCount = useMemo(() =>
        soldCount > 999 ? `${(soldCount / 1000).toFixed(1)}k` : soldCount.toString(),
        [soldCount]
    );

    // Memoized reviews from state (already includes user info)
    const allReviews = useMemo(() => reviews, [reviews]);
    const displayReviews = useMemo(() =>
        showAllReviews ? allReviews : allReviews.slice(0, MAX_INITIAL_REVIEWS),
        [showAllReviews, allReviews]
    );

    // Memoize whether BNPL option has loaded and has plans
    const hasLoadedBnplOption = useMemo(() =>
        product?.bnplAvailable === true &&
        !isLoadingPlans && // Ensure plans are not still loading
        Array.isArray(product.BNPLPlans) &&
        product.BNPLPlans.length > 0, // Check if the array has plans
        [product?.bnplAvailable, product?.BNPLPlans, isLoadingPlans]
    );

    // Memoize grouped BNPL plans for rendering
    const bnplPlanGroups = useMemo(() => {
        if (!hasLoadedBnplOption || !product?.BNPLPlans) return {}; // Return empty if no plans or not loaded

        return product.BNPLPlans.reduce((acc, plan) => {
            if (!plan || typeof plan !== 'object') return acc; // Skip invalid plan data

            // Group by planType
            const type = ['Installment', 'BNPL', 'PayLater'].includes(plan.planType) ? 'BNPL Plans' // Common BNPL types
                         : plan.planType === 'Fixed Duration' ? 'Fixed Duration Plans' // Specific fixed type
                         : 'Other Plans'; // Fallback group

            if (!acc[type]) acc[type] = []; // Initialize group if it doesn't exist
            acc[type].push(plan);
            return acc;
        }, {});
    }, [hasLoadedBnplOption, product?.BNPLPlans]); // Depends on loaded status and plans array
    // --- End Memos ---


    // --- Handlers ---
    // *** UPDATED: Wishlist Toggle Handler ***
    const handleWishlistToggle = async () => {
        // Prevent action if already processing, still checking initial status, or product isn't loaded
        if (isProcessingWishlist || checkingWishlist || !product?.id) {
            console.log("Wishlist toggle skipped: Processing, checking, or no product ID.");
            return;
        }

        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
            Alert.alert("Login Required", "Please log in to manage your wishlist.");
            return;
        }

        setIsProcessingWishlist(true); // Start processing
        const userId = user.uid;
        const currentProductId = product.id;
        // Reference to the user's specific wishlist subcollection
        const wishlistCollectionRef = collection(db, 'Users', userId, 'wishlist');

        // Determine primary image safely for wishlist item
        const primaryImage = galleryItems.find(item => item.type === 'image' && !item.isPlaceholder)?.url
                             || product.image // Use gallery image first
                             || null;         // Fallback to product.image, then null

        if (isWishlisted && wishlistDocId) {
            // --- REMOVE from Wishlist ---
            console.log(`Attempting to remove product ${currentProductId} (Doc ID: ${wishlistDocId}) from wishlist...`);
            // Create a direct reference to the document to be deleted
            const wishlistItemRef = doc(wishlistCollectionRef, wishlistDocId);
            try {
                await deleteDoc(wishlistItemRef);
                console.log("Product removed from wishlist successfully.");
                setIsWishlisted(false); // Update local state
                setWishlistDocId(null); // Clear the stored ID
            } catch (error) {
                console.error("Error removing product from wishlist:", error);
                Alert.alert("Error", "Could not remove item from wishlist. Please try again.");
                // Revert state potentially? Or just leave button enabled for retry.
            } finally {
                setIsProcessingWishlist(false); // Finish processing
            }
        } else if (!isWishlisted) {
            // --- ADD to Wishlist ---
             console.log(`Attempting to add product ${currentProductId} to wishlist...`);
             // Create a reference for a *new* document within the subcollection
             // Firestore will auto-generate a unique ID for this new document
             const newWishlistItemRef = doc(wishlistCollectionRef);

             // Prepare the data for the new wishlist item
             const wishlistItemData = {
                productId: currentProductId,
                name: product.name || 'Unnamed Product',
                image: primaryImage, // Use the determined primary image URL
                // Use memoized price values, fallback to null if not available
                originalPrice: originalPriceValue ?? null,
                discountedPrice: discountedPriceValue ?? null,
                finalDisplayPrice: mainFinalDisplayPrice ?? null, // Store the formatted display string for convenience
                // Optional: Store a snippet of the description
                descriptionSnippet: product.description
                    ? product.description.substring(0, 100) + (product.description.length > 100 ? '...' : '')
                    : null,
                bnplAvailable: product.bnplAvailable ?? false,
                codAvailable: product.codAvailable ?? false,
                addedAt: serverTimestamp(), // Use server timestamp for ordering/tracking
                category: product.category || 'Uncategorized', // Store category for potential filtering
             };

             try {
                // Use setDoc to create the new document with the prepared data
                await setDoc(newWishlistItemRef, wishlistItemData);
                console.log("Product added to wishlist successfully. New Doc ID:", newWishlistItemRef.id);
                setIsWishlisted(true); // Update local state
                setWishlistDocId(newWishlistItemRef.id); // Store the ID of the newly created document
             } catch (error) {
                 console.error("Error adding product to wishlist:", error);
                 Alert.alert("Error", "Could not add item to wishlist. Please try again.");
             } finally {
                 setIsProcessingWishlist(false); // Finish processing
             }
        } else {
            // This case should ideally not be reached if logic is correct, but acts as a safeguard
             console.warn("Wishlist toggle attempted in an inconsistent state (isWishlisted=true but no wishlistDocId).");
             // Attempt to re-query to fix state? For now, just stop processing.
             setIsProcessingWishlist(false);
        }
    };


    const shareProduct = async () => {
        if (!product || !product.name) return;
        try {
            let message = `Check out this product: ${product.name}`;
            if (mainFinalDisplayPrice) {
                message += ` - ${mainFinalDisplayPrice}`;
            }
            // Placeholder for a deep link or web URL if you have one
            const productUrl = `yourapp://product/${product.id}`; // Example deep link
            // Or const productUrl = `https://yourwebsite.com/product/${product.id}`; // Example web link

            await Share.share({
                message: message,
                ...(Platform.OS === 'ios' && productUrl && { url: productUrl }), // URL for iOS
                ...(Platform.OS === 'android' && { title: product.name }) // Title for Android (message is main content)
                // Android might implicitly use the URL within the message depending on the target app
            });
        } catch (error) {
            console.error('Error sharing product:', error.message);
            if (error.code !== 'USER_CANCELLED') { // Don't alert if user just cancelled
                 Alert.alert('Share Error', 'Could not share product at this time.');
            }
        }
    };

    // Handler for FlatList viewability changes (gallery pagination)
    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        if (viewableItems && viewableItems.length > 0 && viewableItems[0].index != null) {
            setActiveIndex(viewableItems[0].index);
            // Optional: Pause videos that are not visible
            // galleryItems.forEach((item, index) => {
            //     if (item.type === 'video' && videoRefs.current[item.id]) {
            //         if (index !== viewableItems[0].index) {
            //             videoRefs.current[item.id].pauseAsync();
            //         } else {
            //             // Optionally auto-play visible video:
            //             // videoRefs.current[item.id].playAsync();
            //         }
            //     }
            // });
        }
    }).current;

    // Configuration for viewability tracking
    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50 // Item is considered visible when 50% is in view
    }).current;

    // Handler for selecting/deselecting BNPL plan from main screen or modal
    const handlePlanSelection = (plan) => {
         if (!plan || !plan.id) return;

         // If the clicked plan is already selected, deselect it
         if (selectedBnplPlan?.id === plan.id) {
             setSelectedBnplPlan(null);
             // If BNPL was the selected method, clear method too
             if (selectedPaymentMethod === 'BNPL') {
                 setSelectedPaymentMethod(null);
             }
         }
         // Otherwise, select the new plan and set payment method to BNPL
         else {
             setSelectedBnplPlan(plan);
             setSelectedPaymentMethod('BNPL');
         }
    };

    // Opens the payment modal
    const openPaymentModal = (type) => { // type: 'addToCart' or 'buyNow'
         if (!product || !product.id || isProcessingCart || isProcessingWishlist) return; // Don't open if busy

         // If a BNPL plan was already selected on the main page, keep it selected in the modal
         if (selectedBnplPlan) {
             setSelectedPaymentMethod('BNPL');
         } else {
             setSelectedPaymentMethod(null); // Start fresh if no plan was pre-selected
         }

         setActionType(type); // Store whether modal was opened for 'addToCart' or 'buyNow'
         setIsPaymentModalVisible(true);
    };

    // Function to update the cart in Firestore
    const updateFirestoreCart = async (cartItemDetails) => {
        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
            Alert.alert("Login Required", "Please log in to add items to your cart.");
            return false; // Indicate failure
        }

        // Validate essential cart item details
        if (!cartItemDetails?.productId || typeof cartItemDetails?.priceAtAddition !== 'number') {
            Alert.alert("Error", "Cannot add item: Invalid product or price data.");
            return false;
        }
        if (cartItemDetails.paymentMethod === 'BNPL' && !cartItemDetails.bnplPlan?.id) {
            Alert.alert("Error", "Cannot add item: BNPL plan details are missing.");
            return false;
        }

        const cartDocRef = doc(db, "Carts", user.uid); // Reference to the user's cart document
        console.log(`Updating cart for user: ${user.uid}, Product: ${cartItemDetails.productId}, Method: ${cartItemDetails.paymentMethod}`);

        try {
            const cartSnap = await getDoc(cartDocRef);

            if (cartSnap.exists()) {
                // --- Cart Exists: Update items array ---
                const cartData = cartSnap.data();
                const items = cartData.items || []; // Get existing items or empty array
                let updatedItems = [...items]; // Create a mutable copy
                let itemFoundAndUpdated = false;

                // Find index of the item based on productId and payment method/plan
                let existingIndex = -1;
                if (cartItemDetails.paymentMethod === 'COD') {
                    existingIndex = items.findIndex(item =>
                        item.productId === cartItemDetails.productId && item.paymentMethod === 'COD'
                    );
                } else if (cartItemDetails.paymentMethod === 'BNPL') {
                    const planIdToAdd = cartItemDetails.bnplPlan.id;
                    existingIndex = items.findIndex(item =>
                        item.productId === cartItemDetails.productId &&
                        item.paymentMethod === 'BNPL' &&
                        item.bnplPlan?.id === planIdToAdd // Match specific plan
                    );
                    // Check for conflict: If adding BNPL, ensure same product isn't already with another BNPL plan
                    if (existingIndex === -1) { // Only check conflict if not updating quantity for the *same* plan
                         const conflictExists = items.some(item =>
                            item.productId === cartItemDetails.productId &&
                            item.paymentMethod === 'BNPL' &&
                            item.bnplPlan?.id !== planIdToAdd // Different BNPL plan exists
                         );
                         if (conflictExists) {
                             Alert.alert(
                                 "Plan Conflict",
                                 `${cartItemDetails.productName || 'This product'} is already in your cart with a different BNPL plan. Please remove the existing item or choose a different payment method.`
                             );
                             return false; // Prevent adding conflicting item
                         }
                    }
                }

                // If item exists, update its quantity
                if (existingIndex > -1) {
                    const currentQuantity = updatedItems[existingIndex].quantity || 0;
                    updatedItems[existingIndex] = {
                        ...updatedItems[existingIndex],
                        quantity: currentQuantity + 1,
                        // Optionally update price if it changed, though priceAtAddition usually remains fixed
                        // priceAtAddition: cartItemDetails.priceAtAddition
                    };
                    itemFoundAndUpdated = true;
                    console.log(`Item quantity updated (Index: ${existingIndex}, New Qty: ${currentQuantity + 1}).`);
                }

                // Perform the update
                if (itemFoundAndUpdated) {
                    // Update the specific item in the array
                    await updateDoc(cartDocRef, {
                        items: updatedItems,
                        lastUpdated: serverTimestamp()
                    });
                } else {
                    // Add the new item using arrayUnion
                    await updateDoc(cartDocRef, {
                        items: arrayUnion({ ...cartItemDetails, quantity: 1, addedAt: serverTimestamp() }), // Add quantity and timestamp
                        lastUpdated: serverTimestamp()
                    });
                    console.log("New item added to existing cart.");
                }
                return true; // Indicate success

            } else {
                // --- Cart Doesn't Exist: Create it ---
                const initialCartItem = {
                    ...cartItemDetails,
                    quantity: 1, // Start with quantity 1
                    addedAt: serverTimestamp() // Timestamp when first added
                };
                await setDoc(cartDocRef, {
                    userId: user.uid,
                    items: [initialCartItem], // Create items array with the first item
                    createdAt: serverTimestamp(),
                    lastUpdated: serverTimestamp()
                });
                console.log("New cart created and item added.");
                return true; // Indicate success
            }
        } catch (error) {
            console.error("Error updating/creating Firestore cart:", error);
            Alert.alert("Error", "Could not update your cart. Please try again.");
            return false; // Indicate failure
        }
    };

    // Triggers the "Added to Cart" popup animation
    const triggerAddedToCartPopup = () => {
        if (popupTimeoutRef.current) { // Clear any existing timeout
            clearTimeout(popupTimeoutRef.current);
        }
        popupOpacity.setValue(0); // Reset opacity
        setShowAddedToCartPopup(true); // Make popup visible

        // Fade in animation
        Animated.timing(popupOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();

        // Set timeout to fade out and hide
        popupTimeoutRef.current = setTimeout(() => {
            Animated.timing(popupOpacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start(() => {
                setShowAddedToCartPopup(false); // Hide after fade out
                popupTimeoutRef.current = null; // Clear ref
            });
        }, 2000); // Popup duration: 2 seconds
    };

    // Handles adding to cart directly if only COD is available
    const proceedDirectlyWithCOD_AddToCart = async () => {
         if (isProcessingCart || !product?.id) return;

         setActionType('addToCart'); // Set action type for potential loading indicator context
         setIsProcessingCart(true);

         const priceForCart = basePriceForCalculations; // Use memoized base price
         if (priceForCart === null) {
             Alert.alert("Error", "Price information is missing for this product.");
             setIsProcessingCart(false); setActionType(null); return;
         }

         // Prepare cart item details for COD
         const cartItem = {
             productId: product.id,
             productName: product.name || 'Unnamed Product',
             // Get primary image URL for the cart
             image: galleryItems.find(item => item.type === 'image' && !item.isPlaceholder)?.url || placeholderImage,
             paymentMethod: 'COD',
             priceAtAddition: Number(priceForCart.toFixed(2)), // Store price at time of adding
             bnplPlan: null // No BNPL plan for COD
         };

         let success = false;
         try {
             success = await updateFirestoreCart(cartItem);
         } catch (e) {
             console.error("Error during direct COD AddToCart operation:", e);
             success = false; // Ensure success is false on error
         } finally {
             setIsProcessingCart(false); // Stop processing regardless of outcome
             setActionType(null);
         }

         if (success) {
             triggerAddedToCartPopup(); // Show success popup
         }
         // No specific error alert here, as updateFirestoreCart handles its own alerts
    };


    // Main "Add to Cart" button handler
    const handleAddToCart = () => {
        if (isProcessingCart || isProcessingWishlist || !product?.id) return; // Prevent action if busy or no product

        const canCOD = product.codAvailable === true;
        const canBNPL = hasLoadedBnplOption; // Use memoized value

        // Case 1: No payment options available at all
        if (!canCOD && !canBNPL) {
            Alert.alert("Payment Unavailable", "Sorry, no payment options are currently available for this product.");
            return;
        }

        // Case 2: Only COD is available
        if (canCOD && !canBNPL) {
            proceedDirectlyWithCOD_AddToCart(); // Add directly using COD
        }
        // Case 3: BNPL is available (either alone or with COD)
        else {
            openPaymentModal('addToCart'); // Open modal to choose/confirm payment
        }
    };


    // Main "Buy Now" button handler
    const handleBuyNow = () => {
        if (isProcessingCart || isProcessingWishlist || !product?.id) return; // Prevent action if busy or no product

        setActionType('buyNow'); // Set action type

        const canCOD = product.codAvailable === true;
        const canBNPL = hasLoadedBnplOption;

        // Case 1: No payment options available
        if (!canCOD && !canBNPL) {
            Alert.alert("Payment Unavailable", "Sorry, no payment options are currently available for this product.");
            setActionType(null); // Reset action type
            return;
        }

        // Case 2: Only COD is available -> Proceed directly to checkout
        if (canCOD && !canBNPL) {
            console.log("Buy Now initiated with COD only. Preparing checkout data...");
            setIsProcessingCart(true); // Use cart processing state for Buy Now flow too

            const priceForCheckout = basePriceForCalculations;
            if (priceForCheckout === null) {
                Alert.alert("Error", "Price information is missing for this product.");
                setIsProcessingCart(false); setActionType(null); return;
            }

            // Prepare item data for checkout screen (similar to cart item but might differ slightly)
            const checkoutItem = {
                id: product.id, // Use 'id' consistent with potential cart item structure
                name: product.name || 'Unnamed Product',
                image: galleryItems.find(item => item.type === 'image' && !item.isPlaceholder)?.url || placeholderImage,
                quantity: 1, // Buy Now typically implies quantity 1
                price: Number(priceForCheckout.toFixed(2)), // Final price for this item
                paymentMethod: 'COD',
                bnplPlan: null
            };

            console.log("Navigating to CheckoutScreen with item:", checkoutItem);

            // Use timeout to allow state update before navigation
            setTimeout(() => {
                navigation.navigate('CheckoutScreen', {
                    cartItems: [checkoutItem], // Pass as an array, even if single item
                    totalPrice: checkoutItem.price // Total price for this single item checkout
                });
                setIsProcessingCart(false); // Stop processing after navigation setup
                setActionType(null);
            }, 50); // Small delay
        }
        // Case 3: BNPL is available (either alone or with COD) -> Open modal
        else {
            console.log("Buy Now requires payment selection via modal.");
            openPaymentModal('buyNow');
        }
    };

    // Placeholder for Chat functionality
    const handleChat = () => {
        if (isProcessingCart || isProcessingWishlist) return;
        Alert.alert("Chat Support", "Chat functionality is not yet implemented.");
    };

    // Handlers for toggling review visibility
    const handleSeeMoreReviews = () => setShowAllReviews(true);
    const handleSeeLessReviews = () => setShowAllReviews(false);


    // Handler for the "Proceed" button inside the Payment Modal
    const handleProceedWithPayment = async () => {
        if (isProcessingCart) return; // Prevent double clicks

        // Validation: Ensure a payment method is selected
        if (!selectedPaymentMethod) {
            Alert.alert("Selection Required", "Please select a payment method (COD or BNPL).");
            return;
        }
        // Validation: If BNPL is selected, ensure a plan is also selected
        if (selectedPaymentMethod === 'BNPL' && !selectedBnplPlan) {
            Alert.alert("Selection Required", "Please select a BNPL plan.");
            return;
        }
        // Validation: Ensure product and price data are available
        if (!product?.id || basePriceForCalculations === null) {
            Alert.alert("Error", "Product or price details are missing. Cannot proceed.");
            return;
        }

        const currentActionType = actionType; // Capture action type before resetting state
        setIsProcessingCart(true); // Start processing
        setIsPaymentModalVisible(false); // Close the modal immediately

        let finalPrice = basePriceForCalculations; // Start with base price
        let bnplDetailsForAction = null; // To store formatted BNPL details if selected

        // Calculate final price and prepare BNPL details if BNPL is chosen
        if (selectedPaymentMethod === 'BNPL' && selectedBnplPlan) {
            const interestRateValue = typeof selectedBnplPlan.interestRate === 'number' ? selectedBnplPlan.interestRate : 0;
            // Calculate final price including interest
            finalPrice = basePriceForCalculations * (1 + (interestRateValue / 100));

            // Prepare BNPL details object to store with the item/order
            const duration = typeof selectedBnplPlan.duration === 'number' ? selectedBnplPlan.duration : null;
            const planType = selectedBnplPlan.planType;
            let calculatedMonthly = null;
            // Calculate monthly payment if applicable (not for fixed duration plans)
            if (duration && duration > 0 && planType !== 'Fixed Duration') {
                 calculatedMonthly = Number((finalPrice / duration).toFixed(2));
            }

            bnplDetailsForAction = {
                id: selectedBnplPlan.id,
                name: selectedBnplPlan.planName || 'Unnamed Plan',
                duration: duration,
                interestRate: interestRateValue,
                calculatedMonthly: calculatedMonthly, // Store calculated monthly amount
                planType: planType,
                // Add any other relevant plan details you want to save
            };
        }

        // Prepare the item details based on selections
        const itemDetailsForAction = {
            productId: product.id,
            productName: product.name || 'Unnamed Product',
            image: galleryItems.find(item => item.type === 'image' && !item.isPlaceholder)?.url || placeholderImage,
            quantity: 1, // Assume quantity 1 for both add-to-cart and buy-now from details screen
            paymentMethod: selectedPaymentMethod,
            priceAtAddition: Number(finalPrice.toFixed(2)), // Use potentially adjusted price
            bnplPlan: bnplDetailsForAction // Include BNPL details if applicable
        };

        // --- Execute Action based on original intent (addToCart or buyNow) ---
        if (currentActionType === 'addToCart') {
            console.log("Proceeding with Add to Cart from modal:", itemDetailsForAction);
            let success = false;
            try {
                success = await updateFirestoreCart(itemDetailsForAction);
            } catch (e) {
                console.error("Error during Modal AddToCart operation:", e);
                success = false;
            } finally {
                setIsProcessingCart(false); // Stop processing
                setActionType(null); // Reset action type
            }
            if (success) {
                triggerAddedToCartPopup(); // Show success popup
            }
        } else if (currentActionType === 'buyNow') {
            console.log("Proceeding with Buy Now from modal, preparing checkout data:", itemDetailsForAction);
            // Prepare the item specifically for the checkout screen format
            const checkoutItem = {
                id: itemDetailsForAction.productId,
                name: itemDetailsForAction.productName,
                image: itemDetailsForAction.image,
                quantity: itemDetailsForAction.quantity,
                price: itemDetailsForAction.priceAtAddition, // The final price for checkout
                paymentMethod: itemDetailsForAction.paymentMethod,
                bnplPlan: itemDetailsForAction.bnplPlan // Pass BNPL details
            };

            console.log("Navigating to CheckoutScreen from Modal with item:", checkoutItem);
             // Use timeout to allow state update before navigation
             setTimeout(() => {
                navigation.navigate('CheckoutScreen', {
                    cartItems: [checkoutItem], // Pass as array
                    totalPrice: checkoutItem.price // Total for this single item
                });
                setIsProcessingCart(false); // Stop processing after navigation setup
                setActionType(null); // Reset action type
            }, 50);
        } else {
            // Should not happen, but handle gracefully
            console.warn("Invalid action type encountered in handleProceedWithPayment:", currentActionType);
            setIsProcessingCart(false);
            setActionType(null);
            Alert.alert("Error", "An unexpected error occurred while processing your request.");
        }
    };
    // --- End Handlers ---


    // --- Render Functions ---
    const formatCurrency = (value) => typeof value === 'number' ? `${CURRENCY_SYMBOL} ${value.toFixed(0)}` : null;

    // Renders individual image or video item in the gallery FlatList
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
                    onError={(e) => console.error(`Image Load Error: ${item.url}`, e.nativeEvent.error)}
                />
            );
        }
        if (item.type === 'video') {
            return (
                <Video
                    ref={(ref) => videoRefs.current[item.id] = ref} // Store ref for potential controls
                    style={styles.galleryItemVideo}
                    source={{ uri: item.url }}
                    useNativeControls // Show native video controls
                    resizeMode={ResizeMode.CONTAIN} // Fit video within bounds
                    onError={(e) => console.error(`Video Load Error: ${item.url}`, e)}
                    // Optionally add: shouldPlay={false} // Don't autoplay initially
                />
            );
        }
        return null; // Should not happen with current logic
    };

    // Renders the "1 / N" pagination text for the gallery
    const renderTextPagination = () => {
        if (galleryItems.length <= 1) return null; // Don't show pagination for single item
        return (
            <View style={styles.paginationTextContainer}>
                <Text style={styles.paginationText}>{activeIndex + 1}/{galleryItems.length}</Text>
            </View>
        );
    };

    // Renders the main price display (final price + optional original strikethrough)
    const renderPriceSection = () => {
        if (!mainFinalDisplayPrice) {
             return <Text style={styles.noPriceText}>Price unavailable</Text>;
        }
        return (
            <View style={styles.priceRow}>
                <Text style={styles.finalPrice}>{mainFinalDisplayPrice}</Text>
                {hasDiscount && mainDisplayOriginalPrice && (
                    <Text style={styles.originalPrice}>{mainDisplayOriginalPrice}</Text>
                )}
            </View>
        );
    };

    // Renders the BNPL Plans section on the main product page
    const renderBnplPlansSection = () => {
        if (isLoadingPlans) {
             return (
                 <View style={styles.bnplSectionContainer}>
                     <Text style={styles.sectionTitle}>Installment Options</Text>
                     <ActivityIndicator style={{marginTop: 20}} size="small" color={AccentColor} />
                 </View>
             );
        }
        // Only render if BNPL is potentially available; actual plans check happens inside
        if (!product?.bnplAvailable) return null;

        // Check if plans have loaded and are available after loading attempt
        if (!hasLoadedBnplOption && !isLoadingPlans) {
            // BNPL is supposed to be available, but no plans found after loading
            console.log(`BNPL marked available for ${product.id}, but no plans found or loaded.`);
            return (
                 <View style={styles.bnplSectionContainer}>
                     <Text style={styles.sectionTitle}>Installment Options</Text>
                     <Text style={styles.noPaymentOptionsText}>No installment plans currently available for this product.</Text>
                 </View>
            );
        }

        // Guard: Don't render if still loading or if BNPL isn't actually loaded with plans
        if (isLoadingPlans || !hasLoadedBnplOption || basePriceForCalculations === null) return null;

        // Renders a single plan card within the section
        const renderSinglePlanCard = (plan, index, arrayLength) => {
            if (!plan?.id) return null; // Skip invalid plan data

            const isSelectedOnMain = selectedBnplPlan?.id === plan.id;
            const planName = plan.planName || 'Unnamed Plan';
            const durationMonths = typeof plan.duration === 'number' ? plan.duration : null;
            const interestRateValue = typeof plan.interestRate === 'number' ? plan.interestRate : null;
            const interestRateDisplay = typeof interestRateValue === 'number' ? `${interestRateValue.toFixed(1)}%` : 'N/A';
            const planType = plan.planType || 'General';
            const isFixedDuration = planType === 'Fixed Duration'; // Flag for special handling

            let totalPriceNumeric = null;
            let formattedTotalPrice = null;
            let calculatedMonthlyPayment = null;
            const basePrice = basePriceForCalculations; // Use memoized base price

            // Calculate total price with interest
            if (typeof interestRateValue === 'number' && typeof basePrice === 'number') {
                totalPriceNumeric = basePrice * (1 + (interestRateValue / 100));
                formattedTotalPrice = formatCurrency(totalPriceNumeric);
            } else if (interestRateValue === 0 && typeof basePrice === 'number') {
                // Handle 0% interest case explicitly
                totalPriceNumeric = basePrice;
                formattedTotalPrice = formatCurrency(totalPriceNumeric);
            }

            // Calculate monthly payment if applicable (not fixed duration)
            const numberOfInstallments = !isFixedDuration && durationMonths ? durationMonths : 1;
            if (!isFixedDuration && durationMonths && totalPriceNumeric) {
                calculatedMonthlyPayment = formatCurrency(totalPriceNumeric / durationMonths);
            }

            return (
                <TouchableOpacity
                    key={plan.id}
                    style={[
                        styles.bnplPlanCard,
                        index < arrayLength - 1 && styles.bnplPlanCardSeparator, // Add margin bottom except for last
                        isSelectedOnMain && styles.bnplPlanCardSelected // Highlight if selected
                    ]}
                    onPress={() => handlePlanSelection(plan)} // Allow selection from main screen
                    activeOpacity={0.7}
                >
                    {/* Plan Header */}
                    <View style={styles.bnplPlanHeader}>
                        <MaterialIcons name="payments" size={18} color={BnplPlanIconColor} style={styles.bnplPlanIcon} />
                        <Text style={styles.bnplPlanNameText}>{planName}</Text>
                    </View>

                    {/* Plan Details */}
                    <View style={styles.bnplPlanDetails}>
                        {/* Type */}
                        <View style={styles.detailRow}>
                             <MaterialIcons name="info-outline" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} />
                             <Text style={styles.bnplPlanDetailText}>Type: <Text style={styles.bnplPlanDetailValue}>{planType}</Text></Text>
                        </View>
                        {/* Duration / Installments */}
                        {durationMonths && (
                            <View style={styles.detailRow}>
                                <MaterialIcons name="schedule" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} />
                                <Text style={styles.bnplPlanDetailText}>
                                    Duration:<Text style={styles.bnplPlanDetailValue}> {durationMonths} {durationMonths === 1 ? 'Month' : 'Months'}</Text>
                                    {/* Clarify payment structure */}
                                    {isFixedDuration
                                        ? <Text style={styles.bnplPlanDetailValue}> (1 Payment)</Text>
                                        : <Text style={styles.bnplPlanDetailValue}> / {numberOfInstallments} Installments</Text>
                                    }
                                </Text>
                            </View>
                        )}
                        {/* Estimated Monthly Payment */}
                        {calculatedMonthlyPayment && (
                            <View style={styles.detailRow}>
                                <MaterialIcons name="calculate" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} />
                                <Text style={styles.bnplPlanDetailText}>Est. Monthly: <Text style={styles.bnplPlanDetailValue}>{calculatedMonthlyPayment}</Text></Text>
                            </View>
                        )}
                        {/* Interest Rate */}
                        {interestRateValue !== null && (
                            <View style={styles.detailRow}>
                                <MaterialIcons name="percent" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} />
                                <Text style={styles.bnplPlanDetailText}>Interest: <Text style={styles.bnplPlanDetailValue}>{interestRateDisplay}</Text></Text>
                            </View>
                        )}
                        {/* Total Price (with interest) */}
                        {formattedTotalPrice && (
                            <View style={styles.detailRow}>
                                <MaterialIcons name="monetization-on" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} />
                                <Text style={styles.bnplPlanDetailText}>Total Price: <Text style={styles.bnplPlanDetailValue}>{formattedTotalPrice}</Text></Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            );
        };

        // Get the keys (group titles) from the memoized groups
        const groupKeys = Object.keys(bnplPlanGroups);

        return (
            <View style={styles.bnplSectionContainer}>
                <Text style={styles.sectionTitle}>Installment Options</Text>
                {groupKeys.map(groupTitle => (
                    <View key={groupTitle} style={styles.bnplGroupContainer}>
                        <Text style={styles.bnplGroupTitle}>{groupTitle}</Text>
                        {/* Render cards for each plan within the group */}
                        {bnplPlanGroups[groupTitle].map((plan, index, arr) => renderSinglePlanCard(plan, index, arr.length))}
                    </View>
                ))}
            </View>
        );
    };


    // Renders a single review card with profile image, rating, name, date, and comment
    const renderReviewCard = ({ item }) => { // item is a combined review object
        if (!item?.id) return null; // Skip if item is invalid

        // Determine if this is the very last review being displayed (to potentially hide bottom border)
        const isLastDisplayedReview = item.id === displayReviews[displayReviews.length - 1]?.id;
        // Hide border only if it's the last overall review *and* we are showing all reviews OR if it's the last of the initial set
        const shouldHideBorder = isLastDisplayedReview && (showAllReviews || allReviews.length <= MAX_INITIAL_REVIEWS);


        // Determine the image source: fetched profile image URL or local dummy fallback
        const profileImageSource = item.profileImage ? { uri: item.profileImage } : dummyProfilePic;

        return (
            <View style={[ styles.reviewCard, shouldHideBorder && styles.reviewCardNoBorder ]}>
                <View style={styles.reviewHeader}>
                    {/* Profile Image */}
                    <Image
                        source={profileImageSource}
                        style={styles.reviewerImage}
                        // Add onError to potentially log issues, though source logic handles fallback
                        onError={(e) => {
                            if (item.profileImage) { // Only log if we expected a real image
                                console.log(`Failed to load profile image URI: ${item.profileImage}.`);
                            }
                            // Note: The component won't automatically re-render here just because onError fired.
                            // The initial profileImageSource logic determines what's rendered.
                        }}
                    />
                    {/* Text Content Container (Rating, Name, Date) */}
                    <View style={styles.reviewHeaderTextContainer}>
                         {/* Rating Stars */}
                        <View style={styles.reviewHeaderRating}>
                            {[...Array(5)].map((_, i) => (
                                <MaterialIcons
                                    key={`star-${item.id}-${i}`}
                                    name="star"
                                    size={16}
                                    color={i < (item.rating || 0) ? StarColor : PlaceholderStarColor}
                                />
                            ))}
                        </View>
                         {/* Name and Date */}
                        <Text style={styles.reviewerName} numberOfLines={1}>
                            {item.name} {/* Display fetched or default name */}
                            {/* Conditionally display date if available */}
                            {item.date && <Text style={styles.reviewDate}> · {item.date}</Text>}
                        </Text>
                    </View>
                </View>
                 {/* Comment Text - indented */}
                <Text style={styles.reviewText}>{item.comment || 'No comment provided.'}</Text>
            </View>
        );
    };

    // Renders the content area of the reviews section (loading, error, list, see more/less)
    const renderReviewsSectionContent = () => {
         if (isLoadingReviews) {
             return <ActivityIndicator style={{ marginVertical: 20 }} size="small" color={AccentColor} />;
         }
         if (reviewsError) {
             return <Text style={[styles.errorText, styles.reviewsErrorText]}>{reviewsError}</Text>;
         }
         // Check after loading attempt if there are still no reviews
         if (!isLoadingReviews && allReviews.length === 0) {
             return <Text style={styles.noReviewsText}>Be the first to review this product!</Text>;
         }
         // Render the list and potentially the toggle buttons
         return (
             <>
                 <FlatList
                     data={displayReviews} // Use the memoized slice (either first N or all)
                     renderItem={renderReviewCard}
                     keyExtractor={(item) => item.id}
                     scrollEnabled={false} // Disable scrolling within the main ScrollView
                     // initialNumToRender can be helpful if reviews list is long
                     // initialNumToRender={MAX_INITIAL_REVIEWS}
                 />
                 {/* Show "See More/Less" buttons only if there are more reviews than initially shown */}
                 {allReviews.length > MAX_INITIAL_REVIEWS && (
                     <View style={styles.reviewToggleContainer}>
                         {!showAllReviews ? (
                             <TouchableOpacity style={styles.seeMoreButton} onPress={handleSeeMoreReviews} activeOpacity={0.7}>
                                 <Text style={styles.seeMoreButtonText}>See All {allReviews.length} Reviews</Text>
                                 <MaterialIcons name="keyboard-arrow-down" size={20} color={AccentColor} />
                             </TouchableOpacity>
                          ) : (
                             <TouchableOpacity style={styles.seeMoreButton} onPress={handleSeeLessReviews} activeOpacity={0.7}>
                                 <Text style={styles.seeMoreButtonText}>See Less</Text>
                                 <MaterialIcons name="keyboard-arrow-up" size={20} color={AccentColor} />
                             </TouchableOpacity>
                          )}
                     </View>
                 )}
             </>
         );
    };


    // Renders a single related product card in the grid
    const renderRelatedProductCard = ({ item }) => {
        // Render an empty view for placeholders to maintain grid structure
        if (item.isPlaceholder || !item?.id) {
             return <View style={styles.relatedProductCardPlaceholder} />;
        }

        // Determine pricing display for the related card
        const itemHasDiscount = typeof item.originalPrice === 'number' && typeof item.discountedPrice === 'number' && item.discountedPrice < item.originalPrice;
        const op = formatCurrency(item.originalPrice);
        const dp = formatCurrency(item.discountedPrice);
        const finalPriceDisplay = dp || op; // Show discounted if available, else original
        const originalPriceDisplay = itemHasDiscount ? op : null; // Show strikethrough only if discount exists

        // Check payment badges
        const bnplAvailable = item.bnplAvailable === true;
        const codAvailable = item.codAvailable === true;

        return (
             <TouchableOpacity
                 style={styles.relatedProductCard}
                 // Navigate using push to allow navigating to another product details screen from here
                 onPress={() => !isProcessingCart && !isProcessingWishlist && navigation.push('ProductDetails', { productId: item.id })}
                 activeOpacity={0.8}
                 disabled={isProcessingCart || isProcessingWishlist} // Disable if main actions are busy
             >
                 <Image
                     source={item.image ? { uri: item.image } : placeholderImage}
                     style={styles.relatedCardImage}
                     resizeMode="contain"
                     onError={() => console.log(`Related Img Load Err: ${item.id}`)}
                 />
                 <Text style={styles.relatedCardName} numberOfLines={1}>{item.name || ''}</Text>

                 {/* Price Section */}
                 <View style={styles.relatedCardPriceContainer}>
                     {finalPriceDisplay ? (
                         <Text style={itemHasDiscount ? styles.relatedCardDiscountedPrice : styles.relatedCardProductPrice}>
                             {finalPriceDisplay}
                         </Text>
                     ) : (
                         <View style={styles.relatedCardPricePlaceholder} /> // Placeholder for consistent height
                     )}
                     {originalPriceDisplay && (
                         <Text style={styles.relatedCardStrikethroughPrice}>{originalPriceDisplay}</Text>
                     )}
                 </View>

                 {/* Description Snippet (Optional) */}
                 {item.description ? (
                     <Text style={styles.relatedCardDescription} numberOfLines={2}>
                         {item.description}
                     </Text>
                 ) : (
                     <View style={styles.relatedCardDescriptionPlaceholder}/> // Placeholder for consistent height
                 )}

                 {/* Badges Section */}
                 <View style={styles.relatedCardBadgesContainer}>
                    {/* Prioritize showing BNPL badge if available */}
                    {bnplAvailable ? (
                        <View style={styles.relatedCardBnplBadge}>
                            <MaterialIcons name="schedule" size={14} color={BnplBadgeText} />
                            <Text style={styles.relatedCardBnplText}>BNPL</Text>
                        </View>
                    ) : codAvailable ? ( // Show COD only if BNPL is not available
                        <View style={styles.relatedCardCodBadge}>
                            <MaterialIcons name="local-shipping" size={14} color={CodBadgeText} />
                            <Text style={styles.relatedCardCodText}>COD</Text>
                        </View>
                    ) : (
                        <View style={styles.relatedCardBadgePlaceholder} /> // Placeholder for alignment if neither
                    )}
                 </View>
             </TouchableOpacity>
        );
    };

    // Renders the entire "Related Products" section
    const renderRelatedProductsSection = () => {
        if (loadingRelatedProducts) {
            return (
                <View style={styles.relatedLoadingContainer}>
                    <ActivityIndicator size="large" color={AccentColor} />
                    <Text style={styles.relatedLoadingText}>Loading Related Products...</Text>
                </View>
            );
        }
        // Don't render the section if no related products were found (excluding placeholders)
        if (!relatedProducts || relatedProducts.filter(p => !p.isPlaceholder).length === 0) {
             return null;
        }

        return (
            <View style={styles.relatedProductsContainer}>
                <Text style={styles.relatedProductsTitle}>You Might Also Like</Text>
                <FlatList
                    data={relatedProducts}
                    renderItem={renderRelatedProductCard}
                    keyExtractor={(item) => item.id}
                    numColumns={NUM_COLUMNS}
                    scrollEnabled={false} // Contained within the main ScrollView
                    contentContainerStyle={styles.relatedProductsGridContainer}
                    // Performance optimizations for FlatList
                    initialNumToRender={4} // Render initial items quickly
                    maxToRenderPerBatch={4} // Render items in batches
                    windowSize={5} // Render items within viewport + buffer
                />
            </View>
        );
    };

    // Renders the Payment Selection Modal
    const renderPaymentModal = () => {
        if (!product) return null; // Don't render modal if product isn't loaded

        // Determine if proceed button should be disabled
        const modalProceedDisabled = isProcessingCart || // Disabled if processing cart action
                                     !selectedPaymentMethod || // Disabled if no payment method selected
                                     (selectedPaymentMethod === 'BNPL' && !selectedBnplPlan); // Disabled if BNPL selected but no plan chosen

        // Check available options for the modal
        const hasCodOption = product.codAvailable === true;
        const hasBnplOptionModal = hasLoadedBnplOption; // Use memoized value

        // Helper for formatting currency inside the modal
        const formatModCur = (value) => typeof value === 'number' ? `${CURRENCY_SYMBOL} ${value.toFixed(0)}` : null;

        // Renders a single BNPL plan row inside the modal's scroll view
        const renderModalPlanRow = (plan) => {
            if (!plan?.id || basePriceForCalculations === null) return null; // Skip invalid

            const isSelected = selectedBnplPlan?.id === plan.id;
            const planName = plan.planName || 'Unnamed Plan';
            const duration = typeof plan.duration === 'number' ? plan.duration : null;
            const interestRateValue = typeof plan.interestRate === 'number' ? plan.interestRate : null;
            const interestRateDisplay = typeof interestRateValue === 'number' ? `${interestRateValue.toFixed(1)}%` : 'N/A';
            const planType = plan.planType || 'General';
            const isFixedDurationPlan = planType === 'Fixed Duration';

            let totalPriceNumericModal = null;
            let formattedTotalPriceWithInterestModal = null;
            let calculatedMonthlyPaymentModal = null;
            const basePriceModal = basePriceForCalculations;

            // Recalculate prices based on current base price for modal display
            if (typeof interestRateValue === 'number' && basePriceModal !== null) {
                totalPriceNumericModal = basePriceModal * (1 + (interestRateValue / 100));
                formattedTotalPriceWithInterestModal = formatModCur(totalPriceNumericModal);
            } else if (interestRateValue === 0 && basePriceModal !== null) {
                totalPriceNumericModal = basePriceModal;
                formattedTotalPriceWithInterestModal = formatModCur(totalPriceNumericModal);
            }

            const numberOfInstallmentsModal = !isFixedDurationPlan && duration ? duration : 1;
            if (!isFixedDurationPlan && duration && totalPriceNumericModal) {
                calculatedMonthlyPaymentModal = formatModCur(totalPriceNumericModal / duration);
            }

            return (
                <TouchableOpacity
                    key={plan.id}
                    style={[styles.bnplPlanOption, isSelected && styles.bnplPlanOptionSelected]}
                    onPress={() => handlePlanSelection(plan)} // Use same handler to select/deselect
                    activeOpacity={0.7}
                >
                    <Text style={styles.bnplPlanNameModal}>{planName}</Text>
                    <View style={styles.modalPlanDetailsContainer}>
                         {/* Type */}
                        <View style={styles.modalDetailRow}>
                           <MaterialIcons name="info-outline" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} />
                           <Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Type: </Text><Text style={styles.modalPlanDetailValue}>{planType}</Text></Text>
                        </View>
                         {/* Duration / Installments */}
                        {duration && (
                             <View style={styles.modalDetailRow}>
                                 <MaterialIcons name="schedule" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} />
                                 <Text style={styles.modalPlanDetailText}>
                                     <Text style={styles.modalPlanDetailLabel}>Duration: </Text>
                                     <Text style={styles.modalPlanDetailValue}>{duration} {duration === 1 ? 'Month' : 'Months'}</Text>
                                     {isFixedDurationPlan
                                         ? <Text style={styles.modalPlanDetailValue}> (1 Payment)</Text>
                                         : <Text style={styles.modalPlanDetailValue}> / {numberOfInstallmentsModal} Inst.</Text>}
                                 </Text>
                             </View>
                         )}
                         {/* Estimated Monthly */}
                         {calculatedMonthlyPaymentModal && (
                             <View style={styles.modalDetailRow}>
                                 <MaterialIcons name="calculate" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} />
                                 <Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Est. Monthly: </Text><Text style={styles.modalPlanDetailValue}>{calculatedMonthlyPaymentModal}</Text></Text>
                             </View>
                         )}
                         {/* Interest */}
                         {interestRateValue !== null && (
                            <View style={styles.modalDetailRow}>
                                <MaterialIcons name="percent" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} />
                                <Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Interest: </Text><Text style={styles.modalPlanDetailValue}>{interestRateDisplay}</Text></Text>
                             </View>
                         )}
                         {/* Total Price */}
                         {formattedTotalPriceWithInterestModal && (
                             <View style={styles.modalDetailRow}>
                                 <MaterialIcons name="monetization-on" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} />
                                 <Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Total Price: </Text><Text style={styles.modalPlanDetailValue}>{formattedTotalPriceWithInterestModal}</Text></Text>
                             </View>
                         )}
                    </View>
                </TouchableOpacity>
            );
        };

        // Function to close the modal if not processing
        const closeModal = () => {
            if (!isProcessingCart) {
                 setIsPaymentModalVisible(false);
            }
        }

        return (
            <Modal
                visible={isPaymentModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={closeModal} // For Android back button
            >
                {/* Backdrop with press-out to close */}
                <Pressable style={styles.modalBackdrop} onPressOut={closeModal} />

                {/* Modal Content Container */}
                <View style={styles.modalContainer}>
                    {/* Close Button */}
                    <TouchableOpacity style={styles.modalCloseButton} onPress={closeModal} disabled={isProcessingCart}>
                        <MaterialIcons name="close" size={24} color={TextColorSecondary} />
                    </TouchableOpacity>

                    <Text style={styles.modalTitle}>Select Payment Option</Text>

                    {/* Payment Method Selection Row (COD / BNPL) */}
                    <View style={styles.paymentOptionsRowContainer}>
                        {/* COD Option Button */}
                        {hasCodOption && (
                            <Pressable
                                style={({ pressed }) => [
                                    styles.paymentOptionButtonRow,
                                    selectedPaymentMethod === 'COD' && styles.paymentOptionSelected,
                                    pressed && !isProcessingCart && styles.buttonPressed // Visual feedback on press
                                ]}
                                onPress={() => {
                                    setSelectedPaymentMethod('COD');
                                    // Deselect BNPL plan if COD is chosen
                                    // setSelectedBnplPlan(null); // This happens automatically in handlePlanSelection logic, but explicit is fine too
                                }}
                                disabled={isProcessingCart}
                            >
                                <Text style={[
                                    styles.paymentOptionTextRow,
                                    selectedPaymentMethod === 'COD' && styles.paymentOptionTextSelected
                                ]}>
                                    Cash on Delivery
                                </Text>
                            </Pressable>
                        )}
                        {/* BNPL Option Button */}
                        {hasBnplOptionModal && (
                             <Pressable
                                style={({ pressed }) => [
                                    styles.paymentOptionButtonRow,
                                    selectedPaymentMethod === 'BNPL' && styles.paymentOptionSelected,
                                    pressed && !isProcessingCart && styles.buttonPressed
                                ]}
                                onPress={() => setSelectedPaymentMethod('BNPL')} // Select BNPL method (plan selection happens below)
                                disabled={isProcessingCart}
                            >
                                <Text style={[
                                    styles.paymentOptionTextRow,
                                    selectedPaymentMethod === 'BNPL' && styles.paymentOptionTextSelected
                                ]}>
                                    Buy Now Pay Later
                                </Text>
                            </Pressable>
                        )}
                    </View>

                    {/* Message if no options */}
                    {!hasCodOption && !hasBnplOptionModal && (
                        <Text style={styles.noPaymentOptionsText}>No payment options available for this product.</Text>
                    )}

                    {/* BNPL Plan Selection Area (Shown only if BNPL method is selected) */}
                    {selectedPaymentMethod === 'BNPL' && hasBnplOptionModal && (
                        <View style={styles.bnplPlanSelectionContainer}>
                            <Text style={styles.modalSubtitle}>Select Your Plan</Text>
                            {isLoadingPlans ? ( // Show loader if plans are somehow still loading
                                <ActivityIndicator style={{marginVertical: 20}} size="small" color={AccentColor} />
                            ) : (
                                <ScrollView style={styles.bnplPlanScrollView} nestedScrollEnabled={true}>
                                    {Object.keys(bnplPlanGroups).length > 0 ? (
                                        Object.entries(bnplPlanGroups).map(([groupTitle, plans]) => (
                                            <View key={groupTitle} style={styles.modalPlanGroup}>
                                                <Text style={styles.modalPlanGroupTitle}>{groupTitle}</Text>
                                                {/* Render plan rows for the modal */}
                                                {plans.map(renderModalPlanRow)}
                                            </View>
                                        ))
                                    ) : (
                                        <Text style={styles.noPaymentOptionsText}>No BNPL plans found.</Text> // Fallback if groups are empty
                                    )}
                                </ScrollView>
                            )}
                        </View>
                    )}

                    {/* Proceed Button (Shown only if options exist) */}
                    {(hasCodOption || hasBnplOptionModal) && (
                        <Pressable
                             style={({ pressed }) => [
                                 styles.proceedButton,
                                 modalProceedDisabled && styles.proceedButtonDisabled, // Style when disabled
                                 pressed && !modalProceedDisabled && styles.buttonPressed // Feedback on press
                             ]}
                             onPress={handleProceedWithPayment}
                             disabled={modalProceedDisabled} // Disable based on state
                        >
                             {isProcessingCart ? (
                                 <ActivityIndicator size="small" color="#FFFFFF" /> // Loading indicator
                             ) : (
                                 <Text style={styles.proceedButtonText}>
                                     {/* Change button text based on action */}
                                     {actionType === 'addToCart' ? 'Confirm & Add to Cart' : 'Confirm & Proceed'}
                                 </Text>
                             )}
                         </Pressable>
                    )}
                </View>
            </Modal>
        );
    };
    // --- End Render Functions ---


    // --- Loading / Error States ---
    if (isLoadingProduct) {
         return (
             <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
                 <StatusBar barStyle="dark-content" backgroundColor={AppBackgroundColor} />
                 <View style={styles.loadingContainer}>
                     <ActivityIndicator size="large" color={AccentColor} />
                     <Text style={styles.errorText}>Loading Product Details...</Text>
                 </View>
             </SafeAreaView>
         );
    }

    if (!product) {
         return (
             <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
                 <StatusBar barStyle="dark-content" backgroundColor={AppBackgroundColor} />
                 <View style={styles.loadingContainer}>
                     <MaterialIcons name="error-outline" size={40} color={TextColorSecondary} style={{marginBottom: 15}} />
                     <Text style={styles.errorText}>Product details could not be loaded.</Text>
                     <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackButton}>
                         <Text style={styles.goBackButtonText}>Go Back</Text>
                     </TouchableOpacity>
                 </View>
             </SafeAreaView>
         );
    }


    // --- Main Return ---
    return (
        // Use edges to control safe area insets precisely if needed
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
            <StatusBar barStyle="dark-content" backgroundColor={AppBackgroundColor} />

             {/* Added to Cart Popup */}
             {showAddedToCartPopup && (
                 <Animated.View style={[styles.addedPopup, { opacity: popupOpacity }]}>
                     <MaterialIcons name="check-circle" size={18} color={PopupTextColor} style={{ marginRight: 8 }}/>
                     <Text style={styles.popupText}>Added to Cart!</Text>
                 </Animated.View>
             )}

            {/* Main Content Scroll */}
            <ScrollView
                 contentContainerStyle={styles.scrollContainer}
                 showsVerticalScrollIndicator={false}
                 nestedScrollEnabled={true} // Important for nested FlatLists/ScrollViews like reviews/BNPL plans
            >
                {/* Image/Video Gallery */}
                <View style={styles.galleryWrapper}>
                    <FlatList
                        ref={flatListRef}
                        data={galleryItems}
                        renderItem={renderGalleryItem}
                        keyExtractor={(item) => item.id}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onViewableItemsChanged={onViewableItemsChanged}
                        viewabilityConfig={viewabilityConfig}
                        scrollEventThrottle={16} // Throttle events for performance
                        style={styles.galleryFlatList}
                        // Performance optimizations
                        initialNumToRender={1}
                        maxToRenderPerBatch={1}
                        windowSize={3} // Render items in viewport + 1 on each side
                    />
                    {/* Gallery Overlay for Pagination */}
                    <View style={styles.galleryOverlayContainer}>
                        {renderTextPagination()}
                    </View>
                </View>

                {/* Product Details Content Area */}
                <View style={styles.contentContainer}>
                    {/* Product Name */}
                    <Text style={styles.productName}>{product.name}</Text>

                    {/* Rating & Sold Count Row */}
                    <View style={styles.reviewSectionHeaderInline}>
                        <View style={styles.reviewOverallRating}>
                            {typeof averageRating === 'number' ? (
                                <>
                                    <MaterialIcons name="star" size={16} color={StarColor} style={styles.ratingStarIcon}/>
                                    <Text style={styles.reviewOverallRatingText}>{averageRating.toFixed(1)}</Text>
                                    {/* Show review count next to rating if available */}
                                    <Text style={styles.reviewCountText}>({isLoadingReviews ? '...' : allReviews.length})</Text>
                                </>
                            ) : !isLoadingReviews ? ( // Only show dash if not loading and no rating
                                <Text style={styles.reviewOverallRatingText}>-</Text>
                            ) : null /* Don't show anything while loading reviews */}
                        </View>
                        {/* Separator */}
                        {(typeof averageRating === 'number' || !isLoadingReviews) && soldCount > 0 && <View style={styles.ratingSoldCountSeparator} />}
                        {/* Sold Count */}
                        {soldCount > 0 && <Text style={styles.soldCountText}>{displaySoldCount} sold</Text>}
                    </View>

                    {/* Price & Top Action Buttons Row */}
                    <View style={styles.priceActionsRow}>
                        {/* Price */}
                        {renderPriceSection()}
                        {/* Wishlist & Share Buttons */}
                        <View style={styles.rightActionButtonsGroup}>
                            {/* Wishlist Button */}
                             <TouchableOpacity
                                onPress={handleWishlistToggle}
                                style={[
                                    styles.iconButton,
                                    // Apply disabled style if checking or processing
                                    (isProcessingWishlist || checkingWishlist) && styles.wishlistButtonDisabled
                                ]}
                                activeOpacity={0.7}
                                // Disable button when checking, processing, or if product ID is missing
                                disabled={isProcessingWishlist || checkingWishlist || !product?.id}
                            >
                                {isProcessingWishlist ? (
                                    // Show loading indicator while processing
                                    <ActivityIndicator size="small" color={AccentColor} />
                                ) : (
                                    // Show heart icon based on Firestore state
                                    <MaterialIcons
                                        name={isWishlisted ? 'favorite' : 'favorite-border'}
                                        size={24}
                                        color={isWishlisted ? AccentColor : TextColorPrimary}
                                    />
                                )}
                            </TouchableOpacity>
                            {/* Share Button */}
                            <TouchableOpacity
                                onPress={shareProduct}
                                style={[styles.iconButton, { marginLeft: 10 }]} // Add spacing
                                activeOpacity={0.7}
                                // Disable share if other actions are processing
                                disabled={isProcessingWishlist || isProcessingCart}
                            >
                                <Feather name="share-2" size={22} color={TextColorPrimary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Description Section */}
                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.descriptionText}>{product.description || 'No description available.'}</Text>

                    {/* BNPL Plans Section (Conditional Rendering) */}
                    {renderBnplPlansSection()}

                    {/* Reviews Section */}
                    <View style={styles.reviewSectionWrapper}>
                        {/* Use dynamic review count */}
                        <Text style={styles.sectionTitle}>
                             Reviews {(!isLoadingReviews && allReviews.length > 0) ? `(${allReviews.length})` : ''}
                        </Text>
                        {renderReviewsSectionContent()}
                    </View>
                </View>

                {/* Related Products Section (Conditional Rendering) */}
                {renderRelatedProductsSection()}

                {/* Add padding at the very bottom of the scroll view if needed */}
                 <View style={styles.relatedProductsBottomPadding} />
            </ScrollView>

            {/* Bottom Action Bar (Fixed at Bottom) */}
            <View style={styles.buttonContainer}>
                 {/* Chat Button */}
                 <TouchableOpacity
                      style={[
                          styles.bottomButtonBase,
                          styles.chatButton,
                          // Disable if any main action is processing
                          (isProcessingCart || isProcessingWishlist) && styles.buttonDisabledGeneric
                      ]}
                      onPress={handleChat}
                      activeOpacity={0.7}
                      disabled={isProcessingCart || isProcessingWishlist}
                 >
                     <MaterialIcons name="support-agent" size={22} color={ChatIconColor} style={{ marginBottom: 2 }}/>
                     <Text style={[styles.buttonText, styles.chatButtonText]}>Chat</Text>
                 </TouchableOpacity>

                 {/* Add to Cart Button */}
                 <Pressable
                     style={({ pressed }) => [
                         styles.bottomButtonBase,
                         styles.cartButton,
                         // Disable if any main action is processing
                         (isProcessingCart || isProcessingWishlist) && styles.buttonDisabledGeneric,
                         pressed && !(isProcessingCart || isProcessingWishlist) && styles.buttonPressed // Press feedback only when enabled
                     ]}
                     onPress={handleAddToCart}
                     disabled={isProcessingCart || isProcessingWishlist}
                 >
                     {/* Show loader specifically if processing 'addToCart' */}
                     {isProcessingCart && actionType === 'addToCart' ? (
                         <ActivityIndicator size="small" color={BrightRedButtonColor} />
                     ) : (
                         <Text style={[styles.buttonText, styles.cartButtonText]}>Add to Cart</Text>
                     )}
                 </Pressable>

                 {/* Buy Now Button */}
                 <Pressable
                      style={({ pressed }) => [
                          styles.buyButtonContainer, // Container handles shadow/border radius
                          // Disable if any main action is processing
                          (isProcessingCart || isProcessingWishlist) && styles.buttonDisabledGeneric,
                          pressed && !(isProcessingCart || isProcessingWishlist) && styles.buttonPressed
                      ]}
                      onPress={handleBuyNow}
                      disabled={isProcessingCart || isProcessingWishlist}
                 >
                     {/* Gradient applied inside the Pressable */}
                     <LinearGradient
                         colors={[BrightRedButtonColor, BrightRedGradientEndColor]}
                         style={styles.buyButtonGradient} // Gradient styles flex:1 to fill container
                         start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} // Horizontal gradient example
                     >
                          {/* Show loader specifically if processing 'buyNow' */}
                          {isProcessingCart && actionType === 'buyNow' ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                              <Text style={[styles.buttonText, styles.buyButtonText]}>Buy Now</Text>
                          )}
                     </LinearGradient>
                 </Pressable>
            </View>

            {/* Payment Modal (Rendered conditionally) */}
            {renderPaymentModal()}
        </SafeAreaView>
    );
}
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: AppBackgroundColor },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: AppBackgroundColor },
    errorText: { fontSize: 14, color: TextColorSecondary, textAlign: 'center', marginTop: 10 },
    scrollContainer: { paddingBottom: 100, backgroundColor: AppBackgroundColor },
    galleryWrapper: { backgroundColor: AppBackgroundColor, position: 'relative' },
    galleryFlatList: { width: screenWidth, height: GALLERY_HEIGHT },
    galleryItemImage: { width: screenWidth, height: GALLERY_HEIGHT, backgroundColor: PlaceholderBgColor },
    galleryItemVideo: { width: screenWidth, height: GALLERY_HEIGHT, backgroundColor: '#000' },
    galleryOverlayContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'box-none' },
    paginationTextContainer: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0, 0, 0, 0.6)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
    paginationText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
    contentContainer: { paddingHorizontal: 20, paddingTop: 20 },
    productName: { fontSize: 24, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 8, lineHeight: 30 },
    reviewSectionHeaderInline: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 12 },
    reviewOverallRating: { flexDirection: 'row', alignItems: 'center', marginRight: 15 },
    reviewOverallRatingText: { fontSize: 14, fontWeight: 'bold', color: TextColorPrimary, marginLeft: 4 },
    soldCountText: { fontSize: 14, color: TextColorSecondary },
    priceActionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, minHeight: 30 },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', flexShrink: 1, marginRight: 10 },
    finalPrice: { fontSize: 20, fontWeight: 'bold', color: AccentColor },
    originalPrice: { fontSize: 14, color: StrikethroughColor, textDecorationLine: 'line-through', marginLeft: 8 },
    noPriceText: { fontSize: 16, color: TextColorSecondary, fontStyle: 'italic' },
    rightActionButtonsGroup: { flexDirection: 'row', alignItems: 'center' },
    iconButton: { padding: 5 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 12, marginTop: 15 },
    descriptionText: { fontSize: 15, color: TextColorSecondary, lineHeight: 24, marginBottom: 25 },
    bnplSectionContainer: { marginTop: 10, marginBottom: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: LightBorderColor },
    bnplGroupContainer: { marginBottom: 15 },
    bnplGroupTitle: { fontSize: 15, fontWeight: '600', color: TextColorSecondary, marginBottom: 10 },
    bnplPlanCard: { backgroundColor: BnplPlanCardBg, borderRadius: 8, borderWidth: 1, borderColor: BnplPlanCardBorder, paddingVertical: 12, paddingHorizontal: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1.5, elevation: 1 },
    bnplPlanCardSelected: { borderColor: BrightRedButtonColor, backgroundColor: ModalSelectedBg, borderWidth: 1.5, shadowColor: BrightRedButtonColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 4 },
    bnplPlanCardSeparator: { marginBottom: 12 },
    bnplPlanHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    bnplPlanIcon: { marginRight: 10 },
    bnplPlanNameText: { fontSize: 16, fontWeight: '600', color: BnplPlanNameColor, flexShrink: 1 },
    bnplPlanDetails: { paddingLeft: 5 },
    detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
    detailIcon: { marginRight: 8, width: 16, textAlign: 'center', color: BnplPlanDetailIconColor },
    bnplPlanDetailText: { fontSize: 13, color: BnplPlanDetailColor, lineHeight: 19, flexShrink: 1 },
    bnplPlanDetailValue: { fontWeight: '600', color: BnplPlanValueColor },
    reviewSectionWrapper: { marginBottom: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: LightBorderColor },

    // *** Styles for Review Card with Image ***
    reviewCard: {
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    reviewHeader: {
        flexDirection: 'row', // Arrange image and text side-by-side
        alignItems: 'center', // Align items vertically in the center of the row
        marginBottom: 10,
    },
    reviewerImage: {
        width: 40,
        height: 40,
        borderRadius: 20, // Make it circular
        marginRight: 12,
        backgroundColor: PlaceholderBgColor, // Background for loading/fallback
    },
    reviewHeaderTextContainer: {
        flex: 1, // Allow text container to take remaining space
        flexDirection: 'column',
        justifyContent: 'center', // Vertically center rating and name/date
    },
    reviewHeaderRating: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    reviewerName: {
        fontSize: 15,
        fontWeight: '600',
        color: TextColorPrimary,
        flexShrink: 1, // Prevent long names from pushing things out
    },
    reviewDate: {
        fontSize: 13,
        color: TextColorSecondary,
        fontWeight: 'normal',
    },
    reviewText: {
        fontSize: 14,
        color: TextColorSecondary,
        lineHeight: 21,
        paddingLeft: 52, // Indent comment text to align under name/rating (image width 40 + margin 12)
    },
    // *** End Styles for Review Card ***

    noReviewsText: { textAlign: 'center', color: TextColorSecondary, marginTop: 20, marginBottom: 20, fontStyle: 'italic' },
    seeMoreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginTop: 10, borderTopWidth: 1, borderTopColor: LightBorderColor },
    seeMoreButtonText: { fontSize: 15, fontWeight: '500', color: AccentColor, marginRight: 5 },
    relatedProductsContainer: { marginTop: 20, paddingTop: 20, paddingBottom: 10, borderTopWidth: 1, borderTopColor: '#E0E0E0', backgroundColor: RelatedSectionBgColor },
    relatedProductsTitle: { fontSize: 18, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 15, paddingHorizontal: GRID_PADDING_HORIZONTAL },
    relatedLoadingContainer: { minHeight: 280, justifyContent: 'center', alignItems: 'center', marginVertical: 20, backgroundColor: RelatedSectionBgColor, paddingHorizontal: GRID_PADDING_HORIZONTAL },
    relatedLoadingText: { marginTop: 10, fontSize: 14, color: TextColorSecondary },
    relatedProductsGridContainer: { paddingHorizontal: GRID_PADDING_HORIZONTAL - CARD_MARGIN_HORIZONTAL },
    relatedProductCard: { backgroundColor: '#fff', borderRadius: 8, margin: CARD_MARGIN_HORIZONTAL, width: relatedCardWidth, paddingVertical: 12, paddingHorizontal: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.18, shadowRadius: 1.00, minHeight: 300, alignItems: 'center', justifyContent: 'flex-start' },
    relatedProductCardPlaceholder: { margin: CARD_MARGIN_HORIZONTAL, width: relatedCardWidth, minHeight: 300, backgroundColor: 'transparent' },
    relatedCardImage: { width: '100%', height: 120, borderRadius: 6, marginBottom: 10, backgroundColor: PlaceholderBgColor, alignSelf: 'center' },
    relatedCardName: { fontSize: 14, fontWeight: '600', color: TextColorPrimary, textAlign: 'center', minHeight: 18, marginBottom: 6, width: '100%', paddingHorizontal: 5 },
    relatedCardPriceContainer: { flexDirection: 'column', alignItems: 'center', minHeight: 35, marginBottom: 8, justifyContent: 'center', width: '100%' },
    relatedCardProductPrice: { fontSize: 14, color: AccentColor, fontWeight: 'bold' },
    relatedCardStrikethroughPrice: { textDecorationLine: 'line-through', color: StrikethroughColor, fontWeight: 'normal', fontSize: 13, marginTop: 2 },
    relatedCardDiscountedPrice: { fontSize: 15, color: DiscountedPriceColor, fontWeight: 'bold' },
    relatedCardPricePlaceholder: { height: 20, minHeight: 35 },
    relatedCardDescription: { fontSize: 11, color: TextColorSecondary, textAlign: 'center', marginBottom: 10, paddingHorizontal: 5, minHeight: 28, lineHeight: 14, width: '95%' },
    relatedCardDescriptionPlaceholder: { height: 28, marginBottom: 10 },
    relatedCardBadgesContainer: { flexDirection: 'row', justifyContent: 'center', width: '90%', marginTop: 'auto', marginBottom: 4, minHeight: 24 },
    relatedCardBnplBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: BnplBadgeBg, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, height: 24, alignSelf: 'center' },
    relatedCardBnplText: { fontSize: 11, color: BnplBadgeText, marginLeft: 4, fontWeight: '600' },
    relatedCardCodBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: CodBadgeBg, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, height: 24, alignSelf: 'center' },
    relatedCardCodText: { fontSize: 11, color: CodBadgeText, marginLeft: 4, fontWeight: '600' },
    relatedCardBadgePlaceholder: { height: 24, width: '80%' },
    relatedProductsBottomPadding: { height: 15, backgroundColor: RelatedSectionBgColor },
    buttonContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: AppBackgroundColor, paddingVertical: 8, paddingHorizontal: 8, paddingBottom: Platform.OS === 'ios' ? 30 : 12, borderTopWidth: 1, borderTopColor: LightBorderColor, alignItems: 'stretch' },
    bottomButtonBase: { borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4, overflow: 'hidden', height: 50 },
    chatButton: { flex: 0.6, flexDirection: 'column', backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#E0E0E0', paddingVertical: 8 },
    chatButtonText: { color: ChatIconColor, fontSize: 11, fontWeight: '600', marginTop: 2 },
    cartButton: { flex: 1, flexDirection: 'row', backgroundColor: AppBackgroundColor, borderWidth: 1.5, borderColor: BrightRedButtonColor },
    cartButtonText: { color: BrightRedButtonColor, fontSize: 16, fontWeight: 'bold' },
    buyButtonContainer: { flex: 1, borderRadius: 10, marginHorizontal: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.20, shadowRadius: 3.84, elevation: 5, height: 50 },
    buyButtonGradient: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', height: 50, width: '100%' },
    buyButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    buttonText: { textAlign: 'center' },
    buttonDisabledGeneric: { opacity: 0.6 },
    buttonPressed: { transform: [{ scale: 0.97 }] },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    modalContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: AppBackgroundColor, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 40, paddingBottom: Platform.OS === 'ios' ? 40 : 30, maxHeight: '80%', shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 10 },
    modalCloseButton: { position: 'absolute', top: 10, right: 15, padding: 5, zIndex: 1 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: TextColorPrimary, textAlign: 'center', marginBottom: 20 },
    modalSubtitle: { fontSize: 16, fontWeight: '600', color: TextColorPrimary, marginBottom: 15 },
    paymentOptionsRowContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
    paymentOptionButtonRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1.5, borderColor: LightBorderColor, borderRadius: 8, marginHorizontal: 5 },
    paymentOptionSelected: { borderColor: BrightRedButtonColor, backgroundColor: ModalSelectedBg },
    paymentOptionTextRow: { fontSize: 14, color: TextColorPrimary, textAlign: 'center', fontWeight: '500' },
    paymentOptionTextSelected: { fontWeight: 'bold', color: BrightRedButtonColor },
    noPaymentOptionsText: { fontSize: 14, color: TextColorSecondary, textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
    bnplPlanSelectionContainer: { borderTopWidth: 1, borderTopColor: LightBorderColor, paddingTop: 15, marginBottom: 20, flexShrink: 1 },
    bnplPlanScrollView: { maxHeight: Platform.OS === 'ios' ? 220 : 180 },
    modalPlanGroup: { marginBottom: 15 },
    modalPlanGroupTitle: { fontSize: 13, fontWeight: 'bold', color: TextColorSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    bnplPlanOption: { padding: 12, borderWidth: 1, borderColor: LightBorderColor, borderRadius: 8, marginBottom: 12 },
    bnplPlanOptionSelected: { borderColor: BrightRedButtonColor, backgroundColor: ModalSelectedBg, borderWidth: 1.5 },
    bnplPlanNameModal: { fontSize: 15, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 10 },
    modalPlanDetailsContainer: { paddingLeft: 5 },
    modalDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    modalDetailIcon: { marginRight: 8, width: 16, textAlign: 'center', color: BnplPlanDetailIconColor },
    modalPlanDetailText: { fontSize: 12, color: TextColorSecondary, lineHeight: 18, flexShrink: 1 },
    modalPlanDetailLabel: { color: TextColorSecondary },
    modalPlanDetailValue: { fontWeight: '600', color: TextColorPrimary },
    proceedButton: { backgroundColor: BrightRedButtonColor, paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginTop: 10, minHeight: 50, justifyContent: 'center' },
    proceedButtonDisabled: { backgroundColor: ModalProceedDisabledBg, opacity: 1 },
    proceedButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    addedPopup: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 20, left: 20, right: 20, backgroundColor: PopupBgColor, paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    popupText: { color: PopupTextColor, fontSize: 15, fontWeight: '600' },
});