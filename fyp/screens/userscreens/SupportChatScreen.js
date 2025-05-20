// SupportChatScreen.js

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image,
  SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
  StatusBar // Import StatusBar if you need to manually add its height to offset on Android
} from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { db, auth } from '../../firebaseConfig';
import {
  collection, query, orderBy, onSnapshot, addDoc, doc,
  updateDoc, serverTimestamp, getDoc, getDocs, where, writeBatch
} from 'firebase/firestore';
import { format } from 'date-fns';
import axios from 'axios';

// --- Constants ---
const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const SUPPORT_ADMIN_UID = "fCCDQ77mAOXOWUjDUNqzVWi9awF3";
const screenPlaceholderAvatar = 'https://via.placeholder.com/40';

// --- Helper Function to Fetch Recipient Token (Unchanged) ---
async function getRecipientToken(recipientId) { /* ... (Keep your existing function) ... */
    if (!recipientId) { console.error("[SupportChatScreen][getRecipientToken] recipientId missing."); return null; }
    let token = null;
    try {
        const userDocRef = doc(db, "Users", recipientId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            token = userDocSnap.data()?.expoPushToken;
        } else {
            const adminDocRef = doc(db, "Admin", recipientId);
            const adminDocSnap = await getDoc(adminDocRef);
            if (adminDocSnap.exists()) {
                token = adminDocSnap.data()?.expoPushToken;
            } else {
                console.warn(`[SupportChatScreen][getRecipientToken] Recipient doc not found in Users/Admin: ${recipientId}`);
            }
        }
        if (token && typeof token === 'string' && token.startsWith('ExponentPushToken[')) {
            return token;
        } else if (token) {
            console.warn(`[SupportChatScreen][getRecipientToken] Invalid token format for ${recipientId}:`, token); return null;
        } else { return null; }
    } catch (error) { console.error(`[SupportChatScreen][getRecipientToken] Error fetching token for ${recipientId}:`, error); return null; }
}


export default function SupportChatScreen() {
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatId, setChatId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [findingChat, setFindingChat] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [headerAdminName, setHeaderAdminName] = useState('Support');
  const [headerAdminAvatar, setHeaderAdminAvatar] = useState(null);

  // Get Current User (Unchanged)
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (userAuth) => {
      if (userAuth) {
        let fetchedUserName = userAuth.displayName || `User ${userAuth.uid.substring(0,5)}`;
        try {
            const userRef = doc(db, "Users", userAuth.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists() && userSnap.data()?.name) {
                fetchedUserName = userSnap.data().name;
            }
        } catch (error) {
            console.error("[SupportChatScreen] Error fetching user name from Firestore:", error);
        }
        setCurrentUser({ uid: userAuth.uid, name: fetchedUserName });
      } else {
        setCurrentUser(null); setChatId(null); setMessages([]); setLoading(false); setFindingChat(false);
      }
    });
    return unsubscribe;
  }, []);

  // Fetch Support Admin Profile FOR THE HEADER (Unchanged)
  useEffect(() => {
    const fetchAdminProfileForHeader = async () => {
      if (!SUPPORT_ADMIN_UID) {
        setHeaderAdminName('Support');
        setHeaderAdminAvatar(screenPlaceholderAvatar);
        return;
      }
      try {
        const adminRef = doc(db, "Admin", SUPPORT_ADMIN_UID);
        const adminSnap = await getDoc(adminRef);
        if (adminSnap.exists()) {
          const adminData = adminSnap.data();
          setHeaderAdminName(adminData?.name || 'Support');
          setHeaderAdminAvatar(adminData?.profileImage || screenPlaceholderAvatar);
        } else {
          setHeaderAdminName('Support');
          setHeaderAdminAvatar(screenPlaceholderAvatar);
        }
      } catch (error) {
        console.error("[SupportChatScreen] Error fetching support admin profile for header:", error);
        setHeaderAdminName('Support');
        setHeaderAdminAvatar(screenPlaceholderAvatar);
      }
    };
    fetchAdminProfileForHeader();
  }, []);

  // Update Navigator Header (Unchanged)
  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.dynamicHeaderTitleContainer}>
          {headerAdminAvatar && typeof headerAdminAvatar === 'string' && headerAdminAvatar.trim() !== '' ? (
            <Image
              source={{ uri: headerAdminAvatar }}
              style={styles.dynamicHeaderAvatar}
              defaultSource={{ uri: screenPlaceholderAvatar }}
            />
          ) : null }
          <Text style={styles.dynamicHeaderTitleText} numberOfLines={1}>
            {headerAdminName}
          </Text>
        </View>
      ),
    });
  }, [navigation, headerAdminName, headerAdminAvatar]);

  // Find or Create Chat Logic (Unchanged)
  useFocusEffect(
    useCallback(() => {
      if (!currentUser || !SUPPORT_ADMIN_UID) {
        setFindingChat(false);
        if (!currentUser) setLoading(false);
        return;
      }
      setFindingChat(true); setMessages([]); setChatId(null); setLoading(true);
      const findOrCreateChat = async () => {
        try {
          const chatsRef = collection(db, "Chats");
          const q = query( chatsRef, where("isSupportChat", "==", true), where("users", "array-contains", currentUser.uid));
          const querySnapshot = await getDocs(q);
          let existingChatId = null;
          querySnapshot.forEach((docSnap) => {
            if (docSnap.data().users?.includes(SUPPORT_ADMIN_UID)) { existingChatId = docSnap.id; }
          });
          if (existingChatId) { setChatId(existingChatId); }
          else {
            const newChatData = { users: [currentUser.uid, SUPPORT_ADMIN_UID], isSupportChat: true, createdAt: serverTimestamp(), lastMessage: null, lastMessageTimestamp: null, lastSenderId: null };
            const newChatRef = await addDoc(chatsRef, newChatData);
            setChatId(newChatRef.id);
          }
        } catch (error) { Alert.alert("Error", "Could not initiate support chat."); }
        finally { setFindingChat(false); }
      };
      findOrCreateChat();
    }, [currentUser])
  );

  // Fetch Messages (Unchanged)
  useEffect(() => {
    if (!chatId) {
        if (!findingChat) setLoading(false);
        return;
    }
    setLoading(true);
    const messagesRef = collection(db, "Chats", chatId, "messages");
    const q_messages = query(messagesRef, orderBy("timestamp", "asc"));
    const unsubscribeMessages = onSnapshot(q_messages, (snapshot) => {
      const fetchedMessages = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter(msg => msg.timestamp);
      setMessages(fetchedMessages);
      setLoading(false);
    }, (error) => {
      Alert.alert("Error", "Could not load messages.");
      setLoading(false);
    });
    return () => { unsubscribeMessages(); };
  }, [chatId, findingChat]);

  // Mark Messages as Seen (Unchanged)
  useFocusEffect(
    useCallback(() => {
      if (!chatId || !currentUser?.uid) return;
      const messagesRef = collection(db, "Chats", chatId, "messages");
      const q_seen = query( messagesRef, where("receiverId", "==", currentUser.uid), where("status", "==", "sent") );
      getDocs(q_seen).then((snapshot) => {
        if (snapshot.empty) return;
        const batch = writeBatch(db);
        snapshot.docs.forEach((docSnap) => { batch.update(docSnap.ref, { status: "seen" }); });
        return batch.commit();
      }).catch((error) => console.error("[SupportChatScreen] Error marking messages as seen:", error));
    }, [chatId, currentUser?.uid])
  );

  // Format Timestamp (Unchanged)
  const formatTimestamp = (timestamp) => {
    if (!timestamp?.toDate) return '';
    try { return format(timestamp.toDate(), "HH:mm"); }
    catch (e) { return ''; }
  };

  // Handle Send Message (Unchanged)
  const handleSendMessage = async () => {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || sending || !chatId || !currentUser?.uid || !currentUser?.name) {
        if (!currentUser?.name) console.warn("[SupportChatScreen][handleSendMessage] Current user name not loaded.");
        return;
    }
    setSending(true); setNewMessage('');
    const messageData = { senderId: currentUser.uid, receiverId: SUPPORT_ADMIN_UID, text: trimmedMessage, timestamp: serverTimestamp(), status: "sent" };
    const messagesCollectionRef = collection(db, "Chats", chatId, "messages");
    const chatDocRef = doc(db, "Chats", chatId);
    try {
        await addDoc(messagesCollectionRef, messageData);
        await updateDoc(chatDocRef, { lastMessage: trimmedMessage, lastMessageTimestamp: serverTimestamp(), lastSenderId: currentUser.uid });
        const recipientToken = await getRecipientToken(SUPPORT_ADMIN_UID);
        if (recipientToken) {
            const notificationPayload = { to: recipientToken, sound: 'default', title: `Support Message from ${currentUser.name}`, body: trimmedMessage, data: { chatId: chatId, type: 'support_message', senderId: currentUser.uid, senderName: currentUser.name } };
            await axios.post(EXPO_PUSH_ENDPOINT, [notificationPayload], { headers: { 'Accept': 'application/json','Content-Type': 'application/json','Accept-encoding': 'gzip, deflate'}, timeout: 10000 });
        }
    } catch (error) { Alert.alert("Error", "Failed to send message."); }
    finally { setSending(false); }
  };

  // Render Message Item (Unchanged)
  const renderMessageItem = ({ item, index }) => {
    if (!item || typeof item.senderId !== 'string') return null;
    const isMyMessage = item.senderId === currentUser?.uid;
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

  // Loading States (Unchanged)
  if (findingChat || (!currentUser && auth.currentUser)) {
       return (
          <SafeAreaView style={styles.safeArea}>
              <ActivityIndicator size="large" color="#FF0000" style={styles.loader} />
          </SafeAreaView>
       );
  }
  if (!currentUser && !auth.currentUser) {
    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.emptyChatContainer}>
                <Text style={styles.emptyChatText}>Please log in to use support chat.</Text>
            </View>
        </SafeAreaView>
    );
  }

  // Calculate keyboardVerticalOffset
  // For Android, if you have a translucent status bar or other elements,
  // you might need to add StatusBar.currentHeight.
  // For iOS, headerHeight is usually sufficient.
  const keyboardOffset = Platform.OS === 'ios' ? headerHeight : headerHeight;
  // If on Android and you still have issues, and your status bar is not opaque or
  // is drawn over by the header, you might not need to add StatusBar.currentHeight.
  // If header is fully opaque and below status bar, headerHeight alone is often fine.
  // If issues persist on Android, consider `headerHeight + StatusBar.currentHeight`
  // but test thoroughly as `useHeaderHeight` often accounts for this correctly with react-navigation.

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer} // Ensure this has flex: 1
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardOffset} // Use the calculated offset
        enabled
      >
        {/* ADDED WRAPPER VIEW with flex: 1 */}
        <View style={styles.chatContentWrapper}>
            {loading && messages.length === 0 && chatId ? (
                <ActivityIndicator size="large" color="#FF0000" style={styles.loader} />
            ) : !chatId && !findingChat ? (
                <View style={styles.emptyChatContainer}>
                    <Text style={styles.emptyChatText}>Could not load support chat. Please try again later.</Text>
                </View>
            ) : (
            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessageItem}
                keyExtractor={(item) => item.id}
                style={styles.flatList} // Ensure this has flex: 1
                contentContainerStyle={styles.messagesContainer}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
                ListEmptyComponent={ !loading && chatId ? <View style={styles.emptyChatContainer}><Text style={styles.emptyChatText}>Send a message to start talking to support.</Text></View> : null }
                extraData={messages.length > 0 ? messages[messages.length - 1].status : null}
            />
            )}
            {chatId && (
                <View style={styles.inputContainer}>
                <TextInput
                    placeholder="Type your message..."
                    style={styles.input}
                    value={newMessage}
                    onChangeText={setNewMessage}
                    multiline
                    placeholderTextColor="#A0A0A0"
                    editable={!sending && !!chatId}
                />
                <TouchableOpacity
                    onPress={handleSendMessage}
                    style={[styles.sendButton, (sending || !newMessage.trim() || !chatId) && styles.sendButtonDisabled]}
                    disabled={sending || !newMessage.trim() || !chatId}
                >
                    {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <FontAwesome name="paper-plane" size={18} color="#FFF" />}
                </TouchableOpacity>
                </View>
            )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    keyboardAvoidingContainer: {
        flex: 1, // Crucial: KAV must fill its parent
    },
    // ADDED: Wrapper for chat content inside KAV
    chatContentWrapper: {
        flex: 1, // Crucial: This wrapper takes all space given by KAV
        // backgroundColor: 'rgba(0, 255, 0, 0.1)', // Optional: for debugging layout
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyChatContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyChatText: {
        textAlign: 'center',
        color: '#A0A0A0',
        fontSize: 16,
    },
    flatList: {
        flex: 1, // Crucial: FlatList should expand to fill available space above input
        backgroundColor: '#FFFFFF',
    },
    messagesContainer: {
        paddingHorizontal: 10,
        paddingTop: 10,
        paddingBottom: 10, // Some padding at the bottom of the list itself
    },
    messageBubbleContainer: {
        flexDirection: 'row',
        marginVertical: 5,
    },
    myMessageContainer: {
        justifyContent: 'flex-end',
        marginLeft: 60,
    },
    theirMessageContainer: {
        justifyContent: 'flex-start',
        marginRight: 60,
    },
    messageBubble: {
        maxWidth: '85%',
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderRadius: 18,
        minHeight: 38,
        justifyContent: 'center',
    },
    sentMessageBubble: {
        backgroundColor: '#FF0000',
        borderBottomRightRadius: 6,
    },
    receivedMessageBubble: {
        backgroundColor: '#212121',
        borderBottomLeftRadius: 6,
    },
    messageText: {
        fontSize: 15,
        color: '#FFFFFF',
        lineHeight: 20,
    },
    timestampContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 4,
    },
    timestamp: {
        fontSize: 10,
        opacity: 0.8,
        marginLeft: 8,
    },
    myTimestamp: { color: '#FFD1D1', },
    theirTimestamp: { color: '#B0B0B0', },
    statusText: {
        fontSize: 10,
        opacity: 0.8,
        color: '#FFD1D1',
        marginRight: 4
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Platform.OS === 'ios' ? 10 : 8,
        paddingHorizontal: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E0E0E0',
        backgroundColor: '#F5F5F5', // Changed to a common chat input background
                paddingBottom:45

    },
    input: {
        flex: 1,
        minHeight: 42,
        maxHeight: 120, // For multiline auto-grow
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 10 : 8, // Consistent padding
        paddingBottom: Platform.OS === 'ios' ? 10 : 8,
        borderRadius: 21,
        backgroundColor: "#FFFFFF",
        fontSize: 16,
        marginRight: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#DCDCDC',
        lineHeight: Platform.OS === 'ios' ? 20 : undefined, // For iOS multiline vertical centering
    },
    sendButton: {
        backgroundColor: '#FF0000',
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#FF9999', // Lighter shade for disabled
        // elevation: 0, // No shadow when disabled if you had elevation before
    },
    dynamicHeaderTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    dynamicHeaderAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      marginRight: 10,
      backgroundColor: '#E0E0E0',
    },
    dynamicHeaderTitleText: {
      color: 'white',
      fontSize: 17,
      fontWeight: '600',
    },
});