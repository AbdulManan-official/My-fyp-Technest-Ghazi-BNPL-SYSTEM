import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AdminUserVerficationScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>✅ User Verification</Text>
      <Text style={styles.detail}>This screen will handle user verification logic.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: '#FF0000' },
  detail: { fontSize: 16 },
});
