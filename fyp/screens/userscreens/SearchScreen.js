// SearchScreen.js
// (CORRECTED - Render helpers correctly scoped, includes all features)

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

const { width, height } = Dimensions.get("window");
const CARD_MARGIN = 5;
const GRID_PADDING = 10;
const NUM_COLUMNS = 2;

const PRODUCTS_COLLECTION = 'Products';
const BNPL_PLANS_COLLECTION = 'BNPL_plans';
const CATEGORIES_COLLECTION = 'Category';

const placeholderImage = require('../../assets/p3.jpg');
const CURRENCY_SYMBOL = 'RS';

const allCategoryObject = { id: "All", name: "All" };
const trendingCategoryObject = { id: "Trending", name: "Trending" };

export default function SearchScreen() {
    const navigation = useNavigation(); // useNavigation hook at the top level of the component
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

    // --- RENDER HELPER FUNCTIONS ARE NOW INSIDE THE COMPONENT ---
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
            <TouchableOpacity style={styles.productCard} onPress={() => navigation.navigate('ProductDetails', { product: item })} >
                <Image source={item.image ? { uri: item.image } : placeholderImage} style={styles.productImage} resizeMode="contain" onError={(e) => console.log('Search Image Load Error:', e.nativeEvent.error, 'URL:', item.image)} />
                <Text style={styles.productName} numberOfLines={1} ellipsizeMode="tail">{item.name || ''}</Text>
                <View style={styles.priceContainer}>
                    {hasDiscount && displayOriginalPrice && (<Text style={[styles.productPrice, styles.strikethroughPrice]}>{displayOriginalPrice}</Text>)}
                    {finalPriceString ? (<Text style={styles.discountedPrice}>{finalPriceString}</Text>) : (<View style={{ height: 20 }} />)}
                </View>
                 {item.description ? (<Text style={styles.productDescription} numberOfLines={2} ellipsizeMode="tail">{item.description}</Text>) : <View style={{height: styles.productDescription.fontSize * 2 * 1.2 || 28}}/> }
                {showBnplBadge ? (<View style={styles.bnplBadge}><MaterialIcons name="schedule" size={14} color="#1565C0" /><Text style={styles.bnplText}>BNPL Available</Text></View>)
                 : showCodBadge ? (<View style={styles.codBadge}><MaterialIcons name="local-shipping" size={14} color="#EF6C00" /><Text style={styles.codText}>COD Available</Text></View>)
                 : (<View style={{ height: 24 }} />)}
            </TouchableOpacity>
        );
    };

    const renderListEmptyComponent = () => {
        if (loadingProducts || loadingCategories) return null;
        if (error && filteredProducts.length === 0) { 
            // If there's a general error and no products are shown for the current filter, show error.
            // The main error display below FlatList will handle more general fetch errors.
            // This specific one is for "no results due to error for this filter".
            return ( <View style={styles.emptyListContainer}><Icon name="alert-circle-outline" size={40} color="#ccc" /><Text style={styles.emptyListText}>{error}</Text></View> );
        }
        if (filteredProducts.length === 0) {
             if (searchQuery.trim() || (selectedCategory !== 'All' && selectedCategory !== 'Trending')) {
                 return ( <View style={styles.emptyListContainer}><Icon name="magnify-close" size={40} color="#ccc" /><Text style={styles.emptyListText}>No products match your criteria.</Text></View> );
            } else if (selectedCategory === 'Trending' && trendingProductList.length === 0){
                return ( <View style={styles.emptyListContainer}><Icon name="chart-line-variant" size={40} color="#ccc" /><Text style={styles.emptyListText}>No trending products right now.</Text></View> );
            } else if (allProductsMasterList.length === 0) { // True only if DB is empty
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
                ) : error && filteredProducts.length === 0 && allProductsMasterList.length === 0 ? ( // Show general error if master list is also empty
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
                        renderItem={renderProductCard} // This is now correctly scoped
                        keyExtractor={(item) => item.id}
                        numColumns={NUM_COLUMNS}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={renderListEmptyComponent} // Correctly scoped
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
        paddingHorizontal: 15,borderBottomLeftRadius: 15, borderBottomRightRadius: 15,
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
        paddingHorizontal: GRID_PADDING - CARD_MARGIN, 
        paddingTop: 10,
        paddingBottom: 20,
        flexGrow: 1, 
    },
    productCard: {
        backgroundColor: '#fff',
        borderRadius: 8,
        margin: CARD_MARGIN,
        width: (width - (GRID_PADDING * 2) - (CARD_MARGIN * NUM_COLUMNS * 2)) / NUM_COLUMNS,
        alignItems: 'center',
        padding: 10,
        paddingBottom: 8, 
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.20,
        shadowRadius: 1.41,
        minHeight: 290, 
        justifyContent: 'space-between',
    },
    productImage: {
        width: '100%',
        height: 120, 
        borderRadius: 6,
        marginBottom: 10, 
        backgroundColor: '#F8F8F8'
    },
    productName: {
        fontSize: 14, 
        fontWeight: '600',
        color: '#333',
        textAlign: 'center',
        minHeight: 18, 
        marginBottom: 6, 
        paddingHorizontal: 2,
        width: '100%',
    },
    priceContainer: {
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: 4,
        minHeight: 35, 
        marginBottom: 8, 
        justifyContent: 'center',
        width: '100%',
    },
    productPrice: {
        fontSize: 13, 
        color: '#999', 
        fontWeight: 'normal', 
    },
    strikethroughPrice: {
        textDecorationLine: 'line-through', 
        marginBottom: 2, 
    },
    discountedPrice: {
        fontSize: 15, 
        color: '#E53935', 
        fontWeight: 'bold', 
    },
    productDescription: {
        fontSize: 11, 
        color: '#666', 
        textAlign: 'center',
        marginTop: 4, 
        marginBottom: 8, 
        paddingHorizontal: 5, 
        minHeight: 28, 
        width: '95%', 
        lineHeight: 14, 
    },
    bnplBadge: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', borderRadius: 10,
        paddingVertical: 4, paddingHorizontal: 8, marginBottom: 4, alignSelf: 'center',
        height: 24, flexShrink: 0, 
    },
    bnplText: { fontSize: 11, color: '#1565C0', marginLeft: 4, fontWeight: '600', },
    codBadge: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', borderRadius: 10,
        paddingVertical: 4, paddingHorizontal: 8, marginBottom: 4, alignSelf: 'center',
        height: 24, flexShrink: 0, 
    },
    codText: { fontSize: 11, color: '#EF6C00', marginLeft: 4, fontWeight: '600', },
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