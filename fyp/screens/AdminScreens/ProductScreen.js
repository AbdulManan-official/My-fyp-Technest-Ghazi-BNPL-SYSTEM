import React, { useEffect, useState, useCallback } from 'react';
import {
    View, FlatList, StyleSheet, Dimensions, Modal,
    ActivityIndicator, RefreshControl, Alert, Image, Text, TextInput, Platform,
    TouchableOpacity // <-- Added TouchableOpacity (Good practice, though not strictly needed if using IconButtons)
} from 'react-native';
import { FAB, IconButton, ActivityIndicator as PaperActivityIndicator } from 'react-native-paper';
import {
    collection, query, onSnapshot, orderBy, doc, addDoc, updateDoc,
    deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // <<<--- CHECK/ADJUST THIS PATH
import UploadProductComponent from '../../Components/UploadProductComponent'; // <<<--- CHECK/ADJUST THIS PATH
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width, height } = Dimensions.get('window');

export default function ProductScreen() {
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    // --- Step: Add state to track the product being edited (productToEdit) ---
    const [productToEdit, setProductToEdit] = useState(null); // null indicates Add mode, an object indicates Edit mode
    // --- End Step ---
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [hasFetchedOnce, setHasFetchedOnce] = useState(false);

    // Fetches products using Firestore real-time listener
    useEffect(() => {
        setLoading(true);
        setHasFetchedOnce(false);
        const productRef = collection(db, 'Products');
        const q = query(productRef, orderBy('name')); // Or order by another field like 'createdAt'

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedProducts = snapshot.docs.map((docSnap) => ({
                 id: docSnap.id, // Include the document ID
                 ...docSnap.data() // Spread the rest of the document data
            }));
            setProducts(fetchedProducts); // Update the main products list
            handleSearchFilter(searchQuery, fetchedProducts); // Apply current search filter
            setLoading(false);
            setRefreshing(false);
            setHasFetchedOnce(true);
        }, (error) => {
            console.error("Error fetching products: ", error);
            Alert.alert("Error", "Could not fetch products.");
            setLoading(false);
            setRefreshing(false);
            setHasFetchedOnce(true);
        });

        // Cleanup the listener when the component unmounts
        return () => unsubscribe();
         // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty array ensures this runs only on mount

    // Handles pull-to-refresh action
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        // Data is updated by the listener, so just set refreshing state.
        // It will be set back to false in the onSnapshot callback.
    }, []);

    // Filters the product list based on the search query
    const handleSearchFilter = useCallback((query, productList) => {
        const trimmedQuery = query?.trim()?.toLowerCase() ?? '';
        if (trimmedQuery && productList?.length > 0) {
            setFilteredProducts(
                productList.filter((p) =>
                    p?.name?.toLowerCase().includes(trimmedQuery) || // Search by name
                    p?.category?.toLowerCase().includes(trimmedQuery) // Example: Search by category (ensure it's searchable)
                )
            );
        } else {
            // If query is empty, show the full list
            setFilteredProducts(productList || []);
        }
    }, []); // No dependencies needed here

    // Updates search query state and triggers filtering
    const onSearchInputChange = (text) => {
        setSearchQuery(text);
        handleSearchFilter(text, products); // Filter the main products list
    };

    // Clears the search input and resets the filter
    const clearSearch = () => {
        setSearchQuery('');
        handleSearchFilter('', products);
    };

    // --- Step: Update openAddProductModal and closeProductModal to manage productToEdit ---
    // Opens the modal for adding a new product
    const openAddProductModal = () => {
        setProductToEdit(null); // Ensure productToEdit is null for Add mode
        setModalVisible(true);
    };

    // Closes the modal and resets the productToEdit state
    const closeProductModal = () => {
        setModalVisible(false);
        setProductToEdit(null); // Always reset editing state on close
    };
    // --- End Step ---

    // --- Step: Implement openEditProductModal to set this state and open the modal ---
    // Opens the modal for editing an existing product
    const openEditProductModal = (product) => {
        // Validate product data before proceeding
        if (!product?.id) {
             console.error("Error: Cannot edit invalid product data.", product);
             Alert.alert("Error", "Could not load product details for editing.");
             return;
        }
        setProductToEdit(product); // Set the specific product object to be edited
        setModalVisible(true);       // Open the modal
    };
    // --- End Step ---

    // --- Step: Enhance handleSaveProduct to differentiate between adding and updating ---
    // Handles saving data from UploadProductComponent (called via onSave prop)
    const handleSaveProduct = async (productDataFromChild) => {
        // Determine if updating based on presence of productToEdit
        const isUpdating = !!productToEdit;
        const operation = isUpdating ? 'update' : 'add';

        // Use data prepared by the child component
        const dataToSave = { ...productDataFromChild };
        // Ensure document ID isn't in the data payload itself
        if (dataToSave.id) {
            delete dataToSave.id;
        }

        // Add/Update timestamps managed by Firestore server
        dataToSave.lastUpdatedAt = serverTimestamp();
        if (!isUpdating) { // Add createdAt only for new documents
            dataToSave.createdAt = serverTimestamp();
        }

        try {
            if (isUpdating) {
                // Perform Firestore update operation
                if (!productToEdit?.id) { // Safety check
                   throw new Error("Update failed: Missing product ID.");
                }
                const productRef = doc(db, 'Products', productToEdit.id);
                await updateDoc(productRef, dataToSave);
                Alert.alert("Success", "Product updated successfully!");
            } else {
                // Perform Firestore add operation
                await addDoc(collection(db, 'Products'), dataToSave);
                Alert.alert("Success", "Product added successfully!");
            }
            closeProductModal(); // Close modal only on success
        } catch (error) {
            console.error(`Firestore ${operation} failed:`, error);
            Alert.alert(
                "Database Error",
                `Failed to ${operation} product. ${error.message || 'Please try again.'}`
            );
            // Keep modal open if save fails
        }
    };
    // --- End Step ---

    // Confirms before deleting a product
    const handleDeleteConfirmation = (id, name) => {
         if (!id) {
             Alert.alert("Error", "Invalid product ID provided.");
             return;
         }
         Alert.alert(
             "Confirm Delete",
             `Are you sure you want to delete "${name || 'this product'}"? This action cannot be undone.`,
             [
                 { text: "Cancel", style: "cancel" },
                 {
                   text: "Delete",
                   style: "destructive",
                   onPress: () => handleProductDelete(id) // Proceed with deletion
                 }
             ]
         );
    };

    // Deletes the product document from Firestore
    const handleProductDelete = async (id) => {
         if (!id) {
             Alert.alert("Error", "Could not delete product: Invalid ID.");
             return;
         }
         try {
             await deleteDoc(doc(db, 'Products', id));
             Alert.alert("Success", "Product deleted.");
             // List updates automatically via onSnapshot listener
         } catch (error) {
             console.error(`Delete failed for product ${id}:`, error);
             Alert.alert("Error", `Failed to delete product: ${error.message || 'Please try again.'}`);
         }
    };

    // --- Step: Modify renderProduct to include an "Edit" button/icon ---
    // Renders a single product item in the FlatList
    const renderProduct = useCallback(({ item }) => {
         const imageUrl = item?.media?.images?.[0] || null;
         const originalPrice = item?.originalPrice;
         const discountedPrice = item?.discountedPrice;
         const hasDiscount = typeof discountedPrice === 'number' && typeof originalPrice === 'number' && discountedPrice < originalPrice;
         const displayOriginalPrice = typeof originalPrice === 'number' ? `PKR ${originalPrice.toFixed(2)}` : 'N/A';
         const displayDiscountedPrice = typeof discountedPrice === 'number' ? `PKR ${discountedPrice.toFixed(2)}` : '';

         return (
             <View style={styles.listItem}>
                 {/* Product Image */}
                 <View style={styles.imageContainer}>
                     {imageUrl ? (
                         <Image source={{ uri: imageUrl }} style={styles.thumbnail} resizeMode="cover" onError={(e) => console.warn(`Img load err: ${item.id}`)} />
                     ) : (
                         <View style={styles.thumbnailPlaceholder}><Icon name="image-off-outline" size={24} color="#ccc" /></View>
                     )}
                 </View>
                 {/* Product Info (Name, Price) */}
                 <View style={styles.infoContainer}>
                     <Text style={styles.productName} numberOfLines={2}>{item?.name || 'Unnamed Product'}</Text>
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
                 </View>
                 {/* Action Buttons Container */}
                 <View style={styles.actionsContainer}>
                    {/* Edit Button: Calls openEditProductModal with the item data */}
                     <IconButton
                        icon="pencil-outline"
                        color="black"
                        size={20}
                        onPress={() => openEditProductModal(item)} // Pass item to edit function
                        style={styles.actionButton}
                        accessibilityLabel="Edit Product"
                     />
                    {/* Delete Button */}
                     <IconButton
                        icon="delete-outline"
                        color="#dc3545"
                        size={20}
                        onPress={() => handleDeleteConfirmation(item.id, item.name)}
                        style={styles.actionButton}
                        accessibilityLabel="Delete Product"
                     />
                 </View>
             </View>
         );
        // Dependencies for useCallback ensure functions have latest scope if needed
    }, [openEditProductModal, handleDeleteConfirmation]); // Include functions called inside
    // --- End Step ---

    // Renders content when the FlatList is empty or loading
    const renderListEmptyComponent = () => {
        if (loading && !hasFetchedOnce) {
            return ( <View style={styles.emptyListContainer}><PaperActivityIndicator size="large" color="#FF0000" /><Text style={styles.emptyListText}>Loading Products...</Text></View> );
        }
        if (hasFetchedOnce) {
            if (searchQuery.trim() && filteredProducts.length === 0) {
                return ( <View style={styles.emptyListContainer}><Icon name="magnify-close" size={40} color="#ccc" /><Text style={styles.emptyListText}>No products match "{searchQuery}"</Text></View> );
            }
            if (!searchQuery.trim() && products.length === 0) {
                return ( <View style={styles.emptyListContainer}><Icon name="package-variant-closed" size={40} color="#ccc" /><Text style={styles.emptyListText}>No products added yet.</Text><Text style={styles.emptyListSubText}>Tap '+' to add your first product!</Text></View> );
            }
        }
        return null; // Return null if list has data
    };

    // Main layout of the screen
    return (
        <View style={styles.container}>
            {/* Search Header */}
            <View style={styles.header}>
                 <View style={styles.searchBarContainer}>
                     <Icon name="magnify" size={18} color="#555" style={styles.searchIcon} />
                     <TextInput
                         style={styles.searchInput}
                         placeholder="Search products..."
                         value={searchQuery}
                         onChangeText={onSearchInputChange}
                         returnKeyType="search"
                         clearButtonMode="while-editing"
                         placeholderTextColor="#888"
                     />
                     {searchQuery.length > 0 && (
                        <IconButton
                            icon="close-circle"
                            size={18}
                            color="#555"
                            onPress={clearSearch}
                            style={styles.clearSearchButton}
                            accessibilityLabel="Clear search query"
                        />
                     )}
                 </View>
            </View>

            {/* List of Products */}
            <FlatList
                data={filteredProducts} // Use the filtered list for display
                renderItem={renderProduct} // Use the updated render function
                keyExtractor={(item) => item.id} // Unique key for each item
                contentContainerStyle={styles.listContentContainer} // Styling for list container
                ListEmptyComponent={renderListEmptyComponent} // Component for empty/loading state
                ItemSeparatorComponent={() => <View style={styles.separator} />} // Separator line
                showsVerticalScrollIndicator={false}
                refreshControl={ // Pull-to-refresh
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={["#FF0000"]}
                        tintColor={"#FF0000"}
                    />
                }
                // Optional performance props
                removeClippedSubviews={Platform.OS === 'android'}
                initialNumToRender={10}
                maxToRenderPerBatch={5}
                windowSize={11}
            />

            {/* Add Product Button */}
            <FAB
                style={styles.fab}
                icon="plus"
                color="#FFFFFF"
                onPress={openAddProductModal} // Opens modal in Add mode
                accessibilityLabel="Add New Product"
            />

            {/* Modal for Add/Edit Form */}
            {/* Render Modal only when modalVisible is true */}
            {modalVisible && (
                 <Modal
                     visible={modalVisible}
                     animationType="slide"
                     onRequestClose={closeProductModal} // Handles Android back button
                 >
                     {/* --- Step: Pass productToEdit as a prop (productForEdit) --- */}
                     <UploadProductComponent
                         visible={modalVisible} // Pass visibility status
                         onDismiss={closeProductModal} // Pass function to close modal
                         onSave={handleSaveProduct} // Pass function to save data
                         productForEdit={productToEdit} // Pass null for Add, product object for Edit
                     />
                     {/* --- End Step --- */}
                 </Modal>
            )}
        </View>
    );
}

// Stylesheet (Remains the same)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: { backgroundColor: '#FFFFFF', paddingTop: Platform.OS === 'android' ? 10 : 10, paddingBottom: 10, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#EEEEEE', zIndex: 1, },
    searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 30, paddingHorizontal: 15, height: 45, },
    searchIcon: { marginRight: 10, color: '#555555' },
    searchInput: { flex: 1, fontSize: 15, color: '#333333', paddingVertical: Platform.OS === 'ios' ? 10 : 5, },
    clearSearchButton: { margin: -8, },
    listContentContainer: { paddingBottom: 90, flexGrow: 1, },
    separator: { height: 1, backgroundColor: '#EAEAEA', marginLeft: 85, },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 15,
        backgroundColor: '#FFFFFF',
    },
    imageContainer: {
        marginRight: 15,
        width: 55, height: 55,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#F5F5F5', borderRadius: 4,
        overflow: 'hidden',
    },
    thumbnail: { width: '100%', height: '100%', },
    thumbnailPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#E0E0E0', },
    infoContainer: {
        flex: 1,
        justifyContent: 'center',
        marginRight: 8,
    },
    productName: { fontSize: 15, fontWeight: '600', color: '#333333', marginBottom: 4, },
    priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, flexWrap: 'wrap', },
    productPrice: { fontSize: 13, color: '#666666', },
    strikethroughPrice: { textDecorationLine: 'line-through', color: '#999999', marginRight: 8, },
    discountedPrice: { fontSize: 14, fontWeight: 'bold', color: '#28a745', },
    productCategory: { fontSize: 12, color: '#888888', marginTop: 3 },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        marginHorizontal: -5,
        borderRadius: 20,
    },
    emptyListContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, marginTop: height * 0.1, },
    emptyListText: { fontSize: 18, color: "#777777", textAlign: "center", marginTop: 15, fontWeight: '500', },
    emptyListSubText: { fontSize: 14, color: "#999999", textAlign: "center", marginTop: 8, },
    fab: { position: 'absolute', margin: 16, right: 10, bottom: 20, backgroundColor: '#FF0000', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, },
});