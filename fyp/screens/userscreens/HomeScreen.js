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
    ScrollView,
    Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import Icon from 'react-native-vector-icons/FontAwesome';
import { SafeAreaView } from 'react-native-safe-area-context';
// *** Firebase Imports ***
import { getAuth, onAuthStateChanged } from "firebase/auth"; // Added Auth imports
import { collection, query, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Adjust path if needed
// *** AsyncStorage Import ***
import AsyncStorage from '@react-native-async-storage/async-storage'; // Added AsyncStorage import
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
// ** Default profile image placeholder **
const defaultProfileImageUri = 'https://www.w3schools.com/w3images/avatar2.png'; // Standard placeholder

// Firestore collection names (defined for clarity)
const BNPL_PLANS_COLLECTION = 'BNPL_plans';
const PRODUCTS_COLLECTION = 'Products';
const USERS_COLLECTION = 'Users'; // Assuming your users collection name

// Constants
const CURRENCY_SYMBOL = 'RS'; // Or your preferred currency
const NUM_COLUMNS = 2;
const CARD_MARGIN = 5;
const GRID_PADDING_HORIZONTAL = 10; // Define Padding Constant for grid layout

const HomeScreen = () => {
    const navigation = useNavigation();
    const [currentIndex, setCurrentIndex] = useState(0); // For banner pagination
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [allProducts, setAllProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const flatListRef = useRef(null); // Ref for banner FlatList

    // --- Start: State for Profile Picture ---
    const [profileImage, setProfileImage] = useState(null); // Store the image URI
    const [loadingProfile, setLoadingProfile] = useState(true); // Loading state for profile pic
    const [userId, setUserId] = useState(null); // Store user ID
    // --- End: State for Profile Picture ---

    // --- Start: Fetch Profile Image Logic ---
    const fetchProfileImage = async (uid) => {
        if (!uid) {
            setProfileImage(null);
            setLoadingProfile(false);
            return;
        }
        setLoadingProfile(true);
        const cacheKey = `profileImage_${uid}`;

        try {
            // Check cache first
            const cachedImage = await AsyncStorage.getItem(cacheKey);
            if (cachedImage) {
                setProfileImage(cachedImage);
                setLoadingProfile(false);
                // Optionally: Fetch in background to check for updates, but show cached first
                // getDoc(doc(db, USERS_COLLECTION, uid)).then(...)
                return; // Exit if cached version is found and deemed sufficient for now
            }

            // If not in cache, fetch from Firestore
            const userRef = doc(db, USERS_COLLECTION, uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                const imageUrl = userDoc.data()?.profileImage || null; // Use optional chaining
                if (imageUrl) {
                    setProfileImage(imageUrl);
                    await AsyncStorage.setItem(cacheKey, imageUrl); // Cache the fetched image
                } else {
                    setProfileImage(null); // Use default if no image URL in Firestore
                    await AsyncStorage.removeItem(cacheKey); // Ensure no invalid cache entry
                }
            } else {
                 console.log("User document not found for profile image fetch:", uid);
                 setProfileImage(null); // User doc doesn't exist
                 await AsyncStorage.removeItem(cacheKey);
            }
        } catch (error) {
            console.error("Error fetching profile image:", error);
            setProfileImage(null); // Set to default on error
            // Don't clear cache on network error, maybe it's temporary
        } finally {
            setLoadingProfile(false);
        }
    };
    // --- End: Fetch Profile Image Logic ---


    // --- Start: useEffect for Auth State and Profile Fetching ---
    useEffect(() => {
        const auth = getAuth();
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log("User logged in:", user.uid);
                setUserId(user.uid); // Store UID
                fetchProfileImage(user.uid); // Fetch profile image for the logged-in user
            } else {
                console.log("User logged out");
                setUserId(null);
                setProfileImage(null); // Clear profile image on logout
                setLoadingProfile(false); // Stop loading indicator
                // Optionally clear cache, but maybe wait until next login attempt?
                // if (userId) { // Clear cache for the user who just logged out
                //     AsyncStorage.removeItem(`profileImage_${userId}`);
                // }
            }
        });

        // Cleanup function for the auth listener
        return () => unsubscribeAuth();
    }, []); // Run only once on mount to set up the listener
    // --- End: useEffect for Auth State ---


    // --- Start: useEffect for fetching products (no changes needed here) ---
    useEffect(() => {
        const fetchAllProducts = async () => {
            setLoadingProducts(true);
            console.log('Starting fetch for ALL products...');
            try {
                const productsRef = collection(db, PRODUCTS_COLLECTION);
                const q = query(productsRef, orderBy('createdAt', 'desc'));
                const querySnapshot = await getDocs(q);
                console.log(`Fetched ${querySnapshot.docs.length} total product documents.`);

                const initialProductsData = querySnapshot.docs.map(docSnapshot => {
                    const data = docSnapshot.data();
                    return {
                        id: docSnapshot.id,
                        name: data.name || 'Unnamed Product',
                        originalPrice: data.originalPrice,
                        discountedPrice: data.discountedPrice,
                        image: data.media?.images?.[0] || data.image || null,
                        description: data.description || '',
                        paymentOption: data.paymentOption || { COD: false, BNPL: false },
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
                        // Remove the original IDs array, replace with fetched details
                        return { ...product, BNPLPlans: detailedPlans, BNPLPlanIDs: undefined };
                    })
                );

                setAllProducts(productsWithPlanDetails);
                console.log('Finished fetching products and plan details.');

            } catch (error) {
                console.error("Error fetching products: ", error);
                Alert.alert("Error", "Could not load products.");
                setAllProducts([]);
            } finally {
                setLoadingProducts(false);
            }
        };

        fetchAllProducts();

    }, []); // Fetch products once on mount
    // --- End: useEffect for fetching products ---


    // Banner scroll logic (no changes needed)
    const onScroll = (event) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(contentOffsetX / width);
        setCurrentIndex(index);
    };

    // renderProductCard logic (no changes needed)
    const renderProductCard = ({ item }) => {
        const hasDiscount = typeof item.discountedPrice === 'number' && typeof item.originalPrice === 'number' && item.discountedPrice < item.originalPrice;
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
                    product: item,
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
                            {displayOriginalPrice}
                        </Text>
                    )}
                     {finalPriceString ? (
                        <Text style={styles.discountedPrice}>
                            {finalPriceString}
                        </Text>
                     ) : (
                         <View style={{ height: 20 }} /> // Placeholder if no price
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
                     <View style={{ height: 24 }} /> // Placeholder if no badge
                )}
            </TouchableOpacity>
        );
    };

    // renderBanner logic (no changes needed)
    const renderBanner = ({ item }) => (<Image source={item} style={styles.banner} resizeMode="cover"/>);

    // renderTitle logic (no changes needed)
    const renderTitle = () => (
        <View style={styles.titleOuterContainer}>
            <View style={styles.titleBgContainer}>
                <Icon name="tag" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.titleText}>Products For You</Text>
            </View>
        </View>
    );

    // renderProductSection logic (no changes needed)
    const renderProductSection = () => {
        if (loadingProducts) {
            return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color="#FF0000" /></View>);
        }
        if (allProducts.length === 0) {
            return (<View style={styles.loadingContainer}><Text style={styles.noProductsText}>No products found.</Text></View>);
        }
        return (<FlatList
                    data={allProducts}
                    renderItem={renderProductCard}
                    keyExtractor={(p) => p.id}
                    numColumns={NUM_COLUMNS}
                    contentContainerStyle={styles.gridContainer}
                    scrollEnabled={false}
                />);
    }

    // Main return structure using ScrollView
    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#FF0000" />

            {/* --- Start: Updated Header --- */}
            <View style={styles.header}>
                 <Image source={require('../../assets/cod.png')} style={styles.logo} />
                 <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
                    <View style={styles.profileIconContainer}>
                        {loadingProfile ? (
                            <ActivityIndicator size="small" color="white" /> // Show loader while fetching
                        ) : (
                            <Image
                                // Use fetched profileImage or fallback to default
                                source={{ uri: profileImage || defaultProfileImageUri }}
                                style={styles.profileImageStyle} // Use dedicated style for image
                            />
                        )}
                    </View>
                 </TouchableOpacity>
            </View>
            {/* --- End: Updated Header --- */}


            {/* Main Scrollable Content */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContentContainer}>
                 {/* Banner Section */}
                 <View style={styles.sliderContainer}>
                    <FlatList
                        ref={flatListRef}
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

                 {/* Product Grid Section */}
                 {renderProductSection()}

                 <View style={{ height: 30 }} />{/* Bottom padding */}
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

// --- Styles ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F5F5F5' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FF0000', paddingVertical: 10, paddingHorizontal: 15, height: 60, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, },
    logo: { width: 100, height: 35, resizeMode: 'contain' },
    // Style for the container around the profile image/loader
    profileIconContainer: {
        width: 50,
        height: 50,
        borderRadius: 40, // Make it circular
        borderWidth: 1, // Optional border
        borderColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#D32F2F', // Background color while loading or if no image
        overflow: 'hidden', // Clip the image to the circle
    },
    // Style specifically for the profile Image component
    profileImageStyle: {
        width: '100%',
        height: '100%',
        borderRadius: 20, // Ensure image itself is clipped if not perfectly square
    },
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
        width: (width - (GRID_PADDING_HORIZONTAL * 2) - (CARD_MARGIN * NUM_COLUMNS * 2)) / NUM_COLUMNS,
        alignItems: 'center',
        padding: 10,
        paddingBottom: 4,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.20,
        shadowRadius: 1.41,
        minHeight: 280, // Adjust based on your content
        justifyContent: 'space-between',
    },
    productImage: { width: '100%', height: 110, borderRadius: 6, marginBottom: 8, backgroundColor: '#F8F8F8' },
    productName: { fontSize: 14, fontWeight: '600', color: '#333', textAlign: 'center', minHeight: 18, // Allows for one line, prevents jumpiness
        marginBottom: 4, paddingHorizontal: 2, width: '100%', },
    priceContainer: { flexDirection: 'column', alignItems: 'center', marginTop: 4, minHeight: 35, // Ensure space even if only one price
        marginBottom: 6, justifyContent: 'center', width: '100%', },
    productPrice: { fontSize: 14, color: '#333', fontWeight: 'bold', },
    strikethroughPrice: { textDecorationLine: 'line-through', color: '#999', fontWeight: 'normal', fontSize: 13, marginBottom: 2, },
    discountedPrice: { fontSize: 15, color: '#E53935', fontWeight: 'bold', },
    productDescription: { fontSize: 12, color: '#666', textAlign: 'center', marginTop: 4, marginBottom: 6, paddingHorizontal: 5, flexGrow: 1, // Allow description to take space
        flexShrink: 1, // Allow description to shrink if needed
        minHeight: 28, // Roughly two lines
        width: '95%', },
    bnplBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, marginBottom: 4, alignSelf: 'center', flexShrink: 0, height: 24, // Fixed height for consistency
    },
    bnplText: { fontSize: 11, color: '#1565C0', marginLeft: 4, fontWeight: '600', },
    codBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, marginBottom: 4, alignSelf: 'center', flexShrink: 0, height: 24, // Fixed height for consistency
    },
    codText: { fontSize: 11, color: '#EF6C00', marginLeft: 4, fontWeight: '600', },
    loadingContainer: { justifyContent: 'center', alignItems: 'center', paddingVertical: 50, minHeight: 200, }, // For product loading
    noProductsText: { fontSize: 16, color: '#888' },
});

export default HomeScreen;