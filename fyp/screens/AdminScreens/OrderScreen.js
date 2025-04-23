// OrderScreen.js (COMPLETE CODE - Admin View - Real-time ALL Orders, Search/Filter, Refresh, Final UI)

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  Dimensions, Platform, ScrollView, ActivityIndicator, Alert,
  SafeAreaView, StatusBar, RefreshControl, Image // Ensure all imports needed are here
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome'; // Using FontAwesome
import { LinearGradient } from 'expo-linear-gradient'; // Ensure installed
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { db } from '../../firebaseConfig'; // Verify path
import {
    collection, query, orderBy, onSnapshot, Timestamp, // Keep Timestamp
    where, // Keep where if needed for future query changes
    documentId // Keep documentId if needed elsewhere
} from 'firebase/firestore';
import { format, isValid } from 'date-fns'; // Ensure date-fns installed

const { width } = Dimensions.get('window');

// --- Constants ---
const ORDERS_COLLECTION = 'orders';
const AccentColor = '#FF0000';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const LightBorderColor = '#E0E0E0';
const ScreenBackgroundColor = '#F5F5F5';
const CURRENCY_SYMBOL = 'PKR';
const PlaceholderBgColor = '#F0F0F0';
// ** Make sure this path is correct relative to this file **
const placeholderImagePath = require('../../assets/p3.jpg');
const FILTER_STATUSES = ['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Rejected']; // Add all relevant statuses used in your DB

// --- Main Component ---
export default function OrderScreen() {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('All'); // Default filter
  const [allFetchedOrders, setAllFetchedOrders] = useState([]); // Holds raw data from listener
  const [loading, setLoading] = useState(true); // Initial loading state
  const [refreshing, setRefreshing] = useState(false); // Pull-to-refresh state
  // Ref to store the current listener's unsubscribe function
  const listenerUnsubscribeRef = useRef(null);

  // --- Function to Setup Listener (Fetches ALL orders, real-time) ---
  const setupOrderListener = useCallback(() => {
    console.log("[OrderScreen Admin] Setting up listener for ALL orders...");

    // Detach any previous listener before attaching a new one
    if (listenerUnsubscribeRef.current) {
        console.log("[OrderScreen Admin] Detaching previous listener...");
        listenerUnsubscribeRef.current();
        listenerUnsubscribeRef.current = null; // Clear the ref
    }

    // Set loading true only if not refreshing and list is currently empty
    if (!refreshing && allFetchedOrders.length === 0) {
        setLoading(true);
    }

    const ordersRef = collection(db, ORDERS_COLLECTION);
    // Query all orders, ordered by creation date (newest first)
    const q = query(ordersRef, orderBy("createdAt", "desc"));

    // Attach the snapshot listener and store the unsubscribe function
    listenerUnsubscribeRef.current = onSnapshot(q, (snapshot) => {
      console.log(`[OrderScreen Admin] Snapshot received: ${snapshot.docs.length} total orders.`);
      const fetchedOrders = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        // Basic validation
         if (!data || !(data.createdAt instanceof Timestamp)) {
            console.warn(`[OrderScreen Admin] Skipping order doc ${docSnap.id}: Missing data or invalid createdAt`, data);
            return null;
        }
        // Format date safely
        let formattedDate = 'N/A';
        const createdAtDate = data.createdAt.toDate();
        if (isValid(createdAtDate)) { formattedDate = format(createdAtDate, 'MMM d, yyyy'); }

        // Construct the object for the list
        return {
          id: docSnap.id,
          orderNumber: docSnap.id.substring(0, 8).toUpperCase(),
          date: formattedDate,
          createdAtTimestamp: data.createdAt, // Keep for potential detailed view sorting
          status: data.status || 'Unknown',
          grandTotal: data.grandTotal,
          userName: data.userName || 'Unknown User', // User's name from order data
          paymentMethod: data.paymentMethod,
          items: data.items || [], // Include items array (for preview and details)
          // Include full data for navigation
          ...data
        };
      }).filter(item => item !== null); // Filter out any invalid items

      setAllFetchedOrders(fetchedOrders); // Update state with ALL fetched orders
      setLoading(false);        // Stop initial loading indicator
      setRefreshing(false);     // Stop pull-to-refresh indicator

    }, (error) => { // Error handler for the listener
      console.error("[OrderScreen Admin] Error listening to orders:", error);
      Alert.alert("Error", "Could not load orders in real-time.");
      setLoading(false);
      setRefreshing(false);
    });

    // Return the unsubscribe function for cleanup
    return listenerUnsubscribeRef.current;

  }, [refreshing, allFetchedOrders.length]); // Dependencies for the setup function


  // --- Effect to Manage Listener on Focus/Blur ---
  useFocusEffect(
    useCallback(() => {
      // Setup listener when screen focuses
      const unsubscribe = setupOrderListener();
      // Cleanup listener when screen blurs or component unmounts
      return () => {
        if (unsubscribe) {
          console.log("[OrderScreen Admin] Cleaning up listener on blur/unmount.");
          unsubscribe();
          listenerUnsubscribeRef.current = null; // Clear ref on cleanup
        }
      };
    }, [setupOrderListener]) // Depend on the setup function reference
  );


  // --- Client-Side Filtering Logic ---
  const filteredOrders = useMemo(() => {
    console.log(`Filtering ${allFetchedOrders.length} orders. Query: "${searchQuery}", Filter: "${filter}"`);
    return allFetchedOrders.filter(order => {
      // Check search query (case-insensitive)
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = (
           (order.id.toLowerCase().includes(searchLower)) || // Check full ID
           (order.orderNumber.toLowerCase().includes(searchLower)) || // Check truncated Order Number
           (order.userName?.toLowerCase().includes(searchLower)) || // Check User Name
           (order.items?.[0]?.name?.toLowerCase().includes(searchLower)) // Check First Item Name
       );

      // Check status filter (case-insensitive comparison recommended)
      const filterLower = filter.toLowerCase();
      const statusLower = order.status?.toLowerCase();
      // Handle "All" filter or match status
      const matchesFilter = (filter === 'All') || (statusLower === filterLower);

      return matchesSearch && matchesFilter;
    });
  }, [allFetchedOrders, searchQuery, filter]); // Recalculate when data or filters change


  // --- Get Status Badge Style ---
  const getStatusStyle = (status) => {
      // Ensure case-insensitivity and handle null/undefined
      switch (status?.toLowerCase() ?? 'unknown') {
          case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': return styles.statusPending;
          case 'processing': case 'partially paid': return styles.statusProcessing;
          case 'shipped': return styles.statusShipped;
          case 'delivered': return styles.statusDelivered;
          case 'cancelled': case 'rejected': return styles.statusCancelled;
          default: return styles.statusUnknown;
      }
  };

  // --- Render Order Item ---
  const renderOrder = ({ item }) => {
    // Safely get the first item and its image URL
    const firstItem = item?.items?.[0] || null;
    const firstItemImage = firstItem?.image || null;
    // Use placeholder if first item has no valid image URL
    const imageSource = firstItemImage ? { uri: firstItemImage } : placeholderImagePath;

    return (
        <TouchableOpacity
            style={styles.orderItem}
            onPress={() => navigation.navigate('AdminDetailOrderScreen', { order: item })} // Pass full order object
            activeOpacity={0.7}
        >
          <View style={styles.orderRow}>
              {/* Left Icon/Image */}
              <View style={styles.iconContainer}>
                 <Image
                    source={imageSource}
                    style={styles.previewImage} // Use specific style for image
                    defaultSource={placeholderImagePath} // Fallback while loading/error
                    onError={(e) => console.warn("Error loading product image:", firstItemImage, e.nativeEvent?.error)} // Added error logging
                 />
              </View>

              {/* Middle Content */}
              <View style={styles.orderInfo}>
                <Text style={styles.orderName} numberOfLines={1}>{item.userName}</Text>
                <Text style={styles.orderIdText}>#{item.orderNumber}</Text>
                <Text style={styles.orderPrice}>
                    {CURRENCY_SYMBOL} {item.grandTotal?.toLocaleString(undefined, {maximumFractionDigits: 0}) || 'N/A'}
                </Text>
              </View>

              {/* Right Content: Status and Date */}
              <View style={styles.statusContainer}>
                <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
                  <Text style={styles.statusText}>{item.status || 'N/A'}</Text>
                </View>
                 <Text style={styles.orderDateText}>{item.date || 'N/A'}</Text>
              </View>
          </View>
        </TouchableOpacity>
    );
  };


  // --- Handle Refresh ---
   const onRefresh = useCallback(() => {
    console.log("[OrderScreen Admin] Manual refresh triggered.");
    setRefreshing(true); // Show spinner
    // Re-run the setup function which handles detaching/attaching listener
    // and setting refreshing to false inside the snapshot callback.
    setupOrderListener();
    // Fallback timeout remains useful
    const refreshTimeout = setTimeout(() => {
        if (refreshing) {
            console.warn("[OrderScreen Admin] Refresh timeout.");
            setRefreshing(false);
        }
     }, 8000); // Increased timeout slightly
    return () => clearTimeout(refreshTimeout);
  }, [setupOrderListener]); // Depend on setupOrderListener reference


  // --- Render ---
  return (
    <SafeAreaView style={styles.container}>
      {/* StatusBar Added */}
      <StatusBar barStyle="light-content" backgroundColor={AccentColor} />

      {/* Header with Search and Filters */}
      <LinearGradient colors={[AccentColor, AccentColor]} style={styles.gradientHeader}>
        <View style={styles.searchBar}>
          <Icon name="search" size={18} color={AccentColor} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search User or Order ID..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing" // iOS clear button
            autoCapitalize="none"
            autoCorrect={false}
          />
          {/* Clear button */}
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Icon name="times-circle" size={18} color="#AAA" />
            </TouchableOpacity>
          )}
        </View>
        {/* Filter Buttons */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
          {FILTER_STATUSES.map(item => (
            <TouchableOpacity
              key={item}
              style={[styles.filterButton, filter === item && styles.activeFilter]}
              onPress={() => setFilter(item)} >
              <Text style={[styles.filterText, filter === item && styles.activeFilterText]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      {/* Order List */}
      {/* Show loader only on initial load when order array is empty */}
      {loading && allFetchedOrders.length === 0 ? (
           <ActivityIndicator size="large" color={AccentColor} style={styles.loader} />
       ) : (
            <FlatList
                data={filteredOrders} // Render the filtered data
                keyExtractor={(item) => item.id} // Use Firestore document ID
                renderItem={renderOrder}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                // Use View wrapper for empty component to ensure Text is valid child
                ListEmptyComponent={!loading ? <View style={styles.emptyView}><Icon name="search" size={40} color="#ccc"/><Text style={styles.emptyText}>No orders match your criteria.</Text></View> : null}
                // Add RefreshControl
                refreshControl={
                   <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AccentColor} colors={[AccentColor]}/>
                }
                ItemSeparatorComponent={() => <View style={styles.separator} />} // Add separator
            />
       )}
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ScreenBackgroundColor },
  gradientHeader: { paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: 10, paddingHorizontal: 15, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 25, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 9 : 5, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, marginBottom: 10, },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: '#333', },
  clearButton: { padding: 5, },
  filterScroll: { marginTop: 5, marginBottom: 5 },
  filterContent: { paddingHorizontal: 5, paddingVertical: 5 },
  filterButton: { paddingVertical: 7, paddingHorizontal: 18, borderRadius: 18, backgroundColor: '#FFF', borderWidth: 1, borderColor: AccentColor, marginRight: 8, justifyContent: 'center', height: 38 },
  filterText: { fontSize: 13, color: AccentColor, fontWeight: '500' },
  activeFilter: { backgroundColor: 'black', borderColor: 'black' },
  activeFilterText: { color: '#FFF', fontWeight: 'bold' },
  listContent: { paddingBottom: 15, paddingTop: 5 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyView: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50, paddingHorizontal: 20, }, // Added flex: 1
  emptyText: { textAlign: 'center', fontSize: 16, color: TextColorSecondary, marginTop: 15 },
  orderItem: { backgroundColor: '#FFF', paddingHorizontal: 15, paddingVertical: 12, },
  orderRow: { flexDirection: 'row', alignItems: 'center', },
  iconContainer: { width: 45, height: 45, borderRadius: 8, backgroundColor: PlaceholderBgColor, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden', },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover', },
  orderInfo: { flex: 1, marginRight: 10, justifyContent: 'center' },
  orderName: { fontSize: 15, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 2 },
  orderIdText: { fontSize: 12, color: TextColorSecondary, marginBottom: 4 },
  orderPrice: { fontSize: 14, color: '#444', fontWeight: '500' },
  statusContainer: { alignItems: 'flex-end', minWidth: 85 },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 15, marginBottom: 4 },
  statusText: { color: '#FFF', fontWeight: 'bold', fontSize: 11 },
  statusPending: { backgroundColor: '#FFA726' }, statusProcessing: { backgroundColor: '#42A5F5' }, statusShipped: { backgroundColor: '#66BB6A' }, statusDelivered: { backgroundColor: '#78909C' }, statusCancelled: { backgroundColor: '#EF5350' }, statusUnknown: { backgroundColor: '#BDBDBD' },
  orderDateText: { fontSize: 11, color: TextColorSecondary, marginTop: 2 },
  separator: { height: 1, backgroundColor: LightBorderColor, },
});