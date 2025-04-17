import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
    View, FlatList, StyleSheet, Dimensions, Modal,
    ActivityIndicator, RefreshControl, Alert, Image, Text, TextInput, Platform,
    TouchableOpacity, Animated, ScrollView // Added ScrollView
} from 'react-native';
import { FAB } from 'react-native-paper';
// Removed LinearGradient as header is now solid color
import {
    collection, query, onSnapshot, orderBy, doc, addDoc, updateDoc,
    deleteDoc, serverTimestamp, getDocs
} from 'firebase/firestore';
import { Swipeable } from 'react-native-gesture-handler';
import { db } from '../../firebaseConfig';
import UploadProductComponent from '../../Components/UploadProductComponent';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width, height } = Dimensions.get('window');
const CATEGORIES_COLLECTION = 'Category';
const PRODUCTS_COLLECTION = 'Products';
const allCategoryObject = { id: 'All', name: 'All' };

export default function ProductScreen({ navigation }) {
    const [products, setProducts] = useState([]);
    // State now holds ALL categories fetched from DB
    const [allFetchedCategories, setAllFetchedCategories] = useState([allCategoryObject]);
    // REMOVED displayCategories state
    // const [displayCategories, setDisplayCategories] = useState([allCategoryObject]);
    const [modalVisible, setModalVisible] = useState(false);
    const [productToEdit, setProductToEdit] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(allCategoryObject.id); // Use ID for state
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [hasFetchedProductsOnce, setHasFetchedProductsOnce] = useState(false); // Track initial product fetch specifically
    const openRowRef = useRef(null);

    // --- Fetch ALL Categories Initially ---
    const fetchAllCategories = useCallback(async (isRefreshing = false) => {
        // Only set loading true on initial mount, not during refresh
        if (!isRefreshing) {
           setLoadingCategories(true);
        }
        try {
            const querySnapshot = await getDocs(collection(db, CATEGORIES_COLLECTION));
            const categoriesData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().categoryName || `Unnamed (${doc.id.substring(0,4)})`
            })).sort((a,b) => a.name.localeCompare(b.name));
            setAllFetchedCategories([allCategoryObject, ...categoriesData]);
            console.log("Fetched all categories:", [allCategoryObject, ...categoriesData].map(c=>c.name));
        } catch (error) {
            console.error("Error fetching categories: ", error);
            setAllFetchedCategories([allCategoryObject]);
        } finally {
            // Only set loading false on initial mount
             if (!isRefreshing) {
                 setLoadingCategories(false);
             }
        }
    }, []);

    useEffect(() => {
        fetchAllCategories(false); // Initial fetch
    }, [fetchAllCategories]);

    // --- Fetch Products (Real-time) ---
    useEffect(() => {
        // Set loading true only on mount, not subsequent listener triggers
        setLoadingProducts(true);
        setHasFetchedProductsOnce(false); // Reset flag on re-subscription if needed

        const productRef = collection(db, PRODUCTS_COLLECTION);
        const q = query(productRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            // Directly map products, no category filtering here
            const fetchedProducts = snapshot.docs.map((docSnap) => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    ...data,
                    category: data.category || 'Uncategorized', // Ensure field exists
                };
            });

            setProducts(fetchedProducts);

            // If selected category no longer exists in allFetchedCategories (rare, maybe deleted), reset
            if (selectedCategory !== 'All' && !allFetchedCategories.some(cat => cat.id === selectedCategory)) {
                console.log(`Selected category ${selectedCategory} no longer exists, resetting to 'All'.`);
                setSelectedCategory('All');
            }

            setLoadingProducts(false); // Products loaded (or snapshot updated)
            setRefreshing(false); // Ensure refreshing indicator stops
            setHasFetchedProductsOnce(true); // Mark initial fetch complete
            console.log(`Products snapshot received: ${fetchedProducts.length} items.`);

        }, (error) => {
            console.error("Error fetching products: ", error);
            Alert.alert("Error", "Could not fetch products.");
            setProducts([]); // Clear products on error
            setLoadingProducts(false);
            setRefreshing(false);
            setHasFetchedProductsOnce(true); // Mark fetch attempt as complete (even if failed)
        });

        return () => unsubscribe(); // Cleanup listener
    // Depend only on allFetchedCategories being available to ensure correct reset logic
    }, [allFetchedCategories]); // Re-run if categories list fundamentally changes


    // --- Memoized Filtering Logic (No changes needed here) ---
    const filteredProducts = useMemo(() => {
        const trimmedQuery = searchQuery?.trim()?.toLowerCase() ?? '';
        return products.filter(product => {
            const productNameLower = product?.name?.toLowerCase() ?? '';
            const productDescLower = product?.description?.toLowerCase() ?? '';
            const productCategoryId = product?.category; // Assumes ID is stored here
            const matchesSearch = !trimmedQuery ||
                productNameLower.includes(trimmedQuery) ||
                productDescLower.includes(trimmedQuery);
            const matchesCategory = selectedCategory === 'All' || productCategoryId === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [products, searchQuery, selectedCategory]);


    const closeOpenRow = useCallback(() => {
        openRowRef.current?.close();
        openRowRef.current = null;
    }, []);

    // --- Pull to refresh ---
    const onRefresh = useCallback(async () => { // Made async
        console.log("Refreshing...");
        setRefreshing(true);
        // Re-fetch all categories - this might slightly change the list order/content
        await fetchAllCategories(true); // Pass flag to avoid setting loadingCategories
        // The product listener will handle product updates automatically.
        // Refreshing state will be set to false within the product onSnapshot.
    }, [fetchAllCategories]);


    // --- Event Handlers (No changes needed here) ---
    const onSearchInputChange = (text) => { closeOpenRow(); setSearchQuery(text); };
    const clearSearch = () => { closeOpenRow(); setSearchQuery(''); };
    const onFilterCategoryChange = (categoryId) => { closeOpenRow(); setSelectedCategory(categoryId); };
    const openAddProductModal = () => { closeOpenRow(); setProductToEdit(null); setModalVisible(true); };
    const closeProductModal = () => { setModalVisible(false); setProductToEdit(null); };
    const openEditProductModal = useCallback((product) => { closeOpenRow(); if (!product?.id) { console.error("Error: Cannot edit invalid product data.", product); Alert.alert("Error", "Could not load product details for editing."); return; } setProductToEdit(product); setModalVisible(true); }, [closeOpenRow]);
    const handleSaveProduct = async (productDataFromChild) => { const isUpdating = !!productToEdit; const operation = isUpdating ? 'update' : 'add'; const { id, ...dataToSave } = productDataFromChild; dataToSave.lastUpdatedAt = serverTimestamp(); if (!isUpdating) { dataToSave.createdAt = serverTimestamp(); } try { if (isUpdating) { if (!productToEdit?.id) throw new Error("Update failed: Missing product ID."); const productRef = doc(db, 'Products', productToEdit.id); await updateDoc(productRef, dataToSave); Alert.alert("Success", "Product updated successfully!"); } else { await addDoc(collection(db, 'Products'), dataToSave); Alert.alert("Success", "Product added successfully!"); } closeProductModal(); } catch (error) { console.error(`Firestore ${operation} failed:`, error); Alert.alert("Database Error", `Failed to ${operation} product. ${error.message || 'Please try again.'}`); } };
    const handleDeleteConfirmation = useCallback((id, name) => { closeOpenRow(); if (!id) { Alert.alert("Error", "Invalid product ID provided."); return; } Alert.alert( "Confirm Delete", `Are you sure you want to delete "${name || 'this product'}"? This action cannot be undone.`, [ { text: "Cancel", style: "cancel", onPress: () => {} }, { text: "Delete", style: "destructive", onPress: () => handleProductDelete(id) } ] ); }, [closeOpenRow]);
    const handleProductDelete = async (id) => { if (!id) { Alert.alert("Error", "Could not delete product: Invalid ID."); return; } try { await deleteDoc(doc(db, 'Products', id)); Alert.alert("Success", "Product deleted."); } catch (error) { console.error(`Delete failed for product ${id}:`, error); Alert.alert("Error", `Failed to delete product: ${error.message || 'Please try again.'}`); } };

    // --- Render item for FlatList (No changes needed here) ---
    const renderProduct = useCallback(({ item }) => {
        return (
            <ProductListItem
                item={item}
                onEdit={() => openEditProductModal(item)}
                onDelete={() => handleDeleteConfirmation(item.id, item.name)}
                openRowRef={openRowRef}
            />
        );
    }, [openEditProductModal, handleDeleteConfirmation, openRowRef]);

    // --- Render empty list component (No changes needed here) ---
    const renderListEmptyComponent = () => {
        // Show loader only if initial product fetch is happening AND categories are also loading
        if ((loadingProducts || loadingCategories) && !hasFetchedProductsOnce) {
            return null; // Main loader shown outside
        }
        // If not loading but filtered list is empty
        if (!loadingProducts && filteredProducts.length === 0) {
            if (searchQuery.trim() || selectedCategory !== 'All') {
                 return (<View style={styles.emptyListContainer}><Icon name="magnify-close" size={40} color="#ccc" /><Text style={styles.emptyListText}>No products match your criteria.</Text></View>);
            } else if (products.length === 0) { // Use base products array to check if *any* products exist
                  return (<View style={styles.emptyListContainer}><Icon name="package-variant-closed" size={40} color="#ccc" /><Text style={styles.emptyListText}>No products added yet.</Text><Text style={styles.emptyListSubText}>Tap '+' to add your first product!</Text></View>);
            }
        }
        return null;
    };

    // --- Render Category Filters Component ---
    const renderCategoryFilters = () => {
        // Show loader if categories are still loading initially
        if (loadingCategories) {
             return <ActivityIndicator size="small" color="#FFFFFF" style={{ marginTop: 15, marginBottom: 5, alignSelf: 'center' }} />;
        }
        // Use allFetchedCategories directly
        // Render only if there are categories beyond 'All'
        if (allFetchedCategories.length > 1) {
             return (
                 <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                     {allFetchedCategories.map(category => ( // Iterate over all fetched categories
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
        // If only 'All' category exists or loading failed, show nothing here
        return null;
    };


    return (
        <View style={styles.container}>
            <View style={styles.headerContainer}>
                {/* Search Bar */}
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

                {/* Category Filters */}
                {renderCategoryFilters()}
            </View>

            {/* Product List */}
            {/* Show main loader only during initial combined loading */}
             {(loadingCategories || loadingProducts) && !hasFetchedProductsOnce ? (
                 <View style={styles.emptyListContainer}>
                     <ActivityIndicator size="large" color="#FF0000" />
                     <Text style={styles.emptyListText}>Loading data...</Text>
                 </View>
             ) : ( // Otherwise show the list (which might show its own empty state)
                <FlatList
                    data={filteredProducts}
                    renderItem={renderProduct}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContentContainer}
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
                    maxToRenderPerBatch={5}
                    windowSize={11}
                />
             )}


            {/* Add Product FAB */}
            <FAB
                style={styles.fab}
                icon="plus"
                color="#FFFFFF"
                onPress={openAddProductModal}
                accessibilityLabel="Add New Product"
            />

            {/* Add/Edit Modal */}
            {modalVisible && (
                 <Modal
                     visible={modalVisible}
                     animationType="slide"
                     onRequestClose={closeProductModal}
                 >
                     <UploadProductComponent
                         visible={modalVisible}
                         onDismiss={closeProductModal}
                         onSave={handleSaveProduct}
                         productForEdit={productToEdit}
                     />
                 </Modal>
            )}
        </View>
    );
}

// --- Product List Item Component (Keep unchanged) ---
const ProductListItem = React.memo(({ item, onEdit, onDelete, openRowRef }) => {
    const swipeableRef = useRef(null);
    const imageUrl = item?.media?.images?.[0] || null;
    const originalPrice = item?.originalPrice;
    const discountedPrice = item?.discountedPrice;
    const hasDiscount = typeof discountedPrice === 'number' && typeof originalPrice === 'number' && discountedPrice < originalPrice;
    const displayOriginalPrice = typeof originalPrice === 'number' ? `RS ${originalPrice.toFixed(0)}` : 'N/A'; // Added toFixed(0)
    const displayDiscountedPrice = typeof discountedPrice === 'number' ? `RS ${discountedPrice.toFixed(0)}` : ''; // Added toFixed(0)
    const description = item?.description || '';
    const isBNPLEnabled = item?.paymentOption?.BNPL === true;

    const renderRightActions = (progress, dragX) => {
       const trans = dragX.interpolate({ inputRange: [-80, 0], outputRange: [0, 80], extrapolate: 'clamp' });
        return ( <TouchableOpacity style={styles.deleteButtonContainer} onPress={() => { swipeableRef.current?.close(); onDelete(); }} activeOpacity={0.6} >
               <Animated.View style={[styles.deleteButton, { transform: [{ translateX: trans }] }]}>
                    <Icon name="delete-outline" size={24} color="#fff" />
                </Animated.View>
            </TouchableOpacity> ); };
     const handleSwipeOpen = () => { if (openRowRef.current && openRowRef.current !== swipeableRef.current) { openRowRef.current.close(); } openRowRef.current = swipeableRef.current; };
     const handleSwipeClose = () => { if (openRowRef.current === swipeableRef.current) { openRowRef.current = null; } };

    return ( <Swipeable ref={swipeableRef} renderRightActions={renderRightActions} onSwipeableWillOpen={handleSwipeOpen} onSwipeableClose={handleSwipeClose} overshootRight={false} friction={2} rightThreshold={40} >
           <TouchableOpacity activeOpacity={0.7} onPress={onEdit} style={styles.listItemTouchable} >
               <View style={styles.listItemContent}>
                   <View style={styles.imageContainer}>
                       {imageUrl ? (<Image source={{ uri: imageUrl }} style={styles.thumbnail} resizeMode="cover" /> ) : ( <View style={styles.thumbnailPlaceholder}><Icon name="image-off-outline" size={24} color="#AEAEAE" /></View> )}
                   </View>
                   <View style={styles.infoContainer}>
                       <Text style={styles.productName} numberOfLines={1} ellipsizeMode="tail">{item?.name || 'Unnamed Product'}</Text>
                       <View style={styles.priceRow}>
                           <Text style={[styles.productPrice, hasDiscount && styles.strikethroughPrice]}>{displayOriginalPrice}</Text>
                           {hasDiscount && (<Text style={styles.discountedPrice}>{displayDiscountedPrice}</Text>)}
                       </View>
                       {description ? (<Text style={styles.productDescription} numberOfLines={1} ellipsizeMode="tail">{description}</Text>) : null}
                       {isBNPLEnabled && (<View style={styles.bnplIndicatorContainer}><Icon name="credit-card-clock-outline" size={12} color="#0056b3" style={styles.bnplIcon}/><Text style={styles.bnplIndicatorText}>BNPL</Text></View>)}
                   </View>
                   <Icon name="chevron-right" size={22} color="#B0BEC5" style={styles.chevronIcon}/>
               </View>
           </TouchableOpacity>
        </Swipeable> );
});


// --- Styles (Added toFixed(0) to prices in ProductListItem) ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F5' },
    headerContainer: {
        backgroundColor: '#FF0000',
        paddingTop: Platform.OS === 'ios' ? 50 : 22,
        paddingBottom: 15,
        paddingHorizontal: 15,  borderBottomLeftRadius: 15,
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
    searchIcon: { marginRight: 10, },
    searchInput: { flex: 1, fontSize: 15, color: '#333', },
    clearSearchButton: { padding: 5, marginLeft: 5, },
    filterScroll: { marginTop: 15, paddingBottom: 2, }, // No marginBottom needed if loader shows below
    filterButton: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#FF0000',
        borderWidth: 1,
        borderColor: '#FFFFFF',
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterText: {
        fontSize: 14,
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
    listContentContainer: { paddingBottom: 90, flexGrow: 1, },
    listItemTouchable: { backgroundColor: '#FFFFFF', },
    listItemContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E0E0E0', },
    imageContainer: { marginRight: 15, width: 60, height: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F0F0', borderRadius: 8, overflow: 'hidden', },
    thumbnail: { width: '100%', height: '100%', },
    thumbnailPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F0F0', },
    infoContainer: { flex: 1, justifyContent: 'center', marginRight: 8, },
    productName: { fontSize: 16, fontWeight: '600', color: '#222', marginBottom: 3, },
    priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1, marginBottom: 4, flexWrap: 'wrap', },
    productPrice: { fontSize: 14, color: '#555', },
    strikethroughPrice: { textDecorationLine: 'line-through', color: '#999', marginRight: 8, fontSize: 13, },
    discountedPrice: { fontSize: 14, fontWeight: 'bold', color: '#E53935', },
    productDescription: { fontSize: 13, color: '#777', marginTop: 3, marginBottom: 4, },
    bnplIndicatorContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(0, 86, 179, 0.1)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, },
    bnplIcon: { marginRight: 4, },
    bnplIndicatorText: { fontSize: 11, fontWeight: '600', color: '#0056b3', },
    chevronIcon: { color: '#B0BEC5', },
    deleteButtonContainer: { backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'flex-end', width: 85, },
    deleteButton: { paddingHorizontal: 25, height: '100%', justifyContent: 'center', },
    emptyListContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, marginTop: height * 0.05, },
    emptyListText: { fontSize: 17, color: "#666", textAlign: "center", marginTop: 15, fontWeight: '500', },
    emptyListSubText: { fontSize: 14, color: "#999", textAlign: "center", marginTop: 8, },
    fab: { position: 'absolute', margin: 16, right: 10, bottom: 20, backgroundColor: '#FF0000', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, },
});