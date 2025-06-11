// HomeScreen.js
// (COMPLETE AND FINAL - Includes all features as requested)

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
    RefreshControl,
    Platform
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import Icon from 'react-native-vector-icons/FontAwesome';
import { SafeAreaView } from 'react-native-safe-area-context';
// *** Firebase Imports ***
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
    collection, query, getDocs, orderBy, doc, getDoc,
    onSnapshot
} from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // Your firebaseConfig path
// *** AsyncStorage Import ***
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomDrawerScreen from '../userscreens/CustomDrawerScreen'; // Adjust path if needed

// --- Import Trending Products Utility ---
import { calculateTopTrendingFromList } from '../../Components/trendingProductsUtil'; // <<< YOUR SPECIFIED IMPORT PATH

const { width } = Dimensions.get('window');

// Static banners
const banners = [
    require('../../assets/1.png'),
    require('../../assets/2.png'),
    require('../../assets/3.png'),
];

// Placeholders and constants
const placeholderImage = require('../../assets/p3.jpg');
const defaultProfileImageUri = 'https://www.w3schools.com/w3images/avatar2.png';
const BNPL_PLANS_COLLECTION = 'BNPL_plans';
const PRODUCTS_COLLECTION = 'Products';
const USERS_COLLECTION = 'Users';
const CURRENCY_SYMBOL = 'RS';
const NUM_COLUMNS_MAIN_GRID = 2;
const CARD_MARGIN_MAIN_GRID = 5;
const GRID_PADDING_HORIZONTAL_MAIN = 10;
const REFRESH_CONTROL_COLOR = '#FF0000';

const PRODUCT_CARD_WIDTH = (width - (GRID_PADDING_HORIZONTAL_MAIN * 2)) / NUM_COLUMNS_MAIN_GRID - (CARD_MARGIN_MAIN_GRID * 2);

const HomeScreen = () => {
    const navigation = useNavigation();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [allProductsMasterList, setAllProductsMasterList] = useState([]); // Stores ALL products from snapshot
    const [loadingProducts, setLoadingProducts] = useState(true);
    const flatListRef = useRef(null);

    const [profileImage, setProfileImage] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [userId, setUserId] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const [trendingProducts, setTrendingProducts] = useState([]);
    const [productsForYou, setProductsForYou] = useState([]);

    const profileListenerUnsubscribe = useRef(null);
    const productsListenerUnsubscribe = useRef(null);

    const checkInitialProfileImage = useCallback(async (uid) => {
        if (!uid) { setProfileImage(null); setLoadingProfile(false); return; }
        setLoadingProfile(true); const cacheKey = `profileImage_${uid}`;
        try {
            const cachedImage = await AsyncStorage.getItem(cacheKey);
            if (cachedImage) { setProfileImage(cachedImage); }
        } catch (error) { console.error("Error reading profile image cache:", error); }
         // setLoadingProfile(false) will be called by the onSnapshot listener after first data
    }, []);

    useEffect(() => {
        const auth = getAuth();
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (profileListenerUnsubscribe.current) {
                console.log("[Auth] Cleaning up previous profile listener.");
                profileListenerUnsubscribe.current();
                profileListenerUnsubscribe.current = null;
            }
            if (user) {
                console.log("[Auth] User logged in:", user.uid);
                setUserId(user.uid);
                checkInitialProfileImage(user.uid);
                const userRef = doc(db, USERS_COLLECTION, user.uid);
                profileListenerUnsubscribe.current = onSnapshot(userRef, async (docSnap) => {
                    if (docSnap.exists()) {
                        const userData = docSnap.data(); const imageUrl = userData?.profileImage || null;
                        console.log("[ProfileListener] Snapshot received. Image URL:", imageUrl);
                        setProfileImage(imageUrl);
                        const cacheKey = `profileImage_${user.uid}`;
                        try { if (imageUrl) { await AsyncStorage.setItem(cacheKey, imageUrl); } else { await AsyncStorage.removeItem(cacheKey); } }
                        catch (cacheError) { console.error("[ProfileListener] Error updating profile image cache:", cacheError); }
                    } else {
                        console.log("[ProfileListener] User document deleted or does not exist.");
                        setProfileImage(null); try { await AsyncStorage.removeItem(`profileImage_${user.uid}`); } catch(e){}
                    }
                    setLoadingProfile(false); // Profile data (or lack thereof) confirmed
                }, (error) => {
                    console.error("[ProfileListener] Error listening to profile snapshot:", error);
                    setProfileImage(null); setLoadingProfile(false);
                });
            } else {
                console.log("[Auth] User logged out");
                setUserId(null); setProfileImage(null); setLoadingProfile(false);
            }
        });
        return () => {
            console.log("[Auth] Cleaning up auth listener.");
            unsubscribeAuth();
            if (profileListenerUnsubscribe.current) {
                console.log("[AuthCleanup] Cleaning up profile listener on unmount.");
                profileListenerUnsubscribe.current();
                profileListenerUnsubscribe.current = null;
            }
        };
    }, [checkInitialProfileImage]);

    useEffect(() => {
        console.log("[ProductsEffect] Setting up products listener...");
        setLoadingProducts(true);
        setTrendingProducts([]);
        setProductsForYou([]);

        const productsQuery = query(collection(db, PRODUCTS_COLLECTION), orderBy('createdAt', 'desc'));
        productsListenerUnsubscribe.current = onSnapshot(productsQuery, async (querySnapshot) => {
            console.log(`[ProductsListener] Snapshot received: ${querySnapshot.docs.length} documents.`);
            const initialProductsData = querySnapshot.docs.map(docSnapshot => {
                const data = docSnapshot.data();
                return { id: docSnapshot.id, name: data.name || 'Unnamed Product', originalPrice: data.originalPrice, discountedPrice: data.discountedPrice, image: data.media?.images?.[0] || data.image || null, description: data.description || '', paymentOption: data.paymentOption || { COD: false, BNPL: false }, BNPLPlanIDs: Array.isArray(data.BNPLPlans) ? data.BNPLPlans.filter(id => typeof id === 'string' && id.trim() !== '') : (Array.isArray(data.BNPLPlanIDs) ? data.BNPLPlanIDs.filter(id => typeof id === 'string' && id.trim() !== '') : []), media: data.media, category: data.category || 'Uncategorized', bnplAvailable: data.paymentOption?.BNPL === true, codAvailable: data.paymentOption?.COD === true, ...data };
            });

            try {
                console.log("[ProductsListener] Processing BNPL plan details...");
                const productsWithPlanDetails = await Promise.all(
                    initialProductsData.map(async (product) => {
                        let detailedPlans = [];
                        if (product.bnplAvailable && product.BNPLPlanIDs.length > 0) {
                            try {
                                const planPromises = product.BNPLPlanIDs.map(planId => {
                                    if (!planId || typeof planId !== 'string') return Promise.resolve(null);
                                    const planRef = doc(db, BNPL_PLANS_COLLECTION, planId.trim());
                                    return getDoc(planRef);
                                });
                                const planSnapshots = await Promise.all(planPromises);
                                detailedPlans = planSnapshots.map(snap => snap?.exists() ? { id: snap.id, ...snap.data() } : null).filter(plan => plan !== null);
                            } catch (planError) { console.error(`[ProductsListener] Error fetching BNPL plans for product ${product.id}:`, planError); }
                        }
                        return { ...product, BNPLPlans: detailedPlans, BNPLPlanIDs: undefined };
                    })
                );
                
                console.log("[ProductsListener] Setting master product list state.");
                setAllProductsMasterList(productsWithPlanDetails);

                console.log("[ProductsListener] Calculating trending products...");
                const topTrending = calculateTopTrendingFromList(productsWithPlanDetails);
                setTrendingProducts(topTrending);
                console.log(`[ProductsListener] Trending products set. Count: ${topTrending.length}`);

                if (topTrending.length > 0) {
                    const trendingProductIds = new Set(topTrending.map(p => p.id));
                    const filteredForYou = productsWithPlanDetails.filter(p => !trendingProductIds.has(p.id));
                    setProductsForYou(filteredForYou);
                    console.log(`[ProductsListener] "Products For You" filtered. Count: ${filteredForYou.length}`);
                } else {
                    setProductsForYou(productsWithPlanDetails);
                    console.log(`[ProductsListener] No trending products, "Products For You" is all products. Count: ${productsWithPlanDetails.length}`);
                }

            } catch(processingError) {
                console.error("[ProductsListener] Error processing products after snapshot:", processingError);
                Alert.alert("Data Processing Error", "Could not fully process product data.");
            } finally {
                setLoadingProducts(false);
                console.log('[ProductsListener] Product loading and processing finished for this snapshot.');
            }
        }, (error) => {
            console.error("[ProductsListener] Error listening to products snapshot:", error);
            Alert.alert("Error", "Could not load real-time product updates.");
            setLoadingProducts(false);
            setTrendingProducts([]);
            setProductsForYou([]);
        });

        return () => {
            if (productsListenerUnsubscribe.current) {
                console.log("[ProductsEffect] Cleaning up products listener.");
                productsListenerUnsubscribe.current();
                productsListenerUnsubscribe.current = null;
            }
        };
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        console.log("[Refresh] Pull-to-refresh triggered (visual only).");
        setTimeout(() => { setRefreshing(false); }, 1000);
    }, []);

    const onScroll = (event) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(contentOffsetX / width);
        setCurrentIndex(index);
    };

    const renderProductCard = ({ item, isTrendingCard = false }) => {
        const hasDiscount = typeof item.discountedPrice === 'number' && typeof item.originalPrice === 'number' && item.discountedPrice < item.originalPrice;
        const displayOriginalPrice = typeof item.originalPrice === 'number' ? `${CURRENCY_SYMBOL} ${item.originalPrice.toFixed(0)}` : null;
        const displayDiscountedPrice = typeof item.discountedPrice === 'number' ? `${CURRENCY_SYMBOL} ${item.discountedPrice.toFixed(0)}` : null;
        const showBnplBadge = item.bnplAvailable === true;
        const showCodBadge = item.codAvailable === true && !showBnplBadge;
        let finalPriceString = '';
        if (hasDiscount && displayDiscountedPrice) { finalPriceString = displayDiscountedPrice; }
        else if (displayOriginalPrice) { finalPriceString = displayOriginalPrice; }
        else if (displayDiscountedPrice) { finalPriceString = displayDiscountedPrice; }

        const cardStyle = isTrendingCard ? 
            [styles.productCard, styles.trendingProductCardStyle, { width: PRODUCT_CARD_WIDTH }] : 
            [styles.productCard, styles.mainGridProductCardStyle, { width: PRODUCT_CARD_WIDTH }];

        return (
            <TouchableOpacity
                style={cardStyle}
                onPress={() => navigation.navigate('ProductDetails', { product: item })}
            >
                <Image
                    source={item.image ? { uri: item.image } : placeholderImage}
                    style={styles.productImage}
                    resizeMode="contain"
                    onError={(e) => console.log('Image Load Error:', e.nativeEvent.error, 'URL:', item.image)}
                />
                <Text style={styles.productName} numberOfLines={isTrendingCard ? 1 : 2} ellipsizeMode="tail">
                    {item.name || ''}
                </Text>
                
                <View style={styles.priceContainer}>
                    {hasDiscount && displayOriginalPrice && (
                        <Text style={[styles.productPrice, styles.strikethroughPrice]}>{displayOriginalPrice}</Text>
                    )}
                    {finalPriceString ? (
                        <Text style={styles.discountedPrice}>{finalPriceString}</Text>
                    ) : (
                        <View style={{ height: 20 }} /> 
                    )}
                </View>

                {item.description ? (
                     <Text style={styles.productDescription} numberOfLines={2} ellipsizeMode="tail">{item.description}</Text>
                ) : <View style={{height: styles.productDescription.fontSize * 2 * 1.2 || 28}}/> } 

                {showBnplBadge ? (
                    <View style={styles.bnplBadge}><MaterialIcons name="schedule" size={14} color="#1565C0" /><Text style={styles.bnplText}>BNPL Available</Text></View>
                ) : showCodBadge ? (
                    <View style={styles.codBadge}><MaterialIcons name="local-shipping" size={14} color="#EF6C00" /><Text style={styles.codText}>COD Available</Text></View>
                ) : (
                    <View style={{ height: 24 }} /> 
                )}
            </TouchableOpacity>
        );
    };

    const renderBanner = ({ item }) => (<Image source={item} style={styles.banner} resizeMode="cover"/>);

    const renderTitle = (title, iconName = "tag") => (
        <View style={styles.titleOuterContainer}>
            <View style={styles.titleBgContainer}>
                <Icon name={iconName} size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.titleText}>{title}</Text>
            </View>
        </View>
    );

    const renderTrendingProductSection = () => {
        if (loadingProducts && trendingProducts.length === 0) {
            return ( <View style={styles.trendingLoadingContainer}><ActivityIndicator size="large" color={REFRESH_CONTROL_COLOR} /></View> );
        }
        if (!loadingProducts && trendingProducts.length === 0) {
            console.log("[RenderTrending] No trending products to display.");
            return null; 
        }
        console.log("[RenderTrending] Rendering trending products. Count:", trendingProducts.length);
        return (
            <View style={styles.trendingSectionContainer}>
                {renderTitle("Trending Now", "fire")}
                <FlatList
                    data={trendingProducts}
                    renderItem={({item}) => renderProductCard({item, isTrendingCard: true})}
                    keyExtractor={(item) => `trending-${item.id}`}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.trendingListContentContainer}
                />
            </View>
        );
    };

    const renderProductsForYouSection = () => {
        if (loadingProducts && productsForYou.length === 0 && allProductsMasterList.length === 0) { // Show big loader only if everything is empty and loading
            return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color={REFRESH_CONTROL_COLOR} /></View>);
        }
        if (!loadingProducts && productsForYou.length === 0) {
            // This means either no products at all, or all products were trending
             if (allProductsMasterList.length > 0 && trendingProducts.length >= allProductsMasterList.length) {
                 console.log("[RenderForYou] All products are trending, so 'For You' section is empty.");
                 return (<View style={styles.loadingContainer}><Text style={styles.noProductsText}>Check out what's new above!</Text></View>);
             }
             console.log("[RenderForYou] No products to display in 'For You' section.");
            return (<View style={styles.loadingContainer}><Text style={styles.noProductsText}>No other products to show.</Text></View>);
        }
        console.log("[RenderForYou] Rendering 'Products For You'. Count:", productsForYou.length);
        return (
            <View> 
                {renderTitle("Products For You", "shopping-bag")}
                <FlatList
                    data={productsForYou}
                    renderItem={({item}) => renderProductCard({item, isTrendingCard: false})}
                    keyExtractor={(p) => p.id}
                    numColumns={NUM_COLUMNS_MAIN_GRID}
                    contentContainerStyle={styles.mainGridContainer}
                    scrollEnabled={false}
                />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#FF0000" />
            <View style={styles.header}>
                 <Image source={require('../../assets/logobg1.png')} style={styles.logo} />
                 <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
                    <View style={styles.profileIconContainer}>
                        {loadingProfile ? (<ActivityIndicator size="small" color="white" />)
                         : (<Image source={{ uri: profileImage || defaultProfileImageUri }} style={styles.profileImageStyle} />)}
                    </View>
                 </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContentContainer}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={REFRESH_CONTROL_COLOR} colors={[REFRESH_CONTROL_COLOR]} progressBackgroundColor="#ffffff" />}
            >
                 <View style={styles.sliderContainer}>
                    <FlatList ref={flatListRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} data={banners} renderItem={renderBanner} keyExtractor={(b, i) => `banner-${i}`} onScroll={onScroll} scrollEventThrottle={16} />
                    <View style={styles.pagination}>
                        {banners.map((_, index) => (<View key={`dot-${index}`} style={[styles.dot, currentIndex === index ? styles.activeDot : null]} />))}
                    </View>
                 </View>

                 {renderTrendingProductSection()}
                 {renderProductsForYouSection()}

                 <View style={{ height: 30 }} />
            </ScrollView>

            {isDrawerOpen && (
                <View style={[StyleSheet.absoluteFill, styles.drawerOverlay]} pointerEvents="box-none">
                    <CustomDrawerScreen navigation={navigation} closeDrawer={() => setIsDrawerOpen(false)} />
                </View>
             )}
        </SafeAreaView>
    );
};

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
    
    trendingSectionContainer: { marginBottom: 10, },
    trendingListContentContainer: { paddingHorizontal: GRID_PADDING_HORIZONTAL_MAIN, paddingVertical: 10, },
    trendingLoadingContainer: { height: 220, justifyContent: 'center', alignItems: 'center', },

    mainGridContainer: { 
        paddingHorizontal: GRID_PADDING_HORIZONTAL_MAIN,
    },
    productCard: { 
        backgroundColor: '#fff',
        borderRadius: 8,
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
    trendingProductCardStyle: {
        marginRight: CARD_MARGIN_MAIN_GRID * 2, // Ensures space between cards in horizontal list
    },
    mainGridProductCardStyle: {
        marginBottom: CARD_MARGIN_MAIN_GRID * 2, // Vertical spacing between rows
        marginHorizontal: CARD_MARGIN_MAIN_GRID, // Horizontal spacing (FlatList's numColumns will make this work like padding between items)
    },
    productImage: { width: '100%', height: 110, borderRadius: 6, marginBottom: 8, backgroundColor: '#F8F8F8' },
    productName: { fontSize: 14, fontWeight: '600', color: '#333', textAlign: 'center', minHeight: 18, marginBottom: 4, paddingHorizontal: 2, width: '100%', },
    priceContainer: { flexDirection: 'column', alignItems: 'center', marginTop: 4, minHeight: 35, marginBottom: 6, justifyContent: 'center', width: '100%', },
    productPrice: { fontSize: 14, color: '#333', fontWeight: 'bold', },
    strikethroughPrice: { textDecorationLine: 'line-through', color: '#999', fontWeight: 'normal', fontSize: 13, marginBottom: 2, },
    discountedPrice: { fontSize: 15, color: '#E53935', fontWeight: 'bold', },
    productDescription: { fontSize: 12, color: '#666', textAlign: 'center', marginTop: 4, marginBottom: 6, paddingHorizontal: 5, flexGrow: 1, flexShrink: 1, minHeight: 28, width: '95%', }, // Note: flexGrow might not work as expected in fixed height cards.
    bnplBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, marginBottom: 4, alignSelf: 'center', flexShrink: 0, height: 24, },
    bnplText: { fontSize: 11, color: '#1565C0', marginLeft: 4, fontWeight: '600', },
    codBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8, marginBottom: 4, alignSelf: 'center', flexShrink: 0, height: 24, },
    codText: { fontSize: 11, color: '#EF6C00', marginLeft: 4, fontWeight: '600', },
    
    loadingContainer: { justifyContent: 'center', alignItems: 'center', paddingVertical: 50, minHeight: 200, },
    noProductsText: { fontSize: 16, color: '#888', textAlign:'center', padding: 20 }, // Added padding for better display
});

export default HomeScreen;