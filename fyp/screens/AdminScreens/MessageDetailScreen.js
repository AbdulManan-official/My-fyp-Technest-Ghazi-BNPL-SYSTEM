// MessageDetailScreen.js

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator, Alert,
  StatusBar // Import StatusBar if needed for Android offset calculation, though usually not with useHeaderHeight
} from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { db, auth } from '../../firebaseConfig';
import {
  collection, query, orderBy, onSnapshot, addDoc, doc,
  updateDoc, serverTimestamp, getDoc, writeBatch, where, getDocs
} from 'firebase/firestore';
import { format } from 'date-fns';
import axios from 'axios';

// --- Constants ---
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

// --- Helper Function to Fetch Recipient Token (Unchanged) ---
async function getRecipientToken(recipientId) {
    if (!recipientId) { console.error("[getRecipientToken] recipientId missing."); return null; }
    console.log(`[getRecipientToken] Fetching token for recipientId: ${recipientId}`);
    let token = null;
    try {
        const userDocRef = doc(db, "Users", recipientId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            token = userDocSnap.data()?.expoPushToken;
            console.log(`[getRecipientToken] Token found in Users: ${token ? 'Yes' : 'No'}`);
        } else {
            console.log(`[getRecipientToken] Not in Users, trying Admin for ${recipientId}...`);
            const adminDocRef = doc(db, "Admin", recipientId);
            const adminDocSnap = await getDoc(adminDocRef);
            if (adminDocSnap.exists()) {
                token = adminDocSnap.data()?.expoPushToken;
                console.log(`[getRecipientToken] Token found in Admin: ${token ? 'Yes' : 'No'}`);
            } else {
                console.warn(`[getRecipientToken] Recipient doc not found in Users/Admin: ${recipientId}`);
            }
        }
        if (token && typeof token === 'string' && token.startsWith('ExponentPushToken[')) {
            return token;
        } else if (token) {
            console.warn(`[getRecipientToken] Invalid token format for ${recipientId}:`, token); return null;
        } else {
            return null;
        }
    } catch (error) {
        console.error(`[getRecipientToken] Error fetching token for ${recipientId}:`, error);
        return null;
    }
}

// --- Main Component ---
export default function MessageDetailScreen({ route }) {
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);
  const [senderName, setSenderName] = useState('User');

  const { chatId, loggedInUserId, users } = route.params;

  // --- Fetch Sender's Name Effect (Unchanged) ---
  useEffect(() => {
       const fetchSenderProfile = async () => {
           if (!loggedInUserId) return;
           let name = 'User';
           try {
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
               setSenderName(name);
           } catch (error) {
               console.error("[MessageDetailScreen] Error fetching sender name:", error);
           }
       };
       fetchSenderProfile();
   }, [loggedInUserId]);

  // --- Fetch Messages Effect (Unchanged) ---
  useEffect(() => {
    if (!chatId || !loggedInUserId) {
      console.error("[MessageDetailScreen] Missing critical route params.", route.params);
      Alert.alert("Error", "Cannot load chat details.");
      setLoading(false);
      if (navigation.canGoBack()) navigation.goBack();
      return;
    }
    setLoading(true);
    const messagesRef = collection(db, "Chats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter(msg => msg.timestamp);
      setMessages(fetchedMessages);
      setLoading(false);
    }, (error) => {
      console.error(`[MessageDetailScreen] Error fetching messages for chat ${chatId}: `, error);
      Alert.alert("Error", "Could not load messages.");
      setLoading(false);
    });
    return () => unsubscribe();
  }, [chatId, loggedInUserId, navigation]);

  // --- Mark Messages as Seen Effect (Unchanged) ---
  useFocusEffect(
    useCallback(() => {
      if (!chatId || !loggedInUserId) return;
      const messagesRef = collection(db, "Chats", chatId, "messages");
      const q = query( messagesRef, where("receiverId", "==", loggedInUserId), where("status", "==", "sent") );
      getDocs(q).then((snapshot) => {
        if (snapshot.empty) return;
        const batch = writeBatch(db);
        snapshot.docs.forEach((docSnap) => { batch.update(docSnap.ref, { status: "seen" }); });
        return batch.commit();
      }).catch((error) => console.error("[MessageDetailScreen] Error marking messages as 'seen':", error));
    }, [chatId, loggedInUserId])
  );

  // --- Format Timestamp (Unchanged) ---
  const formatTimestamp = (timestamp) => {
    if (!timestamp?.toDate) return '';
    try { return format(timestamp.toDate(), "HH:mm"); }
    catch (e) { return ''; }
  };

  // --- Send Message Handler (Unchanged) ---
  const handleSendMessage = async () => {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || sending || !chatId || !loggedInUserId || !users) return;
    const receiverId = users.find(userId => userId !== loggedInUserId);
    if (!receiverId) {
        Alert.alert("Error", "Cannot determine message recipient.");
        return;
    }
    setSending(true); setNewMessage('');
    const messageData = { senderId: loggedInUserId, receiverId: receiverId, text: trimmedMessage, timestamp: serverTimestamp(), status: "sent" };
    const messagesCollectionRef = collection(db, "Chats", chatId, "messages");
    const chatDocRef = doc(db, "Chats", chatId);
    try {
      await addDoc(messagesCollectionRef, messageData);
      await updateDoc(chatDocRef, { lastMessage: trimmedMessage, lastMessageTimestamp: serverTimestamp(), lastSenderId: loggedInUserId });
      const recipientToken = await getRecipientToken(receiverId);
      if (recipientToken) {
          const notificationPayload = { to: recipientToken, sound: 'default', title: `New Message from ${senderName || 'User'}`, body: trimmedMessage, data: { chatId: chatId, type: 'new_message', senderId: loggedInUserId, recipientName: senderName } };
          await axios.post(EXPO_PUSH_ENDPOINT, [notificationPayload], { headers: { 'Accept': 'application/json','Content-Type': 'application/json','Accept-encoding': 'gzip, deflate' }, timeout: 10000 });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  // --- Render Message Item (Unchanged) ---
  const renderMessageItem = ({ item, index }) => {
    if (!item || typeof item.senderId !== 'string') return null;
    const isMyMessage = item.senderId === loggedInUserId;
    const isLastMessage = index === messages.length - 1;
    const showStatus = isMyMessage && isLastMessage;
    return (
      <View style={[ styles.messageBubbleContainer, isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer ]}>
        <View style={[ styles.messageBubble, isMyMessage ? styles.sentMessageBubble : styles.receivedMessageBubble ]}>
          <Text style={styles.messageText}>{String(item.text || '')}</Text>
          <View style={styles.timestampContainer}>
              {showStatus && ( <Text style={styles.statusText}>{item.status === 'seen' ? 'Seen' : (item.status || 'Sent')}</Text> )}
              {item.timestamp && ( <Text style={[styles.timestamp, isMyMessage ? styles.myTimestamp : styles.theirTimestamp]}>{formatTimestamp(item.timestamp)}</Text> )}
          </View>
        </View>
      </View>
    );
  };

  const keyboardOffset = Platform.OS === 'ios' ? headerHeight : headerHeight; // Matches SupportChatScreen

  // --- Main Render ---
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer} // Ensure this has flex: 1
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardOffset} // Use the calculated offset
        enabled // Explicitly enabled, good practice
      >
        {/* ADDED WRAPPER VIEW with flex: 1 */}
        <View style={styles.chatContentWrapper}>
            {loading ? (
                <ActivityIndicator size="large" color="#FF0000" style={styles.loader} />
            ) : (
            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessageItem}
                keyExtractor={(item) => item.id}
                style={styles.flatList} // Ensure this has flex: 1
                contentContainerStyle={styles.messagesContainer}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })} // Changed to true for smoother feel
                onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })} // Keep false for initial layout
                ListEmptyComponent={
                    <View style={styles.emptyChatContainer}>
                        <Text style={styles.emptyChatText}>No messages yet. Be the first to send one!</Text>
                    </View>
                }
                extraData={messages.length > 0 ? messages[messages.length - 1].status : null}
            />
            )}

            <View style={styles.inputContainer}>
            <TextInput
                placeholder="Type a message..."
                style={styles.input}
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
                placeholderTextColor="#A0A0A0" // Consistent placeholder color
                editable={!sending} // Consistent editable prop
            />
            <TouchableOpacity
                onPress={handleSendMessage}
                style={[ styles.sendButton, (sending || !newMessage.trim()) && styles.sendButtonDisabled ]}
                disabled={sending || !newMessage.trim()}
            >
                {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <FontAwesome name="paper-plane" size={18} color="#FFF" />}
            </TouchableOpacity>
            </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --- Styles (Aligned with SupportChatScreen.js where applicable) ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoidingContainer: {
    flex: 1, // Crucial: KAV must fill its parent
  },
  chatContentWrapper: { // ADDED: Wrapper for chat content inside KAV
    flex: 1, // Crucial: This wrapper takes all space given by KAV
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChatContainer: { // Aligned with SupportChatScreen
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyChatText: { // Aligned with SupportChatScreen
    textAlign: 'center',
    color: '#A0A0A0',
    fontSize: 16,
  },
  flatList: {
    flex: 1, // Crucial: FlatList should expand to fill available space above input
    backgroundColor: '#FFFFFF',
  },
  messagesContainer: { // Aligned with SupportChatScreen (paddingTop was 15, now 10)
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
  },
  messageBubbleContainer: { // Consistent
    flexDirection: 'row',
    marginVertical: 5,
  },
  myMessageContainer: { // Consistent
    justifyContent: 'flex-end',
    marginLeft: 60,
  },
  theirMessageContainer: { // Consistent
    justifyContent: 'flex-start',
    marginRight: 60,
  },
  messageBubble: { // Consistent
    maxWidth: '85%',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 18,
    minHeight: 38,
    justifyContent: 'center',
  },
  sentMessageBubble: { // Consistent
    backgroundColor: '#FF0000',
    borderBottomRightRadius: 6,
  },
  receivedMessageBubble: { // Consistent
    backgroundColor: '#212121',
    borderBottomLeftRadius: 6,
  },
  messageText: { // Consistent
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  timestampContainer: { // Consistent
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  timestamp: { // Consistent
    fontSize: 10,
    opacity: 0.8,
    marginLeft: 8,
  },
  myTimestamp: { // Consistent
    color: '#FFD1D1',
  },
  theirTimestamp: { // Consistent
    color: '#B0B0B0',
  },
  statusText: { // Consistent (was just 'Sent'/'Seen', added item.status || 'Sent' for robustness like in SupportChat)
    fontSize: 10,
    opacity: 0.8,
    color: '#FFD1D1',
    marginRight: 4
  },
  inputContainer: { // Aligned with SupportChatScreen
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'ios' ? 10 : 8, // Consistent padding
    paddingHorizontal: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0', // Was #CCCCCC, now #E0E0E0
    backgroundColor: '#F5F5F5', // Was #F9F9F9, now #F5F5F5
                    paddingBottom:45

  },
  input: { // Aligned with SupportChatScreen
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 8, // Consistent padding
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    fontSize: 16,
    marginRight: 10, // Was 8, now 10
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCDCDC', // Was #E0E0E0, now #DCDCDC
    lineHeight: Platform.OS === 'ios' ? 20 : undefined, // Added for iOS multiline consistency
    
  },
  sendButton: { // Aligned with SupportChatScreen (removed shadow for consistency)
    backgroundColor: '#FF0000',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: { // Aligned with SupportChatScreen
    backgroundColor: '#FF9999',
    // elevation: 0, // Removed explicit elevation: 0, as base sendButton has no elevation
  },
});