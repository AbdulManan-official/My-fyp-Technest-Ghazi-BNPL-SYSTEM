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
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

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
  { id: "1", name: "Smartphone", category: "Electronics", originalPrice: "$799", discountedPrice: "$699", image: "https://via.placeholder.com/150" },
  { id: "2", name: "Sneakers", category: "Fashion", originalPrice: "$120", discountedPrice: "$99", image: "https://via.placeholder.com/150" },
  { id: "3", name: "Sofa", category: "Home", originalPrice: "$550", discountedPrice: "$499", image: "https://via.placeholder.com/150" },
  { id: "4", name: "Laptop", category: "Electronics", originalPrice: "$1500", discountedPrice: "$1299", image: "https://via.placeholder.com/150" },
  { id: "5", name: "Jacket", category: "Fashion", originalPrice: "$80", discountedPrice: "$65", image: "https://via.placeholder.com/150" },
  { id: "6", name: "Smartwatch", category: "Electronics", originalPrice: "$250", discountedPrice: "$199", image: "https://via.placeholder.com/150" },
  { id: "7", name: "Gaming Mouse", category: "Electronics", originalPrice: "$70", discountedPrice: "$55", image: "https://via.placeholder.com/150" },
  { id: "8", name: "Bluetooth Speaker", category: "Electronics", originalPrice: "$120", discountedPrice: "$99", image: "https://via.placeholder.com/150" },
  { id: "9", name: "Desk Chair", category: "Home", originalPrice: "$220", discountedPrice: "$180", image: "https://via.placeholder.com/150" },
  { id: "10", name: "Cookware Set", category: "Home", originalPrice: "$350", discountedPrice: "$299", image: "https://via.placeholder.com/150" },
  { id: "11", name: "Tennis Racket", category: "Sports", originalPrice: "$150", discountedPrice: "$120", image: "https://via.placeholder.com/150" },
  { id: "12", name: "Basketball", category: "Sports", originalPrice: "$40", discountedPrice: "$29", image: "https://via.placeholder.com/150" },
];


export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("All Products");
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

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
      return matchesSearch && product.category === filter;
    });
  }, [searchQuery, filter]);

  const renderProductCard = ({ item }) => (
    <TouchableOpacity 
      style={styles.productCard}
      onPress={() => navigation.navigate('ProductDetails', { product: item })} 
    >
      <Image source={{ uri: item.image }} style={styles.productImage} />
      <Text style={styles.productName}>{item.name}</Text>
      <View style={styles.priceContainer}>
        <Text style={styles.originalPrice}>{item.originalPrice}</Text>
        <Text style={styles.discountedPrice}>{item.discountedPrice}</Text>
      </View>
      <View style={styles.bnplBadge}>
        <MaterialIcons name="verified" size={16} color="#00796B" />
        <Text style={styles.bnplText}>BNPL Available</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#FF0000", "red"]} style={styles.gradientBackground}>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.input}
            placeholder="Search products..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
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
          numColumns={2}
          renderItem={renderProductCard}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  gradientBackground: { padding: 10 },
  searchBar: { flexDirection: "row", backgroundColor: "white", borderRadius: 50, padding: 8 },
  input: { flex: 1, height: 40, fontSize: 14, color: "black", paddingLeft: 10 },
  filterScrollContainer: { marginTop: 10 },
  filterButton: { padding: 6, borderRadius: 20, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#FF0000", marginRight: 10 },
  selectedFilter: { backgroundColor: "black" },
  filterText: { fontSize: 14, color: "#FF0000" },
  selectedFilterText: { color: "#FFF" },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, fontSize: 16 },
  productCard: { backgroundColor: "#fff", borderRadius: 10, padding: 10, margin: 8, flex: 1, alignItems: "center", elevation: 3 },
  productImage: { width: 120, height: 120, borderRadius: 8, resizeMode: "contain" },
  productName: { marginTop: 5, fontSize: 14, textAlign: "center", fontWeight: "bold" },
  priceContainer: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  originalPrice: { fontSize: 12, color: "#A0A0A0", textDecorationLine: "line-through", marginRight: 5 },
  discountedPrice: { fontSize: 14, color: "#FF7300", fontWeight: "bold" },
  bnplBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#E0F7FA", padding: 6, borderRadius: 5, marginTop: 8 },
  bnplText: { color: "#00796B", fontSize: 12, fontWeight: "bold", marginLeft: 5 },
  listContent: { paddingBottom: 20 },
});
