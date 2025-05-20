// UserVerificationScreen.js (Updated with Real-Time onSnapshot Listener)

import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import {
  View, Text, Image, TouchableOpacity, FlatList, StyleSheet,
  Dimensions, Platform, ActivityIndicator, SafeAreaView, RefreshControl, Alert // Added Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
// Updated Firestore imports
import { getFirestore, collection, query, where, onSnapshot, doc, getDoc, orderBy } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native'; // Import useNavigation
import { db } from '../../firebaseConfig'; // Ensure db is exported from your config

const { width } = Dimensions.get('window');
const defaultProfileImageUri = 'https://www.w3schools.com/w3images/avatar2.png'; // Your default

const UserVerificationScreen = () => { // Removed navigation prop, using hook instead
  const navigation = useNavigation(); // Get navigation object
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // Keep for manual refresh

  // --- Function to setup the real-time listener ---
  const setupVerificationListener = useCallback(() => {
    console.log("[UserVerificationScreen] Setting up Firestore listener...");
    setLoading(true); // Indicate loading when listener is (re)attached

    const usersRef = collection(db, 'Users');
    // Query for users with 'Pending' status, optionally order
    const q = query(
        usersRef,
        where('verificationStatus', '==', 'Pending')
        // You might want to order requests, e.g., by timestamp
        // orderBy('verificationRequestTimestamp', 'desc') // Requires index if added
    );

    // Attach the snapshot listener
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      console.log(`[UserVerificationScreen] Snapshot received: ${querySnapshot.docs.length} pending requests.`);
      const usersList = [];
      querySnapshot.forEach((docSnap) => {
        const userData = docSnap.data();
        usersList.push({
          id: docSnap.id,
          // Ensure required fields exist or provide fallbacks
          name: userData.name || `User ${docSnap.id.substring(0,5)}`, // Get name
          profilePic: userData.profileImage || defaultProfileImageUri, // Use profile or default
          // Include other data needed for detail screen if necessary
          verificationImages: userData.verificationImages,
          verificationStatus: userData.verificationStatus,
          // ... potentially other user data like email, phone etc.
          ...userData // Spread remaining data cautiously
        });
      });

      // Optional: Sort client-side if not ordering in the query
      // usersList.sort((a, b) => (b.verificationRequestTimestamp?.seconds ?? 0) - (a.verificationRequestTimestamp?.seconds ?? 0));

      setRequests(usersList); // Update state with the latest list
      setLoading(false); // Stop loading indicator
      setRefreshing(false); // Stop refresh indicator if it was active

    }, (error) => { // Handle errors from the listener
      console.error("[UserVerificationScreen] Error listening to verification requests:", error);
      Alert.alert("Error", "Could not fetch verification requests.");
      setLoading(false);
      setRefreshing(false);
    });

    // Return the unsubscribe function for cleanup
    return unsubscribe;

  }, []); // Empty dependency array means this setup function is created once

  // --- Effect to manage the listener ---
  useEffect(() => {
    // Setup the listener when the component mounts
    const unsubscribe = setupVerificationListener();

    // Clean up the listener when the component unmounts
    return () => {
        console.log("[UserVerificationScreen] Cleaning up listener.");
        unsubscribe();
    };
  }, [setupVerificationListener]); // Depend on the setup function

  // --- Handle Refresh ---
  // Re-running setupVerificationListener might not be the most efficient way,
  // but it ensures a fresh fetch if the listener somehow disconnected.
  // Often, with onSnapshot, pull-to-refresh is less necessary.
  const handleRefresh = useCallback(() => {
    console.log("[UserVerificationScreen] Manual refresh triggered.");
    setRefreshing(true);
    // Re-setup listener logic - might cause a brief flash, but ensures data fetch
    const unsubscribe = setupVerificationListener();
    // Optionally, could just rely on the existing listener if confident
    // setRefreshing(false) will be called inside the onSnapshot callback
    // Or add a timeout to stop refreshing if listener doesn't respond quickly
    // setTimeout(() => setRefreshing(false), 3000); // Example timeout
    // Cleanup immediately if component unmounts during refresh? Less likely.
    // return () => unsubscribe(); // Probably not needed here
  }, [setupVerificationListener]);

  // --- Render Item ---
   const renderRequestItem = ({ item }) => (
     <TouchableOpacity
       onPress={() => navigation.navigate('UserVerificationDetail', { user: item })} // Pass user data
       style={styles.requestCard}
     >
       <Image source={{ uri: item.profilePic }} style={styles.profileImage} />
       <View style={styles.userInfo}>
         <Text style={styles.userName}>{item.name || 'Unknown Name'}</Text>
         {/* Optional: Show request time */}
         {/* {item.verificationRequestTimestamp && <Text style={styles.requestTime}>{formatDistanceToNowStrict(item.verificationRequestTimestamp.toDate())} ago</Text>} */}
       </View>
       {/* Keep icon on the right */}
       <Icon name="clock-o" size={18} color="orange" style={styles.statusIcon} />
     </TouchableOpacity>
   );


  // --- Main Render ---
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['red', 'red']} style={styles.gradientBackground}>
        <Text style={styles.headerTitle}>User Verification Requests</Text>
      </LinearGradient>

      {/* Loading Indicator (Show only initially) */}
      {loading && requests.length === 0 ? (
        <ActivityIndicator size="large" color="#FF4500" style={styles.loader} />
      ) : (
        // FlatList for displaying requests
        <FlatList
          data={requests}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.listContent, requests.length === 0 && styles.emptyListContainer ]} // Apply style for centering empty text
          renderItem={renderRequestItem} // Use the renamed function
          ListEmptyComponent={ // Show message only when not loading and list is empty
              !loading ? <Text style={styles.emptyText}>No pending verification requests found.</Text> : null
          }
          // Pull-to-refresh control
          refreshControl={
            <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#FF4500" // iOS color
                colors={["#FF4500"]} // Android color(s)
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  gradientBackground: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    // Removed absolute positioning if it was there
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFF' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' }, // Make loader take full space
  listContent: { paddingBottom: 10 }, // Padding at the bottom of the list
  emptyListContainer: { // Added style to center empty text when list takes full height
      flex: 1, // Make container take remaining space
      justifyContent: 'center', // Center content vertically
      alignItems: 'center', // Center content horizontally
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12, // Adjusted padding
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFF' // White background for cards
  },
  profileImage: {
    width: 50, // Consistent size
    height: 50,
    borderRadius: 25, // Circular
    marginRight: 15,
    backgroundColor: '#EEEEEE' // Placeholder background
  },
  userInfo: {
    flex: 1, // Take available horizontal space
    justifyContent: 'center', // Center text vertically if needed
  },
  userName: {
    fontSize: 17, // Slightly smaller name
    fontWeight: '600', // Medium weight
    color: '#333',
    marginBottom: 2, // Add space below name if showing timestamp
  },
  // Optional style for request time
  // requestTime: {
  //    fontSize: 12,
  //    color: '#777',
  // },
  statusIcon: {
     marginLeft: 10 // Keep some space from user info
   },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: 'gray',
    marginTop: 20 // Remove top margin if using emptyListContainer style
   },
});

export default UserVerificationScreen;