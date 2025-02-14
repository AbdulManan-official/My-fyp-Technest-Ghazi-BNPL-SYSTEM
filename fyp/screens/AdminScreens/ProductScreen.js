import React, { useState } from "react";
import { View, FlatList, StyleSheet, Image, TouchableOpacity, Alert } from "react-native";
import { Card, Text, Button, TextInput, Modal, Portal, Provider } from "react-native-paper";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import * as ImagePicker from "expo-image-picker";

export default function ProductScreen() {
  const [products, setProducts] = useState([
    { id: "1", name: "Smartphone", price: "$699", image: "https://via.placeholder.com/150" },
    { id: "2", name: "Laptop", price: "$999", image: "https://via.placeholder.com/150" },
    { id: "3", name: "Headphones", price: "$199", image: "https://via.placeholder.com/150" },
  ]);

  const [visible, setVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductImage, setNewProductImage] = useState(null);

  const showModal = (product) => {
    setSelectedProduct(product);
    setNewProductName(product?.name || "");
    setNewProductPrice(product?.price || "");
    setNewProductImage(product?.image || null);
    setVisible(true);
  };

  const hideModal = () => setVisible(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setNewProductImage(result.assets[0].uri);
    }
  };

  const handleSave = () => {
    if (selectedProduct) {
      // Edit product
      setProducts((prevProducts) =>
        prevProducts.map((p) =>
          p.id === selectedProduct.id ? { ...p, name: newProductName, price: newProductPrice, image: newProductImage } : p
        )
      );
    } else {
      // Add new product
      const newProduct = {
        id: Math.random().toString(),
        name: newProductName,
        price: newProductPrice,
        image: newProductImage || "https://via.placeholder.com/150",
      };
      setProducts([...products, newProduct]);
    }
    hideModal();
  };

  const handleDelete = (id) => {
    Alert.alert("Delete Product", "Are you sure you want to delete this product?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", onPress: () => setProducts(products.filter((p) => p.id !== id)), style: "destructive" },
    ]);
  };

  const renderProduct = ({ item }) => (
    <Card style={styles.productCard}>
      <Image source={{ uri: item.image }} style={styles.productImage} />
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productPrice}>{item.price}</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity onPress={() => showModal(item)}>
            <Icon name="pencil" size={24} color="blue" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id)}>
            <Icon name="trash-can" size={24} color="red" />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  return (
    <Provider>
      <View style={styles.container}>
        <Text style={styles.header}>Product Management</Text>

        {/* Product List */}
        <FlatList data={products} keyExtractor={(item) => item.id} renderItem={renderProduct} />

        {/* Add Product Button */}
        <Button mode="contained" onPress={() => showModal(null)} style={styles.addButton}>
          Add New Product
        </Button>

        {/* Modal for Adding/Editing Product */}
        <Portal>
          <Modal visible={visible} onDismiss={hideModal} contentContainerStyle={styles.modal}>
            <Text style={styles.modalTitle}>{selectedProduct ? "Edit Product" : "Add Product"}</Text>

            <TextInput label="Product Name" value={newProductName} onChangeText={setNewProductName} style={styles.input} />
            <TextInput label="Price" value={newProductPrice} onChangeText={setNewProductPrice} style={styles.input} />

            <Button icon="camera" mode="outlined" onPress={pickImage} style={styles.imageButton}>
              {newProductImage ? "Change Image" : "Upload Image"}
            </Button>

            {newProductImage && <Image source={{ uri: newProductImage }} style={styles.previewImage} />}

            <Button mode="contained" onPress={handleSave} style={styles.saveButton}>
              Save
            </Button>
          </Modal>
        </Portal>
      </View>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: "#fff",
  },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  productCard: {
    flexDirection: "row",
    padding: 10,
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: "#f9f9f9",
    elevation: 3,
    alignItems: "center",
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    resizeMode: "contain",
  },
  productInfo: {
    flex: 1,
    marginLeft: 10,
  },
  productName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  productPrice: {
    fontSize: 14,
    color: "#555",
  },
  actionButtons: {
    flexDirection: "row",
    marginTop: 5,
  },
  addButton: {
    marginTop: 15,
  },
  modal: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    marginHorizontal: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  input: {
    marginBottom: 10,
  },
  imageButton: {
    marginTop: 10,
  },
  previewImage: {
    width: "100%",
    height: 150,
    borderRadius: 10,
    marginTop: 10,
    resizeMode: "contain",
  },
  saveButton: {
    marginTop: 15,
  },
});

