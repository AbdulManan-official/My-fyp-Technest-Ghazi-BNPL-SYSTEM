import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const UserDetailScreen = ({ route }) => {
  const { user } = route.params;

  return (
    <ScrollView style={styles.container}>
      {/* Background Full-Width Section */}
      <View style={styles.profileBackground}>
        {/* Profile Info */}
        <Image
          source={{ uri: user.profileImage || 'https://via.placeholder.com/120' }}
          style={styles.profileImage}
        />
        <Text style={styles.name}>{user.name}</Text>
        <Text
          style={[
            styles.status,
            user.verificationStatus === 'Verified' ? styles.verified : styles.unverified,
          ]}
        >
          Status: {user.verificationStatus || 'No Status'}
        </Text>
      </View>

      {/* Contact Information Section */}
      <View style={styles.contactSection}>
        <Text style={styles.sectionTitle}>Contact Information</Text>

        <View style={styles.infoCard}>
          <Icon name="map-marker" size={25} color="red" />
          <Text style={styles.infoText}>Address: {user.address || 'No Address Provided'}</Text>
        </View>

        <View style={styles.infoCard}>
          <Icon name="envelope" size={25} color="red" />
          <Text style={styles.infoText}>Email: {user.email || 'No Email Provided'}</Text>
        </View>

        <View style={styles.infoCard}>
          <Icon name="phone" size={25} color="red" />
          <Text style={styles.infoText}>Phone: {user.phone || 'No Phone Provided'}</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  profileBackground: {
    width: '100%',
    backgroundColor: '#FFFAF0',
    alignItems: 'center',
    paddingVertical: 30,
  },
  profileImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    marginBottom: 10,
    backgroundColor: '#eee',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  status: {
    fontSize: 16,
    marginTop: 4,
  },
  verified: { color: 'green' },
  unverified: { color: 'red' },

  contactSection: {
    width: '100%',
    marginTop: 10,
    paddingHorizontal: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 25,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  infoText: {
    fontSize: 16,
    marginLeft: 17,
    color: '#444',
    flex: 1, fontWeight:'500'
  },
});

export default UserDetailScreen;
