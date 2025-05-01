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
    doc, setDoc, updateDoc, arrayUnion, getDoc, serverTimestamp, Timestamp // Import Timestamp
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
const defaultProfileImage = 'https://www.w3schools.com/w3images/avatar2.png';
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
    const [isWishlisted, setIsWishlisted] = useState(false); // Note: Local state only for now
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
                setIsLoadingProduct(false);
                setProduct(null);
                return;
            }
            const baseProduct = { /* ... (Normalization logic remains the same) ... */
                 ...productData,
                bnplAvailable: productData.paymentOption?.BNPL === true,
                codAvailable: productData.paymentOption?.COD === true,
                originalPrice: typeof productData.originalPrice === 'number' ? productData.originalPrice : null,
                discountedPrice: typeof productData.discountedPrice === 'number' ? productData.discountedPrice : null,
                BNPLPlanIDs: Array.isArray(productData.BNPLPlanIDs)
                    ? productData.BNPLPlanIDs.filter(id => typeof id === 'string' && id.trim() !== '')
                    : (Array.isArray(productData.BNPLPlans) ? productData.BNPLPlans.filter(id => typeof id === 'string' && id.trim() !== '') : []),
                BNPLPlans: Array.isArray(productData.BNPLPlans) && productData.BNPLPlans.length > 0 && typeof productData.BNPLPlans[0] === 'object' && productData.BNPLPlans[0] !== null
                    ? productData.BNPLPlans
                    : [],
                name: productData.name || 'Unnamed Product',
                description: productData.description || '',
                media: productData.media || {},
                image: productData.image || productData.media?.images?.[0] || null,
                category: productData.category || 'Uncategorized',
                rating: typeof productData.rating === 'number' ? productData.rating : null,
                soldCount: typeof productData.soldCount === 'number' ? productData.soldCount : 0,
            };
            const needsPlanFetch = baseProduct.bnplAvailable && baseProduct.BNPLPlanIDs.length > 0 && baseProduct.BNPLPlans.length === 0;
            console.log(`Product ${baseProduct.id}: Initializing. Needs Plan Fetch: ${needsPlanFetch}`);
            setProduct(baseProduct);
            setIsLoadingProduct(false);
            if (needsPlanFetch) { /* ... (BNPL Plan fetching logic remains the same) ... */
                console.log(`Product ${baseProduct.id}: Fetching ${baseProduct.BNPLPlanIDs.length} plans...`);
                setIsLoadingPlans(true);
                try {
                    const planPromises = baseProduct.BNPLPlanIDs.map(planId => {
                        if (!planId || typeof planId !== 'string') return Promise.resolve(null);
                        const planRef = doc(db, 'BNPL_plans', planId.trim());
                        return getDoc(planRef);
                    });
                    const planSnapshots = await Promise.all(planPromises);
                    const detailedPlans = planSnapshots
                        .map(snap => snap?.exists() ? { id: snap.id, ...snap.data() } : null)
                        .filter(plan => plan !== null);
                    console.log(`Product ${baseProduct.id}: Fetched ${detailedPlans.length} detailed plans.`);
                    setProduct(prev => prev?.id === baseProduct.id ? { ...prev, BNPLPlans: detailedPlans } : prev);
                } catch (planError) {
                    console.error(`Error fetching BNPL plans for product ${baseProduct.id}:`, planError);
                    setProduct(prev => prev?.id === baseProduct.id ? { ...prev, BNPLPlans: [] } : prev);
                } finally {
                    setIsLoadingPlans(false);
                }
            } else { setIsLoadingPlans(false); }
        };

        // Reset logic remains the same
        setProduct(null); setIsLoadingProduct(true); setIsLoadingPlans(false);
        setRelatedProducts([]); setLoadingRelatedProducts(true); setSelectedBnplPlan(null);
        setSelectedPaymentMethod(null); setActiveIndex(0); setActionType(null);
        setIsProcessingCart(false); setShowAddedToCartPopup(false); setIsWishlisted(false);
        setReviews([]); setIsLoadingReviews(false); setReviewsError(null); setShowAllReviews(false);

        // Product loading determination logic remains the same
        if (initialProductFromRoute) { /* ... */
             console.log("Loading product from route params:", initialProductFromRoute.id);
            loadProductAndPlans(initialProductFromRoute);
        } else if (productIdFromRoute) { /* ... */
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
        } else { /* ... */
            console.error("No product data or ID provided.");
            setIsLoadingProduct(false); setProduct(null);
            Alert.alert("Error", "Could not load product information.");
        }
        return () => { if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current); };
    }, [route.params?.product, route.params?.productId]);


    // Effect 2: Fetch Reviews and User Data when Product ID is available
    useEffect(() => {
        if (!isLoadingProduct && product && product.id) {
            const fetchReviewsAndUsers = async (productIdToFetch) => {
                console.log(`Fetching reviews for productId: ${productIdToFetch}`);
                setIsLoadingReviews(true);
                setReviewsError(null);
                setReviews([]); // Clear previous reviews

                try {
                    // 1. Fetch Reviews
                    const reviewsQuery = query(
                        collection(db, 'Reviews'),
                        where('productId', '==', productIdToFetch),
                        orderBy('timestamp', 'desc')
                    );
                    const reviewsSnapshot = await getDocs(reviewsQuery);
                    const reviewDocsData = reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    // 2. Extract Unique User IDs
                    const userIds = [
                        ...new Set( // Use Set for uniqueness
                            reviewDocsData
                                .map(data => data.userId)
                                .filter(id => typeof id === 'string' && id.trim() !== '') // Filter out invalid IDs
                        )
                    ];

                    // 3. Fetch User Data (if any user IDs were found)
                    const userDataMap = {}; // To store fetched user data { userId: { name, profileImage } }
                    if (userIds.length > 0) {
                        console.log(`Fetching user data for ${userIds.length} users.`);
                        // Firestore 'in' query limit is 30 as of recent updates (was 10). Chunk if expecting more.
                        // Simple approach assuming <= 30 unique reviewers per load:
                         try {
                            const usersQuery = query(collection(db, 'Users'), where(documentId(), 'in', userIds));
                            const usersSnapshot = await getDocs(usersQuery);

                            usersSnapshot.forEach(userDoc => {
                                const userData = userDoc.data();
                                userDataMap[userDoc.id] = {
                                    name: userData?.name || 'Anonymous User', // Fallback name
                                    profileImage: userData?.profileImage || null // Store null if not present
                                };
                            });
                            console.log(`Fetched data for ${usersSnapshot.size} users.`);
                         } catch (userFetchError) {
                            console.error("Error fetching user data for reviews:", userFetchError);
                            // Continue without user data, reviews will show defaults
                         }
                    }

                    // 4. Combine Review and User Data
                    const combinedReviews = reviewDocsData.map((data) => {
                         if (!data.rating || !data.reviewText || !data.timestamp || !data.userId) {
                             console.warn("Skipping review with missing data:", data.id, data);
                             return null; // Skip invalid reviews
                         }

                         let formattedDate = 'Date unavailable';
                         if (data.timestamp instanceof Timestamp) {
                             try {
                                 formattedDate = data.timestamp.toDate().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
                             } catch (e) { console.error("Error formatting timestamp:", e); }
                         } else if (data.timestamp) { // Handle other date formats if necessary
                            try {
                                 formattedDate = new Date(data.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
                            } catch(e) { /* Ignore if cannot parse */ }
                         }

                         // Get user details from map or use default
                         const userDetails = userDataMap[data.userId] || { name: 'Anonymous User', profileImage: null };

                         return {
                             id: data.id,
                             rating: data.rating,
                             comment: data.reviewText,
                             date: formattedDate,
                             name: userDetails.name, // Use fetched name
                             profileImage: userDetails.profileImage, // Use fetched image URL (or null)
                             userId: data.userId
                         };
                     }).filter(review => review !== null); // Filter out skipped reviews

                    setReviews(combinedReviews);
                    console.log(`Processed ${combinedReviews.length} reviews with user data.`);

                } catch (error) {
                    console.error("Error fetching reviews:", error);
                    setReviewsError("Could not load reviews.");
                    setReviews([]);
                } finally {
                    setIsLoadingReviews(false);
                }
            };
            fetchReviewsAndUsers(product.id);
        }
    }, [product?.id, isLoadingProduct]); // Depends on product ID and product loading status


    // Effect 3: Fetch Related Products (Remains the same)
    useEffect(() => {
        if (!product || !product.id || !product.category || isLoadingProduct) {
            if (!isLoadingProduct && !product) setLoadingRelatedProducts(false);
            return;
        }
        const fetchRelated = async () => { /* ... (Related product fetching logic remains the same) ... */
            console.log(`Fetching related products for category: ${product.category}, excluding: ${product.id}`);
            setLoadingRelatedProducts(true);
            setRelatedProducts([]);
             try {
                const q = query(
                    collection(db, 'Products'),
                    where('category', '==', product.category),
                    where(documentId(), '!=', product.id),
                    orderBy(documentId()),
                    limit(RELATED_PRODUCTS_LIMIT)
                );
                const querySnapshot = await getDocs(q);
                let fetched = querySnapshot.docs.map(docSnapshot => {
                    const d = docSnapshot.data();
                    // Normalize related product data
                    return {
                        id: docSnapshot.id,
                        name: d.name || 'Unnamed',
                        description: d.description || '',
                        category: d.category || 'Uncat',
                        originalPrice: typeof d.originalPrice === 'number' ? d.originalPrice : null,
                        discountedPrice: typeof d.discountedPrice === 'number' ? d.discountedPrice : null,
                        image: d.media?.images?.[0] || d.image || null,
                        media: d.media,
                        paymentOption: d.paymentOption,
                        BNPLPlanIDs: Array.isArray(d.BNPLPlans) ? d.BNPLPlans.filter(id => typeof id === 'string' && id.trim() !== '') : [],
                        BNPLPlans: [], // Don't load full plans here
                        rating: typeof d.rating === 'number' ? d.rating : null,
                        soldCount: typeof d.soldCount === 'number' ? d.soldCount : 0,
                        bnplAvailable: d.paymentOption?.BNPL === true,
                        codAvailable: d.paymentOption?.COD === true,
                    };
                });
                if (fetched.length > 0 && fetched.length < RELATED_PRODUCTS_LIMIT && fetched.length % 2 !== 0) {
                    fetched.push({ id: `placeholder-${Date.now()}`, isPlaceholder: true });
                }
                setRelatedProducts(fetched);
                console.log(`Fetched ${querySnapshot.docs.length} related products.`);
            } catch (error) {
                console.error("Error fetching related products: ", error);
                setRelatedProducts([]);
            } finally {
                setLoadingRelatedProducts(false);
            }
        };
        fetchRelated();
    }, [product?.id, product?.category, isLoadingProduct]);
    // --- End Effects ---


    // --- Memos --- (Most memos remain the same, averageRating updates)
    const galleryItems = useMemo(() => { /* ... (Gallery logic remains the same) ... */
         if (!product || (!product.media && !product.image)) { return [{ type: 'image', url: null, id: 'placeholder-img', isPlaceholder: true }]; }
         const items = []; const seenUrls = new Set();
         const addItem = (item) => { if (item.url && typeof item.url === 'string' && !seenUrls.has(item.url)) { items.push(item); seenUrls.add(item.url); } else if (item.isPlaceholder) { items.push(item); } };
         if (product.media?.images && Array.isArray(product.media.images)) { product.media.images.forEach(url => addItem({ type: 'image', url: url, id: `img-${url}` })); }
         const videoUrl = product.media?.video;
         if (videoUrl) addItem({ type: 'video', url: videoUrl, id: `vid-${videoUrl}` });
         if (product.image) { const fallbackAlreadyAdded = items.some(item => item.type === 'image' && item.url === product.image); if (!fallbackAlreadyAdded) { if (items.filter(i => i.type === 'image').length === 0) items.unshift({ type: 'image', url: product.image, id: `img-fallback-${product.image}` }); else items.push({ type: 'image', url: product.image, id: `img-fallback-${product.image}` }); } }
         if (items.length === 0) items.push({ type: 'image', url: null, id: 'placeholder-img', isPlaceholder: true });
         return items;
    }, [product?.media, product?.image]);

    const originalPriceValue = useMemo(() => product?.originalPrice, [product?.originalPrice]);
    const discountedPriceValue = useMemo(() => product?.discountedPrice, [product?.discountedPrice]);
    const hasDiscount = useMemo(() => typeof originalPriceValue === 'number' && typeof discountedPriceValue === 'number' && discountedPriceValue < originalPriceValue, [originalPriceValue, discountedPriceValue]);
    const mainDisplayOriginalPrice = useMemo(() => typeof originalPriceValue === 'number' ? `${CURRENCY_SYMBOL} ${originalPriceValue.toFixed(0)}` : null, [originalPriceValue]);
    const mainDisplayDiscountedPrice = useMemo(() => typeof discountedPriceValue === 'number' ? `${CURRENCY_SYMBOL} ${discountedPriceValue.toFixed(0)}` : null, [discountedPriceValue]);
    const mainFinalDisplayPrice = useMemo(() => mainDisplayDiscountedPrice || mainDisplayOriginalPrice, [mainDisplayDiscountedPrice, mainDisplayOriginalPrice]);
    const basePriceForCalculations = useMemo(() => (hasDiscount && typeof discountedPriceValue === 'number') ? discountedPriceValue : (typeof originalPriceValue === 'number') ? originalPriceValue : null, [hasDiscount, discountedPriceValue, originalPriceValue]);

    // Average rating calculation now primarily uses fetched reviews
    const averageRating = useMemo(() => {
        if (reviews && reviews.length > 0) {
            const sum = reviews.reduce((acc, review) => acc + (review.rating || 0), 0);
            const avg = sum / reviews.length;
            return isNaN(avg) ? null : avg; // Calculate from fetched reviews
        }
        if (typeof product?.rating === 'number') return product.rating; // Fallback to pre-calculated if reviews fail/empty
        return null; // No rating available
    }, [reviews, product?.rating]); // Depends on fetched reviews and product data fallback

    const soldCount = useMemo(() => product?.soldCount ?? 0, [product?.soldCount]);
    const displaySoldCount = useMemo(() => soldCount > 999 ? `${(soldCount / 1000).toFixed(1)}k` : soldCount.toString(), [soldCount]);

    // Memoized reviews from state (includes user info now)
    const allReviews = useMemo(() => reviews, [reviews]);
    const displayReviews = useMemo(() => showAllReviews ? allReviews : allReviews.slice(0, MAX_INITIAL_REVIEWS), [showAllReviews, allReviews]);

    const hasLoadedBnplOption = useMemo(() => product?.bnplAvailable === true && !isLoadingPlans && Array.isArray(product.BNPLPlans) && product.BNPLPlans.length > 0, [product?.bnplAvailable, product?.BNPLPlans, isLoadingPlans]);
    const bnplPlanGroups = useMemo(() => { /* ... (BNPL grouping logic remains the same) ... */
         if (!hasLoadedBnplOption || !product?.BNPLPlans) return {};
         return product.BNPLPlans.reduce((acc, plan) => {
             if (!plan || typeof plan !== 'object') return acc;
             const type = ['Installment', 'BNPL', 'PayLater'].includes(plan.planType) ? 'BNPL Plans'
                          : plan.planType === 'Fixed Duration' ? 'Fixed Duration Plans' : 'Other Plans';
             if (!acc[type]) acc[type] = [];
             acc[type].push(plan);
             return acc;
         }, {});
    }, [hasLoadedBnplOption, product?.BNPLPlans]);
    // --- End Memos ---


    // --- Handlers --- (Most handlers remain the same)
    const toggleWishlist = () => setIsWishlisted(!isWishlisted);
    const shareProduct = async () => { /* ... (Share logic remains the same) ... */
         if (!product || !product.name) return;
         try {
             const message = `Check out this product: ${product.name}${mainFinalDisplayPrice ? ` - ${mainFinalDisplayPrice}` : ''}`;
             const url = product?.productPageUrl; // Add deep link or web URL if available
             await Share.share({ message, ...(url && { url }) });
         } catch (error) { console.error('Error sharing product:', error.message); }
    };
    const onViewableItemsChanged = useRef(({ viewableItems }) => { if (viewableItems && viewableItems.length > 0 && viewableItems[0].index != null) { setActiveIndex(viewableItems[0].index); } }).current;
    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
    const handlePlanSelection = (plan) => { /* ... (Plan selection logic remains the same) ... */
         if (!plan || !plan.id) return;
         if (selectedBnplPlan?.id === plan.id) { setSelectedBnplPlan(null); if (selectedPaymentMethod === 'BNPL') setSelectedPaymentMethod(null); }
         else { setSelectedBnplPlan(plan); setSelectedPaymentMethod('BNPL'); }
    };
    const openPaymentModal = (type) => { /* ... (Open modal logic remains the same) ... */
         if (!product || !product.id || isProcessingCart) return;
         if (selectedBnplPlan) setSelectedPaymentMethod('BNPL'); // Keep BNPL if pre-selected
         else setSelectedPaymentMethod(null); // Start fresh otherwise
         setActionType(type);
         setIsPaymentModalVisible(true);
    };

    // Firestore cart update logic remains largely the same
    const updateFirestoreCart = async (cartItemDetails) => { /* ... (Cart update logic remains the same) ... */
         const auth = getAuth();
         const user = auth.currentUser;
         if (!user) { Alert.alert("Login Required", "Please log in to add items to your cart."); return false; }
         if (!cartItemDetails?.productId || typeof cartItemDetails?.priceAtAddition !== 'number') { Alert.alert("Error", "Invalid item data."); return false; }
         if (cartItemDetails.paymentMethod === 'BNPL' && !cartItemDetails.bnplPlan?.id) { Alert.alert("Error", "BNPL plan details missing."); return false; }
         const cartDocRef = doc(db, "Carts", user.uid);
         console.log(`Updating cart for user: ${user.uid}, Product: ${cartItemDetails.productId}, Method: ${cartItemDetails.paymentMethod}`);
         try {
             const cartSnap = await getDoc(cartDocRef);
             if (cartSnap.exists()) {
                 const cartData = cartSnap.data(); const items = cartData.items || [];
                 let updatedItems = [...items]; let itemFoundAndUpdated = false;
                 if (cartItemDetails.paymentMethod === 'COD') { /* ... (COD quantity update) ... */
                    const existingIndex = items.findIndex(item => item.productId === cartItemDetails.productId && item.paymentMethod === 'COD');
                    if (existingIndex > -1) { updatedItems[existingIndex] = { ...items[existingIndex], quantity: (items[existingIndex].quantity || 0) + 1 }; itemFoundAndUpdated = true; console.log("COD Item quantity updated."); }
                 } else if (cartItemDetails.paymentMethod === 'BNPL') { /* ... (BNPL quantity/conflict check) ... */
                    const planIdToAdd = cartItemDetails.bnplPlan.id;
                    const existingIndex = items.findIndex(item => item.productId === cartItemDetails.productId && item.paymentMethod === 'BNPL' && item.bnplPlan?.id === planIdToAdd);
                    if (existingIndex > -1) { updatedItems[existingIndex] = { ...items[existingIndex], quantity: (items[existingIndex].quantity || 0) + 1 }; itemFoundAndUpdated = true; console.log("BNPL Item quantity updated."); }
                    else { const conflictExists = items.some(item => item.productId === cartItemDetails.productId && item.paymentMethod === 'BNPL'); if (conflictExists) { Alert.alert("Plan Conflict", `${cartItemDetails.productName} is already in your cart with a different BNPL plan.`); return false; } }
                 }
                 if (itemFoundAndUpdated) { await updateDoc(cartDocRef, { items: updatedItems, lastUpdated: serverTimestamp() }); }
                 else { await updateDoc(cartDocRef, { items: arrayUnion({ ...cartItemDetails, quantity: 1 }), lastUpdated: serverTimestamp() }); console.log("New item added to cart."); }
                 return true;
             } else { /* ... (Create new cart) ... */
                 const initialCartItem = { ...cartItemDetails, quantity: 1, addedAt: serverTimestamp() };
                 await setDoc(cartDocRef, { userId: user.uid, items: [initialCartItem], createdAt: serverTimestamp(), lastUpdated: serverTimestamp() });
                 console.log("New cart created and item added."); return true;
             }
         } catch (error) { console.error("Error updating/creating Firestore cart:", error); Alert.alert("Error", "Could not update your cart."); return false; }
    };

    const triggerAddedToCartPopup = () => { /* ... (Popup animation logic remains the same) ... */
        if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
        popupOpacity.setValue(0); setShowAddedToCartPopup(true);
        Animated.timing(popupOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        popupTimeoutRef.current = setTimeout(() => {
            Animated.timing(popupOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setShowAddedToCartPopup(false));
        }, 2000);
    };

    const proceedDirectlyWithCOD_AddToCart = async () => { /* ... (Direct COD add logic remains the same) ... */
         if (isProcessingCart || !product?.id) return;
         setActionType('addToCart'); setIsProcessingCart(true);
         const priceForCart = basePriceForCalculations;
         if (priceForCart === null) { Alert.alert("Error", "Price information missing."); setIsProcessingCart(false); setActionType(null); return; }
         const cartItem = { productId: product.id, productName: product.name || 'Unnamed Product', image: galleryItems.find(item => item.type === 'image' && !item.isPlaceholder)?.url || placeholderImage, paymentMethod: 'COD', priceAtAddition: Number(priceForCart.toFixed(2)), bnplPlan: null };
         let success = false;
         try { success = await updateFirestoreCart(cartItem); }
         catch (e) { console.error("Error during direct COD AddToCart:", e); success = false; }
         finally { setIsProcessingCart(false); setActionType(null); }
         if (success) triggerAddedToCartPopup();
    };

    const handleAddToCart = () => { /* ... (Add to cart logic remains the same) ... */
         if (isProcessingCart || !product?.id) return;
         const canCOD = product.codAvailable === true; const canBNPL = hasLoadedBnplOption;
         if (!canCOD && !canBNPL) { Alert.alert("Payment Unavailable", "No payment options available."); return; }
         if (canCOD && !canBNPL) proceedDirectlyWithCOD_AddToCart();
         else openPaymentModal('addToCart');
    };

    const handleBuyNow = () => { /* ... (Buy now logic remains the same) ... */
         if (isProcessingCart || !product?.id) return;
         setActionType('buyNow');
         const canCOD = product.codAvailable === true; const canBNPL = hasLoadedBnplOption;
         if (!canCOD && !canBNPL) { Alert.alert("Payment Unavailable", "No payment options available."); setActionType(null); return; }
         if (canCOD && !canBNPL) { /* ... (Direct COD Buy Now -> Checkout) ... */
             console.log("Buy Now with COD only"); setIsProcessingCart(true);
             const priceForCheckout = basePriceForCalculations;
             if (priceForCheckout === null) { Alert.alert("Error", "Price information missing."); setIsProcessingCart(false); setActionType(null); return; }
             const checkoutItem = { id: product.id, name: product.name || 'Unnamed Product', image: galleryItems.find(item => item.type === 'image' && !item.isPlaceholder)?.url || placeholderImage, quantity: 1, price: Number(priceForCheckout.toFixed(2)), paymentMethod: 'COD', bnplPlan: null };
             console.log("Navigating to CheckoutScreen:", checkoutItem);
             setTimeout(() => { navigation.navigate('CheckoutScreen', { cartItems: [checkoutItem], totalPrice: checkoutItem.price }); setIsProcessingCart(false); setActionType(null); }, 50);
         } else { console.log("Buy Now requires payment selection"); openPaymentModal('buyNow'); }
    };

    const handleChat = () => Alert.alert("Chat", "Chat functionality not implemented.");
    const handleSeeMoreReviews = () => setShowAllReviews(true);
    const handleSeeLessReviews = () => setShowAllReviews(false);

    const handleProceedWithPayment = async () => { /* ... (Modal proceed logic remains the same) ... */
         if (isProcessingCart) return;
         if (!selectedPaymentMethod) { Alert.alert("Selection Required", "Please select a payment method."); return; }
         if (selectedPaymentMethod === 'BNPL' && !selectedBnplPlan) { Alert.alert("Selection Required", "Please select a BNPL plan."); return; }
         if (!product?.id || basePriceForCalculations === null) { Alert.alert("Error", "Product or price details missing."); return; }
         const currentActionType = actionType; setIsProcessingCart(true); setIsPaymentModalVisible(false);
         let finalPrice = basePriceForCalculations; let bnplDetailsForAction = null;
         if (selectedPaymentMethod === 'BNPL' && selectedBnplPlan) { /* ... (Calculate final price with interest) ... */
            const interestRateValue = typeof selectedBnplPlan.interestRate === 'number' ? selectedBnplPlan.interestRate : 0;
            finalPrice = basePriceForCalculations * (1 + (interestRateValue / 100));
            const duration = typeof selectedBnplPlan.duration === 'number' ? selectedBnplPlan.duration : null;
            const planType = selectedBnplPlan.planType; let calculatedMonthly = null;
            if (duration && duration > 0 && planType !== 'Fixed Duration') { calculatedMonthly = Number((finalPrice / duration).toFixed(2)); }
            bnplDetailsForAction = { id: selectedBnplPlan.id, name: selectedBnplPlan.planName || 'Unnamed Plan', duration: duration, interestRate: interestRateValue, calculatedMonthly: calculatedMonthly, planType: planType };
         }
         const itemDetailsForAction = { productId: product.id, productName: product.name || 'Unnamed Product', image: galleryItems.find(item => item.type === 'image' && !item.isPlaceholder)?.url || placeholderImage, quantity: 1, paymentMethod: selectedPaymentMethod, priceAtAddition: Number(finalPrice.toFixed(2)), bnplPlan: bnplDetailsForAction };
         if (currentActionType === 'addToCart') { /* ... (Modal -> Add To Cart) ... */
            console.log("Proceeding with Add to Cart from modal:", itemDetailsForAction); let success = false;
            try { success = await updateFirestoreCart(itemDetailsForAction); } catch (e) { console.error("Error during Modal AddToCart:", e); success = false; } finally { setIsProcessingCart(false); setActionType(null); }
            if (success) triggerAddedToCartPopup();
         } else if (currentActionType === 'buyNow') { /* ... (Modal -> Buy Now -> Checkout) ... */
            console.log("Proceeding with Buy Now from modal, preparing checkout data:", itemDetailsForAction);
            const checkoutItem = { id: itemDetailsForAction.productId, name: itemDetailsForAction.productName, image: itemDetailsForAction.image, quantity: itemDetailsForAction.quantity, price: itemDetailsForAction.priceAtAddition, paymentMethod: itemDetailsForAction.paymentMethod, bnplPlan: itemDetailsForAction.bnplPlan };
            console.log("Navigating to CheckoutScreen from Modal:", checkoutItem);
            setTimeout(() => { navigation.navigate('CheckoutScreen', { cartItems: [checkoutItem], totalPrice: checkoutItem.price }); setIsProcessingCart(false); setActionType(null); }, 50);
         } else { console.warn("Invalid action type:", currentActionType); setIsProcessingCart(false); setActionType(null); Alert.alert("Error", "An unexpected error occurred."); }
    };
    // --- End Handlers ---


    // --- Render Functions ---
    const formatCurrency = (value) => typeof value === 'number' ? `${CURRENCY_SYMBOL} ${value.toFixed(0)}` : null;

    // Gallery rendering remains the same
    const renderGalleryItem = ({ item }) => { /* ... */
         if (item.isPlaceholder || !item.url) return <Image source={placeholderImage} style={styles.galleryItemImage} resizeMode="contain" />;
         if (item.type === 'image') return <Image source={{ uri: item.url }} style={styles.galleryItemImage} resizeMode="contain" onError={(e) => console.error(`Img Load Err: ${item.url}`, e.nativeEvent.error)} />;
         if (item.type === 'video') return <Video ref={(ref) => videoRefs.current[item.id] = ref} style={styles.galleryItemVideo} source={{ uri: item.url }} useNativeControls resizeMode={ResizeMode.CONTAIN} onError={(e) => console.error(`Vid Load Err: ${item.url}`, e)} />;
         return null;
    };
    const renderTextPagination = () => { /* ... */
         if (galleryItems.length <= 1) return null;
         return <View style={styles.paginationTextContainer}><Text style={styles.paginationText}>{activeIndex + 1}/{galleryItems.length}</Text></View>;
    };

    // Price section rendering remains the same
    const renderPriceSection = () => { /* ... */
         if (!mainFinalDisplayPrice) return <Text style={styles.noPriceText}>Price unavailable</Text>;
         return (<View style={styles.priceRow}><Text style={styles.finalPrice}>{mainFinalDisplayPrice}</Text>{hasDiscount && mainDisplayOriginalPrice && <Text style={styles.originalPrice}>{mainDisplayOriginalPrice}</Text>}</View>);
    };

    // BNPL Plans section rendering remains the same
    const renderBnplPlansSection = () => { /* ... */
        if (isLoadingPlans) return <View style={styles.bnplSectionContainer}><Text style={styles.sectionTitle}>Installment Options</Text><ActivityIndicator style={{marginTop: 20}} size="small" color={AccentColor} /></View>;
        if (!hasLoadedBnplOption || basePriceForCalculations === null) return null;
        if (!product?.BNPLPlans || product.BNPLPlans.length === 0) { if (product.bnplAvailable) return <View style={styles.bnplSectionContainer}><Text style={styles.sectionTitle}>Installment Options</Text><Text style={styles.noPaymentOptionsText}>No installment plans found.</Text></View>; return null; }
        const renderSinglePlanCard = (plan, index, arrayLength) => { /* ... (Plan card details rendering) ... */
            if (!plan?.id) return null;
            const isSelectedOnMain = selectedBnplPlan?.id === plan.id; const planName = plan.planName || 'Unnamed Plan'; const durationMonths = typeof plan.duration === 'number' ? plan.duration : null; const interestRateValue = typeof plan.interestRate === 'number' ? plan.interestRate : null; const interestRateDisplay = typeof interestRateValue === 'number' ? `${interestRateValue.toFixed(1)}%` : 'N/A'; const planType = plan.planType || 'General'; const isFixedDuration = planType === 'Fixed Duration'; let totalPriceNumeric = null, formattedTotalPrice = null, calculatedMonthlyPayment = null; const basePrice = basePriceForCalculations;
            if (typeof interestRateValue === 'number' && typeof basePrice === 'number') { totalPriceNumeric = basePrice * (1 + (interestRateValue / 100)); formattedTotalPrice = formatCurrency(totalPriceNumeric); } else if (interestRateValue === 0 && typeof basePrice === 'number') { totalPriceNumeric = basePrice; formattedTotalPrice = formatCurrency(totalPriceNumeric); } const numberOfInstallments = !isFixedDuration && durationMonths ? durationMonths : 1; if (!isFixedDuration && durationMonths && totalPriceNumeric) { calculatedMonthlyPayment = formatCurrency(totalPriceNumeric / durationMonths); }
            return ( <TouchableOpacity key={plan.id} style={[styles.bnplPlanCard, index < arrayLength - 1 && styles.bnplPlanCardSeparator, isSelectedOnMain && styles.bnplPlanCardSelected]} onPress={() => handlePlanSelection(plan)} activeOpacity={0.7}>
                    <View style={styles.bnplPlanHeader}><MaterialIcons name="payments" size={18} color={BnplPlanIconColor} style={styles.bnplPlanIcon} /><Text style={styles.bnplPlanNameText}>{planName}</Text></View>
                    <View style={styles.bnplPlanDetails}>
                         <View style={styles.detailRow}><MaterialIcons name="info-outline" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} /><Text style={styles.bnplPlanDetailText}>Type: <Text style={styles.bnplPlanDetailValue}>{planType}</Text></Text></View>
                         {durationMonths && <View style={styles.detailRow}><MaterialIcons name="schedule" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} /><Text style={styles.bnplPlanDetailText}>Duration:<Text style={styles.bnplPlanDetailValue}> {durationMonths} {durationMonths === 1 ? 'Month' : 'Months'}</Text>{isFixedDuration ? <Text style={styles.bnplPlanDetailValue}> (1 Payment)</Text> : <Text style={styles.bnplPlanDetailValue}> / {numberOfInstallments} Installments</Text>}</Text></View>}
                         {calculatedMonthlyPayment && <View style={styles.detailRow}><MaterialIcons name="calculate" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} /><Text style={styles.bnplPlanDetailText}>Est. Monthly: <Text style={styles.bnplPlanDetailValue}>{calculatedMonthlyPayment}</Text></Text></View>}
                         {interestRateValue !== null && <View style={styles.detailRow}><MaterialIcons name="percent" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} /><Text style={styles.bnplPlanDetailText}>Interest: <Text style={styles.bnplPlanDetailValue}>{interestRateDisplay}</Text></Text></View>}
                         {formattedTotalPrice && <View style={styles.detailRow}><MaterialIcons name="monetization-on" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} /><Text style={styles.bnplPlanDetailText}>Total Price: <Text style={styles.bnplPlanDetailValue}>{formattedTotalPrice}</Text></Text></View>}
                    </View>
                </TouchableOpacity> );
        };
        const groupKeys = Object.keys(bnplPlanGroups);
        return ( <View style={styles.bnplSectionContainer}><Text style={styles.sectionTitle}>Installment Options</Text>{groupKeys.map(groupTitle => ( <View key={groupTitle} style={styles.bnplGroupContainer}><Text style={styles.bnplGroupTitle}>{groupTitle}</Text>{bnplPlanGroups[groupTitle].map((plan, index, arr) => renderSinglePlanCard(plan, index, arr.length))}</View> ))}</View> );
    };

    // *** UPDATED: Renders a single review card with profile image ***
    const renderReviewCard = ({ item, index }) => {
        if (!item?.id) return null;
        const isLastReviewOverall = allReviews.findIndex(r => r.id === item.id) === allReviews.length - 1;
        const shouldHideBorder = isLastReviewOverall && (showAllReviews || allReviews.length <= MAX_INITIAL_REVIEWS);

        // Determine the image source: fetched profile image or dummy fallback
        const profileImageSource = item.profileImage ? { uri: item.profileImage } : dummyProfilePic;

        return (
            <View style={[ styles.reviewCard, shouldHideBorder && { borderBottomWidth: 0 } ]}>
                <View style={styles.reviewHeader}>
                    {/* Profile Image */}
                    <Image
                        source={profileImageSource}
                        style={styles.reviewerImage}
                        onError={(e) => {
                            console.log(`Failed to load profile image URI: ${item.profileImage}. Falling back to dummy.`);
                            // In case URI exists but fails, you might force a state update
                            // or just let the dummyPic show via the initial check.
                            // For simplicity, we rely on the initial check mostly.
                        }}
                    />
                    {/* Text Content Container */}
                    <View style={styles.reviewHeaderTextContainer}>
                         {/* Rating */}
                        <View style={styles.reviewHeaderRating}>
                            {[...Array(5)].map((_, i) => <MaterialIcons key={`star-${item.id}-${i}`} name="star" size={16} color={i < (item.rating || 0) ? StarColor : PlaceholderStarColor} />)}
                        </View>
                         {/* Name and Date */}
                        <Text style={styles.reviewerName} numberOfLines={1}>
                            {item.name} {/* Use the fetched name */}
                            {item.date && <Text style={styles.reviewDate}> · {item.date}</Text>}
                        </Text>
                    </View>
                </View>
                 {/* Comment Text */}
                <Text style={styles.reviewText}>{item.comment || 'No comment provided.'}</Text>
            </View>
        );
    };

    // Review section content rendering remains the same structurally
    const renderReviewsSectionContent = () => { /* ... */
         if (isLoadingReviews) return <ActivityIndicator style={{ marginVertical: 20 }} size="small" color={AccentColor} />;
         if (reviewsError) return <Text style={[styles.errorText, { marginTop: 15, marginBottom: 15 }]}>{reviewsError}</Text>;
         if (!isLoadingReviews && allReviews.length === 0) return <Text style={styles.noReviewsText}>No reviews yet for this product.</Text>;
         return (<>
             <FlatList data={displayReviews} renderItem={renderReviewCard} keyExtractor={(item) => item.id} scrollEnabled={false} />
             {allReviews.length > MAX_INITIAL_REVIEWS && ( <View>
                 {!showAllReviews ? ( <TouchableOpacity style={styles.seeMoreButton} onPress={handleSeeMoreReviews} activeOpacity={0.7}><Text style={styles.seeMoreButtonText}>See More Reviews</Text><MaterialIcons name="keyboard-arrow-down" size={20} color={AccentColor} /></TouchableOpacity> )
                  : ( <TouchableOpacity style={styles.seeMoreButton} onPress={handleSeeLessReviews} activeOpacity={0.7}><Text style={styles.seeMoreButtonText}>See Less</Text><MaterialIcons name="keyboard-arrow-up" size={20} color={AccentColor} /></TouchableOpacity> )}
             </View> )}
         </>);
    };

    // Related product card rendering remains the same
    const renderRelatedProductCard = ({ item }) => { /* ... */
        if (item.isPlaceholder || !item?.id) return <View style={styles.relatedProductCardPlaceholder} />;
        const itemHasDiscount = typeof item.originalPrice === 'number' && typeof item.discountedPrice === 'number' && item.discountedPrice < item.originalPrice; const op = formatCurrency(item.originalPrice); const dp = formatCurrency(item.discountedPrice); const finalPriceDisplay = dp || op; const originalPriceDisplay = itemHasDiscount ? op : null; const bnplAvailable = item.bnplAvailable === true; const codAvailable = item.codAvailable === true;
        return ( <TouchableOpacity style={styles.relatedProductCard} onPress={() => !isProcessingCart && navigation.push('ProductDetails', { productId: item.id })} activeOpacity={0.8} disabled={isProcessingCart}>
             <Image source={item.image ? { uri: item.image } : placeholderImage} style={styles.relatedCardImage} resizeMode="contain" onError={() => console.log(`Rel Img Err: ${item.id}`)} />
             <Text style={styles.relatedCardName} numberOfLines={1}>{item.name || ''}</Text>
             <View style={styles.relatedCardPriceContainer}>{finalPriceDisplay ? <Text style={styles.relatedCardDiscountedPrice}>{finalPriceDisplay}</Text> : <View style={styles.relatedCardPricePlaceholder} />}{originalPriceDisplay && <Text style={[styles.relatedCardProductPrice, styles.relatedCardStrikethroughPrice]}>{originalPriceDisplay}</Text>}</View>
             {item.description ? <Text style={styles.relatedCardDescription} numberOfLines={2}>{item.description}</Text> : <View style={styles.relatedCardDescriptionPlaceholder}/> }
             <View style={styles.relatedCardBadgesContainer}>{bnplAvailable ? <View style={styles.relatedCardBnplBadge}><MaterialIcons name="schedule" size={14} color={BnplBadgeText} /><Text style={styles.relatedCardBnplText}>BNPL Available</Text></View> : codAvailable ? <View style={styles.relatedCardCodBadge}><MaterialIcons name="local-shipping" size={14} color={CodBadgeText} /><Text style={styles.relatedCardCodText}>COD Available</Text></View> : <View style={styles.relatedCardBadgePlaceholder} />}</View>
         </TouchableOpacity> );
    };

    // Related products section rendering remains the same
    const renderRelatedProductsSection = () => { /* ... */
        if (loadingRelatedProducts) return <View style={styles.relatedLoadingContainer}><ActivityIndicator size="large" color={AccentColor} /><Text style={styles.relatedLoadingText}>Loading Related Products...</Text></View>;
        if (!relatedProducts || relatedProducts.filter(p => !p.isPlaceholder).length === 0) return null;
        return ( <View style={styles.relatedProductsContainer}><Text style={styles.relatedProductsTitle}>Related Products</Text><FlatList data={relatedProducts} renderItem={renderRelatedProductCard} keyExtractor={(item) => item.id} numColumns={NUM_COLUMNS} scrollEnabled={false} contentContainerStyle={styles.relatedProductsGridContainer} /></View> );
    };

    // Payment modal rendering remains the same
    const renderPaymentModal = () => { /* ... */
        if (!product) return null;
        const modalProceedDisabled = isProcessingCart || !selectedPaymentMethod || (selectedPaymentMethod === 'BNPL' && !selectedBnplPlan); const hasCodOption = product.codAvailable === true; const hasBnplOptionModal = hasLoadedBnplOption; const formatModCur = (value) => typeof value === 'number' ? `${CURRENCY_SYMBOL} ${value.toFixed(0)}` : null;
        const renderModalPlanRow = (plan) => { /* ... (Modal plan row details) ... */
            if (!plan?.id || basePriceForCalculations === null) return null; const isSelected = selectedBnplPlan?.id === plan.id; const planName = plan.planName || 'Unnamed Plan'; const duration = typeof plan.duration === 'number' ? plan.duration : null; const interestRateValue = typeof plan.interestRate === 'number' ? plan.interestRate : null; const interestRateDisplay = typeof interestRateValue === 'number' ? `${interestRateValue.toFixed(1)}%` : 'N/A'; const planType = plan.planType || 'General'; const isFixedDurationPlan = planType === 'Fixed Duration'; let totalPriceNumericModal = null, formattedTotalPriceWithInterestModal = null, calculatedMonthlyPaymentModal = null; const basePriceModal = basePriceForCalculations;
            if (typeof interestRateValue === 'number' && basePriceModal !== null) { totalPriceNumericModal = basePriceModal * (1 + (interestRateValue / 100)); formattedTotalPriceWithInterestModal = formatModCur(totalPriceNumericModal); } else if (interestRateValue === 0 && basePriceModal !== null) { totalPriceNumericModal = basePriceModal; formattedTotalPriceWithInterestModal = formatModCur(totalPriceNumericModal); } const numberOfInstallmentsModal = !isFixedDurationPlan && duration ? duration : 1; if (!isFixedDurationPlan && duration && totalPriceNumericModal) { calculatedMonthlyPaymentModal = formatModCur(totalPriceNumericModal / duration); }
            return ( <TouchableOpacity key={plan.id} style={[styles.bnplPlanOption, isSelected && styles.bnplPlanOptionSelected]} onPress={() => handlePlanSelection(plan)} activeOpacity={0.7}>
                    <Text style={styles.bnplPlanNameModal}>{planName}</Text>
                    <View style={styles.modalPlanDetailsContainer}>
                         <View style={styles.modalDetailRow}><MaterialIcons name="info-outline" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} /><Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Type: </Text><Text style={styles.modalPlanDetailValue}>{planType}</Text></Text></View>
                         {duration && <View style={styles.modalDetailRow}><MaterialIcons name="schedule" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} /><Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Duration: </Text><Text style={styles.modalPlanDetailValue}>{duration} {duration === 1 ? 'Month' : 'Months'}</Text>{isFixedDurationPlan ? <Text style={styles.modalPlanDetailValue}> (1 Payment)</Text> : <Text style={styles.modalPlanDetailValue}> / {numberOfInstallmentsModal} Inst.</Text>}</Text></View>}
                         {calculatedMonthlyPaymentModal && <View style={styles.modalDetailRow}><MaterialIcons name="calculate" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} /><Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Est. Monthly: </Text><Text style={styles.modalPlanDetailValue}>{calculatedMonthlyPaymentModal}</Text></Text></View>}
                         {interestRateValue !== null && <View style={styles.modalDetailRow}><MaterialIcons name="percent" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} /><Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Interest: </Text><Text style={styles.modalPlanDetailValue}>{interestRateDisplay}</Text></Text></View>}
                         {formattedTotalPriceWithInterestModal && <View style={styles.modalDetailRow}><MaterialIcons name="monetization-on" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} /><Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Total Price: </Text><Text style={styles.modalPlanDetailValue}>{formattedTotalPriceWithInterestModal}</Text></Text></View>}
                    </View>
                </TouchableOpacity> );
        };
        const closeModal = () => !isProcessingCart && setIsPaymentModalVisible(false);
        return ( <Modal visible={isPaymentModalVisible} transparent={true} animationType="slide" onRequestClose={closeModal}>
                <Pressable style={styles.modalBackdrop} onPressOut={closeModal} />
                <View style={styles.modalContainer}>
                    <TouchableOpacity style={styles.modalCloseButton} onPress={closeModal} disabled={isProcessingCart}><MaterialIcons name="close" size={24} color={TextColorSecondary} /></TouchableOpacity>
                    <Text style={styles.modalTitle}>Select Payment Option</Text>
                    <View style={styles.paymentOptionsRowContainer}>{hasCodOption && <Pressable style={({ pressed }) => [styles.paymentOptionButtonRow, selectedPaymentMethod === 'COD' && styles.paymentOptionSelected, pressed && !isProcessingCart && styles.buttonPressed]} onPress={() => { setSelectedPaymentMethod('COD'); setSelectedBnplPlan(null); }} disabled={isProcessingCart}><Text style={[styles.paymentOptionTextRow, selectedPaymentMethod === 'COD' && styles.paymentOptionTextSelected]}>Cash on Delivery</Text></Pressable>}{hasBnplOptionModal && <Pressable style={({ pressed }) => [styles.paymentOptionButtonRow, selectedPaymentMethod === 'BNPL' && styles.paymentOptionSelected, pressed && !isProcessingCart && styles.buttonPressed]} onPress={() => setSelectedPaymentMethod('BNPL')} disabled={isProcessingCart}><Text style={[styles.paymentOptionTextRow, selectedPaymentMethod === 'BNPL' && styles.paymentOptionTextSelected]}>Buy Now Pay Later</Text></Pressable>}</View>
                    {!hasCodOption && !hasBnplOptionModal && <Text style={styles.noPaymentOptionsText}>No payment options available.</Text>}
                    {selectedPaymentMethod === 'BNPL' && hasBnplOptionModal && ( <View style={styles.bnplPlanSelectionContainer}><Text style={styles.modalSubtitle}>Select Your Plan</Text>{isLoadingPlans ? <ActivityIndicator style={{marginVertical: 20}} size="small" color={AccentColor} /> : ( <ScrollView style={styles.bnplPlanScrollView} nestedScrollEnabled={true}>{Object.keys(bnplPlanGroups).length > 0 ? Object.entries(bnplPlanGroups).map(([groupTitle, plans]) => ( <View key={groupTitle} style={styles.modalPlanGroup}><Text style={styles.modalPlanGroupTitle}>{groupTitle}</Text>{plans.map(renderModalPlanRow)}</View> )) : <Text style={styles.noPaymentOptionsText}>No BNPL plans found.</Text>}</ScrollView> )}</View> )}
                    {(hasCodOption || hasBnplOptionModal) && <Pressable style={({ pressed }) => [styles.proceedButton, modalProceedDisabled && styles.proceedButtonDisabled, pressed && !modalProceedDisabled && styles.buttonPressed]} onPress={handleProceedWithPayment} disabled={modalProceedDisabled}>{isProcessingCart ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.proceedButtonText}>{actionType === 'addToCart' ? 'Confirm & Add to Cart' : 'Confirm & Proceed'}</Text>}</Pressable>}
                </View>
            </Modal> );
    };
    // --- End Render Functions ---


    // --- Loading / Error States --- (Remain the same)
    if (isLoadingProduct) { /* ... */
         return (<SafeAreaView style={styles.safeArea}><StatusBar barStyle="dark-content" backgroundColor={AppBackgroundColor} /><View style={styles.loadingContainer}><ActivityIndicator size="large" color={AccentColor} /><Text style={styles.errorText}>Loading Product Details...</Text></View></SafeAreaView>);
    }
    if (!product) { /* ... */
         return (<SafeAreaView style={styles.safeArea}><StatusBar barStyle="dark-content" backgroundColor={AppBackgroundColor} /><View style={styles.loadingContainer}><MaterialIcons name="error-outline" size={40} color={TextColorSecondary} /><Text style={styles.errorText}>Product details could not be loaded.</Text><TouchableOpacity onPress={() => navigation.goBack()} style={{marginTop: 20}}><Text style={{color: AccentColor}}>Go Back</Text></TouchableOpacity></View></SafeAreaView>);
    }


    // --- Main Return ---
    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
            <StatusBar barStyle="dark-content" backgroundColor={AppBackgroundColor} />

             {showAddedToCartPopup && <Animated.View style={[styles.addedPopup, { opacity: popupOpacity }]}><MaterialIcons name="check-circle" size={18} color={PopupTextColor} style={{ marginRight: 8 }}/><Text style={styles.popupText}>Added to Cart!</Text></Animated.View>}

            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                {/* Gallery */}
                <View style={styles.galleryWrapper}>
                    <FlatList ref={flatListRef} data={galleryItems} renderItem={renderGalleryItem} keyExtractor={(item) => item.id} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onViewableItemsChanged={onViewableItemsChanged} viewabilityConfig={viewabilityConfig} scrollEventThrottle={16} style={styles.galleryFlatList} initialNumToRender={1} maxToRenderPerBatch={1} windowSize={3} />
                    <View style={styles.galleryOverlayContainer}>{renderTextPagination()}</View>
                </View>

                {/* Content */}
                <View style={styles.contentContainer}>
                    <Text style={styles.productName}>{product.name}</Text>
                    {/* Rating/Sold */}
                    <View style={styles.reviewSectionHeaderInline}>
                        <View style={styles.reviewOverallRating}>
                            {typeof averageRating === 'number' ? (
                                <>
                                    <MaterialIcons name="star" size={16} color={StarColor} style={{ marginRight: 4 }}/>
                                    <Text style={styles.reviewOverallRatingText}>{averageRating.toFixed(1)}</Text>
                                </>
                            ) : (
                                <Text style={styles.reviewOverallRatingText}>-</Text> // Show dash if no rating
                            )}
                        </View>
                        <Text style={styles.soldCountText}>{displaySoldCount} sold</Text>
                    </View>
                    {/* Price/Actions */}
                    <View style={styles.priceActionsRow}>
                        {renderPriceSection()}
                        <View style={styles.rightActionButtonsGroup}>
                            <TouchableOpacity onPress={toggleWishlist} style={styles.iconButton} activeOpacity={0.7}><MaterialIcons name={isWishlisted ? 'favorite' : 'favorite-border'} size={24} color={isWishlisted ? AccentColor : TextColorPrimary} /></TouchableOpacity>
                            <TouchableOpacity onPress={shareProduct} style={[styles.iconButton, { marginLeft: 10 }]} activeOpacity={0.7}><Feather name="share-2" size={22} color={TextColorPrimary} /></TouchableOpacity>
                        </View>
                    </View>
                    {/* Description */}
                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.descriptionText}>{product.description || 'No description available.'}</Text>
                    {/* BNPL Plans */}
                    {renderBnplPlansSection()}
                    {/* Reviews */}
                    <View style={styles.reviewSectionWrapper}>
                        <Text style={styles.sectionTitle}>Reviews ({isLoadingReviews ? '...' : allReviews.length})</Text>
                        {renderReviewsSectionContent()}
                    </View>
                </View>

                {/* Related Products */}
                {renderRelatedProductsSection()}
                 <View style={styles.relatedProductsBottomPadding} />
            </ScrollView>

            {/* Bottom Action Bar */}
            <View style={styles.buttonContainer}>
                 <TouchableOpacity style={[styles.bottomButtonBase, styles.chatButton, isProcessingCart && styles.buttonDisabledGeneric]} onPress={handleChat} activeOpacity={0.7} disabled={isProcessingCart}>
                     <MaterialIcons name="support-agent" size={22} color={ChatIconColor} style={{ marginBottom: 2 }}/><Text style={[styles.buttonText, styles.chatButtonText]}>Chat</Text>
                 </TouchableOpacity>
                 <Pressable style={({ pressed }) => [styles.bottomButtonBase, styles.cartButton, isProcessingCart && styles.buttonDisabledGeneric, pressed && !isProcessingCart && styles.buttonPressed]} onPress={handleAddToCart} disabled={isProcessingCart}>
                     {isProcessingCart && actionType === 'addToCart' ? <ActivityIndicator size="small" color={BrightRedButtonColor} /> : <Text style={[styles.buttonText, styles.cartButtonText]}>Add to Cart</Text>}
                 </Pressable>
                 <Pressable style={({ pressed }) => [styles.buyButtonContainer, isProcessingCart && styles.buttonDisabledGeneric, pressed && !isProcessingCart && styles.buttonPressed]} onPress={handleBuyNow} disabled={isProcessingCart}>
                     <LinearGradient colors={[BrightRedButtonColor, BrightRedGradientEndColor]} style={styles.buyButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
                          {isProcessingCart && actionType === 'buyNow' ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={[styles.buttonText, styles.buyButtonText]}>Buy Now</Text>}
                     </LinearGradient>
                 </Pressable>
            </View>

            {/* Payment Modal */}
            {renderPaymentModal()}
        </SafeAreaView>
    );
}

// --- Styles ---
// Includes updates for review card layout
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