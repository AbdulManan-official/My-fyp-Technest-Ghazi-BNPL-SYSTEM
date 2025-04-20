// MessageDetailScreen.js (Complete Code - Updated 20/April/2024)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Image, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator, Alert
} from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons'; // Ensure installed/linked
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { db, auth } from '../../firebaseConfig'; // Verify this path
import {
  collection, query, orderBy, onSnapshot, addDoc, doc,
  updateDoc, serverTimestamp, getDoc, writeBatch, where, getDocs
} from 'firebase/firestore';
import { format } from 'date-fns'; // Ensure installed: npm install date-fns
import axios from 'axios'; // Ensure installed: npm install axios

// --- Constants ---
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const placeholderAvatar = 'https://via.placeholder.com/40'; // Default avatar
// *** CALCULATE OR ESTIMATE YOUR HEADER HEIGHT ***
// Adjust this value based on your header's actual rendered height
const HEADER_HEIGHT = Platform.OS === 'ios' ? 60 : 75;

// --- Helper Function to Fetch Recipient Token ---
// Defined within this file or imported from a shared utility file
async function getRecipientToken(recipientId) {
    if (!recipientId) { console.error("[getRecipientToken] recipientId missing."); return null; }
    console.log(`[getRecipientToken] Fetching token for recipientId: ${recipientId}`);
    let token = null;
    try {
        const userDocRef = doc(db, "Users", recipientId); // Check Users collection
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            token = userDocSnap.data()?.expoPushToken;
            console.log(`[getRecipientToken] Token found in Users: ${token ? 'Yes' : 'No'}`);
        } else {
            console.log(`[getRecipientToken] Not in Users, trying Admin for ${recipientId}...`);
            const adminDocRef = doc(db, "Admin", recipientId); // Check Admin collection
            const adminDocSnap = await getDoc(adminDocRef);
            if (adminDocSnap.exists()) {
                token = adminDocSnap.data()?.expoPushToken;
                console.log(`[getRecipientToken] Token found in Admin: ${token ? 'Yes' : 'No'}`);
            } else {
                console.warn(`[getRecipientToken] Recipient doc not found in Users/Admin: ${recipientId}`);
            }
        }
        if (token && typeof token === 'string' && token.startsWith('ExponentPushToken[')) {
            return token; // Return valid token
        } else if (token) {
            console.warn(`[getRecipientToken] Invalid token format for ${recipientId}:`, token); return null;
        } else {
            return null; // No token found
        }
    } catch (error) {
        console.error(`[getRecipientToken] Error fetching token for ${recipientId}:`, error);
        return null;
    }
}

// --- Main Component ---
export default function MessageDetailScreen({ route }) {
  // --- State ---
  const navigation = useNavigation();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);
  const [senderName, setSenderName] = useState('User'); // Name of the user viewing the screen

  // --- Route Params ---
  // Destructure params passed from navigation (AdminMessageScreen or potentially user's list)
  const {
      chatId,             // Firestore document ID of the chat
      loggedInUserId,     // Firebase Auth UID of the person using this screen
      users,              // Array of participant UIDs [user1_id, user2_id]
      recipientName,      // Display name of the OTHER person
      recipientAvatar,    // Display avatar of the OTHER person
      // isAdminChat,     // Can be used for conditional logic if needed
      // otherUserId      // Can derive receiverId from users & loggedInUserId
    } = route.params;

  // --- Fetch Sender's Name Effect ---
  useEffect(() => {
       const fetchSenderProfile = async () => {
           if (!loggedInUserId) return;
           let name = 'User'; // Default name
           try {
               // Check both Admin and Users collections for the logged-in user's profile
               const adminRef = doc(db, "Admin", loggedInUserId);
               const adminSnap = await getDoc(adminRef);
               if (adminSnap.exists()) {
                   name = adminSnap.data()?.name || 'Support';
               } else {
                   const userRef = doc(db, "Users", loggedInUserId);
                   const userSnap = await getDoc(userRef);
                   if (userSnap.exists()) {
                       name = userSnap.data()?.name || `User ${loggedInUserId.substring(0, 5)}`;
                   }
               }
               setSenderName(name); // Set the fetched name
           } catch (error) {
               console.error("[MessageDetailScreen] Error fetching sender name:", error);
           }
       };
       fetchSenderProfile();
   }, [loggedInUserId]); // Dependency: loggedInUserId

  // --- Fetch Messages Effect (Real-time) ---
  useEffect(() => {
    // Validate required parameters
    if (!chatId || !loggedInUserId) {
      console.error("[MessageDetailScreen] Missing critical route params (chatId or loggedInUserId).", route.params);
      Alert.alert("Error", "Cannot load chat details.");
      setLoading(false);
      if (navigation.canGoBack()) navigation.goBack();
      return;
    }

    console.log(`[MessageDetailScreen] Setting up message listener for chatId: ${chatId}`);
    setLoading(true);

    // Reference the 'messages' subcollection
    const messagesRef = collection(db, "Chats", chatId, "messages");
    // Query ordered by timestamp
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    // Attach listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`[MessageDetailScreen] Messages snapshot received: ${snapshot.docs.length} messages.`);
      const fetchedMessages = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter(msg => msg.timestamp); // Ensure timestamp exists
      setMessages(fetchedMessages);
      setLoading(false);
    }, (error) => { // Error handling for the listener
      console.error(`[MessageDetailScreen] Error fetching messages for chat ${chatId}: `, error);
      Alert.alert("Error", "Could not load messages.");
      setLoading(false);
    });

    // Cleanup listener on unmount
    return () => {
      console.log(`[MessageDetailScreen] Cleaning up message listener for chatId: ${chatId}`);
      unsubscribe();
    };
  }, [chatId, loggedInUserId, navigation]); // Dependencies

  // --- Mark Messages as Seen Effect (on screen focus) ---
  useFocusEffect(
    useCallback(() => {
      if (!chatId || !loggedInUserId) return; // Need IDs

      console.log(`[MessageDetailScreen] Screen focused (chat ${chatId}). Checking for received 'sent' messages.`);
      const messagesRef = collection(db, "Chats", chatId, "messages");
      // Query for messages sent TO me with status "sent"
      const q = query(
        messagesRef,
        where("receiverId", "==", loggedInUserId),
        where("status", "==", "sent")
      );

      // One-time fetch to update status
      getDocs(q).then((snapshot) => {
        if (snapshot.empty) {
          console.log("[MessageDetailScreen] No messages to mark as 'seen'.");
          return; // Nothing to do
        }

        console.log(`[MessageDetailScreen] Found ${snapshot.docs.length} message(s) to mark as 'seen'.`);
        const batch = writeBatch(db); // Use batch for atomic update
        snapshot.docs.forEach((docSnap) => {
          batch.update(docSnap.ref, { status: "seen" }); // Update field
        });
        return batch.commit(); // Commit the batch
      })
      .then(() => {
          console.log("[MessageDetailScreen] Marked messages as 'seen' successfully.");
      })
      .catch((error) => {
          console.error("[MessageDetailScreen] Error marking messages as 'seen':", error);
      });
    }, [chatId, loggedInUserId]) // Dependencies
  );

  // --- Format Timestamp ---
  const formatTimestamp = (timestamp) => {
    if (!timestamp?.toDate) return '';
    try { return format(timestamp.toDate(), "HH:mm"); }
    catch (e) { return ''; }
  };

  // --- Send Message Handler ---
  const handleSendMessage = async () => {
    const trimmedMessage = newMessage.trim();
    // Basic validation
    if (!trimmedMessage || sending || !chatId || !loggedInUserId || !users) return;

    // Find the recipient's UID from the users array
    const receiverId = users.find(userId => userId !== loggedInUserId);
    if (!receiverId) {
        Alert.alert("Error", "Cannot determine message recipient.");
        console.error("[handleSendMessage] Could not find receiverId in users array:", users);
        return;
    }

    setSending(true);
    setNewMessage(''); // Clear input

    // Message data object, including the initial 'sent' status
    const messageData = {
        senderId: loggedInUserId,
        receiverId: receiverId,
        text: trimmedMessage,
        timestamp: serverTimestamp(),
        status: "sent", // Set initial status
    };

    // Firestore references
    const messagesCollectionRef = collection(db, "Chats", chatId, "messages");
    const chatDocRef = doc(db, "Chats", chatId);

    try {
      // --- Firestore Writes ---
      // 1. Add new message document
      console.log("[handleSendMessage] Adding message with status 'sent'...");
      await addDoc(messagesCollectionRef, messageData);
      // 2. Update parent chat document for preview/sorting
      await updateDoc(chatDocRef, {
        lastMessage: trimmedMessage,
        lastMessageTimestamp: serverTimestamp(),
        lastSenderId: loggedInUserId,
      });
      console.log("[handleSendMessage] Firestore updated.");

      // --- Push Notification ---
      console.log("[handleSendMessage] Attempting notification...");
      const recipientToken = await getRecipientToken(receiverId);
      if (recipientToken) {
          const notificationPayload = {
              to: recipientToken, sound: 'default',
              title: `New Message from ${senderName || 'User'}`, body: trimmedMessage,
              data: { chatId: chatId, type: 'new_message', senderId: loggedInUserId, recipientName: senderName }
          };
          console.log("[handleSendMessage] Sending notification payload:", JSON.stringify(notificationPayload, null, 2));
          try {
              await axios.post(EXPO_PUSH_ENDPOINT, [notificationPayload], {
                  headers: { 'Accept': 'application/json','Content-Type': 'application/json','Accept-encoding': 'gzip, deflate' },
                  timeout: 10000
              });
              console.log("[handleSendMessage] Push request sent.");
          } catch (pushError) {
              console.error("[handleSendMessage] Failed push send:", pushError.response?.data || pushError.message);
          }
      } else {
          console.warn(`[handleSendMessage] No token for recipient ${receiverId}.`);
      }

    } catch (error) {
      console.error("[handleSendMessage] Error sending message:", error);
      Alert.alert("Error", "Failed to send message.");
      // Optional: Restore text on failure
      // setNewMessage(trimmedMessage);
    } finally {
      setSending(false); // Reset sending state
    }
  };

  // --- Render Message Item ---
  const renderMessageItem = ({ item, index }) => {
    if (!item || typeof item.senderId !== 'string') return null; // Basic validation
    const isMyMessage = item.senderId === loggedInUserId;
    const isLastMessage = index === messages.length - 1;
    const showStatus = isMyMessage && isLastMessage; // Determine if status should be shown

    return (
      <View style={[ styles.messageBubbleContainer, isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer ]}>
        <View style={[ styles.messageBubble, isMyMessage ? styles.sentMessageBubble : styles.receivedMessageBubble ]}>
          {/* Message Text */}
          <Text style={styles.messageText}>{String(item.text || '')}</Text>
          {/* Container for Timestamp & Status */}
          <View style={styles.timestampContainer}>
              {/* Status Text (conditional) */}
              {showStatus && (
                 <Text style={styles.statusText}>
                     {item.status === 'seen' ? 'Seen' : 'Sent'}
                 </Text>
               )}
              {/* Timestamp */}
              {item.timestamp && (
                <Text style={[styles.timestamp, isMyMessage ? styles.myTimestamp : styles.theirTimestamp]}>
                    {formatTimestamp(item.timestamp)}
                </Text>
              )}
          </View>
        </View>
      </View>
    );
  };

  // --- Main Render ---
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
         <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
             <Ionicons name="arrow-back" size={24} color="#FFF" />
         </TouchableOpacity>
         {recipientAvatar && (
             <Image
                 source={{ uri: recipientAvatar }}
                 style={styles.avatar}
                 defaultSource={{ uri: placeholderAvatar }} // Use placeholder for loading/error
             />
         )}
         <Text style={styles.name} numberOfLines={1}>{recipientName || "Chat"}</Text>
      </View>

      {/* Keyboard Avoiding View */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer} // Use specific style
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={HEADER_HEIGHT}
      >
        {/* Messages List Area */}
        {loading ? (
            <ActivityIndicator size="large" color="#FF0000" style={styles.loader} />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={(item) => item.id}
            style={styles.flatList}
            contentContainerStyle={styles.messagesContainer}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={<Text style={styles.emptyChatText}>No messages yet.</Text>}
            // Help FlatList know when to re-render based on status change in last item
            extraData={messages.length > 0 ? messages[messages.length - 1].status : null}
          />
        )}

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TextInput
            placeholder="Type a message..."
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            placeholderTextColor="#A0A0A0"
          />
          <TouchableOpacity
             onPress={handleSendMessage}
             style={[ styles.sendButton, (sending || !newMessage.trim()) && styles.sendButtonDisabled ]}
             disabled={sending || !newMessage.trim()}
          >
            {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <FontAwesome name="paper-plane" size={18} color="#FFF" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  // Style for the KeyboardAvoidingView to make it take up remaining space
  keyboardAvoidingContainer: {
      flex: 1,
  },
  flatList: {
      flex: 1, // Allow FlatList to grow/shrink within KeyboardAvoidingView
      backgroundColor: '#FFFFFF',
  },
  messagesContainer: { paddingHorizontal: 10, paddingTop: 15, paddingBottom: 10, }, // Padding for messages
  emptyChatText: { textAlign: 'center', marginTop: 50, color: '#A0A0A0', fontSize: 15, },
  messageBubbleContainer: { flexDirection: 'row', marginVertical: 5, },
  myMessageContainer: { justifyContent: 'flex-end', marginLeft: 60, },
  theirMessageContainer: { justifyContent: 'flex-start', marginRight: 60, },
  messageBubble: { maxWidth: '85%', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 18, minHeight: 38, justifyContent: 'center', },
  sentMessageBubble: { backgroundColor: '#FF0000', borderBottomRightRadius: 6, }, // Red sent bubble
  receivedMessageBubble: { backgroundColor: '#212121', borderBottomLeftRadius: 6, }, // Dark received bubble
  messageText: { fontSize: 15, color: '#FFFFFF', lineHeight: 20, }, // White text
  timestampContainer: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, },
  timestamp: { fontSize: 10, opacity: 0.8, marginLeft: 8, }, // Margin if status is present
  myTimestamp: { color: '#FFD1D1', }, // Light red/pink timestamp
  theirTimestamp: { color: '#B0B0B0', }, // Light grey timestamp
  statusText: { fontSize: 10, opacity: 0.8, color: '#FFD1D1', marginRight: 4 }, // Sent/Seen status text
  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#CCCCCC', backgroundColor: '#F9F9F9', }, // Ensure this isn't pushed out of view
  input: { flex: 1, minHeight: 42, maxHeight: 120, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 10 : 8, borderRadius: 21, backgroundColor: "#FFFFFF", fontSize: 16, marginRight: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E0E0E0', },
  sendButton: { backgroundColor: '#FF0000', width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1, elevation: 2, },
  sendButtonDisabled: { backgroundColor: '#FF9999', elevation: 0, },
});