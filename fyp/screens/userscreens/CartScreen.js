import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const initialCartItems = [
  {
    id: '1',
    name: 'Wireless Headphones',
    price: 5999,
    image: 'https://via.placeholder.com/150/0000FF/808080?text=Headphones',
    quantity: 1,
  },
  {
    id: '2',
    name: 'Smartwatch Series 7',
    price: 24999,
    image: 'https://via.placeholder.com/150/FF0000/FFFFFF?text=Smartwatch',
    quantity: 1,
  },
  {
    id: '3',
    name: 'Gaming Laptop',
    price: 149999,
    image: 'https://via.placeholder.com/150/008000/FFFFFF?text=Laptop',
    quantity: 1,
  },
  {
    id: '4',
    name: 'Fitness Tracker',
    price: 6999,
    image: 'https://via.placeholder.com/150/FFFF00/000000?text=Fitness+Tracker',
    quantity: 1,
  },
  {
    id: '5',
    name: 'Bluetooth Speaker',
    price: 15999,
    image: 'https://via.placeholder.com/150/00FFFF/000000?text=Bluetooth+Speaker',
    quantity: 1,
  },
];

export default function CartScreen() {
  const [cartItems, setCartItems] = useState(initialCartItems);
  const navigation = useNavigation();

  const removeItem = (id) => {
    setCartItems(cartItems.filter((item) => item.id !== id));
  };

  const updateQuantity = (id, action) => {
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id
          ? { ...item, quantity: action === 'increase' ? item.quantity + 1 : Math.max(1, item.quantity - 1) }
          : item
      )
    );
  };

  const totalPrice = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <View style={styles.container}>
      <LinearGradient colors={["red", "red"]} style={styles.headerContainer}>
        <Text style={styles.header}>🛒 Your Cart</Text>
      </LinearGradient>

      <View style={styles.cartContainer}>
        {cartItems.length > 0 ? (
          <FlatList
            data={cartItems}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => navigation.navigate('ProductDetail', { product: item })}>
                <View style={styles.cartItem}>
                  <Image source={{ uri: item.image }} style={styles.productImage} />
                  <View style={styles.details}>
                    <Text style={styles.productName}>{item.name}</Text>
                    <Text style={styles.productPrice}>PKR {(item.price * item.quantity).toLocaleString()}</Text>
                    <View style={styles.quantityContainer}>
                      <TouchableOpacity onPress={() => updateQuantity(item.id, 'decrease')} style={styles.quantityButton}>
                        <Ionicons name="remove-circle" size={24} color="#FF5733" />
                      </TouchableOpacity>
                      <Text style={styles.quantityText}>{item.quantity}</Text>
                      <TouchableOpacity onPress={() => updateQuantity(item.id, 'increase')} style={styles.quantityButton}>
                        <Ionicons name="add-circle" size={24} color="#007BFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.removeButton}>
                    <Ionicons name="trash" size={24} color="#FF5733" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 120 }} // Prevents bottom overlap
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <Text style={styles.emptyCartText}>Your cart is empty 😞</Text>
        )}
      </View>

      {cartItems.length > 0 && (
        <View style={styles.totalContainer}>
          <Text style={styles.totalText}>Total: PKR {totalPrice.toLocaleString()}</Text>
          <TouchableOpacity style={styles.checkoutButton}>
            <Text style={styles.checkoutText}>Checkout</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingBottom: 70,
  },
  headerContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
  },
  cartContainer: {
    flex: 1, // Ensures the FlatList takes full space for scrolling
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
    marginTop: 5,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  quantityButton: {
    padding: 5,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 10,
  },
  removeButton: {
    padding: 10,
  },
  totalContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    margin: 10,
    padding: 15,
    backgroundColor: '#FFF',
    borderRadius: 10,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  checkoutButton: {
    marginTop: 10,
    backgroundColor: '#007BFF',
    paddingVertical: 12,
    paddingHorizontal: 30,
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
