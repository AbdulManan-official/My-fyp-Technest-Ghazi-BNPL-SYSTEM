import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
    Platform,
    Dimensions,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    StatusBar,
    FlatList,
    Animated,
} from 'react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { db, auth } from '../../firebaseConfig';
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    getDoc,
    deleteDoc,
} from 'firebase/firestore';
import { formatDistanceToNowStrict } from 'date-fns';
import Icon from 'react-native-vector-icons/FontAwesome';

// --- Constants ---
const { width } = Dimensions.get('window');
const userDefaultProfileImage = 'https://www.w3schools.com/w3images/avatar2.png';
const THEME_RED = '#FF0000';

// --- Helper Functions & Components ---

/**
 * Formats a Firestore timestamp into a relative time string (e.g., "5m ago").
 */
const formatTimestamp = (timestamp) => {
    if (!timestamp?.toDate) return '';
    try {
        return formatDistanceToNowStrict(timestamp.toDate(), { addSuffix: true });
    } catch (e) {
        return '';
    }
};

/**
 * A reusable component that makes a single list item swipeable.
 */
const SwipeableRow = ({ item, onDelete, onOpen, close, onPress }) => {
    const swipeableRef = useRef(null);

    // Effect to programmatically close the row when the 'close' prop is true
    useEffect(() => {
        if (close && swipeableRef.current) {
            swipeableRef.current.close();
        }
    }, [close]);

    // Renders the hidden "Delete" button
    const renderRightActions = (progress, dragX) => {
        const trans = dragX.interpolate({
            inputRange: [-75, 0],
            outputRange: [0, 75],
            extrapolate: 'clamp',
        });
        return (
            <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
                <Animated.View style={{ transform: [{ translateX: trans }] }}>
                    <Icon name="trash" size={25} color="#FFF" />
                </Animated.View>
            </TouchableOpacity>
        );
    };

    return (
        <Swipeable
            ref={swipeableRef}
            renderRightActions={renderRightActions}
            onSwipeableWillOpen={() => onOpen(item.id)}
            overshootRight={false}
        >
            <TouchableOpacity activeOpacity={1} onPress={onPress}>
                <View style={styles.rowFront}>
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
                </View>
            </TouchableOpacity>
        </Swipeable>
    );
};

// --- Main Screen Component ---

export default function AdminMessageScreen() {
    const navigation = useNavigation();
    const [supportChats, setSupportChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adminId, setAdminId] = useState(auth.currentUser?.uid || null);
    const [isAdminVerified, setIsAdminVerified] = useState(false);
    const [openRowKey, setOpenRowKey] = useState(null);
    const isInitialMount = useRef(true);

    /**
     * Effect for verifying admin status on component mount.
     */
    useEffect(() => {
        const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            if (user) {
                setAdminId(user.uid);
                try {
                    const adminRef = doc(db, 'Admin', user.uid);
                    const adminSnap = await getDoc(adminRef);
                    const isAdmin = adminSnap.exists();
                    setIsAdminVerified(isAdmin);
                    if (!isAdmin) {
                        setSupportChats([]);
                        setLoading(false);
                    }
                } catch (error) {
                    setIsAdminVerified(false);
                    setSupportChats([]);
                    setLoading(false);
                    Alert.alert("Error", "Could not verify admin status.");
                }
            } else {
                setAdminId(null);
                setIsAdminVerified(false);
                setSupportChats([]);
                setLoading(false);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    const fetchUserProfile = async (userId) => {
        if (!userId) return { name: 'Unknown User', profilePic: userDefaultProfileImage };
        try {
            const userRef = doc(db, 'Users', userId);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const profilePicUrl = (userData?.profileImage && typeof userData.profileImage === 'string' && userData.profileImage.trim() !== '') ? userData.profileImage : userDefaultProfileImage;
                return {
                    name: userData?.name || `User ${userId.substring(0, 5)}`,
                    profilePic: profilePicUrl,
                };
            } else {
                return { name: 'User Not Found', profilePic: userDefaultProfileImage };
            }
        } catch (error) {
            console.error(`[AdminMsg] Err fetch profile ${userId}:`, error);
            return { name: 'Error Loading', profilePic: userDefaultProfileImage };
        }
    };

    /**
     * Effect for fetching and listening to real-time chat updates.
     * Runs when the screen comes into focus.
     */
    useFocusEffect(
        useCallback(() => {
            if (!isAdminVerified || !adminId) {
                // For non-admins, ensure state is clean and stop here.
                if (isInitialMount.current) {
                    setLoading(false);
                    isInitialMount.current = false;
                }
                setSupportChats([]);
                return;
            }

            // Only show full-screen loader on the very first visit
            if (isInitialMount.current) {
                setLoading(true);
            }

            const chatsRef = collection(db, 'Chats');
            const q = query(chatsRef, where("isSupportChat", "==", true), where("users", "array-contains", adminId));

            const unsubscribe = onSnapshot(q, async (snapshot) => {
                const chatPromises = snapshot.docs.map(async (docSnap) => {
                    const data = docSnap.data();
                    const chatId = docSnap.id;
                    const otherUserId = data.users?.find(id => id !== adminId);
                    if (!otherUserId) return null;
                    const userProfile = await fetchUserProfile(otherUserId);
                    const isUnread = data.lastSenderId !== adminId && !!data.lastMessage;
                    return { id: chatId, userId: otherUserId, name: userProfile.name, message: data.lastMessage || 'No messages yet', timestamp: data.lastMessageTimestamp || data.createdAt || null, profilePic: userProfile.profilePic, isUnread: isUnread, users: data.users || [] };
                });

                let resolvedChats = (await Promise.all(chatPromises)).filter(chat => chat !== null);
                resolvedChats.sort((a, b) => (b.timestamp?.seconds ?? 0) - (a.timestamp?.seconds ?? 0));
                
                setSupportChats(resolvedChats);

                // Turn off loader after first data fetch is complete
                if (isInitialMount.current) {
                    setLoading(false);
                    isInitialMount.current = false;
                }
            }, (error) => {
                console.error("[AdminMsg] Err listening:", error);
                Alert.alert("Error", "Could not load chats.");
                setLoading(false);
            });

            // Cleanup listener when screen loses focus
            return () => unsubscribe();
        }, [adminId, isAdminVerified])
    );

    const handleDeleteChat = async (chatId) => {
        Alert.alert(
            "Delete Chat",
            "Are you sure you want to delete this chat?",
            [
                { text: "Cancel", style: "cancel", onPress: () => setOpenRowKey(null) },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const chatDocRef = doc(db, "Chats", chatId);
                            await deleteDoc(chatDocRef);
                        } catch (error) {
                            console.error(`[AdminMessageScreen] Error deleting chat ${chatId}:`, error);
                            Alert.alert("Error", "Could not delete the chat. Please try again.");
                        }
                    },
                },
            ],
            { cancelable: true, onDismiss: () => setOpenRowKey(null) }
        );
    };

    const renderChatItem = ({ item }) => (
        <SwipeableRow
            item={item}
            onDelete={() => handleDeleteChat(item.id)}
            onOpen={setOpenRowKey}
            close={openRowKey !== null && openRowKey !== item.id}
            onPress={() => {
                if (openRowKey) {
                    setOpenRowKey(null);
                    return;
                }
                navigation.navigate('MessageDetailScreen', {
                    chatId: item.id,
                    loggedInUserId: adminId,
                    users: item.users,
                    recipientName: item.name,
                    recipientAvatar: item.profilePic,
                    isAdminChat: true,
                    otherUserId: item.userId,
                });
            }}
        />
    );

    // --- Conditional Renders ---

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}><Text style={styles.headerTitle}>User Messages</Text></View>
                <ActivityIndicator size="large" color={THEME_RED} style={styles.loader} />
            </SafeAreaView>
        );
    }
    
    // --- Main JSX ---

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor={THEME_RED} />
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>📩 User Messages</Text>
                </View>

                {supportChats.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Icon name="comments-o" size={50} color="#AAAAAA" style={{ marginBottom: 15 }} />
                        <Text style={styles.emptyText}>No support chats found.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={supportChats}
                        renderItem={renderChatItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.flatListContent}
                        showsVerticalScrollIndicator={false}
                        extraData={openRowKey} // Ensures re-render to close rows
                    />
                )}
            </SafeAreaView>
        </GestureHandlerRootView>
    );
}

// --- Stylesheet ---

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
    rowFront: {
        backgroundColor: '#FFF',
        borderBottomColor: '#ECECEC',
        borderBottomWidth: 1,
        justifyContent: 'center',
        minHeight: 74,
    },
    userItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 15,
    },
    deleteButton: {
        backgroundColor: THEME_RED,
        justifyContent: 'center',
        alignItems: 'center',
        width: 75,
    },
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