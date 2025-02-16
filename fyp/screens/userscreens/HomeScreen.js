import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, Image, FlatList, ScrollView, Dimensions, TouchableOpacity, StyleSheet 
} from 'react-native';
import { useNavigation } from '@react-navigation/native'; // ✅ Import navigation hook
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const banners = [
  require('../../assets/pic4.jpg'),
  require('../../assets/pic2.jpg'),
  require('../../assets/pic3.jpg'),
];

const trendingProducts = [
  { id: '1', name: 'Wireless Headphones', price: '$59.99', image: 'https://via.placeholder.com/150/0000FF/808080?text=Headphones' },
  { id: '2', name: 'Smartwatch Series 7', price: '$249.99', image: 'https://via.placeholder.com/150/FF0000/FFFFFF?text=Smartwatch' },
  { id: '3', name: 'Gaming Laptop', price: '$1,499.99', image: 'https://via.placeholder.com/150/008000/FFFFFF?text=Laptop' },
  { id: '4', name: 'Wireless Earbuds', price: '$79.99', image: 'https://via.placeholder.com/150/FFA500/FFFFFF?text=Earbuds' },
];

const recommendedProducts = [
  { id: '5', name: 'Bluetooth Speaker', price: '$39.99', image: 'https://via.placeholder.com/150/0000FF/808080?text=Speaker' },
  { id: '6', name: 'Mechanical Keyboard', price: '$99.99', image: 'https://via.placeholder.com/150/FF0000/FFFFFF?text=Keyboard' },
  { id: '7', name: 'Smart TV', price: '$599.99', image: 'https://via.placeholder.com/150/008000/FFFFFF?text=SmartTV' },
  { id: '8', name: 'Gaming Mouse', price: '$49.99', image: 'https://via.placeholder.com/150/FFA500/FFFFFF?text=Mouse' },
];

const HomeScreen = () => {
  const navigation = useNavigation(); // ✅ Hook for navigation
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % banners.length;
      setCurrentIndex(nextIndex);
      scrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
    }, 4000);

    return () => clearInterval(interval);
  }, [currentIndex]);

  // ✅ Updated Product Card with Navigation
  const renderProductCard = ({ item }) => (
    <TouchableOpacity 
      style={styles.productCard}
      onPress={() => navigation.navigate('ProductDetail', { product: item })} // ✅ Navigate to detail screen
    >
      <Image source={{ uri: item.image }} style={styles.productImage} />
      <Text style={styles.productName}>{item.name}</Text>
      <Text style={styles.productPrice}>{item.price}</Text>
      
      {/* ✅ BNPL Badge */}
      <View style={styles.bnplBadge}>
        <MaterialIcons name="verified" size={16} color="#00796B" />
        <Text style={styles.bnplText}>BNPL Available</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      {/* ✅ Banner Carousel */}
      <View>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          ref={scrollRef}
          onScroll={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / width);
            setCurrentIndex(index);
          }}
          scrollEventThrottle={16}
        >
          {banners.map((image, index) => (
            <Image key={index} source={image} style={styles.banner} />
          ))}
        </ScrollView>
        <View style={styles.dotContainer}>
          {banners.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, { backgroundColor: index === currentIndex ? 'red' : 'lightgray' }]}
            />
          ))}
        </View>
      </View>

      {/* ✅ Trending Products */}
      <Text style={styles.sectionTitle}>🔥 Trending Products</Text>
      <FlatList
        horizontal
        data={trendingProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderProductCard}
        showsHorizontalScrollIndicator={false}
      />

      {/* ✅ Recommended Products */}
      <Text style={styles.sectionTitle}>🌟 Recommended for You</Text>
      <FlatList
        data={recommendedProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderProductCard}
        numColumns={2}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  banner: {
    width: width,
    height: 200,
    resizeMode: 'cover',
  },
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 16,
    marginVertical: 10,
  },
  productCard: {
    backgroundColor: '#fff',
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
    borderRadius: 8,
  },
  productName: {
    marginTop: 5,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  productPrice: {
    fontSize: 14,
    color: '#007BFF',
    fontWeight: 'bold',
    marginTop: 5,
  },
  bnplBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F7FA',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginTop: 8,
  },
  bnplText: {
    color: '#00796B',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  gridContainer: {
    paddingHorizontal: 10,
  },
});

export default HomeScreen;
