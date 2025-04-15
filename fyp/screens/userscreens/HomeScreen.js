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
    ScrollView, // Keep ScrollView as requested in a previous step for layout
    Alert // Added Alert for error handling
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import Icon from 'react-native-vector-icons/FontAwesome';
import { SafeAreaView } from 'react-native-safe-area-context';
// *** Removed limit from import ***
import { collection, query, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Adjust path if needed
import CustomDrawerScreen from '../userscreens/CustomDrawerScreen'; // Adjust path if needed

const { width } = Dimensions.get('window');

// Static banners (keep as is)
const banners = [
    require('../../assets/pic2.jpg'), // Adjust path
    require('../../assets/pic3.jpg'), // Adjust path
    require('../../assets/pic4.jpg'), // Adjust path
];

// Placeholder image (keep as is)
const placeholderImage = require('../../assets/p3.jpg'); // Adjust path

// Firestore collection names (defined for clarity)
const BNPL_PLANS_COLLECTION = 'BNPL_plans';
const PRODUCTS_COLLECTION = 'Products';

// Constants
const CURRENCY_SYMBOL = 'RS'; // Or your preferred currency
const NUM_COLUMNS = 2;
const CARD_MARGIN = 5;
const GRID_PADDING_HORIZONTAL = 10; // Define Padding Constant for grid layout

const HomeScreen = () => {
    const navigation = useNavigation();
    const [currentIndex, setCurrentIndex] = useState(0); // For banner pagination
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    // *** Changed state name to reflect it holds all products ***
    const [allProducts, setAllProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const flatListRef = useRef(null); // Ref for banner FlatList

    useEffect(() => {
        const fetchAllProducts = async () => { // Renamed function for clarity
            setLoadingProducts(true);
            console.log('Starting fetch for ALL products...'); // Updated log message
            try {
                const productsRef = collection(db, PRODUCTS_COLLECTION); // Use constant
                // *** THE ONLY LOGIC CHANGE: Removed limit(10) ***
                const q = query(productsRef, orderBy('createdAt', 'desc'));
                const querySnapshot = await getDocs(q);
                // Log the actual number fetched
                console.log(`Fetched ${querySnapshot.docs.length} total product documents.`);

                const initialProductsData = querySnapshot.docs.map(docSnapshot => {
                    const data = docSnapshot.data();
                    // Keep the same data structuring logic
                    return {
                        id: docSnapshot.id,
                        name: data.name || 'Unnamed Product',
                        originalPrice: data.originalPrice,
                        discountedPrice: data.discountedPrice,
                        image: data.media?.images?.[0] || data.image || null,
                        description: data.description || '',
                        paymentOption: data.paymentOption || { COD: false, BNPL: false },
                        // Keep BNPL ID handling logic
                        BNPLPlanIDs: Array.isArray(data.BNPLPlans)
                            ? data.BNPLPlans.filter(id => typeof id === 'string' && id.trim() !== '')
                            : (Array.isArray(data.BNPLPlanIDs) ? data.BNPLPlanIDs.filter(id => typeof id === 'string' && id.trim() !== '') : []),
                        media: data.media,
                        category: data.category || 'Uncategorized',
                        bnplAvailable: data.paymentOption?.BNPL === true,
                        codAvailable: data.paymentOption?.COD === true,
                        ...data
                    };
                });

                console.log('Initial product data mapped. Fetching BNPL plan details...');

                // Keep BNPL details fetching logic
                const productsWithPlanDetails = await Promise.all(
                    initialProductsData.map(async (product) => {
                        let detailedPlans = [];
                        if (product.bnplAvailable && product.BNPLPlanIDs.length > 0) {
                            try {
                                const planPromises = product.BNPLPlanIDs.map(planId => {
                                    if (!planId || typeof planId !== 'string') {
                                         console.warn(`Invalid Plan ID for product ${product.id}:`, planId);
                                         return Promise.resolve(null);
                                    }
                                    const planRef = doc(db, BNPL_PLANS_COLLECTION, planId.trim());
                                    return getDoc(planRef);
                                });
                                const planSnapshots = await Promise.all(planPromises);
                                detailedPlans = planSnapshots
                                    .map(snap => snap?.exists() ? { id: snap.id, ...snap.data() } : null)
                                    .filter(plan => plan !== null);
                            } catch (planError) {
                                console.error(`Error fetching BNPL plans for product ${product.id}:`, planError);
                            }
                        }
                        return { ...product, BNPLPlans: detailedPlans, BNPLPlanIDs: undefined };
                    })
                );

                // *** Update the state variable holding the products ***
                setAllProducts(productsWithPlanDetails);
                console.log('Finished fetching products and plan details.');

            } catch (error) {
                console.error("Error fetching products: ", error);
                Alert.alert("Error", "Could not load products."); // Inform user of error
                setAllProducts([]); // Clear products on error to avoid showing stale data
            } finally {
                setLoadingProducts(false);
            }
        };

        fetchAllProducts(); // Call the fetch function

    }, []); // Fetch once on mount

    // Keep banner scroll logic
    const onScroll = (event) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(contentOffsetX / width);
        setCurrentIndex(index);
    };

    // Keep renderProductCard logic exactly as provided
    const renderProductCard = ({ item }) => {
        const hasDiscount = typeof item.discountedPrice === 'number' && typeof item.originalPrice === 'number' && item.discountedPrice < item.originalPrice;
        // *** Use CURRENCY_SYMBOL constant ***
        const displayOriginalPrice = typeof item.originalPrice === 'number' ? `${CURRENCY_SYMBOL} ${item.originalPrice.toFixed(0)}` : null;
        const displayDiscountedPrice = typeof item.discountedPrice === 'number' ? `${CURRENCY_SYMBOL} ${item.discountedPrice.toFixed(0)}` : null;

        const showBnplBadge = item.bnplAvailable === true;
        const showCodBadge = item.codAvailable === true && !showBnplBadge;

        let finalPriceString = '';
        if (hasDiscount && displayDiscountedPrice) { finalPriceString = displayDiscountedPrice; }
        else if (displayOriginalPrice) { finalPriceString = displayOriginalPrice; }
        else if (displayDiscountedPrice) { finalPriceString = displayDiscountedPrice; }


        return (
            <TouchableOpacity
                style={styles.productCard}
                onPress={() => navigation.navigate('ProductDetails', {
                    product: item, // Pass the full item object
                    // categoryName: item.category // Pass if needed by ProductDetails
                })}
            >
                <Image
                    source={item.image ? { uri: item.image } : placeholderImage}
                    style={styles.productImage}
                    resizeMode="contain"
                    onError={(e) => console.log('Image Load Error:', e.nativeEvent.error, 'URL:', item.image)}
                />
                <Text style={styles.productName} numberOfLines={1} ellipsizeMode="tail">{item.name || ''}</Text>

                <View style={styles.priceContainer}>
                    {hasDiscount && displayOriginalPrice && (
                        <Text style={[styles.productPrice, styles.strikethroughPrice]}>
                            {/* Render formatted string */}
                            {displayOriginalPrice}
                        </Text>
                    )}
                     {/* Render final price */}
                     {finalPriceString ? (
                        <Text style={styles.discountedPrice}>
                            {finalPriceString}
                        </Text>
                     ) : (
                         <View style={{ height: 20 }} /> // Placeholder
                     )}
                </View>

                {item.description ? (
                    <Text style={styles.productDescription} numberOfLines={2} ellipsizeMode="tail">
                        {item.description}
                    </Text>
                 ) : <View style={{height: 28}}/> }

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
                     <View style={{ height: 24 }} />
                )}
            </TouchableOpacity>
        );
    };

    // Keep renderBanner logic
    const renderBanner = ({ item }) => (<Image source={item} style={styles.banner} resizeMode="cover"/>);

    // Keep renderTitle logic
    const renderTitle = () => (
        <View style={styles.titleOuterContainer}>
            <View style={styles.titleBgContainer}>
                <Icon name="tag" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.titleText}>Products For You</Text>
            </View>
        </View>
    );

    // Keep renderProductSection logic, ensuring it uses the correct state
    const renderProductSection = () => {
        if (loadingProducts) {
            return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color="#FF0000" /></View>);
        }
        // *** Use allProducts state here ***
        if (allProducts.length === 0) {
            return (<View style={styles.loadingContainer}><Text style={styles.noProductsText}>No products found.</Text></View>);
        }
        return (<FlatList
                    // *** Use allProducts state here ***
                    data={allProducts}
                    renderItem={renderProductCard}
                    keyExtractor={(p) => p.id} // Use Firestore ID as key
                    numColumns={NUM_COLUMNS}
                    contentContainerStyle={styles.gridContainer}
                    scrollEnabled={false} // Keep nested list non-scrollable
                />);
    }

    // Main return structure using ScrollView
    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#FF0000" />

            {/* Header */}
            <View style={styles.header}>
                 <Image source={require('../../assets/cod.png')} style={styles.logo} />
                 <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
                    <View style={styles.profileIconContainer}><Icon name="user" size={20} color="white" /></View>
                 </TouchableOpacity>
            </View>

            {/* Main Scrollable Content */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContentContainer}>
                 {/* Banner Section */}
                 <View style={styles.sliderContainer}>
                    <FlatList
                        ref={flatListRef} // Assign ref
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        data={banners}
                        renderItem={renderBanner}
                        keyExtractor={(b, i) => `banner-${i}`}
                        onScroll={onScroll}
                        scrollEventThrottle={16}
                    />
                    <View style={styles.pagination}>
                        {banners.map((_, index) => (
                            <View key={`dot-${index}`} style={[styles.dot, currentIndex === index ? styles.activeDot : null]} />
                        ))}
                    </View>
                 </View>

                 {/* Title Section */}
                 {renderTitle()}

                 {/* Product Grid Section - Rendered directly */}
                 {renderProductSection()}

                 {/* Add some padding at the very bottom inside ScrollView */}
                 <View style={{ height: 30 }} />
            </ScrollView>

             {/* Drawer remains the same */}
            {isDrawerOpen && (
                <View style={[StyleSheet.absoluteFill, styles.drawerOverlay]} pointerEvents="box-none">
                    <CustomDrawerScreen navigation={navigation} closeDrawer={() => setIsDrawerOpen(false)} />
                </View>
             )}
        </SafeAreaView>
    );
};

// --- Styles (Includes fix for width calculation) ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F5F5F5' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FF0000', paddingVertical: 10, paddingHorizontal: 15, height: 60, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, },
    logo: { width: 100, height: 35, resizeMode: 'contain' },
    profileIconContainer: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'white', justifyContent: 'center', alignItems: 'center' },
    drawerOverlay: { backgroundColor: 'rgba(0, 0, 0, 0.3)', zIndex: 10, },
    scrollContentContainer: { paddingBottom: 20, }, // Padding for ScrollView content
    sliderContainer: { height: 200, backgroundColor: '#e0e0e0', marginBottom: 10 },
    banner: { width: width, height: 200 },
    pagination: { flexDirection: 'row', position: 'absolute', bottom: 10, alignSelf: 'center', backgroundColor: 'rgba(0, 0, 0, 0.4)', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 12 },
    dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4, backgroundColor: '#FFF', opacity: 0.6 },
    activeDot: { opacity: 1, backgroundColor: 'red' },
    titleOuterContainer: { alignItems: 'flex-start', marginTop: 8, marginBottom: 15, paddingHorizontal: 0, },
    titleBgContainer: { backgroundColor: '#FF0000', paddingVertical: 8, paddingHorizontal: 15, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderTopRightRadius: 20, borderBottomRightRadius: 20, flexDirection: 'row', alignItems: 'center', elevation: 4, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.20, shadowRadius: 4, },
    titleText: { fontSize: 17, fontWeight: 'bold', color: '#FFFFFF', textShadowColor: 'rgba(0, 0, 0, 0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2, },
    gridContainer: {
        paddingHorizontal: GRID_PADDING_HORIZONTAL, // Use Constant
    },
    productCard: {
        backgroundColor: '#fff',
        borderRadius: 8,
        margin: CARD_MARGIN,
        // *** Use Constant for Calculation ***
        width: (width - (GRID_PADDING_HORIZONTAL * 2) - (CARD_MARGIN * NUM_COLUMNS * 2)) / NUM_COLUMNS,
        alignItems: 'center',
        padding: 10,
        paddingBottom: 4,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.20,
        shadowRadius: 1.41,
        minHeight: 280,
        justifyContent: 'space-between',
    },
    productImage: { width: '100%', height: 110, borderRadius: 6, marginBottom: 8, backgroundColor: '#F8F8F8' },
    productName: { fontSize: 14, fontWeight: '600', color: '#333', textAlign: 'center', minHeight: 18, marginBottom: 4, paddingHorizontal: 2, width: '100%', },
    priceContainer: { flexDirection: 'column', alignItems: 'center', marginTop: 4, minHeight: 35, marginBottom: 6, justifyContent: 'center', width: '100%', },
    productPrice: { fontSize: 14, color: '#333', fontWeight: 'bold', },
    strikethroughPrice: { textDecorationLine: 'line-through', color: '#999', fontWeight: 'normal', fontSize: 13, marginBottom: 2, },
    discountedPrice: { fontSize: 15, color: '#E53935', fontWeight: 'bold', },
    productDescription: { fontSize: 12, color: '#666', textAlign: 'center', marginTop: 4, marginBottom: 6, paddingHorizontal: 5, flexGrow: 1, flexShrink: 1, minHeight: 28, width: '95%', },
    bnplBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, marginBottom: 4, alignSelf: 'center', flexShrink: 0, height: 24 },
    bnplText: { fontSize: 11, color: '#1565C0', marginLeft: 4, fontWeight: '600', },
    codBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, marginBottom: 4, alignSelf: 'center', flexShrink: 0, height: 24 },
    codText: { fontSize: 11, color: '#EF6C00', marginLeft: 4, fontWeight: '600', },
    loadingContainer: { justifyContent: 'center', alignItems: 'center', paddingVertical: 50, minHeight: 200, },
    noProductsText: { fontSize: 16, color: '#888' },
});

export default HomeScreen;