
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    // FlatList, // <-- Remove FlatList import
    Image,
    TouchableOpacity,
    Platform,
    Dimensions,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    StatusBar,
    TouchableHighlight, // <-- Import for better row feedback
} from 'react-native';
import { SwipeListView } from 'react-native-swipe-list-view'; // <-- Import SwipeListView
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { db, auth } from '../../firebaseConfig';
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    getDoc,
    deleteDoc, // <-- Import deleteDoc
    // Add imports for deleting subcollection if implementing full delete later
    // getDocs, writeBatch
} from 'firebase/firestore';
import { formatDistanceToNowStrict } from 'date-fns';
import Icon from 'react-native-vector-icons/FontAwesome'; // Using FontAwesome for delete icon

const { width } = Dimensions.get('window');
const userDefaultProfileImage = 'https://www.w3schools.com/w3images/avatar2.png';
const THEME_RED = '#FF0000'; // Define theme color

export default function AdminMessageScreen() {
    const navigation = useNavigation();
    const [supportChats, setSupportChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adminId, setAdminId] = useState(auth.currentUser?.uid || null);
    const [isAdminVerified, setIsAdminVerified] = useState(false);

    // --- Verify Admin Status (Keep As Is) ---
    useEffect(() => {
        // ... (Admin verification logic remains the same) ...
        const unsubscribeAuth = auth.onAuthStateChanged(async (user) => { if (user) { setAdminId(user.uid); try { const adminRef = doc(db, 'Admin', user.uid); const adminSnap = await getDoc(adminRef); const isAdmin = adminSnap.exists(); setIsAdminVerified(isAdmin); if (!isAdmin) { setSupportChats([]); setLoading(false); } } catch (error) { setIsAdminVerified(false); setSupportChats([]); setLoading(false); Alert.alert("Error", "Could not verify admin status."); } } else { setAdminId(null); setIsAdminVerified(false); setSupportChats([]); setLoading(false); } }); return () => unsubscribeAuth();
    }, []);

    // --- Function to fetch User profile (Keep As Is) ---
    const fetchUserProfile = async (userId) => {
        // ... (fetchUserProfile logic remains the same) ...
        if (!userId) return { name: 'Unknown User', profilePic: userDefaultProfileImage }; try { const userRef = doc(db, 'Users', userId); const userDoc = await getDoc(userRef); if (userDoc.exists()) { const userData = userDoc.data(); const profilePicUrl = (userData?.profileImage && typeof userData.profileImage === 'string' && userData.profileImage.trim() !== '') ? userData.profileImage : userDefaultProfileImage; return { name: userData?.name || `User ${userId.substring(0, 5)}`, profilePic: profilePicUrl, }; } else { return { name: 'User Not Found', profilePic: userDefaultProfileImage }; } } catch (error) { console.error(`[AdminMsg] Err fetch profile ${userId}:`, error); return { name: 'Error Loading', profilePic: userDefaultProfileImage }; }
    };

    // --- Fetch Support Chats (Keep As Is) ---
    useFocusEffect(
        useCallback(() => {
            // ... (Chat fetching and client-side sorting logic remains the same) ...
             if (!isAdminVerified || !adminId) { setLoading(false); setSupportChats([]); return; } setLoading(true); const chatsRef = collection(db, 'Chats'); const q = query( chatsRef, where("isSupportChat", "==", true), where("users", "array-contains", adminId) ); const unsubscribe = onSnapshot(q, async (snapshot) => { if (snapshot.empty) { setSupportChats([]); setLoading(false); return; } const chatPromises = snapshot.docs.map(async (docSnap) => { const data = docSnap.data(); const chatId = docSnap.id; const otherUserId = data.users?.find(id => id !== adminId); if (!otherUserId) return null; const userProfile = await fetchUserProfile(otherUserId); const isUnread = data.lastSenderId !== adminId && !!data.lastMessage; return { id: chatId, userId: otherUserId, name: userProfile.name, message: data.lastMessage || 'No messages yet', timestamp: data.lastMessageTimestamp || data.createdAt || null, profilePic: userProfile.profilePic, isUnread: isUnread, users: data.users || [], }; }); let resolvedChats = (await Promise.all(chatPromises)).filter(chat => chat !== null); resolvedChats.sort((a, b) => { const timeA = a.timestamp?.seconds ?? 0; const timeB = b.timestamp?.seconds ?? 0; return timeB - timeA; }); setSupportChats(resolvedChats); setLoading(false); }, (error) => { console.error("[AdminMsg] Err listening:", error); Alert.alert("Error", "Could not load chats."); setLoading(false); }); return () => { unsubscribe(); };
        }, [adminId, isAdminVerified])
    );

    // --- Format Timestamp (Keep As Is) ---
    const formatTimestamp = (timestamp) => {
        // ... (formatTimestamp logic remains the same) ...
        if (!timestamp?.toDate) return ''; try { return formatDistanceToNowStrict(timestamp.toDate(), { addSuffix: true }); } catch (e) { return ''; }
    };

    // --- **NEW**: Close Row Function ---
    const closeRow = (rowMap, rowKey) => {
        if (rowMap[rowKey]) {
            rowMap[rowKey].closeRow();
        }
    };

    // --- **NEW**: Delete Chat Handler ---
    const handleDeleteChat = async (chatId, rowMap) => {
        // Close the row first visually
        closeRow(rowMap, chatId);

        Alert.alert(
            "Delete Chat",
            "Are you sure you want to delete this chat? ",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        console.log(`[AdminMessageScreen] Attempting to delete chat: ${chatId}`);
                        try {
                            // --- Option 1: Delete only the main chat document ---
                            // (Leaves messages subcollection orphaned)
                            const chatDocRef = doc(db, "Chats", chatId);
                            await deleteDoc(chatDocRef);
                            console.log(`[AdminMessageScreen] Chat document ${chatId} deleted.`);

                            // --- Option 2: Delete chat doc + messages (More complex) ---
                            // Requires fetching all messages and batch deleting them first.
                            // Example (use carefully, can be slow/costly for many messages):
                            /*
                            const messagesRef = collection(db, "Chats", chatId, "messages");
                            const messagesSnap = await getDocs(messagesRef);
                            const batch = writeBatch(db);
                            messagesSnap.forEach(doc => batch.delete(doc.ref));
                            batch.delete(doc(db, "Chats", chatId)); // Delete parent doc after messages
                            await batch.commit();
                            console.log(`[AdminMessageScreen] Chat ${chatId} and its messages deleted.`);
                            */

                            // Update local state immediately AFTER successful deletion
                            setSupportChats(prevChats => prevChats.filter(chat => chat.id !== chatId));

                        } catch (error) {
                            console.error(`[AdminMessageScreen] Error deleting chat ${chatId}:`, error);
                            Alert.alert("Error", "Could not delete the chat. Please try again.");
                        }
                    },
                },
            ],
            { cancelable: true }
        );
    };


    // --- **MODIFIED**: Render VISIBLE Item Function for SwipeListView ---
    const renderVisibleChatItem = ({ item }) => (
        // Use TouchableHighlight for visual feedback when row is pressed/swiped
        <TouchableHighlight
            style={styles.rowFront} // Apply background color here
            underlayColor={'#f0f0f0'} // Color when pressed
            onPress={() => navigation.navigate('MessageDetailScreen', {
                chatId: item.id, loggedInUserId: adminId, users: item.users,
                recipientName: item.name, recipientAvatar: item.profilePic,
                isAdminChat: true, otherUserId: item.userId
            })}
        >
            {/* Content of the row (same structure as before) */}
            <View style={styles.userItemContent}>
                <Image source={{ uri: item.profilePic }} style={styles.avatar} />
                <View style={styles.userInfo}>
                    <Text style={[styles.userName, item.isUnread && styles.unreadText]}>
                        {item.name}
                    </Text>
                    <Text style={[styles.userMessage, item.isUnread && styles.unreadText]} numberOfLines={1}>
                        {item.message}
                    </Text>
                </View>
                <View style={styles.metaInfo}>
                    <Text style={styles.timeText}>{formatTimestamp(item.timestamp)}</Text>
                    {item.isUnread && <View style={styles.unreadBadge} />}
                </View>
            </View>
        </TouchableHighlight>
    );

     // --- **NEW**: Render HIDDEN Item Function for SwipeListView ---
    const renderHiddenChatItem = (data, rowMap) => (
        <View style={styles.rowBack}>
            {/* Empty space on the left (optional) */}
            <View style={[styles.backRightBtn, styles.backRightBtnLeft]}>
                 {/* <Text>Left Action</Text> */}
            </View>
            {/* Delete button on the right */}
            <TouchableOpacity
                style={[styles.backRightBtn, styles.backRightBtnRight]}
                onPress={() => handleDeleteChat(data.item.id, rowMap)} // Pass item id and rowMap
            >
                <Icon name="trash" size={25} color="#FFF" />
                {/* <Text style={styles.backTextWhite}>Delete</Text> */}
            </TouchableOpacity>
        </View>
    );

    // --- Main Render Logic ---
    // Loading or Verifying State
     if ((loading || !isAdminVerified) && auth.currentUser) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}><Text style={styles.headerTitle}>User Messages</Text></View>
                <ActivityIndicator size="large" color={THEME_RED} style={styles.loader} />
            </SafeAreaView>
        );
    }

    // Access Denied State
    if (!isAdminVerified && auth.currentUser) {
       return (
          <SafeAreaView style={styles.container}>
            <View style={styles.header}><Text style={styles.headerTitle}>User Messages</Text></View>
            <View style={styles.emptyContainer}>
               <Icon name="lock" size={50} color="#AAAAAA" style={{marginBottom: 15}} />
               <Text style={styles.emptyText}>Access Denied</Text>
            </View>
          </SafeAreaView>
       );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={THEME_RED} />
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>📩 User Messages</Text>
            </View>

            {/* List or Empty State */}
            {supportChats.length === 0 && !loading ? (
                <View style={styles.emptyContainer}>
                    <Icon name="comments-o" size={50} color="#AAAAAA" style={{marginBottom: 15}} />
                    <Text style={styles.emptyText}>No support chats found.</Text>
                </View>
            ) : (
                 // --- MODIFIED: Use SwipeListView instead of FlatList ---
                <SwipeListView
                    data={supportChats}
                    renderItem={renderVisibleChatItem} // Renders the visible row
                    renderHiddenItem={renderHiddenChatItem} // Renders the buttons behind
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.flatListContent}
                    showsVerticalScrollIndicator={false}
                    // Swipe configuration
                    disableRightSwipe={true} // Only allow swiping left (revealing right button)
                    rightOpenValue={-75} // How much the row opens (width of delete button)
                    previewRowKey={supportChats[0]?.id} // Animate first row on mount (optional)
                    previewOpenValue={-40} // How much the preview opens
                    previewOpenDelay={1000} // Delay before preview animation
                    // Optional: Callback when row opens/closes
                    // onRowDidOpen={(rowKey) => { console.log('Row opened:', rowKey); }}
                    // onSwipeValueChange={(swipeData) => { /* Can track swipe amount */ }}
                    useNativeDriver={false} // Often needed for swipe lists depending on complexity
                />
                 // --- End Modification ---
            )}
        </SafeAreaView>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        backgroundColor: THEME_RED,
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 4,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FFF',
    },
    loader: {
        marginTop: 50,
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        fontSize: 18,
        color: '#888',
        marginBottom: 10,
        textAlign: 'center',
    },
    flatListContent: {
        paddingBottom: 20,
    },
    // --- Styles for Swipe List View ---
    rowFront: { // Style for the visible row container
        backgroundColor: '#FFF', // White background for the visible row
        borderBottomColor: '#ECECEC',
        borderBottomWidth: 1,
        justifyContent: 'center',
        minHeight: 74, // Ensure consistent height
    },
    userItemContent: { // Inner container for flex layout (avatar, text, meta)
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12, // Padding applied here now
        paddingHorizontal: 15,
    },
    rowBack: { // Container for hidden buttons
        alignItems: 'center',
        backgroundColor: '#DDD', // Background behind the row (less important)
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        // paddingLeft: 15, // Example if you had a left action
    },
    backRightBtn: { // Common style for hidden buttons
        alignItems: 'center',
        bottom: 0,
        justifyContent: 'center',
        position: 'absolute',
        top: 0,
        width: 75, // Match rightOpenValue
    },
    backRightBtnLeft: { // Style for a potential left-side hidden button (not used here)
        // backgroundColor: 'blue',
        // right: 75,
    },
    backRightBtnRight: { // Style for the delete button
        backgroundColor: THEME_RED, // Red background for delete
        right: 0, // Positioned on the far right
    },
    backTextWhite: { // Style for text on hidden buttons if needed
        color: '#FFF',
    },
    // --- End Swipe List View Styles ---
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
        backgroundColor: '#E0E0E0',
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 2,
    },
    userMessage: {
        fontSize: 14,
        color: '#555',
    },
    unreadText: {
        fontWeight: 'bold',
        color: '#111',
    },
    metaInfo: {
        alignItems: 'flex-end',
        marginLeft: 10,
    },
    timeText: {
        fontSize: 11,
        color: 'gray',
        marginBottom: 5,
    },
    unreadBadge: {
        backgroundColor: THEME_RED,
        width: 10,
        height: 10,
        borderRadius: 5,
    },
});