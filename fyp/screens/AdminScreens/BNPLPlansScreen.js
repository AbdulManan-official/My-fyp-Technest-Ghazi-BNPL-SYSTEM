// screens/AdminScreens/BNPLPlansScreen.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function BNPLPlansScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>BNPL Plans</Text>
      <Text style={styles.subtitle}>This screen will show Buy Now Pay Later plan options and controls.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF0000',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#333',
  },
});
