import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    FlatList,
    StyleSheet,
    Dimensions,
    Modal,
    ActivityIndicator, // Using RN ActivityIndicator for general loading if needed
    RefreshControl,
    Alert,
    Image,
    Text,
    TextInput, // Using standard TextInput for search
    Platform,
} from 'react-native';
// Use IconButton for the clear button and list actions
// Use PaperActivityIndicator specifically for where Paper styles are preferred
import { FAB, IconButton, ActivityIndicator as PaperActivityIndicator } from 'react-native-paper';
import { collection, query, onSnapshot, orderBy, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig'; // <<<--- CHECK THIS PATH
import UploadProductComponent from './../../Components/UploadProductComponent'; // <<<--- CHECK THIS PATH
// Keep using MaterialCommunityIcons
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width, height } = Dimensions.get('window');

export default function ProductScreen() {
    // State Variables
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);

    // --- Data Fetching ---
    const fetchData = useCallback(() => {
        console.log("Setting up Firestore listener for 'Products'...");
        const productRef = collection(db, 'Products');
        const q = query(productRef, orderBy('name'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log(`Firestore snapshot received: ${snapshot.docs.length} documents.`);
            const fetchedProducts = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...docSnap.data(),
            }));

            setProducts(fetchedProducts);
            handleSearch(searchQuery, fetchedProducts);
            setLoading(false);
            setRefreshing(false);
            setHasFetched(true);
        }, (error) => {
            console.error("Error fetching products with onSnapshot: ", error);
            Alert.alert("Error", "Could not fetch products. Please check your connection or Firestore rules.");
            setLoading(false);
            setRefreshing(false);
            setHasFetched(true);
        });

        return unsubscribe;
    }, [searchQuery]);

    // --- Component Lifecycle ---
    useEffect(() => {
        setLoading(true);
        setHasFetched(false);
        const unsubscribe = fetchData();

        return () => {
            console.log("Cleaning up Firestore listener.");
            unsubscribe();
        };
    }, []); // Runs only on mount

    // --- Pull to Refresh ---
    const onRefresh = useCallback(() => {
        console.log("Pull to refresh triggered.");
        setRefreshing(true);
        // onSnapshot listener handles updates automatically
    }, []);

    // --- Search Logic ---
    const handleSearch = (query, currentProducts = products) => {
        setSearchQuery(query);
        if (query) {
            const lowerCaseQuery = query.toLowerCase();
            const filtered = currentProducts.filter((p) =>
                p.name?.toLowerCase().includes(lowerCaseQuery)
            );
            setFilteredProducts(filtered);
        } else {
            setFilteredProducts(currentProducts);
        }
    };

    const clearSearch = () => {
        setSearchQuery('');
        setFilteredProducts(products);
    };

    // --- Modal Control ---
    const openProductForm = () => {
        console.log("Opening modal for ADDING product.");
        setSelectedProduct(null);
        setModalVisible(true);
    };

    const openEditProductForm = (product) => {
        console.log(`--- Opening modal for EDITING Product ---`);
        setSelectedProduct(product);
        setModalVisible(true);
    };

    const closeProductForm = () => {
        console.log("Closing product modal.");
        setModalVisible(false);
        setSelectedProduct(null);
    };

    // --- CRUD Operations ---
    const handleProductSave = async (productData) => {
        const isUpdating = !!selectedProduct;  // Check if it's an update or a new product
        try {
            if (isUpdating) {
                // Update product logic
                const productRef = doc(db, 'Products', selectedProduct.id);
                await updateDoc(productRef, productData);
                Alert.alert("Success", "Product updated successfully!");
            } else {
                // Add new product logic
                await addDoc(collection(db, 'Products'), productData);
                Alert.alert("Success", "Product added successfully!");
            }
            // Refresh the products list after save
            fetchData();
        } catch (error) {
            Alert.alert("Error", `Failed to ${isUpdating ? 'update' : 'add'} product. ${error.message}`);
        }
    };

    const handleDeleteConfirmation = (id, name) => {
        if (!id) return;
        console.log(`Showing delete confirmation for product ID: ${id}, Name: ${name}`);
        Alert.alert(
            "Confirm Delete",
            `Are you sure you want to delete "${name || 'this product'}"? This action cannot be undone.`,
            [
                { text: "Cancel", style: "cancel", onPress: () => console.log("Deletion cancelled.") },
                { text: "Delete", style: "destructive", onPress: () => handleProductDelete(id) }
            ]
        );
    };

    const handleProductDelete = async (id) => {
         if (!id) return;
        console.log(`Attempting to delete product ID: ${id}`);
        try {
            await deleteDoc(doc(db, 'Products', id));
            Alert.alert("Success", "Product deleted successfully!");
        } catch (error) {
            console.error('Error deleting product:', error);
            Alert.alert("Error", `Failed to delete product. ${error.message}`);
        }
    };

    // --- Render Product Item ---
    const renderProduct = ({ item }) => {
        const imageUrl = item?.media?.images?.[0] || null;
        const originalPrice = item?.originalPrice;
        const discountedPrice = item?.discountedPrice;
        const hasDiscount = typeof discountedPrice === 'number' && typeof originalPrice === 'number' && discountedPrice < originalPrice;

        return (
            <View style={styles.listItem}>
                {/* Image Container */}
                <View style={styles.imageContainer}>
                    {imageUrl ? (
                        <Image
                            source={{ uri: imageUrl }}
                            style={styles.thumbnail}
                            resizeMode="cover"
                            onError={(e) => console.warn(`Image load error for product ${item.id}:`, e.nativeEvent.error)}
                         />
                    ) : (
                        <View style={styles.thumbnailPlaceholder}>
                             <Icon name="image-off-outline" size={24} color="#cccccc" />
                        </View>
                    )}
                </View>

                {/* Info Container */}
                <View style={styles.infoContainer}>
                    <Text style={styles.productName} numberOfLines={2}>{item?.name || 'Unnamed Product'}</Text>
                    <View style={styles.priceRow}>
                         <Text style={[styles.productPrice, hasDiscount && styles.strikethroughPrice]}>
                           PKR {typeof originalPrice === 'number' ? originalPrice.toFixed(2) : 'N/A'}
                         </Text>
                        {hasDiscount && (
                             <Text style={styles.discountedPrice}>
                                PKR {typeof discountedPrice === 'number' ? discountedPrice.toFixed(2) : ''}
                             </Text>
                         )}
                    </View>
                </View>

                {/* Actions Container */}
                <View style={styles.actionsContainer}>
                    <IconButton
                        icon="pencil-outline"
                        color="black"
                        size={18}
                        onPress={() => openEditProductForm(item)}
                        style={styles.actionButton}
                        accessibilityLabel="Edit product"
                    />
                    <IconButton
                        icon="delete-outline"
                        color="#dc3545"
                        size={18}
                        onPress={() => handleDeleteConfirmation(item.id, item.name)}
                        style={styles.actionButton}
                        accessibilityLabel="Delete product"
                    />
                </View>
            </View>
        );
    };

    // --- Render Empty List / Loading ---
    const renderListEmptyComponent = () => {
        if (loading && !hasFetched) {
            return (
                <View style={styles.emptyListContainer}>
                    <PaperActivityIndicator size="large" color="#FF0000" />
                    <Text style={styles.emptyListText}>Loading Products...</Text>
                </View>
            );
        }
        if (hasFetched) {
            if (searchQuery && filteredProducts.length === 0) {
                return (
                    <View style={styles.emptyListContainer}>
                        <Icon name="magnify-close" size={40} color="#CCCCCC" />
                        <Text style={styles.emptyListText}>No products match "{searchQuery}"</Text>
                    </View>
                );
            }
            if (!searchQuery && products.length === 0) {
                return (
                    <View style={styles.emptyListContainer}>
                        <Icon name="package-variant-closed" size={40} color="#CCCCCC" />
                        <Text style={styles.emptyListText}>No products found.</Text>
                        <Text style={styles.emptyListSubText}>Tap the '+' button to add one!</Text>
                    </View>
                );
            }
        }
        return null;
    };

    // --- Main Component Return JSX ---
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.searchBarContainer}>
                    <Icon name="magnify" size={18} color="black" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search products by name..."
                        placeholderTextColor="#999"
                        value={searchQuery}
                        onChangeText={handleSearch}
                        returnKeyType="search"
                        clearButtonMode="while-editing"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {searchQuery.length > 0 && (
                        <IconButton
                            icon="close-circle"
                            size={18}
                            color="black"
                            onPress={clearSearch}
                            style={styles.clearSearchButton}
                        />
                    )}
                </View>
            </View>

            {/* Product List */}
            <FlatList
                data={filteredProducts}
                keyExtractor={(item) => item.id}
                renderItem={renderProduct}
                contentContainerStyle={styles.listContentContainer}
                ListEmptyComponent={renderListEmptyComponent}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={["#FF0000"]}
                        tintColor={"#FF0000"}
                    />
                }
            />

            {/* FAB */}
            <FAB
                style={styles.fab}
                icon="plus"
                color="#FFFFFF"
                onPress={openProductForm}
                accessibilityLabel="Add new product"
            />

            {/* Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                onRequestClose={closeProductForm}
                presentationStyle="pageSheet"
            >
                <UploadProductComponent
                    visible={modalVisible}
                    onDismiss={closeProductForm}
                    onSave={handleProductSave}  // Pass the save function to UploadProductComponent
                    product={selectedProduct}   // Pass the selected product (for editing) or null (for new product)
                />
            </Modal>
        </View>
    );
}

// --- Stylesheet ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: {
        backgroundColor: '#FFFFFF',
        paddingTop: Platform.OS === 'android' ? 10 : 10,
        paddingBottom: 10,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',
        zIndex: 1,
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0F0F0',
        borderRadius: 30,
        paddingHorizontal: 15,
        height: 45,
    },
    searchIcon: { marginRight: 10, color: '#555555' },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#333333',
        paddingVertical: Platform.OS === 'ios' ? 10 : 5,
    },
    clearSearchButton: { margin: -8, },
    listContentContainer: { paddingBottom: 90, flexGrow: 1, },
    separator: { height: 1, backgroundColor: '#E0E0E0', marginLeft: 85, },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 15,
        backgroundColor: '#FFFFFF',
    },
    imageContainer: {
        marginRight: 15,
        width: 55,
        height: 55,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 4,
        overflow: 'hidden',
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
    },
    infoContainer: { flex: 1, justifyContent: 'center', },
    productName: { fontSize: 15, fontWeight: '600', color: '#333333', marginBottom: 4, },
    priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, },
    productPrice: { fontSize: 13, color: '#666666', },
    strikethroughPrice: { textDecorationLine: 'line-through', color: '#999999', marginRight: 8, },
    discountedPrice: { fontSize: 14, fontWeight: 'bold', color: '#28a745', },
    actionsContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: 10, },
    actionButton: { margin: -5, padding: 5, },
    emptyListContainer: {
        flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30,
        marginTop: height * 0.1,
    },
    emptyListText: { fontSize: 18, color: "#777777", textAlign: "center", marginTop: 15, fontWeight: '500', },
    emptyListSubText: { fontSize: 14, color: "#999999", textAlign: "center", marginTop: 8, },
    fab: {
        position: 'absolute', margin: 16, right: 10, bottom: 20, backgroundColor: '#FF0000',
        elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4,
    },
});
