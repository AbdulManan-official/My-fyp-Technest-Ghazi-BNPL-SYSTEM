import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

// Dummy Data for Promotional Banners
const promotionalBanners = [
  { id: '1', image: 'https://via.placeholder.com/350x150/FF5733/FFFFFF?text=Big+Sale+50%25+OFF' },
  { id: '2', image: 'https://via.placeholder.com/350x150/33FF57/FFFFFF?text=New+Arrivals' },
  { id: '3', image: 'https://via.placeholder.com/350x150/3357FF/FFFFFF?text=Limited+Time+Offer' },
];

// Dummy Data for Products & Categories
const recommendedProducts = [
  {
    id: '1',
    name: 'Wireless Headphones',
    price: '$59.99',
    image: 'https://via.placeholder.com/150/0000FF/808080?text=Headphones',
    bnpl: true,
  },
  {
    id: '2',
    name: 'Smartwatch Series 7',
    price: '$249.99',
    image: 'https://via.placeholder.com/150/FF0000/FFFFFF?text=Smartwatch',
    bnpl: false,
  },
  {
    id: '3',
    name: 'Gaming Laptop',
    price: '$1,499.99',
    image: 'https://via.placeholder.com/150/008000/FFFFFF?text=Laptop',
    bnpl: true,
  },
  {
    id: '4',
    name: 'Wireless Earbuds',
    price: '$79.99',
    image: 'https://via.placeholder.com/150/FFA500/FFFFFF?text=Earbuds',
    bnpl: false,
  },
];

const trendingCategories = [
  { id: '1', name: 'Electronics', image: 'https://via.placeholder.com/100/0000FF/808080?text=Electronics' },
  { id: '2', name: 'Fashion', image: 'https://via.placeholder.com/100/FF0000/FFFFFF?text=Fashion' },
  { id: '3', name: 'Home Appliances', image: 'https://via.placeholder.com/100/008000/FFFFFF?text=Home' },
];

const HomeScreen = () => {
  return (
    <ScrollView style={styles.container}>
      {/* Promotional Banner Section */}
      <FlatList
        horizontal
        data={promotionalBanners}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Image source={{ uri: item.image }} style={styles.bannerImage} />
        )}
        showsHorizontalScrollIndicator={false}
        pagingEnabled
      />

      {/* Welcome Header */}
      <Text style={styles.header}>Promotional banner</Text>

      {/* Trending Categories Section */}
      <Text style={styles.sectionTitle}>🔥 Trending Categories</Text>
      <FlatList
        horizontal
        data={trendingCategories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.categoryCard}>
            <Image source={{ uri: item.image }} style={styles.categoryImage} />
            <Text style={styles.categoryText}>{item.name}</Text>
          </TouchableOpacity>
        )}
        showsHorizontalScrollIndicator={false}
      />

      {/* Recommended Products Section */}
      <Text style={styles.sectionTitle}>🌟 Recommended for You</Text>
      <FlatList
        data={recommendedProducts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.productCard}>
            <Image source={{ uri: item.image }} style={styles.productImage} />
            <Text style={styles.productName}>{item.name}</Text>
            <Text style={styles.productPrice}>{item.price}</Text>
            {item.bnpl && <Text style={styles.bnplText}>Buy Now, Pay Later Available</Text>}
          </TouchableOpacity>
        )}
        numColumns={2}
        showsVerticalScrollIndicator={false}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingTop: 10,
  },
  bannerImage: {
    width: 350,
    height: 150,
    borderRadius: 10,
    marginHorizontal: 10,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 10,
    marginLeft: 15,
  },
  categoryCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    marginRight: 10,
    padding: 10,
    alignItems: 'center',
    elevation: 3,
  },
  categoryImage: {
    width: 80,
    height: 80,
    borderRadius: 50,
    marginBottom: 5,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  productCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 10,
    margin: 8,
    flex: 1,
    alignItems: 'center',
    elevation: 3,
  },
  productImage: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  productPrice: {
    fontSize: 14,
    color: '#007BFF',
    fontWeight: 'bold',
    marginTop: 5,
  },
  bnplText: {
    fontSize: 12,
    color: '#FF5733',
    marginTop: 5,
  },
});

export default HomeScreen;
