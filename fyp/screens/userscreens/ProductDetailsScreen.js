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
    // Consider adding Alert for the "No payment options" case
    // Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, where, getDocs, limit, orderBy, documentId, doc, getDoc } from 'firebase/firestore'; // Added doc, getDoc
import { db } from '../../firebaseConfig'; // Ensure this path is correct

// --- Constants (Red Theme) ---
const AppBackgroundColor = '#FFFFFF';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#666666';
const AccentColor = '#D32F2F'; // Primary Red
const AccentDarkerColor = '#B71C1C'; // Darker Red for Gradient/Hover
const LightBorderColor = '#EEEEEE';
const PlaceholderBgColor = '#F0F0F0';
const RelatedSectionBgColor = '#FAFAFA';
// const BnplInfoBgColor = '#E8F5E9'; // Style no longer needed
// const BnplInfoTextColor = '#1B5E20'; // Style no longer needed
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

// Modal Specific Colors (Red Theme)
const ModalSelectedBg = '#FFF0F0';
const ModalSelectedBorderColor = AccentColor;
const ModalSelectedTextColor = AccentColor;
const ModalProceedDisabledBg = '#FFCDD2';

const placeholderImage = require('../../assets/p3.jpg'); // Make sure path is correct
const { width: screenWidth } = Dimensions.get('window');
const GALLERY_HEIGHT = screenWidth * 0.9;
const MAX_INITIAL_REVIEWS = 2;
const RELATED_PRODUCTS_LIMIT = 6;
const CURRENCY_SYMBOL = 'RS';

// --- Calculate Fixed Card Width ---
const GRID_PADDING_HORIZONTAL = 15;
const CARD_MARGIN_HORIZONTAL = 4;
const NUM_COLUMNS = 2;
const totalPadding = GRID_PADDING_HORIZONTAL * 2;
const spaceBetweenColumns = CARD_MARGIN_HORIZONTAL * 2 * (NUM_COLUMNS - 1);
const availableWidth = screenWidth - totalPadding;
const relatedCardWidth = (availableWidth - spaceBetweenColumns) / NUM_COLUMNS;
// --- End Card Width Calculation ---


export default function ProductDetailsScreen() {
    const route = useRoute();
    const navigation = useNavigation();

    // --- State Variables ---
    const [product, setProduct] = useState(route.params?.product ?? null);
    const [isLoadingProduct, setIsLoadingProduct] = useState(!route.params?.product); // Loading main product data
    const [isLoadingPlans, setIsLoadingPlans] = useState(false); // Loading BNPL plan details specifically
    const [isWishlisted, setIsWishlisted] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [selectedSize, setSelectedSize] = useState(null);
    const [selectedColor, setSelectedColor] = useState(null);
    const [showAllReviews, setShowAllReviews] = useState(false);
    const [relatedProducts, setRelatedProducts] = useState([]);
    const [loadingRelatedProducts, setLoadingRelatedProducts] = useState(true);
    const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
    const [selectedBnplPlan, setSelectedBnplPlan] = useState(null); // Can now be set outside modal
    const [actionType, setActionType] = useState(null);
    // --- End State Variables ---

    // --- Refs ---
    const flatListRef = useRef(null);
    const videoRefs = useRef({});
    // --- End Refs ---

    // --- Effects ---
    // Effect to handle product loading AND fetching BNPL plans if needed
    useEffect(() => {
        const initialProductFromRoute = route.params?.product ?? null;
        const productIdFromRoute = route.params?.productId ?? null; // If only ID is passed

        const loadProductAndPlans = async (productData) => {
             if (!productData || !productData.id) { setIsLoadingProduct(false); setProduct(null); return; }
             const needsPlanFetch = productData.bnplAvailable === true && Array.isArray(productData.BNPLPlanIDs) && productData.BNPLPlanIDs.length > 0 && (!Array.isArray(productData.BNPLPlans) || productData.BNPLPlans.length === 0 || typeof productData.BNPLPlans[0] === 'string');
             setProduct(productData); setIsLoadingProduct(false); // Main product loaded

             if (needsPlanFetch) {
                 console.log(`Product ${productData.id}: BNPL plans need fetching...`);
                 setIsLoadingPlans(true);
                 try {
                     const planPromises = productData.BNPLPlanIDs.map(planId => { if (!planId || typeof planId !== 'string') { console.warn(`Invalid Plan ID for product ${productData.id}:`, planId); return Promise.resolve(null); } const planRef = doc(db, 'BNPL_plans', planId.trim()); return getDoc(planRef); });
                     const planSnapshots = await Promise.all(planPromises); const detailedPlans = planSnapshots.map(snap => snap?.exists() ? { id: snap.id, ...snap.data() } : null).filter(plan => plan !== null);
                     console.log(`Product ${productData.id}: Fetched ${detailedPlans.length} plan details.`);
                     setProduct(prevProduct => prevProduct ? { ...prevProduct, BNPLPlans: detailedPlans, BNPLPlanIDs: undefined } : null);
                 } catch (planError) { console.error(`Error fetching BNPL plans for product ${productData.id}:`, planError); setProduct(prevProduct => prevProduct ? { ...prevProduct, BNPLPlans: [], BNPLPlanIDs: undefined } : null); } finally { setIsLoadingPlans(false); }
             } else { setIsLoadingPlans(false); }
        };

        if (initialProductFromRoute) { loadProductAndPlans(initialProductFromRoute); }
        else if (productIdFromRoute) {
             console.warn(`Fetching product by ID (${productIdFromRoute})... Implement full fetch logic.`); setIsLoadingProduct(true);
             const fetchProductById = async () => { try { const productRef = doc(db, 'Products', productIdFromRoute); const docSnap = await getDoc(productRef); if (docSnap.exists()) { const fetchedData = { id: docSnap.id, ...docSnap.data(), bnplAvailable: docSnap.data().paymentOption?.BNPL === true, codAvailable: docSnap.data().paymentOption?.COD === true, BNPLPlanIDs: Array.isArray(docSnap.data().BNPLPlans) ? docSnap.data().BNPLPlans : [], BNPLPlans: [], }; await loadProductAndPlans(fetchedData); } else { console.error(`Product with ID ${productIdFromRoute} not found.`); setProduct(null); setIsLoadingProduct(false); } } catch (error) { console.error("Error fetching product by ID:", error); setProduct(null); setIsLoadingProduct(false); } };
             fetchProductById();
        } else { setIsLoadingProduct(false); setProduct(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [route.params?.product, route.params?.productId]);

    // Variation Selection Effect
    useEffect(() => { if (product) { setSelectedSize(product.variations?.sizes?.[0] || null); setSelectedColor(product.variations?.colors?.[0] || null); } }, [product]);

    // Related Products Fetch Effect
    useEffect(() => { if (!product || !product.id || !product.category || isLoadingProduct) { if (!product?.id && !isLoadingProduct) setLoadingRelatedProducts(false); return; } const fetchRelated = async () => { setLoadingRelatedProducts(true); try { const q = query( collection(db, 'Products'), where('category', '==', product.category), where(documentId(), '!=', product.id), orderBy(documentId()), limit(RELATED_PRODUCTS_LIMIT) ); const querySnapshot = await getDocs(q); let fetched = querySnapshot.docs.map(doc => { const d = doc.data(); return { id: doc.id, ...d, image: d.media?.images?.[0] || d.image || null, bnplAvailable: d.paymentOption?.BNPL === true, codAvailable: d.paymentOption?.COD === true, BNPLPlanIDs: Array.isArray(d.BNPLPlans) ? d.BNPLPlans : [], BNPLPlans: [], }; }); if (fetched.length > 0 && fetched.length % 2 !== 0) { fetched.push({ id: `placeholder-${Date.now()}`, isPlaceholder: true }); } setRelatedProducts(fetched); } catch (e) { console.error("Error fetching related: ", e); setRelatedProducts([]); } finally { setLoadingRelatedProducts(false); } }; fetchRelated(); }, [product, isLoadingProduct]);
    // --- End Effects ---

    // --- Memos and Calculations (Top Level) ---
    const galleryItems = useMemo(() => { /* Gallery logic */ if (!product || (!product.media && !product.image)) return [{ type: 'image', url: null, id: 'placeholder-img', isPlaceholder: true }]; const items = []; const seenUrls = new Set(); const addItem = (item) => { if (item.url && typeof item.url === 'string' && !seenUrls.has(item.url)) { items.push(item); seenUrls.add(item.url); } else if (item.isPlaceholder) { items.push(item); } }; if (product.media?.images && Array.isArray(product.media.images)) { product.media.images.forEach(url => addItem({ type: 'image', url: url, id: `img-${url}` })); } const videoUrl = product.media?.video; if (videoUrl) { addItem({ type: 'video', url: videoUrl, id: `vid-${videoUrl}` }); } if (product.image) { const fallbackAlreadyAdded = items.some(item => item.type === 'image' && item.url === product.image); if (!fallbackAlreadyAdded) { if (items.filter(i => i.type === 'image').length === 0) { items.unshift({ type: 'image', url: product.image, id: `img-fallback-${product.image}` }); } else { items.push({ type: 'image', url: product.image, id: `img-fallback-${product.image}` }); } } } if (items.length === 0) { items.push({ type: 'image', url: null, id: 'placeholder-img', isPlaceholder: true }); } return items; }, [product]);
    const originalPriceValue = useMemo(() => typeof product?.originalPrice === 'number' ? product.originalPrice : null, [product?.originalPrice]);
    const discountedPriceValue = useMemo(() => typeof product?.discountedPrice === 'number' ? product.discountedPrice : null, [product?.discountedPrice]);
    const hasDiscount = useMemo(() => originalPriceValue !== null && discountedPriceValue !== null && discountedPriceValue < originalPriceValue, [originalPriceValue, discountedPriceValue]);
    const mainDisplayOriginalPrice = useMemo(() => originalPriceValue !== null ? `${CURRENCY_SYMBOL} ${originalPriceValue.toFixed(0)}` : null, [originalPriceValue]);
    const mainDisplayDiscountedPrice = useMemo(() => discountedPriceValue !== null ? `${CURRENCY_SYMBOL} ${discountedPriceValue.toFixed(0)}` : null, [discountedPriceValue]);
    const mainFinalDisplayPrice = useMemo(() => mainDisplayDiscountedPrice || mainDisplayOriginalPrice, [mainDisplayDiscountedPrice, mainDisplayOriginalPrice]);
    const basePriceForBNPL = useMemo(() => (hasDiscount && discountedPriceValue !== null) ? discountedPriceValue : (originalPriceValue !== null) ? originalPriceValue : null, [hasDiscount, discountedPriceValue, originalPriceValue]);
    const averageRating = useMemo(() => product?.rating ?? 4.5, [product?.rating]);
    const soldCount = useMemo(() => product?.soldCount ?? 0, [product?.soldCount]);
    const displaySoldCount = useMemo(() => soldCount > 999 ? `${(soldCount / 1000).toFixed(1)}k` : soldCount.toString(), [soldCount]);
    const allReviews = useMemo(() => { /* Review data */ if (product?.reviews && Array.isArray(product.reviews) && product.reviews.length > 0) { return product.reviews; } return [ { id: 'review-1', name: "Alice J.", rating: 5, date: "2 weeks ago", comment: "Absolutely love this! The quality is fantastic." }, { id: 'review-2', name: "Mark S.", rating: 4, date: "1 month ago", comment: "Good product overall. Meets expectations." }, { id: 'review-3', name: "Sarah K.", rating: 5, date: "3 days ago", comment: "Perfect fit and color is exactly as pictured. Would buy again!" }, { id: 'review-4', name: "David L.", rating: 3, date: "1 week ago", comment: "It's okay. Material feels a bit thinner than I thought it would be." }, { id: 'review-5', name: "Emily R.", rating: 5, date: "5 days ago", comment: "Super fast delivery and great product!" }, { id: 'review-6', name: "Michael B.", rating: 4, date: "1 day ago", comment: "Looks good, haven't used it much yet but seems solid." }, ]; }, [product?.reviews]);
    const displayReviews = useMemo(() => showAllReviews ? allReviews : allReviews.slice(0, MAX_INITIAL_REVIEWS), [showAllReviews, allReviews]);
    const hasBnplOption = useMemo(() => product?.bnplAvailable === true && Array.isArray(product.BNPLPlans) && product.BNPLPlans.length > 0, [product]);
    const bnplPlanGroups = useMemo(() => { /* Grouping logic */ if (!hasBnplOption || !product?.BNPLPlans) return {}; return product.BNPLPlans.reduce((acc, plan) => { if (!plan) return acc; const type = ['Installment', 'BNPL', 'PayLater'].includes(plan.planType) ? 'BNPL Plans' : plan.planType === 'Fixed Duration' ? 'Fixed Duration Plans' : 'Other Plans'; if (!acc[type]) acc[type] = []; acc[type].push(plan); return acc; }, {}); }, [product?.BNPLPlans, hasBnplOption]);
    // --- End Memos ---

    // --- Handlers ---
    const toggleWishlist = () => setIsWishlisted(!isWishlisted);
    const shareProduct = async () => { /* ... */ if (!product || !product.name) return; try { const message = `Check out: ${product.name} - ${mainFinalDisplayPrice || ''}`; const url = product?.productPageUrl; await Share.share({ message, ...(url && { url }) }); } catch (e) { console.error('Share err:', e.message); } };
    const onViewableItemsChanged = useRef(({ viewableItems }) => { if (viewableItems?.[0]?.index != null) { setActiveIndex(viewableItems[0].index); } }).current;
    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

    // Opens the modal ONLY if needed
    const openPaymentModal = (type) => {
        if (!product || !product.id) return;
        if (!selectedBnplPlan) { setSelectedPaymentMethod(null); } // Reset method if no plan was pre-selected
        setActionType(type);
        setIsPaymentModalVisible(true);
    };

     // Handles proceeding directly when only COD is available
    const proceedDirectlyWithCOD = (type) => {
         console.log(`Proceeding directly with COD for action: ${type}`);
         const actionDetails = { productId: product.id, productName: product.name, size: selectedSize, color: selectedColor, paymentMethod: 'COD', triggerAction: type, price: basePriceForBNPL, };
         console.log(`--- ${type === 'addToCart' ? 'Adding to Cart' : 'Buying Now'} (Direct COD) ---`); console.log("Details:", JSON.stringify(actionDetails, null, 2));
         // ** TODO: Implement actual logic here **
    };

    // Button Handlers check payment options
    const handleAddToCart = () => {
        if (!product || !product.id) return;
        const canCOD = product.codAvailable === true;
        const canBNPL = hasBnplOption && product.BNPLPlans.length > 0; // Use derived state

        if (canCOD && !canBNPL) { proceedDirectlyWithCOD('addToCart'); }
        else if (canCOD || canBNPL) { openPaymentModal('addToCart'); }
        else { console.log("No payment options available for Add to Cart."); /* Alert? */ }
    };

    const handleBuyNow = () => {
        if (!product || !product.id) return;
        const canCOD = product.codAvailable === true;
        const canBNPL = hasBnplOption && product.BNPLPlans.length > 0; // Use derived state

        if (canCOD && !canBNPL) { proceedDirectlyWithCOD('buyNow'); }
        else if (canCOD || canBNPL) { openPaymentModal('buyNow'); }
        else { console.log("No payment options available for Buy Now."); /* Alert? */ }
    };

    const handleChat = () => { console.log("Chat pressed"); };
    const handleSeeMoreReviews = () => setShowAllReviews(true);
    const handleSeeLessReviews = () => setShowAllReviews(false);

    // Handles proceed from Modal
    const handleProceedWithPayment = () => { /* ... same logic ... */ if (!selectedPaymentMethod || (selectedPaymentMethod === 'BNPL' && !selectedBnplPlan)) return; const actionDetails = { productId: product.id, productName: product.name, size: selectedSize, color: selectedColor, paymentMethod: selectedPaymentMethod, triggerAction: actionType, price: basePriceForBNPL, }; if (selectedPaymentMethod === 'BNPL') { let calculatedMonthly = null; if (selectedBnplPlan.duration > 0 && typeof selectedBnplPlan.interestRate === 'number' && basePriceForBNPL !== null && selectedBnplPlan.planType !== 'Fixed Duration') { const totalPrice = basePriceForBNPL * (1 + (selectedBnplPlan.interestRate / 100)); calculatedMonthly = totalPrice / selectedBnplPlan.duration; } else if (selectedBnplPlan.duration > 0 && selectedBnplPlan.interestRate === 0 && basePriceForBNPL !== null && selectedBnplPlan.planType !== 'Fixed Duration') { calculatedMonthly = basePriceForBNPL / selectedBnplPlan.duration; } actionDetails.bnplPlan = { id: selectedBnplPlan.id, name: selectedBnplPlan.planName, duration: selectedBnplPlan.duration, interestRate: selectedBnplPlan.interestRate, monthlyPayment: selectedBnplPlan.monthlyPayment, calculatedMonthly: calculatedMonthly ? Number(calculatedMonthly.toFixed(2)) : null }; } console.log(`--- ${actionType === 'addToCart' ? 'Adding to Cart' : 'Buying Now'} (From Modal) ---`); console.log("Details:", JSON.stringify(actionDetails, null, 2)); setIsPaymentModalVisible(false); };
    // --- End Handlers ---

    // --- Render Functions ---
    const renderGalleryItem = ({ item }) => { /* ... same ... */ if (item.isPlaceholder) { return <Image source={placeholderImage} style={styles.galleryItemImage} resizeMode="contain" />; } if (item.type === 'image') { return <Image source={{ uri: item.url }} style={styles.galleryItemImage} resizeMode="contain" onError={(e) => console.error(`Img Err (${item.url}):`, e.nativeEvent.error)} />; } if (item.type === 'video') { return <Video ref={(ref) => videoRefs.current[item.id] = ref} style={styles.galleryItemVideo} source={{ uri: item.url }} useNativeControls resizeMode={ResizeMode.CONTAIN} onError={(e) => console.error(`Vid Err (${item.url}):`, e)} />; } return null; };
    const renderTextPagination = () => { /* ... same ... */ if (galleryItems.length <= 1) return null; return (<View style={styles.paginationTextContainer}><Text style={styles.paginationText}>{activeIndex + 1}/{galleryItems.length}</Text></View>); };
    const renderPriceSection = () => { /* ... same ... */ if (!mainFinalDisplayPrice) return <Text style={styles.noPriceText}>Price unavailable</Text>; return ( <View style={styles.priceRow}><Text style={styles.finalPrice}>{mainFinalDisplayPrice}</Text>{hasDiscount && mainDisplayOriginalPrice && <Text style={styles.originalPrice}>{mainDisplayOriginalPrice}</Text>}</View> ); };
    const renderVariationSelector = (title, options, selected, setOption) => { /* ... same ... */ if (!options || options.length === 0) return null; return ( <View style={styles.variationContainer}><Text style={styles.variationTitle}>{title}: <Text style={styles.variationSelectedValue}>{selected || 'Select'}</Text></Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.variationOptionsScroll}>{options.map((o) => ( <TouchableOpacity key={o.toString()} style={[ styles.variationChip, selected === o && styles.variationChipActive ]} onPress={() => setOption(o)}><Text style={[ styles.variationChipText, selected === o && styles.variationChipTextActive ]}>{o}</Text></TouchableOpacity> ))}</ScrollView></View> ); };

    // Renders BNPL Plans Section on Main Page (SELECTABLE)
    const renderBnplPlansSection = () => {
        if (isLoadingPlans) { return ( <View style={styles.bnplSectionContainer}><Text style={styles.sectionTitle}>Installment Options</Text><ActivityIndicator style={{marginTop: 20}} size="small" color={AccentColor} /></View> ); }
        if (!hasBnplOption || !product?.BNPLPlans || product.BNPLPlans.length === 0 || basePriceForBNPL === null) return null;
        const formatCurrency = (v) => (typeof v === 'number' ? `${CURRENCY_SYMBOL}: ${v.toFixed(0)}` : null);

        const handlePlanSelection = (plan) => {
            setSelectedBnplPlan(plan); setSelectedPaymentMethod('BNPL');
        };

        const renderSinglePlanCard = (plan, index, arrayLength) => { if (!plan) return null;
            const isSelectedOnMain = selectedBnplPlan?.id === plan.id;
            const p = plan; const name = p.planName || 'Unnamed'; const dur = typeof p.duration === 'number' ? p.duration : null; const irv = typeof p.interestRate === 'number' ? p.interestRate : null; const ird = irv !== null ? `${irv.toFixed(1)}%` : null; const pt = p.planType || 'Gen'; const pid = p.id || `p-${index}`; const last = index === arrayLength - 1; const fd = pt === 'Fixed Duration'; let totalPriceNumeric = null; let ftpi = null; if (irv !== null && basePriceForBNPL !== null) { totalPriceNumeric = basePriceForBNPL * (1 + (irv / 100)); ftpi = formatCurrency(totalPriceNumeric); } else if (irv === 0 && basePriceForBNPL !== null) { totalPriceNumeric = basePriceForBNPL; ftpi = formatCurrency(totalPriceNumeric); } const ni = !fd && dur !== null ? dur : 1; let calculatedMonthlyPayment = null; if (!fd && dur > 0 && totalPriceNumeric !== null) { calculatedMonthlyPayment = formatCurrency(totalPriceNumeric / dur); }
            return ( <TouchableOpacity key={pid} style={[ styles.bnplPlanCard, !last && styles.bnplPlanCardSeparator, isSelectedOnMain && styles.bnplPlanCardSelected ]} onPress={() => handlePlanSelection(plan)} activeOpacity={0.7}>
                    <View style={styles.bnplPlanHeader}><MaterialIcons name="payments" size={18} color={BnplPlanIconColor} style={styles.bnplPlanIcon} /><Text style={styles.bnplPlanNameText}>{name}</Text></View>
                    <View style={styles.bnplPlanDetails}>
                        <View style={styles.detailRow}><MaterialIcons name="info-outline" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} /><Text style={styles.bnplPlanDetailText}>Type: <Text style={styles.bnplPlanDetailValue}>{pt}</Text></Text></View>
                        {dur !== null && (<View style={styles.detailRow}><MaterialIcons name="schedule" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} /><Text style={styles.bnplPlanDetailText}>Duration: <Text style={styles.bnplPlanDetailValue}> {dur} {dur === 1 ? 'Month' : 'Months'}</Text>{fd ? (<Text style={styles.bnplPlanDetailValue}> (1 Pay)</Text>) : (<Text style={styles.bnplPlanDetailValue}> / {ni} Ins</Text>)}</Text></View>)}
                        {calculatedMonthlyPayment !== null && (<View style={styles.detailRow}><MaterialIcons name="calculate" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} /><Text style={styles.bnplPlanDetailText}>Monthly: <Text style={styles.bnplPlanDetailValue}>{calculatedMonthlyPayment}</Text></Text></View>)}
                        <View style={styles.detailRow}><MaterialIcons name="percent" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} /><Text style={styles.bnplPlanDetailText}>Interest: <Text style={styles.bnplPlanDetailValue}>{ird ?? 'N/A'}</Text></Text></View>
                        {ftpi && (<View style={styles.detailRow}><MaterialIcons name="monetization-on" size={14} color={BnplPlanDetailIconColor} style={styles.detailIcon} /><Text style={styles.bnplPlanDetailText}>Total Price: <Text style={styles.bnplPlanDetailValue}>{ftpi}</Text></Text></View>)}
                    </View>
                </TouchableOpacity> );};
        if (Object.keys(bnplPlanGroups).length === 0) return null;
        return ( <View style={styles.bnplSectionContainer}><Text style={styles.sectionTitle}>Installment Options (Tap to Select)</Text>{Object.entries(bnplPlanGroups).map(([groupTitle, plans]) => (<View key={groupTitle} style={styles.bnplGroupContainer}><Text style={styles.bnplGroupTitle}>{groupTitle}</Text>{plans.map(renderSinglePlanCard)}</View>))}</View> );
    };
    const renderReviewCard = ({ item, index, totalItems }) => { /* ... same ... */ if (!item) return null; const last = index === totalItems - 1; return ( <View style={[ styles.reviewCard, last && { borderBottomWidth: 0 } ]}><View style={styles.reviewHeader}><View style={styles.reviewHeaderRating}>{[...Array(5)].map((_, i) => ( <MaterialIcons key={`s-${item.id||index}-${i}`} name="star" size={16} color={i < item.rating ? StarColor : PlaceholderStarColor} /> ))}</View><Text style={styles.reviewerName}>{item.name || 'Anon'}<Text style={styles.reviewDate}> · {item.date || ''}</Text></Text></View><Text style={styles.reviewText}>{item.comment || ''}</Text></View> ); };
    const renderRelatedProductCard = ({ item }) => { /* ... same (original layout) ... */ if (item.isPlaceholder) return <View style={styles.relatedProductCardPlaceholder} />; if (!item || !item.id) return null; const disc = typeof item.discountedPrice === 'number' && typeof item.originalPrice === 'number' && item.discountedPrice < item.originalPrice; const op = typeof item.originalPrice === 'number' ? `${CURRENCY_SYMBOL} ${item.originalPrice.toFixed(0)}` : null; const dp = typeof item.discountedPrice === 'number' ? `${CURRENCY_SYMBOL} ${item.discountedPrice.toFixed(0)}` : null; const bnpl = item.bnplAvailable === true; const cod = item.codAvailable === true && !bnpl; return ( <TouchableOpacity style={styles.relatedProductCard} onPress={() => navigation.push('ProductDetails', { product: item })} activeOpacity={0.8}><Image source={item.image ? { uri: item.image } : placeholderImage} style={styles.relatedCardImage} resizeMode="contain" /><Text style={styles.relatedCardName} numberOfLines={1}>{item.name || ''}</Text><View style={styles.relatedCardPriceContainer}>{disc ? (<>{op && ( <Text style={[styles.relatedCardProductPrice, styles.relatedCardStrikethroughPrice]}>{op}</Text> )}{dp && ( <Text style={styles.relatedCardDiscountedPrice}>{dp}</Text> )}</>) : (<>{op ? ( <Text style={styles.relatedCardDiscountedPrice}>{op}</Text> ) : dp ? ( <Text style={styles.relatedCardDiscountedPrice}>{dp}</Text> ) : ( <View style={styles.relatedCardPricePlaceholder} /> )}</>)}</View>{item.description ? ( <Text style={styles.relatedCardDescription} numberOfLines={2}>{item.description}</Text> ) : <View style={styles.relatedCardDescriptionPlaceholder}/> }{bnpl ? (<View style={styles.relatedCardBnplBadge}><MaterialIcons name="schedule" size={14} color={BnplBadgeText} /><Text style={styles.relatedCardBnplText}>BNPL Available</Text></View>) : cod ? (<View style={styles.relatedCardCodBadge}><MaterialIcons name="local-shipping" size={14} color={CodBadgeText} /><Text style={styles.relatedCardCodText}>COD Available</Text></View>) : (<View style={styles.relatedCardBadgePlaceholder} />)}</TouchableOpacity> ); };
    const renderRelatedProductsSection = () => { /* ... same ... */ if (loadingRelatedProducts) { return ( <View style={styles.relatedLoadingContainer}><ActivityIndicator size="large" color={AccentColor} /><Text style={styles.relatedLoadingText}>Loading Related...</Text></View> ); } if (!relatedProducts || relatedProducts.length === 0) { return null; } return ( <View style={styles.relatedProductsContainer}><Text style={styles.relatedProductsTitle}>Related Products</Text><FlatList data={relatedProducts} renderItem={renderRelatedProductCard} keyExtractor={(i) => i.id} numColumns={2} key={`rel-grid-2`} scrollEnabled={false} contentContainerStyle={styles.relatedProductsGridContainer} /></View> ); };

    // Renders the Payment Selection Modal (Reflects external selection, separate row layout)
    const renderPaymentModal = () => {
        if (!product) return null;

        const disabled = !selectedPaymentMethod || (selectedPaymentMethod === 'BNPL' && !selectedBnplPlan);
        const hasCod = product?.codAvailable === true;
        const formatModCur = (v) => (typeof v === 'number' ? `${CURRENCY_SYMBOL}: ${v.toFixed(0)}` : '');

        // Renders a single plan row inside the modal
        const renderModalPlanRow = (plan) => {
            if (!plan || !plan.id) return null;
            const isSelected = selectedBnplPlan?.id === plan.id;
            const planName = plan.planName || 'Unnamed Plan';
            const duration = typeof plan.duration === 'number' ? plan.duration : null;
            const interestRateValue = typeof plan.interestRate === 'number' ? plan.interestRate : null;
            const interestRateDisplay = interestRateValue !== null ? `${interestRateValue.toFixed(1)}%` : null;
            const planType = plan.planType || 'General';
            const isFixedDurationPlan = plan.planType === 'Fixed Duration';
            let totalPriceNumeric = null;
            let formattedTotalPriceWithInterest = null;
            if (interestRateValue !== null && basePriceForBNPL !== null) { totalPriceNumeric = basePriceForBNPL * (1 + (interestRateValue / 100)); formattedTotalPriceWithInterest = formatModCur(totalPriceNumeric); } else if (interestRateValue === 0 && basePriceForBNPL !== null) { totalPriceNumeric = basePriceForBNPL; formattedTotalPriceWithInterest = formatModCur(totalPriceNumeric); }
            let calculatedMonthlyPaymentModal = null;
            if (!isFixedDurationPlan && duration !== null && duration > 0 && totalPriceNumeric !== null) { calculatedMonthlyPaymentModal = formatModCur(totalPriceNumeric / duration); }
            const numberOfInstallments = !isFixedDurationPlan && duration !== null ? duration : 1;

            return (
                <TouchableOpacity key={plan.id} style={[ styles.bnplPlanOption, isSelected && styles.bnplPlanOptionSelected ]} onPress={() => setSelectedBnplPlan(plan)} activeOpacity={0.7}>
                    <Text style={styles.bnplPlanNameModal}>{planName}</Text>
                    <View style={styles.modalPlanDetailsContainer}>
                        <View style={styles.modalDetailRow}><MaterialIcons name="info-outline" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} /><Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Type: </Text><Text style={styles.modalPlanDetailValue}>{planType}</Text></Text></View>
                        {duration !== null && (<View style={styles.modalDetailRow}><MaterialIcons name="schedule" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} /><Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Duration: </Text><Text style={styles.modalPlanDetailValue}>{duration} {duration === 1 ? 'Month' : 'Months'}</Text>{isFixedDurationPlan ? (<Text style={styles.modalPlanDetailValue}> (1 Pay)</Text>) : (<Text style={styles.modalPlanDetailValue}> / {numberOfInstallments} Ins</Text>)}</Text></View>)}
                        {calculatedMonthlyPaymentModal !== null && (<View style={styles.modalDetailRow}><MaterialIcons name="calculate" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} /><Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Monthly: </Text><Text style={styles.modalPlanDetailValue}>{calculatedMonthlyPaymentModal}</Text></Text></View> )}
                         <View style={styles.modalDetailRow}><MaterialIcons name="percent" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} /><Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Interest: </Text><Text style={styles.modalPlanDetailValue}>{interestRateDisplay ?? 'N/A'}</Text></Text></View>
                        {formattedTotalPriceWithInterest && (<View style={styles.modalDetailRow}><MaterialIcons name="monetization-on" size={13} color={BnplPlanDetailIconColor} style={styles.modalDetailIcon} /><Text style={styles.modalPlanDetailText}><Text style={styles.modalPlanDetailLabel}>Total Price: </Text><Text style={styles.modalPlanDetailValue}>{formattedTotalPriceWithInterest}</Text></Text></View>)}
                    </View>
                </TouchableOpacity> ); };

        return (<Modal visible={isPaymentModalVisible} transparent={true} animationType="slide" onRequestClose={() => setIsPaymentModalVisible(false)}>
                <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPressOut={() => setIsPaymentModalVisible(false)} />
                <View style={styles.modalContainer}>
                    <TouchableOpacity style={styles.modalCloseButton} onPress={() => setIsPaymentModalVisible(false)}><MaterialIcons name="close" size={24} color={TextColorSecondary} /></TouchableOpacity>
                    <Text style={styles.modalTitle}>Select Payment Option</Text>
                    <View style={styles.paymentOptionsRowContainer}>
                        {hasCod && (<TouchableOpacity style={[ styles.paymentOptionButtonRow, selectedPaymentMethod === 'COD' && styles.paymentOptionSelected ]} onPress={() => { setSelectedPaymentMethod('COD'); setSelectedBnplPlan(null); }} activeOpacity={0.7}><Text style={[styles.paymentOptionTextRow, selectedPaymentMethod === 'COD' && styles.paymentOptionTextSelected]}>Cash on Delivery</Text></TouchableOpacity>)}
                        {hasBnplOption && (<TouchableOpacity style={[ styles.paymentOptionButtonRow, selectedPaymentMethod === 'BNPL' && styles.paymentOptionSelected ]} onPress={() => setSelectedPaymentMethod('BNPL')} activeOpacity={0.7}><Text style={[styles.paymentOptionTextRow, selectedPaymentMethod === 'BNPL' && styles.paymentOptionTextSelected]}>Buy Now Pay Later</Text></TouchableOpacity>)}
                    </View>
                    {!hasCod && !hasBnplOption && (<Text style={styles.noPaymentOptionsText}>No payment options available.</Text>)}
                    {selectedPaymentMethod === 'BNPL' && hasBnplOption && (
                        <View style={styles.bnplPlanSelectionContainer}>
                            <Text style={styles.modalSubtitle}>Select Your Plan</Text>
                             {isLoadingPlans ? (<ActivityIndicator style={{marginVertical: 20}} size="small" color={AccentColor} />) : (
                                <ScrollView style={styles.bnplPlanScrollView} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                                    {Object.keys(bnplPlanGroups).length > 0 ? ( Object.entries(bnplPlanGroups).map(([groupTitle, plans]) => ( <View key={groupTitle} style={styles.modalPlanGroup}><Text style={styles.modalPlanGroupTitle}>{groupTitle}</Text>{plans.map(renderModalPlanRow)}</View> ))) : ( <Text style={styles.noPaymentOptionsText}>No BNPL plans found.</Text> )}
                                </ScrollView>
                            )}
                        </View>
                    )}
                    <TouchableOpacity style={[ styles.proceedButton, disabled && styles.proceedButtonDisabled ]} onPress={handleProceedWithPayment} disabled={disabled} activeOpacity={disabled ? 1 : 0.7}>
                        <Text style={styles.proceedButtonText}>{actionType === 'addToCart' ? 'Confirm & Add' : 'Confirm & Proceed'}</Text>
                    </TouchableOpacity>
                </View>
            </Modal>);
    };
    // --- End Render Functions ---

    // --- Loading / Error States ---
    if (isLoadingProduct) { return ( <SafeAreaView style={styles.safeArea}><StatusBar barStyle="dark-content" backgroundColor={AppBackgroundColor} /><View style={styles.loadingContainer}><ActivityIndicator size="large" color={AccentColor} /><Text style={styles.errorText}>Loading...</Text></View></SafeAreaView> ); }
    if (!product || !product.id) { return ( <SafeAreaView style={styles.safeArea}><StatusBar barStyle="dark-content" backgroundColor={AppBackgroundColor} /><View style={styles.loadingContainer}><MaterialIcons name="error-outline" size={40} color={TextColorSecondary} /><Text style={styles.errorText}>Product not found.</Text><TouchableOpacity onPress={() => navigation.goBack()} style={{marginTop: 20}}><Text style={{color: AccentColor}}>Go Back</Text></TouchableOpacity></View></SafeAreaView> ); }

    // --- Main Return ---
    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
            <StatusBar barStyle="dark-content" backgroundColor={AppBackgroundColor} />
            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.galleryWrapper}><FlatList ref={flatListRef} data={galleryItems} renderItem={renderGalleryItem} keyExtractor={(i) => i.id} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onViewableItemsChanged={onViewableItemsChanged} viewabilityConfig={viewabilityConfig} scrollEventThrottle={16} style={styles.galleryFlatList} initialNumToRender={1} maxToRenderPerBatch={1} windowSize={3} /><View style={styles.galleryOverlayContainer}>{renderTextPagination()}</View></View>
                <View style={styles.contentContainer}>
                    <Text style={styles.productName}>{product.name ?? 'Product'}</Text>
                    <Text style={styles.soldCountText}>{displaySoldCount} sold</Text>
                    <View style={styles.priceActionsRow}>{renderPriceSection()}<View style={styles.rightActionButtonsGroup}><TouchableOpacity onPress={toggleWishlist} style={styles.iconButton} activeOpacity={0.7}><MaterialIcons name={isWishlisted ? 'favorite' : 'favorite-border'} size={24} color={isWishlisted ? AccentColor : TextColorPrimary} /></TouchableOpacity><TouchableOpacity onPress={shareProduct} style={[styles.iconButton, { marginLeft: 10 }]} activeOpacity={0.7}><Feather name="share-2" size={22} color={TextColorPrimary} /></TouchableOpacity></View></View>
                    {/* REMOVED BNPL Info Badge */}
                    {renderVariationSelector('Size', product.variations?.sizes, selectedSize, setSelectedSize)}
                    {renderVariationSelector('Color', product.variations?.colors, selectedColor, setSelectedColor)}
                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.descriptionText}>{product.description || 'No description.'}</Text>
                    {renderBnplPlansSection()}
                     <View style={styles.reviewSectionWrapper}>
                        <View style={styles.reviewSectionHeader}><Text style={styles.sectionTitle}>Reviews ({allReviews.length})</Text><View style={styles.reviewOverallRating}><MaterialIcons name="star" size={18} color={StarColor} style={{ marginRight: 4 }}/><Text style={styles.reviewOverallRatingText}>{averageRating.toFixed(1)}</Text></View></View>
                        <FlatList data={displayReviews} renderItem={renderReviewCard} keyExtractor={(i, idx) => (i.id ? i.id.toString() : `r-${idx}`)} scrollEnabled={false} ListEmptyComponent={<Text style={styles.noReviewsText}>No reviews yet.</Text>} />
                        {allReviews.length > MAX_INITIAL_REVIEWS && ( <View>{!showAllReviews ? ( <TouchableOpacity style={styles.seeMoreButton} onPress={handleSeeMoreReviews} activeOpacity={0.7}><Text style={styles.seeMoreButtonText}>See More</Text><MaterialIcons name="keyboard-arrow-down" size={20} color={AccentColor} /></TouchableOpacity> ) : ( <TouchableOpacity style={styles.seeMoreButton} onPress={handleSeeLessReviews} activeOpacity={0.7}><Text style={styles.seeMoreButtonText}>See Less</Text><MaterialIcons name="keyboard-arrow-up" size={20} color={AccentColor} /></TouchableOpacity> )}</View> )}
                    </View>
                </View>
                {renderRelatedProductsSection()}
                 <View style={styles.relatedProductsBottomPadding} />
            </ScrollView>
            <View style={styles.buttonContainer}>
                 <TouchableOpacity style={[styles.bottomButtonBase, styles.chatButton]} onPress={handleChat} activeOpacity={0.7}><MaterialIcons name="support-agent" size={22} color={ChatIconColor} style={{ marginBottom: 2 }}/><Text style={[styles.buttonText, styles.chatButtonText]}>Chat</Text></TouchableOpacity>
                 <TouchableOpacity style={[styles.bottomButtonBase, styles.cartButton]} onPress={handleAddToCart} activeOpacity={0.7}><Text style={[styles.buttonText, styles.cartButtonText]}>Add to Cart</Text></TouchableOpacity>
                 <TouchableOpacity style={styles.buyButtonContainer} onPress={handleBuyNow} activeOpacity={0.8}><LinearGradient colors={[AccentColor, AccentDarkerColor]} style={styles.buyButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}><Text style={[styles.buttonText, styles.buyButtonText]}>Buy Now</Text></LinearGradient></TouchableOpacity>
            </View>
            {renderPaymentModal()}
        </SafeAreaView>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    // ... (All styles from safeArea down to relatedProductsBottomPadding remain the same) ...
    safeArea: { flex: 1, backgroundColor: AppBackgroundColor },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: AppBackgroundColor },
    errorText: { fontSize: 16, color: TextColorSecondary, textAlign: 'center', marginTop: 10 },
    scrollContainer: { paddingBottom: 100, backgroundColor: AppBackgroundColor },
    galleryWrapper: { backgroundColor: AppBackgroundColor, position: 'relative' },
    galleryFlatList: { width: screenWidth, height: GALLERY_HEIGHT },
    galleryItemImage: { width: screenWidth, height: GALLERY_HEIGHT, backgroundColor: PlaceholderBgColor },
    galleryItemVideo: { width: screenWidth, height: GALLERY_HEIGHT, backgroundColor: '#000' },
    galleryOverlayContainer: { position: 'absolute', top: 15, left: 15, right: 15, bottom: 15, pointerEvents: 'box-none' },
    paginationTextContainer: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0, 0, 0, 0.6)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
    paginationText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
    contentContainer: { paddingHorizontal: 20, paddingTop: 20 },
    productName: { fontSize: 24, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 4, lineHeight: 30 },
    soldCountText: { fontSize: 14, color: TextColorSecondary, marginBottom: 12 },
    priceActionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, minHeight: 30 },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', flexShrink: 1, marginRight: 10 },
    finalPrice: { fontSize: 20, fontWeight: 'bold', color: AccentColor },
    originalPrice: { fontSize: 14, color: TextColorSecondary, textDecorationLine: 'line-through', marginLeft: 8 },
    noPriceText: { fontSize: 16, color: TextColorSecondary, fontStyle: 'italic' },
    rightActionButtonsGroup: { flexDirection: 'row', alignItems: 'center' },
    iconButton: { padding: 5 },
    // bnplInfoContainer REMOVED
    // bnplInfoText REMOVED
    variationContainer: { marginBottom: 20 },
    variationTitle: { fontSize: 16, fontWeight: '600', color: TextColorPrimary, marginBottom: 10 },
    variationSelectedValue: { fontWeight: 'normal', color: TextColorSecondary },
    variationOptionsScroll: { paddingBottom: 5 },
    variationChip: { borderWidth: 1, borderColor: LightBorderColor, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, marginRight: 10, backgroundColor: AppBackgroundColor },
    variationChipActive: { borderColor: AccentColor, backgroundColor: ModalSelectedBg },
    variationChipText: { fontSize: 14, color: TextColorPrimary },
    variationChipTextActive: { color: AccentColor, fontWeight: '600' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 15, },
    descriptionText: { fontSize: 15, color: TextColorSecondary, lineHeight: 24, marginBottom: 25 },
    bnplSectionContainer: { marginTop: 20, marginBottom: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: LightBorderColor, },
    bnplGroupContainer: { marginBottom: 15, },
    bnplGroupTitle: { fontSize: 15, fontWeight: '600', color: TextColorSecondary, marginBottom: 8, },
    bnplPlanCard: { backgroundColor: BnplPlanCardBg, borderRadius: 6, borderWidth: 1, borderColor: BnplPlanCardBorder, paddingVertical: 10, paddingHorizontal: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1.5, elevation: 1, },
    bnplPlanCardSelected: { borderColor: AccentColor, backgroundColor: ModalSelectedBg, borderWidth: 1.5, shadowColor: AccentColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 4, },
    bnplPlanCardSeparator: { marginBottom: 10 },
    bnplPlanHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, },
    bnplPlanIcon: { marginRight: 8 },
    bnplPlanNameText: { fontSize: 15, fontWeight: '600', color: BnplPlanNameColor, flexShrink: 1 },
    bnplPlanDetails: { paddingLeft: 0, },
    detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, },
    detailIcon: { marginRight: 8, width: 16, textAlign: 'center', color: BnplPlanDetailIconColor, },
    bnplPlanDetailText: { fontSize: 12, color: BnplPlanDetailColor, lineHeight: 18, flexShrink: 1, },
    bnplPlanDetailValue: { fontWeight: '600', color: BnplPlanValueColor, },
    reviewSectionWrapper: { marginBottom: 10 },
    reviewSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
    reviewOverallRating: { flexDirection: 'row', alignItems: 'center' },
    reviewOverallRatingText: { fontSize: 16, fontWeight: 'bold', color: TextColorPrimary, marginLeft: 2 },
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
    relatedProductsTitle: { fontSize: 18, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 15, paddingHorizontal: 20, },
    relatedLoadingContainer: { minHeight: 280, justifyContent: 'center', alignItems: 'center', marginVertical: 20, backgroundColor: RelatedSectionBgColor, paddingHorizontal: 20, },
    relatedLoadingText: { marginTop: 10, fontSize: 14, color: TextColorSecondary, },
    relatedProductsGridContainer: { paddingHorizontal: GRID_PADDING_HORIZONTAL, },
    relatedProductCard: { backgroundColor: '#fff', borderRadius: 8, margin: CARD_MARGIN_HORIZONTAL, width: relatedCardWidth, alignItems: 'center', padding: 18, paddingBottom: 4, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.20, shadowRadius: 1.41, minHeight: 280, justifyContent: 'space-between', },
    relatedProductCardPlaceholder: { margin: CARD_MARGIN_HORIZONTAL, width: relatedCardWidth, minHeight: 280, backgroundColor: 'transparent', },
    relatedCardImage: { width: '100%', height: 110, borderRadius: 6, marginBottom: 8, backgroundColor: 'white', },
    relatedCardName: { fontSize: 14, fontWeight: '600', color: TextColorPrimary, textAlign: 'center', minHeight: 18, marginBottom: 4, paddingHorizontal: 2, },
    relatedCardPriceContainer: { flexDirection: 'column', alignItems: 'center', marginTop: 4, minHeight: 35, marginBottom: 6, justifyContent: 'center', },
    relatedCardProductPrice: { fontSize: 14, color: AccentColor, fontWeight: 'bold', },
    relatedCardStrikethroughPrice: { textDecorationLine: 'line-through', color: StrikethroughColor, fontWeight: 'normal', fontSize: 13, },
    relatedCardDiscountedPrice: { fontSize: 15, color: DiscountedPriceColor, fontWeight: 'bold', },
    relatedCardPricePlaceholder: { height: 20, minHeight: 35, marginBottom: 6, marginTop: 4, },
    relatedCardDescription: { fontSize: 12, color: TextColorSecondary, textAlign: 'center', marginTop: 4, marginBottom: 6, paddingHorizontal: 5, minHeight: 28, },
    relatedCardDescriptionPlaceholder: { height: 28, marginBottom: 6, marginTop: 4, },
    relatedCardBnplBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: BnplBadgeBg, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, marginTop: 'auto', marginBottom: 4, alignSelf: 'center', height: 24, },
    relatedCardBnplText: { fontSize: 11, color: BnplBadgeText, marginLeft: 4, fontWeight: '600', },
    relatedCardCodBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: CodBadgeBg, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, marginTop: 'auto', marginBottom: 4, alignSelf: 'center', height: 24, },
    relatedCardCodText: { fontSize: 11, color: CodBadgeText, marginLeft: 4, fontWeight: '600', },
    relatedCardBadgePlaceholder: { height: 24, marginTop: 'auto', marginBottom: 4 },
    relatedProductsBottomPadding: { height: 15, backgroundColor: RelatedSectionBgColor },
    buttonContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: AppBackgroundColor, paddingVertical: 8, paddingHorizontal: 8, paddingBottom: Platform.OS === 'ios' ? 26 : 8, borderTopWidth: 1, borderTopColor: LightBorderColor, alignItems: 'stretch', },
    bottomButtonBase: { borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4, overflow: 'hidden', },
    chatButton: { flex: 0.6, flexDirection: 'column', backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#E0E0E0', paddingVertical: 6, },
    chatButtonText: { color: ChatIconColor, fontSize: 11, fontWeight: '600', marginTop: 2, },
    cartButton: { flex: 1, flexDirection: 'row', backgroundColor: AppBackgroundColor, borderWidth: 1.5, borderColor: AccentColor, paddingVertical: 12, },
    cartButtonText: { color: AccentColor, fontSize: 16, fontWeight: 'bold', },
    buyButtonContainer: { flex: 1, borderRadius: 10, marginHorizontal: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.20, shadowRadius: 3.84, elevation: 5, },
    buyButtonGradient: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center', justifyContent: 'center', },
    buyButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', },
    buttonText: { textAlign: 'center', },

    // --- Payment Modal Styles (RESTORED Single Row Layout for Plans) ---
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.5)', },
    modalContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: AppBackgroundColor, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 40, paddingBottom: Platform.OS === 'ios' ? 40 : 30, maxHeight: '80%', shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 10, },
    modalCloseButton: { position: 'absolute', top: 10, right: 15, padding: 5, zIndex: 1, },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: TextColorPrimary, textAlign: 'center', marginBottom: 20, },
    modalSubtitle: { fontSize: 16, fontWeight: '600', color: TextColorPrimary, marginBottom: 15, },
    paymentOptionsRowContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, },
    paymentOptionButtonRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1.5, borderColor: LightBorderColor, borderRadius: 8, marginHorizontal: 5, },
    paymentOptionSelected: { borderColor: ModalSelectedBorderColor, backgroundColor: ModalSelectedBg, },
    paymentOptionTextRow: { fontSize: 14, color: TextColorPrimary, textAlign: 'center', },
    paymentOptionTextSelected: { fontWeight: 'bold', color: ModalSelectedTextColor, },
    noPaymentOptionsText: { fontSize: 14, color: TextColorSecondary, textAlign: 'center', marginTop: 10, },
    bnplPlanSelectionContainer: { borderTopWidth: 1, borderTopColor: LightBorderColor, paddingTop: 15, marginBottom: 20, flexShrink: 1, },
    bnplPlanScrollView: { maxHeight: Platform.OS === 'ios' ? 220 : 180, },
    modalPlanGroup: { marginBottom: 15, },
    modalPlanGroupTitle: { fontSize: 13, fontWeight: 'bold', color: TextColorSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, },
    bnplPlanOption: { padding: 12, borderWidth: 1, borderColor: LightBorderColor, borderRadius: 8, marginBottom: 12, },
    bnplPlanOptionSelected: { borderColor: ModalSelectedBorderColor, backgroundColor: ModalSelectedBg, },
    bnplPlanNameModal: { fontSize: 15, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 10, },
    modalPlanDetailsContainer: { paddingLeft: 5, },
    modalDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, },
    modalDetailIcon: { marginRight: 8, width: 16, textAlign: 'center', color: BnplPlanDetailIconColor, },
    modalPlanDetailText: { fontSize: 12, color: TextColorSecondary, lineHeight: 18, flexShrink: 1, },
    modalPlanDetailLabel: { color: TextColorSecondary, },
    modalPlanDetailValue: { fontWeight: '600', color: TextColorPrimary, },
    modalPlanTotalText: { fontWeight: 'bold' },
    proceedButton: { backgroundColor: AccentColor, paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginTop: 10, },
    proceedButtonDisabled: { backgroundColor: ModalProceedDisabledBg, opacity: 0.7, },
    proceedButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', },
});