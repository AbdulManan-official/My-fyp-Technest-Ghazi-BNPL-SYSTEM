import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, Image, FlatList, Dimensions, TouchableOpacity, StyleSheet, StatusBar 
} from 'react-native';
import { useNavigation } from '@react-navigation/native'; 
import { MaterialIcons } from '@expo/vector-icons';
import Icon from 'react-native-vector-icons/FontAwesome';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomDrawerScreen from '../userscreens/CustomDrawerScreen'; // Import Custom Drawer

const { width } = Dimensions.get('window');

const banners = [
  require('../../assets/pic4.jpg'),
  require('../../assets/pic2.jpg'),
  require('../../assets/pic3.jpg'),
];

const products = [
  { id: '1', name: 'Wireless Headphones', originalPrice: '$79.99', discountedPrice: '$59.99', image: require('../../assets/p1.jpg') },
  { id: '2', name: 'Smartwatch Series 7', originalPrice: '$299.99', discountedPrice: '$249.99', image: require('../../assets/p2.png') },
  { id: '3', name: 'Gaming Laptop', originalPrice: '$1,799.99', discountedPrice: '$1,499.99', image: require('../../assets/p3.jpg') },
  { id: '4', name: 'Wireless Earbuds', originalPrice: '$99.99', discountedPrice: '$79.99', image: require('../../assets/p4.jpg') },
  { id: '5', name: 'Bluetooth Speaker', originalPrice: '$59.99', discountedPrice: '$49.99', image: require('../../assets/b1.jpg') },
  { id: '6', name: 'Gaming Chair', originalPrice: '$249.99', discountedPrice: '$199.99', image: require('../../assets/b2.jpg') },
  { id: '7', name: '4K TV', originalPrice: '$799.99', discountedPrice: '$599.99', image: require('../../assets/b1.jpg') },
  { id: '8', name: 'Portable Power Bank', originalPrice: '$29.99', discountedPrice: '$19.99', image: require('../../assets/b2.jpg') },
];

const HomeScreen = () => {
  const navigation = useNavigation(); 
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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
      
      {/* Prices: One original price and one discounted price */}
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
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />

      {/* Custom Header with Drawer */}
      <View style={styles.header}>
        <Image source={require('../../assets/pic2.jpg')} style={styles.logo} />
        <TouchableOpacity onPress={() => setIsDrawerOpen(true)}>
          <View style={styles.profileIconContainer}>
            <Icon name="user" size={24} color="white" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <FlatList
        data={[
          { key: 'banner' }, 
          { key: 'trending' }, 
          { key: 'recommended' },
          { key: 'foryou' }, // New "For You" section
        ]} 
        renderItem={({ item }) => {
          if (item.key === 'banner') {
            return (
              <View style={styles.sliderContainer}>
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
                  data={products}
                  renderItem={renderProductCard}
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.trendingContainer}
                />
              </View>
            );
          }
          if (item.key === 'recommended' || item.key === 'foryou') {
            return (
              <View>
                <Text style={styles.sectionTitle}>
                  {item.key === 'recommended' ? '🌟 Recommended for You' : '🎯 For You'}
                </Text>
                <FlatList
                  data={products}
                  renderItem={renderProductCard}
                  keyExtractor={(item) => item.id}
                  numColumns={2} // Two products per row
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

      {/* Drawer */}
      {isDrawerOpen && (
        <View style={styles.drawerOverlay}>
          <CustomDrawerScreen
            navigation={navigation}
            closeDrawer={() => setIsDrawerOpen(false)}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FF0000',
    padding: 10,
  },
  logo: {
    width: 90,
    height: 30,
    resizeMode: 'contain',
  },
  profileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
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
  originalPrice: {
    fontSize: 14,
    color: '#A0A0A0',
    textDecorationLine: 'line-through',
    marginRight: 5,
  },
  discountedPrice: {
    fontSize: 16,
    color: '#FF0000',
    fontWeight: 'bold',
  },
});

export default HomeScreen;
