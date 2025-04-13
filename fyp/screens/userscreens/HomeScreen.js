import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    Image,
    FlatList,
    Dimensions,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    ActivityIndicator,
    Animated,
    Easing,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import Icon from 'react-native-vector-icons/FontAwesome';
import { SafeAreaView } from 'react-native-safe-area-context';
// Import necessary Firestore functions
import { collection, query, getDocs, limit, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Assuming db is correctly exported
import CustomDrawerScreen from '../userscreens/CustomDrawerScreen';

const { width } = Dimensions.get('window');

const banners = [
    require('../../assets/pic3.jpg'),
    require('../../assets/pic2.jpg'),
    require('../../assets/pic4.jpg'),
];

const placeholderImage = require('../../assets/p3.jpg');

// --- Name of your BNPL Plans collection in Firestore ---
// --- Name of your BNPL Plans collection in Firestore ---
const BNPL_PLANS_COLLECTION = 'BNPL_plans'; // <-- Updated collection name
const HomeScreen = () => {
    const navigation = useNavigation();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [featuredProducts, setFeaturedProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);

    const pulseValue = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const fetchProducts = async () => {
            setLoadingProducts(true);
            console.log('Starting product fetch...');
            try {
                const productsRef = collection(db, 'Products');
                const q = query(productsRef, orderBy('createdAt', 'desc'), limit(10));
                const querySnapshot = await getDocs(q);
                console.log(`Fetched ${querySnapshot.docs.length} product documents.`);

                // 1. Initial mapping of product data
                const initialProductsData = querySnapshot.docs.map(docSnapshot => {
                    const data = docSnapshot.data();
                    // --- Extract necessary fields, including BNPLPlans IDs ---
                    return {
                        id: docSnapshot.id,
                        name: data.name || 'Unnamed Product',
                        originalPrice: data.originalPrice,
                        discountedPrice: data.discountedPrice,
                        // Use media.images first, fallback to top-level image
                        image: data.media?.images?.[0] || data.image || null,
                        description: data.description || '',
                        paymentOption: data.paymentOption || { COD: false, BNPL: false }, // Ensure default
                        // Keep the raw plan IDs for now
                        BNPLPlanIDs: Array.isArray(data.BNPLPlans) ? data.BNPLPlans : [],
                        // Add other fields needed by ProductDetails or this screen
                        media: data.media,
                        category: data.category,
                        // Explicitly set derived flags for clarity on this screen if needed
                        bnplAvailable: data.paymentOption?.BNPL === true,
                        codAvailable: data.paymentOption?.COD === true,
                        ...data // Include rest of data if needed downstream, be mindful of size
                    };
                });

                console.log('Initial product data mapped. Fetching BNPL plan details...');

                // 2. Fetch BNPL Plan details for relevant products
                const productsWithPlanDetails = await Promise.all(
                    initialProductsData.map(async (product) => {
                        // Check if BNPL is enabled and if there are plan IDs
                        if (product.paymentOption?.BNPL === true && product.BNPLPlanIDs.length > 0) {
                            console.log(`Fetching plans for product: ${product.id}, Plan IDs:`, product.BNPLPlanIDs);
                            try {
                                const planPromises = product.BNPLPlanIDs.map(planId => {
                                    if (!planId || typeof planId !== 'string') {
                                         console.warn(`Invalid Plan ID found for product ${product.id}:`, planId);
                                         return Promise.resolve(null); // Skip invalid IDs
                                    }
                                    const planRef = doc(db, BNPL_PLANS_COLLECTION, planId.trim()); // Use defined collection name
                                    return getDoc(planRef);
                                });

                                const planSnapshots = await Promise.all(planPromises);

                                const detailedPlans = planSnapshots
                                    .map(snap => {
                                        if (snap?.exists()) {
                                            // Combine Firestore data with the document ID
                                            return { id: snap.id, ...snap.data() };
                                        } else if (snap) {
                                            console.warn(`BNPL Plan with ID ${snap.id} not found for product ${product.id}`);
                                            return null;
                                        }
                                        return null;
                                    })
                                    .filter(plan => plan !== null); // Filter out nulls (not found or invalid IDs)

                                console.log(`Fetched ${detailedPlans.length} plan details for product: ${product.id}`);
                                // Replace IDs array with detailed plan objects array
                                return { ...product, BNPLPlans: detailedPlans, BNPLPlanIDs: undefined }; // Add BNPLPlans, remove BNPLPlanIDs
                            } catch (planError) {
                                console.error(`Error fetching BNPL plans for product ${product.id}:`, planError);
                                // Return product with empty plans on error to avoid crashing ProductDetails
                                return { ...product, BNPLPlans: [], BNPLPlanIDs: undefined };
                            }
                        } else {
                            // If BNPL not available or no plan IDs, ensure BNPLPlans is an empty array
                             return { ...product, BNPLPlans: [], BNPLPlanIDs: undefined };
                        }
                    })
                );

                setFeaturedProducts(productsWithPlanDetails);
                console.log('Finished fetching products and plan details.');
                // Optional: Log the final structure for one product to verify
                if (productsWithPlanDetails.length > 0) {
                   // console.log('Example final product structure:', JSON.stringify(productsWithPlanDetails[0], null, 2));
                }

            } catch (error) {
                console.error("Error fetching products: ", error);
            } finally {
                setLoadingProducts(false);
            }
        };

        fetchProducts();

        // --- Animation Logic (Keep as is) ---
        Animated.loop(
             Animated.sequence([
                 Animated.timing(pulseValue, { toValue: 1.04, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                 Animated.timing(pulseValue, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                 Animated.delay(200)
             ])
         ).start();

    }, [pulseValue]); // Dependency array remains the same

    // --- Event Handlers (Keep as is) ---
    const onScroll = (event) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(contentOffsetX / width);
        setCurrentIndex(index);
    };

    // --- Render Functions (Keep as is, but verify data access) ---
    const renderProductCard = ({ item }) => {
        // Access data directly from the 'item' (which now includes detailed BNPLPlans if applicable)
        const hasDiscount = typeof item.discountedPrice === 'number' && typeof item.originalPrice === 'number' && item.discountedPrice < item.originalPrice;
        const displayOriginalPrice = typeof item.originalPrice === 'number' ? `RS ${item.originalPrice.toFixed(0)}` : null;
        const displayDiscountedPrice = typeof item.discountedPrice === 'number' ? `RS ${item.discountedPrice.toFixed(0)}` : null;

        // Determine badge based on top-level flags (already derived during fetch)
        const showBnplBadge = item.bnplAvailable === true;
        const showCodBadge = item.codAvailable === true && !showBnplBadge; // Show COD only if BNPL isn't shown

        return (
            <TouchableOpacity
                style={styles.productCard}
                // Pass the entire processed item (with detailed plans) to ProductDetails
                onPress={() => navigation.navigate('ProductDetails', { product: item })}
            >
                <Image
                    source={item.image ? { uri: item.image } : placeholderImage}
                    style={styles.productImage}
                    resizeMode="contain"
                    onError={(e) => console.log('Image Load Error:', e.nativeEvent.error, 'URL:', item.image)}
                />
                <Text style={styles.productName} numberOfLines={1} ellipsizeMode="tail">{item.name || ''}</Text>

                <View style={styles.priceContainer}>
                   {/* Price rendering logic remains the same */}
                   {displayOriginalPrice && (
                        <Text style={[styles.productPrice, hasDiscount && styles.strikethroughPrice]}>
                            {displayOriginalPrice}
                        </Text>
                    )}
                    {hasDiscount && displayDiscountedPrice && (
                        <Text style={styles.discountedPrice}>
                            {displayDiscountedPrice}
                        </Text>
                    )}
                    {!hasDiscount && displayOriginalPrice && (
                         <Text style={styles.discountedPrice}>
                            {displayOriginalPrice} {/* Show original as main price if no discount */}
                        </Text>
                    )}
                     {!hasDiscount && !displayOriginalPrice && displayDiscountedPrice && (
                         <Text style={styles.discountedPrice}>
                             {displayDiscountedPrice} {/* Show discount as main price if no original */}
                         </Text>
                    )}
                </View>

                {item.description ? (
                    <Text style={styles.productDescription} numberOfLines={2} ellipsizeMode="tail">
                        {item.description}
                    </Text>
                 ) : <View style={{height: 28}}/> /* Add placeholder height if no description */}

                {/* Badge Logic */}
                {showBnplBadge ? (
                    <View style={styles.bnplBadge}>
                        <MaterialIcons name="schedule" size={14} color="#1565C0" />
                        <Text style={styles.bnplText}>BNPL Available</Text>
                    </View>
                ) : showCodBadge ? (
                    <View style={styles.codBadge}>
                        <MaterialIcons name="local-shipping" size={14} color="#EF6C00" />
                        <Text style={styles.codText}>COD Available</Text>
                    </View>
                ) : (
                     <View style={{ height: 24 }} /> // Placeholder height if neither badge shown
                )}

            </TouchableOpacity>
        );
    };

    const renderBanner = ({ item }) => (<Image source={item} style={styles.banner} resizeMode="cover"/>);
    const renderAnimatedTitle = () => ( /* Keep as is */ <View style={styles.titleOuterContainer}><Animated.View style={[styles.animatedTitleBgContainer, { transform: [{ scale: pulseValue }] }]}><Icon name="tag" size={16} color="#FFFFFF" style={{ marginRight: 8 }} /><Text style={styles.animatedTitleText}>Products For You</Text></Animated.View></View>);

    const renderProductSection = () => {
        if (loadingProducts) {
            return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color="#FF0000" /></View>);
        }
        if (featuredProducts.length === 0) {
            return (<View style={styles.loadingContainer}><Text style={styles.noProductsText}>No products found.</Text></View>);
        }
        // This FlatList now receives items with detailed BNPLPlans included
        return (<FlatList
                    data={featuredProducts}
                    renderItem={renderProductCard}
                    keyExtractor={(p) => `product-${p.id}`}
                    numColumns={2}
                    contentContainerStyle={styles.gridContainer}
                    scrollEnabled={false} // Keep false if nested in another ScrollView/FlatList
                />);
    }

    // --- Main Return (Keep as is) ---
    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="black" />

            {/* Header */}
            <View style={styles.header}>
                <Image source={require('../../assets/cod.png')} style={styles.logo} />
                <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
                    <View style={styles.profileIconContainer}><Icon name="user" size={20} color="white" /></View>
                </TouchableOpacity>
            </View>

            {/* Main List */}
            <FlatList
                ListHeaderComponent={ /* Banner Slider Logic */
                    <View style={styles.sliderContainer}>
                       {/* ... banner flatlist and pagination ... */}
                       <FlatList horizontal pagingEnabled showsHorizontalScrollIndicator={false} data={banners} renderItem={renderBanner} keyExtractor={(b, i) => `banner-${i}`} onScroll={onScroll} scrollEventThrottle={16} />
                       <View style={styles.pagination}>{banners.map((_, index) => (<View key={`dot-${index}`} style={[styles.dot, currentIndex === index ? styles.activeDot : null]} />))}</View>
                    </View>
                }
                data={[{ key: 'contentSection' }]} // Use a dummy data item for the main list structure
                renderItem={({ item }) => {
                    // Render the title and product grid within this single item
                    return (
                        <View>
                            {renderAnimatedTitle()}
                            {renderProductSection()}
                        </View>
                    );
                }}
                keyExtractor={(item) => item.key}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
            />

            {/* Drawer */}
            {isDrawerOpen && (
                <View style={[StyleSheet.absoluteFill, styles.drawerOverlay]} pointerEvents="box-none">
                    <CustomDrawerScreen navigation={navigation} closeDrawer={() => setIsDrawerOpen(false)} />
                </View>
             )}
        </SafeAreaView>
    );
};

// --- Styles (Keep as is) ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F5F5F5' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FF0000', paddingVertical: 10, paddingHorizontal: 15, height: 60, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, },
    logo: { width: 100, height: 35, resizeMode: 'contain' },
    profileIconContainer: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'white', justifyContent: 'center', alignItems: 'center' },
    drawerOverlay: { backgroundColor: 'rgba(0, 0, 0, 0.3)', zIndex: 10, },
    sliderContainer: { height: 200, backgroundColor: '#e0e0e0' },
    banner: { width: width, height: 200 },
    pagination: { flexDirection: 'row', position: 'absolute', bottom: 10, alignSelf: 'center', backgroundColor: 'rgba(0, 0, 0, 0.4)', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 12 },
    dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4, backgroundColor: '#FFF', opacity: 0.6 },
    activeDot: { opacity: 1, backgroundColor: 'red' },
    titleOuterContainer: { alignItems: 'flex-start', marginTop: 15, marginBottom: 15, paddingHorizontal: 0, },
    animatedTitleBgContainer: { backgroundColor: '#FF0000', paddingVertical: 8, paddingHorizontal: 25, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderTopRightRadius: 20, borderBottomRightRadius: 20, flexDirection: 'row', alignItems: 'center', elevation: 4, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.20, shadowRadius: 4, },
    animatedTitleText: { fontSize: 17, fontWeight: 'bold', color: '#FFFFFF', textShadowColor: 'rgba(0, 0, 0, 0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2, },
    gridContainer: { paddingHorizontal: 10, },
    productCard: { backgroundColor: '#fff', borderRadius: 8, margin: 6, flex: 0.5, alignItems: 'center', padding: 8, paddingBottom: 4, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.20, shadowRadius: 1.41, minHeight: 280, // Adjusted minHeight slightly for badges/desc
        justifyContent: 'space-between', },
    productImage: { width: '100%', height: 110, borderRadius: 6, marginBottom: 8, backgroundColor: '#F0F0F0' },
    productName: { fontSize: 14, fontWeight: '600', color: '#333', textAlign: 'center', minHeight: 18, marginBottom: 4, paddingHorizontal: 2 },
    priceContainer: { flexDirection: 'column', alignItems: 'center', marginTop: 4, minHeight: 35, marginBottom: 6, },
    productPrice: { fontSize: 14, color: 'red', fontWeight: 'bold', },
    strikethroughPrice: { textDecorationLine: 'line-through', color: '#999', fontWeight: 'normal', fontSize: 13, },
    discountedPrice: { fontSize: 15, color: '#E53935', fontWeight: 'bold', },
    productDescription: { fontSize: 12, color: '#666', textAlign: 'center', marginTop: 4, marginBottom: 6, paddingHorizontal: 5, flexGrow: 1, flexShrink: 1, minHeight: 28, }, // Ensure description has space
    bnplBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, marginTop: 'auto', // Pushes to bottom
        marginBottom: 4, alignSelf: 'center', flexShrink: 0, height: 24 },
    bnplText: { fontSize: 11, color: '#1565C0', marginLeft: 4, fontWeight: '600', },
    codBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, marginTop: 'auto', // Pushes to bottom
        marginBottom: 4, alignSelf: 'center', flexShrink: 0, height: 24 },
    codText: { fontSize: 11, color: '#EF6C00', marginLeft: 4, fontWeight: '600', },
    loadingContainer: { justifyContent: 'center', alignItems: 'center', paddingVertical: 50, minHeight: 200, },
    noProductsText: { fontSize: 16, color: '#888' },
});

export default HomeScreen;