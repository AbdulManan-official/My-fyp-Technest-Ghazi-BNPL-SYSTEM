import React, { useState } from "react";
import { View, FlatList, StyleSheet, ScrollView, Image, TouchableOpacity } from "react-native";
import { Card, TextInput, Text } from "react-native-paper";
import Icon from "react-native-vector-icons/Ionicons";

const categories = [
  { id: "1", name: "📱 Electronics" },
  { id: "2", name: "👕 Fashion" },
  { id: "3", name: "🏠 Home" },
  { id: "4", name: "⚽ Sports" },
  { id: "5", name: "📚 Books" },
];

const products = [
  { id: "1", name: "Smartphone", category: "Electronics", price: "$699", image: "https://via.placeholder.com/150" },
  { id: "2", name: "Sneakers", category: "Fashion", price: "$99", image: "https://via.placeholder.com/150" },
  { id: "3", name: "Sofa", category: "Home", price: "$499", image: "https://via.placeholder.com/150" },
  { id: "4", name: "Football", category: "Sports", price: "$29", image: "https://via.placeholder.com/150" },
  { id: "5", name: "Novel", category: "Books", price: "$19", image: "https://via.placeholder.com/150" },
];

export default function SearchScreen() {
  const [search, setSearch] = useState("");

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <TextInput
        mode="outlined"
        style={styles.searchBar}
        placeholder="Search products..."
        value={search}
        onChangeText={setSearch}
        left={<TextInput.Icon icon={() => <Icon name="search" size={20} color="gray" />} />}
      />

      {/* Categories */}
      <View style={styles.categoryContainer}>
        <FlatList
          horizontal
          data={categories}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.categoryButton}>
              <Text style={styles.categoryText}>{item.name}</Text>
            </TouchableOpacity>
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        />
      </View>

      {/* Product List */}
      <ScrollView contentContainerStyle={styles.productContainer}>
        {products.map((product) => (
          <Card key={product.id} style={styles.productCard}>
            <Image source={{ uri: product.image }} style={styles.productImage} />
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productPrice}>{product.price}</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: "#fff",
  },
  searchBar: {
    marginBottom: 15,
    borderRadius: 10,
    backgroundColor: "#f8f8f8",
  },
  categoryContainer: {
    marginBottom: 10,
  },
  categoryList: {
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  categoryButton: {
    backgroundColor: "#007bff",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 25,
    marginRight: 10,
    elevation: 3, // Adds shadow effect
    alignItems: "center",
    justifyContent: "center",
  },
  categoryText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  productContainer: {
    marginTop: 10,
    paddingBottom: 20,
  },
  productCard: {
    flexDirection: "row",
    marginBottom: 15,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    elevation: 3, // Adds shadow for a rich look
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    resizeMode: "contain",
  },
  productInfo: {
    marginLeft: 15,
  },
  productName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  productPrice: {
    fontSize: 16,
    color: "green",
    marginTop: 5,
  },
});
