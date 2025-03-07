import React, { useState } from 'react';
import { 
  View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, Share 
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';

export default function ProductDetailsScreen() {
  const route = useRoute();
  const { product } = route.params; // Get product details from navigation

  const [isWishlisted, setIsWishlisted] = useState(false); // Wishlist state
  const reviews = [
    { id: 1, name: "Alice Johnson", rating: 5, comment: "Amazing product! Totally worth it." },
    { id: 2, name: "Mark Smith", rating: 4, comment: "Good quality, but took some time to deliver." },
    { id: 3, name: "Emily Brown", rating: 5, comment: "Absolutely love it! Highly recommended." }
  ];
  const moreProducts = [
    { id: '1', name: 'Wireless Headphones', originalPrice: '$79.99', discountedPrice: '$59.99', image: require('../../assets/p1.jpg') },
    { id: '2', name: 'Smartwatch Series 7', originalPrice: '$299.99', discountedPrice: '$249.99', image: require('../../assets/p2.png') },
    { id: '3', name: 'Gaming Laptop', originalPrice: '$1,799.99', discountedPrice: '$1,499.99', image: require('../../assets/p3.jpg') },
    { id: '4', name: 'Wireless Earbuds', originalPrice: '$99.99', discountedPrice: '$79.99', image: require('../../assets/p4.jpg') },
    { id: '5', name: 'Bluetooth Speaker', originalPrice: '$59.99', discountedPrice: '$49.99', image: require('../../assets/b1.jpg') },
  ];
  
  // Handle Wishlist Toggle
  const toggleWishlist = () => {
    setIsWishlisted(!isWishlisted);
  };

  // Handle Share Product
  const shareProduct = async () => {
    try {
      await Share.share({
        message: `Check out this product: ${product.name} for only ${product.discountedPrice}!`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Product Image */}
        <Image source={product.image} style={styles.productImage} />

        {/* Product Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.productName}>{product.name}</Text>
          
          {/* Price Section */}
          <View style={styles.priceContainer}>
            <Text style={styles.originalPrice}>{product.originalPrice}</Text>
            <Text style={styles.discountedPrice}>{product.discountedPrice}</Text>
          </View>

          {/* Wishlist, Share & Ratings Section */}
          <View style={styles.row}>
            {/* Wishlist Button */}
            <TouchableOpacity onPress={toggleWishlist} style={styles.wishlistButton}>
              <MaterialIcons 
                name={isWishlisted ? 'favorite' : 'favorite-border'} 
                size={24} 
                color={isWishlisted ? 'red' : '#555'} 
              />
            </TouchableOpacity>

            {/* Share Button */}
            <TouchableOpacity onPress={shareProduct} style={styles.shareButton}>
              <MaterialIcons name="share" size={24} color="#00796B" />
            </TouchableOpacity>

            {/* BNPL Badge */}
            <View style={styles.bnplBadge}>
              <MaterialIcons name="verified" size={16} color="#00796B" />
              <Text style={styles.bnplText}>BNPL Available</Text>
            </View>

            {/* Rating & Reviews */}
            <View style={styles.ratingContainer}>
              <MaterialIcons name="star" size={20} color="#FFD700" />
              <Text style={styles.ratingText}>4.5 (120 Reviews)</Text>
            </View>
          </View>

          {/* Product Description */}
          <Text style={styles.descriptionTitle}>Product Description</Text>
          <Text style={styles.descriptionText}>
            This is a high-quality {product.name} designed for optimal performance 
            and durability. Perfect for daily use, providing excellent value at a 
            discounted price.
          </Text>

          {/* Address & Contact Section */}
          <View style={styles.addressContainer}>
            <Text style={styles.addressTitle}>Delivery Address</Text>
            <Text style={styles.addressText}>John Doe</Text>
            <Text style={styles.addressText}>1234 Street Name, City, Country</Text>
            <Text style={styles.addressText}>Phone: +123 456 7890</Text>
          </View>
        </View>
{/* Review Section */}
<View style={styles.reviewContainer}>
  <Text style={styles.reviewTitle}>Customer Reviews</Text>

  {reviews.map((review) => (
    <View key={review.id} style={styles.reviewCard}>
      
      {/* User Info */}
      <View style={styles.reviewHeader}>
        <View style={styles.avatar}>
          <MaterialIcons name="person" size={24} color="#fff" />
        </View>
        <View>
          <Text style={styles.reviewerName}>{review.name}</Text>
          <Text style={styles.reviewDate}>Feb 28, 2025</Text> 
        </View>
      </View>

      {/* Star Rating */}
      <View style={styles.reviewRating}>
        {[...Array(review.rating)].map((_, i) => (
          <MaterialIcons key={i} name="star" size={18} color="#FFD700" />
        ))}
      </View>

      {/* Review Text */}
      <Text style={styles.reviewText}>{review.comment}</Text>
    </View>
  ))}
</View>

      </ScrollView>

      {/* Fixed Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.cartButton}>
          <Text style={styles.cartButtonText}>Add to Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buyButton}>
          <Text style={styles.buyButtonText}>Buy Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    paddingBottom: 80, // Prevent overlap with fixed buttons
  },
  productImage: {
    width: '100%',
    height: 300,
    resizeMode: 'contain',
    backgroundColor: '#F5F5F5',
  },
  infoContainer: {
    padding: 16,
  },
  productName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  originalPrice: {
    fontSize: 16,
    color: '#A0A0A0',
    textDecorationLine: 'line-through',
    marginRight: 10,
  },
  discountedPrice: {
    fontSize: 20,
    color: '#FF7300',
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  wishlistButton: {
    padding: 8,
  },
  shareButton: {
    padding: 8,
  },
  bnplBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F7FA',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  bnplText: {
    color: '#00796B',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    marginLeft: 5,
    color: '#555',
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
  },
  descriptionText: {
    fontSize: 14,
    color: '#555',
    marginTop: 5,
  },
  // Address Section
  addressContainer: {
    backgroundColor: '#F8F8F8',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  addressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  addressText: {
    fontSize: 14,
    color: '#555',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  cartButton: {
    flex: 1,
    backgroundColor: '#FF7300',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 10,
  },
  cartButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buyButton: {
    flex: 1,
    backgroundColor: '#00796B',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },reviewContainer: { 
    marginTop: 20 
  },
  reviewContainer: { 
    marginTop: 20, 
    padding: 10, 
    backgroundColor: '#fff'
  },
  reviewTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#333', 
    marginBottom: 15, 
    textAlign: 'left'
  },
  reviewCard: { 
    backgroundColor: '#fff', 
    borderRadius: 10, 
    padding: 15, 
    marginBottom: 10, 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 3, 
    borderWidth: 1, 
    borderColor: '#ddd'
  },
  reviewHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 8 
  },
  avatar: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#00796B', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 10 
  },
  reviewerName: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#333' 
  },
  reviewDate: { 
    fontSize: 12, 
    color: '#888', 
    marginTop: 2 
  },
  reviewRating: { 
    flexDirection: 'row', 
    marginBottom: 5 
  },
  reviewText: { 
    fontSize: 14, 
    color: '#555', 
    lineHeight: 20 
  },
  
  
});
