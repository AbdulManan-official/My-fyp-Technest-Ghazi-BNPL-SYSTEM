import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Dimensions, ActivityIndicator,
  Platform, Image, RefreshControl, Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
// Import getDocs for one-time fetching
import { collection, onSnapshot, getDocs } from "firebase/firestore";
import { db } from '../../firebaseConfig';

const { width, height } = Dimensions.get('window');
const defaultProfileImage = 'https://www.w3schools.com/w3images/avatar2.png';

const UsersScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Real-time listener for updates
  useEffect(() => {
    // setLoading(true); // Not strictly needed here as initial state is true
                      // and onRefresh will handle its own spinner.
    const unsubscribe = onSnapshot(collection(db, "Users"), (snapshot) => {
      const usersList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          profileImage: (typeof data.profileImage === 'string' && data.profileImage.trim() !== '') ? data.profileImage : null,
        };
      });
      setUsers(usersList);
      setLoading(false);     // For initial load
      // Important: Also stop refreshing spinner if a snapshot comes in while refreshing
      // This handles cases where a real-time update occurs during a manual refresh.
      setRefreshing(false);
    }, (error) => {
        console.error("Error fetching users with onSnapshot: ", error);
        Alert.alert("Error", "Could not fetch users in real-time.");
        setLoading(false);
        setRefreshing(false);
    });

    return () => unsubscribe();
  }, []); // Empty dependency array: runs once on mount, cleans up on unmount

  const filteredUsers = useMemo(() => {
    // ... (your existing filter logic - seems fine)
    const trimmedQuery = searchQuery?.trim()?.toLowerCase() ?? '';
    return users.filter(user => {
      const userNameLower = user?.name?.toLowerCase() ?? '';
      const matchesSearch = !trimmedQuery || userNameLower.includes(trimmedQuery);

      if (!matchesSearch) return false;

      if (filter === 'All') return true;
      if (filter === 'Verified') return user.verificationStatus === 'Verified';
      if (filter === 'Unverified') {
        const unverifiedStatuses = ['Pending', 'Not Applied', 'Rejected', null, undefined, ''];
        return unverifiedStatuses.includes(user.verificationStatus);
      }
      return false;
    });
  }, [searchQuery, filter, users]);

  // Modified onRefresh to actively fetch data
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const querySnapshot = await getDocs(collection(db, "Users")); // Use getDocs for one-time fetch
      const usersList = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          profileImage: (typeof data.profileImage === 'string' && data.profileImage.trim() !== '') ? data.profileImage : null,
        };
      });
      setUsers(usersList); // Update users state
      // Note: setLoading(false) is not needed here; this is for refresh, not initial load.
      // The onSnapshot listener will also receive these updates if they are new,
      // and its setRefreshing(false) will also run, which is fine.
    } catch (error) {
      console.error("Error refreshing users: ", error);
      Alert.alert("Error", "Could not refresh users.");
    } finally {
      // Always ensure refreshing is set to false after the attempt
      setRefreshing(false);
    }
  }, []); // db could be a dependency if it could change, but usually it's stable.

  const renderUserItem = useCallback(({ item }) => {
    // ... (your existing renderUserItem - seems fine)
    const imageUriForList = item.profileImage || defaultProfileImage;
    return (
      <TouchableOpacity
        onPress={() => {
          const userForDetailScreen = { ...item, profileImage: imageUriForList };
          navigation.navigate('UserDetail', { user: userForDetailScreen });
        }}
        style={styles.userItem}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: imageUriForList }}
          style={styles.profileImage}
          onError={(e) => console.warn(`List Image load error for URI: ${imageUriForList} (User: ${item.name || item.id})`, e.nativeEvent.error)}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>{item.name || 'Unnamed User'}</Text>
          <Text style={[styles.status, item.verificationStatus === 'Verified' ? styles.verified : styles.unverified]}>
            {item.verificationStatus || 'Not Applied'}
          </Text>
        </View>
         <Icon name="chevron-right" size={22} color="#B0BEC5" style={styles.chevronIcon}/>
      </TouchableOpacity>
    );
  }, [navigation]);

  const renderListEmptyComponent = () => {
    // ... (your existing renderListEmptyComponent - seems fine)
      if (loading && !refreshing) {
          return null;
      }
      if (filteredUsers.length === 0) {
          if (searchQuery.trim() || filter !== 'All') {
              return (
                  <View style={styles.emptyListContainer}>
                      <Icon name="account-search-outline" size={40} color="#ccc" />
                      <Text style={styles.emptyListText}>No users match your search or filter.</Text>
                  </View>
              );
          } else if (users.length === 0) {
              return (
                  <View style={styles.emptyListContainer}>
                      <Icon name="account-group-outline" size={40} color="#ccc" />
                      <Text style={styles.emptyListText}>No users found in the system.</Text>
                       <Text style={styles.emptyListSubText}>Pull down to refresh or add new users.</Text>
                  </View>
              );
          } else {
             return (
                  <View style={styles.emptyListContainer}>
                      <Icon name="account-multiple-outline" size={40} color="#ccc" />
                      <Text style={styles.emptyListText}>No users to display with current criteria.</Text>
                  </View>
              );
          }
      }
      return null;
  };

  return (
    <View style={styles.container}>
      {/* --- HEADER --- */}
      {/* ... (your existing header - seems fine) ... */}
      <View style={styles.headerContainer}>
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
        <View style={styles.filterContainer}>
           {['All', 'Verified', 'Unverified'].map(filterItem => (
             <TouchableOpacity
               key={filterItem}
               style={[ styles.filterButton, filter === filterItem && styles.activeFilter ]}
               onPress={() => setFilter(filterItem)}
             >
               <Text style={[ styles.filterText, filter === filterItem && styles.activeFilterText ]}>{filterItem}</Text>
             </TouchableOpacity>
           ))}
        </View>
      </View>

      {/* --- LOADING / LIST DISPLAY --- */}
      {loading && users.length === 0 && !refreshing ? (
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh} // This now calls the modified onRefresh
              colors={["#FF0000"]}
              tintColor={"#FF0000"}
            />
          }
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={11}
        />
      )}
    </View>
  );
};

// ... (your existing styles - seem fine)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingTop: 1,
  },
  headerContainer: {
    backgroundColor: '#FF0000',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 5,
    paddingHorizontal: 15,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
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
    paddingVertical: 0,
  },
  clearSearchButton: {
      padding: 5,
      marginLeft: 5,
  },
  filterContainer: {
    marginTop: 12,
    paddingBottom: 2,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  filterButton: {
    paddingVertical: 5,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FF0000',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    marginRight: 8,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: width / 3.8, // Make buttons somewhat equal width
    textAlign: 'center',
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
    paddingHorizontal: 30,
    paddingVertical: 20,
    marginTop: height * 0.05,
  },
  emptyListText: {
    fontSize: 17,
    color: "#666",
    textAlign: "center",
    marginTop: 15,
    fontWeight: '500',
  },
  emptyListSubText: {
      fontSize: 14,
      color: "#888",
      textAlign: "center",
      marginTop: 8,
  },
});

export default UsersScreen;