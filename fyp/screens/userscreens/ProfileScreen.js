import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function ProfileScreen({ navigation }) {
  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <Image
          source={{ uri: 'https://via.placeholder.com/100' }}
          style={styles.profileImage}
        />
        <Text style={styles.profileName}>John Doe</Text>
        <Text style={styles.profileEmail}>johndoe@example.com</Text>
      </View>

      {/* Profile Options */}
      <View style={styles.optionsContainer}>
        <TouchableOpacity style={styles.optionItem}>
          <MaterialIcons name="person" size={24} color="#007BFF" />
          <Text style={styles.optionText}>Account Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionItem}>
          <MaterialIcons name="verified-user" size={24} color="#28A745" />
          <Text style={styles.optionText}>BNPL Verification</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionItem}>
          <MaterialIcons name="location-on" size={24} color="#E74C3C" />
          <Text style={styles.optionText}>Address Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionItem}>
          <MaterialIcons name="help-outline" size={24} color="#F39C12" />
          <Text style={styles.optionText}>Help & Support</Text>
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={() => navigation.replace('Login')}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  profileHeader: {
    backgroundColor: '#007BFF',
    padding: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: 'white',
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 10,
  },
  profileEmail: {
    fontSize: 14,
    color: '#E0E0E0',
  },
  optionsContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  optionItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 3,
  },
  optionText: {
    fontSize: 16,
    marginLeft: 15,
  },
  logoutButton: {
    marginTop: 30,
    backgroundColor: '#E74C3C',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  logoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

