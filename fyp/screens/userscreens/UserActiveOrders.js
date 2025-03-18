import { StyleSheet, Text, View, FlatList, Dimensions, ActivityIndicator } from 'react-native';
import React, { useState, useEffect } from 'react';
import { MaterialIcons } from '@expo/vector-icons';

// Dummy Data for Active Orders with BNPL
const dummyOrders = [
  { id: '1', orderNumber: 'ORD1234', date: '2023-03-18', status: 'Active', isBNPL: false },
  { id: '2', orderNumber: 'ORD5678', date: '2023-03-19', status: 'Active', isBNPL: true },
  { id: '3', orderNumber: 'ORD91011', date: '2023-03-20', status: 'Active', isBNPL: false },
  { id: '4', orderNumber: 'ORD1213', date: '2023-03-21', status: 'Active', isBNPL: true },
  { id: '5', orderNumber: 'ORD1415', date: '2023-03-22', status: 'Active', isBNPL: false },
];

export default function UserActiveOrders() {
  const [activeOrders, setActiveOrders] = useState(dummyOrders);
  const [loading, setLoading] = useState(false);

  // Render each order item
  const renderOrderItem = ({ item }) => (
    <View style={styles.orderContainer}>
      <Text style={styles.orderText}>Order Number: {item.orderNumber}</Text>
      <Text style={styles.orderText}>Date: {item.date}</Text>
      <Text style={styles.statusText}>Status: {item.status}</Text>
      {item.isBNPL && (
        <View style={styles.bnplContainer}>
          <MaterialIcons name="payment" size={20} color="#FF4500" />
          <Text style={styles.bnplText}>BNPL Order</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#FF4500" />
      ) : (
        <FlatList
          data={activeOrders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.flatListContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  orderContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderWidth: 0.1912, // Add border width
    borderColor: 'black', // Add black border color
  },
  orderText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF4500',
  },
  bnplContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  bnplText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF4500',
    marginLeft: 5,
  },
  flatListContainer: {
    paddingBottom: 20,
  },
});
