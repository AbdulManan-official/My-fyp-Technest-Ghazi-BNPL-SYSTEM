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
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, where, getDocs, limit, orderBy, documentId } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

// --- Constants ---
const AppBackgroundColor = '#FFFFFF';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#666666';
const AccentColor = '#D32F2F'; // Or your specific red like '#FF0000' if used in HomeScreen
const AccentDarkerColor = '#B71C1C'; // Or a darker version of your AccentColor
const LightBorderColor = '#EEEEEE';
const PlaceholderBgColor = '#F0F0F0';
const RelatedSectionBgColor = '#FAFAFA';
const BnplInfoBgColor = '#E8F5E9';
const BnplInfoTextColor = '#1B5E20';
const BnplPlanCardBg = '#F8F9FA';
const BnplPlanCardBorder = '#DEE2E6';
const BnplPlanIconColor = AccentColor;
const BnplPlanNameColor = TextColorPrimary;
const BnplPlanDetailColor = TextColorSecondary;
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

const placeholderImage = require('../../assets/p3.jpg'); // Make sure path is correct
const { width: screenWidth } = Dimensions.get('window');
const GALLERY_HEIGHT = screenWidth * 0.9;
const MAX_INITIAL_REVIEWS = 2;
const RELATED_PRODUCTS_LIMIT = 6;
const CURRENCY_SYMBOL = 'RS';

// --- Calculate Fixed Card Width ---
const GRID_PADDING_HORIZONTAL = 15; // Must match relatedProductsGridContainer paddingHorizontal
const CARD_MARGIN_HORIZONTAL = 4; // Must match relatedProductCard margin horizontal (from margin: 4)
const NUM_COLUMNS = 2;
const totalPadding = GRID_PADDING_HORIZONTAL * 2;
const totalMargins = CARD_MARGIN_HORIZONTAL * 2 * NUM_COLUMNS; // Margins on both sides of each card in a conceptual row
const spaceBetweenColumns = CARD_MARGIN_HORIZONTAL * 2 * (NUM_COLUMNS - 1); // Space just between columns
const availableWidth = screenWidth - totalPadding;
// Correct calculation: (Total Available Width - Space *Between* Columns) / Num Columns
const relatedCardWidth = (availableWidth - spaceBetweenColumns) / NUM_COLUMNS;
// --- End Card Width Calculation ---


export default function ProductDetailsScreen() {
    const route = useRoute();
    const navigation = useNavigation();

    const product = route.params?.product ?? { BNPLPlans: [], id: null, category: null, name: 'Loading...' };

    // State variables
    const [isWishlisted, setIsWishlisted] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [selectedSize, setSelectedSize] = useState(product?.variations?.sizes?.[0] || null);
    const [selectedColor, setSelectedColor] = useState(product?.variations?.colors?.[0] || null);
    const [showAllReviews, setShowAllReviews] = useState(false);
    const [relatedProducts, setRelatedProducts] = useState([]);
    const [loadingRelatedProducts, setLoadingRelatedProducts] = useState(true);

    // Refs
    const flatListRef = useRef(null);
    const videoRefs = useRef({});

    // Memos and Calculations
    const galleryItems = useMemo(() => {
        if (!product || (!product.media && !product.image)) return [{ type: 'image', url: null, id: 'placeholder-img', isPlaceholder: true }];
        const items = []; const seenUrls = new Set();
        const addItem = (item) => { if (item.url && typeof item.url === 'string' && !seenUrls.has(item.url)) { items.push(item); seenUrls.add(item.url); } else if (item.isPlaceholder) { items.push(item); } };
        if (product.media?.images && Array.isArray(product.media.images)) { product.media.images.forEach(url => addItem({ type: 'image', url: url, id: `img-${url}` })); }
        const videoUrl = product.media?.video; if (videoUrl) { addItem({ type: 'video', url: videoUrl, id: `vid-${videoUrl}` }); }
        if (product.image) { const fallbackAlreadyAdded = items.some(item => item.type === 'image' && item.url === product.image); if (!fallbackAlreadyAdded) { if (items.filter(i => i.type === 'image').length === 0) { items.unshift({ type: 'image', url: product.image, id: `img-fallback-${product.image}` }); } else { items.push({ type: 'image', url: product.image, id: `img-fallback-${product.image}` }); } } }
        if (items.length === 0) { items.push({ type: 'image', url: null, id: 'placeholder-img', isPlaceholder: true }); } return items;
    }, [product]);
    const originalPriceValue = typeof product?.originalPrice === 'number' ? product.originalPrice : null;
    const discountedPriceValue = typeof product?.discountedPrice === 'number' ? product.discountedPrice : null;
    const hasDiscount = originalPriceValue !== null && discountedPriceValue !== null && discountedPriceValue < originalPriceValue;
    const mainDisplayOriginalPrice = originalPriceValue !== null ? `PKR ${originalPriceValue.toFixed(0)}` : null;
    const mainDisplayDiscountedPrice = discountedPriceValue !== null ? `PKR ${discountedPriceValue.toFixed(0)}` : null;
    const mainFinalDisplayPrice = mainDisplayDiscountedPrice || mainDisplayOriginalPrice;
    const basePriceForBNPL = (hasDiscount && discountedPriceValue !== null) ? discountedPriceValue : (originalPriceValue !== null) ? originalPriceValue : null;
    const averageRating = product?.rating ?? 4.5;
    const soldCount = product?.soldCount ?? 0;
    const displaySoldCount = soldCount > 999 ? `${(soldCount / 1000).toFixed(1)}k` : soldCount.toString();
    const allReviews = useMemo(() => { if (product?.reviews && Array.isArray(product.reviews) && product.reviews.length > 0) { return product.reviews; } return [ { id: 'review-1', name: "Alice J.", rating: 5, date: "2 weeks ago", comment: "Absolutely love this! The quality is fantastic." }, { id: 'review-2', name: "Mark S.", rating: 4, date: "1 month ago", comment: "Good product overall. Meets expectations." }, { id: 'review-3', name: "Sarah K.", rating: 5, date: "3 days ago", comment: "Perfect fit and color is exactly as pictured. Would buy again!" }, { id: 'review-4', name: "David L.", rating: 3, date: "1 week ago", comment: "It's okay. Material feels a bit thinner than I thought it would be." }, { id: 'review-5', name: "Emily R.", rating: 5, date: "5 days ago", comment: "Super fast delivery and great product!" }, { id: 'review-6', name: "Michael B.", rating: 4, date: "1 day ago", comment: "Looks good, haven't used it much yet but seems solid." }, ]; }, [product?.reviews]);
    const displayReviews = useMemo(() => showAllReviews ? allReviews : allReviews.slice(0, MAX_INITIAL_REVIEWS), [showAllReviews, allReviews]);

    // Handlers
    const toggleWishlist = () => setIsWishlisted(!isWishlisted);
    const shareProduct = async () => { try { const message = `Check out this product: ${product?.name ?? 'Product'} - ${mainFinalDisplayPrice || 'Price not available'}`; const url = product?.productPageUrl || product?.deepLinkUrl; const shareOptions = { message, ...(url && { url }) }; await Share.share(shareOptions); } catch (error) { console.error('Error sharing product:', error.message); }};
    const onViewableItemsChanged = useRef(({ viewableItems }) => { if (viewableItems?.[0]?.index !== null && viewableItems[0].index >= 0) { setActiveIndex(viewableItems[0].index); } }).current;
    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
    const handleAddToCart = () => { console.log(`Add to cart: ${product?.name}, Size: ${selectedSize}, Color: ${selectedColor}`); };
    const handleBuyNow = () => { console.log(`Buy now: ${product?.name}, Size: ${selectedSize}, Color: ${selectedColor}`); };
    const handleChat = () => { console.log("Chat pressed"); };
    const handleSeeMoreReviews = () => setShowAllReviews(true);
    const handleSeeLessReviews = () => setShowAllReviews(false);

    // Fetch Related Products Effect - Includes Placeholder Logic
    useEffect(() => {
        const fetchRelatedProducts = async () => {
            const currentProductId = product?.id; const currentProductCategory = product?.category;
            if (!currentProductId || !currentProductCategory) { setRelatedProducts([]); setLoadingRelatedProducts(false); return; }
            setLoadingRelatedProducts(true);
            try {
                const productsRef = collection(db, 'Products');
                const q = query( productsRef, where('category', '==', currentProductCategory), where(documentId(), '!=', currentProductId), orderBy(documentId()), limit(RELATED_PRODUCTS_LIMIT) );
                const querySnapshot = await getDocs(q);
                let fetchedProducts = [];
                querySnapshot.forEach((docSnapshot) => {
                    const data = docSnapshot.data(); const bnplAvailable = data.paymentOption?.BNPL === true; const codAvailable = data.paymentOption?.COD === true;
                    fetchedProducts.push({ id: docSnapshot.id, name: data.name || 'Unnamed Product', originalPrice: data.originalPrice, discountedPrice: data.discountedPrice, image: data.media?.images?.[0] || data.image || null, description: data.description || '', paymentOption: data.paymentOption || { COD: false, BNPL: false }, BNPLPlans: data.BNPLPlans, media: data.media, category: data.category, variations: data.variations, rating: data.rating, soldCount: data.soldCount, bnplAvailable: bnplAvailable, codAvailable: codAvailable, });
                });

                if (fetchedProducts.length > 0 && fetchedProducts.length % 2 !== 0) {
                    fetchedProducts.push({ id: `placeholder-${Date.now()}`, isPlaceholder: true });
                }
                setRelatedProducts(fetchedProducts);
            } catch (error) { console.error("Error fetching related products: ", error); setRelatedProducts([]); } finally { setLoadingRelatedProducts(false); }
        };
        fetchRelatedProducts();
    }, [product.id, product.category]);

    // --- Render Functions ---
    const renderGalleryItem = ({ item }) => { if (item.isPlaceholder) { return <Image source={placeholderImage} style={styles.galleryItemImage} resizeMode="contain" />; } if (item.type === 'image') { return <Image source={{ uri: item.url }} style={styles.galleryItemImage} resizeMode="contain" onError={(e) => console.error(`Image Load Error (${item.url}):`, e.nativeEvent.error)} />; } if (item.type === 'video') { return <Video ref={(ref) => videoRefs.current[item.id] = ref} style={styles.galleryItemVideo} source={{ uri: item.url }} useNativeControls resizeMode={ResizeMode.CONTAIN} onError={(e) => console.error(`Video Load Error (${item.url}):`, e)} />; } return null; };
    const renderTextPagination = () => { if (galleryItems.length <= 1) return null; return (<View style={styles.paginationTextContainer}><Text style={styles.paginationText}>{activeIndex + 1} / {galleryItems.length}</Text></View>); };
    const renderPriceSection = () => { if (!mainFinalDisplayPrice) return <Text style={styles.noPriceText}>Price not available</Text>; return ( <View style={styles.priceRow}><Text style={styles.finalPrice}>{mainFinalDisplayPrice}</Text>{hasDiscount && mainDisplayOriginalPrice && <Text style={styles.originalPrice}>{mainDisplayOriginalPrice}</Text>}</View> ); };
    const renderVariationSelector = (title, options, selectedOption, setOption) => { if (!options || options.length === 0) return null; return ( <View style={styles.variationContainer}><Text style={styles.variationTitle}>{title}: <Text style={styles.variationSelectedValue}>{selectedOption || 'Select'}</Text></Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.variationOptionsScroll}>{options.map((option) => ( <TouchableOpacity key={option.toString()} style={[ styles.variationChip, selectedOption === option && styles.variationChipActive ]} onPress={() => setOption(option)}><Text style={[ styles.variationChipText, selectedOption === option && styles.variationChipTextActive ]}>{option}</Text></TouchableOpacity> ))}</ScrollView></View> ); };
    const renderBnplPlansSection = () => {
        if (!product?.bnplAvailable || !Array.isArray(product.BNPLPlans) || product.BNPLPlans.length === 0 || basePriceForBNPL === null) { return null; }
        const formatCurrency = (value) => { if (typeof value !== 'number') return null; return `${CURRENCY_SYMBOL} ${value.toFixed(0)}`; };
        const bnplPlanTypes = ['Installment', 'BNPL', 'PayLater']; const bnplPlans = product.BNPLPlans.filter(plan => bnplPlanTypes.includes(plan.planType)); const fixedDurationPlans = product.BNPLPlans.filter(plan => plan.planType === 'Fixed Duration'); const otherPlans = product.BNPLPlans.filter(plan => !bnplPlanTypes.includes(plan.planType) && plan.planType !== 'Fixed Duration');
        const renderSinglePlanCard = (plan, index, arrayLength) => {
            const planName = plan.planName || 'Unnamed Plan'; const duration = typeof plan.duration === 'number' ? plan.duration : null; const downpayment = formatCurrency(plan.downpayment); const monthlyPayment = formatCurrency(plan.monthlyPayment); const interestRateValue = typeof plan.interestRate === 'number' ? plan.interestRate : null; const interestRateDisplay = interestRateValue !== null ? `${interestRateValue.toFixed(1)}%` : null; const planType = plan.planType || 'General'; const planId = plan.id || `plan-${index}`; const isLastPlanInGroup = index === arrayLength - 1; const isFixedDurationPlan = plan.planType === 'Fixed Duration';
            let formattedTotalPriceWithInterest = null; if (interestRateValue !== null) { const totalPrice = basePriceForBNPL * (1 + (interestRateValue / 100)); formattedTotalPriceWithInterest = formatCurrency(totalPrice); }
            const numberOfInstallments = !isFixedDurationPlan ? duration : 1;
            return (
                <View key={planId} style={[styles.bnplPlanCard, !isLastPlanInGroup && styles.bnplPlanCardSeparator]}>
                    <View style={styles.bnplPlanHeader}><MaterialIcons name="payments" size={18} color={BnplPlanIconColor} style={styles.bnplPlanIcon} /><Text style={styles.bnplPlanNameText}>{planName}</Text></View>
                    <View style={styles.bnplPlanDetails}>
                        <Text style={styles.bnplPlanDetailText}> Type: <Text style={styles.bnplPlanDetailValue}>{planType}</Text> </Text>
                        {duration !== null ? ( <Text style={styles.bnplPlanDetailText}> Duration: <Text style={styles.bnplPlanDetailValue}>{duration} Month{duration !== 1 ? 's' : ''}</Text>{isFixedDurationPlan ? ( <Text style={styles.bnplPlanDetailValue}> (1 Time Payment)</Text> ) : numberOfInstallments !== null ? ( <Text style={styles.bnplPlanDetailValue}> / {numberOfInstallments} Installments</Text> ) : null}</Text> ) : ( <Text style={styles.bnplPlanDetailText}>Duration: Not specified</Text> )}
                        {downpayment !== null && (<Text style={styles.bnplPlanDetailText}> Downpayment: <Text style={styles.bnplPlanDetailValue}>{downpayment}</Text> </Text>)}
                        {!isFixedDurationPlan && monthlyPayment !== null && ( <Text style={styles.bnplPlanDetailText}> Monthly: <Text style={styles.bnplPlanDetailValue}>{monthlyPayment}</Text> </Text> )}
                        {interestRateDisplay !== null ? ( <Text style={styles.bnplPlanDetailText}> Interest: <Text style={styles.bnplPlanDetailValue}>{interestRateDisplay}</Text>{formattedTotalPriceWithInterest && <Text style={styles.bnplPlanTotalValue}> ({formattedTotalPriceWithInterest} Total)</Text>}</Text> ) : ( <Text style={styles.bnplPlanDetailText}>Interest: Not specified</Text> )}
                    </View>
                </View>
            );
        };
        if (bnplPlans.length === 0 && fixedDurationPlans.length === 0 && otherPlans.length === 0) return null;
        return (
            <View style={styles.bnplSectionContainer}>
                <Text style={styles.sectionTitle}>Available Installment Options</Text>
                {bnplPlans.length > 0 && (<View style={styles.bnplGroupContainer}><Text style={styles.bnplGroupTitle}>BNPL Plans</Text>{bnplPlans.map((plan, index) => renderSinglePlanCard(plan, index, bnplPlans.length))}</View>)}
                {fixedDurationPlans.length > 0 && (<View style={styles.bnplGroupContainer}><Text style={styles.bnplGroupTitle}>Fixed Duration Plans</Text>{fixedDurationPlans.map((plan, index) => renderSinglePlanCard(plan, index, fixedDurationPlans.length))}</View>)}
                {otherPlans.length > 0 && (<View style={styles.bnplGroupContainer}><Text style={styles.bnplGroupTitle}>Other Plans</Text>{otherPlans.map((plan, index) => renderSinglePlanCard(plan, index, otherPlans.length))}</View>)}
            </View>
        );
    };
    const renderReviewCard = ({ item, index, totalItems }) => { const isLastItem = index === totalItems - 1; return ( <View style={[ styles.reviewCard, isLastItem && { borderBottomWidth: 0 } ]}><View style={styles.reviewHeader}><View style={styles.reviewHeaderRating}>{[...Array(5)].map((_, i) => (<MaterialIcons key={i} name="star" size={16} color={i < item.rating ? StarColor : PlaceholderStarColor} />))}</View><Text style={styles.reviewerName}>{item.name || 'Anonymous'} <Text style={styles.reviewDate}>· {item.date || ''}</Text></Text></View><Text style={styles.reviewText}>{item.comment || ''}</Text></View> ); };

    // --- Render Related Product Card - Using Fixed Width & Placeholder ---
    const renderRelatedProductCard = ({ item }) => {
        if (item.isPlaceholder) {
            return <View style={styles.relatedProductCardPlaceholder} />; // Use placeholder style
        }
        const hasDiscount = typeof item.discountedPrice === 'number' && typeof item.originalPrice === 'number' && item.discountedPrice < item.originalPrice;
        const displayOriginalPrice = typeof item.originalPrice === 'number' ? `${CURRENCY_SYMBOL} ${item.originalPrice.toFixed(0)}` : null;
        const displayDiscountedPrice = typeof item.discountedPrice === 'number' ? `${CURRENCY_SYMBOL} ${item.discountedPrice.toFixed(0)}` : null;
        const showBnplBadge = item.bnplAvailable === true;
        const showCodBadge = item.codAvailable === true && !showBnplBadge;

        return (
            <TouchableOpacity
                style={styles.relatedProductCard} // Use card style with fixed width
                onPress={() => navigation.push('ProductDetails', { product: item })}
            >
                <Image
                    source={item.image ? { uri: item.image } : placeholderImage}
                    style={styles.relatedCardImage}
                    resizeMode="contain"
                />
                <Text style={styles.relatedCardName} numberOfLines={1} ellipsizeMode="tail">
                    {item.name || ''}
                </Text>
                <View style={styles.relatedCardPriceContainer}>
                    {hasDiscount ? (
                        <>
                            {displayOriginalPrice && ( <Text style={[styles.relatedCardProductPrice, styles.relatedCardStrikethroughPrice]}>{displayOriginalPrice}</Text> )}
                            {displayDiscountedPrice && ( <Text style={styles.relatedCardDiscountedPrice}>{displayDiscountedPrice}</Text> )}
                        </>
                    ) : (
                        <>
                            {displayOriginalPrice ? ( <Text style={styles.relatedCardDiscountedPrice}>{displayOriginalPrice}</Text> )
                            : displayDiscountedPrice ? ( <Text style={styles.relatedCardDiscountedPrice}>{displayDiscountedPrice}</Text> )
                            : ( <View style={styles.relatedCardPricePlaceholder} /> )}
                        </>
                    )}
                </View>
                {item.description ? (
                    <Text style={styles.relatedCardDescription} numberOfLines={2} ellipsizeMode="tail">
                        {item.description}
                    </Text>
                 ) : <View style={styles.relatedCardDescriptionPlaceholder}/> }
                {showBnplBadge ? ( <View style={styles.relatedCardBnplBadge}><MaterialIcons name="schedule" size={14} color={BnplBadgeText} /><Text style={styles.relatedCardBnplText}>BNPL Available</Text></View> )
                : showCodBadge ? ( <View style={styles.relatedCardCodBadge}><MaterialIcons name="local-shipping" size={14} color={CodBadgeText} /><Text style={styles.relatedCardCodText}>COD Available</Text></View> )
                : ( <View style={styles.relatedCardBadgePlaceholder} /> )}
            </TouchableOpacity>
        );
    };
    // --- End Render Related Product Card ---

    const renderRelatedProductsSection = () => {
        if (loadingRelatedProducts) {
            return ( <View style={styles.relatedLoadingContainer}><ActivityIndicator size="large" color={AccentColor} /><Text style={styles.relatedLoadingText}>Loading Related Products...</Text></View> );
        }
        if (!relatedProducts || relatedProducts.length === 0) {
            return null;
        }
        const numColumns = 2;
        return (
            <View style={styles.relatedProductsContainer}>
                <Text style={styles.relatedProductsTitle}>Related Products</Text>
                <FlatList
                    data={relatedProducts}
                    renderItem={renderRelatedProductCard}
                    keyExtractor={(item) => item.id}
                    numColumns={numColumns}
                    key={`related-products-grid-${numColumns}`}
                    scrollEnabled={false}
                    contentContainerStyle={styles.relatedProductsGridContainer}
                    // No columnWrapperStyle needed when using fixed width + placeholder
                />
            </View>
        );
    };

    if (!product || !product.id) {
        return ( <SafeAreaView style={styles.safeArea}><View style={styles.loadingContainer}><Text style={styles.errorText}>Product information could not be loaded.</Text></View></SafeAreaView> );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
            <StatusBar barStyle="dark-content" backgroundColor={AppBackgroundColor} />
            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.galleryWrapper}>
                    <FlatList ref={flatListRef} data={galleryItems} renderItem={renderGalleryItem} keyExtractor={(item) => item.id} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onViewableItemsChanged={onViewableItemsChanged} viewabilityConfig={viewabilityConfig} scrollEventThrottle={16} style={styles.galleryFlatList} initialNumToRender={1} maxToRenderPerBatch={1} windowSize={3} />
                    <View style={styles.galleryOverlayContainer}>{renderTextPagination()}</View>
                </View>

                <View style={styles.contentContainer}>
                    <Text style={styles.productName}>{product.name ?? 'Unnamed Product'}</Text>
                    <Text style={styles.soldCountText}>{displaySoldCount} sold</Text>
                    <View style={styles.priceActionsRow}>
                        {renderPriceSection()}
                        <View style={styles.rightActionButtonsGroup}>
                            <TouchableOpacity onPress={toggleWishlist} style={styles.iconButton}><MaterialIcons name={isWishlisted ? 'favorite' : 'favorite-border'} size={24} color={isWishlisted ? AccentColor : TextColorPrimary} /></TouchableOpacity>
                            <TouchableOpacity onPress={shareProduct} style={[styles.iconButton, { marginLeft: 10 }]}><Feather name="share-2" size={22} color={TextColorPrimary} /></TouchableOpacity>
                        </View>
                    </View>
                    {product?.bnplAvailable && (<View style={styles.bnplInfoContainer}><MaterialIcons name="schedule" size={16} color={BnplInfoTextColor} style={{ marginRight: 5 }}/><Text style={styles.bnplInfoText}>BNPL Available</Text></View> )}
                    {renderVariationSelector('Size', product.variations?.sizes, selectedSize, setSelectedSize)}
                    {renderVariationSelector('Color', product.variations?.colors, selectedColor, setSelectedColor)}
                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.descriptionText}>{product.description || 'No description available.'}</Text>
                    {renderBnplPlansSection()}
                     <View style={styles.reviewSectionWrapper}>
                        <View style={styles.reviewSectionHeader}>
                            <Text style={styles.sectionTitle}>Reviews ({allReviews.length})</Text>
                            <View style={styles.reviewOverallRating}><MaterialIcons name="star" size={18} color={StarColor} style={{ marginRight: 4 }}/><Text style={styles.reviewOverallRatingText}>{averageRating.toFixed(1)}</Text></View>
                        </View>
                        <FlatList data={displayReviews} renderItem={({ item, index }) => renderReviewCard({ item, index, totalItems: displayReviews.length })} keyExtractor={(item, index) => (item.id ? item.id.toString() : `review-${index}`)} scrollEnabled={false} ListEmptyComponent={<Text style={styles.noReviewsText}>No reviews yet.</Text>} />
                        {allReviews.length > MAX_INITIAL_REVIEWS && (
                            <View>
                                {!showAllReviews ? ( <TouchableOpacity style={styles.seeMoreButton} onPress={handleSeeMoreReviews}><Text style={styles.seeMoreButtonText}>See More Reviews</Text><MaterialIcons name="keyboard-arrow-down" size={20} color={AccentColor} /></TouchableOpacity> ) : ( <TouchableOpacity style={styles.seeMoreButton} onPress={handleSeeLessReviews}><Text style={styles.seeMoreButtonText}>See Less</Text><MaterialIcons name="keyboard-arrow-up" size={20} color={AccentColor} /></TouchableOpacity> )}
                            </View>
                        )}
                    </View>
                </View>

                {renderRelatedProductsSection()}
                 <View style={styles.relatedProductsBottomPadding} />
            </ScrollView>

            <View style={styles.buttonContainer}>
                 <TouchableOpacity style={[styles.bottomButtonBase, styles.chatButton]} onPress={handleChat}><MaterialIcons name="support-agent" size={22} color={ChatIconColor} style={{ marginBottom: 2 }}/><Text style={[styles.buttonText, styles.chatButtonText]}>Chat</Text></TouchableOpacity>
                 <TouchableOpacity style={[styles.bottomButtonBase, styles.cartButton]} onPress={handleAddToCart}><Text style={[styles.buttonText, styles.cartButtonText]}>Add to Cart</Text></TouchableOpacity>
                 <TouchableOpacity style={styles.buyButtonContainer} onPress={handleBuyNow}><LinearGradient colors={[AccentColor, AccentDarkerColor]} style={styles.buyButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}><Text style={[styles.buttonText, styles.buyButtonText]}>Buy Now</Text></LinearGradient></TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

// Styles
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: AppBackgroundColor },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: AppBackgroundColor },
    errorText: { fontSize: 16, color: TextColorSecondary, textAlign: 'center', marginTop: 10 },
    scrollContainer: { paddingBottom: 100, backgroundColor: AppBackgroundColor },
    galleryWrapper: { backgroundColor: AppBackgroundColor, position: 'relative' },
    galleryFlatList: { width: screenWidth, height: GALLERY_HEIGHT },
    galleryItemImage: { width: screenWidth, height: GALLERY_HEIGHT, backgroundColor: PlaceholderBgColor },
    galleryItemVideo: { width: screenWidth, height: GALLERY_HEIGHT, backgroundColor: '#000' },
    galleryOverlayContainer: { position: 'absolute', top: 15, left: 15, right: 15, bottom: 15, pointerEvents: 'box-none' },
    paginationTextContainer: { position: 'absolute', bottom: 0, right: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
    paginationText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
    contentContainer: { paddingHorizontal: 20, paddingTop: 20 },
    productName: { fontSize: 24, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 4, lineHeight: 30 },
    soldCountText: { fontSize: 14, color: TextColorSecondary, marginBottom: 12 },
    priceActionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, minHeight: 30 },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', flexShrink: 1 },
    finalPrice: { fontSize: 20, fontWeight: 'bold', color: AccentColor },
    originalPrice: { fontSize: 14, color: TextColorSecondary, textDecorationLine: 'line-through', marginLeft: 8 },
    noPriceText: { fontSize: 16, color: TextColorSecondary, fontStyle: 'italic' },
    rightActionButtonsGroup: { flexDirection: 'row', alignItems: 'center' },
    iconButton: { padding: 5 },
    bnplInfoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 4, backgroundColor: BnplInfoBgColor, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, alignSelf: 'flex-start' },
    bnplInfoText: { fontSize: 13, color: BnplInfoTextColor, fontWeight: '600' },
    variationContainer: { marginBottom: 20 },
    variationTitle: { fontSize: 16, fontWeight: '600', color: TextColorPrimary, marginBottom: 10 },
    variationSelectedValue: { fontWeight: 'normal', color: TextColorSecondary },
    variationOptionsScroll: { paddingBottom: 5 },
    variationChip: { borderWidth: 1, borderColor: LightBorderColor, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, marginRight: 10, backgroundColor: AppBackgroundColor },
    variationChipActive: { borderColor: AccentColor, backgroundColor: '#FFF0F0' },
    variationChipText: { fontSize: 14, color: TextColorPrimary },
    variationChipTextActive: { color: AccentColor, fontWeight: '600' },
    bnplSectionContainer: { marginTop: 20, marginBottom: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: LightBorderColor, },
    bnplGroupContainer: { marginBottom: 15, },
    bnplGroupTitle: { fontSize: 15, fontWeight: '600', color: TextColorSecondary, marginBottom: 8, },
    bnplPlanCard: { backgroundColor: BnplPlanCardBg, borderRadius: 6, borderWidth: 1, borderColor: BnplPlanCardBorder, paddingVertical: 8, paddingHorizontal: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1.5, elevation: 1, },
    bnplPlanCardSeparator: { borderBottomWidth: 1, borderBottomColor: '#EDEDED', },
    bnplPlanHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, },
    bnplPlanIcon: { marginRight: 8 },
    bnplPlanNameText: { fontSize: 15, fontWeight: '600', color: BnplPlanNameColor, flexShrink: 1 },
    bnplPlanDetails: { paddingLeft: 26, },
    bnplPlanDetailText: { fontSize: 12, color: BnplPlanDetailColor, lineHeight: 18, marginBottom: 2, },
    bnplPlanDetailValue: { fontWeight: '500', color: BnplPlanValueColor, },
    bnplPlanTotalValue: { fontWeight: '500', color: TextColorSecondary, fontSize: 12, },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 15, },
    descriptionText: { fontSize: 15, color: TextColorSecondary, lineHeight: 24, marginBottom: 25 },
    reviewSectionWrapper: { marginBottom: 10 },
    reviewSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
    reviewOverallRating: { flexDirection: 'row', alignItems: 'center' },
    reviewOverallRatingText: { fontSize: 16, fontWeight: 'bold', color: TextColorPrimary, marginLeft: 2 },
    reviewCard: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
    reviewHeader: { flexDirection: 'column', alignItems: 'flex-start', marginBottom: 8 },
    reviewHeaderRating: { flexDirection: 'row', marginBottom: 4 },
    reviewerName: { fontSize: 15, fontWeight: '600', color: TextColorPrimary },
    reviewDate: { fontSize: 13, color: TextColorSecondary },
    reviewText: { fontSize: 14, color: TextColorSecondary, lineHeight: 21 },
    noReviewsText: { textAlign: 'center', color: TextColorSecondary, marginTop: 20, marginBottom: 20, fontStyle: 'italic' },
    seeMoreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginTop: 10, borderTopWidth: 1, borderTopColor: LightBorderColor },
    seeMoreButtonText: { fontSize: 15, fontWeight: '500', color: AccentColor, marginRight: 5 },

    // --- Related Products Section Styles ---
    relatedProductsContainer: {
        marginTop: 20, // Adjusted spacing
        paddingTop: 20,
        paddingBottom: 10,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        backgroundColor: RelatedSectionBgColor,
    },
    relatedProductsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: TextColorPrimary,
        marginBottom: 15,
        paddingHorizontal: 20, // Align title with main content
    },
    relatedLoadingContainer: {
        height: 280, // Match card height
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 20,
        backgroundColor: RelatedSectionBgColor,
        paddingHorizontal: 20,
    },
    relatedLoadingText: {
        marginTop: 10,
        fontSize: 14,
        color: TextColorSecondary,
    },
    relatedProductsGridContainer: {
        paddingHorizontal: GRID_PADDING_HORIZONTAL, // Use constant
    },
    relatedProductCard: { // Card style with FIXED width
        backgroundColor: '#fff',
        borderRadius: 8,
        margin: CARD_MARGIN_HORIZONTAL, // Use constant for horizontal margin
        width: relatedCardWidth,        // *** Use calculated width ***
        // Removed flex: 0.48
        alignItems: 'center',
        padding: 18, // Match HomeScreen padding (adjust if needed)
        paddingBottom: 4,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.20,
        shadowRadius: 1.41,
        minHeight: 280, // Match HomeScreen minHeight
        justifyContent: 'space-between',
    },
    relatedProductCardPlaceholder: { // Placeholder with FIXED width
        margin: CARD_MARGIN_HORIZONTAL,
        width: relatedCardWidth, // *** Use calculated width ***
        // Removed flex: 0.48
        minHeight: 280, // Match real card height
        backgroundColor: 'transparent', // Invisible
    },
    relatedCardImage: { width: '100%', height: 110, borderRadius: 6, marginBottom: 8, backgroundColor: 'white', },
    relatedCardName: { fontSize: 14, fontWeight: '600', color: '#333', textAlign: 'center', minHeight: 18, marginBottom: 4, paddingHorizontal: 2, },
    relatedCardPriceContainer: { flexDirection: 'column', alignItems: 'center', marginTop: 4, minHeight: 35, marginBottom: 6, justifyContent: 'center', },
    relatedCardProductPrice: { fontSize: 14, color: AccentColor, fontWeight: 'bold', }, // Base price before strikethrough
    relatedCardStrikethroughPrice: { textDecorationLine: 'line-through', color: StrikethroughColor, fontWeight: 'normal', fontSize: 13, }, // Applied with base style
    relatedCardDiscountedPrice: { fontSize: 15, color: DiscountedPriceColor, fontWeight: 'bold', }, // Final/discounted price
    relatedCardPricePlaceholder: { height: 20, minHeight: 35, marginBottom: 6, marginTop: 4, },
    relatedCardDescription: { fontSize: 12, color: TextColorSecondary, textAlign: 'center', marginTop: 4, marginBottom: 6, paddingHorizontal: 5, minHeight: 28, },
    relatedCardDescriptionPlaceholder: { height: 28, marginBottom: 6, marginTop: 4, },
    relatedCardBnplBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: BnplBadgeBg, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, marginTop: 'auto', marginBottom: 4, alignSelf: 'center', flexShrink: 0, height: 24, },
    relatedCardBnplText: { fontSize: 11, color: BnplBadgeText, marginLeft: 4, fontWeight: '600', },
    relatedCardCodBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: CodBadgeBg, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, marginTop: 'auto', marginBottom: 4, alignSelf: 'center', flexShrink: 0, height: 24, },
    relatedCardCodText: { fontSize: 11, color: CodBadgeText, marginLeft: 4, fontWeight: '600', },
    relatedCardBadgePlaceholder: { height: 24, marginBottom: 4, marginTop: 'auto', },
    relatedProductsBottomPadding: { height: 15, backgroundColor: RelatedSectionBgColor },

    // --- Bottom Button Styles ---
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
});