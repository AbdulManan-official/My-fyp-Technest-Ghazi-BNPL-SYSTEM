import React from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export default function CheckoutScreen({ route }) {
  const navigation = useNavigation();
  const { cartItems, totalPrice } = route.params;

  // Mock user details (Replace with real user data)
  const user = {
    name: 'John Doe',
    address: '123 Main Street, Karachi, Pakistan',
    phone: '+92 300 1234567',
  };

  // Shipping and tax calculations
  const shippingFee = totalPrice > 5000 ? 0 : 300;
  const tax = totalPrice * 0.05;
  const grandTotal = totalPrice + tax + shippingFee;

  return (
    <View style={styles.container}>
      {/* User Details Section with Phone Number and Chevron Icon */}
      <View style={styles.userInfoContainer}>
        <Ionicons name="person-circle" size={40} color="#007BFF" />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userAddress}>{user.address}</Text>
          <Text style={styles.userPhone}>📞 {user.phone}</Text>
        </View>

        {/* Chevron-Right Icon */}
        <Ionicons 
          name="chevron-forward-outline" 
          size={24} 
          color="red" 
          style={styles.chevronIcon} 
        />
      </View>

      {/* Cart Items Section */}
      <View style={styles.cartContainer}>
        <FlatList
          data={cartItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.cartItem}>
              <Image source={{ uri: item.image }} style={styles.productImage} />
              <View style={styles.details}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productPrice}>PKR {(item.price * item.quantity).toLocaleString()}</Text>
                <Text style={styles.quantityText}>Quantity: {item.quantity}</Text>
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      </View>

      {/* Order Summary Section */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Order Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>Subtotal:</Text>
          <Text style={styles.summaryValue}>PKR {totalPrice.toLocaleString()}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>Tax (5%):</Text>
          <Text style={styles.summaryValue}>PKR {tax.toFixed(0)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>Shipping:</Text>
          <Text style={styles.summaryValue}>{shippingFee === 0 ? 'Free' : `PKR ${shippingFee}`}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.totalText}>Total:</Text>
          <Text style={styles.totalValue}>PKR {grandTotal.toLocaleString()}</Text>
        </View>
      </View>

      {/* Proceed to Payment Button */}
      <TouchableOpacity 
        style={styles.paymentButton} 
        onPress={() => alert('Proceeding to Payment Gateway...')}
      >
        <Text style={styles.paymentText}>Proceed to Payment</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingBottom: 10,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    margin: 10,
    elevation: 2,
    justifyContent: 'space-between', // Ensures alignment
  },
  userInfo: {
    flex: 1,
    marginLeft: 10,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  userAddress: {
    fontSize: 14,
    color: '#666',
  },
  userPhone: {
    fontSize: 14,
    color: '#007BFF',
    marginTop: 3,
  },
  chevronIcon: {
    marginLeft: 10, // Aligns the icon to the right
  },
  cartContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    margin: 10,
    borderRadius: 10,
    padding: 10,
    elevation: 3,
  },
  cartItem: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 15,
  },
  details: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  productPrice: {
    fontSize: 14,
    color: '#C70039',
  },
  quantityText: {
    fontSize: 16,
    color: '#666',
  },
  summaryContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    margin: 10,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  summaryText: {
    fontSize: 16,
    color: '#333',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#ccc',
    marginVertical: 5,
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007BFF',
  },
  paymentButton: {
    backgroundColor: '#28A745',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 10,
    marginHorizontal: 10,
  },
  paymentText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

