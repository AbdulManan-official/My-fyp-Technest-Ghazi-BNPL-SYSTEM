// AdminMessageScreen.js (Using Specific Default Profile Image)

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  Platform, Dimensions, ActivityIndicator, Alert, SafeAreaView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient'; // Ensure installed: npx expo install expo-linear-gradient
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { db, auth } from '../../firebaseConfig'; // Verify this path
// Firestore functions needed
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { formatDistanceToNowStrict } from 'date-fns'; // Ensure installed: npm install date-fns
import Icon from 'react-native-vector-icons/FontAwesome'; // Ensure setup for vector icons

const { width } = Dimensions.get('window');
// *** USE YOUR SPECIFIED DEFAULT IMAGE ***
const userDefaultProfileImage = 'https://www.w3schools.com/w3images/avatar2.png';

export default function AdminMessageScreen() {
  const navigation = useNavigation();
  const [supportChats, setSupportChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminId, setAdminId] = useState(auth.currentUser?.uid || null);
  const [isAdminVerified, setIsAdminVerified] = useState(false);

  // --- Verify Admin Status ---
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setAdminId(user.uid);
        try {
          const adminRef = doc(db, "Admin", user.uid);
          const adminSnap = await getDoc(adminRef);
          const isAdmin = adminSnap.exists();
          setIsAdminVerified(isAdmin);
          if (!isAdmin) {
            console.warn("[AdminMessageScreen] User not Admin:", user.uid);
            setSupportChats([]); setLoading(false);
          } else {
            console.log("[AdminMessageScreen] Admin verified:", user.uid);
          }
        } catch (error) {
          console.error("[AdminMessageScreen] Error verify admin:", error);
          setIsAdminVerified(false); setSupportChats([]); setLoading(false);
          Alert.alert("Error", "Could not verify admin status.");
        }
      } else {
        setAdminId(null); setIsAdminVerified(false); setSupportChats([]); setLoading(false);
        console.log("[AdminMessageScreen] Admin logged out.");
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // --- Function to fetch User profile (UPDATED with specific default image) ---
  const fetchUserProfile = async (userId) => {
    // Basic validation
    if (!userId) return { name: "Unknown User", profilePic: userDefaultProfileImage }; // Use default
    try {
      // Reference the specific user document in the 'Users' collection
      const userRef = doc(db, "Users", userId);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log(`[AdminMessageScreen - fetchUserProfile] Fetched data for ${userId}:`, userData);

        // Determine profile picture: use Firestore image if valid, otherwise use default
        const profilePicUrl = (userData?.profileImage && typeof userData.profileImage === 'string' && userData.profileImage.trim() !== '')
          ? userData.profileImage // Use valid stored image URL
          : userDefaultProfileImage; // Use your specific default image URL

        return {
          // Determine name: use Firestore name, otherwise generate fallback
          name: userData?.name || `User ${userId.substring(0, 5)}`,
          profilePic: profilePicUrl // Return determined pic URL
        };
      } else {
        // Handle case where user document doesn't exist
        console.warn(`[AdminMessageScreen] User document not found for ID: ${userId}`);
        return { name: "User Not Found", profilePic: userDefaultProfileImage }; // Use default
      }
    } catch (error) {
      // Handle errors during Firestore read
      console.error(`[AdminMessageScreen] Error fetching user profile ${userId}:`, error);
      return { name: "Error Loading", profilePic: userDefaultProfileImage }; // Use default
    }
  };

  // --- Fetch Support Chats using useFocusEffect (Client-Side Sorting) ---
  useFocusEffect(
    useCallback(() => {
      // Exit early if admin isn't verified or logged in
      if (!isAdminVerified || !adminId) {
        setLoading(false); setSupportChats([]); return;
      }

      setLoading(true);
      console.log(`[AdminMessageScreen CS] Setting up listener (onSnapshot) for support chats (Client Sort) for admin: ${adminId}`);

      // Define the Firestore query (no orderBy needed here)
      const chatsRef = collection(db, 'Chats');
      const q = query(
        chatsRef,
        where("isSupportChat", "==", true),
        where("users", "array-contains", adminId)
      );

      // Attach the real-time listener
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        console.log(`[AdminMessageScreen CS] Support chat snapshot received. Found ${snapshot.docs.length} chats.`);
        if (snapshot.empty) { setSupportChats([]); setLoading(false); return; }

        // Process snapshot results
        const chatPromises = snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data(); const chatId = docSnap.id;
          const otherUserId = data.users?.find(id => id !== adminId);
          if (!otherUserId) { console.warn(`[AdminMessageScreen CS] Chat ${chatId} missing other user ID.`); return null; }
          // Fetches profile using updated function (which handles default image)
          const userProfile = await fetchUserProfile(otherUserId);
          const isUnread = data.lastSenderId !== adminId && !!data.lastMessage;
          return {
            id: chatId, userId: otherUserId, name: userProfile.name,
            message: data.lastMessage || 'No messages yet',
            timestamp: data.lastMessageTimestamp || data.createdAt || null,
            profilePic: userProfile.profilePic, // Uses fetched pic (could be default)
            isUnread: isUnread, users: data.users || [],
          };
        });

        let resolvedChats = (await Promise.all(chatPromises)).filter(chat => chat !== null);

        // Client-Side Sorting Logic
        resolvedChats.sort((a, b) => {
            const timeA = a.timestamp?.seconds ?? 0;
            const timeB = b.timestamp?.seconds ?? 0;
            return timeB - timeA; // Sort descending
        });

        setSupportChats(resolvedChats); // Update state
        setLoading(false);

      }, (error) => { // Error handler
          console.error("[AdminMessageScreen CS] Error listening to support chats:", error);
          Alert.alert("Error", "Could not load support chats.");
          setLoading(false);
      });

      // Cleanup listener
      return () => { console.log("[AdminMessageScreen CS] Cleaning up listener."); unsubscribe(); };
    }, [adminId, isAdminVerified]) // Dependencies
  );

  // --- Format Timestamp ---
  const formatTimestamp = (timestamp) => {
    if (!timestamp?.toDate) return '';
    try { return formatDistanceToNowStrict(timestamp.toDate(), { addSuffix: true }); }
    catch (e) { console.error("Timestamp format error:", e); return ''; }
  };

  // --- Render Item Function for FlatList ---
  const renderChatItem = ({ item }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => navigation.navigate('MessageDetailScreen', {
          chatId: item.id, loggedInUserId: adminId, users: item.users,
          recipientName: item.name, recipientAvatar: item.profilePic, // Passes the fetched pic (could be default)
          isAdminChat: true, otherUserId: item.userId
      })} >
      {/* Image source uses item.profilePic which now handles default */}
      <Image source={{ uri: item.profilePic }} style={styles.avatar} />
      <View style={styles.userInfo}>
        <Text style={[styles.userName, item.isUnread && styles.unreadText]}>{item.name}</Text>
        <Text style={[styles.userMessage, item.isUnread && styles.unreadText]} numberOfLines={1}>
          {item.message}
        </Text>
      </View>
      <View style={styles.metaInfo}>
         <Text style={styles.timeText}>{formatTimestamp(item.timestamp)}</Text>
         {item.isUnread && <View style={styles.unreadBadge} />}
      </View>
    </TouchableOpacity>
  );

  // --- Main Render Logic ---
   if ((loading || !isAdminVerified) && auth.currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#C40000', '#FF0000']} style={styles.gradientBackgroundFixed}>
            <Text style={styles.chatTitle}>📩 User Messages</Text>
        </LinearGradient>
        <ActivityIndicator size="large" color="#FF0000" style={styles.loader} />
      </SafeAreaView>
    );
  }

  if (!isAdminVerified && auth.currentUser) {
       return (
          <SafeAreaView style={styles.container}>
            <LinearGradient colors={['#C40000', '#FF0000']} style={styles.gradientBackgroundFixed}>
                <Text style={styles.chatTitle}>📩 User Messages</Text>
            </LinearGradient>
            <View style={styles.emptyContainer}>
               <Icon name="lock" size={50} color="#AAAAAA" style={{marginBottom: 15}} />
               <Text style={styles.emptyText}>Access Denied</Text>
            </View>
          </SafeAreaView>
       );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['red', '#FF0000']} style={styles.gradientBackgroundFixed}>
          <Text style={styles.chatTitle}>📩 User Messages</Text>
      </LinearGradient>

      {/* List or Empty State */}
      {supportChats.length === 0 && !loading ? (
          <View style={styles.emptyContainer}>
              <Icon name="comments-o" size={50} color="#AAAAAA" style={{marginBottom: 15}} />
              <Text style={styles.emptyText}>No support chats found.</Text>
          </View>
      ) : (
         <FlatList
            data={supportChats}
            keyExtractor={(item) => item.id}
            renderItem={renderChatItem}
            contentContainerStyle={styles.flatListContent}
            showsVerticalScrollIndicator={false}
         />
      )}
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', },
  gradientBackgroundFixed: { paddingTop: Platform.OS === 'ios' ? 60 : 30, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, alignItems: 'center', justifyContent: 'center', },
  chatTitle: { fontSize: 25, fontWeight: 'bold', color: '#FFF', },
  loader: { marginTop: 50, flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
  emptyText: { fontSize: 18, color: '#888', marginBottom: 10, textAlign: 'center' },
  flatListContent: { paddingBottom: 20, },
  userItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#ECECEC', },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15, backgroundColor: '#E0E0E0' }, // Placeholder bg color
  userInfo: { flex: 1, },
  userName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 2, },
  userMessage: { fontSize: 14, color: '#555', },
  unreadText: { fontWeight: 'bold', color: '#111', },
  metaInfo: { alignItems: 'flex-end', marginLeft: 10, },
  timeText: { fontSize: 11, color: 'gray', marginBottom: 5, },
  unreadBadge: { backgroundColor: "#FF0000", width: 10, height: 10, borderRadius: 5, },
});