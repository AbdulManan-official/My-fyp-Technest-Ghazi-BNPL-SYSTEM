import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Dimensions, ActivityIndicator,
  Platform, Image, RefreshControl, Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { collection, onSnapshot } from "firebase/firestore";
import { db } from '../../firebaseConfig';

const { width, height } = Dimensions.get('window');

const UsersScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false); // State for pull-to-refresh

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, "Users"), (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
      setLoading(false);
      setRefreshing(false); // Stop refresh indicator when data arrives
    }, (error) => {
        console.error("Error fetching users: ", error);
        Alert.alert("Error", "Could not fetch users.");
        setLoading(false);
        setRefreshing(false); // Stop refresh indicator on error
    });

    return () => unsubscribe();
  }, []);

  const filteredUsers = useMemo(() => {
    const trimmedQuery = searchQuery?.trim()?.toLowerCase() ?? '';
    const filtered = users.filter(user => {
      const userNameLower = user?.name?.toLowerCase() ?? '';
      const matchesSearch = !trimmedQuery || userNameLower.includes(trimmedQuery);

      if (filter === 'All') return matchesSearch;
      if (filter === 'Verified') return matchesSearch && user.verificationStatus === 'Verified';
      if (filter === 'Unverified') {
        const unverifiedStatuses = ['Pending', 'Not Applied', 'Rejected', null, undefined];
        return matchesSearch && unverifiedStatuses.includes(user.verificationStatus);
      }
      return false;
    });
    return filtered;
  }, [searchQuery, filter, users]);


  // Function called when user pulls down the list
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // The onSnapshot listener will automatically fetch latest data
    // and setRefreshing(false) when it arrives.
  }, []);


  const renderUserItem = useCallback(({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('UserDetail', { user: item })}
      style={styles.userItem}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: item.profileImage || 'https://via.placeholder.com/50' }}
        style={styles.profileImage}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>{item.name || 'Unnamed User'}</Text>
        <Text style={[
            styles.status,
            item.verificationStatus === 'Verified' ? styles.verified : styles.unverified
          ]}
        >
          {item.verificationStatus || 'Not Applied'}
        </Text>
      </View>
       <Icon name="chevron-right" size={22} color="#B0BEC5" style={styles.chevronIcon}/>
    </TouchableOpacity>
  ), [navigation]);


  const renderListEmptyComponent = () => {
      if (loading && !refreshing) { // Don't show empty component during initial load if not refreshing
          return null;
      }
      if (filteredUsers.length === 0) {
          if (searchQuery.trim() || filter !== 'All') {
              return (
                  <View style={styles.emptyListContainer}>
                      <Icon name="account-search-outline" size={40} color="#ccc" />
                      <Text style={styles.emptyListText}>No users match your criteria.</Text>
                  </View>
              );
          } else {
              return (
                  <View style={styles.emptyListContainer}>
                      <Icon name="account-group-outline" size={40} color="#ccc" />
                      <Text style={styles.emptyListText}>No users found.</Text>
                  </View>
              );
          }
      }
      return null;
  };


  return (
    <View style={styles.container}>
      {/* --- HEADER --- */}
      <View style={styles.headerContainer}>
        {/* Search Bar */}
        <View style={styles.searchBar}>
           <Icon name="magnify" size={22} color="#FF0000" style={styles.searchIcon} />
           <TextInput
             style={styles.searchInput}
             placeholder="Search users by name..."
             placeholderTextColor="#888"
             value={searchQuery}
             onChangeText={setSearchQuery}
             returnKeyType="search"
           />
           {searchQuery.length > 0 && (
             <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
                <Icon name="close-circle" size={20} color="#FF0000" />
             </TouchableOpacity>
           )}
        </View>

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
           {['All', 'Verified', 'Unverified'].map(item => (
             <TouchableOpacity
               key={item}
               style={[
                   styles.filterButton,
                   filter === item && styles.activeFilter
               ]}
               onPress={() => setFilter(item)}
             >
               <Text style={[
                   styles.filterText,
                   filter === item && styles.activeFilterText
               ]}>{item}</Text>
             </TouchableOpacity>
           ))}
        </View>
      </View>
      {/* --- END HEADER --- */}


      {/* --- LOADING / LIST DISPLAY --- */}
      {loading && users.length === 0 && !refreshing ? ( // Show loader only on initial load when not refreshing
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#FF0000" />
          <Text style={styles.loadingText}>Loading Users...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderUserItem}
          ListEmptyComponent={renderListEmptyComponent}
          showsVerticalScrollIndicator={false}
          // This part enables pull-to-refresh
          refreshControl={
            <RefreshControl
              refreshing={refreshing} // Controls the spinner visibility
              onRefresh={onRefresh}   // Function to call when pulled down
              colors={["#FF0000"]}  // Android spinner color
              tintColor={"#FF0000"} // iOS spinner color
            />
          }
          // Optional Performance Props
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={11}
        />
      )}
    </View>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5', paddingTop:1,
  },
  headerContainer: {
    backgroundColor: '#FF0000',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 5,
    paddingHorizontal: 15, borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 50,
    paddingHorizontal: 15,
    height: 45,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  clearSearchButton: {
      padding: 5,
      marginLeft: 5,
  },
  filterContainer: {
    marginTop: 12,
    paddingBottom: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingVertical: 5,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FF0000',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    marginRight: 10,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  activeFilter: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  activeFilterText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  listContent: {
      paddingBottom: 20,
      paddingHorizontal: 0,
      flexGrow: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    backgroundColor: '#E0E0E0',
  },
  userInfo: {
    flex: 1,
    marginRight: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginBottom: 3,
  },
  status: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  verified: {
    color: '#2E7D32',
  },
  unverified: {
    color: '#C62828',
  },
  chevronIcon: {
      color: '#B0BEC5',
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    marginTop: height * 0.05, // Use imported height
  },
  emptyListText: {
    fontSize: 17,
    color: "#666",
    textAlign: "center",
    marginTop: 15,
    fontWeight: '500',
  },
});

export default UsersScreen;