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
    Animated
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { getAuth } from 'firebase/auth';
import {
    collection, query, where, getDocs, limit, orderBy, documentId,
    doc, setDoc, updateDoc, arrayUnion, getDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';

// --- Constants (Assume these are correct) ---
const AppBackgroundColor = '#FFFFFF';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#666666';
const AccentColor = '#D32F2F'; // Primary Red
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
const ChatIconColor = '#424242';
const BnplBadgeBg = '#E3F2FD';
const BnplBadgeText = '#1565C0';
const CodBadgeBg = '#FFF3E0';
const CodBadgeText = '#EF6C00';
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

const placeholderImage = require('../../assets/p3.jpg');
const { width: screenWidth } = Dimensions.get('window');
const GALLERY_HEIGHT = screenWidth * 0.9;
const MAX_INITIAL_REVIEWS = 2;
const RELATED_PRODUCTS_LIMIT = 6;
const CURRENCY_SYMBOL = 'RS';
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
    const [isWishlisted, setIsWishlisted] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [showAllReviews, setShowAllReviews] = useState(false);
    const [relatedProducts, setRelatedProducts] = useState([]);
    const [loadingRelatedProducts, setLoadingRelatedProducts] = useState(true);
    const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
    const [selectedBnplPlan, setSelectedBnplPlan] = useState(null);
    const [actionType, setActionType] = useState(null);
    const [isProcessingCart, setIsProcessingCart] = useState(false);
    const [showAddedToCartPopup, setShowAddedToCartPopup] = useState(false);
    const popupOpacity = useRef(new Animated.Value(0)).current;
    // --- End State Variables ---

    // --- Refs ---
    const flatListRef = useRef(null);
    const videoRefs = useRef({});
    const popupTimeoutRef = useRef(null);
    // --- End Refs ---

    // --- Effects (Unchanged) ---
    useEffect(() => {
        const initialProductFromRoute = route.params?.product ?? null;
        const productIdFromRoute = route.params?.productId ?? null;
        const loadProductAndPlans = async (productData) => { if (!productData || !productData.id) { console.warn("loadProductAndPlans invalid data"); setIsLoadingProduct(false); setProduct(null); return; } const baseProduct = { ...productData, bnplAvailable: productData.paymentOption?.BNPL === true, codAvailable: productData.paymentOption?.COD === true, originalPrice: typeof productData.originalPrice === 'number' ? productData.originalPrice : null, discountedPrice: typeof productData.discountedPrice === 'number' ? productData.discountedPrice : null, BNPLPlanIDs: Array.isArray(productData.BNPLPlanIDs) ? productData.BNPLPlanIDs.filter(id => typeof id === 'string' && id.trim() !== '') : (Array.isArray(productData.BNPLPlans) ? productData.BNPLPlans.filter(id => typeof id === 'string' && id.trim() !== '') : []), BNPLPlans: Array.isArray(productData.BNPLPlans) && productData.BNPLPlans.length > 0 && typeof productData.BNPLPlans[0] === 'object' && productData.BNPLPlans[0] !== null ? productData.BNPLPlans : [], name: productData.name || 'Unnamed Product', description: productData.description || '', media: productData.media || {}, image: productData.image || productData.media?.images?.[0] || null, category: productData.category || 'Uncategorized', rating: typeof productData.rating === 'number' ? productData.rating : null, soldCount: typeof productData.soldCount === 'number' ? productData.soldCount : 0, reviews: Array.isArray(productData.reviews) ? productData.reviews : [], }; const needsPlanFetch = baseProduct.bnplAvailable && baseProduct.BNPLPlanIDs.length > 0 && baseProduct.BNPLPlans.length === 0; console.log(`Product ${baseProduct.id}: Init. Needs Fetch: ${needsPlanFetch}`); setProduct(baseProduct); setIsLoadingProduct(false); if (needsPlanFetch) { console.log(`Product ${baseProduct.id}: Fetching plans...`); setIsLoadingPlans(true); try { const planPromises = baseProduct.BNPLPlanIDs.map(planId => { if (!planId || typeof planId !== 'string') { console.warn(`Invalid Plan ID: ${planId}`); return Promise.resolve(null); } const planRef = doc(db, 'BNPL_plans', planId.trim()); return getDoc(planRef); }); const planSnapshots = await Promise.all(planPromises); const detailedPlans = planSnapshots .map(snap => snap?.exists() ? { id: snap.id, ...snap.data() } : null) .filter(plan => plan !== null); console.log(`Product ${baseProduct.id}: Fetched ${detailedPlans.length} plans.`); setProduct(prev => prev?.id === baseProduct.id ? { ...prev, BNPLPlans: detailedPlans } : prev); } catch (planError) { console.error(`Plan fetch error ${baseProduct.id}:`, planError); setProduct(prev => prev?.id === baseProduct.id ? { ...prev, BNPLPlans: [] } : prev); } finally { setIsLoadingPlans(false); } } else { setIsLoadingPlans(false); } }; setProduct(null); setIsLoadingProduct(true); setIsLoadingPlans(false); setRelatedProducts([]); setLoadingRelatedProducts(true); setSelectedBnplPlan(null); setSelectedPaymentMethod(null); setActiveIndex(0); setActionType(null); setIsProcessingCart(false); setShowAddedToCartPopup(false); if (initialProductFromRoute) { loadProductAndPlans(initialProductFromRoute); } else if (productIdFromRoute) { const fetchProductById = async () => { try { const productRef = doc(db, 'Products', productIdFromRoute); const docSnap = await getDoc(productRef); if (docSnap.exists()) { await loadProductAndPlans({ id: docSnap.id, ...docSnap.data() }); } else { console.error(`Product ID ${productIdFromRoute} not found.`); setProduct(null); setIsLoadingProduct(false); Alert.alert("Error", "Product not found."); } } catch (error) { console.error("Fetch by ID error:", error); setProduct(null); setIsLoadingProduct(false); Alert.alert("Error", "Failed to load product."); } }; fetchProductById(); } else { console.error("No product data/ID provided."); setIsLoadingProduct(false); setProduct(null); Alert.alert("Error", "Could not load product."); } return () => { if (popupTimeoutRef.current) { clearTimeout(popupTimeoutRef.current); } }; }, [route.params?.product, route.params?.productId]);
    useEffect(() => { if (!product || !product.id || !product.category || isLoadingProduct) { if (!isLoadingProduct && !product) { setLoadingRelatedProducts(false); } return; } const fetchRelated = async () => { console.log(`Fetching related for cat: ${product.category}, exclude: ${product.id}`); setLoadingRelatedProducts(true); setRelatedProducts([]); try { const q = query( collection(db, 'Products'), where('category', '==', product.category), where(documentId(), '!=', product.id), orderBy(documentId()), limit(RELATED_PRODUCTS_LIMIT) ); const querySnapshot = await getDocs(q); let fetched = querySnapshot.docs.map(docSnapshot => { const d = docSnapshot.data(); return { id: docSnapshot.id, name: d.name || 'Unnamed', description: d.description || '', category: d.category || 'Uncat', originalPrice: typeof d.originalPrice === 'number' ? d.originalPrice : null, discountedPrice: typeof d.discountedPrice === 'number' ? d.discountedPrice : null, image: d.media?.images?.[0] || d.image || null, media: d.media, paymentOption: d.paymentOption, BNPLPlanIDs: Array.isArray(d.BNPLPlans) ? d.BNPLPlans.filter(id => typeof id === 'string' && id.trim() !== '') : [], BNPLPlans: [], rating: typeof d.rating === 'number' ? d.rating : null, soldCount: typeof d.soldCount === 'number' ? d.soldCount : 0, reviews: Array.isArray(d.reviews) ? d.reviews : [], bnplAvailable: d.paymentOption?.BNPL === true, codAvailable: d.paymentOption?.COD === true, }; }); if (fetched.length > 0 && fetched.length < RELATED_PRODUCTS_LIMIT && fetched.length % 2 !== 0) { fetched.push({ id: `placeholder-${Date.now()}`, isPlaceholder: true }); } setRelatedProducts(fetched); console.log(`Fetched ${querySnapshot.docs.length} related.`); } catch (e) { console.error("Fetch related error: ", e); setRelatedProducts([]); } finally { setLoadingRelatedProducts(false); } }; fetchRelated(); }, [product?.id, product?.category, isLoadingProduct]);
    // --- End Effects ---

    // --- Memos (Unchanged) ---
    const galleryItems = useMemo(() => { if (!product || (!product.media && !product.image)) return [{ type: 'image', url: null, id: 'placeholder-img', isPlaceholder: true }]; const items = []; const seenUrls = new Set(); const addItem = (item) => { if (item.url && typeof item.url === 'string' && !seenUrls.has(item.url)) { items.push(item); seenUrls.add(item.url); } else if (item.isPlaceholder) { items.push(item); } }; if (product.media?.images && Array.isArray(product.media.images)) { product.media.images.forEach(url => addItem({ type: 'image', url: url, id: `img-${url}` })); } const videoUrl = product.media?.video; if (videoUrl) { addItem({ type: 'video', url: videoUrl, id: `vid-${videoUrl}` }); } if (product.image) { const fallbackAlreadyAdded = items.some(item => item.type === 'image' && item.url === product.image); if (!fallbackAlreadyAdded) { if (items.filter(i => i.type === 'image').length === 0) { items.unshift({ type: 'image', url: product.image, id: `img-fallback-${product.image}` }); } else { items.push({ type: 'image', url: product.image, id: `img-fallback-${product.image}` }); } } } if (items.length === 0) { items.push({ type: 'image', url: null, id: 'placeholder-img', isPlaceholder: true }); } return items; }, [product?.media, product?.image]);
    const originalPriceValue = useMemo(() => product?.originalPrice, [product?.originalPrice]);
    const discountedPriceValue = useMemo(() => product?.discountedPrice, [product?.discountedPrice]);
    const hasDiscount = useMemo(() => typeof originalPriceValue === 'number' && typeof discountedPriceValue === 'number' && discountedPriceValue < originalPriceValue, [originalPriceValue, discountedPriceValue]);
    const mainDisplayOriginalPrice = useMemo(() => typeof originalPriceValue === 'number' ? `${CURRENCY_SYMBOL} ${originalPriceValue.toFixed(0)}` : null, [originalPriceValue]);
    const mainDisplayDiscountedPrice = useMemo(() => typeof discountedPriceValue === 'number' ? `${CURRENCY_SYMBOL} ${discountedPriceValue.toFixed(0)}` : null, [discountedPriceValue]);
    const mainFinalDisplayPrice = useMemo(() => mainDisplayDiscountedPrice || mainDisplayOriginalPrice, [mainDisplayDiscountedPrice, mainDisplayOriginalPrice]);
    const basePriceForCalculations = useMemo(() => (hasDiscount && typeof discountedPriceValue === 'number') ? discountedPriceValue : (typeof originalPriceValue === 'number') ? originalPriceValue : null, [hasDiscount, discountedPriceValue, originalPriceValue]);
    const averageRating = useMemo(() => typeof product?.rating === 'number' ? product.rating : 4.5, [product?.rating]);
    const soldCount = useMemo(() => product?.soldCount ?? 0, [product?.soldCount]);
    const displaySoldCount = useMemo(() => soldCount > 999 ? `${(soldCount / 1000).toFixed(1)}k` : soldCount.toString(), [soldCount]);
    const allReviews = useMemo(() => { if (product?.reviews && Array.isArray(product.reviews) && product.reviews.length > 0) { return product.reviews; } return [ { id: 'review-1', name: "Alice J.", rating: 5, date: "2 weeks ago", comment: "Love it!" }, { id: 'review-2', name: "Mark S.", rating: 4, date: "1 month ago", comment: "Good." } ]; }, [product?.reviews]);
    const displayReviews = useMemo(() => showAllReviews ? allReviews : allReviews.slice(0, MAX_INITIAL_REVIEWS), [showAllReviews, allReviews]);
    const hasLoadedBnplOption = useMemo(() => product?.bnplAvailable === true && !isLoadingPlans && Array.isArray(product.BNPLPlans) && product.BNPLPlans.length > 0, [product?.bnplAvailable, product?.BNPLPlans, isLoadingPlans]);
    const bnplPlanGroups = useMemo(() => { if (!hasLoadedBnplOption || !product?.BNPLPlans) return {}; return product.BNPLPlans.reduce((acc, plan) => { if (!plan || typeof plan !== 'object') return acc; const type = ['Installment', 'BNPL', 'PayLater'].includes(plan.planType) ? 'BNPL Plans' : plan.planType === 'Fixed Duration' ? 'Fixed Duration Plans' : 'Other Plans'; if (!acc[type]) acc[type] = []; acc[type].push(plan); return acc; }, {}); }, [hasLoadedBnplOption, product?.BNPLPlans]);
    // --- End Memos ---

    // --- Handlers ---
    const toggleWishlist = () => setIsWishlisted(!isWishlisted);
    const shareProduct = async () => { /* ... Unchanged ... */ if (!product || !product.name) return; try { const message = `Check out: ${product.name} - ${mainFinalDisplayPrice || ''}`; const url = product?.productPageUrl; await Share.share({ message, ...(url && { url }) }); } catch (e) { console.error('Share err:', e.message); } };
    const onViewableItemsChanged = useRef(({ viewableItems }) => { if (viewableItems?.[0]?.index != null) { setActiveIndex(viewableItems[0].index); } }).current;
    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
    const handlePlanSelection = (plan) => { /* ... Unchanged ... */ if (selectedBnplPlan?.id === plan.id) { setSelectedBnplPlan(null); setSelectedPaymentMethod(null); } else { setSelectedBnplPlan(plan); setSelectedPaymentMethod('BNPL'); } };
    const openPaymentModal = (type) => { /* ... Unchanged ... */ if (!product || !product.id || isProcessingCart) return; if (!selectedBnplPlan) { setSelectedPaymentMethod(null); } else { setSelectedPaymentMethod('BNPL'); } setActionType(type); setIsPaymentModalVisible(true); };

    // Firestore Cart Logic (Unchanged - Only used for Add to Cart now)
    const updateFirestoreCart = async (cartItemDetails) => { const auth = getAuth(); const user = auth.currentUser; if (!user) { Alert.alert("Login Required", "Please log in."); return false; } if (!cartItemDetails || !cartItemDetails.productId || typeof cartItemDetails.priceAtAddition !== 'number') { Alert.alert("Error", "Invalid item data."); return false; } if (cartItemDetails.paymentMethod === 'BNPL' && (!cartItemDetails.bnplPlan || !cartItemDetails.bnplPlan.id)) { Alert.alert("Error", "BNPL plan details are missing."); return false; } const cartDocRef = doc(db, "Carts", user.uid); console.log(`Updating cart for user: ${user.uid}, Product: ${cartItemDetails.productId}, Method: ${cartItemDetails.paymentMethod}`); try { const cartSnap = await getDoc(cartDocRef); if (cartSnap.exists()) { const cartData = cartSnap.data(); const items = cartData.items || []; if (cartItemDetails.paymentMethod === 'COD') { const existingCodItemIndex = items.findIndex(item => item.productId === cartItemDetails.productId && item.paymentMethod === 'COD'); if (existingCodItemIndex > -1) { const existingItem = items[existingCodItemIndex]; const newQuantity = (existingItem.quantity || 0) + 1; const updatedItems = items.map((item, index) => index === existingCodItemIndex ? { ...item, quantity: newQuantity } : item); await updateDoc(cartDocRef, { items: updatedItems, lastUpdated: serverTimestamp() }); console.log("COD Quantity updated."); return true; } else { await updateDoc(cartDocRef, { items: arrayUnion(cartItemDetails), lastUpdated: serverTimestamp() }); console.log("New COD item added."); return true; } } else if (cartItemDetails.paymentMethod === 'BNPL') { const planIdToAdd = cartItemDetails.bnplPlan.id; const exactBnplItemIndex = items.findIndex(item => item.productId === cartItemDetails.productId && item.paymentMethod === 'BNPL' && item.bnplPlan?.id === planIdToAdd); if (exactBnplItemIndex > -1) { const existingItem = items[exactBnplItemIndex]; const newQuantity = (existingItem.quantity || 0) + 1; const updatedItems = items.map((item, index) => index === exactBnplItemIndex ? { ...item, quantity: newQuantity } : item); await updateDoc(cartDocRef, { items: updatedItems, lastUpdated: serverTimestamp() }); console.log("BNPL Quantity updated."); return true; } else { const anyOtherBnplItemExists = items.some(item => item.productId === cartItemDetails.productId && item.paymentMethod === 'BNPL'); if (anyOtherBnplItemExists) { Alert.alert("Plan Conflict", `${cartItemDetails.productName} is already in your cart with a different BNPL plan.`); return false; } else { await updateDoc(cartDocRef, { items: arrayUnion(cartItemDetails), lastUpdated: serverTimestamp() }); console.log("New BNPL item added."); return true; } } } else { console.error("Unsupported payment method:", cartItemDetails.paymentMethod); Alert.alert("Error", "Unsupported payment method."); return false; } } else { const initialCartItem = { ...cartItemDetails, addedAt: new Date() }; await setDoc(cartDocRef, { userId: user.uid, items: [initialCartItem], createdAt: serverTimestamp(), lastUpdated: serverTimestamp() }); console.log("New cart created and item added."); return true; } } catch (error) { console.error("Error updating/creating cart:", error); Alert.alert("Error", "Could not update your cart. Please try again."); return false; } };

    const triggerAddedToCartPopup = () => { if (popupTimeoutRef.current) { clearTimeout(popupTimeoutRef.current); } setShowAddedToCartPopup(true); Animated.timing(popupOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start(); popupTimeoutRef.current = setTimeout(() => { Animated.timing(popupOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => { setShowAddedToCartPopup(false); }); }, 2000); };

    // --- Main Product Action Handlers ---

    // Used ONLY for Add to Cart when only COD is available
    const proceedDirectlyWithCOD_AddToCart = async () => {
         if (isProcessingCart) return;
         if (!product || !product.id) { Alert.alert("Error", "Product details missing."); return; }
         setActionType('addToCart'); // Explicitly set action type
         setIsProcessingCart(true);
         const priceForCart = basePriceForCalculations;
         if (priceForCart === null) { Alert.alert("Error", "Price info missing."); setIsProcessingCart(false); setActionType(null); return; }
         const cartItem = { cartItemId: `${product.id}_COD_${Date.now()}`, productId: product.id, productName: product.name || 'Unnamed', image: galleryItems.find(item => item.type === 'image' && !item.isPlaceholder)?.url || placeholderImage, quantity: 1, paymentMethod: 'COD', priceAtAddition: Number(priceForCart.toFixed(2)), bnplPlan: null, addedAt: new Date(), };
         let success = false;
         try { success = await updateFirestoreCart(cartItem); }
         catch(e) { console.error("Direct COD AddToCart error:", e); success = false; }
         finally { setIsProcessingCart(false); setActionType(null); }

         if (success) {
             triggerAddedToCartPopup(); // Show popup on success
         }
         // Error alerts handled by updateFirestoreCart
    };

    const handleAddToCart = () => {
        if (isProcessingCart || !product || !product.id) return;
        const canCOD = product.codAvailable === true;
        const canBNPL = hasLoadedBnplOption;
        if (!canCOD && !canBNPL) { Alert.alert("Payment Unavailable", "No payment options available."); return; }

        if (canCOD && !canBNPL) {
            // Only COD available, use the specific AddToCart handler
            proceedDirectlyWithCOD_AddToCart();
        } else {
            // BNPL or both available, open modal for AddToCart action
            openPaymentModal('addToCart');
        }
    };

    // ** MODIFIED handleBuyNow **
    const handleBuyNow = () => {
         if (isProcessingCart || !product || !product.id) return;
         console.log("Buy Now initiated");
         setActionType('buyNow'); // Set action type immediately

         const canCOD = product.codAvailable === true;
         const canBNPL = hasLoadedBnplOption;

         if (!canCOD && !canBNPL) {
            Alert.alert("Payment Unavailable", "Cannot proceed, no payment options available.");
            setActionType(null); // Reset action type on failure
            return;
         }

         // If only COD is available, skip cart update and navigate directly
         if (canCOD && !canBNPL) {
             console.log("Buy Now with COD only - preparing direct checkout");
             setIsProcessingCart(true); // Show loader on button
             const priceForCheckout = basePriceForCalculations;
             if (priceForCheckout === null) {
                 Alert.alert("Error", "Price info missing.");
                 setIsProcessingCart(false); setActionType(null); return;
             }
             const checkoutItem = {
                id: product.id,
                name: product.name || 'Unnamed Product',
                image: galleryItems.find(item => item.type === 'image' && !item.isPlaceholder)?.url || placeholderImage,
                quantity: 1,
                price: Number(priceForCheckout.toFixed(2)),
                paymentMethod: 'COD',
                bnplPlan: null
             };
             console.log("Navigating to CheckoutScreen with COD item:", checkoutItem);
             // Use setTimeout to allow loader state to render before navigating
             setTimeout(() => {
                 navigation.navigate('CheckoutScreen', { cartItems: [checkoutItem], totalPrice: checkoutItem.price * checkoutItem.quantity });
                 setIsProcessingCart(false); // Stop loader after navigation (or slight delay)
                 setActionType(null);
             }, 50); // Small delay
         }
         // If BNPL or both are available, open the modal for selection
         else {
             console.log("Buy Now requires payment selection - opening modal.");
             openPaymentModal('buyNow'); // actionType 'buyNow' is passed here
         }
    };

    const handleChat = () => { console.log("Chat pressed"); };
    const handleSeeMoreReviews = () => setShowAllReviews(true);
    const handleSeeLessReviews = () => setShowAllReviews(false);

    // ** MODIFIED handleProceedWithPayment **
    const handleProceedWithPayment = async () => {
        if (isProcessingCart) return;
        if (!selectedPaymentMethod) { Alert.alert("Selection Required", "Select payment method."); return; }
        if (selectedPaymentMethod === 'BNPL' && !selectedBnplPlan) { Alert.alert("Selection Required", "Select BNPL plan."); return; }
        if (!product || !product.id) { Alert.alert("Error", "Product details missing."); return; }

        const currentActionType = actionType; // Capture action type before async operation potentially resets it

        setIsProcessingCart(true);
        setIsPaymentModalVisible(false); // Close modal immediately

        let price = null;
        let bnplDetails = null;
        const base = basePriceForCalculations;

        if (selectedPaymentMethod === 'COD') { price = base; }
        else if (selectedPaymentMethod === 'BNPL' && selectedBnplPlan) { if (base === null) { Alert.alert("Error", "Price info missing."); setIsProcessingCart(false); setActionType(null); return; } const irv = typeof selectedBnplPlan.interestRate === 'number' ? selectedBnplPlan.interestRate : 0; price = base * (1 + (irv / 100)); const duration = typeof selectedBnplPlan.duration === 'number' ? selectedBnplPlan.duration : null; const interestRate = irv; const planType = selectedBnplPlan.planType; let calculatedMonthly = null; if (duration !== null && duration > 0 && typeof interestRate === 'number' && typeof base === 'number' && planType !== 'Fixed Duration') { const monthlyRaw = (base * (1 + (interestRate / 100))) / duration; calculatedMonthly = Number(monthlyRaw.toFixed(2)); } else if (duration !== null && duration > 0 && interestRate === 0 && typeof base === 'number' && planType !== 'Fixed Duration') { const monthlyRaw = base / duration; calculatedMonthly = Number(monthlyRaw.toFixed(2)); } bnplDetails = { id: selectedBnplPlan.id, name: selectedBnplPlan.planName || 'Unnamed Plan', duration: duration, interestRate: interestRate, calculatedMonthly: calculatedMonthly, planType: planType }; }

        if (price === null || typeof price !== 'number') { Alert.alert("Error", "Could not determine final price."); setIsProcessingCart(false); setActionType(null); return; }

        // Construct item details (used for both AddToCart and BuyNow navigation)
        const itemDetails = {
             cartItemId: `${product.id}_${selectedPaymentMethod}_${selectedBnplPlan?.id || 'NA'}_${Date.now()}`, // Unique ID for cart interaction
             productId: product.id,
             productName: product.name || 'Unnamed Product',
             image: galleryItems.find(item => item.type === 'image' && !item.isPlaceholder)?.url || placeholderImage,
             quantity: 1,
             paymentMethod: selectedPaymentMethod,
             priceAtAddition: Number(price.toFixed(2)),
             bnplPlan: bnplDetails,
             addedAt: new Date(),
         };

        // --- Branch based on action type ---
        if (currentActionType === 'addToCart') {
            let success = false;
            try { success = await updateFirestoreCart(itemDetails); } // Update the persistent cart
            catch(e) { console.error("Modal AddToCart error:", e); success = false; }
            finally { setIsProcessingCart(false); setActionType(null); } // Reset state

            if (success) {
                triggerAddedToCartPopup(); // Show popup
            }
            // Error alerts handled by updateFirestoreCart
        }
        else if (currentActionType === 'buyNow') {
            // Construct item specifically for checkout navigation
             const checkoutItem = {
                id: itemDetails.productId,
                name: itemDetails.productName,
                image: itemDetails.image,
                quantity: itemDetails.quantity,
                price: itemDetails.priceAtAddition,
                paymentMethod: itemDetails.paymentMethod,
                bnplPlan: itemDetails.bnplPlan
             };
             console.log("Navigating to CheckoutScreen from Modal:", checkoutItem);
             // Use setTimeout to allow loader state to render before navigating
             setTimeout(() => {
                navigation.navigate('CheckoutScreen', { cartItems: [checkoutItem], totalPrice: checkoutItem.price * checkoutItem.quantity });
                setIsProcessingCart(false); // Stop loader after navigation
                setActionType(null);
             }, 50);
        }
         else {
            // Should not happen, but reset state if actionType is invalid
            console.warn("Invalid action type in handleProceedWithPayment:", currentActionType);
             setIsProcessingCart(false);
             setActionType(null);
        }
    };
    // --- End Handlers ---


    // --- Render Functions (Unchanged) ---
    const formatCurrency = (v) => { if (typeof v === 'number') { return `${CURRENCY_SYMBOL} ${v.toFixed(0)}`; } return null; };
    const renderGalleryItem = ({ item }) => { if (item.isPlaceholder) { return <Image source={placeholderImage} style={styles.galleryItemImage} resizeMode="contain" />; } if (item.type === 'image') { return <Image source={{ uri: item.url }} style={styles.galleryItemImage} resizeMode="contain" onError={(e) => console.error(`Img Err (${item.url}):`, e.nativeEvent.error)} />; } if (item.type === 'video') { return <Video ref={(ref) => videoRefs.current[item.id] = ref} style={styles.galleryItemVideo} source={{ uri: item.url }} useNativeControls resizeMode={ResizeMode.CONTAIN} onError={(e) => console.error(`Vid Err (${item.url}):`, e)} />; } return null; };
    const renderTextPagination = () => { if (galleryItems.length <= 1) return null; return (<View style={styles.paginationTextContainer}><Text style={styles.paginationText}>{activeIndex + 1}/{galleryItems.length}</Text></View>); };
    const renderPriceSection = () => { if (!mainFinalDisplayPrice) return <Text style={styles.noPriceText}>Price unavailable</Text>; return ( <View style={styles.priceRow}><Text style={styles.finalPrice}>{mainFinalDisplayPrice}</Text>{hasDiscount && mainDisplayOriginalPrice && <Text style={styles.originalPrice}>{mainDisplayOriginalPrice}</Text>}</View> ); };
    const renderBnplPlansSection = () => { if (isLoadingPlans) { return ( <View style={styles.bnplSectionContainer}><Text style={styles.sectionTitle}>Installment Options</Text><ActivityIndicator style={{marginTop: 20}} size="small" color={AccentColor} /></View> ); } if (!hasLoadedBnplOption || basePriceForCalculations === null) { return null; } if (!product?.BNPLPlans || product.BNPLPlans.length === 0) { return null; } const renderSinglePlanCard = (plan, index, arrayLength) => { if (!plan || typeof plan !== 'object' || !plan.id) { return null; } const isSelectedOnMain = selectedBnplPlan?.id === plan.id; const p = plan; const name = p.planName || 'Unnamed'; const dur = typeof p.duration === 'number' ? p.duration : null; const irv = typeof p.interestRate === 'number' ? p.interestRate : null; const ird = typeof irv === 'number' ? `${irv.toFixed(1)}%` : 'N/A'; const pt = p.planType || 'Gen'; const pid = p.id; const last = index === arrayLength - 1; const fd = pt === 'Fixed Duration'; let totalPriceNumeric = null; let ftpi = null; const basePrice = basePriceForCalculations; if (typeof irv === 'number' && typeof basePrice === 'number') { totalPriceNumeric = basePrice * (1 + (irv / 100)); ftpi = formatCurrency(totalPriceNumeric); } else if (irv === 0 && typeof basePrice === 'number') { totalPriceNumeric = basePrice; ftpi = formatCurrency(totalPriceNumeric); } const ni = !fd && dur !== null ? dur : 1; let calculatedMonthlyPayment = null; if (!fd && dur !== null && dur > 0 && typeof totalPriceNumeric === 'number') { const monthlyRaw = totalPriceNumeric / dur; calculatedMonthlyPayment = formatCurrency(monthlyRaw); } return ( <TouchableOpacity key={pid} style={[ styles.bnplPlanCard, !last && styles.bnplPlanCardSeparator, isSelectedOnMain && styles.bnplPlanCardSelected ]} onPress={() => handlePlanSelection(plan)} activeOpacity={0.7}><View style={styles.bnplPlanHeader}><MaterialIcons name="payments" size={18} color={BnplPlanIconColor} style={styles.bnplPlanIcon} /><Text style={styles.bnplPlanNameText}>{name}</Text></View><View style={styles.bnplPlanDetails}><View style={styles.detailRow}><MaterialIcons name="info-outline" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} /><Text style={styles.bnplPlanDetailText}>Type: <Text style={styles.bnplPlanDetailValue}>{pt}</Text></Text></View>{dur !== null && (<View style={styles.detailRow}><MaterialIcons name="schedule" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} /><Text style={styles.bnplPlanDetailText}>Duration: <Text style={styles.bnplPlanDetailValue}> {dur} {dur === 1 ? 'Month' : 'Months'}</Text>{fd ? (<Text style={styles.bnplPlanDetailValue}> (1 Pay)</Text>) : (<Text style={styles.bnplPlanDetailValue}> / {ni} Ins</Text>)}</Text></View>)}{calculatedMonthlyPayment !== null && (<View style={styles.detailRow}><MaterialIcons name="calculate" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} /><Text style={styles.bnplPlanDetailText}>Monthly: <Text style={styles.bnplPlanDetailValue}>{calculatedMonthlyPayment}</Text></Text></View>)}{<View style={styles.detailRow}><MaterialIcons name="percent" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} /><Text style={styles.bnplPlanDetailText}>Interest: <Text style={styles.bnplPlanDetailValue}>{ird}</Text></Text></View>}{ftpi !== null && (<View style={styles.detailRow}><MaterialIcons name="monetization-on" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} /><Text style={styles.bnplPlanDetailText}>Total Price: <Text style={styles.bnplPlanDetailValue}>{ftpi}</Text></Text></View>)}</View></TouchableOpacity> ); }; const groupKeys = Object.keys(bnplPlanGroups); if (groupKeys.length === 0) return null; return ( <View style={styles.bnplSectionContainer}><Text style={styles.sectionTitle}>Installment Options</Text>{groupKeys.map(groupTitle => (<View key={groupTitle} style={styles.bnplGroupContainer}><Text style={styles.bnplGroupTitle}>{groupTitle}</Text>{bnplPlanGroups[groupTitle].map((plan, index, arr) => renderSinglePlanCard(plan, index, arr.length))}</View>))}</View> ); };
    const renderReviewCard = ({ item, index }) => { const totalItems = allReviews.length; const last = index === totalItems - 1; if (!item || !item.id) return null; return ( <View style={[ styles.reviewCard, last && { borderBottomWidth: 0 } ]}><View style={styles.reviewHeader}><View style={styles.reviewHeaderRating}>{[...Array(5)].map((_, i) => ( <MaterialIcons key={`s-${item.id}-${i}`} name="star" size={16} color={i < (item.rating || 0) ? StarColor : PlaceholderStarColor} /> ))}</View><Text style={styles.reviewerName}>{item.name || 'Anon'}{item.date && <Text style={styles.reviewDate}> · {item.date}</Text>}</Text></View><Text style={styles.reviewText}>{item.comment || ''}</Text></View> ); };
    const renderRelatedProductCard = ({ item }) => { if (item.isPlaceholder) return <View style={styles.relatedProductCardPlaceholder} />; if (!item || !item.id) return null; const itemHasDiscount = typeof item.originalPrice === 'number' && typeof item.discountedPrice === 'number' && item.discountedPrice < item.originalPrice; const op = typeof item.originalPrice === 'number' ? `${CURRENCY_SYMBOL} ${item.originalPrice.toFixed(0)}` : null; const dp = typeof item.discountedPrice === 'number' ? `${CURRENCY_SYMBOL} ${item.discountedPrice.toFixed(0)}` : null; const finalPriceDisplay = dp || op; const originalPriceDisplay = itemHasDiscount ? op : null; const bnpl = item.bnplAvailable === true; const cod = item.codAvailable === true; return ( <TouchableOpacity style={styles.relatedProductCard} onPress={() => { if (!isProcessingCart) navigation.push('ProductDetails', { product: item }); }} activeOpacity={0.8} disabled={isProcessingCart}><Image source={item.image ? { uri: item.image } : placeholderImage} style={styles.relatedCardImage} resizeMode="contain" /><Text style={styles.relatedCardName} numberOfLines={1}>{item.name || ''}</Text><View style={styles.relatedCardPriceContainer}>{finalPriceDisplay ? (<Text style={styles.relatedCardDiscountedPrice}>{finalPriceDisplay}</Text>) : (<View style={styles.relatedCardPricePlaceholder} />)}{originalPriceDisplay && (<Text style={[styles.relatedCardProductPrice, styles.relatedCardStrikethroughPrice]}>{originalPriceDisplay}</Text>)}</View>{item.description ? ( <Text style={styles.relatedCardDescription} numberOfLines={2}>{item.description}</Text> ) : <View style={styles.relatedCardDescriptionPlaceholder}/> }<View style={styles.relatedCardBadgesContainer}>{bnpl ? ( <View style={styles.relatedCardBnplBadge}><MaterialIcons name="schedule" size={14} color={BnplBadgeText} /><Text style={styles.relatedCardBnplText}>BNPL Available</Text></View> ) : cod ? ( <View style={styles.relatedCardCodBadge}><MaterialIcons name="local-shipping" size={14} color={CodBadgeText} /><Text style={styles.relatedCardCodText}>COD Available</Text></View> ) : ( <View style={styles.relatedCardBadgePlaceholder} /> )}</View></TouchableOpacity> ); };
    const renderRelatedProductsSection = () => { if (loadingRelatedProducts) { return ( <View style={styles.relatedLoadingContainer}><ActivityIndicator size="large" color={AccentColor} /><Text style={styles.relatedLoadingText}>Loading Related...</Text></View> ); } if (!relatedProducts || relatedProducts.length === 0) { return null; } return ( <View style={styles.relatedProductsContainer}><Text style={styles.relatedProductsTitle}>Related Products</Text><FlatList data={relatedProducts} renderItem={renderRelatedProductCard} keyExtractor={(i) => i.id} numColumns={NUM_COLUMNS} key={`rel-grid-${NUM_COLUMNS}`} scrollEnabled={false} contentContainerStyle={styles.relatedProductsGridContainer} /></View> ); };
    const renderPaymentModal = () => { if (!product) return null; const modalProceedDisabled = isProcessingCart || !selectedPaymentMethod || (selectedPaymentMethod === 'BNPL' && !selectedBnplPlan); const hasCodOption = product?.codAvailable === true; const hasBnplOptionModal = hasLoadedBnplOption; const formatModCur = (v) => { if (typeof v === 'number') { return `${CURRENCY_SYMBOL} ${v.toFixed(0)}`; } return null; }; const renderModalPlanRow = (plan) => { if (!plan || !plan.id || basePriceForCalculations === null) return null; const isSelected = selectedBnplPlan?.id === plan.id; const planName = plan.planName || 'Unnamed'; const duration = typeof plan.duration === 'number' ? plan.duration : null; const interestRateValue = typeof plan.interestRate === 'number' ? plan.interestRate : null; const interestRateDisplay = typeof interestRateValue === 'number' ? `${interestRateValue.toFixed(1)}%` : 'N/A'; const planType = plan.planType || 'Gen'; const isFixedDurationPlan = plan.planType === 'Fixed Duration'; let totalPriceNumeric = null; let formattedTotalPriceWithInterest = null; const basePrice = basePriceForCalculations; if (typeof interestRateValue === 'number' && typeof basePrice === 'number') { totalPriceNumeric = basePrice * (1 + (interestRateValue / 100)); formattedTotalPriceWithInterest = formatModCur(totalPriceNumeric); } else if (interestRateValue === 0 && typeof basePrice === 'number') { totalPriceNumeric = basePrice; formattedTotalPriceWithInterest = formatModCur(totalPriceNumeric); } let calculatedMonthlyPaymentModal = null; if (!isFixedDurationPlan && duration !== null && duration > 0 && typeof totalPriceNumeric === 'number') { const monthlyRaw = totalPriceNumeric / duration; calculatedMonthlyPaymentModal = formatModCur(monthlyRaw); } const numberOfInstallments = !isFixedDurationPlan && duration !== null ? duration : 1; return ( <TouchableOpacity key={plan.id} style={[ styles.bnplPlanOption, isSelected && styles.bnplPlanOptionSelected ]} onPress={() => setSelectedBnplPlan(plan)} activeOpacity={0.7}><Text style={styles.bnplPlanNameModal}>{planName}</Text><View style={styles.modalPlanDetailsContainer}><View style={styles.modalDetailRow}><MaterialIcons name="info-outline" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} /><Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Type: </Text><Text style={styles.modalPlanDetailValue}>{planType}</Text></Text></View>{duration !== null && (<View style={styles.modalDetailRow}><MaterialIcons name="schedule" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} /><Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Duration: </Text><Text style={styles.modalPlanDetailValue}>{duration} {duration === 1 ? 'M' : 'Ms'}</Text>{isFixedDurationPlan ? (<Text style={styles.modalPlanDetailValue}> (1 Pay)</Text>) : (<Text style={styles.modalPlanDetailValue}> / {numberOfInstallments} Ins</Text>)}</Text></View>)}{calculatedMonthlyPaymentModal !== null && (<View style={styles.modalDetailRow}><MaterialIcons name="calculate" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} /><Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Monthly: </Text><Text style={styles.modalPlanDetailValue}>{calculatedMonthlyPaymentModal}</Text></Text></View> )}{<View style={styles.modalDetailRow}><MaterialIcons name="percent" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} /><Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Interest: </Text><Text style={styles.modalPlanDetailValue}>{interestRateDisplay}</Text></Text></View>}{formattedTotalPriceWithInterest !== null && (<View style={styles.modalDetailRow}><MaterialIcons name="monetization-on" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} /><Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Total Price: </Text><Text style={styles.modalPlanDetailValue}>{formattedTotalPriceWithInterest}</Text></Text></View>)}</View></TouchableOpacity> ); }; const closeModal = () => { if (!isProcessingCart) setIsPaymentModalVisible(false); }; return (<Modal visible={isPaymentModalVisible} transparent={true} animationType="slide" onRequestClose={closeModal}><TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPressOut={closeModal} /><View style={styles.modalContainer}><TouchableOpacity style={styles.modalCloseButton} onPress={closeModal} disabled={isProcessingCart}><MaterialIcons name="close" size={24} color={TextColorSecondary} /></TouchableOpacity><Text style={styles.modalTitle}>Select Payment Option</Text><View style={styles.paymentOptionsRowContainer}>{hasCodOption && ( <TouchableOpacity style={[ styles.paymentOptionButtonRow, selectedPaymentMethod === 'COD' && styles.paymentOptionSelected ]} onPress={() => { setSelectedPaymentMethod('COD'); setSelectedBnplPlan(null); }} activeOpacity={0.7} disabled={isProcessingCart}><Text style={[styles.paymentOptionTextRow, selectedPaymentMethod === 'COD' && styles.paymentOptionTextSelected]}>Cash on Delivery</Text></TouchableOpacity> )}{hasBnplOptionModal && ( <TouchableOpacity style={[ styles.paymentOptionButtonRow, selectedPaymentMethod === 'BNPL' && styles.paymentOptionSelected ]} onPress={() => { setSelectedPaymentMethod('BNPL'); }} activeOpacity={0.7} disabled={isProcessingCart}><Text style={[styles.paymentOptionTextRow, selectedPaymentMethod === 'BNPL' && styles.paymentOptionTextSelected]}>Buy Now Pay Later</Text></TouchableOpacity> )}</View>{!hasCodOption && !hasBnplOptionModal && (<Text style={styles.noPaymentOptionsText}>No payment options available.</Text>)}{selectedPaymentMethod === 'BNPL' && hasBnplOptionModal && (<View style={styles.bnplPlanSelectionContainer}><Text style={styles.modalSubtitle}>Select Your Plan</Text>{isLoadingPlans ? (<ActivityIndicator style={{marginVertical: 20}} size="small" color={AccentColor} />) : (<ScrollView style={styles.bnplPlanScrollView} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>{Object.keys(bnplPlanGroups).length > 0 ? ( Object.entries(bnplPlanGroups).map(([groupTitle, plans]) => ( <View key={groupTitle} style={styles.modalPlanGroup}><Text style={styles.modalPlanGroupTitle}>{groupTitle}</Text>{plans.map(renderModalPlanRow)}</View> ))) : ( <Text style={styles.noPaymentOptionsText}>No BNPL plans found.</Text> )}</ScrollView>)}</View>)}{(hasCodOption || hasBnplOptionModal) && (<TouchableOpacity style={[ styles.proceedButton, modalProceedDisabled && styles.proceedButtonDisabled ]} onPress={handleProceedWithPayment} disabled={modalProceedDisabled} activeOpacity={modalProceedDisabled ? 1 : 0.7}>{isProcessingCart ? ( <ActivityIndicator size="small" color="#FFFFFF" /> ) : ( <Text style={styles.proceedButtonText}>{actionType === 'addToCart' ? 'Confirm & Add' : 'Confirm & Proceed'}</Text> )}</TouchableOpacity>)}</View></Modal>); };
    // --- End Render Functions ---


    // --- Loading / Error States ---
    if (isLoadingProduct) { return ( <SafeAreaView style={styles.safeArea}><StatusBar barStyle="dark-content" backgroundColor={AppBackgroundColor} /><View style={styles.loadingContainer}><ActivityIndicator size="large" color={AccentColor} /><Text style={styles.errorText}>Loading Product...</Text></View></SafeAreaView> ); }
    if (!product) { return ( <SafeAreaView style={styles.safeArea}><StatusBar barStyle="dark-content" backgroundColor={AppBackgroundColor} /><View style={styles.loadingContainer}><MaterialIcons name="error-outline" size={40} color={TextColorSecondary} /><Text style={styles.errorText}>Product details could not be loaded.</Text><TouchableOpacity onPress={() => navigation.goBack()} style={{marginTop: 20}}><Text style={{color: AccentColor}}>Go Back</Text></TouchableOpacity></View></SafeAreaView> ); }

    // --- Main Return ---
    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
            <StatusBar barStyle="dark-content" backgroundColor={AppBackgroundColor} />

             {/* ** Added to Cart Popup ** */}
             {showAddedToCartPopup && (
                 <Animated.View style={[styles.addedPopup, { opacity: popupOpacity }]}>
                    <MaterialIcons name="check-circle" size={18} color={PopupTextColor} style={{ marginRight: 8 }}/>
                    <Text style={styles.popupText}>Added to Cart!</Text>
                 </Animated.View>
             )}

            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                {/* Gallery */}
                <View style={styles.galleryWrapper}><FlatList ref={flatListRef} data={galleryItems} renderItem={renderGalleryItem} keyExtractor={(i) => i.id} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onViewableItemsChanged={onViewableItemsChanged} viewabilityConfig={viewabilityConfig} scrollEventThrottle={16} style={styles.galleryFlatList} initialNumToRender={1} maxToRenderPerBatch={1} windowSize={3} /><View style={styles.galleryOverlayContainer}>{renderTextPagination()}</View></View>

                {/* Content Below Gallery */}
                <View style={styles.contentContainer}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <View style={styles.reviewSectionHeaderInline}><View style={styles.reviewOverallRating}><MaterialIcons name="star" size={16} color={StarColor} style={{ marginRight: 4 }}/><Text style={styles.reviewOverallRatingText}>{typeof averageRating === 'number' ? averageRating.toFixed(1) : '-'}</Text></View><Text style={styles.soldCountText}>{displaySoldCount} sold</Text></View>
                    <View style={styles.priceActionsRow}>{renderPriceSection()}<View style={styles.rightActionButtonsGroup}><TouchableOpacity onPress={toggleWishlist} style={styles.iconButton} activeOpacity={0.7}><MaterialIcons name={isWishlisted ? 'favorite' : 'favorite-border'} size={24} color={isWishlisted ? AccentColor : TextColorPrimary} /></TouchableOpacity><TouchableOpacity onPress={shareProduct} style={[styles.iconButton, { marginLeft: 10 }]} activeOpacity={0.7}><Feather name="share-2" size={22} color={TextColorPrimary} /></TouchableOpacity></View></View>
                    <Text style={styles.sectionTitle}>Description</Text><Text style={styles.descriptionText}>{product.description || 'No description available.'}</Text>
                    {renderBnplPlansSection()}
                    <View style={styles.reviewSectionWrapper}><Text style={styles.sectionTitle}>Reviews ({allReviews.length})</Text><FlatList data={displayReviews} renderItem={renderReviewCard} keyExtractor={(i, idx) => (i.id ? i.id.toString() : `r-${idx}`)} scrollEnabled={false} ListEmptyComponent={<Text style={styles.noReviewsText}>No reviews yet.</Text>} />{allReviews.length > MAX_INITIAL_REVIEWS && ( <View>{!showAllReviews ? ( <TouchableOpacity style={styles.seeMoreButton} onPress={handleSeeMoreReviews} activeOpacity={0.7}><Text style={styles.seeMoreButtonText}>See More</Text><MaterialIcons name="keyboard-arrow-down" size={20} color={AccentColor} /></TouchableOpacity> ) : ( <TouchableOpacity style={styles.seeMoreButton} onPress={handleSeeLessReviews} activeOpacity={0.7}><Text style={styles.seeMoreButtonText}>See Less</Text><MaterialIcons name="keyboard-arrow-up" size={20} color={AccentColor} /></TouchableOpacity> )}</View> )}
                    </View>
                </View>

                {/* Related Products */}
                {renderRelatedProductsSection()}
                 <View style={styles.relatedProductsBottomPadding} />
            </ScrollView>

            {/* Bottom Button Bar */}
            <View style={styles.buttonContainer}>
                 <TouchableOpacity style={[styles.bottomButtonBase, styles.chatButton, isProcessingCart && styles.buttonDisabledGeneric]} onPress={handleChat} activeOpacity={0.7} disabled={isProcessingCart}>
                     <MaterialIcons name="support-agent" size={22} color={ChatIconColor} style={{ marginBottom: 2 }}/>
                     <Text style={[styles.buttonText, styles.chatButtonText]}>Chat</Text>
                 </TouchableOpacity>
                 {/* Add to Cart Button */}
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
                 {/* Buy Now Button */}
                 <TouchableOpacity
                    style={[styles.buyButtonContainer, isProcessingCart && styles.buttonDisabledGeneric]}
                    onPress={handleBuyNow}
                    activeOpacity={0.8}
                    disabled={isProcessingCart}
                 >
                     <LinearGradient colors={[AccentColor, AccentDarkerColor]} style={styles.buyButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
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

// --- Styles (Includes popup styles) ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: AppBackgroundColor },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: AppBackgroundColor },
    errorText: { fontSize: 16, color: TextColorSecondary, textAlign: 'center', marginTop: 10 },
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
    reviewSectionHeaderInline: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 12, },
    reviewOverallRating: { flexDirection: 'row', alignItems: 'center', marginRight: 15, },
    reviewOverallRatingText: { fontSize: 14, fontWeight: 'bold', color: TextColorPrimary, marginLeft: 4, },
    soldCountText: { fontSize: 14, color: TextColorSecondary, },
    priceActionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, minHeight: 30 },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', flexShrink: 1, marginRight: 10 },
    finalPrice: { fontSize: 20, fontWeight: 'bold', color: AccentColor },
    originalPrice: { fontSize: 14, color: StrikethroughColor, textDecorationLine: 'line-through', marginLeft: 8 },
    noPriceText: { fontSize: 16, color: TextColorSecondary, fontStyle: 'italic' },
    rightActionButtonsGroup: { flexDirection: 'row', alignItems: 'center' },
    iconButton: { padding: 5 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 12, marginTop: 15 },
    descriptionText: { fontSize: 15, color: TextColorSecondary, lineHeight: 24, marginBottom: 25 },
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
    reviewSectionWrapper: { marginBottom: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: LightBorderColor },
    reviewCard: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    reviewHeader: { flexDirection: 'column', alignItems: 'flex-start', marginBottom: 8 },
    reviewHeaderRating: { flexDirection: 'row', marginBottom: 4 },
    reviewerName: { fontSize: 15, fontWeight: '600', color: TextColorPrimary },
    reviewDate: { fontSize: 13, color: TextColorSecondary, fontWeight: 'normal' },
    reviewText: { fontSize: 14, color: TextColorSecondary, lineHeight: 21 },
    noReviewsText: { textAlign: 'center', color: TextColorSecondary, marginTop: 20, marginBottom: 20, fontStyle: 'italic' },
    seeMoreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginTop: 10, borderTopWidth: 1, borderTopColor: LightBorderColor },
    seeMoreButtonText: { fontSize: 15, fontWeight: '500', color: AccentColor, marginRight: 5 },
    relatedProductsContainer: { marginTop: 20, paddingTop: 20, paddingBottom: 10, borderTopWidth: 1, borderTopColor: '#E0E0E0', backgroundColor: RelatedSectionBgColor, },
    relatedProductsTitle: { fontSize: 18, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 15, paddingHorizontal: GRID_PADDING_HORIZONTAL, },
    relatedLoadingContainer: { minHeight: 280, justifyContent: 'center', alignItems: 'center', marginVertical: 20, backgroundColor: RelatedSectionBgColor, paddingHorizontal: GRID_PADDING_HORIZONTAL, },
    relatedLoadingText: { marginTop: 10, fontSize: 14, color: TextColorSecondary, },
    relatedProductsGridContainer: { paddingHorizontal: GRID_PADDING_HORIZONTAL - CARD_MARGIN_HORIZONTAL, },
     relatedProductCard: {
         backgroundColor: '#fff', borderRadius: 8, margin: CARD_MARGIN_HORIZONTAL, width: relatedCardWidth,
         paddingVertical: 12, paddingHorizontal: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.18, shadowRadius: 1.00,
         minHeight: 300, alignItems: 'center', justifyContent: 'flex-start',
     },
    relatedProductCardPlaceholder: { margin: CARD_MARGIN_HORIZONTAL, width: relatedCardWidth, minHeight: 300, backgroundColor: 'transparent', },
    relatedCardImage: { width: '100%', height: 120, borderRadius: 6, marginBottom: 10, backgroundColor: PlaceholderBgColor, alignSelf: 'center' },
    relatedCardName: { fontSize: 14, fontWeight: '600', color: TextColorPrimary, textAlign: 'center', minHeight: 18, marginBottom: 6, width: '100%', paddingHorizontal: 5, },
    relatedCardPriceContainer: { flexDirection: 'column', alignItems: 'center', minHeight: 35, marginBottom: 8, justifyContent: 'center', width: '100%', },
    relatedCardProductPrice: { fontSize: 14, color: AccentColor, fontWeight: 'bold', },
    relatedCardStrikethroughPrice: { textDecorationLine: 'line-through', color: StrikethroughColor, fontWeight: 'normal', fontSize: 13, marginTop: 2 },
    relatedCardDiscountedPrice: { fontSize: 15, color: DiscountedPriceColor, fontWeight: 'bold', },
    relatedCardPricePlaceholder: { height: 20, minHeight: 35 },
    relatedCardDescription: { fontSize: 11, color: TextColorSecondary, textAlign: 'center', marginBottom: 10, paddingHorizontal: 5, minHeight: 28, lineHeight: 14, width: '95%', },
    relatedCardDescriptionPlaceholder: { height: 28, marginBottom: 10, },
    relatedCardBadgesContainer: { flexDirection: 'row', justifyContent: 'center', width: '90%', marginTop: 'auto', marginBottom: 4, minHeight: 24, },
    relatedCardBnplBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: BnplBadgeBg, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, height: 24, alignSelf: 'center', },
    relatedCardBnplText: { fontSize: 11, color: BnplBadgeText, marginLeft: 4, fontWeight: '600', },
    relatedCardCodBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: CodBadgeBg, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, height: 24, alignSelf: 'center', },
    relatedCardCodText: { fontSize: 11, color: CodBadgeText, marginLeft: 4, fontWeight: '600', },
    relatedCardBadgePlaceholder: { height: 24, width: '80%', },
    relatedProductsBottomPadding: { height: 15, backgroundColor: RelatedSectionBgColor },
    buttonContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: AppBackgroundColor, paddingVertical: 8, paddingHorizontal: 8, paddingBottom: Platform.OS === 'ios' ? 30 : 12, borderTopWidth: 1, borderTopColor: LightBorderColor, alignItems: 'stretch', },
    bottomButtonBase: { borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4, overflow: 'hidden', },
    chatButton: { flex: 0.6, flexDirection: 'column', backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#E0E0E0', paddingVertical: 8, height: 50, },
    chatButtonText: { color: ChatIconColor, fontSize: 11, fontWeight: '600', marginTop: 2, },
    cartButton: { flex: 1, flexDirection: 'row', backgroundColor: AppBackgroundColor, borderWidth: 1.5, borderColor: AccentColor, alignItems: 'center', justifyContent: 'center', height: 50, },
    cartButtonText: { color: AccentColor, fontSize: 16, fontWeight: 'bold', },
    buyButtonContainer: { flex: 1, borderRadius: 10, marginHorizontal: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.20, shadowRadius: 3.84, elevation: 5, height: 50, },
    buyButtonGradient: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', height: 50, },
    buyButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', },
    buttonText: { textAlign: 'center', },
    buttonDisabledGeneric: { opacity: 0.6, },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.5)', },
    modalContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: AppBackgroundColor, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 40, paddingBottom: Platform.OS === 'ios' ? 40 : 30, maxHeight: '80%', shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 10, },
    modalCloseButton: { position: 'absolute', top: 10, right: 15, padding: 5, zIndex: 1, },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: TextColorPrimary, textAlign: 'center', marginBottom: 20, },
    modalSubtitle: { fontSize: 16, fontWeight: '600', color: TextColorPrimary, marginBottom: 15, },
    paymentOptionsRowContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20, },
    paymentOptionButtonRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1.5, borderColor: LightBorderColor, borderRadius: 8, marginHorizontal: 5, },
    paymentOptionSelected: { borderColor: ModalSelectedBorderColor, backgroundColor: ModalSelectedBg, },
    paymentOptionTextRow: { fontSize: 14, color: TextColorPrimary, textAlign: 'center', fontWeight: '500' },
    paymentOptionTextSelected: { fontWeight: 'bold', color: ModalSelectedTextColor, },
    noPaymentOptionsText: { fontSize: 14, color: TextColorSecondary, textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
    bnplPlanSelectionContainer: { borderTopWidth: 1, borderTopColor: LightBorderColor, paddingTop: 15, marginBottom: 20, flexShrink: 1, },
    bnplPlanScrollView: { maxHeight: Platform.OS === 'ios' ? 220 : 180, },
    modalPlanGroup: { marginBottom: 15, },
    modalPlanGroupTitle: { fontSize: 13, fontWeight: 'bold', color: TextColorSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5, },
    bnplPlanOption: { padding: 12, borderWidth: 1, borderColor: LightBorderColor, borderRadius: 8, marginBottom: 12, },
    bnplPlanOptionSelected: { borderColor: ModalSelectedBorderColor, backgroundColor: ModalSelectedBg, borderWidth: 1.5 },
    bnplPlanNameModal: { fontSize: 15, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 10, },
    modalPlanDetailsContainer: { paddingLeft: 5, },
    modalDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, },
    modalDetailIcon: { marginRight: 8, width: 16, textAlign: 'center', color: BnplPlanDetailIconColor, },
    modalPlanDetailText: { fontSize: 12, color: TextColorSecondary, lineHeight: 18, flexShrink: 1, },
    modalPlanDetailLabel: { color: TextColorSecondary, },
    modalPlanDetailValue: { fontWeight: '600', color: TextColorPrimary, },
    proceedButton: { backgroundColor: AccentColor, paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginTop: 10, minHeight: 50, justifyContent: 'center', },
    proceedButtonDisabled: { backgroundColor: ModalProceedDisabledBg, opacity: 1, },
    proceedButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', },

    // ** Styles for Added to Cart Popup **
    addedPopup: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 20,
        left: 20,
        right: 20,
        backgroundColor: PopupBgColor,
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderRadius: 8,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    popupText: {
        color: PopupTextColor,
        fontSize: 15,
        fontWeight: '600',
    },
});