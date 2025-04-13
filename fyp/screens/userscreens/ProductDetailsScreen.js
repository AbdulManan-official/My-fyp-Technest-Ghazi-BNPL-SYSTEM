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
    Linking, // Keep if used, remove if not
    // findNodeHandle // Import if using scroll-to-top on see less
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { MaterialIcons, Feather } from '@expo/vector-icons'; // Keep MaterialIcons for BNPL icon
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

// --- Constants ---
const AppBackgroundColor = '#FFFFFF';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#666666';
const AccentColor = '#D32F2F'; // Main Red accent
const AccentDarkerColor = '#B71C1C'; // Darker Red
const LightBorderColor = '#EEEEEE';
const PlaceholderBgColor = '#F0F0F0';
const BnplInfoBgColor = '#E8F5E9'; // Light Green for Badge BG
const BnplInfoTextColor = '#1B5E20'; // Dark Green for Badge Text

// --- BNPL Plan UI Constants ---
const BnplPlanCardBg = '#F8F9FA';      // Very light grey background for card
const BnplPlanCardBorder = '#DEE2E6';  // Slightly darker grey border
const BnplPlanIconColor = '#495057';   // Dark grey for icon
const BnplPlanNameColor = TextColorPrimary; // Use primary for name
const BnplPlanDetailColor = TextColorSecondary; // Use secondary for details

const ChatIconColor = '#424242'; // Dark Grey for Chat Icon/Text

const placeholderImage = require('../../assets/p3.jpg'); // Make sure this path is correct
const { width: screenWidth } = Dimensions.get('window');
const GALLERY_HEIGHT = screenWidth * 0.9;
const MAX_INITIAL_REVIEWS = 2; // Limit initial reviews shown

export default function ProductDetailsScreen() {
    const route = useRoute();
    const navigation = useNavigation();

    // *** CONSOLE LOG: Check received route parameters ***
    // console.log("ProductDetailsScreen: Received route params:", JSON.stringify(route.params, null, 2));

    // Ensure product has BNPLPlans array (even if empty) from HomeScreen
    const product = route.params?.product ?? { BNPLPlans: [] }; // Default to empty array if product missing

    // *** CONSOLE LOG: Check the effective product data being used ***
    // console.log("ProductDetailsScreen: Effective product data:", JSON.stringify(product, null, 2));

    // *** CONSOLE LOG: Specifically check BNPLPlans array ***
    // console.log("ProductDetailsScreen: Product BNPLPlans:", product?.BNPLPlans);

    // --- State Variables ---
    const [isWishlisted, setIsWishlisted] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0); // Initial gallery index
    const [selectedSize, setSelectedSize] = useState(product?.variations?.sizes?.[0] || null);
    const [selectedColor, setSelectedColor] = useState(product?.variations?.colors?.[0] || null);
    const [showAllReviews, setShowAllReviews] = useState(false); // State to control review visibility

    // *** CONSOLE LOG: Initial state values ***
    // console.log("ProductDetailsScreen: Initial State - activeIndex:", activeIndex, "selectedSize:", selectedSize, "selectedColor:", selectedColor, "showAllReviews:", showAllReviews);

    // --- Refs ---
    const flatListRef = useRef(null);
    const videoRefs = useRef({});
    // const scrollViewRef = useRef(null); // Ref for the main ScrollView (needed for scroll-to-top)
    // const reviewSectionRef = useRef(null); // Ref for the review section container

    // --- Gallery Items Memoization ---
    const galleryItems = useMemo(() => {
        // console.log("ProductDetailsScreen: Calculating galleryItems...");
        if (!product || (!product.media && !product.image)) return [{ type: 'image', url: null, id: 'placeholder-img', isPlaceholder: true }];
        const items = [];
        const seenUrls = new Set();
        const addItem = (item) => {
            if (item.url && typeof item.url === 'string' && !seenUrls.has(item.url)) {
                items.push(item);
                seenUrls.add(item.url);
            } else if (item.isPlaceholder) {
                 items.push(item);
            }
        };
        if (product.media?.images && Array.isArray(product.media.images)) {
            product.media.images.forEach(url => addItem({ type: 'image', url: url, id: `img-${url}` }));
        }
        const videoUrl = product.media?.video;
        if (videoUrl) {
             addItem({ type: 'video', url: videoUrl, id: `vid-${videoUrl}` });
        }
        if (product.image) {
             const fallbackAlreadyAdded = items.some(item => item.type === 'image' && item.url === product.image);
             if (!fallbackAlreadyAdded) {
                 if (items.filter(i => i.type === 'image').length === 0) {
                     items.unshift({ type: 'image', url: product.image, id: `img-fallback-${product.image}` });
                 } else {
                     items.push({ type: 'image', url: product.image, id: `img-fallback-${product.image}` });
                 }
             }
        }
        if (items.length === 0) {
            items.push({ type: 'image', url: null, id: 'placeholder-img', isPlaceholder: true });
        }
        // console.log("ProductDetailsScreen: Calculated galleryItems:", items);
        return items;
    }, [product]);


    // --- Price Calculation ---
    const originalPriceValue = typeof product?.originalPrice === 'number' ? product.originalPrice : null;
    const discountedPriceValue = typeof product?.discountedPrice === 'number' ? product.discountedPrice : null;
    const hasDiscount = originalPriceValue !== null && discountedPriceValue !== null && discountedPriceValue < originalPriceValue;
    const displayOriginalPrice = originalPriceValue !== null ? `PKR ${originalPriceValue.toFixed(0)}` : null;
    const displayDiscountedPrice = discountedPriceValue !== null ? `PKR ${discountedPriceValue.toFixed(0)}` : null;
    const finalDisplayPrice = displayDiscountedPrice || displayOriginalPrice;

    // console.log("ProductDetailsScreen: Prices - Original:", displayOriginalPrice, "Discounted:", displayDiscountedPrice, "Final:", finalDisplayPrice);

    // --- Review Logic ---
    const averageRating = product?.rating ?? 4.5;
    const soldCount = product?.soldCount ?? 1200;
    const displaySoldCount = soldCount > 999 ? `${(soldCount / 1000).toFixed(1)}k` : soldCount.toString();

    // Use actual reviews from product if available, fallback to mock
    const allReviews = useMemo(() => {
        // console.log("ProductDetailsScreen: Calculating allReviews. Product reviews:", product?.reviews);
        const reviews = product?.reviews && product.reviews.length > 0 ? product.reviews : [
            { id: 1, name: "Alice J.", rating: 5, date: "2 weeks ago", comment: "Absolutely love this! The quality is fantastic." },
            { id: 2, name: "Mark S.", rating: 4, date: "1 month ago", comment: "Good product overall. Meets expectations." },
            { id: 3, name: "Sarah K.", rating: 5, date: "3 days ago", comment: "Perfect fit and color is exactly as pictured. Would buy again!" },
            { id: 4, name: "David L.", rating: 3, date: "1 week ago", comment: "It's okay. Material feels a bit thinner than I thought it would be." },
            { id: 5, name: "Emily R.", rating: 5, date: "5 days ago", comment: "Super fast delivery and great product!" },
            { id: 6, name: "Michael B.", rating: 4, date: "1 day ago", comment: "Looks good, haven't used it much yet but seems solid." },
        ];
        // console.log("ProductDetailsScreen: Calculated allReviews:", reviews);
        return reviews;
    }, [product?.reviews]);

    // Derived state: reviews to actually display based on showAllReviews
    const displayReviews = useMemo(() => {
        const reviewsToDisplay = showAllReviews ? allReviews : allReviews.slice(0, MAX_INITIAL_REVIEWS);
        // console.log(`ProductDetailsScreen: Displaying ${reviewsToDisplay.length} reviews. Show all: ${showAllReviews}`);
        return reviewsToDisplay;
    }, [showAllReviews, allReviews]);


    // --- Handlers ---
    const toggleWishlist = () => {
        const newState = !isWishlisted;
        setIsWishlisted(newState);
        console.log("ProductDetailsScreen: Wishlist toggled. New state:", newState);
    };
    const shareProduct = async () => {
        console.log("ProductDetailsScreen: Share button pressed.");
        try {
            const message = `Check out this product: ${product?.name ?? 'Product'} - ${finalDisplayPrice || 'Price not available'}`;
            const url = product?.productPageUrl || product?.deepLinkUrl;
            const shareOptions = { message, ...(url && { url }) };
             console.log("ProductDetailsScreen: Sharing with options:", shareOptions);
            await Share.share(shareOptions);
        } catch (error) { console.error('ProductDetailsScreen: Error sharing product:', error.message); }
    };

    // *** ENHANCED: onViewableItemsChanged Handler ***
    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        // console.log("ProductDetailsScreen: onViewableItemsChanged fired.", "Viewable:", JSON.stringify(viewableItems), "Changed:", JSON.stringify(changed));
        if (viewableItems && Array.isArray(viewableItems) && viewableItems.length > 0) {
            const firstViewableItem = viewableItems[0];
            if (firstViewableItem && typeof firstViewableItem.index === 'number' && firstViewableItem.index >= 0) {
                const newIndex = firstViewableItem.index;
                 setActiveIndex(prevIndex => {
                     if (newIndex !== prevIndex) {
                         // console.log(`ProductDetailsScreen: Setting activeIndex from ${prevIndex} to ${newIndex}`);
                         return newIndex;
                     }
                     return prevIndex;
                 });
            } else {
                // console.warn("ProductDetailsScreen: onViewableItemsChanged - First viewable item has invalid index:", firstViewableItem?.index);
            }
        } else {
             // console.warn("ProductDetailsScreen: onViewableItemsChanged - No valid viewableItems found in callback:", viewableItems);
        }
    }).current;

    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

    const handleAddToCart = () => {
        console.log("ProductDetailsScreen: Add to Cart button pressed.");
        console.log(`ProductDetailsScreen: Adding to cart details - Product: ${product?.name}, Size: ${selectedSize}, Color: ${selectedColor}`);
    };
    const handleBuyNow = () => {
        console.log("ProductDetailsScreen: Buy Now button pressed.");
        console.log(`ProductDetailsScreen: Buying now details - Product: ${product?.name}, Size: ${selectedSize}, Color: ${selectedColor}`);
    };
    const handleChat = () => {
        console.log("ProductDetailsScreen: Chat button pressed.");
    };

    // --- Review Button Handlers ---
    const handleSeeMoreReviews = () => {
        console.log("ProductDetailsScreen: See More Reviews button pressed.");
        setShowAllReviews(true);
    };

    const handleSeeLessReviews = () => {
        console.log("ProductDetailsScreen: See Less Reviews button pressed.");
        setShowAllReviews(false);
        // Optional: Scroll to top logic
    };


    // --- Render Functions ---
    const renderGalleryItem = ({ item }) => {
        // console.log("ProductDetailsScreen: Rendering gallery item:", item);
         if (item.isPlaceholder) { return <Image source={placeholderImage} style={styles.galleryItemImage} resizeMode="contain" />; }
         if (item.type === 'image') { return <Image source={{ uri: item.url }} style={styles.galleryItemImage} resizeMode="contain" onError={(e) => console.error(`ProductDetailsScreen: Image Load Error (${item.url}):`, e.nativeEvent.error)} />; }
         if (item.type === 'video') { return <Video ref={(ref) => videoRefs.current[item.id] = ref} style={styles.galleryItemVideo} source={{ uri: item.url }} useNativeControls resizeMode={ResizeMode.CONTAIN} onError={(e) => console.error(`ProductDetailsScreen: Video Load Error (${item.url}):`, e)} />; }
         return null;
    };
    const renderTextPagination = () => {
         if (galleryItems.length <= 1) return null;
         // console.log(`ProductDetailsScreen: Rendering pagination - Index: ${activeIndex}, Total: ${galleryItems.length}`);
         return (<View style={styles.paginationTextContainer}><Text style={styles.paginationText}>{activeIndex + 1} / {galleryItems.length}</Text></View>);
    };
    const renderPriceSection = () => { if (!finalDisplayPrice) return <Text style={styles.noPriceText}>Price not available</Text>; return (<View style={styles.priceRow}><Text style={styles.finalPrice}>{finalDisplayPrice}</Text>{hasDiscount && displayOriginalPrice && <Text style={styles.originalPrice}>{displayOriginalPrice}</Text>}</View>); };
    const renderVariationSelector = (title, options, selectedOption, setOption) => {
        // console.log(`ProductDetailsScreen: Rendering variation selector - Title: ${title}, Options: ${options?.join(', ')}, Selected: ${selectedOption}`);
        if (!options || options.length === 0) {
             return null;
        }
        return (<View style={styles.variationContainer}><Text style={styles.variationTitle}>{title}: <Text style={styles.variationSelectedValue}>{selectedOption || 'Select'}</Text></Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.variationOptionsScroll}>{options.map((option) => (<TouchableOpacity key={option.toString()} style={[ styles.variationChip, selectedOption === option && styles.variationChipActive ]} onPress={() => {
                // console.log(`ProductDetailsScreen: Variation selected - Title: ${title}, Option: ${option}`);
                setOption(option);
            }}><Text style={[ styles.variationChipText, selectedOption === option && styles.variationChipTextActive ]}>{option}</Text></TouchableOpacity>))}</ScrollView></View>);
    };

    // --- Render BNPL Plans Section --- (WITH UPDATED UI)
    const renderBnplPlansSection = () => {
        // console.log("ProductDetailsScreen: Checking BNPL Section - Available:", product?.bnplAvailable, "Plans:", product?.BNPLPlans);
        if (!product?.bnplAvailable || !Array.isArray(product.BNPLPlans) || product.BNPLPlans.length === 0) {
            // console.log("ProductDetailsScreen: Skipping BNPL plans rendering (conditions not met).");
            return null;
        }
        // console.log("ProductDetailsScreen: Rendering BNPL plans section with plans:", product.BNPLPlans);
        return (
            <View style={styles.bnplSectionContainer}>
                <Text style={styles.sectionTitle}>Available Installment Plans</Text>
                {product.BNPLPlans.map((plan, index) => {
                     // console.log(`ProductDetailsScreen: Rendering BNPL plan ${index + 1}:`, plan);
                     const planName = plan.planName || 'Unnamed Plan';
                     const duration = typeof plan.duration === 'number' ? plan.duration : null;
                     const planType = plan.planType || 'N/A';

                    return (
                        // New Card Style Wrapper
                        <View key={plan.id || `plan-${index}`} style={styles.bnplPlanCard}>
                            {/* Icon and Name Row */}
                            <View style={styles.bnplPlanHeader}>
                                <MaterialIcons name="payments" size={20} color={BnplPlanIconColor} style={styles.bnplPlanIcon} />
                                <Text style={styles.bnplPlanNameText}>{planName}</Text>
                            </View>
                            {/* Details Section */}
                            <View style={styles.bnplPlanDetails}>
                                {duration !== null ? (
                                    <Text style={styles.bnplPlanDetailText}>
                                        Duration: <Text style={styles.bnplPlanDetailValue}>{duration} Month{duration !== 1 ? 's' : ''}</Text>
                                    </Text>
                                ) : (
                                    <Text style={styles.bnplPlanDetailText}>Duration: Not specified</Text>
                                )}
                                <Text style={styles.bnplPlanDetailText}>
                                    Type: <Text style={styles.bnplPlanDetailValue}>{planType}</Text>
                                </Text>
                            </View>
                        </View>
                    );
                })}
            </View>
        );
    };

    // --- Render Review Card ---
    const renderReviewCard = ({ item, index, totalItems }) => {
        // console.log(`ProductDetailsScreen: Rendering review card ${index + 1}/${totalItems}:`, item);
        const isLastItem = index === totalItems - 1;
        return (<View style={[ styles.reviewCard, isLastItem && { borderBottomWidth: 0 } ]}><View style={styles.reviewHeader}><View style={styles.reviewHeaderRating}>{[...Array(5)].map((_, i) => (<MaterialIcons key={i} name="star" size={16} color={i < item.rating ? '#FFC107' : '#E0E0E0'} />))}</View><Text style={styles.reviewerName}>{item.name || 'Anonymous'} <Text style={styles.reviewDate}>· {item.date || ''}</Text></Text></View><Text style={styles.reviewText}>{item.comment || ''}</Text></View>);
    };

    // --- Early Return if Product Data is Missing ---
    if (!product || !product.id) {
        console.error("ProductDetailsScreen: ERROR - Product data missing or invalid. Cannot render details.", product);
        return ( <SafeAreaView style={styles.safeArea}><View style={styles.loadingContainer}><Text style={styles.errorText}>Product information not available.</Text></View></SafeAreaView> );
    }

    // console.log("ProductDetailsScreen: Starting main component render for product:", product.name);

    // --- Main Component Return ---
    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
            <StatusBar barStyle="dark-content" backgroundColor={AppBackgroundColor} />

            {/* <ScrollView ref={scrollViewRef} ... > */}
            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} >
                {/* Gallery */}
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
                        scrollEventThrottle={16}
                        style={styles.galleryFlatList}
                        initialNumToRender={1}
                        maxToRenderPerBatch={1}
                        windowSize={3}
                    />
                    <View style={styles.galleryOverlayContainer}>
                        {renderTextPagination()}
                    </View>
                </View>

                {/* Content */}
                <View style={styles.contentContainer}>
                    <Text style={styles.productName}>{product.name ?? 'Unnamed Product'}</Text>
                    <Text style={styles.soldCountText}>{displaySoldCount} sold</Text>
                    <View style={styles.priceActionsRow}>
                        {renderPriceSection()}
                        <View style={styles.rightActionButtonsGroup}>
                            <TouchableOpacity onPress={toggleWishlist} style={styles.iconButton}>
                                <MaterialIcons name={isWishlisted ? 'favorite' : 'favorite-border'} size={24} color={isWishlisted ? AccentColor : TextColorPrimary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={shareProduct} style={[styles.iconButton, { marginLeft: 10 }]}>
                                <Feather name="share-2" size={22} color={TextColorPrimary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Simple BNPL Available Badge */}
                    {product?.bnplAvailable && (
                         <View style={styles.bnplInfoContainer}>
                            <MaterialIcons name="schedule" size={16} color={BnplInfoTextColor} style={{ marginRight: 5 }}/>
                            <Text style={styles.bnplInfoText}>BNPL Available</Text>
                         </View>
                    )}

                    {/* Variations */}
                    {renderVariationSelector('Size', product.variations?.sizes, selectedSize, setSelectedSize)}
                    {renderVariationSelector('Color', product.variations?.colors, selectedColor, setSelectedColor)}

                    {/* *** Render BNPL Plans Detailed Section *** */}
                    {renderBnplPlansSection()}

                    {/* Description */}
                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.descriptionText}>{product.description || 'No description available.'}</Text>

                    {/* --- Reviews Section --- */}
                     {/* <View ref={reviewSectionRef}> */}
                     <View>
                        <View style={styles.reviewSectionHeader}>
                            <Text style={styles.sectionTitle}>Reviews ({allReviews.length})</Text>
                            <View style={styles.reviewOverallRating}>
                                <MaterialIcons name="star" size={18} color="#FFC107" style={{ marginRight: 4 }}/>
                                <Text style={styles.reviewOverallRatingText}>{averageRating.toFixed(1)}</Text>
                            </View>
                        </View>
                        <FlatList
                            data={displayReviews}
                            renderItem={({ item, index }) => renderReviewCard({ item, index, totalItems: displayReviews.length })}
                            keyExtractor={(item, index) => (item.id ? item.id.toString() : `review-${index}`)}
                            scrollEnabled={false}
                            ListEmptyComponent={<Text style={styles.noReviewsText}>No reviews yet.</Text>}
                        />
                        {/* Conditional "See More" / "See Less" Buttons */}
                        {allReviews.length > MAX_INITIAL_REVIEWS && (
                            <View>
                                {!showAllReviews ? (
                                    <TouchableOpacity style={styles.seeMoreButton} onPress={handleSeeMoreReviews}>
                                        <Text style={styles.seeMoreButtonText}>See More Reviews</Text>
                                        <MaterialIcons name="keyboard-arrow-down" size={20} color={AccentColor} />
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity style={styles.seeMoreButton} onPress={handleSeeLessReviews}>
                                        <Text style={styles.seeMoreButtonText}>See Less</Text>
                                        <MaterialIcons name="keyboard-arrow-up" size={20} color={AccentColor} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>
                    {/* --- End Reviews Section --- */}

                </View>
            </ScrollView>

            {/* Action Buttons Container */}
            <View style={styles.buttonContainer}>
                 <TouchableOpacity style={[styles.bottomButtonBase, styles.chatButton]} onPress={handleChat}>
                    <MaterialIcons name="support-agent" size={22} color={ChatIconColor} style={{ marginBottom: 2 }}/>
                    <Text style={[styles.buttonText, styles.chatButtonText]}>Chat</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={[styles.bottomButtonBase, styles.cartButton]} onPress={handleAddToCart}>
                    <Text style={[styles.buttonText, styles.cartButtonText]}>Add to Cart</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={styles.buyButtonContainer} onPress={handleBuyNow}>
                    <LinearGradient colors={[AccentColor, AccentDarkerColor]} style={styles.buyButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
                        <Text style={[styles.buttonText, styles.buyButtonText]}>Buy Now</Text>
                    </LinearGradient>
                 </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: AppBackgroundColor },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: AppBackgroundColor },
    errorText: { fontSize: 16, color: TextColorSecondary, textAlign: 'center', marginTop: 10 },
    scrollContainer: { paddingBottom: 110, backgroundColor: AppBackgroundColor },
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

    // Existing BNPL Badge style
    bnplInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        marginTop: 4,
        backgroundColor: BnplInfoBgColor,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        alignSelf: 'flex-start'
    },
    bnplInfoText: {
        fontSize: 13,
        color: BnplInfoTextColor,
        fontWeight: '600'
    },

    variationContainer: { marginBottom: 20 },
    variationTitle: { fontSize: 16, fontWeight: '600', color: TextColorPrimary, marginBottom: 10 },
    variationSelectedValue: { fontWeight: 'normal', color: TextColorSecondary },
    variationOptionsScroll: { paddingBottom: 5 },
    variationChip: { borderWidth: 1, borderColor: LightBorderColor, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, marginRight: 10, backgroundColor: AppBackgroundColor },
    variationChipActive: { borderColor: AccentColor, backgroundColor: '#FFF0F0' },
    variationChipText: { fontSize: 14, color: TextColorPrimary },
    variationChipTextActive: { color: AccentColor, fontWeight: '600' },

    // --- UPDATED BNPL Plans Section Styles ---
    bnplSectionContainer: {
        marginTop: 15,
        marginBottom: 25,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: LightBorderColor,
    },
    bnplPlanCard: {
        backgroundColor: BnplPlanCardBg,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: BnplPlanCardBorder,
        padding: 15,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 1,
    },
    bnplPlanHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    bnplPlanIcon: {
        marginRight: 10,
    },
    bnplPlanNameText: {
        fontSize: 16,
        fontWeight: '600',
        color: BnplPlanNameColor,
        flexShrink: 1,
    },
    bnplPlanDetails: {
        // Container for details
    },
    bnplPlanDetailText: {
        fontSize: 13,
        color: BnplPlanDetailColor,
        lineHeight: 20,
        marginBottom: 3,
    },
    bnplPlanDetailValue: {
        fontWeight: '500',
        color: TextColorPrimary,
    },
    // --- END UPDATED BNPL Styles ---

    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 12 },
    descriptionText: { fontSize: 15, color: TextColorSecondary, lineHeight: 24, marginBottom: 25 },

    // --- Review Section Styles ---
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
    // --- End Review Section Styles ---

    // --- Bottom Button Styles ---
    buttonContainer: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        flexDirection: 'row',
        backgroundColor: AppBackgroundColor,
        paddingVertical: 8,
        paddingHorizontal: 8,
        paddingBottom: Platform.OS === 'ios' ? 26 : 8,
        borderTopWidth: 1, borderTopColor: LightBorderColor,
        alignItems: 'stretch',
    },
    bottomButtonBase: {
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 4,
        overflow: 'hidden',
    },
    chatButton: {
        flex: 0.6,
        flexDirection: 'column',
        backgroundColor: '#FAFAFA',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        paddingVertical: 6,
    },
    chatButtonText: {
        color: ChatIconColor,
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },
    cartButton: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: AppBackgroundColor,
        borderWidth: 1.5,
        borderColor: AccentColor,
        paddingVertical: 12,
    },
    cartButtonText: {
        color: AccentColor,
        fontSize: 16,
        fontWeight: 'bold',
    },
    buyButtonContainer: {
        flex: 1,
        borderRadius: 10,
        marginHorizontal: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.20,
        shadowRadius: 3.84,
        elevation: 5,
    },
    buyButtonGradient: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buyButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonText: {
        textAlign: 'center',
    },
});