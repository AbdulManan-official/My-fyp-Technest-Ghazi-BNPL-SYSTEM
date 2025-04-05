import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Dimensions, ActivityIndicator,
  Platform, Image, RefreshControl
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// Dummy users data
const dummyUsers = [
  { id: '1', name: 'John Doe', verificationStatus: 'Verified', profileImage: 'https://via.placeholder.com/50' },
  { id: '2', name: 'Jane Smith', verificationStatus: 'Unverified', profileImage: 'https://via.placeholder.com/50' },
  { id: '3', name: 'Alice Johnson', verificationStatus: 'Verified', profileImage: 'https://via.placeholder.com/50' },
  { id: '4', name: 'Bob Brown', verificationStatus: 'Pending', profileImage: 'https://via.placeholder.com/50' },
];

const UsersScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState(dummyUsers);
  const [loadingFilter, setLoadingFilter] = useState(false); // Loading state for filtered lists
  const [refreshing, setRefreshing] = useState(false); // For handling pull-to-refresh

  // Filter users based on status and search query
  const filteredUsers = useMemo(() => {
    setLoadingFilter(true);  
  
    const filtered = users.filter(user => {
      // ✅ Ensure user.name is defined before calling .toLowerCase()
      const matchesSearch = (user.name || "").toLowerCase().includes(searchQuery.toLowerCase());
  
      if (filter === 'All') return matchesSearch;
      if (filter === 'Verified') return matchesSearch && user.verificationStatus === 'Verified';
      if (filter === 'Unverified') {
        const unverifiedStatuses = ['Pending', 'Not Applied', 'Rejected'];
        return matchesSearch && unverifiedStatuses.includes(user.verificationStatus);
      }
    });
  
    setLoadingFilter(false);  
    return filtered;
  }, [searchQuery, filter, users]);

  // Function to handle pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    setLoading(true);  // Start loading again when refreshed
    // Simulate a delay for refreshing
    setTimeout(() => {
      setUsers(dummyUsers);  // Re-set dummy users data
      setRefreshing(false);  // End refreshing once data is fetched
      setLoading(false);
    }, 1500);
  };

  // Render the FlatList for filtered users
  const renderUserItem = ({ item }) => (
    <TouchableOpacity 
      onPress={() => navigation.navigate('UserDetailScreen', { user: item })} 
      style={styles.userItem}
    >
      <Image 
        source={{ uri: item.profileImage || 'https://via.placeholder.com/50' }} 
        style={styles.profileImage} 
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={[styles.status, item.verificationStatus === 'Verified' ? styles.verified : styles.unverified]}>
          {item.verificationStatus || 'No Status'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FF0000', '#FF0000']} style={styles.gradientBackground}>
        <View style={styles.searchBar}>
          <Icon name="search" size={20} color="#FF0000" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Search users..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="times" size={20} color="#FF4500" style={styles.icon} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.filterScrollContainer}>
          {['All', 'Verified', 'Unverified'].map(item => (
            <TouchableOpacity
              key={item}
              style={[styles.filterButton, filter === item && styles.selectedFilter]}
              onPress={() => setFilter(item)}
            >
              <Text style={[styles.filterText, filter === item && styles.selectedFilterText]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {loading || loadingFilter ? (  // Show loader when data is being fetched or filter is applied
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#FF4500" />
          <Text style={styles.loadingText}>Loading Users...</Text>
        </View>
      ) : (
        // FlatList for filtered users with pull-to-refresh
        <FlatList
          data={filteredUsers}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderUserItem}
          ListEmptyComponent={<Text>No users found</Text>}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}  // Control refreshing state
              onRefresh={onRefresh}    // Trigger the onRefresh function
              colors={['#FF4500']}      // Color of the refresh indicator
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  gradientBackground: { paddingTop: Platform.OS === 'ios' ? 60 : 30,  paddingHorizontal: 15,    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20, },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 50, paddingHorizontal: 15, paddingVertical: 8 },
  input: { flex: 1, height: 40, fontSize: 14, color: '#333', paddingLeft: 10 },
  icon: { paddingHorizontal: 10 },
  filterScrollContainer: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap' },
  filterButton: { paddingVertical: 6, paddingHorizontal: 15, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#FF4500', marginRight: 10, marginBottom: 10 },
  selectedFilter: { backgroundColor: 'black' },
  filterText: { fontSize: 14, color: '#FF4500' },
  selectedFilterText: { color: '#FFF' },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16 },
  listContent: { paddingBottom: 70 }, // Add padding for smooth scroll near the bottom tab
  userItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  profileImage: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
  userInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  status: { fontSize: 14, fontWeight: 'bold' },
  verified: { color: 'green' },
  unverified: { color: 'red' },
});

export default UsersScreen;
