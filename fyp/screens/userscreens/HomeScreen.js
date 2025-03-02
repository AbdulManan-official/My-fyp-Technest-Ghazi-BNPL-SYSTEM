import React, { useState, useEffect, useRef } from 'react'; 
import { 
  View, Text, Image, FlatList, ScrollView, Dimensions, TouchableOpacity, StyleSheet 
} from 'react-native';
import { useNavigation } from '@react-navigation/native'; 
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const banners = [
  require('../../assets/pic4.jpg'),
  require('../../assets/pic2.jpg'),
  require('../../assets/pic3.jpg'),
];

// Example product data with dummy images
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
  const navigation = useNavigation(); 
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

  const renderProductCard = ({ item }) => (
    <TouchableOpacity 
      style={styles.productCard}
      onPress={() => navigation.navigate('ProductDetails', { product: item })} 
    >
      <Image source={{ uri: item.image }} style={styles.productImage} />
      <Text style={styles.productName}>{item.name}</Text>
      <Text style={styles.productPrice}>{item.price}</Text>
      
      <View style={styles.bnplBadge}>
        <MaterialIcons name="verified" size={16} color="#00796B" />
        <Text style={styles.bnplText}>BNPL Available</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={[
        { type: 'banner' },
        { type: 'section', title: '🔥 Trending Products' },
        ...trendingProducts.map(product => ({ type: 'product', ...product })),
        { type: 'section', title: '🌟 Recommended for You' },
        ...recommendedProducts.map(product => ({ type: 'product', ...product })),
      ]}
      keyExtractor={(item, index) => index.toString()}
      renderItem={({ item }) => {
        if (item.type === 'banner') {
          return (
            <View style={styles.sliderContainer}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(event) => {
                  const index = Math.round(event.nativeEvent.contentOffset.x / width);
                  setCurrentIndex(index);
                }}
                scrollEventThrottle={16}
                ref={scrollRef}
              >
                {banners.map((image, index) => (
                  <Image key={index} source={image} style={styles.banner} />
                ))}
              </ScrollView>
              
              {/* Pagination Dots */}
              <View style={styles.pagination}>
                {banners.map((_, index) => (
                  <View 
                    key={index} 
                    style={[styles.dot, currentIndex === index ? styles.activeDot : null]} 
                  />
                ))}
              </View>
            </View>
          );
        }

        if (item.type === 'section') {
          return <Text style={styles.sectionTitle}>{item.title}</Text>;
        }

        if (item.type === 'product') {
          return (
            <FlatList
              horizontal // Ensure this list is horizontal
              data={trendingProducts} // Ensure it uses the correct product data
              renderItem={renderProductCard}
              keyExtractor={(product) => product.id}
              showsHorizontalScrollIndicator={false} // Hide horizontal scroll indicator
              contentContainerStyle={styles.productListContainer} // Ensure only one row is shown
            />
          );
        }
      }}
      showsVerticalScrollIndicator={false} // Disable vertical scroll indicator
    />
  );
};

const styles = StyleSheet.create({
  sliderContainer: {
    alignItems: 'center', 
    justifyContent: 'center',
  },
  banner: {
    width: width,
    height: 200,
    resizeMode: 'cover',
  },
  pagination: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 5,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)', 
    padding: 5,
    borderRadius: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 5,
    backgroundColor: '#A0A0A0',
  },
  activeDot: {
    backgroundColor: '#FF7300',
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
    resizeMode: 'contain',  // Ensure image scales properly
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
  productListContainer: {
    paddingLeft: 10, // Padding to the left so that the products start with a margin
  },
});

export default HomeScreen;
