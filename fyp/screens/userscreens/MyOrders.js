// MyOrders.js (Complete Code - Final Attempt at Correctness)

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, FlatList, Dimensions, ActivityIndicator, Image,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,StatusBar,
  Alert // Ensure Alert is imported
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons'; // Keep for icons
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { db, auth } from '../../firebaseConfig'; // Verify path
import {
  collection, query, where, onSnapshot, Timestamp, doc // Ensure all needed Firestore functions are imported
} from 'firebase/firestore';
import { format, isValid } from 'date-fns'; // Ensure date-fns is installed
import Icon from 'react-native-vector-icons/FontAwesome'; // Ensure vector icons are set up

// --- Constants ---
const ORDERS_COLLECTION = 'orders';
const AccentColor = '#FF0000';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const LightBorderColor = '#E5E7EB';
const ScreenBackgroundColor = '#F8F9FA';
const PlaceholderBgColor = '#F0F0F0';
const CURRENCY_SYMBOL = 'PKR';
const placeholderImagePath = require('../../assets/p3.jpg'); // Verify path

// --- Main Component ---
export default function MyOrders() {
  const navigation = useNavigation();
  const [userOrders, setUserOrders] = useState([]); // State for orders
  const [loading, setLoading] = useState(true);    // Loading state
  const [userId, setUserId] = useState(null);       // Logged-in user's ID
  const [refreshing, setRefreshing] = useState(false); // Pull-to-refresh state

  // --- Effect 1: Monitor Authentication State ---
  useEffect(() => {
    console.log("[MyOrders] Attaching Auth listener.");
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      const currentUid = user ? user.uid : null;
      console.log("[MyOrders] Auth State Changed. User ID:", currentUid);
      // Update userId state ONLY if it actually changed
      if (currentUid !== userId) {
        setUserId(currentUid); // This will trigger the next effect
        if (!currentUid) {
          // If user logs out, clear orders and stop loading/refreshing
          setUserOrders([]);
          setLoading(false);
          setRefreshing(false);
        } else {
          // User logged in, set loading to true to indicate data fetch needed
          // but only if orders aren't already loaded (avoid flicker on fast auth change)
          if (userOrders.length === 0) {
             setLoading(true);
          }
        }
      }
    });
    // Cleanup function to unsubscribe the listener on component unmount
    return () => {
      console.log("[MyOrders] Cleaning up Auth Listener.");
      unsubscribeAuth();
    };
  }, [userId]); // Rerun this effect if the userId state itself changes (unlikely needed, but safe)

  // --- Effect 2: Setup Firestore Listener when userId is valid ---
  useEffect(() => {
    // Guard clause: Don't proceed if userId is null or undefined
    if (!userId) {
      console.log("[MyOrders] Firestore Listener: No userId, skipping query.");
      // If listener was attached previously and user logged out, this ensures loading stops
      if (loading) setLoading(false);
      if (refreshing) setRefreshing(false);
      return; // Exit the effect
    }

    console.log(`[MyOrders] Firestore Listener: Setting up for user ${userId}.`);
    // Set loading true when starting the listener setup (if not already refreshing)
    if (!refreshing) setLoading(true);

    // Define the query to fetch orders for the current user
    const ordersRef = collection(db, ORDERS_COLLECTION);
    const q = query(ordersRef, where("userId", "==", userId)); // Filter by user ID

    // Attach the real-time listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`[MyOrders] Firestore Snapshot: Received ${snapshot.docs.length} orders.`);
      // Process the documents from the snapshot
      let fetchedOrders = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        // Basic validation of essential data fields
        if (!data || !(data.createdAt instanceof Timestamp)) {
            console.warn(`[MyOrders] Skipping order doc ${docSnap.id}: Missing data or invalid createdAt`, data);
            return null; // Skip invalid document
        }
        // Determine BNPL status
        const isBNPL = data.paymentMethod === 'BNPL' || data.paymentMethod === 'Fixed Duration';
        // Format date safely
        let formattedDate = 'N/A';
        const createdAtDate = data.createdAt.toDate(); // Already checked it's a Timestamp
        if (isValid(createdAtDate)) {
            formattedDate = format(createdAtDate, 'MMM d, yyyy');
        }

        // Construct the final object for state
        return {
          id: docSnap.id, // Use Firestore document ID
          orderNumber: docSnap.id.substring(0, 8).toUpperCase(),
          date: formattedDate,
          createdAtTimestamp: data.createdAt, // Keep original for sorting
          status: data.status || 'Unknown',
          isBNPL: isBNPL,
          grandTotal: data.grandTotal,
          items: data.items || [], // Default to empty array if missing
          // Include all necessary fields passed to the detail screen
          userId: data.userId,
          userName: data.userName,
          userAddress: data.userAddress,
          userPhone: data.userPhone,
          paymentMethod: data.paymentMethod,
          paymentStatus: data.paymentStatus,
          installments: data.installments,
          paymentDueDate: data.paymentDueDate,
          bnplPlanDetails: data.bnplPlanDetails,
          fixedDurationDetails: data.fixedDurationDetails,
        };
      }).filter(item => item !== null); // Remove any null entries from mapping invalid docs

      // Client-Side Sorting (Newest First)
      fetchedOrders.sort((a, b) => (b.createdAtTimestamp?.seconds ?? 0) - (a.createdAtTimestamp?.seconds ?? 0));

      setUserOrders(fetchedOrders); // Update state
      setLoading(false);        // Stop main loading indicator
      setRefreshing(false);     // Stop pull-to-refresh indicator

    }, (error) => { // Handle errors from the listener
      console.error("[MyOrders] Firestore listener error:", error);
      Alert.alert("Error", "Could not update your orders in real-time. Please pull to refresh.");
      setLoading(false);
      setRefreshing(false);
    });

    // Cleanup function: Detach the listener when effect re-runs or component unmounts
    return () => {
        console.log(`[MyOrders] Cleaning up Firestore listener for user ${userId}.`);
        unsubscribe();
    };
  }, [userId]); // ** Key Dependency: This effect re-runs whenever userId changes **


  // --- Handle Refresh ---
  const onRefresh = useCallback(() => {
    if (!userId) {
        console.log("[MyOrders] Cannot refresh, no user logged in.");
        setRefreshing(false); // Ensure spinner stops
        return;
    }
    console.log("[MyOrders] Manual refresh triggered.");
    setRefreshing(true);
    // The listener will automatically refetch when connection is re-established
    // or if setupOrderListener is called again (which useEffect does if userId changes).
    // For manual trigger, setting state is enough, listener handles the rest.
    // Add a fallback timeout just in case.
    const refreshTimeout = setTimeout(() => {
        if (refreshing) {
            console.warn("[MyOrders] Refresh timeout, stopping spinner.");
            setRefreshing(false);
        }
     }, 7000); // 7 seconds

    // No need to explicitly return unsubscribe here, useEffect handles it.
    return () => clearTimeout(refreshTimeout); // Cleanup timeout

  }, [userId]); // Depend on userId

  // --- Helper Function for Status Styles ---
  const getStatusStyle = (status) => {
      const lowerStatus = status?.toLowerCase() || 'unknown';
      switch (lowerStatus) {
          case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': return styles.statusPending;
          case 'processing': case 'partially paid': return styles.statusProcessing;
          case 'shipped': return styles.statusShipped;
          case 'delivered': return styles.statusDelivered;
          case 'cancelled': case 'rejected': return styles.statusCancelled;
          default: return styles.statusUnknown;
      }
  };

  // --- Render Order Item ---
  const renderOrderItem = ({ item }) => {
      const firstItem = item?.items?.[0] || null;
      const previewImageUri = firstItem?.image || null;
      const previewName = firstItem?.name || 'Order Item(s)';
      const additionalItemsText = item?.items?.length > 1 ? ` (+${item.items.length - 1})` : '';
      let paymentMethodDisplay = item.paymentMethod || 'N/A';
      if (item.paymentMethod === 'BNPL') { paymentMethodDisplay = item.bnplPlanDetails?.planType === 'Fixed Duration' ? 'Fixed Duration' : 'BNPL'; }
      else if (item.paymentMethod === 'Fixed Duration') { paymentMethodDisplay = 'Fixed Duration'; }

      if (!item || !item.id) return null; // Basic check

      return (
          <TouchableOpacity
              style={styles.orderContainer}
              onPress={() => navigation.navigate('UserOrderDetailScreen', { order: item })}
              activeOpacity={0.7} >
              <View style={styles.orderRow}>
                  <Image source={previewImageUri ? { uri: previewImageUri } : placeholderImagePath} style={styles.previewImage} defaultSource={placeholderImagePath} />
                  <View style={styles.middleContent}>
                      <Text style={styles.orderDateTextSmall}>{item.date || 'N/A'}</Text>
                      <Text style={styles.itemNameText} numberOfLines={1}> {previewName}{additionalItemsText} </Text>
                      <Text style={styles.orderTotalText}> Total: {CURRENCY_SYMBOL} {item.grandTotal?.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}) || 'N/A'} </Text>
                  </View>
                  <View style={styles.rightContent}>
                      <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
                          <Text style={styles.statusText}>{item.status || 'N/A'}</Text>
                      </View>
                      {/* Removed Payment Method Text */}
                  </View>
              </View>
          </TouchableOpacity>
      );
  };

  // --- Render ---
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={ScreenBackgroundColor} />
      {/* Header Removed */}

      {/* Loading Indicator */}
      {loading && userOrders.length === 0 ? (
        <ActivityIndicator size="large" color={AccentColor} style={styles.loader}/>
      ) : (
        <FlatList
          data={userOrders}
          renderItem={renderOrderItem}
          keyExtractor={(item, index) => item?.id || `order-${index}`} // Robust key extractor
          contentContainerStyle={[styles.flatListContainer, userOrders.length === 0 && styles.emptyListContainer]}
          ListEmptyComponent={ !loading ? (<View style={styles.emptyView}><Icon name="dropbox" size={50} color="#ccc"/><Text style={styles.emptyText}>You haven't placed any orders yet.</Text></View>) : null }
          refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AccentColor} colors={[AccentColor]}/> }
          // ItemSeparatorComponent removed for touching items
        />
      )}
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ScreenBackgroundColor, },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', },
  orderContainer: { backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: LightBorderColor, },
  orderRow: { flexDirection: 'row', alignItems: 'center', },
  previewImage: { width: 60, height: 60, borderRadius: 8, marginRight: 12, backgroundColor: PlaceholderBgColor, },
  middleContent: { flex: 1, justifyContent: 'center', marginRight: 8, },
  orderDateTextSmall: { fontSize: 11, color: TextColorSecondary, marginBottom: 4, },
  itemNameText: { fontSize: 14, fontWeight: '600', color: TextColorPrimary, marginBottom: 4, },
  orderTotalText: { fontSize: 14, color: TextColorPrimary, fontWeight: 'bold', },
  rightContent: { alignItems: 'flex-end', justifyContent: 'center', minWidth: 80, },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, },
  statusText: { fontSize: 11, fontWeight: 'bold', color: '#fff', textAlign: 'center', },
  statusPending: { backgroundColor: '#FFA726' }, statusProcessing: { backgroundColor: '#42A5F5' }, statusShipped: { backgroundColor: '#66BB6A' }, statusDelivered: { backgroundColor: '#78909C' }, statusCancelled: { backgroundColor: '#EF5350' }, statusUnknown: { backgroundColor: '#BDBDBD' },
  flatListContainer: { paddingBottom: 10, },
  emptyListContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  emptyView: { alignItems: 'center', paddingBottom: 50, },
  emptyText: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 15 },
});