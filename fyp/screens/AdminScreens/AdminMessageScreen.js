import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

// Dummy Messages Data with realistic avatars
const userMessages = [
  {
    id: '1',
    name: 'John Doe',
    message: 'Hi, I have an issue with my order.',
    time: '2 min ago',
    profilePic: 'https://randomuser.me/api/portraits/men/75.jpg',
  },
  {
    id: '2',
    name: 'Alice Smith',
    message: 'When will my package arrive?',
    time: '10 min ago',
    profilePic: 'https://randomuser.me/api/portraits/women/65.jpg',
  },
  {
    id: '3',
    name: 'Michael Johnson',
    message: 'I want to return a product.',
    time: '30 min ago',
    profilePic: 'https://randomuser.me/api/portraits/men/83.jpg',
  },
];

export default function AdminMessageScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      {/* Gradient Header */}
      <View style={styles.gradientHeader}>
        <LinearGradient
          colors={['#C40000', '#FF0000']}
          style={styles.gradientBackground}
        >
          <Text style={styles.chatTitle}>📩 User Messages</Text>
        </LinearGradient>
      </View>

      {/* Message List */}
      <FlatList
        data={userMessages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.userItem}
            onPress={() =>
              navigation.navigate('MessageDetailScreen', {
                userId: item.id,
                userName: item.name,
                userImage: item.profilePic,
              })
            }
          >
            <Image source={{ uri: item.profilePic }} style={styles.avatar} />
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{item.name}</Text>
              <Text style={styles.userMessage}>{item.message}</Text>
            </View>
            <Text style={styles.timeText}>{item.time}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.flatListContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  gradientHeader: {
    width: '100%',
    position: 'absolute',
    top: 0,
    zIndex: 10,
  },
  gradientBackground: {
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatTitle: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#FFF',
  },
  flatListContent: {
    paddingTop: Platform.OS === 'ios' ? 120 : 80,
    paddingBottom: 70,
  },
  userItem: {
    width: width,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    borderRadius: 8,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  userMessage: {
    fontSize: 12,
    color: '#555',
    marginTop: 5,
  },
  timeText: {
    fontSize: 12,
    color: 'gray',
  },
});
