import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, TextInput, StyleSheet, TouchableOpacity, Dimensions, Modal, ActivityIndicator, RefreshControl } from 'react-native';
import { FAB } from 'react-native-paper';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import UploadProductComponent from './../../Components/UploadProductComponent'; 

const { width } = Dimensions.get('window');

export default function ProductScreen() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [categories, setCategories] = useState([]);
  const [BNPLPlans, setBNPLPlans] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null); // For editing a product
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true); // Loader state to show until data is fetched
  const [hasFetched, setHasFetched] = useState(false); // State to track if data has been fetched

  // Fetch products in real-time
  const fetchData = async () => {
    const productRef = collection(db, 'Products');
    const q = query(productRef, orderBy('name'), limit(10)); // Fetch the first 10 products
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedProducts = [];
      snapshot.forEach((docSnap) => {
        fetchedProducts.push({ id: docSnap.id, ...docSnap.data() });
      });
      setProducts(fetchedProducts);
      setFilteredProducts(fetchedProducts);
      setLoading(false); // Stop loader once data is fetched
      setHasFetched(true); // Mark data as fetched
    });
    return unsubscribe; // Return unsubscribe function to stop real-time updates if needed
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle search query
  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query) {
      const filtered = products.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  };

  // Open modal to add a new product
  const openProductForm = () => {
    setSelectedProduct(null); // Clear selected product for new product
    setModalVisible(true);
  };

  // Open modal to edit an existing product
  const openEditProductForm = (product) => {
    setSelectedProduct(product); // Set selected product for editing
    setModalVisible(true);
  };

  // Close modal
  const closeProductForm = () => {
    setModalVisible(false);
  };

  const handleProductSave = async (productData) => {
    try {
      if (selectedProduct) {
        // Update product if it's in edit mode
        await updateDoc(doc(db, 'Products', selectedProduct.id), productData);
      } else {
        // Add new product if it's in create mode
        await addDoc(collection(db, 'Products'), productData);
      }
      fetchData(); // Fetch updated products list
      closeProductForm();
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleProductDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'Products', id));
      fetchData(); // Refresh the product list
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const renderProduct = ({ item }) => (
    <View style={styles.productItem}>
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productPrice}>${item.discountedPrice}</Text>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity onPress={() => openEditProductForm(item)} style={styles.editBtn}>
          <Text>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleProductDelete(item.id)} style={styles.deleteBtn}>
          <Text>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          value={searchQuery}
          onChangeText={handleSearch}
        />
      </View>

      {/* Loader */}
      {loading && !hasFetched && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#FF0000" />
        </View>
      )}

      {/* Product List */}
      {!loading && filteredProducts.length > 0 ? (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          renderItem={renderProduct}
          refreshControl={<RefreshControl refreshing={false} onRefresh={fetchData} />}
          showsVerticalScrollIndicator={false} // Hide scroll indicator
        />
      ) : !loading && !filteredProducts.length ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No products found</Text>
        </View>
      ) : null}

      {/* Add Button */}
      <FAB
        style={styles.fab}
        icon="plus"
        onPress={openProductForm}
      />

      {/* Full-Screen Modal for Product Upload Form */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false} // Makes the modal take up the full screen
        onRequestClose={closeProductForm} // Close the modal when pressing back button
      >
        <View style={styles.modalContainer}>
          <UploadProductComponent
            visible={modalVisible}
            onDismiss={closeProductForm}
            onSave={handleProductSave}
            categories={categories}
            BNPLPlans={BNPLPlans}
            product={selectedProduct} // Pass selected product for editing
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
    paddingTop: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 25,
    marginHorizontal: 15,
    paddingHorizontal: 15,
    paddingVertical: 5,
    elevation: 3,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 1,
    width: '100%', // Ensure it takes up the full width
    marginHorizontal: 0, // Remove any horizontal margin
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0055a5',
  },
  productPrice: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 10,
  },
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 16,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF0000',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
  },
});
