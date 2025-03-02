import React, { useState, useEffect, useRef } from 'react'; 
import { 
  View, Text, Image, FlatList, Dimensions, TouchableOpacity, StyleSheet 
} from 'react-native';
import { useNavigation } from '@react-navigation/native'; 
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const banners = [
  require('../../assets/pic4.jpg'),
  require('../../assets/pic2.jpg'),
  require('../../assets/pic3.jpg'),
];

const trendingProducts = [
  { id: '1', name: 'Wireless Headphones', originalPrice: '$79.99', discountedPrice: '$59.99', image: require('../../assets/p1.jpg') },
  { id: '2', name: 'Smartwatch Series 7', originalPrice: '$299.99', discountedPrice: '$249.99', image: require('../../assets/p2.png') },
  { id: '3', name: 'Gaming Laptop', originalPrice: '$1,799.99', discountedPrice: '$1,499.99', image: require('../../assets/p3.jpg') },
  { id: '4', name: 'Wireless Earbuds', originalPrice: '$99.99', discountedPrice: '$79.99', image: require('../../assets/p4.jpg') },
  { id: '5', name: 'Bluetooth Speaker', originalPrice: '$59.99', discountedPrice: '$49.99', image: require('../../assets/b1.jpg') },
  { id: '6', name: 'Gaming Chair', originalPrice: '$249.99', discountedPrice: '$199.99', image: require('../../assets/b2.jpg') },
  { id: '7', name: '4K TV', originalPrice: '$799.99', discountedPrice: '$599.99', image: require('../../assets/b1.jpg') },
  { id: '8', name: 'Portable Power Bank', originalPrice: '$29.99', discountedPrice: '$19.99', image: require('../../assets/b2.jpg') },
];

const recommendedProducts = [
  { id: '9', name: 'Mechanical Keyboard', originalPrice: '$149.99', discountedPrice: '$99.99', image: require('../../assets/b1.jpg') },
  { id: '10', name: 'Smart TV', originalPrice: '$799.99', discountedPrice: '$599.99', image: require('../../assets/b2.jpg') },
  { id: '11', name: 'Gaming Mouse', originalPrice: '$69.99', discountedPrice: '$49.99', image: require('../../assets/p3.jpg') },
  { id: '12', name: 'Wireless Mouse', originalPrice: '$39.99', discountedPrice: '$29.99', image: require('../../assets/p4.jpg') },
  { id: '13', name: 'Laptop Stand', originalPrice: '$79.99', discountedPrice: '$59.99', image: require('../../assets/pic1.jpg') },
  { id: '14', name: 'Portable Speaker', originalPrice: '$129.99', discountedPrice: '$89.99', image: require('../../assets/pic2.jpg') },
  { id: '15', name: 'Smartphone', originalPrice: '$699.99', discountedPrice: '$599.99', image: require('../../assets/b1.jpg') },
  { id: '16', name: 'Action Camera', originalPrice: '$249.99', discountedPrice: '$199.99', image: require('../../assets/b2.jpg') },
];

const HomeScreen = () => {
  const navigation = useNavigation(); 
  const [currentIndex, setCurrentIndex] = useState(0);

  const onScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.floor(contentOffsetX / width);
    setCurrentIndex(index);
  };

  const renderProductCard = ({ item }) => (
    <TouchableOpacity 
      style={styles.productCard}
      onPress={() => navigation.navigate('ProductDetails', { product: item })} 
    >
      <Image source={item.image} style={styles.productImage} />
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

  const renderBanner = ({ item }) => (
    <Image source={item} style={styles.banner} />
  );

  return (
    <FlatList
      data={[{ key: 'banner' }, { key: 'trending' }, { key: 'recommended' }]} // Adjusted data for sections
      renderItem={({ item, index }) => {
        if (item.key === 'banner') {
          return (
            <View style={styles.sliderContainer}>
              {/* Banner Section */}
              <FlatList
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                data={banners}
                renderItem={renderBanner}
                keyExtractor={(item, index) => index.toString()}
                onScroll={onScroll}
                scrollEventThrottle={16}
              />
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
        if (item.key === 'trending') {
          return (
            <View>
              <Text style={styles.sectionTitle}>🔥 Trending Products</Text>
              <FlatList
                horizontal
                data={trendingProducts}
                renderItem={renderProductCard}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.trendingContainer}
              />
            </View>
          );
        }
        if (item.key === 'recommended') {
          return (
            <View>
              <Text style={styles.sectionTitle}>🌟 Recommended for You</Text>
              <FlatList
                data={recommendedProducts}
                renderItem={renderProductCard}
                keyExtractor={(item) => item.id}
                numColumns={2}
                contentContainerStyle={styles.gridContainer}
              />
            </View>
          );
        }
        return null;
      }}
      keyExtractor={(item, index) => index.toString()}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  sliderContainer: {
    alignItems: 'center', 
    justifyContent: 'center',
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
  banner: {
    width: width,
    height: 200,
    resizeMode: 'cover',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 16,
    marginVertical: 10,
  },
  trendingContainer: {
    paddingLeft: 10,
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
    resizeMode: 'contain',
  },
  productName: {
    marginTop: 5,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  originalPrice: {
    fontSize: 12,
    color: '#A0A0A0',
    textDecorationLine: 'line-through',
    marginRight: 5,
  },
  discountedPrice: {
    fontSize: 14,
    color: '#FF7300',
    fontWeight: 'bold',
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
