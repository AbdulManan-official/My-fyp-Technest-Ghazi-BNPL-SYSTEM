import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
} from 'react-native';

// Dummy Messages Data
const userMessages = [
  {
    id: '1',
    name: 'John Doe',
    message: 'Hi, I have an issue with my order.',
    time: '2 min ago',
    profilePic: 'https://via.placeholder.com/50',
  },
  {
    id: '2',
    name: 'Alice Smith',
    message: 'When will my package arrive?',
    time: '10 min ago',
    profilePic: 'https://via.placeholder.com/50',
  },
  {
    id: '3',
    name: 'Michael Johnson',
    message: 'I want to return a product.',
    time: '30 min ago',
    profilePic: 'https://via.placeholder.com/50',
  },
];

export default function AdminMessageScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>📩 User Messages</Text>

      <FlatList
        data={userMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.messageCard} onPress={() => alert('Open Chat')}>
            <Image source={{ uri: item.profilePic }} style={styles.profileImage} />
            <View style={styles.messageDetails}>
              <Text style={styles.userName}>{item.name}</Text>
              <Text style={styles.messageText}>{item.message}</Text>
            </View>
            <Text style={styles.messageTime}>{item.time}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 15,
    paddingTop: 20,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  messageCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
    elevation: 3,
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  messageDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  messageText: {
    fontSize: 14,
    color: 'gray',
    marginTop: 2,
  },
  messageTime: {
    fontSize: 12,
    color: 'gray',
  },
});

