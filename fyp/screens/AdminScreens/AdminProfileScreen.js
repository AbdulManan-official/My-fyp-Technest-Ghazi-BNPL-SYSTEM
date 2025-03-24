import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AdminProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>👤 Admin Profile</Text>
      <Text style={styles.detail}>Name: John Admin</Text>
      <Text style={styles.detail}>Email: admin@example.com</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: '#FF0000' },
  detail: { fontSize: 16, marginVertical: 5 },
});
