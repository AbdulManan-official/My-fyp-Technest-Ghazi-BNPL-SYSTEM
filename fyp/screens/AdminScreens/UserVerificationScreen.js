import React, { useState, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, FlatList, StyleSheet,
  Dimensions, Platform, ActivityIndicator, SafeAreaView, RefreshControl
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const { width } = Dimensions.get('window');

const UserVerificationScreen = ({ navigation }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = async () => {
    try {
      const db = getFirestore();
      const usersRef = collection(db, 'Users');
      const querySnapshot = await getDocs(usersRef);
      const usersList = [];

      for (const docSnap of querySnapshot.docs) {
        const userData = docSnap.data();
        if (userData.verificationStatus === 'Pending') {
          usersList.push({
            id: docSnap.id,
            ...userData,
            profilePic: userData.profileImage || 'https://randomuser.me/api/portraits/men/1.jpg',
          });
        }
      }

      setRequests(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['red', 'red']} style={styles.gradientBackground}>
        <Text style={styles.headerTitle}>User Verification Requests</Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color="#FF4500" style={styles.loader} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: 70 }]}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate('UserVerificationDetail', { user: item })}
              style={styles.requestCard}
            >
              <Image source={{ uri: item.profilePic }} style={styles.profileImage} />
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.name}</Text>
                <Icon name="clock-o" size={18} color="red" style={styles.statusIcon} />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No requests found.</Text>}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FF4500" />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  gradientBackground: { paddingTop: Platform.OS === 'ios' ? 60 : 30, paddingBottom: 20, alignItems: 'center' ,    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,},
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFF', },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingBottom: 10 },
  requestCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#E0E0E0', backgroundColor: '#FFF' },
  profileImage: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  userInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  userName: { fontSize: 18, fontWeight: 'bold', color: '#333', marginRight: 10 },
  statusIcon: { marginLeft: 'auto' },
  emptyText: { textAlign: 'center', fontSize: 16, color: 'gray', marginTop: 20 },
});

export default UserVerificationScreen;
