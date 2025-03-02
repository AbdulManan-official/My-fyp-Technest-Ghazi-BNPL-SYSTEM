import React, { useState, useMemo, useEffect } from "react";
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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "react-native-vector-icons/FontAwesome";

const { width } = Dimensions.get("window");

const categories = [
  { id: "1", name: "All Products" },
  { id: "2", name: "Trending" },
  { id: "3", name: "Electronics" },
  { id: "4", name: "Fashion" },
  { id: "5", name: "Home" },
  { id: "6", name: "Sports" },
  { id: "7", name: "Books" },
];

const products = [
  { id: "1", name: "Smartphone", category: "Electronics", price: "$699", image: "https://via.placeholder.com/150" },
  { id: "2", name: "Sneakers", category: "Fashion", price: "$99", image: "https://via.placeholder.com/150" },
  { id: "3", name: "Sofa", category: "Home", price: "$499", image: "https://via.placeholder.com/150" },
  { id: "4", name: "Football", category: "Sports", price: "$29", image: "https://via.placeholder.com/150" },
  { id: "5", name: "Novel", category: "Books", price: "$19", image: "https://via.placeholder.com/150" },
  { id: "6", name: "Laptop", category: "Electronics", price: "$1200", image: "https://via.placeholder.com/150" },
  { id: "7", name: "T-shirt", category: "Fashion", price: "$25", image: "https://via.placeholder.com/150" },
  { id: "8", name: "Dining Table", category: "Home", price: "$350", image: "https://via.placeholder.com/150" },
  { id: "9", name: "Basketball", category: "Sports", price: "$19", image: "https://via.placeholder.com/150" },
  { id: "10", name: "Cookbook", category: "Books", price: "$15", image: "https://via.placeholder.com/150" },
  { id: "11", name: "Headphones", category: "Electronics", price: "$199", image: "https://via.placeholder.com/150" },
  { id: "12", name: "Jacket", category: "Fashion", price: "$75", image: "https://via.placeholder.com/150" },
  { id: "13", name: "Washing Machine", category: "Home", price: "$450", image: "https://via.placeholder.com/150" },
  { id: "14", name: "Tennis Racket", category: "Sports", price: "$50", image: "https://via.placeholder.com/150" },
  { id: "15", name: "Self-Help Book", category: "Books", price: "$12", image: "https://via.placeholder.com/150" },
];

export default function SearchScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("All Products");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, [searchQuery, filter]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (filter === "All Products") return matchesSearch;
      if (filter === "Trending") return matchesSearch;
      return matchesSearch && product.category === filter;
    });
  }, [searchQuery, filter]);

  const handleProductClick = (productId) => {
    // Navigate to product detail screen, pass the product ID or full product data
    navigation.navigate('ProductDetails', { productId });
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["red", "#FF0000"]} style={styles.gradientBackground}>
        <View style={styles.searchBar}>
          <Icon name="search" size={20} color="#FFFFFF" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Search products..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Icon name="times" size={20} color="#FFFFFF" style={styles.icon} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollContainer}>
          {categories.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.filterButton, filter === item.name && styles.selectedFilter]}
              onPress={() => setFilter(item.name)}
            >
              <Text style={[styles.filterText, filter === item.name && styles.selectedFilterText]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#FF0000" />
          <Text style={styles.loadingText}>Loading Products...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          numColumns={2}  // Grid layout with 2 columns
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => handleProductClick(item.id)} style={styles.productCard}>
              <Image source={{ uri: item.image }} style={styles.productImage} />
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productPrice}>{item.price}</Text>
                {/* Example of BNPL Badge */}
                <View style={styles.bnplBadge}>
                  <Text style={styles.bnplText}>Buy Now, Pay Later</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  gradientBackground: { paddingTop: 10, paddingBottom: 12, paddingHorizontal: 15 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 50,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: "#FFFFFF",
    paddingLeft: 10,
  },
  icon: { paddingHorizontal: 10, color: "red" },
  filterScrollContainer: { marginTop: 10 },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 20,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#FF0000",
    marginRight: 10,
  },
  selectedFilter: { backgroundColor: "black" },
  filterText: { fontSize: 14, color: "#FF0000" },
  selectedFilterText: { color: "#FFF" },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, fontSize: 16 },
  productCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    margin: 12,
    flex: 1,
    alignItems: "center",
    elevation: 3,
  },
  productImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    resizeMode: "contain", // Ensure image scales properly
  },
  productInfo: { alignItems: "center" },
  productName: { marginTop: 5, fontSize: 14, textAlign: "center", fontWeight: "bold" },
  productPrice: { fontSize: 14, color: "#007BFF", fontWeight: "bold", marginTop: 5 },
  bnplBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0F7FA",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginTop: 8,
  },
  bnplText: {
    color: "#00796B",
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 5,
  },
  listContent: { paddingBottom: 20 },
});
