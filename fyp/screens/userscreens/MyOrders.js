// MyOrders.js (COMPLETE CODE - Final Version with Header, Filters, Back Button, Fixed Active Filter/Style, No Image Error Warning)

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet, Text, View, FlatList, Dimensions, ActivityIndicator, Image,
  TouchableOpacity, TextInput,
  RefreshControl,
  SafeAreaView, StatusBar,
  Platform,
  Alert,
  ScrollView
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { MaterialIcons } from '@expo/vector-icons'; // Keep for BNPL icon in list item
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { db, auth } from '../../firebaseConfig'; // Verify path
import {
  collection, query, where, onSnapshot, Timestamp, doc
} from 'firebase/firestore';
import { format, isValid } from 'date-fns'; // Ensure date-fns is installed

// --- Constants ---
const ORDERS_COLLECTION = 'orders'; // Firestore collection name
const AccentColor = '#FF0000';      // App's accent color (Red)
const TextColorPrimary = '#212121'; // Primary text color
const TextColorSecondary = '#6B7280'; // Secondary text color
const LightBorderColor = '#E5E7EB'; // Border color
const ScreenBackgroundColor = '#F8F9FA'; // Screen background color
const HeaderIconColor = '#FFFFFF'; // Color for header icons (like back arrow)
const PlaceholderBgColor = '#F0F0F0'; // Image placeholder background
const CURRENCY_SYMBOL = 'PKR';         // Currency symbol
const placeholderImagePath = require('../../assets/p3.jpg'); // Verify path to placeholder image
const BnplIndicatorBgColor = 'rgba(0, 86, 179, 0.1)'; // Background for BNPL badge
const BnplIndicatorTextColor = '#0056b3'; // Text/icon color for BNPL badge
const ACTIVE_FILTER_STATUSES = ['processing', 'active']; // Statuses for 'Active' button filter

// --- Fixed Filters Configuration ---
const FIXED_FILTERS = [
  { displayName: 'All', filterValue: 'All' },
  { displayName: 'Pending', filterValue: 'Pending' },
  { displayName: 'Active', filterValue: 'Processing' }, // Button value remains 'Processing' for state
  { displayName: 'Shipped', filterValue: 'Shipped' },
  { displayName: 'Completed', filterValue: 'Delivered' }, // 'Completed' maps to 'Delivered' status
  { displayName: 'Cancelled', filterValue: 'Cancelled' },
];

// --- Main Component ---
export default function MyOrders() {
  const navigation = useNavigation();
  const [userOrders, setUserOrders] = useState([]); // State for raw orders data
  const [loading, setLoading] = useState(true);    // Loading state indicator
  const [userId, setUserId] = useState(null);       // Logged-in user's Firebase UID
  const [refreshing, setRefreshing] = useState(false); // Pull-to-refresh indicator state
  const listenerUnsubscribeRef = useRef(null); // Ref to store the Firestore listener cleanup function
  const [searchQuery, setSearchQuery] = useState(''); // State for the search bar input
  const [filter, setFilter] = useState('All'); // State for the selected filter value ('All', 'Pending', etc.)

  // --- Effect 1: Monitor Authentication State ---
  useEffect(() => {
    console.log("[MyOrders] Attaching Auth listener.");
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      const currentUid = user ? user.uid : null;
      console.log("[MyOrders] Auth State Changed. User ID:", currentUid);
      if (currentUid !== userId) {
        setUserId(currentUid);
        setSearchQuery('');
        setFilter('All');
        if (!currentUid) {
          setUserOrders([]); setLoading(false); setRefreshing(false);
          if (listenerUnsubscribeRef.current) {
             console.log("[MyOrders] Cleaning up Firestore listener due to logout.");
             listenerUnsubscribeRef.current();
             listenerUnsubscribeRef.current = null;
          }
        } else {
          if (userOrders.length === 0) { setLoading(true); }
        }
      }
    });
    return () => {
      console.log("[MyOrders] Cleaning up Auth Listener.");
      unsubscribeAuth();
    };
  }, [userId, userOrders.length]);


  // --- Effect 2 / Function: Setup Firestore Listener ---
  const setupOrderListener = useCallback(() => {
    if (!userId) {
      console.log("[MyOrders] Firestore Listener Setup: No userId. Clearing orders.");
      setUserOrders([]); setLoading(false); setRefreshing(false);
      if (listenerUnsubscribeRef.current) { listenerUnsubscribeRef.current(); listenerUnsubscribeRef.current = null; }
      return null;
    }

    console.log(`[MyOrders] Firestore Listener Setup: Setting up for user ${userId}.`);
    if (listenerUnsubscribeRef.current) {
        console.log("[MyOrders] Firestore Listener Setup: Detaching previous listener.");
        listenerUnsubscribeRef.current();
        listenerUnsubscribeRef.current = null;
    }

    const ordersRef = collection(db, ORDERS_COLLECTION);
    const q = query(ordersRef, where("userId", "==", userId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`[MyOrders] Firestore Snapshot: Received ${snapshot.docs.length} orders for user ${userId}.`);
      let fetchedOrders = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        if (!data || !(data.createdAt instanceof Timestamp)) {
            return null;
        }
        const paymentMethodLower = data.paymentMethod?.toLowerCase() ?? '';
        const isBNPL = ['bnpl', 'fixed duration', 'mixed'].includes(paymentMethodLower);
        let formattedDate = 'N/A';
        const createdAtDate = data.createdAt.toDate();
        if (isValid(createdAtDate)) { formattedDate = format(createdAtDate, 'MMM d, yyyy'); }
        return {
            id: docSnap.id,
            orderNumber: docSnap.id.substring(0, 8).toUpperCase(),
            date: formattedDate,
            createdAtTimestamp: data.createdAt,
            status: data.status || 'Unknown',
            isBNPL: isBNPL,
            grandTotal: data.grandTotal,
            items: data.items || [],
            ...data
        };
      }).filter(item => item !== null);

      fetchedOrders.sort((a, b) => (b.createdAtTimestamp?.seconds ?? 0) - (a.createdAtTimestamp?.seconds ?? 0));

      setUserOrders(fetchedOrders);
      setLoading(false);
      setRefreshing(false);

    }, (error) => {
      console.error("[MyOrders] Firestore listener error:", error);
      Alert.alert("Error", "Could not fetch your orders. Please check connection and pull to refresh.");
      setLoading(false); setRefreshing(false); setUserOrders([]);
    });

    listenerUnsubscribeRef.current = unsubscribe;
    return unsubscribe;
  }, [userId]);

  // --- Effect 3: Manage Listener Lifecycle with Focus ---
  useFocusEffect(
    useCallback(() => {
      console.log("[MyOrders] Screen focused, running setupOrderListener.");
      setupOrderListener();
      return () => {
        if (listenerUnsubscribeRef.current) {
          console.log("[MyOrders] Screen blurred/unmounted, cleaning up listener.");
          listenerUnsubscribeRef.current();
          listenerUnsubscribeRef.current = null;
        }
      };
    }, [setupOrderListener])
  );

  // --- Filtering Logic ---
  const filteredOrders = useMemo(() => {
    console.log(`Filtering ${userOrders.length} orders. Query: "${searchQuery}", Filter Button State: "${filter}"`);
    return userOrders.filter(order => {
      // 1. Check Search Query
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = (
           !searchQuery ||
           (order.orderNumber.toLowerCase().includes(searchLower)) ||
           (order.items?.[0]?.name?.toLowerCase().includes(searchLower))
       );

      // 2. Check Status Filter
      const filterValueLower = filter.toLowerCase();
      const orderStatusLower = order.status?.toLowerCase();
      let matchesFilter = false;

      if (filter === 'All') {
          matchesFilter = true;
      } else if (filter === 'Processing') { // When 'Active' button is pressed
          matchesFilter = ACTIVE_FILTER_STATUSES.includes(orderStatusLower);
      } else {
          matchesFilter = (orderStatusLower === filterValueLower);
      }

      return matchesSearch && matchesFilter;
    });
  }, [userOrders, searchQuery, filter]);


  // --- Handle Pull-to-Refresh ---
  const onRefresh = useCallback(() => {
    if (!userId) {
        console.log("[MyOrders] Cannot refresh, no user logged in.");
        setRefreshing(false);
        return;
    }
    console.log("[MyOrders] Manual refresh triggered. Re-running setupOrderListener.");
    setRefreshing(true);
    setupOrderListener();
    const refreshTimeout = setTimeout(() => {
        if (refreshing) {
            console.log("[MyOrders] Refresh timeout reached. Forcing indicator off.");
            setRefreshing(false);
        }
     }, 8000);
    return () => clearTimeout(refreshTimeout);
  }, [userId, refreshing, setupOrderListener]);


  // --- Helper Function for Status Styles ---
  const getStatusStyle = (status) => {
    const lowerStatus = status?.toLowerCase() || 'unknown';
    switch (lowerStatus) {
        case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': case 'unpaid (bnpl)': case 'mixed (cod/bnpl pending)': case 'mixed (cod/fixed pending)': return styles.statusPending;
        case 'processing': case 'partially paid': return styles.statusProcessing;
        case 'active': return styles.statusActive;
        case 'shipped': return styles.statusShipped;
        case 'delivered': return styles.statusDelivered;
        case 'cancelled': case 'rejected': return styles.statusCancelled;
        default: return styles.statusUnknown;
    }
  };

  // --- Render Function for Each Order Item in the FlatList ---
  // *** MODIFIED: Removed onError from Image component ***
  const renderOrderItem = ({ item }) => {
      const firstItem = item?.items?.[0] || null;
      const previewImageUri = firstItem?.image || null;
      const previewName = firstItem?.name || 'Order Item(s)';
      const additionalItemsText = item?.items?.length > 1 ? ` (+${item.items.length - 1})` : '';
      if (!item || !item.id) return null;

      return (
        <TouchableOpacity
            style={styles.orderContainer}
            onPress={() => navigation.navigate('UserOrderDetailScreen', { order: item })}
            activeOpacity={0.7}
        >
            <View style={styles.orderRow}>
                <Image
                    source={previewImageUri ? { uri: previewImageUri } : placeholderImagePath}
                    style={styles.previewImage}
                    defaultSource={placeholderImagePath}
                    // onError prop is removed here
                />
                <View style={styles.middleContent}>
                    <Text style={styles.orderDateTextSmall}>{item.date || 'N/A'}</Text>
                    <Text style={styles.itemNameText} numberOfLines={1}> {previewName}{additionalItemsText} </Text>
                    <Text style={styles.orderTotalText}> Total: {CURRENCY_SYMBOL} {item.grandTotal?.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}) || 'N/A'} </Text>
                    {item.isBNPL && (
                        <View style={styles.bnplIndicatorContainer}>
                            <MaterialIcons name="credit-card" size={12} color={BnplIndicatorTextColor} style={styles.bnplIcon}/>
                            <Text style={styles.bnplIndicatorText}>BNPL/Fixed</Text>
                        </View>
                    )}
                </View>
                <View style={styles.rightContent}>
                    <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
                        <Text style={styles.statusText}>{item.status || 'N/A'}</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
      );
   };

  // --- Header Event Handlers ---
  const onSearchInputChange = (text) => { setSearchQuery(text); };
  const clearSearch = () => { setSearchQuery(''); };
  const onFilterChange = (newFilterValue) => {
      console.log("Filter changed to:", newFilterValue);
      setFilter(newFilterValue);
  };
  const handleGoBack = () => { navigation.goBack(); };

  // --- Component Render ---
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={AccentColor} />

      {/* Header Section */}
      <View style={styles.headerContainer}>
          <View style={styles.headerTopRow}>
             <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
                 <Icon name="arrow-left" size={24} color={HeaderIconColor} />
             </TouchableOpacity>
             <View style={styles.searchBar}>
                 <Icon name="magnify" size={20} color={AccentColor} style={styles.searchIcon} />
                 <TextInput
                     style={styles.searchInput}
                     placeholder="Search Order ID or Item..."
                     placeholderTextColor="#888"
                     value={searchQuery}
                     onChangeText={onSearchInputChange}
                     returnKeyType="search"
                     autoCapitalize="none"
                     autoCorrect={false}
                 />
                 {searchQuery.length > 0 && (
                     <TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}>
                         <Icon name="close-circle" size={18} color={AccentColor} />
                     </TouchableOpacity>
                 )}
             </View>
         </View>
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

      {/* Main Content Area */}
      {loading && userId && userOrders.length === 0 ? (
        <ActivityIndicator size="large" color={AccentColor} style={styles.loader}/>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrderItem}
          keyExtractor={(item, index) => item?.id || `order-${index}`}
          contentContainerStyle={[styles.flatListContainer, filteredOrders.length === 0 && styles.emptyListContainer]}
          ListEmptyComponent={
             !loading && userId ? (
                <View style={styles.emptyView}>
                    <Icon name={searchQuery || filter !== 'All' ? "search-web" : "dropbox"} size={50} color="#ccc"/>
                    <Text style={styles.emptyText}>
                        {searchQuery || filter !== 'All' ? "No orders match your criteria." : "You haven't placed any orders yet."}
                    </Text>
                </View>
             ) : !loading && !userId ? (
                <View style={styles.emptyView}>
                    <Icon name="login" size={50} color="#ccc"/>
                    <Text style={styles.emptyText}>Please log in to view your orders.</Text>
                </View>
             ): null
          }
          refreshControl={
             <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={AccentColor}
                colors={[AccentColor]}
            />
           }
           ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ScreenBackgroundColor, },
  // Header Styles
  headerContainer: {
      backgroundColor: AccentColor,
      paddingTop: Platform.OS === 'ios' ? 50 : 20,
      paddingBottom: 10,
      paddingHorizontal: 10,
      borderBottomLeftRadius: 15,
      borderBottomRightRadius: 15,
      elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3,
  },
  headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      paddingHorizontal: 5,
  },
  backButton: {
      padding: 6,
      marginRight: 6,
  },
  searchBar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFF',
      borderRadius: 50,
      paddingHorizontal: 13,
      height: 40,
  },
  searchIcon: {
      marginRight: 8,
  },
  searchInput: {
      flex: 1,
      fontSize: 14,
      color: '#333',
  },
  clearSearchButton: {
      padding: 4,
      marginLeft: 4,
  },
  filterScroll: {
paddingLeft:10,  },
  filterButton: {
      paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, backgroundColor: AccentColor,
      borderWidth: 1, borderColor: '#FFFFFF', marginRight: 10, justifyContent: 'center', alignItems: 'center', height: 32,
  },
  filterText: { fontSize: 13, color: '#FFFFFF', fontWeight: '500', },
  activeFilter: { backgroundColor: '#000000', borderColor: '#000000', },
  activeFilterText: { color: '#FFFFFF', fontWeight: 'bold', },
  // List & Item Styles
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', },
  orderContainer: { backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 15, },
  orderRow: { flexDirection: 'row', alignItems: 'center', },
  previewImage: { width: 60, height: 60, borderRadius: 8, marginRight: 12, backgroundColor: PlaceholderBgColor, },
  middleContent: { flex: 1, justifyContent: 'center', marginRight: 8, },
  orderDateTextSmall: { fontSize: 11, color: TextColorSecondary, marginBottom: 4, },
  itemNameText: { fontSize: 14, fontWeight: '600', color: TextColorPrimary, marginBottom: 4, },
  orderTotalText: { fontSize: 14, color: TextColorPrimary, fontWeight: 'bold', },
  rightContent: { alignItems: 'flex-end', justifyContent: 'center', minWidth: 80, },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, marginBottom: 4, },
  statusText: { fontSize: 11, fontWeight: 'bold', color: '#fff', textAlign: 'center', },
  statusPending: { backgroundColor: '#FFA726' },
  statusProcessing: { backgroundColor: '#42A5F5' },
  statusActive: { backgroundColor: '#29B6F6' },
  statusShipped: { backgroundColor: '#66BB6A' },
  statusDelivered: { backgroundColor: '#78909C' },
  statusCancelled: { backgroundColor: '#EF5350' },
  statusUnknown: { backgroundColor: '#BDBDBD' },
  bnplIndicatorContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, alignSelf: 'flex-start', backgroundColor: BnplIndicatorBgColor, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, },
  bnplIcon: { marginRight: 4, },
  bnplIndicatorText: { fontSize: 10, fontWeight: '600', color: BnplIndicatorTextColor, },
  flatListContainer: { paddingBottom: 10, },
  emptyListContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  emptyView: { alignItems: 'center', paddingBottom: 50, },
  emptyText: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 15 },
  separator: { height: 1, backgroundColor: LightBorderColor, marginHorizontal: 15 },
});