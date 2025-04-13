import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
    View, FlatList, StyleSheet, Dimensions, Modal,
    ActivityIndicator, RefreshControl, Alert, Image, Text, TextInput, Platform,
    TouchableOpacity, Animated, ScrollView // Added ScrollView
} from 'react-native';
import { FAB } from 'react-native-paper'; // Removed IconButton and PaperActivityIndicator if not needed elsewhere
import { LinearGradient } from 'expo-linear-gradient'; // Import LinearGradient
import {
    collection, query, onSnapshot, orderBy, doc, addDoc, updateDoc,
    deleteDoc, serverTimestamp, getDocs // Added getDocs
} from 'firebase/firestore';
import { Swipeable } from 'react-native-gesture-handler';
import { db } from '../../firebaseConfig'; // Ensure path is correct
import UploadProductComponent from '../../Components/UploadProductComponent'; // Ensure path is correct
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'; // Keeping MaterialCommunityIcons

const { width, height } = Dimensions.get('window');

export default function ProductScreen({ navigation }) { // Added navigation prop if needed for details screen
    const [products, setProducts] = useState([]);
    // No need for separate filteredProducts state if using useMemo directly with FlatList
    // const [filteredProducts, setFilteredProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [productToEdit, setProductToEdit] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All'); // State for category filter
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
    const openRowRef = useRef(null);

    // Fetch Products (Real-time)
    useEffect(() => {
        setLoadingProducts(true);
        setHasFetchedOnce(false); // Reset fetch flag on re-subscription if needed
        const productRef = collection(db, 'Products');
        // Consider ordering by a timestamp or name based on requirements
        const q = query(productRef, orderBy('createdAt', 'desc')); // Example: order by creation time

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedProducts = snapshot.docs.map((docSnap) => ({
                 id: docSnap.id,
                 ...docSnap.data()
            }));
            setProducts(fetchedProducts);
            // Filtering is now handled by useMemo
            // handleSearchFilter(searchQuery, selectedCategory, fetchedProducts);
            setLoadingProducts(false);
            setRefreshing(false); // Stop refresh indicator if data arrives
            setHasFetchedOnce(true);
        }, (error) => {
            console.error("Error fetching products: ", error);
            Alert.alert("Error", "Could not fetch products.");
            setLoadingProducts(false);
            setRefreshing(false);
            setHasFetchedOnce(true); // Mark as fetched even on error
        });

        return () => unsubscribe(); // Cleanup listener on unmount
    }, []); // Runs once on mount
    const fetchCategories = async () => {
        setLoadingCategories(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'Category'));
            const categoriesData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().categoryName || `Unnamed (${doc.id.substring(0,4)})`
            }));
            setCategories([{ id: 'All', name: 'All' }, ...categoriesData]);
        } catch (error) {
            console.error("Error fetching categories: ", error);
            Alert.alert("Error", "Could not fetch categories.");
            setCategories([{ id: 'All', name: 'All' }]);
        } finally {
            setLoadingCategories(false);
        }
    };
    // Fetch Categories (Once)
    useEffect(() => {
        fetchCategories();
    }, []);
   

    // Memoized Filtering Logic
    const filteredProducts = useMemo(() => {
        const trimmedQuery = searchQuery?.trim()?.toLowerCase() ?? '';

        return products.filter(product => {
            // Check search query match (name or description)
            const matchesSearch = !trimmedQuery ||
                product?.name?.toLowerCase().includes(trimmedQuery) ||
                product?.description?.toLowerCase().includes(trimmedQuery);

            // Check category match
            const matchesCategory = selectedCategory === 'All' || product?.category === selectedCategory;

            return matchesSearch && matchesCategory;
        });
    }, [products, searchQuery, selectedCategory]); // Recalculate when these change


    const closeOpenRow = useCallback(() => {
        openRowRef.current?.close();
        openRowRef.current = null;
    }, []);

    // Pull to refresh manually triggers product fetch via useEffect re-run logic (or could trigger manually)
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        closeOpenRow();
    
        fetchCategories(); // Refresh categories
    
        // Simulate a manual refresh by resetting hasFetchedOnce (forces UI update if products change)
        setHasFetchedOnce(false);
    
        // Wait a bit for UI feedback, then stop refresh indicator
        setTimeout(() => setRefreshing(false), 1500);
    }, [closeOpenRow]);
    

    // Renamed from handleSearchFilter - now handled by useMemo
    // const handleCombinedFilter = useCallback((query, categoryFilter, productList) => { ... }, []);

    const onSearchInputChange = (text) => {
        closeOpenRow(); // Close swipeable row when typing search
        setSearchQuery(text);
        // Filtering updates via useMemo
    };

    const clearSearch = () => {
        closeOpenRow();
        setSearchQuery('');
        // Filtering updates via useMemo
    };

    const onFilterCategoryChange = (categoryId) => {
        closeOpenRow();
        setSelectedCategory(categoryId);
         // Filtering updates via useMemo
    };

    const openAddProductModal = () => {
        closeOpenRow();
        setProductToEdit(null);
        setModalVisible(true);
    };

    const closeProductModal = () => {
        setModalVisible(false);
        setProductToEdit(null); // Clear edit state when closing
    };

    const openEditProductModal = useCallback((product) => {
        closeOpenRow();
        if (!product?.id) {
             console.error("Error: Cannot edit invalid product data.", product);
             Alert.alert("Error", "Could not load product details for editing.");
             return;
        }
        setProductToEdit(product);
        setModalVisible(true);
    }, [closeOpenRow]);

    const handleSaveProduct = async (productDataFromChild) => {
        const isUpdating = !!productToEdit;
        const operation = isUpdating ? 'update' : 'add';

        // Firestore expects data without the id field for add/update operations
        // The document reference specifies the ID for updates.
        const { id, ...dataToSave } = productDataFromChild; // Destructure id out

        dataToSave.lastUpdatedAt = serverTimestamp();
        if (!isUpdating) {
            dataToSave.createdAt = serverTimestamp();
        }

        try {
            if (isUpdating) {
                if (!productToEdit?.id) throw new Error("Update failed: Missing product ID.");
                const productRef = doc(db, 'Products', productToEdit.id);
                await updateDoc(productRef, dataToSave);
                Alert.alert("Success", "Product updated successfully!");
            } else {
                await addDoc(collection(db, 'Products'), dataToSave);
                Alert.alert("Success", "Product added successfully!");
            }
            closeProductModal(); // Close modal on success
        } catch (error) {
            console.error(`Firestore ${operation} failed:`, error);
            Alert.alert("Database Error", `Failed to ${operation} product. ${error.message || 'Please try again.'}`);
            // Keep modal open on error? Or close? Depends on UX preference.
        }
    };

     const handleDeleteConfirmation = useCallback((id, name) => {
        closeOpenRow();
        if (!id) {
             Alert.alert("Error", "Invalid product ID provided.");
             return;
         }
        Alert.alert(
             "Confirm Delete",
             `Are you sure you want to delete "${name || 'this product'}"? This action cannot be undone.`,
             [
                 { text: "Cancel", style: "cancel", onPress: () => {} }, // Added onPress for clarity
                 { text: "Delete", style: "destructive", onPress: () => handleProductDelete(id) }
             ]
         );
    }, [closeOpenRow]); // handleProductDelete doesn't need to be a dependency if defined outside/stable


    const handleProductDelete = async (id) => {
         if (!id) {
             Alert.alert("Error", "Could not delete product: Invalid ID.");
             return;
         }
         try {
             await deleteDoc(doc(db, 'Products', id));
             // No need for timeout, the list will update via onSnapshot
             Alert.alert("Success", "Product deleted.");
         } catch (error) {
             console.error(`Delete failed for product ${id}:`, error);
             Alert.alert("Error", `Failed to delete product: ${error.message || 'Please try again.'}`);
         }
    };

    // Render item for FlatList
    const renderProduct = useCallback(({ item }) => {
        return (
            <ProductListItem
                item={item}
                onEdit={() => openEditProductModal(item)}
                onDelete={() => handleDeleteConfirmation(item.id, item.name)}
                openRowRef={openRowRef} // Pass ref for swipe management
            />
        );
        // Dependencies ensure this callback is stable unless these handlers change
    }, [openEditProductModal, handleDeleteConfirmation, openRowRef]);

    // Render empty list component
    const renderListEmptyComponent = () => {
        // Combine loading states
        if (loadingProducts || (loadingCategories && categories.length <= 1)) {
            return (
                <View style={styles.emptyListContainer}>
                    <ActivityIndicator size="large" color="#FF0000" />
                    <Text style={styles.emptyListText}>Loading...</Text>
                </View>
            );
        }
        // If fetched but empty
        if (hasFetchedOnce) {
             if (searchQuery.trim() && filteredProducts.length === 0) {
                 return ( <View style={styles.emptyListContainer}><Icon name="magnify-close" size={40} color="#ccc" /><Text style={styles.emptyListText}>No products match search</Text></View> );
             }
             if (selectedCategory !== 'All' && filteredProducts.length === 0) {
                 const categoryName = categories.find(c=>c.id === selectedCategory)?.name || selectedCategory;
                 return ( <View style={styles.emptyListContainer}><Icon name="filter-variant-remove" size={40} color="#ccc" /><Text style={styles.emptyListText}>No products in category "{categoryName}"</Text></View> );
             }
             if (products.length === 0) {
                 return ( <View style={styles.emptyListContainer}><Icon name="package-variant-closed" size={40} color="#ccc" /><Text style={styles.emptyListText}>No products added yet.</Text><Text style={styles.emptyListSubText}>Tap '+' to add your first product!</Text></View> );
             }
        }
        return null;
    };

    return (
        <View style={styles.container}>
            {/* --- Apply Gradient Header --- */}
            <LinearGradient colors={['#FF0000', '#FF0000']} style={styles.gradientHeader}>
                {/* --- Apply Styled Search Bar --- */}
                <View style={styles.searchBar}>
                    <Icon name="magnify" size={22} color="#FF0000" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search products..."
                        placeholderTextColor="#888" // Keep placeholder color subtle
                        value={searchQuery}
                        onChangeText={onSearchInputChange}
                        returnKeyType="search"
                        // clearButtonMode="while-editing" // Use custom clear button
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}>
                            {/* Use MaterialCommunityIcons consistent with the rest of the screen */}
                            <Icon name="close-circle" size={20} color="#FF0000" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* --- Category Filter Buttons --- */}
                {loadingCategories ? (
                     <ActivityIndicator size="small" color="#FFFFFF" style={{ marginTop: 15 }} />
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                        {categories.map(category => (
                            <TouchableOpacity
                                key={category.id}
                                style={[
                                    styles.filterButton,
                                    selectedCategory === category.id && styles.activeFilter
                                ]}
                                onPress={() => onFilterCategoryChange(category.id)}
                            >
                                <Text style={[
                                    styles.filterText,
                                    selectedCategory === category.id && styles.activeFilterText
                                ]}>
                                    {category.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </LinearGradient>

            {/* --- Product List --- */}
            <FlatList
                data={filteredProducts} // Use the memoized filtered list
                renderItem={renderProduct}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContentContainer}
                ListEmptyComponent={renderListEmptyComponent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={["#FF0000"]} // Spinner color during pull-to-refresh
                        tintColor={"#FF0000"} // Spinner color for iOS
                    />
                }
                // Performance optimizations (optional but good for long lists)
                removeClippedSubviews={Platform.OS === 'android'} // Can improve Android performance
                initialNumToRender={10} // Render initial batch quickly
                maxToRenderPerBatch={5} // Reduce items rendered per batch during scroll
                windowSize={11} // Render items within viewport + buffer
            />

            {/* --- Add Product FAB --- */}
            <FAB
                style={styles.fab}
                icon="plus"
                color="#FFFFFF" // White icon color
                onPress={openAddProductModal}
                accessibilityLabel="Add New Product"
            />

            {/* --- Add/Edit Modal --- */}
            {/* Use React Native Modal directly for better control if needed,
                or keep using Paper's Modal if preferred */}
            {modalVisible && (
                 <Modal
                     visible={modalVisible}
                     animationType="slide"
                     onRequestClose={closeProductModal} // Handle Android back button
                 >
                     <UploadProductComponent
                         visible={modalVisible} // Pass visibility
                         onDismiss={closeProductModal} // Function to close modal
                         onSave={handleSaveProduct} // Function to save data
                         productForEdit={productToEdit} // Pass data for editing (null for add)
                     />
                 </Modal>
            )}
        </View>
    );
}

// --- Product List Item Component (Memoized) ---
const ProductListItem = React.memo(({ item, onEdit, onDelete, openRowRef }) => {
    const swipeableRef = useRef(null);

    // Extract data safely
    const imageUrl = item?.media?.images?.[0] || null;
    const originalPrice = item?.originalPrice;
    const discountedPrice = item?.discountedPrice;
    const hasDiscount = typeof discountedPrice === 'number' && typeof originalPrice === 'number' && discountedPrice < originalPrice;

    // Format prices
    const displayOriginalPrice = typeof originalPrice === 'number' ? `RS ${originalPrice}` : 'N/A';
    const displayDiscountedPrice = typeof discountedPrice === 'number' ? `RS ${discountedPrice}` : '';

    const description = item?.description || '';
    const isBNPLEnabled = item?.paymentOption?.BNPL === true;

    // Swipe Right Actions (Delete Button)
    const renderRightActions = (progress, dragX) => {
       const trans = dragX.interpolate({
           inputRange: [-80, 0], // Width of the delete button area
           outputRange: [0, 80], // How much the button translates
           extrapolate: 'clamp', // Prevent over-translation
       });
        return (
            <TouchableOpacity
               style={styles.deleteButtonContainer}
               onPress={() => {
                   swipeableRef.current?.close(); // Close swipe before deleting
                   onDelete();
               }}
               activeOpacity={0.6}
            >
               <Animated.View style={[styles.deleteButton, { transform: [{ translateX: trans }] }]}>
                    <Icon name="delete-outline" size={24} color="#fff" />
                </Animated.View>
            </TouchableOpacity>
        );
    };

    // Swipe Management Callbacks
     const handleSwipeOpen = () => {
         // Close any previously opened row
         if (openRowRef.current && openRowRef.current !== swipeableRef.current) {
             openRowRef.current.close();
         }
         // Store the ref of the currently opened row
         openRowRef.current = swipeableRef.current;
     };

      const handleSwipeClose = () => {
        // Clear the ref if this row is the one being closed
        if (openRowRef.current === swipeableRef.current) {
            openRowRef.current = null;
        }
    };

    return (
        <Swipeable
            ref={swipeableRef}
            renderRightActions={renderRightActions}
            onSwipeableWillOpen={handleSwipeOpen} // Use WillOpen for better timing
            onSwipeableClose={handleSwipeClose}
            overshootRight={false} // Prevent swiping too far
            friction={2} // Adjust swipe friction
            rightThreshold={40} // How far to swipe to trigger open
        >
           {/* Make the main content touchable for editing */}
           <TouchableOpacity
               activeOpacity={0.7} // Visual feedback on press
               onPress={onEdit}
               style={styles.listItemTouchable} // Ensure background for touchable area
           >
               <View style={styles.listItemContent}>
                   {/* Image Thumbnail */}
                   <View style={styles.imageContainer}>
                       {imageUrl ? (
                           <Image source={{ uri: imageUrl }} style={styles.thumbnail} resizeMode="cover" />
                       ) : (
                           // Placeholder Icon
                           <View style={styles.thumbnailPlaceholder}>
                               <Icon name="image-off-outline" size={24} color="#AEAEAE" />
                           </View>
                       )}
                   </View>
                   {/* Product Info */}
                   <View style={styles.infoContainer}>
                       <Text style={styles.productName} numberOfLines={1} ellipsizeMode="tail">{item?.name || 'Unnamed Product'}</Text>
                       <View style={styles.priceRow}>
                           <Text style={[styles.productPrice, hasDiscount && styles.strikethroughPrice]}>
                               {displayOriginalPrice}
                           </Text>
                           {hasDiscount && (
                               <Text style={styles.discountedPrice}>
                                   {displayDiscountedPrice}
                               </Text>
                           )}
                       </View>
                       {description ? (
                          <Text style={styles.productDescription} numberOfLines={1} ellipsizeMode="tail">
                              {description}
                          </Text>
                       ) : null}
                       {/* BNPL Indicator */}
                       {isBNPLEnabled && (
                          <View style={styles.bnplIndicatorContainer}>
                              <Icon name="credit-card-clock-outline" size={12} color="#0056b3" style={styles.bnplIcon}/>
                              <Text style={styles.bnplIndicatorText}>BNPL</Text>
                          </View>
                       )}
                   </View>
                   {/* Chevron Icon */}
                   <Icon name="chevron-right" size={22} color="#B0BEC5" style={styles.chevronIcon}/>
               </View>
           </TouchableOpacity>
        </Swipeable>
    );
});

// --- Styles ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5' // Match example screen background
    },
    // --- Header Styles (from OrderScreen) ---
    gradientHeader: {
        paddingTop: Platform.OS === 'ios' ? 60 : 30, // Adjust top padding for status bar
        paddingBottom: 15, // Bottom padding for gradient area
        paddingHorizontal: 15,
        // Removed border properties as gradient provides background
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF', // White background for search bar
        borderRadius: 50, // Fully rounded corners
        paddingHorizontal: 15,
        height: 45, // Fixed height
        elevation: 3, // Android shadow
        shadowColor: '#000', // iOS shadow
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    searchIcon: {
        marginRight: 10, // Space between icon and input
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#333',
        // Removed paddingVertical, height is controlled by container
    },
    clearSearchButton: {
        padding: 5, // Make touch target slightly larger
        marginLeft: 5,
    },
    // --- Filter Styles (from OrderScreen) ---
    filterScroll: {
        marginTop: 15, // Space below search bar
        paddingBottom: 2, // Ensure buttons don't get cut off
    },
    filterButton: {
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20, // Pill shape
        backgroundColor: 'red', // Semi-transparent white
        borderWidth: 1,
        borderColor: '#FFF', // White border
        marginRight: 10, // Space between buttons
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterText: {
        fontSize: 14,
        color: '#FFF', // White text
        fontWeight: '500',
    },
    activeFilter: {
        backgroundColor: '#000', // Black background for active filter
        borderColor: '#000', // Black border
    },
    activeFilterText: {
        color: '#FFF', // White text remains
        fontWeight: 'bold',
    },
    // --- List Styles ---
    listContentContainer: {
        paddingBottom: 90, // Space for FAB
        flexGrow: 1, // Ensure empty component fills space if needed
    },
    listItemTouchable: {
        backgroundColor: '#FFFFFF', // Ensure touchable has background
    },
    listItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderBottomWidth: StyleSheet.hairlineWidth, // Thinner border
        borderBottomColor: '#E0E0E0', // Lighter border color
    },
    imageContainer: {
        marginRight: 15,
        width: 60, height: 60,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#F0F0F0', // Lighter placeholder background
        borderRadius: 8, // Slightly more rounded corners
        overflow: 'hidden',
        // borderWidth: StyleSheet.hairlineWidth, // Optional border for image
        // borderColor: '#D1D5DB',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    thumbnailPlaceholder: {
         width: '100%',
         height: '100%',
         justifyContent: 'center',
         alignItems: 'center',
         backgroundColor: '#F0F0F0', // Match container background
    },
    infoContainer: {
        flex: 1, // Take remaining space
        justifyContent: 'center',
        marginRight: 8, // Space before chevron
    },
    productName: {
        fontSize: 16,
        fontWeight: '600', // Slightly bolder
        color: '#222', // Darker text color
        marginBottom: 3,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 1,
        marginBottom: 4,
        flexWrap: 'wrap', // Allow wrapping if prices are long
    },
    productPrice: {
        fontSize: 14,
        color: '#555', // Slightly darker grey
    },
    strikethroughPrice: {
        textDecorationLine: 'line-through',
        color: '#999', // Lighter grey for strikethrough
        marginRight: 8, // More space after strikethrough
        fontSize: 13,
    },
    discountedPrice: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#E53935', // Use a red color for discounted price
    },
    productDescription: {
        fontSize: 13,
        color: '#777', // Standard grey for description
        marginTop: 3,
        marginBottom: 4,
    },
    bnplIndicatorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        alignSelf: 'flex-start', // Keep left aligned
        backgroundColor: 'rgba(0, 86, 179, 0.1)', // Slightly more subtle background
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 3,
    },
    bnplIcon: {
        marginRight: 4,
    },
    bnplIndicatorText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#0056b3', // Match icon color
    },
    chevronIcon: {
        // marginLeft: 'auto', // Implicit due to infoContainer flex: 1
        color: '#B0BEC5', // Keep chevron color
    },
    // --- Swipe Delete Styles ---
    deleteButtonContainer: {
        backgroundColor: '#FF3B30', // Standard iOS delete red
        justifyContent: 'center',
        alignItems: 'flex-end', // Align icon to the right
        width: 85, // Width of the swipe area
    },
    deleteButton: {
        // flex: 1, // Not needed if aligning content
        paddingHorizontal: 25, // Padding to position icon correctly
        height: '100%', // Fill height
        justifyContent: 'center', // Center icon vertically
    },
    // --- Empty List Styles ---
    emptyListContainer: {
        flex: 1, // Take up available space
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
        marginTop: height * 0.1, // Push down slightly
    },
    emptyListText: {
        fontSize: 17, // Slightly smaller
        color: "#666", // Darker grey
        textAlign: "center",
        marginTop: 15,
        fontWeight: '500',
    },
    emptyListSubText: {
        fontSize: 14,
        color: "#999",
        textAlign: "center",
        marginTop: 8,
    },
    // --- FAB Style ---
    fab: {
        position: 'absolute',
        margin: 16,
        right: 10,
        bottom: 20,
        backgroundColor: '#FF0000', // Match header color
        elevation: 6, // Android shadow
        shadowColor: '#000', // iOS shadow
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
});