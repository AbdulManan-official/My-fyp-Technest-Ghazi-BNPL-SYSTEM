// SearchScreen.js

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
    View,
    FlatList,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    TextInput,
    Text,
    ActivityIndicator,
    Dimensions,
    SafeAreaView,
    StatusBar,
    RefreshControl,
    Platform,
    Alert
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from "@react-navigation/native";
import { collection, query, getDocs, limit, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

import { calculateTopTrendingFromList } from '../../Components/trendingProductsUtil';

// --- CONSTANTS ADAPTED FROM HOMESCREEN FOR DESIGN CONSISTENCY ---
const { width, height } = Dimensions.get("window");
const CARD_MARGIN = 8;
const GRID_PADDING = 10;
const NUM_COLUMNS = 2;
const ACCENT_RED = '#E53935';
const BNPL_BADGE_BG = 'red';      // Distinct Blue for BNPL
const DISCOUNT_BADGE_BG = 'orange';  // Vibrant Gold/Yellow for Discounts
const BADGE_TEXT_COLOR = '#FFFFFF';   // White text for both badges

const PRODUCT_CARD_WIDTH = (width - (GRID_PADDING * 2)) / NUM_COLUMNS - (CARD_MARGIN * 2);

const PRODUCTS_COLLECTION = 'Products';
const BNPL_PLANS_COLLECTION = 'BNPL_plans';
const CATEGORIES_COLLECTION = 'Category';

const placeholderImage = require('../../assets/p3.jpg');
const CURRENCY_SYMBOL = 'RS';

const allCategoryObject = { id: "All", name: "All" };
const trendingCategoryObject = { id: "Trending", name: "Trending" };

export default function SearchScreen() {
    const navigation = useNavigation();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(allCategoryObject.id);
    const [allProductsMasterList, setAllProductsMasterList] = useState([]);
    
    const [allFetchedCategories, setAllFetchedCategories] = useState([]);
    const [displayCategories, setDisplayCategories] = useState([allCategoryObject, trendingCategoryObject]); 

    const [trendingProductList, setTrendingProductList] = useState([]);

    const [loadingProducts, setLoadingProducts] = useState(true);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const fetchAllCategories = useCallback(async () => {
        console.log("[SearchScreen] Fetching all categories...");
        setLoadingCategories(true);
        try {
            const q = query(collection(db, CATEGORIES_COLLECTION), orderBy("categoryName"));
            const querySnapshot = await getDocs(q);
            const categoriesData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().categoryName || `Unnamed (${doc.id.substring(0,4)})`
            }));
            setAllFetchedCategories(categoriesData);
        } catch (fetchCategoriesError) {
            console.error("[SearchScreen] Error fetching categories: ", fetchCategoriesError);
            setError("Could not load category filters.");
            setAllFetchedCategories([]);
        } finally {
            setLoadingCategories(false);
        }
    }, []);

    useEffect(() => {
        fetchAllCategories();
    }, [fetchAllCategories]);

    const fetchProductsAndRelatedData = useCallback(async (isRefreshing = false) => {
        if (!isRefreshing) { setLoadingProducts(true); }
        else { console.log("[SearchScreen] Product refresh triggered."); }
        setError(null);
        
        try {
            const productsRef = collection(db, PRODUCTS_COLLECTION);
            const q = query(productsRef, orderBy('createdAt', 'desc'), limit(150)); 
            const productSnapshot = await getDocs(q);
            const activeCategoryIdsInProducts = new Set();
            const processedProducts = await Promise.all(
                 productSnapshot.docs.map(async (docSnapshot) => {
                    const data = docSnapshot.data();
                    const categoryId = data.category; 
                    if (categoryId && typeof categoryId === 'string' && categoryId.toLowerCase() !== 'uncategorized') {
                        activeCategoryIdsInProducts.add(categoryId);
                    }
                     const productBase = {
                        id: docSnapshot.id, name: data.name || 'Unnamed Product', originalPrice: data.originalPrice, discountedPrice: data.discountedPrice, image: data.media?.images?.[0] || data.image || null, description: data.description || '', paymentOption: data.paymentOption || { COD: false, BNPL: false }, BNPLPlanIDs: Array.isArray(data.BNPLPlans) ? data.BNPLPlans.filter(id => typeof id === 'string' && id.trim() !== '') : (Array.isArray(data.BNPLPlanIDs) ? data.BNPLPlanIDs.filter(id => typeof id === 'string' && id.trim() !== '') : []), media: data.media, category: categoryId || 'Uncategorized', createdAt: data.createdAt, salesCount: data.salesCount || 0, viewCount: data.viewCount || 0, reviewCount: data.reviewCount || 0, totalRatingSum: data.totalRatingSum || 0, bnplAvailable: data.paymentOption?.BNPL === true, codAvailable: data.paymentOption?.COD === true, ...data
                    };
                    if (productBase.bnplAvailable && productBase.BNPLPlanIDs.length > 0) {
                         try {
                            const planPromises = productBase.BNPLPlanIDs.map(planId => { if (!planId) return Promise.resolve(null); const planRef = doc(db, BNPL_PLANS_COLLECTION, planId.trim()); return getDoc(planRef); });
                            const planSnapshots = await Promise.all(planPromises);
                            const detailedPlans = planSnapshots.map(snap => snap?.exists() ? { id: snap.id, ...snap.data() } : null).filter(plan => plan !== null);
                            return { ...productBase, BNPLPlans: detailedPlans, BNPLPlanIDs: undefined };
                         } catch (planError) { console.error(`Error fetching BNPL plans for product ${productBase.id}:`, planError); return { ...productBase, BNPLPlans: [], BNPLPlanIDs: undefined }; }
                    }
                    return { ...productBase, BNPLPlans: [], BNPLPlanIDs: undefined };
                })
            );

            setAllProductsMasterList(processedProducts);
            const topTrending = calculateTopTrendingFromList(processedProducts);
            setTrendingProductList(topTrending);

            const activeDisplayCategoriesFromProducts = allFetchedCategories.filter(category =>
                activeCategoryIdsInProducts.has(category.id)
            );
            setDisplayCategories([ allCategoryObject, trendingCategoryObject, ...activeDisplayCategoriesFromProducts ]);
            
            if (selectedCategory !== 'All' && selectedCategory !== 'Trending' && !activeCategoryIdsInProducts.has(selectedCategory)) {
                setSelectedCategory('All');
            }
        } catch (err) {
            console.error("[SearchScreen] Error fetching products: ", err);
            setError("Failed to load products. Please try again.");
            setAllProductsMasterList([]); setTrendingProductList([]);
            if(allFetchedCategories.length === 0) { setDisplayCategories([allCategoryObject, trendingCategoryObject]); }
        } finally {
            setLoadingProducts(false); setRefreshing(false);
        }
    }, [refreshing, allFetchedCategories]);

    useEffect(() => {
        if (!loadingCategories) { fetchProductsAndRelatedData(); }
    }, [loadingCategories, fetchProductsAndRelatedData]);

    const filteredProducts = useMemo(() => {
        const trimmedQuery = searchQuery?.trim()?.toLowerCase() ?? '';
        let sourceProductList = [];
        if (selectedCategory === trendingCategoryObject.id) { sourceProductList = trendingProductList; }
        else if (selectedCategory === allCategoryObject.id) { sourceProductList = allProductsMasterList; }
        else { sourceProductList = allProductsMasterList.filter(product => product.category === selectedCategory); }
        if (!trimmedQuery) { return sourceProductList; }
        return sourceProductList.filter(product => {
            const productNameLower = product?.name?.toLowerCase() ?? '';
            const productDescLower = product?.description?.toLowerCase() ?? '';
            return productNameLower.includes(trimmedQuery) || productDescLower.includes(trimmedQuery);
        });
    }, [allProductsMasterList, trendingProductList, searchQuery, selectedCategory]);

    const onRefresh = useCallback(async () => {
        console.log("[SearchScreen] Refresh initiated...");
        setRefreshing(true);
        await fetchAllCategories(); 
    }, [fetchAllCategories]);

    const onSearchInputChange = (text) => { setSearchQuery(text); };
    const clearSearch = () => { setSearchQuery(''); };
    const onFilterCategoryChange = (categoryId) => { setSelectedCategory(categoryId); };

    // --- RENDER HELPER FUNCTIONS ---
    const renderProductCard = ({ item }) => {
        // Logic is now identical to HomeScreen's card for consistency
        const hasDiscount = typeof item.discountedPrice === 'number' && typeof item.originalPrice === 'number' && item.discountedPrice < item.originalPrice;
        const displayOriginalPrice = typeof item.originalPrice === 'number' ? `${CURRENCY_SYMBOL} ${item.originalPrice.toFixed(0)}` : null;
        const displayDiscountedPrice = typeof item.discountedPrice === 'number' ? `${CURRENCY_SYMBOL} ${item.discountedPrice.toFixed(0)}` : null;
    
        let discountPercentage = null;
        if (hasDiscount && item.originalPrice > 0) {
            const percentage = ((item.originalPrice - item.discountedPrice) / item.originalPrice) * 100;
            discountPercentage = `${Math.round(percentage)}% OFF`;
        }
    
        const priceForCalc = typeof item.discountedPrice === 'number' ? item.discountedPrice : item.originalPrice;
        const canShowBnplLine = item.bnplAvailable && item.BNPLPlans?.length > 0 && typeof priceForCalc === 'number';
    
        let bnplInstallment = null;
        if (canShowBnplLine) {
            const firstPlan = item.BNPLPlans[0];
            if (firstPlan && firstPlan.durationInMonths > 0) {
                const downPayment = priceForCalc * ((firstPlan.downPaymentPercentage || 0) / 100);
                const monthlyInstallment = (priceForCalc - downPayment) / firstPlan.durationInMonths;
                bnplInstallment = `or ${CURRENCY_SYMBOL} ${monthlyInstallment.toFixed(0)}/mo with BNPL`;
            }
        }
    
        return (
            <TouchableOpacity
                style={styles.productCard}
                onPress={() => navigation.navigate('ProductDetails', { product: item })}
                activeOpacity={0.8}
            >
                <View style={styles.imageContainer}>
                    <Image
                        source={item.image ? { uri: item.image } : placeholderImage}
                        style={styles.productImage}
                        resizeMode="contain"
                    />
                    {item.bnplAvailable && (
                        <View style={styles.bnplTag}>
                           <Text style={styles.bnplTagText}>BNPL</Text>
                        </View>
                    )}
                    {discountPercentage && (
                        <View style={styles.discountBadge}>
                            <Text style={styles.discountBadgeText}>{discountPercentage}</Text>
                        </View>
                    )}
                </View>
    
                <View style={styles.infoContainer}>
                    <Text style={styles.productName} numberOfLines={2} ellipsizeMode="tail">
                        {item.name || 'Product Name'}
                    </Text>
    
                    <Text style={styles.productDescription} numberOfLines={2} ellipsizeMode="tail">
                        {item.description || ''}
                    </Text>
    
                    <View style={styles.priceSection}>
                        <View style={styles.priceRow}>
                            {hasDiscount && (
                                <>
                                    <Text style={styles.discountedPrice}>{displayDiscountedPrice}</Text>
                                    <Text style={styles.strikethroughPrice}>{displayOriginalPrice}</Text>
                                </>
                            )}
                            {!hasDiscount && displayOriginalPrice && (
                                 <Text style={styles.discountedPrice}>{displayOriginalPrice}</Text>
                            )}
                            {!hasDiscount && !displayOriginalPrice && displayDiscountedPrice && (
                                <Text style={styles.discountedPrice}>{displayDiscountedPrice}</Text>
                            )}
                        </View>
    
                        {bnplInstallment && (
                            <Text style={styles.bnplPlanText}>{bnplInstallment}</Text>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderListEmptyComponent = () => {
        if (loadingProducts || loadingCategories) return null;
        if (error && filteredProducts.length === 0) { 
            return ( <View style={styles.emptyListContainer}><Icon name="alert-circle-outline" size={40} color="#ccc" /><Text style={styles.emptyListText}>{error}</Text></View> );
        }
        if (filteredProducts.length === 0) {
             if (searchQuery.trim() || (selectedCategory !== 'All' && selectedCategory !== 'Trending')) {
                 return ( <View style={styles.emptyListContainer}><Icon name="magnify-close" size={40} color="#ccc" /><Text style={styles.emptyListText}>No products match your criteria.</Text></View> );
            } else if (selectedCategory === 'Trending' && trendingProductList.length === 0){
                return ( <View style={styles.emptyListContainer}><Icon name="chart-line-variant" size={40} color="#ccc" /><Text style={styles.emptyListText}>No trending products right now.</Text></View> );
            } else if (allProductsMasterList.length === 0) { 
                  return ( <View style={styles.emptyListContainer}><Icon name="package-variant-closed" size={40} color="#ccc" /><Text style={styles.emptyListText}>No products available yet.</Text></View> );
             }
        }
        return null;
    };

    const renderCategoryFilters = () => {
        if (loadingCategories || (loadingProducts && allProductsMasterList.length === 0)) {
             return <ActivityIndicator size="small" color="#FFFFFF" style={styles.categoryLoader} />;
        }
        if (displayCategories.length > 0) {
             return (
                 <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                     {displayCategories.map(category => (
                         <TouchableOpacity
                             key={category.id}
                             style={[ styles.filterButton, selectedCategory === category.id && styles.activeFilter ]}
                             onPress={() => onFilterCategoryChange(category.id)} >
                             <Text style={[ styles.filterText, selectedCategory === category.id && styles.activeFilterText ]}>
                                 {category.name}
                             </Text>
                         </TouchableOpacity>
                     ))}
                 </ScrollView>
             );
        }
        return <View style={styles.categoryLoader}><Text style={styles.categoryErrorText}>Filters unavailable</Text></View>;
    };
    // --- END RENDER HELPER FUNCTIONS ---

    return (
        <SafeAreaView style={styles.safeArea}>
             <StatusBar barStyle="light-content" backgroundColor="#FF0000" />
            <View style={styles.container}>
                <View style={styles.headerContainer}>
                    <View style={styles.searchBar}>
                        <Icon name="magnify" size={22} color="#FF0000" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search products..."
                            placeholderTextColor="#888"
                            value={searchQuery}
                            onChangeText={onSearchInputChange}
                            returnKeyType="search"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}>
                                <Icon name="close-circle" size={20} color="#FF0000" />
                            </TouchableOpacity>
                        )}
                    </View>
                    {renderCategoryFilters()}
                </View>

                {(loadingProducts && allProductsMasterList.length === 0 && !error) ? ( 
                     <View style={styles.loaderContainer}>
                        <ActivityIndicator size="large" color="#FF0000" />
                        <Text style={styles.loadingText}>Loading Products...</Text>
                    </View>
                ) : error && filteredProducts.length === 0 && allProductsMasterList.length === 0 ? ( 
                    <View style={styles.loaderContainer}>
                         <Icon name="alert-circle-outline" size={40} color="#888" />
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={filteredProducts}
                        renderItem={renderProductCard}
                        keyExtractor={(item) => item.id}
                        numColumns={NUM_COLUMNS}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={renderListEmptyComponent}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                colors={["#FF0000"]}
                                tintColor={"#FF0000"}
                            />
                        }
                        removeClippedSubviews={Platform.OS === 'android'}
                        initialNumToRender={10}
                        maxToRenderPerBatch={6}
                        windowSize={11}
                    />
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FF0000' },
    container: { flex: 1, backgroundColor: "#F5F5F5" },
    headerContainer: {
        backgroundColor: '#FF0000',
        paddingTop: Platform.OS === 'ios' ? 10 : 15,
        paddingBottom: 15,
        paddingHorizontal: 15,
        borderBottomLeftRadius: 15,
        borderBottomRightRadius: 15,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 50,
        paddingHorizontal: 15,
        height: 45,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#333',
    },
    clearSearchButton: {
        padding: 5,
        marginLeft: 5,
    },
    filterScroll: {
        marginTop: 15,
        paddingBottom: 2, 
        minHeight: 38,
    },
    filterButton: {
        paddingVertical: 7, 
        paddingHorizontal: 18, 
        borderRadius: 20,
        backgroundColor: '#FF0000', 
        borderWidth: 1.5, 
        borderColor: '#FFFFFF', 
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
        height: 36, 
    },
    filterText: {
        fontSize: 13, 
        color: '#FFFFFF', 
        fontWeight: '500',
    },
    activeFilter: {
        backgroundColor: '#000000', 
        borderColor: '#000000', 
    },
    activeFilterText: {
        color: '#FFFFFF', 
        fontWeight: 'bold',
    },
    loaderContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
    errorText: { marginTop: 12, fontSize: 16, color: '#D32F2F', textAlign: 'center'},
    retryButton: {
        marginTop: 20,
        backgroundColor: '#FF0000',
        paddingVertical: 10,
        paddingHorizontal: 25,
        borderRadius: 20,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: 'bold',
    },
    emptyListContainer: {
        alignItems: "center",
        paddingTop: height * 0.15, 
        paddingHorizontal: 30,
        flexGrow: 1, 
        justifyContent:'center',
    },
    emptyListText: { 
        fontSize: 16, color: '#888', textAlign: 'center', marginTop: 15 
    },
    listContent: {
        paddingHorizontal: GRID_PADDING,
        paddingTop: 10,
        paddingBottom: 20,
        flexGrow: 1,
    },
    // --- NEW PRODUCT CARD STYLES ---
    productCard: {
        width: PRODUCT_CARD_WIDTH,
        marginHorizontal: CARD_MARGIN,
        marginBottom: CARD_MARGIN * 2,
        backgroundColor: '#fff',
        borderRadius: 10,
        elevation: 4,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        overflow: 'hidden',
    },
    imageContainer: {
        width: '100%',
        backgroundColor: '#F8F8F8',
    },
    productImage: {
        width: '100%',
        height: 130,
    },
    bnplTag: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: BNPL_BADGE_BG,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    bnplTagText: {
        color: BADGE_TEXT_COLOR,
        fontSize: 10,
        fontWeight: 'bold',
    },
    discountBadge: {
        position: 'absolute',
        bottom: 2,
        left: 5,
        backgroundColor: DISCOUNT_BADGE_BG,
        borderRadius: 4,
        paddingHorizontal: 5,
        paddingVertical: 2,
    },
    discountBadgeText: {
        color: BADGE_TEXT_COLOR,
        fontSize: 9,
        fontWeight: 'bold',
    },
    infoContainer: {
        padding: 11,
    },
    productName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#212121',
        textAlign: 'center',
        marginBottom: 3,
    },
    productDescription: {
        fontSize: 12,
        color: '#757575',
        textAlign: 'center',
        marginBottom: 5,
        minHeight: 28, 
    },
    priceSection: {},
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        marginBottom: 4,
    },
    discountedPrice: {
        fontSize: 16,
        color: ACCENT_RED,
        fontWeight: '800',
        marginRight: 6,
    },
    strikethroughPrice: {
        textDecorationLine: 'line-through',
        color: '#9E9E9E',
        fontWeight: 'normal',
        fontSize: 13,
    },
    bnplPlanText: {
        fontSize: 10,
        color: ACCENT_RED,
        fontWeight: '400',
        textAlign: 'center',
    },
    categoryLoader: { 
        marginTop: 15,
        alignSelf: 'center',
        height: 36, 
        justifyContent: 'center',
    },
    categoryErrorText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontStyle: 'italic',
    },
});