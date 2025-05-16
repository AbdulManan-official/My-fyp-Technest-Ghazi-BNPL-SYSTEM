import React, { useState, useRef, useEffect, useCallback } from 'react';
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
    Alert,
    RefreshControl,Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import Icon from 'react-native-vector-icons/FontAwesome';
import { SafeAreaView } from 'react-native-safe-area-context';
// *** Firebase Imports ***
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
    collection, query, getDocs, orderBy, doc, getDoc,
    onSnapshot // *** Import onSnapshot ***
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
// *** AsyncStorage Import ***
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomDrawerScreen from '../userscreens/CustomDrawerScreen'; // Adjust path if needed


const { width } = Dimensions.get('window');

// Static banners
const banners = [
    require('../../assets/pic2.jpg'),
    require('../../assets/pic3.jpg'),
    require('../../assets/pic4.jpg'),
];

// Placeholders and constants
const placeholderImage = require('../../assets/p3.jpg');
const defaultProfileImageUri = 'https://www.w3schools.com/w3images/avatar2.png';
const BNPL_PLANS_COLLECTION = 'BNPL_plans';
const PRODUCTS_COLLECTION = 'Products';
const USERS_COLLECTION = 'Users';
const CURRENCY_SYMBOL = 'RS';
const NUM_COLUMNS = 2;
const CARD_MARGIN = 5;
const GRID_PADDING_HORIZONTAL = 10;
const REFRESH_CONTROL_COLOR = '#FF0000';

const HomeScreen = () => {
    const navigation = useNavigation();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [allProducts, setAllProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true); // Still needed for initial load
    const flatListRef = useRef(null);

    // --- Profile Picture State ---
    const [profileImage, setProfileImage] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(true); // For initial load/check
    const [userId, setUserId] = useState(null);

    // --- Refresh Control State ---
    const [refreshing, setRefreshing] = useState(false);

    // --- Ref for potential listener cleanup ---
    const profileListenerUnsubscribe = useRef(null);
    const productsListenerUnsubscribe = useRef(null);


    // --- Initial Profile Image Check & Cache Logic ---
    // This runs *before* the listener is set up to provide faster initial UI
    const checkInitialProfileImage = useCallback(async (uid) => {
        if (!uid) {
            setProfileImage(null); setLoadingProfile(false); return;
        }
        setLoadingProfile(true);
        const cacheKey = `profileImage_${uid}`;
        try {
            const cachedImage = await AsyncStorage.getItem(cacheKey);
            if (cachedImage) {
                setProfileImage(cachedImage);
                // Keep loading true initially, listener will confirm/update & set loading false
            }
             // If not cached, listener will fetch and set loading false eventually
        } catch (error) {
            console.error("Error reading profile image cache:", error);
             // Let listener handle fetching, don't set loading false here on cache error
        } finally {
             // Don't set loading false here - wait for the first snapshot
        }
    }, []);


    // --- Auth State Listener ---
    useEffect(() => {
        const auth = getAuth();
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            // --- Cleanup old listener ---
            if (profileListenerUnsubscribe.current) {
                console.log("Cleaning up previous profile listener.");
                profileListenerUnsubscribe.current(); // Unsubscribe
                profileListenerUnsubscribe.current = null; // Clear ref
            }

            if (user) {
                console.log("User logged in:", user.uid);
                setUserId(user.uid);
                checkInitialProfileImage(user.uid); // Check cache quickly

                // --- Set up REAL-TIME profile listener ---
                const userRef = doc(db, USERS_COLLECTION, user.uid);
                profileListenerUnsubscribe.current = onSnapshot(userRef, async (docSnap) => { // Marked async for cache update
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        const imageUrl = userData?.profileImage || null;
                        const cacheKey = `profileImage_${user.uid}`; // Recalculate cache key

                        console.log("Profile snapshot received. Image URL:", imageUrl);
                        setProfileImage(imageUrl); // Update state from snapshot

                        // Update cache with fresh data
                        try {
                             if (imageUrl) {
                                 await AsyncStorage.setItem(cacheKey, imageUrl);
                             } else {
                                 await AsyncStorage.removeItem(cacheKey);
                             }
                        } catch (cacheError) {
                            console.error("Error updating profile image cache:", cacheError);
                        }

                    } else {
                        console.log("User document deleted or does not exist.");
                        setProfileImage(null); // Clear image if doc deleted
                        try { await AsyncStorage.removeItem(`profileImage_${user.uid}`); } catch(e){} // Clear cache
                    }
                     setLoadingProfile(false); // Set loading false after first snapshot arrives
                }, (error) => {
                    console.error("Error listening to profile snapshot:", error);
                    setProfileImage(null); // Revert on error? Or keep stale?
                    setLoadingProfile(false); // Stop loading on error
                    // Maybe clear cache on certain errors?
                });

            } else {
                console.log("User logged out");
                setUserId(null);
                setProfileImage(null);
                setLoadingProfile(false); // Ensure loading stops on logout
                 // No need to clear cache here, might log back in
            }
        });

        // --- Cleanup auth listener ---
        return () => {
             console.log("Cleaning up auth listener.");
             unsubscribeAuth();
             // Ensure profile listener is also cleaned up if component unmounts while logged in
             if (profileListenerUnsubscribe.current) {
                 console.log("Cleaning up profile listener on component unmount.");
                 profileListenerUnsubscribe.current();
                 profileListenerUnsubscribe.current = null;
             }
        };
    }, [checkInitialProfileImage]); // Include dependency


    // --- Product Listener Setup ---
    useEffect(() => {
        console.log("Setting up products listener...");
        setLoadingProducts(true); // Start loading for initial data

        const productsQuery = query(collection(db, PRODUCTS_COLLECTION), orderBy('createdAt', 'desc'));

        productsListenerUnsubscribe.current = onSnapshot(productsQuery, async (querySnapshot) => { // Marked async for BNPL lookups
            console.log(`Products snapshot received: ${querySnapshot.docs.length} documents.`);
            const initialProductsData = querySnapshot.docs.map(docSnapshot => {
                 const data = docSnapshot.data();
                 return { id: docSnapshot.id, name: data.name || 'Unnamed Product', originalPrice: data.originalPrice, discountedPrice: data.discountedPrice, image: data.media?.images?.[0] || data.image || null, description: data.description || '', paymentOption: data.paymentOption || { COD: false, BNPL: false }, BNPLPlanIDs: Array.isArray(data.BNPLPlans) ? data.BNPLPlans.filter(id => typeof id === 'string' && id.trim() !== '') : (Array.isArray(data.BNPLPlanIDs) ? data.BNPLPlanIDs.filter(id => typeof id === 'string' && id.trim() !== '') : []), media: data.media, category: data.category || 'Uncategorized', bnplAvailable: data.paymentOption?.BNPL === true, codAvailable: data.paymentOption?.COD === true, ...data };
            });

            // *** Fetch BNPL details for EACH product in the snapshot ***
            // (Be mindful of performance here on large datasets/frequent updates)
            try {
                 console.log("Fetching BNPL plan details for updated product list...");
                 const productsWithPlanDetails = await Promise.all(
                    initialProductsData.map(async (product) => {
                        let detailedPlans = [];
                        if (product.bnplAvailable && product.BNPLPlanIDs.length > 0) {
                            try {
                                const planPromises = product.BNPLPlanIDs.map(planId => {
                                    if (!planId || typeof planId !== 'string') return Promise.resolve(null);
                                    const planRef = doc(db, BNPL_PLANS_COLLECTION, planId.trim());
                                    return getDoc(planRef); // Still using getDoc here for related data
                                });
                                const planSnapshots = await Promise.all(planPromises);
                                detailedPlans = planSnapshots.map(snap => snap?.exists() ? { id: snap.id, ...snap.data() } : null).filter(plan => plan !== null);
                            } catch (planError) { console.error(`Error fetching BNPL plans for product ${product.id}:`, planError); }
                        }
                        return { ...product, BNPLPlans: detailedPlans, BNPLPlanIDs: undefined };
                    })
                 );
                 setAllProducts(productsWithPlanDetails);
                 console.log('Product list state updated from snapshot.');
            } catch(processingError) {
                console.error("Error processing products after snapshot:", processingError);
                // Maybe show an error state? Keep stale data?
            } finally {
                 setLoadingProducts(false); // Stop initial loading indicator after first successful snapshot processing
            }

        }, (error) => {
            console.error("Error listening to products snapshot:", error);
            Alert.alert("Error", "Could not load real-time product updates.");
            setLoadingProducts(false); // Stop loading on error
        });

        // --- Cleanup product listener ---
        return () => {
            if (productsListenerUnsubscribe.current) {
                console.log("Cleaning up products listener.");
                productsListenerUnsubscribe.current();
                productsListenerUnsubscribe.current = null;
            }
        };

    }, []); // Run only once on mount to set up the listener


    // --- Simplified onRefresh Handler ---
    // Now just provides visual feedback, listeners handle data updates
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        console.log("Pull-to-refresh triggered (visual feedback only)...");
        // Optional: Simulate a delay for better UX, then hide spinner
        setTimeout(() => {
            setRefreshing(false);
            console.log("Refresh visual feedback finished.");
        }, 1000); // Adjust delay as needed (e.g., 1 second)
    }, []); // No dependencies needed


    // --- Banner scroll logic (no changes) ---
    const onScroll = (event) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(contentOffsetX / width);
        setCurrentIndex(index);
    };

    // --- renderProductCard logic (no changes) ---
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
            <TouchableOpacity style={styles.productCard} onPress={() => navigation.navigate('ProductDetails', { product: item, })}>
                <Image source={item.image ? { uri: item.image } : placeholderImage} style={styles.productImage} resizeMode="contain" onError={(e) => console.log('Image Load Error:', e.nativeEvent.error, 'URL:', item.image)} />
                <Text style={styles.productName} numberOfLines={1} ellipsizeMode="tail">{item.name || ''}</Text>
                <View style={styles.priceContainer}>
                    {hasDiscount && displayOriginalPrice && (<Text style={[styles.productPrice, styles.strikethroughPrice]}>{displayOriginalPrice}</Text>)}
                    {finalPriceString ? (<Text style={styles.discountedPrice}>{finalPriceString}</Text>) : (<View style={{ height: 20 }} />)}
                </View>
                {item.description ? (<Text style={styles.productDescription} numberOfLines={2} ellipsizeMode="tail">{item.description}</Text>) : <View style={{height: 28}}/> }
                {showBnplBadge ? (<View style={styles.bnplBadge}><MaterialIcons name="schedule" size={14} color="#1565C0" /><Text style={styles.bnplText}>BNPL Available</Text></View>)
                 : showCodBadge ? (<View style={styles.codBadge}><MaterialIcons name="local-shipping" size={14} color="#EF6C00" /><Text style={styles.codText}>COD Available</Text></View>)
                 : (<View style={{ height: 24 }} />)
                }
            </TouchableOpacity>
        );
    };

    // --- renderBanner logic (no changes) ---
    const renderBanner = ({ item }) => (<Image source={item} style={styles.banner} resizeMode="cover"/>);

    // --- renderTitle logic (no changes) ---
    const renderTitle = () => (
        <View style={styles.titleOuterContainer}>
            <View style={styles.titleBgContainer}>
                <Icon name="tag" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.titleText}>Products For You</Text>
            </View>
        </View>
    );

    // --- renderProductSection logic (minor change for initial load) ---
    const renderProductSection = () => {
        // Show spinner only during the very initial load before the first snapshot arrives
        if (loadingProducts) {
            return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color={REFRESH_CONTROL_COLOR} /></View>);
        }
        // Show no products message if not loading and the listener provided an empty list
        if (!loadingProducts && allProducts.length === 0) {
            return (<View style={styles.loadingContainer}><Text style={styles.noProductsText}>No products found.</Text></View>);
        }
        // Render the list (updated by the snapshot listener)
        return (<FlatList data={allProducts} renderItem={renderProductCard} keyExtractor={(p) => p.id} numColumns={NUM_COLUMNS} contentContainerStyle={styles.gridContainer} scrollEnabled={false} />);
    }

    // --- Main Return Structure ---
    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#FF0000" />

            {/* Header */}
            <View style={styles.header}>
                 <Image source={require('../../assets/logoh.png')} style={styles.logo} />
                 <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
                    <View style={styles.profileIconContainer}>
                        {/* Show loader only during initial profile load/check */}
                        {loadingProfile ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <Image source={{ uri: profileImage || defaultProfileImageUri }} style={styles.profileImageStyle} />
                        )}
                    </View>
                 </TouchableOpacity>
            </View>

            {/* Main Scrollable Content with Simplified RefreshControl */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContentContainer}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh} // Calls the simplified handler
                        tintColor={REFRESH_CONTROL_COLOR}
                        colors={[REFRESH_CONTROL_COLOR]}
                        progressBackgroundColor="#ffffff"
                    />
                }
            >
                 {/* Banner Section */}
                 <View style={styles.sliderContainer}>
                    <FlatList ref={flatListRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} data={banners} renderItem={renderBanner} keyExtractor={(b, i) => `banner-${i}`} onScroll={onScroll} scrollEventThrottle={16} />
                    <View style={styles.pagination}>
                        {banners.map((_, index) => (<View key={`dot-${index}`} style={[styles.dot, currentIndex === index ? styles.activeDot : null]} />))}
                    </View>
                 </View>

                 {/* Title Section */}
                 {renderTitle()}

                 {/* Product Grid Section */}
                 {renderProductSection()}

                 <View style={{ height: 30 }} />{/* Bottom padding */}
            </ScrollView>

             {/* Drawer */}
            {isDrawerOpen && (
                <View style={[StyleSheet.absoluteFill, styles.drawerOverlay]} pointerEvents="box-none">
                    <CustomDrawerScreen navigation={navigation} closeDrawer={() => setIsDrawerOpen(false)} />
                </View>
             )}
        </SafeAreaView>
    );
};

// --- Styles --- (No changes needed in styles)
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F5F5F5' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FF0000', paddingVertical: 10, paddingHorizontal: 15, height: 63, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, },
    logo: { width: 70, height: 55, resizeMode: 'contain' },
    profileIconContainer: { width: 50, height: 50, borderRadius: 40, borderWidth: 1, borderColor: 'white', justifyContent: 'center', alignItems: 'center', backgroundColor: '#D32F2F', overflow: 'hidden', },
    profileImageStyle: { width: '100%', height: '100%', borderRadius: 20, },
    drawerOverlay: { backgroundColor: 'rgba(0, 0, 0, 0.3)', zIndex: 10, },
    scrollContentContainer: { paddingBottom: 20, },
    sliderContainer: { height: 200, backgroundColor: '#e0e0e0', marginBottom: 10 },
    banner: { width: width, height: 200 },
    pagination: { flexDirection: 'row', position: 'absolute', bottom: 10, alignSelf: 'center', backgroundColor: 'rgba(0, 0, 0, 0.4)', paddingVertical: 5, paddingHorizontal: 8, borderRadius: 12 },
    dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4, backgroundColor: '#FFF', opacity: 0.6 },
    activeDot: { opacity: 1, backgroundColor: REFRESH_CONTROL_COLOR },
    titleOuterContainer: { alignItems: 'flex-start', marginTop: 8, marginBottom: 15, paddingHorizontal: 0, },
    titleBgContainer: { backgroundColor: '#FF0000', paddingVertical: 8, paddingHorizontal: 15, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderTopRightRadius: 20, borderBottomRightRadius: 20, flexDirection: 'row', alignItems: 'center', elevation: 4, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.20, shadowRadius: 4, },
    titleText: { fontSize: 17, fontWeight: 'bold', color: '#FFFFFF', textShadowColor: 'rgba(0, 0, 0, 0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2, },
    gridContainer: { paddingHorizontal: GRID_PADDING_HORIZONTAL, },
    productCard: { backgroundColor: '#fff', borderRadius: 8, margin: CARD_MARGIN, width: (width - (GRID_PADDING_HORIZONTAL * 2) - (CARD_MARGIN * NUM_COLUMNS * 2)) / NUM_COLUMNS, alignItems: 'center', padding: 10, paddingBottom: 4, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.20, shadowRadius: 1.41, minHeight: 280, justifyContent: 'space-between', },
    productImage: { width: '100%', height: 110, borderRadius: 6, marginBottom: 8, backgroundColor: '#F8F8F8' },
    productName: { fontSize: 14, fontWeight: '600', color: '#333', textAlign: 'center', minHeight: 18, marginBottom: 4, paddingHorizontal: 2, width: '100%', },
    priceContainer: { flexDirection: 'column', alignItems: 'center', marginTop: 4, minHeight: 35, marginBottom: 6, justifyContent: 'center', width: '100%', },
    productPrice: { fontSize: 14, color: '#333', fontWeight: 'bold', },
    strikethroughPrice: { textDecorationLine: 'line-through', color: '#999', fontWeight: 'normal', fontSize: 13, marginBottom: 2, },
    discountedPrice: { fontSize: 15, color: '#E53935', fontWeight: 'bold', },
    productDescription: { fontSize: 12, color: '#666', textAlign: 'center', marginTop: 4, marginBottom: 6, paddingHorizontal: 5, flexGrow: 1, flexShrink: 1, minHeight: 28, width: '95%', },
    bnplBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, marginBottom: 4, alignSelf: 'center', flexShrink: 0, height: 24, },
    bnplText: { fontSize: 11, color: '#1565C0', marginLeft: 4, fontWeight: '600', },
    codBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, marginBottom: 4, alignSelf: 'center', flexShrink: 0, height: 24, },
    codText: { fontSize: 11, color: '#EF6C00', marginLeft: 4, fontWeight: '600', },
    loadingContainer: { justifyContent: 'center', alignItems: 'center', paddingVertical: 50, minHeight: 200, },
    noProductsText: { fontSize: 16, color: '#888' },
});

export default HomeScreen;