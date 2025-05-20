import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome'; // Assuming you still use FontAwesome here

// No need to define defaultProfileImage here anymore

const UserDetailScreen = ({ route }) => {
  // The user object received from UsersScreen will have user.profileImage
  // already set to either the actual image or the default image.
  const user = route.params?.user || { // Fallback for safety, though UsersScreen should always pass a user
    name: 'Unknown User',
    profileImage: 'https://www.w3schools.com/w3images/avatar2.png', // A hardcoded fallback if user is entirely missing
    verificationStatus: 'No Status',
    address: 'No Address Provided',
    email: 'No Email Provided',
    phone: 'No Phone Provided',
  };

  // console.log('UserDetailScreen received user:', JSON.stringify(user, null, 2));
  // console.log('UserDetailScreen using profileImage:', user.profileImage);


  return (
    <ScrollView style={styles.container}>
      {/* Background Full-Width Section */}
      <View style={styles.profileBackground}>
        {/* Profile Info */}
        <Image
          source={{ uri: user.profileImage }} // Directly use the profileImage from props
          style={styles.profileImage}
          onError={(e) => {
            console.warn('UserDetailScreen Image loading error:', e.nativeEvent.error, 'URI:', user.profileImage);
            // You could set a state here to show an *even more basic* local fallback
            // if user.profileImage (even the default one) fails to load.
          }}
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
    // NO backgroundColor here to allow transparent placeholders or actual images to show correctly
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