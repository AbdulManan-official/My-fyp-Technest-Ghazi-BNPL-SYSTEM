import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const UserDetailScreen = ({ route }) => {
  const { user } = route.params;  // Getting user data passed through navigation

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: user.profileImage || 'https://via.placeholder.com/150' }}
        style={styles.profileImage}
      />
      <Text style={styles.userName}>{user.name}</Text>
      <Text style={styles.verificationStatus}>Status: {user.verificationStatus}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  profileImage: { width: 150, height: 150, borderRadius: 75, marginBottom: 20 },
  userName: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  verificationStatus: { fontSize: 16, color: '#555' },
});

export default UserDetailScreen;
