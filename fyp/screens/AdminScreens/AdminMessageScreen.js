// AdminMessageScreen.js

// -----------------------------------------------------------------------------
// Section 1: Imports
// -----------------------------------------------------------------------------
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
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
  Animated,
  FlatList,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
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

// -----------------------------------------------------------------------------
// Section 2: Constants & Helper Components
// -----------------------------------------------------------------------------
const userDefaultProfileImage =
  'https://www.w3schools.com/w3images/avatar2.png';
const THEME_RED = '#FF0000';

/**
 * A memoized, swipeable list item component.
 * This improves performance by preventing re-renders of list items
 * that haven't changed.
 */
const ChatItem = React.memo(
  ({ item, onSwipeableOpen, onDelete, close, renderVisibleItem }) => {
    const swipeableRef = useRef(null);

    // This allows the parent to programmatically close the row
    if (close) {
      swipeableRef.current?.close();
    }

    // Renders the hidden "Delete" button revealed on swipe
    const renderRightActions = (progress) => {
      const trans = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [75, 0], // Move from right to left
        extrapolate: 'clamp',
      });
      return (
        <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
          <Animated.View style={{ transform: [{ translateX: trans }] }}>
            <Icon name="trash" size={25} color="#FFF" />
          </Animated.View>
        </TouchableOpacity>
      );
    };

    return (
      <Swipeable
        ref={swipeableRef}
        friction={2}
        rightThreshold={40}
        renderRightActions={renderRightActions}
        onSwipeableOpen={onSwipeableOpen}
      >
        {renderVisibleItem({ item })}
      </Swipeable>
    );
  },
);

// -----------------------------------------------------------------------------
// Section 3: Main Screen Component
// -----------------------------------------------------------------------------
export default function AdminMessageScreen() {
  const navigation = useNavigation();

  // --- State ---
  const [rawChats, setRawChats] = useState([]);
  const [userProfiles, setUserProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adminId, setAdminId] = useState(auth.currentUser?.uid || null);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [isVerifyingAdmin, setIsVerifyingAdmin] = useState(true);
  const [currentlyOpenId, setCurrentlyOpenId] = useState(null);

  // --- Effects ---
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      setIsVerifyingAdmin(true);
      if (user) {
        setAdminId(user.uid);
        try {
          const adminRef = doc(db, 'Admin', user.uid);
          const adminSnap = await getDoc(adminRef);
          setIsAdminVerified(adminSnap.exists());
        } catch (e) {
          console.error('Admin verification failed:', e);
          setIsAdminVerified(false);
        }
      } else {
        setAdminId(null);
        setIsAdminVerified(false);
      }
      setIsVerifyingAdmin(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isVerifyingAdmin || !isAdminVerified || !adminId) {
        setRawChats([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const chatsRef = collection(db, 'Chats');
      const q = query(
        chatsRef,
        where('isSupportChat', '==', true),
        where('users', 'array-contains', adminId),
      );

      const unsubscribe = onSnapshot(
        q,
        async (snapshot) => {
          const newRawChats = snapshot.docs
            .map((docSnap) => {
              const data = docSnap.data();
              const otherUserId = data.users?.find((id) => id !== adminId);
              return {
                id: docSnap.id,
                userId: otherUserId,
                message: data.lastMessage || 'No messages yet',
                timestamp: data.lastMessageTimestamp || data.createdAt || null,
                isUnread: data.lastSenderId !== adminId && !!data.lastMessage,
                users: data.users || [],
              };
            })
            .filter((chat) => chat.userId);

          setRawChats(newRawChats);

          const userIdsToFetch = [
            ...new Set(
              newRawChats
                .map((chat) => chat.userId)
                .filter((id) => id && !userProfiles[id]),
            ),
          ];

          if (userIdsToFetch.length > 0) {
            const profilePromises = userIdsToFetch.map((userId) =>
              getDoc(doc(db, 'Users', userId)),
            );
            try {
              const profileDocs = await Promise.all(profilePromises);
              const newProfiles = {};
              profileDocs.forEach((userDoc) => {
                const data = userDoc.data();
                if (userDoc.exists() && data) {
                  newProfiles[userDoc.id] = {
                    name: data.name || `User ${userDoc.id.substring(0, 5)}`,
                    profilePic:
                      (data.profileImage || '').trim() ||
                      userDefaultProfileImage,
                  };
                } else {
                  newProfiles[userDoc.id] = {
                    name: 'User Not Found',
                    profilePic: userDefaultProfileImage,
                  };
                }
              });
              setUserProfiles((prev) => ({ ...prev, ...newProfiles }));
            } catch (e) {
              console.error('Error batch fetching profiles:', e);
              setError('Could not load some user details.');
            }
          }

          setLoading(false);
        },
        (err) => {
          console.error('Firestore listener error:', err);
          setError('Could not load chats.');
          setLoading(false);
        },
      );

      return () => unsubscribe();
    }, [adminId, isAdminVerified, isVerifyingAdmin]),
  );

  const supportChats = useMemo(() => {
    return rawChats
      .map((chat) => ({
        ...chat,
        ...(userProfiles[chat.userId] || {
          name: 'Loading...',
          profilePic: userDefaultProfileImage,
        }),
      }))
      .sort((a, b) => (b.timestamp?.seconds ?? 0) - (a.timestamp?.seconds ?? 0));
  }, [rawChats, userProfiles]);

  // --- Handlers ---
  const formatTimestamp = (timestamp) => {
    if (!timestamp?.toDate) return '';
    try {
      return formatDistanceToNowStrict(timestamp.toDate(), { addSuffix: true });
    } catch (e) {
      return '';
    }
  };

  const handleDeleteChat = (chatId) => {
    Alert.alert(
      'Delete Chat',
      'Are you sure you want to delete this chat?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setCurrentlyOpenId(null) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setCurrentlyOpenId(null);
              await deleteDoc(doc(db, 'Chats', chatId));
            } catch (error) {
              Alert.alert('Error', 'Could not delete the chat.');
            }
          },
        },
      ],
      { cancelable: false },
    );
  };

  // --- Render Functions ---
  const renderVisibleItem = ({ item }) => (
    <View style={styles.rowFront}>
      <TouchableOpacity
        style={styles.userItemContent}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('MessageDetailScreen', {
            chatId: item.id,
            loggedInUserId: adminId,
            users: item.users,
            recipientName: item.name,
            recipientAvatar: item.profilePic,
            isAdminChat: true,
            otherUserId: item.userId,
          })
        }
      >
        <Image source={{ uri: item.profilePic }} style={styles.avatar} />
        <View style={styles.userInfo}>
          <Text
            style={[styles.userName, item.isUnread && styles.unreadText]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text
            style={[styles.userMessage, item.isUnread && styles.unreadText]}
            numberOfLines={1}
          >
            {item.message}
          </Text>
        </View>
        <View style={styles.metaInfo}>
          <Text style={styles.timeText}>{formatTimestamp(item.timestamp)}</Text>
          {item.isUnread && <View style={styles.unreadBadge} />}
        </View>
      </TouchableOpacity>
    </View>
  );

  // Conditional Rendering for different states
  if (isVerifyingAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>User Messages</Text>
        </View>
        <ActivityIndicator size="large" color={THEME_RED} style={styles.loader} />
      </SafeAreaView>
    );
  }

  if (!isAdminVerified) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>User Messages</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Icon name="lock" size={50} color="#AAAAAA" style={{ marginBottom: 15 }} />
          <Text style={styles.emptyText}>Access Denied</Text>
          <Text style={styles.emptySubText}>
            You do not have permission to view this page.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && supportChats.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>User Messages</Text>
        </View>
        <ActivityIndicator size="large" color={THEME_RED} style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME_RED} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>User Messages</Text>
      </View>

      {supportChats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="comments-o" size={50} color="#AAAAAA" style={{ marginBottom: 15 }} />
          <Text style={styles.emptyText}>No support chats found.</Text>
        </View>
      ) : (
        <FlatList
          data={supportChats}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatItem
              item={item}
              onSwipeableOpen={() => setCurrentlyOpenId(item.id)}
              onDelete={() => handleDeleteChat(item.id)}
              close={currentlyOpenId !== item.id}
              renderVisibleItem={renderVisibleItem}
            />
          )}
          contentContainerStyle={styles.flatListContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// -----------------------------------------------------------------------------
// Section 4: Styles
// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: THEME_RED,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
  },
  loader: {
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
  emptySubText: {
    fontSize: 14,
    color: '#A0A0A0',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  flatListContent: {
    paddingBottom: 3,
  },
  rowFront: {
    backgroundColor: '#FFF',
  },
  userItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomColor: '#ECECEC',
    borderBottomWidth: 1,
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
  deleteButton: {
    backgroundColor: THEME_RED,
    justifyContent: 'center',
    alignItems: 'center',
    width: 75,
  },
});