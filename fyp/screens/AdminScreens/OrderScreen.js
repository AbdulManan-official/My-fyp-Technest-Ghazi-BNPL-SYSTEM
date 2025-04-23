// OrderScreen.js (COMPLETE CODE - Fetches All Details Verified)

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  Dimensions, Platform, ScrollView, ActivityIndicator, Alert,
  SafeAreaView, StatusBar, RefreshControl, Image
} from 'react-native';
// Using MaterialCommunityIcons for header AND the new BNPL icon
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { db } from '../../firebaseConfig'; // Verify path is correct
import {
    collection, query, orderBy, onSnapshot, Timestamp,
    where, documentId // Keep imports even if not used directly in query (might be used elsewhere)
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
const placeholderImagePath = require('../../assets/p3.jpg'); // Verify path
const BnplIndicatorBgColor = 'rgba(0, 86, 179, 0.1)'; // Light blue background
const BnplIndicatorTextColor = '#0056b3';         // Dark blue text/icon

// --- Fixed Filters Configuration ---
const FIXED_FILTERS = [
  { displayName: 'All', filterValue: 'All' },
  { displayName: 'Pending', filterValue: 'Pending' },
  { displayName: 'Active', filterValue: 'Processing' }, // Maps "Active" to "Processing" status
  { displayName: 'Shipped', filterValue: 'Shipped' },
  { displayName: 'Cancelled', filterValue: 'Cancelled' },
];

// --- Main Component: OrderScreen ---
export default function OrderScreen() {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('All'); // Stores the actual filterValue ('All', 'Pending', etc.)
  const [allFetchedOrders, setAllFetchedOrders] = useState([]); // Holds raw data from listener
  const [loading, setLoading] = useState(true); // Initial loading state
  const [refreshing, setRefreshing] = useState(false); // Pull-to-refresh state
  const listenerUnsubscribeRef = useRef(null); // Ref to store the current listener's unsubscribe function

  // --- Function to Setup Firestore Listener ---
  // Sets up a real-time listener for ALL orders in the 'orders' collection
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

    // Attach the snapshot listener
    listenerUnsubscribeRef.current = onSnapshot(q, (snapshot) => {
      console.log(`[OrderScreen Admin] Snapshot received: ${snapshot.docs.length} total orders.`);
      const fetchedOrders = snapshot.docs.map(docSnap => {
        const data = docSnap.data(); // <--- GETS ALL FIELDS

        // Basic validation for core fields needed for display/logic
         if (!data || !(data.createdAt instanceof Timestamp)) {
             console.warn(`[OrderScreen Admin] Skipping order doc ${docSnap.id}: Missing data or invalid createdAt`, data);
             return null; // Skip this invalid document
        }

        // Format date safely
        let formattedDate = 'N/A';
        const createdAtDate = data.createdAt.toDate();
        if (isValid(createdAtDate)) { formattedDate = format(createdAtDate, 'MMM d, yyyy'); }

        // Construct the object for the state array
        // Includes explicitly processed fields AND all other fields via spread operator
        return {
          id: docSnap.id, // Document ID
          orderNumber: docSnap.id.substring(0, 8).toUpperCase(), // Short order number
          date: formattedDate, // Formatted date
          createdAtTimestamp: data.createdAt, // Original timestamp
          status: data.status || 'Unknown', // Order status
          grandTotal: data.grandTotal, // Order total
          userName: data.userName || 'Unknown User', // Customer name
          paymentMethod: data.paymentMethod || 'Unknown', // Payment method
          items: data.items || [], // Items array
          ...data // <--- SPREAD OPERATOR TO INCLUDE ALL OTHER FIELDS FROM FIRESTORE
        };
      }).filter(item => item !== null); // Filter out any skipped items

      setAllFetchedOrders(fetchedOrders); // Update state with the complete list
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

  // --- Effect to Manage Listener Lifecycle ---
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
  // Filters the fetched orders based on search query and selected status filter
  const filteredOrders = useMemo(() => {
    console.log(`Filtering ${allFetchedOrders.length} orders. Query: "${searchQuery}", Filter State: "${filter}"`);
    return allFetchedOrders.filter(order => {
      // Check search query (case-insensitive)
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = (
           !searchQuery || // Pass if search is empty
           (order.id.toLowerCase().includes(searchLower)) ||
           (order.orderNumber.toLowerCase().includes(searchLower)) ||
           (order.userName?.toLowerCase().includes(searchLower)) ||
           (order.items?.[0]?.name?.toLowerCase().includes(searchLower)) // Basic check on first item name
       );

      // Check status filter
      const filterValueLower = filter.toLowerCase(); // Value like 'processing'
      const orderStatusLower = order.status?.toLowerCase();
      const matchesFilter = (filter === 'All') || (orderStatusLower === filterValueLower); // 'All' or exact match

      return matchesSearch && matchesFilter; // Must match both
    });
  }, [allFetchedOrders, searchQuery, filter]); // Recalculate when dependencies change


  // --- Get Status Badge Style ---
  // Returns style object based on order status
  const getStatusStyle = (status) => {
      switch (status?.toLowerCase() ?? 'unknown') {
          case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': case 'unpaid (bnpl)': return styles.statusPending;
          case 'processing': case 'partially paid': return styles.statusProcessing;
          case 'shipped': return styles.statusShipped;
          case 'delivered': return styles.statusDelivered;
          case 'cancelled': case 'rejected': return styles.statusCancelled;
          default: return styles.statusUnknown;
      }
  };

  // --- Render Individual Order Item for FlatList ---
  const renderOrder = ({ item }) => {
    // Get first item image safely
    const firstItem = item?.items?.[0] || null;
    const firstItemImage = firstItem?.image || null;
    const imageSource = firstItemImage ? { uri: firstItemImage } : placeholderImagePath;

    // Determine if it's a BNPL/Fixed order for indicator badge
    const orderPaymentMethodLower = item.paymentMethod?.toLowerCase() ?? '';
    const isBnplOrder = ['bnpl', 'fixed duration', 'mixed'].includes(orderPaymentMethodLower);

    return (
        // Touchable opacity navigates to detail screen, passing the *entire* item object
        <TouchableOpacity
            style={styles.orderItem}
            onPress={() => navigation.navigate('AdminDetailOrderScreen', { order: item })}
            activeOpacity={0.7}
        >
          <View style={styles.orderRow}>
              {/* Left Icon/Image */}
              <View style={styles.iconContainer}>
                 <Image source={imageSource} style={styles.previewImage} defaultSource={placeholderImagePath} onError={(e) => console.warn("Error loading product image:", firstItemImage, e.nativeEvent?.error)} />
              </View>

              {/* Middle Content: Texts + BNPL Badge */}
              <View style={styles.orderInfo}>
                <Text style={styles.orderName} numberOfLines={1}>{item.userName}</Text>
                <Text style={styles.orderIdText}>#{item.orderNumber}</Text>
                <Text style={styles.orderPrice}>
                    {CURRENCY_SYMBOL} {item.grandTotal?.toLocaleString(undefined, {maximumFractionDigits: 0}) || 'N/A'}
                </Text>
                {/* Conditionally Render BNPL Indicator Badge */}
                {isBnplOrder && (
                    <View style={styles.bnplIndicatorContainer}>
                        <Icon name="credit-card-clock-outline" size={12} color={BnplIndicatorTextColor} style={styles.bnplIcon} />
                        <Text style={styles.bnplIndicatorText}>BNPL</Text>
                    </View>
                )}
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


  // --- Handle Pull-to-Refresh ---
  const onRefresh = useCallback(() => {
    console.log("[OrderScreen Admin] Manual refresh triggered.");
    setRefreshing(true); // Show spinner
    // Re-running setupOrderListener handles detaching old listener and attaching new one.
    // It will also set refreshing back to false inside its success/error callbacks.
    setupOrderListener();
    // Fallback timeout in case listener hangs
    const refreshTimeout = setTimeout(() => {
        if (refreshing) {
            console.warn("[OrderScreen Admin] Refresh timeout reached.");
            setRefreshing(false);
        }
     }, 8000); // 8 seconds
    return () => clearTimeout(refreshTimeout); // Cleanup timeout on unmount/re-run
  }, [setupOrderListener, refreshing]); // Include refreshing in dependency array


  // --- Event Handlers for Header Elements ---
  const onSearchInputChange = (text) => { setSearchQuery(text); };
  const clearSearch = () => { setSearchQuery(''); };
  const onFilterChange = (newFilterValue) => {
      console.log("Filter changed to:", newFilterValue);
      setFilter(newFilterValue); // Update the filter state
  };


  // --- Component Render ---
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={AccentColor} />

      {/* Header Section */}
      <View style={styles.headerContainer}>
          {/* Search Bar */}
          <View style={styles.searchBar}>
              <Icon name="magnify" size={22} color={AccentColor} style={styles.searchIcon} />
              <TextInput
                  style={styles.searchInput}
                  placeholder="Search User or Order ID..."
                  placeholderTextColor="#888"
                  value={searchQuery}
                  onChangeText={onSearchInputChange}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}>
                      <Icon name="close-circle" size={20} color={AccentColor} />
                  </TouchableOpacity>
              )}
          </View>

          {/* Fixed Filter Buttons */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {FIXED_FILTERS.map(filterItem => (
                  <TouchableOpacity
                      key={filterItem.filterValue}
                      style={[ styles.filterButton, filter === filterItem.filterValue && styles.activeFilter ]}
                      onPress={() => onFilterChange(filterItem.filterValue)} >
                      <Text style={[ styles.filterText, filter === filterItem.filterValue && styles.activeFilterText ]}>
                          {filterItem.displayName}
                      </Text>
                  </TouchableOpacity>
              ))}
          </ScrollView>
      </View>

      {/* Main Content: Order List */}
      {/* Show loader only on initial load */}
      {loading && allFetchedOrders.length === 0 ? (
           <ActivityIndicator size="large" color={AccentColor} style={styles.loader} />
       ) : (
            <FlatList
                data={filteredOrders} // Render the filtered data
                keyExtractor={(item) => item.id} // Use Firestore document ID
                renderItem={renderOrder} // Function to render each order item
                contentContainerStyle={styles.listContent} // Styling for the list container
                showsVerticalScrollIndicator={false}
                // Component shown when list is empty after filtering/loading
                ListEmptyComponent={!loading ? (
                    <View style={styles.emptyView}>
                        <Icon name="magnify-close" size={40} color="#ccc"/>
                        <Text style={styles.emptyText}>No orders match your criteria.</Text>
                    </View>
                 ) : null}
                // Pull-to-refresh configuration
                refreshControl={
                   <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={AccentColor} // iOS color
                        colors={[AccentColor]} // Android color(s)
                    />
                }
                // Add separator lines between items
                ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
       )}
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  // Core & Header Styles
  container: { flex: 1, backgroundColor: ScreenBackgroundColor },
  headerContainer: { backgroundColor: '#FF0000', paddingTop: Platform.OS === 'ios' ? 50 : 22, paddingBottom: 15, paddingHorizontal: 15, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 50, paddingHorizontal: 15, height: 45, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, marginBottom: 8, },
  searchIcon: { marginRight: 10, },
  searchInput: { flex: 1, fontSize: 15, color: '#333', },
  clearSearchButton: { padding: 5, marginLeft: 5, },
  filterScroll: { marginTop: 3, },
  filterButton: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#FF0000', borderWidth: 1, borderColor: '#FFFFFF', marginRight: 10, justifyContent: 'center', alignItems: 'center', height: 34, },
  filterText: { fontSize: 13, color: '#FFFFFF', fontWeight: '500', },
  activeFilter: { backgroundColor: '#000000', borderColor: '#000000', },
  activeFilterText: { color: '#FFFFFF', fontWeight: 'bold', },

  // List & Item Styles
  listContent: { paddingBottom: 15, paddingTop: 0 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyView: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50, paddingHorizontal: 20, },
  emptyText: { textAlign: 'center', fontSize: 16, color: TextColorSecondary, marginTop: 15 },
  orderItem: { backgroundColor: '#FFF', paddingHorizontal: 15, paddingVertical: 12, },
  orderRow: { flexDirection: 'row', alignItems: 'center', },
  iconContainer: { width: 45, height: 45, borderRadius: 8, backgroundColor: PlaceholderBgColor, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden', },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover', },
  orderInfo: { flex: 1, marginRight: 10, justifyContent: 'center' },
  orderName: { fontSize: 15, fontWeight: 'bold', color: TextColorPrimary, marginBottom: 2 },
  orderIdText: { fontSize: 12, color: TextColorSecondary, marginBottom: 4 },
  orderPrice: { fontSize: 14, color: '#444', fontWeight: '500', },
  bnplIndicatorContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 5, alignSelf: 'flex-start', backgroundColor: BnplIndicatorBgColor, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, },
  bnplIcon: { marginRight: 4, },
  bnplIndicatorText: { fontSize: 11, fontWeight: '600', color: BnplIndicatorTextColor, },
  statusContainer: { alignItems: 'flex-end', minWidth: 85 },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 15, marginBottom: 4 },
  statusText: { color: '#FFF', fontWeight: 'bold', fontSize: 11 },
  statusPending: { backgroundColor: '#FFA726' }, statusProcessing: { backgroundColor: '#42A5F5' }, statusShipped: { backgroundColor: '#66BB6A' }, statusDelivered: { backgroundColor: '#78909C' }, statusCancelled: { backgroundColor: '#EF5350' }, statusUnknown: { backgroundColor: '#BDBDBD' },
  orderDateText: { fontSize: 11, color: TextColorSecondary, marginTop: 2 },
  separator: { height: 1, backgroundColor: LightBorderColor, },
});