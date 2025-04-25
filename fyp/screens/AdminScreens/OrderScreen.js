// OrderScreen.js (COMPLETE CODE - Added "Completed" Filter)

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  Dimensions, Platform, ScrollView, ActivityIndicator, Alert,
  SafeAreaView, StatusBar, RefreshControl, Image
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { db } from '../../firebaseConfig'; // Verify path is correct
import {
    collection, query, orderBy, onSnapshot, Timestamp,
    where, documentId
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
const BnplIndicatorBgColor = 'rgba(0, 86, 179, 0.1)';
const BnplIndicatorTextColor = '#0056b3';

// --- MODIFIED: Added "Completed" Filter ---
const FIXED_FILTERS = [
  { displayName: 'All', filterValue: 'All' },
  { displayName: 'Pending', filterValue: 'Pending' },
  { displayName: 'Active', filterValue: 'Processing' }, // Maps "Active" to "Processing" status
  { displayName: 'Shipped', filterValue: 'Shipped' },
  { displayName: 'Completed', filterValue: 'Delivered' }, // Added: Maps "Completed" display to "Delivered" status
  { displayName: 'Cancelled', filterValue: 'Cancelled' },
];
// --- END MODIFICATION ---

// --- Main Component: OrderScreen ---
export default function OrderScreen() {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [allFetchedOrders, setAllFetchedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const listenerUnsubscribeRef = useRef(null);

  // --- Function to Setup Firestore Listener ---
  const setupOrderListener = useCallback(() => {
    console.log("[OrderScreen Admin] Setting up listener for ALL orders...");
    if (listenerUnsubscribeRef.current) {
        console.log("[OrderScreen Admin] Detaching previous listener...");
        listenerUnsubscribeRef.current();
        listenerUnsubscribeRef.current = null;
    }
    if (!refreshing && allFetchedOrders.length === 0) { setLoading(true); }

    const ordersRef = collection(db, ORDERS_COLLECTION);
    const q = query(ordersRef, orderBy("createdAt", "desc"));

    listenerUnsubscribeRef.current = onSnapshot(q, (snapshot) => {
      console.log(`[OrderScreen Admin] Snapshot received: ${snapshot.docs.length} total orders.`);
      const fetchedOrders = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
         if (!data || !(data.createdAt instanceof Timestamp)) {
             console.warn(`[OrderScreen Admin] Skipping order doc ${docSnap.id}: Missing data or invalid createdAt`, data);
             return null;
        }
        let formattedDate = 'N/A';
        const createdAtDate = data.createdAt.toDate();
        if (isValid(createdAtDate)) { formattedDate = format(createdAtDate, 'MMM d, yyyy'); }

        return {
          id: docSnap.id,
          orderNumber: docSnap.id.substring(0, 8).toUpperCase(),
          date: formattedDate,
          createdAtTimestamp: data.createdAt,
          status: data.status || 'Unknown',
          grandTotal: data.grandTotal,
          userName: data.userName || 'Unknown User',
          paymentMethod: data.paymentMethod || 'Unknown',
          items: data.items || [],
          ...data
        };
      }).filter(item => item !== null);

      setAllFetchedOrders(fetchedOrders);
      setLoading(false);
      setRefreshing(false);

    }, (error) => {
      console.error("[OrderScreen Admin] Error listening to orders:", error);
      Alert.alert("Error", "Could not load orders in real-time.");
      setLoading(false);
      setRefreshing(false);
    });

    return listenerUnsubscribeRef.current;

  }, [refreshing, allFetchedOrders.length]);

  // --- Effect to Manage Listener Lifecycle ---
  useFocusEffect(
    useCallback(() => {
      const unsubscribe = setupOrderListener();
      return () => {
        if (unsubscribe) {
          console.log("[OrderScreen Admin] Cleaning up listener on blur/unmount.");
          unsubscribe();
          listenerUnsubscribeRef.current = null;
        }
      };
    }, [setupOrderListener])
  );


  // --- Client-Side Filtering Logic ---
  const filteredOrders = useMemo(() => {
    console.log(`Filtering ${allFetchedOrders.length} orders. Query: "${searchQuery}", Filter State: "${filter}"`);
    return allFetchedOrders.filter(order => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = (
           !searchQuery ||
           (order.id.toLowerCase().includes(searchLower)) ||
           (order.orderNumber.toLowerCase().includes(searchLower)) ||
           (order.userName?.toLowerCase().includes(searchLower)) ||
           (order.items?.[0]?.name?.toLowerCase().includes(searchLower))
       );

      const filterValueLower = filter.toLowerCase();
      const orderStatusLower = order.status?.toLowerCase();
      // Filter logic works for 'Delivered' just like other statuses
      const matchesFilter = (filter === 'All') || (orderStatusLower === filterValueLower);

      return matchesSearch && matchesFilter;
    });
  }, [allFetchedOrders, searchQuery, filter]);


  // --- Get Status Badge Style ---
  const getStatusStyle = (status) => {
      switch (status?.toLowerCase() ?? 'unknown') {
          case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': case 'unpaid (bnpl)': return styles.statusPending;
          case 'processing': case 'partially paid': return styles.statusProcessing;
          case 'shipped': return styles.statusShipped;
          case 'delivered': return styles.statusDelivered; // Ensure style exists for 'Delivered'
          case 'cancelled': case 'rejected': return styles.statusCancelled;
          default: return styles.statusUnknown;
      }
  };

  // --- Render Individual Order Item for FlatList ---
  const renderOrder = ({ item }) => {
    const firstItem = item?.items?.[0] || null;
    const firstItemImage = firstItem?.image || null;
    const imageSource = firstItemImage ? { uri: firstItemImage } : placeholderImagePath;
    const orderPaymentMethodLower = item.paymentMethod?.toLowerCase() ?? '';
    const isBnplOrder = ['bnpl', 'fixed duration', 'mixed'].includes(orderPaymentMethodLower);

    return (
        <TouchableOpacity
            style={styles.orderItem}
            onPress={() => navigation.navigate('AdminDetailOrderScreen', { order: item })}
            activeOpacity={0.7}
        >
          <View style={styles.orderRow}>
              <View style={styles.iconContainer}>
                 <Image source={imageSource} style={styles.previewImage} defaultSource={placeholderImagePath} onError={(e) => console.warn("Error loading product image:", firstItemImage, e.nativeEvent?.error)} />
              </View>
              <View style={styles.orderInfo}>
                <Text style={styles.orderName} numberOfLines={1}>{item.userName}</Text>
                <Text style={styles.orderIdText}>#{item.orderNumber}</Text>
                <Text style={styles.orderPrice}>
                    {CURRENCY_SYMBOL} {item.grandTotal?.toLocaleString(undefined, {maximumFractionDigits: 0}) || 'N/A'}
                </Text>
                {isBnplOrder && (
                    <View style={styles.bnplIndicatorContainer}>
                        <Icon name="credit-card-clock-outline" size={12} color={BnplIndicatorTextColor} style={styles.bnplIcon} />
                        <Text style={styles.bnplIndicatorText}>BNPL</Text>
                    </View>
                )}
              </View>
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
    setRefreshing(true);
    setupOrderListener();
    const refreshTimeout = setTimeout(() => {
        if (refreshing) {
            console.warn("[OrderScreen Admin] Refresh timeout reached.");
            setRefreshing(false);
        }
     }, 8000);
    return () => clearTimeout(refreshTimeout);
  }, [setupOrderListener, refreshing]);


  // --- Event Handlers for Header Elements ---
  const onSearchInputChange = (text) => { setSearchQuery(text); };
  const clearSearch = () => { setSearchQuery(''); };
  const onFilterChange = (newFilterValue) => {
      console.log("Filter changed to:", newFilterValue);
      setFilter(newFilterValue);
  };


  // --- Component Render ---
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={AccentColor} />

      {/* Header Section */}
      <View style={styles.headerContainer}>
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

          {/* Fixed Filter Buttons - Automatically includes "Completed" */}
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
      {loading && allFetchedOrders.length === 0 ? (
           <ActivityIndicator size="large" color={AccentColor} style={styles.loader} />
       ) : (
            <FlatList
                data={filteredOrders}
                keyExtractor={(item) => item.id}
                renderItem={renderOrder}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={!loading ? (
                    <View style={styles.emptyView}>
                        <Icon name="magnify-close" size={40} color="#ccc"/>
                        <Text style={styles.emptyText}>No orders match your criteria.</Text>
                    </View>
                 ) : null}
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
  listContent: { paddingBottom: 10, paddingTop: 0 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyView: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50, paddingHorizontal: 20, },
  emptyText: { textAlign: 'center', fontSize: 16, color: TextColorSecondary, marginTop: 15 },
  orderItem: { backgroundColor: '#FFF', paddingHorizontal: 15, paddingVertical: 12, },
  orderRow: { flexDirection: 'row', alignItems: 'center', },
  iconContainer: { width: 50, height: 50, borderRadius: 8, backgroundColor: PlaceholderBgColor, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden', },
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