// SupportChatScreen.js (Complete Code - Includes Firestore Name in Notification)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image,
  SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons'; // Ensure installed/linked
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { db, auth } from '../../firebaseConfig'; // Verify this path
import {
  collection, query, orderBy, onSnapshot, addDoc, doc,
  updateDoc, serverTimestamp, getDoc, getDocs, where, limit, writeBatch
} from 'firebase/firestore';
import { format } from 'date-fns'; // Ensure installed: npm install date-fns
import axios from 'axios'; // Ensure installed: npm install axios

// --- Constants ---
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const placeholderAvatar = 'https://via.placeholder.com/50'; // Default if admin has no image
// *** IMPORTANT: Define the UID of the Admin who handles support chats ***
const SUPPORT_ADMIN_UID = "fCCDQ77mAOXOWUjDUNqzVWi9awF3"; // Your Admin UID
// *** ADJUST THIS HEADER HEIGHT VALUE CAREFULLY ***
const HEADER_HEIGHT = Platform.OS === 'ios' ? 60 : 75; // Example starting values

// --- Helper Function to Fetch Recipient Token ---
async function getRecipientToken(recipientId) {
    if (!recipientId) { console.error("[getRecipientToken] recipientId missing."); return null; }
    console.log(`[getRecipientToken] Fetching token for recipientId: ${recipientId}`);
    let token = null;
    try {
        const userDocRef = doc(db, "Users", recipientId); // Check Users first
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            token = userDocSnap.data()?.expoPushToken;
            console.log(`[getRecipientToken] Token found in Users: ${token ? 'Yes' : 'No'}`);
        } else {
            console.log(`[getRecipientToken] Not in Users, trying Admin for ${recipientId}...`);
            const adminDocRef = doc(db, "Admin", recipientId); // Check Admin next
            const adminDocSnap = await getDoc(adminDocRef);
            if (adminDocSnap.exists()) {
                token = adminDocSnap.data()?.expoPushToken;
                console.log(`[getRecipientToken] Token found in Admin: ${token ? 'Yes' : 'No'}`);
            } else {
                console.warn(`[getRecipientToken] Recipient doc not found in Users/Admin: ${recipientId}`);
            }
        }
        // Validate token format
        if (token && typeof token === 'string' && token.startsWith('ExponentPushToken[')) {
            return token;
        } else if (token) {
            console.warn(`[getRecipientToken] Invalid token format for ${recipientId}:`, token); return null;
        } else { return null; } // No token found or invalid format
    } catch (error) { console.error(`[getRecipientToken] Error fetching token for ${recipientId}:`, error); return null; }
}

// --- Main Component ---
export default function SupportChatScreen() {
  const navigation = useNavigation();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatId, setChatId] = useState(null); // Determined chat ID
  const [loading, setLoading] = useState(true); // Loading messages state
  const [findingChat, setFindingChat] = useState(true); // Finding/creating chat state
  const [sending, setSending] = useState(false); // Sending message state
  const flatListRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null); // Logged-in user info { uid, name }
  const [supportAdminName, setSupportAdminName] = useState('Support'); // Admin display name
  const [supportAdminAvatar, setSupportAdminAvatar] = useState(placeholderAvatar); // Admin avatar URL

  // --- Get Current User State (Fetches name from Firestore) ---
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (userAuth) => { // Marked async
      if (userAuth) {
        let fetchedUserName = userAuth.displayName; // Start with Auth display name
        // --- Fetch name from Firestore 'Users' collection ---
        try {
            const userRef = doc(db, "Users", userAuth.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists() && userSnap.data()?.name) {
                // *** Use the name field from Firestore if it exists ***
                fetchedUserName = userSnap.data().name;
                console.log(`[SupportChatScreen] Fetched user name "${fetchedUserName}" from Firestore.`);
            } else {
                // Fallback if no Firestore name
                fetchedUserName = fetchedUserName || `User ${userAuth.uid.substring(0,5)}`;
                console.log(`[SupportChatScreen] Using fallback user name: "${fetchedUserName}"`);
            }
        } catch (error) {
            console.error("[SupportChatScreen] Error fetching user name from Firestore:", error);
            fetchedUserName = fetchedUserName || `User ${userAuth.uid.substring(0,5)}`; // Fallback on error
        }
        // --- End Fetch name from Firestore ---
        // Set state with UID and the determined name
        setCurrentUser({ uid: userAuth.uid, name: fetchedUserName });
        console.log("[SupportChatScreen] User authenticated:", userAuth.uid);

      } else {
        // User logged out
        setCurrentUser(null); setChatId(null); setMessages([]); setLoading(false); setFindingChat(false);
        console.warn("[SupportChatScreen] No authenticated user.");
      }
    });
    return unsubscribe; // Cleanup listener
  }, []); // Run once on mount

  // --- Fetch Support Admin Profile ---
  useEffect(() => {
      const fetchAdminProfile = async () => {
          if (!SUPPORT_ADMIN_UID) { console.warn("[SupportChatScreen] SUPPORT_ADMIN_UID is not defined."); return; };
          console.log("[SupportChatScreen] Fetching profile for admin:", SUPPORT_ADMIN_UID);
          try {
              const adminRef = doc(db, "Admin", SUPPORT_ADMIN_UID);
              const adminSnap = await getDoc(adminRef);
              if(adminSnap.exists()) {
                  const adminData = adminSnap.data();
                  setSupportAdminName(adminData?.name || 'Support');
                  setSupportAdminAvatar(adminData?.profileImage || placeholderAvatar);
                  console.log("[SupportChatScreen] Admin profile fetched.");
              } else { console.warn("[SupportChatScreen] Support Admin document not found:", SUPPORT_ADMIN_UID); }
          } catch(error) { console.error("[SupportChatScreen] Error fetching support admin profile:", error); }
      };
      fetchAdminProfile();
  }, []); // Run once

  // --- Find or Create Chat Logic ---
  useFocusEffect(
    useCallback(() => {
      // Exit if user or admin ID is missing
      if (!currentUser || !SUPPORT_ADMIN_UID) { setFindingChat(false); return; }

      console.log(`[SupportChatScreen] Finding/Creating chat for user ${currentUser.uid}`);
      setFindingChat(true); setMessages([]); setChatId(null); // Reset state

      const findOrCreateChat = async () => {
        try {
          const chatsRef = collection(db, "Chats");
          // Query for support chats containing the current user
          const q = query(chatsRef, where("isSupportChat", "==", true), where("users", "array-contains", currentUser.uid));
          const querySnapshot = await getDocs(q);
          let existingChatId = null;

          // Client-side filter to find the specific chat with the support admin
          querySnapshot.forEach((docSnap) => {
            if (docSnap.data().users?.includes(SUPPORT_ADMIN_UID)) {
              existingChatId = docSnap.id;
            }
          });

          if (existingChatId) { // Chat found
            console.log(`[SupportChatScreen] Existing support chat found: ${existingChatId}`);
            setChatId(existingChatId);
          } else { // Chat not found, create it
            console.log("[SupportChatScreen] Creating new support chat...");
            const newChatData = {
              users: [currentUser.uid, SUPPORT_ADMIN_UID],
              isSupportChat: true,
              createdAt: serverTimestamp(),
              lastMessage: null, lastMessageTimestamp: null, lastSenderId: null,
            };
            const newChatRef = await addDoc(chatsRef, newChatData);
            console.log(`[SupportChatScreen] New support chat created: ${newChatRef.id}`);
            setChatId(newChatRef.id); // Set the ID of the newly created chat
          }
        } catch (error) {
          console.error("[SupportChatScreen] Error finding or creating chat:", error);
          Alert.alert("Error", "Could not initiate support chat.");
        } finally {
          setFindingChat(false); // Done finding/creating
        }
      };
      findOrCreateChat();
    }, [currentUser]) // Dependency: currentUser state
  );

  // --- Fetch Messages Effect ---
  useEffect(() => {
    // Only run if we have a valid chatId
    if (!chatId) {
        console.log("[SupportChatScreen] No chatId yet, skipping message listener.");
        if (!findingChat) setLoading(false); // Stop loading if finding finished with no chat ID
        return;
    }
    console.log(`[SupportChatScreen] Setting up message listener for determined chatId: ${chatId}`);
    setLoading(true);
    const messagesRef = collection(db, "Chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`[SupportChatScreen] Messages snapshot received: ${snapshot.docs.length} messages.`);
      const fetchedMessages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter(msg => msg.timestamp);
      setMessages(fetchedMessages);
      setLoading(false);
    }, (error) => {
      console.error(`[SupportChatScreen] Error fetching messages for chat ${chatId}: `, error);
      Alert.alert("Error", "Could not load messages.");
      setLoading(false);
    });
    // Cleanup listener
    return () => { console.log(`[SupportChatScreen] Cleaning up listener: ${chatId}`); unsubscribe(); };
  }, [chatId]); // Dependency: chatId state

  // --- Mark Messages as Seen Effect ---
  useFocusEffect(
    useCallback(() => {
      if (!chatId || !currentUser?.uid) return; // Need chat and user ID
      console.log(`[SupportChatScreen] Screen focused (chat ${chatId}). Marking received messages as 'seen'.`);
      const messagesRef = collection(db, "Chats", chatId, "messages");
      const q = query( messagesRef, where("receiverId", "==", currentUser.uid), where("status", "==", "sent") );
      getDocs(q).then((snapshot) => {
        if (snapshot.empty) { return; }
        console.log(`[SupportChatScreen] Found ${snapshot.docs.length} messages to mark as 'seen'.`);
        const batch = writeBatch(db);
        snapshot.docs.forEach((docSnap) => { batch.update(docSnap.ref, { status: "seen" }); });
        return batch.commit();
      })
      .then(() => { console.log("[SupportChatScreen] Marked messages as 'seen'."); })
      .catch((error) => { console.error("[SupportChatScreen] Error marking messages as seen:", error); });
    }, [chatId, currentUser?.uid]) // Dependencies
  );

  // --- Format Timestamp ---
  const formatTimestamp = (timestamp) => {
    if (!timestamp?.toDate) return '';
    try { return format(timestamp.toDate(), "HH:mm"); }
    catch (e) { console.error("Timestamp format error:", e); return ''; }
  };

  // --- Send Message Handler ---
  const handleSendMessage = async () => {
    const trimmedMessage = newMessage.trim();
    // Check all required fields, including fetched user name
    if (!trimmedMessage || sending || !chatId || !currentUser?.uid || !currentUser?.name || !SUPPORT_ADMIN_UID) {
        if (!currentUser?.name) console.warn("[handleSendMessage] Cannot send message: currentUser.name not loaded.");
        return;
    }
    setSending(true); setNewMessage('');
    const messageData = { senderId: currentUser.uid, receiverId: SUPPORT_ADMIN_UID, text: trimmedMessage, timestamp: serverTimestamp(), status: "sent" };
    const messagesCollectionRef = collection(db, "Chats", chatId, "messages");
    const chatDocRef = doc(db, "Chats", chatId);
    try {
        await addDoc(messagesCollectionRef, messageData);
        await updateDoc(chatDocRef, { lastMessage: trimmedMessage, lastMessageTimestamp: serverTimestamp(), lastSenderId: currentUser.uid });
        console.log("[SupportChatScreen] Firestore updated.");
        // --- Send Push Notification to Admin ---
        const recipientToken = await getRecipientToken(SUPPORT_ADMIN_UID);
        if (recipientToken) {
            // Use currentUser.name (fetched from Firestore/Auth) in the notification title
            const notificationPayload = {
                to: recipientToken, sound: 'default',
                title: `Support Message from ${currentUser.name}`, // Uses name from state
                body: trimmedMessage,
                data: { chatId: chatId, type: 'support_message', senderId: currentUser.uid, senderName: currentUser.name } // Also include name here
            };
            console.log("[SupportChatScreen] Sending notification payload:", JSON.stringify(notificationPayload, null, 2));
            try {
                await axios.post(EXPO_PUSH_ENDPOINT, [notificationPayload], { headers: { 'Accept': 'application/json','Content-Type': 'application/json','Accept-encoding': 'gzip, deflate'}, timeout: 10000 });
                console.log("[SupportChatScreen] Push request sent.");
            } catch (pushError) { console.error("[SupportChatScreen] Failed push send:", pushError.response?.data || pushError.message); }
        } else { console.warn(`[SupportChatScreen] No token for admin ${SUPPORT_ADMIN_UID}.`); }
    } catch (error) { console.error("[SupportChatScreen] Error sending message:", error); Alert.alert("Error", "Failed to send message."); }
    finally { setSending(false); }
  };

  // --- Render Message Item ---
  const renderMessageItem = ({ item, index }) => {
    if (!item || typeof item.senderId !== 'string') { console.warn("Invalid item in renderMessageItem:", item); return null; }
    const isMyMessage = item.senderId === currentUser?.uid;
    const isLastMessage = index === messages.length - 1;
    const showStatus = isMyMessage && isLastMessage;

    return (
      <View style={[ styles.messageBubbleContainer, isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer ]}>
        <View style={[ styles.messageBubble, isMyMessage ? styles.sentMessageBubble : styles.receivedMessageBubble ]}>
          <Text style={styles.messageText}>{String(item.text || '')}</Text>
          <View style={styles.timestampContainer}>
              {showStatus && ( <Text style={styles.statusText}>{item.status === 'seen' ? 'Seen' : 'Sent'}</Text> )}
              {item.timestamp && ( <Text style={[styles.timestamp, isMyMessage ? styles.myTimestamp : styles.theirTimestamp]}>{formatTimestamp(item.timestamp)}</Text> )}
          </View>
        </View>
      </View>
    );
  };

  // --- Main Render ---
  // Loading state while finding chat or user details
  if (findingChat || !currentUser) {
       return (
          <SafeAreaView style={styles.safeArea}>
              <View style={styles.header}>
                 <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
                 <Image source={{ uri: placeholderAvatar }} style={styles.avatar} />
                 <Text style={styles.name} numberOfLines={1}>Support</Text>
              </View>
              <ActivityIndicator size="large" color="#FF0000" style={styles.loader} />
          </SafeAreaView>
       );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header with Admin details */}
      <View style={styles.header}>
         <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
           <Ionicons name="arrow-back" size={24} color="#FFF" />
         </TouchableOpacity>
         <Image source={{ uri: supportAdminAvatar }} style={styles.avatar} defaultSource={{ uri: placeholderAvatar }} />
        <Text style={styles.name} numberOfLines={1}>{supportAdminName}</Text>
      </View>

      {/* Keyboard Avoiding View */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer} // Use style with flex: 1
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={HEADER_HEIGHT} // Use constant
      >
        {/* Messages List Area */}
        {loading && messages.length === 0 ? ( // Show loader only if loading AND list is empty
            <ActivityIndicator size="large" color="#FF0000" style={styles.loader} />
        ) : !chatId ? ( // Show error if chat ID couldn't be determined after trying
            <View style={styles.emptyChatContainer}><Text style={styles.emptyChatText}>Could not load support chat.</Text></View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={(item) => item.id}
            style={styles.flatList} // Has flex: 1
            contentContainerStyle={styles.messagesContainer}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={!loading ? <Text style={styles.emptyChatText}>Send a message to start talking to support.</Text> : null}
            extraData={messages.length > 0 ? messages[messages.length - 1].status : null} // Hint for status re-render
          />
        )}
        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TextInput
            placeholder="Type your message to support..."
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            placeholderTextColor="#A0A0A0"
            editable={!findingChat && !!chatId} // Enable input only when chat is ready
          />
          <TouchableOpacity
             onPress={handleSendMessage}
             style={[styles.sendButton, (sending || !newMessage.trim() || !chatId || findingChat) && styles.sendButtonDisabled]}
             disabled={sending || !newMessage.trim() || !chatId || findingChat} // Disable button based on state
          >
            {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <FontAwesome name="paper-plane" size={18} color="#FFF" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      {/* End KeyboardAvoidingView */}
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFFFFF', },
    header: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 10 : 10, paddingBottom: 12, paddingHorizontal: 10, backgroundColor: '#FF0000', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 4, },
    backButton: { padding: 8, marginRight: 8, },
    avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: '#E0E0E0', },
    name: { fontSize: 17, fontWeight: '600', color: '#FFF', flexShrink: 1, },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center', },
    emptyChatContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
    emptyChatText: { textAlign: 'center', marginTop: 50, color: '#A0A0A0', fontSize: 15, },
    keyboardAvoidingContainer: { // Style for KAV
        flex: 1,
    },
    flatList: {
        flex: 1, // Important for KAV behavior='height'
        backgroundColor: '#FFFFFF',
    },
    messagesContainer: { paddingHorizontal: 10, paddingTop: 15, paddingBottom: 10, },
    messageBubbleContainer: { flexDirection: 'row', marginVertical: 5, },
    myMessageContainer: { justifyContent: 'flex-end', marginLeft: 60, },
    theirMessageContainer: { justifyContent: 'flex-start', marginRight: 60, },
    messageBubble: { maxWidth: '85%', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 18, minHeight: 38, justifyContent: 'center', },
    sentMessageBubble: { backgroundColor: '#FF0000', borderBottomRightRadius: 6, }, // Red background
    receivedMessageBubble: { backgroundColor: '#212121', borderBottomLeftRadius: 6, }, // Dark background
    messageText: { fontSize: 15, color: '#FFFFFF', lineHeight: 20, }, // White text
    timestampContainer: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, },
    timestamp: { fontSize: 10, opacity: 0.8, marginLeft: 8, },
    myTimestamp: { color: '#FFD1D1', }, // Light red/pink
    theirTimestamp: { color: '#B0B0B0', }, // Light grey
    statusText: { fontSize: 10, opacity: 0.8, color: '#FFD1D1', marginRight: 4 }, // Same color as sent timestamp
    inputContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#CCCCCC', backgroundColor: '#F9F9F9', },
    input: { flex: 1, minHeight: 42, maxHeight: 120, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 8, borderRadius: 21, backgroundColor: "#FFFFFF", fontSize: 16, marginRight: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E0E0E0', },
    sendButton: { backgroundColor: '#FF0000', width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1, elevation: 2, },
    sendButtonDisabled: { backgroundColor: '#FF9999', elevation: 0, },
});