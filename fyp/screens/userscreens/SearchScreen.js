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

const { width, height } = Dimensions.get("window");
const CARD_MARGIN = 5;
const GRID_PADDING = 10;
const NUM_COLUMNS = 2;

// Firestore Collections
const PRODUCTS_COLLECTION = 'Products';
const BNPL_PLANS_COLLECTION = 'BNPL_plans';
const CATEGORIES_COLLECTION = 'Category';

// Placeholder Image
const placeholderImage = require('../../assets/p3.jpg');

// Currency Symbol
const CURRENCY_SYMBOL = 'RS';

// Default 'All' category object
const allCategoryObject = { id: "All", name: "All" };

export default function SearchScreen() {
    const navigation = useNavigation();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState(allCategoryObject.id);
    const [allProducts, setAllProducts] = useState([]);
    // ** State to hold ALL categories fetched from DB (for name lookup) **
    const [allFetchedCategories, setAllFetchedCategories] = useState([allCategoryObject]);
    // ** State to hold ONLY categories with products, for DISPLAYING buttons **
    const [displayCategories, setDisplayCategories] = useState([allCategoryObject]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // --- Fetch ALL Categories Initially ---
    const fetchAllCategories = useCallback(async () => {
        // Only set loading true on initial mount
        // setLoadingCategories(true);
        try {
            const querySnapshot = await getDocs(collection(db, CATEGORIES_COLLECTION));
            const categoriesData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().categoryName || `Unnamed (${doc.id.substring(0,4)})`
            })).sort((a,b) => a.name.localeCompare(b.name));
            setAllFetchedCategories([allCategoryObject, ...categoriesData]); // Store ALL possibilities
        } catch (error) {
            console.error("Error fetching categories: ", error);
            setAllFetchedCategories([allCategoryObject]); // Fallback
        } finally {
             // Indicate categories are fetched (or fetch failed)
            setLoadingCategories(false);
        }
    }, []);

    useEffect(() => {
        fetchAllCategories();
    }, [fetchAllCategories]);

    // --- Fetch Products and Determine ACTIVE Display Categories ---
    const fetchProductsAndDetermineDisplayCategories = useCallback(async (isRefreshing = false) => {
        if (!isRefreshing) { setLoadingProducts(true); }
        setError(null);
        console.log('Fetching products...');
        try {
            const productsRef = collection(db, PRODUCTS_COLLECTION);
            const q = query(productsRef, orderBy('createdAt', 'desc'), limit(100)); // Fetch more to find categories
            const productSnapshot = await getDocs(q);
            console.log(`Fetched ${productSnapshot.docs.length} product documents.`);

            const activeCategoryIds = new Set(); // Track category IDs present in products

            // Process Products (including BNPL) & Collect Active Category IDs
            const processedProducts = await Promise.all(
                 productSnapshot.docs.map(async (docSnapshot) => {
                    const data = docSnapshot.data();
                    const categoryId = data.category; // *** Assumes this field holds the Category ID ***

                    // Add category ID to the Set if it exists and is valid
                    if (categoryId && typeof categoryId === 'string' && categoryId !== 'Uncategorized') {
                        activeCategoryIds.add(categoryId);
                    }
                    // ... (rest of product processing logic remains the same) ...
                     const productBase = {
                        id: docSnapshot.id,
                        name: data.name || 'Unnamed Product',
                        originalPrice: data.originalPrice,
                        discountedPrice: data.discountedPrice,
                        image: data.media?.images?.[0] || data.image || null,
                        description: data.description || '',
                        paymentOption: data.paymentOption || { COD: false, BNPL: false },
                        BNPLPlanIDs: Array.isArray(data.BNPLPlans) ? data.BNPLPlans.filter(id => typeof id === 'string' && id.trim() !== '') : [],
                        media: data.media,
                        category: categoryId || 'Uncategorized',
                        createdAt: data.createdAt,
                        bnplAvailable: data.paymentOption?.BNPL === true,
                        codAvailable: data.paymentOption?.COD === true,
                        ...data
                    };
                    if (productBase.bnplAvailable && productBase.BNPLPlanIDs.length > 0) {
                         try {
                            const planPromises = productBase.BNPLPlanIDs.map(planId => {
                                if (!planId) return Promise.resolve(null);
                                const planRef = doc(db, BNPL_PLANS_COLLECTION, planId.trim());
                                return getDoc(planRef);
                            });
                            const planSnapshots = await Promise.all(planPromises);
                            const detailedPlans = planSnapshots
                                .map(snap => snap?.exists() ? { id: snap.id, ...snap.data() } : null)
                                .filter(plan => plan !== null);
                            return { ...productBase, BNPLPlans: detailedPlans, BNPLPlanIDs: undefined };
                         } catch (planError) {
                            console.error(`Error fetching BNPL plans for product ${productBase.id}:`, planError);
                            return { ...productBase, BNPLPlans: [], BNPLPlanIDs: undefined };
                         }
                    }
                    return { ...productBase, BNPLPlans: [], BNPLPlanIDs: undefined };
                })
            );

            setAllProducts(processedProducts); // Set products state

            // --- Filter All Fetched Categories based on Active IDs ---
            console.log("All fetched categories:", allFetchedCategories);
            console.log("Active category IDs from products:", activeCategoryIds);

            // Filter the *complete* list of categories (allFetchedCategories)
            // Keep only 'All' and those whose ID is present in the activeCategoryIds Set
            const activeDisplayCategories = allFetchedCategories.filter(category =>
                category.id === 'All' || activeCategoryIds.has(category.id)
            );

            setDisplayCategories(activeDisplayCategories); // Set the categories to actually display
            console.log("Final categories to display:", activeDisplayCategories);

             // Reset selected category if the currently selected one is no longer active
            if (selectedCategory !== 'All' && !activeCategoryIds.has(selectedCategory)) {
                console.log(`Selected category ${selectedCategory} no longer has products, resetting to 'All'.`);
                setSelectedCategory('All');
            }

        } catch (err) {
            console.error("Error fetching products: ", err);
            setError("Failed to load products. Please pull down to refresh.");
            setAllProducts([]);
            setDisplayCategories([allCategoryObject]); // Reset display categories on error
        } finally {
            setLoadingProducts(false);
            setRefreshing(false);
            // We know category list generation is also done here
        }
    // *** Depend on allFetchedCategories being ready ***
    }, [refreshing, allFetchedCategories]);

    useEffect(() => {
        // Only run the combined fetch *after* the initial category list has been fetched
        if (!loadingCategories) {
            fetchProductsAndDetermineDisplayCategories();
        }
    // *** Trigger this effect when categories OR the fetch function changes ***
    }, [loadingCategories, fetchProductsAndDetermineDisplayCategories]);

    // --- Memoized Filtering Logic (Compares Category ID) ---
    const filteredProducts = useMemo(() => {
        const trimmedQuery = searchQuery?.trim()?.toLowerCase() ?? '';

        return allProducts.filter(product => {
            const productNameLower = product?.name?.toLowerCase() ?? '';
            const productDescLower = product?.description?.toLowerCase() ?? '';
            // *** Assumes product.category holds the Category ID ***
            const productCategoryId = product?.category;

            const matchesSearch = !trimmedQuery ||
                productNameLower.includes(trimmedQuery) ||
                productDescLower.includes(trimmedQuery);

            // Compare product's category ID with the selected category ID state
            const matchesCategory = selectedCategory === 'All' ||
                                   productCategoryId === selectedCategory;

            return matchesSearch && matchesCategory;
        });
    }, [allProducts, searchQuery, selectedCategory]); // Remove categories dependency


    // --- Pull to refresh ---
    const onRefresh = useCallback(async () => {
        console.log("Refreshing data...");
        setRefreshing(true); // This triggers the fetchProductsAndDetermineDisplayCategories useEffect
        // Consider if fetchAllCategories needs to be called on refresh
        // If categories change rarely, maybe not. If they change often, call it.
        // await fetchAllCategories();
    }, []); // Removed dependencies, refresh state handles trigger

    // --- Event Handlers ---
    const onSearchInputChange = (text) => { setSearchQuery(text); };
    const clearSearch = () => { setSearchQuery(''); };
    const onFilterCategoryChange = (categoryId) => { setSelectedCategory(categoryId); };

    // --- Render Product Card (Keep unchanged) ---
    const renderProductCard = ({ item }) => {
        // ... (renderProductCard code remains the same) ...
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
                 {item.description ? (<Text style={styles.productDescription} numberOfLines={2} ellipsizeMode="tail">{item.description}</Text>) : <View style={{height: 28}}/> }
                {showBnplBadge ? (<View style={styles.bnplBadge}><MaterialIcons name="schedule" size={14} color="#1565C0" /><Text style={styles.bnplText}>BNPL Available</Text></View>)
                 : showCodBadge ? (<View style={styles.codBadge}><MaterialIcons name="local-shipping" size={14} color="#EF6C00" /><Text style={styles.codText}>COD Available</Text></View>)
                 : (<View style={{ height: 24 }} />)}
            </TouchableOpacity>
        );
    };

    // --- Render Loading/Empty/Error States ---
    const renderListEmptyComponent = () => {
        if (loadingProducts && allProducts.length === 0) return null;
        if (!loadingProducts && error && allProducts.length === 0) return null;
        if (!loadingProducts && filteredProducts.length === 0) {
             if (searchQuery.trim() || selectedCategory !== 'All') {
                 return (
                     <View style={styles.emptyListContainer}>
                         <Icon name="magnify-close" size={40} color="#ccc" />
                         <Text style={styles.emptyListText}>No products match your criteria.</Text>
                     </View>
                 );
             } else if (allProducts.length === 0) {
                  return (
                     <View style={styles.emptyListContainer}>
                         <Icon name="package-variant-closed" size={40} color="#ccc" />
                         <Text style={styles.emptyListText}>No products available yet.</Text>
                     </View>
                  );
             }
        }
        return null;
    };

    // --- Render Category Filters ---
    const renderCategoryFilters = () => {
        // Show loader if categories OR initial products are still loading
        if ((loadingCategories && allFetchedCategories.length <= 1) || (loadingProducts && allProducts.length === 0)) {
             return <ActivityIndicator size="small" color="#FFFFFF" style={{ marginTop: 15, alignSelf: 'center' }} />;
        }
        // Use displayCategories (which only contains active categories)
        if (displayCategories.length > 1) {
             return (
                 <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                     {displayCategories.map(category => ( // Map over displayCategories
                         <TouchableOpacity
                             key={category.id}
                             style={[
                                 styles.filterButton,
                                 selectedCategory === category.id && styles.activeFilter
                             ]}
                             onPress={() => onFilterCategoryChange(category.id)} >
                             <Text style={[
                                 styles.filterText,
                                 selectedCategory === category.id && styles.activeFilterText
                             ]}>
                                 {category.name}
                             </Text>
                         </TouchableOpacity>
                     ))}
                 </ScrollView>
             );
        }
        return null;
    };


    return (
        <SafeAreaView style={styles.safeArea}>
             <StatusBar barStyle="light-content" backgroundColor="#FF0000" />
            <View style={styles.container}>
                {/* Header */}
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
                    {/* Render Category Filters */}
                    {renderCategoryFilters()}
                </View>

                {/* Product List Area */}
                {/* Show main loader only if products are loading AND categories haven't finished loading yet */}
                {(loadingProducts || loadingCategories) && allProducts.length === 0 ? (
                     <View style={styles.loaderContainer}>
                        <ActivityIndicator size="large" color="#FF0000" />
                        <Text style={styles.loadingText}>Loading...</Text>
                    </View>
                ) : error && allProducts.length === 0 ? (
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

// --- Styles (Keep unchanged) ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FF0000' },
    container: { flex: 1, backgroundColor: "#F5F5F5" },
    headerContainer: {
        backgroundColor: '#FF0000',
        paddingTop: Platform.OS === 'ios' ? 10 : 15,
        paddingBottom: 15,
        paddingHorizontal: 15,
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
    },
    filterButton: {
        paddingVertical: 6, // Adjusted padding from reference
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#FF0000', // Inactive background (red)
        borderWidth: 1,
        borderColor: '#FFFFFF', // Inactive border (white)
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterText: {
        fontSize: 14,
        color: '#FFFFFF', // Inactive text (white)
        fontWeight: '500',
    },
    activeFilter: {
        backgroundColor: '#000000', // Active background (black)
        borderColor: '#000000', // Active border (black)
    },
    activeFilterText: {
        color: '#FFFFFF', // Active text (white)
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
        // Keep styling for empty message display within FlatList
        alignItems: "center",
        paddingTop: height * 0.1,
        paddingHorizontal: 30,
        flexGrow: 1, // Ensure it can take space if list is short
        justifyContent:'center', // Center vertically too if list container allows
    },
    noProductsText: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 15 },
    listContent: {
        paddingHorizontal: GRID_PADDING - CARD_MARGIN,
        paddingTop: 10,
        paddingBottom: 20,
        flexGrow: 1, // Important for ListEmptyComponent positioning
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
        flexGrow: 1,
        flexShrink: 1,
    },
    bnplBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E3F2FD',
        borderRadius: 10,
        paddingVertical: 4,
        paddingHorizontal: 8,
        marginBottom: 4,
        alignSelf: 'center',
        height: 24,
        flexShrink: 0,
    },
    bnplText: {
        fontSize: 11,
        color: '#1565C0',
        marginLeft: 4,
        fontWeight: '600',
    },
    codBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF3E0',
        borderRadius: 10,
        paddingVertical: 4,
        paddingHorizontal: 8,
        marginBottom: 4,
        alignSelf: 'center',
        height: 24,
        flexShrink: 0,
    },
    codText: {
        fontSize: 11,
        color: '#EF6C00',
        marginLeft: 4,
        fontWeight: '600',
    },
});