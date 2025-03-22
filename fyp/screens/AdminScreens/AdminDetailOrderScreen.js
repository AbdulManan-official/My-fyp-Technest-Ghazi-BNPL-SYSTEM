import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AdminDetailOrderScreen({ route }) {
  const { order } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.detail}>🛍️ Product: {order.name}</Text>
      <Text style={styles.detail}>💲 Price: {order.price}</Text>
      <Text style={styles.detail}>📦 Status: {order.status}</Text>

      <Text style={styles.subHeading}>Customer Info</Text>
      <Text style={styles.detail}>👤 Name: Ali Raza</Text>
      <Text style={styles.detail}>📧 Email: ali.raza@example.com</Text>
      <Text style={styles.detail}>📱 Phone: +92 300 1234567</Text>
      <Text style={styles.detail}>🏠 Address: 123, Main Boulevard, Lahore, Pakistan</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#FF0000',
  },
  subHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 30,
    marginBottom: 10,
    color: '#FF0000',
  },
  detail: {
    fontSize: 16,
    marginVertical: 6,
    color: '#333',
  },
});