import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
} from 'react-native';

const initialCartItems = [
  {
    id: '1',
    name: 'Wireless Headphones',
    price: 59.99,
    image: 'https://via.placeholder.com/150/0000FF/808080?text=Headphones',
    quantity: 1,
  },
  {
    id: '2',
    name: 'Smartwatch Series 7',
    price: 249.99,
    image: 'https://via.placeholder.com/150/FF0000/FFFFFF?text=Smartwatch',
    quantity: 1,
  },
  {
    id: '3',
    name: 'Gaming Laptop',
    price: 1499.99,
    image: 'https://via.placeholder.com/150/008000/FFFFFF?text=Laptop',
    quantity: 1,
  },
];

export default function CartScreen() {
  const [cartItems, setCartItems] = useState(initialCartItems);

  // Remove item from cart
  const removeItem = (id) => {
    setCartItems(cartItems.filter((item) => item.id !== id));
  };

  // Calculate total price
  const totalPrice = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🛒 Your Cart</Text>

      {cartItems.length > 0 ? (
        <>
          {/* Cart Items List */}
          <FlatList
            data={cartItems}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.cartItem}>
                <Image source={{ uri: item.image }} style={styles.productImage} />
                <View style={styles.details}>
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
                  <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.removeButton}>
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />

          {/* Total Price Section */}
          <View style={styles.totalContainer}>
            <Text style={styles.totalText}>Total: ${totalPrice.toFixed(2)}</Text>
            <TouchableOpacity style={styles.checkoutButton}>
              <Text style={styles.checkoutText}>Proceed to Checkout</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <Text style={styles.emptyCartText}>Your cart is empty 😞</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 15,
    paddingTop: 20,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
    elevation: 2,
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
    color: '#007BFF',
    marginTop: 5,
  },
  removeButton: {
    marginTop: 5,
    backgroundColor: '#FF5733',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  removeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  totalContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#FFF',
    borderRadius: 10,
    alignItems: 'center',
    elevation: 3,
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  checkoutButton: {
    marginTop: 10,
    backgroundColor: '#007BFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  checkoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyCartText: {
    textAlign: 'center',
    fontSize: 18,
    color: 'gray',
    marginTop: 20,
  },
});

