import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity } from 'react-native';

const dummyWishlist = [
  {
    id: '1',
    title: 'Wireless Headphones',
    price: 'Rs. 4,500',
    image: 'https://fakestoreapi.com/img/61-ujL0xleL._AC_SX679_.jpg',
  },
  {
    id: '2',
    title: 'Smart Watch',
    price: 'Rs. 7,800',
    image: 'https://fakestoreapi.com/img/71-3HjGNDUL._AC_SX522_.jpg',
  },
  {
    id: '3',
    title: 'Gaming Mouse',
    price: 'Rs. 2,300',
    image: 'https://fakestoreapi.com/img/81Zt42ioCgL._AC_SX679_.jpg',
  },
];

const WishlistScreen = () => {
  const [wishlist, setWishlist] = useState(dummyWishlist);

  const handleRemove = (id) => {
    setWishlist((prev) => prev.filter(item => item.id !== id));
  };

  const handleMoveToCart = (id) => {
    // For now just remove it from wishlist
    setWishlist((prev) => prev.filter(item => item.id !== id));
    // You can add cart logic here
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.image }} style={styles.image} />

      <View style={styles.info}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.price}>{item.price}</Text>

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.cartBtn} onPress={() => handleMoveToCart(item.id)}>
            <Text style={styles.cartText}>Move to Cart</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(item.id)}>
            <Text style={styles.removeText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {wishlist.length > 0 ? (
        <FlatList
          data={wishlist}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Your wishlist is empty.</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f2f2f2', // light grey bg
      },
      card: {
        flexDirection: 'row',
        backgroundColor: '#fff', // white card
        borderRadius: 5,
        marginBottom: 0,
        overflow: 'hidden',
        elevation: 3,
      },
      image: {
        width: 100,
        height: 100,
        borderRadius: 10, 
        margin: 10,
        backgroundColor: '#ddd',
      },
      
  info: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  price: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF0000',
    marginTop: 5,
  },
  buttons: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  cartBtn: {
    backgroundColor: '#FF0000',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  cartText: {
    color: '#fff',
    fontSize: 12,
  },
  removeBtn: {
    backgroundColor: '#ccc',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  removeText: {
    color: '#333',
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

export default WishlistScreen;
