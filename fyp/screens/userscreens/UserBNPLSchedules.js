// UserBNPLSchedules.js - FINAL COMPLETE CODE v12.1 - OrderScreen Style Indicator Applied (ListEmpty FIXED)
// Displays BNPL, Fixed Duration, and Mixed Orders FOR THE LOGGED-IN USER.
// Includes RED Header (#FF0000), Search, All/Active/Completed Filters.
// Items styled visually like OrderScreen.js with subtle text indicator (Installment/Fixed/Mixed).
// Date appears below Item Name. Indicator appears below Price.
// Navigates to SchedulesDetailScreen, passing the full order object.

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    StyleSheet, Text, View, FlatList, SafeAreaView,
    ActivityIndicator, TouchableOpacity, StatusBar, RefreshControl,
    Image, Platform, Alert, TextInput, ScrollView
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { MaterialIcons } from '@expo/vector-icons'; // Needed for error icon and optional date icon
import { db, auth } from '../../firebaseConfig'; // Verify path
import {
    collection, query, where, onSnapshot, Timestamp, orderBy
} from 'firebase/firestore';
import { format, isValid } from 'date-fns'; // Ensure 'date-fns' is installed

// --- Constants ---
const AppBackgroundColor = '#FFFFFF';
const ScreenBackgroundColor = '#F8F9FA';
const TextColorPrimary = '#212121';
const TextColorSecondary = '#6B7280';
const AccentColor = '#FF0000';
const HeaderIconColor = '#FFFFFF';
const PendingColor = '#FFA726';
const ProcessingColor = '#42A5F5';
const ShippedColor = '#66BB6A';
const DeliveredColor = '#78909C';
const ActiveColor = '#29B6F6';
const CancelledColor = '#EF5350';
const PaidColor = '#4CAF50';
const UnknownColor = '#BDBDBD';
const PlaceholderBgColor = '#F0F0F0';
const ItemSeparatorColor = '#EEEEEE';
const BnplIndicatorBgColor = 'rgba(0, 86, 179, 0.1)';
const BnplIndicatorTextColor = '#0056b3';
const ORDERS_COLLECTION = 'orders';
const CURRENCY_SYMBOL = 'PKR';
const BNPL_TYPE = 'BNPL';
const FIXED_TYPE = 'Fixed Duration';
const MIXED_TYPE = 'Mixed';
const INSTALLMENT_LABEL = 'Installment';
const PAID_STATUS = 'Paid';
const ACTIVE_ORDER_STATUS = 'Active';
const DELIVERED_ORDER_STATUS = 'Delivered';
const SCHEDULE_PAYMENT_METHODS = [BNPL_TYPE, FIXED_TYPE, MIXED_TYPE];
const SCHEDULE_PAYMENT_METHODS_LOWER = SCHEDULE_PAYMENT_METHODS.map(m => m.toLowerCase());
const DETAIL_SCREEN_ROUTE_NAME = 'SchedulesDetailScreen';
const placeholderImagePath = require('../../assets/p3.jpg');
const ACTIVE_SCHEDULE_STATUSES = [ACTIVE_ORDER_STATUS.toLowerCase()];
const COMPLETED_SCHEDULE_STATUSES = [DELIVERED_ORDER_STATUS.toLowerCase(), PAID_STATUS.toLowerCase()];
const SCHEDULE_FILTERS = [
  { displayName: 'All', filterValue: 'All' },
  { displayName: 'Active', filterValue: 'Active' },
  { displayName: 'Completed', filterValue: 'Completed' },
];

// --- Helper Functions ---
const formatShortDate = (timestamp) => {
    let dateToFormat = null;
    if (timestamp instanceof Timestamp) { dateToFormat = timestamp.toDate(); }
    else if (timestamp instanceof Date) { dateToFormat = timestamp; }
    else if (timestamp && typeof timestamp.toDate === 'function') { try { dateToFormat = timestamp.toDate(); } catch (e) {} }
    if (dateToFormat && isValid(dateToFormat)) { try { return format(dateToFormat, 'MMM d, yyyy'); } catch (e) { return 'Invalid Date'; }}
    return 'N/A';
};

const getStatusStyle = (status) => {
    const lowerStatus = status?.toLowerCase() || 'unknown';
    switch (lowerStatus) {
        case 'pending': case 'unpaid (cod)': case 'unpaid (fixed duration)': case 'unpaid (bnpl)': return styles.statusPending;
        case 'processing': case 'partially paid': return styles.statusProcessing;
        case 'shipped': return styles.statusShipped;
        case 'delivered': case 'completed': return styles.statusDelivered;
        case ACTIVE_ORDER_STATUS.toLowerCase(): return styles.statusActive;
        case 'cancelled': case 'rejected': return styles.statusCancelled;
        case PAID_STATUS.toLowerCase(): return styles.statusPaid;
        default: return styles.statusUnknown;
    }
};
// getPaymentMethodStyle is removed

// --- Main Component ---
export default function UserBNPLSchedules() {
    // --- State and Hooks ---
    const navigation = useNavigation();
    const [scheduleOrders, setScheduleOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);
    const [dbError, setDbError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const listenerUnsubscribeRef = useRef(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('All');

    // --- Effects and Callbacks (Remain the same) ---
    useEffect(() => { // Auth Listener
        const unsubscribeAuth = auth.onAuthStateChanged(user => {
            const currentUid = user ? user.uid : null;
            if (currentUid !== userId) {
                setUserId(currentUid); setScheduleOrders([]); setDbError(null);
                setSearchQuery(''); setFilter('All');
                if (!currentUid) { setLoading(false); setRefreshing(false); if (listenerUnsubscribeRef.current) { listenerUnsubscribeRef.current(); listenerUnsubscribeRef.current = null; } }
                else { if (scheduleOrders.length === 0) setLoading(true); }
            }
        });
        return () => { unsubscribeAuth(); };
    }, [userId, scheduleOrders.length]);

    const setupScheduleListener = useCallback(() => { // Firestore Listener
         if (!userId) { setScheduleOrders([]); setLoading(false); setRefreshing(false); setDbError(null); if (listenerUnsubscribeRef.current) { listenerUnsubscribeRef.current(); listenerUnsubscribeRef.current = null; } return; }
         if (listenerUnsubscribeRef.current) { listenerUnsubscribeRef.current(); listenerUnsubscribeRef.current = null; }
         if (!refreshing && scheduleOrders.length === 0) setLoading(true);
         setDbError(null);
         const ordersRef = collection(db, ORDERS_COLLECTION);
         const q = query( ordersRef, where("userId", "==", userId), where("paymentMethod", "in", SCHEDULE_PAYMENT_METHODS), orderBy('createdAt', 'desc') );
         const unsubscribe = onSnapshot(q, (snapshot) => {
              let fetchedOrders = snapshot.docs.map(docSnap => {
                  const data = docSnap.data();
                  if (!data || !(data.createdAt instanceof Timestamp)) { return null; }
                  const paymentMethodLower = data.paymentMethod?.toLowerCase() ?? '';
                  const isScheduledPayment = SCHEDULE_PAYMENT_METHODS_LOWER.includes(paymentMethodLower);
                  let formattedDate = 'N/A';
                  const createdAtDate = data.createdAt.toDate();
                  if (isValid(createdAtDate)) { formattedDate = format(createdAtDate, 'MMM d, yyyy'); }
                  return {
                     id: docSnap.id, orderNumber: docSnap.id.substring(0, 8).toUpperCase(), date: formattedDate,
                     createdAtTimestamp: data.createdAt, status: data.status || 'Unknown', isScheduledPayment: isScheduledPayment,
                     grandTotal: data.grandTotal, items: data.items || [], paymentMethod: data.paymentMethod || 'Unknown', ...data
                  };
              }).filter(item => item !== null);
              setScheduleOrders(fetchedOrders); setLoading(false); setRefreshing(false); setDbError(null);
          }, (error) => {
              setLoading(false); setRefreshing(false); setScheduleOrders([]);
              if (error.code === 'failed-precondition') { const errorMsg = "Database Index Required. Ask admin."; setDbError(errorMsg); Alert.alert("Config Error", errorMsg); }
              else { const errorMsg = "Could not fetch schedules."; setDbError(errorMsg); Alert.alert("Fetch Error", errorMsg); console.error("[UserBNPLSchedules] Listener error:", error); }
          });
         listenerUnsubscribeRef.current = unsubscribe;
    }, [userId, refreshing, scheduleOrders.length]);

    useFocusEffect(useCallback(() => { // Listener Lifecycle
        setupScheduleListener();
        return () => { if (listenerUnsubscribeRef.current) { listenerUnsubscribeRef.current(); listenerUnsubscribeRef.current = null; } };
    }, [setupScheduleListener]));

    const filteredOrders = useMemo(() => { // Filtering Logic
         return scheduleOrders.filter(order => {
             const searchLower = searchQuery.toLowerCase();
             const matchesSearch = ( !searchQuery || (order.id.toLowerCase().includes(searchLower)) || (order.orderNumber?.toLowerCase().includes(searchLower)) || (order.items?.[0]?.name?.toLowerCase().includes(searchLower)) );
             const filterValue = filter; const orderStatusLower = order.status?.toLowerCase(); let matchesFilter = false;
             if (filterValue === 'All') { matchesFilter = true; }
             else if (filterValue === 'Active') { matchesFilter = ACTIVE_SCHEDULE_STATUSES.includes(orderStatusLower); }
             else if (filterValue === 'Completed') { matchesFilter = COMPLETED_SCHEDULE_STATUSES.includes(orderStatusLower); }
             return matchesSearch && matchesFilter;
         });
    }, [scheduleOrders, searchQuery, filter]);

    // --- Handlers (Remain the same) ---
    const onRefresh = useCallback(() => { if (!userId) { setRefreshing(false); return; } setRefreshing(true); setupScheduleListener(); const t = setTimeout(() => { if (refreshing) setRefreshing(false); }, 8000); return () => clearTimeout(t); }, [userId, refreshing, setupScheduleListener]);
    const handleOrderPress = (orderItem) => { if (!orderItem?.id) { return; } navigation.navigate(DETAIL_SCREEN_ROUTE_NAME, { order: orderItem }); };
    const handleGoBack = () => { navigation.goBack(); };
    const onSearchInputChange = (text) => { setSearchQuery(text); };
    const clearSearch = () => { setSearchQuery(''); };
    const onFilterChange = (newFilterValue) => { setFilter(newFilterValue); };

    // --- Render Item Function (OrderScreen Style Indicator) ---
    const renderOrderItem = ({ item }) => {
        const firstItem = item?.items?.[0] || null;
        const previewImageUri = firstItem?.image || null;
        const previewName = firstItem?.name || 'Order Item(s)';
        const additionalItemsText = item?.items?.length > 1 ? ` (+${item.items.length - 1})` : '';
        if (!item || !item.id) return null;
        return (
             <TouchableOpacity style={styles.orderContainer} onPress={() => handleOrderPress(item)} activeOpacity={0.7} >
                 <View style={styles.orderRow}>
                     <Image source={previewImageUri ? { uri: previewImageUri } : placeholderImagePath} style={styles.previewImage} defaultSource={placeholderImagePath} />
                     <View style={styles.middleContent}>
                         <Text style={styles.itemNameText} numberOfLines={1}> {previewName}{additionalItemsText} </Text>
                         <Text style={styles.orderDateTextSmall}>{item.date || 'N/A'}</Text>
                         {item.isScheduledPayment && (
                             <View style={styles.bnplIndicatorContainer}>
                                 <Icon name="credit-card-clock-outline" size={12} color={BnplIndicatorTextColor} style={styles.bnplIcon} />
                                 <Text style={styles.bnplIndicatorText} numberOfLines={1}>
                                     {item.paymentMethod === BNPL_TYPE ? INSTALLMENT_LABEL : item.paymentMethod}
                                 </Text>
                                 
                             </View>
                             
                         )}
                                                  <Text style={styles.orderTotalText}> Total: {CURRENCY_SYMBOL} {item.grandTotal?.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}) || 'N/A'} </Text>

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

    // --- Separator ---
    const renderSeparator = () => <View style={styles.separator} />;

    // --- Loading State ---
    if (loading && filteredOrders.length === 0 && !refreshing) {
        return (
            <SafeAreaView style={styles.centeredContainer}>
                <StatusBar barStyle="light-content" backgroundColor={AccentColor} />
                <ActivityIndicator size="large" color={AccentColor} />
                <Text style={styles.loadingText}>Loading Schedules...</Text>
            </SafeAreaView>
        );
     }

    // --- Main Render ---
    return (
        <SafeAreaView style={styles.container}>
             <StatusBar barStyle="light-content" backgroundColor={AccentColor} />
             {/* Header */}
             <View style={styles.headerContainer}>
                   <View style={styles.headerTopRow}>
                      <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
                          <Icon name="arrow-left" size={24} color={HeaderIconColor} />
                      </TouchableOpacity>
                      <View style={styles.searchBar}>
                          <Icon name="magnify" size={20} color={AccentColor} style={styles.searchIcon} />
                          <TextInput style={styles.searchInput} placeholder="Search Product or Order ID..." placeholderTextColor="#888" value={searchQuery} onChangeText={onSearchInputChange} returnKeyType="search" autoCapitalize="none" autoCorrect={false}/>
                          {searchQuery.length > 0 && ( <TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}><Icon name="close-circle" size={18} color={AccentColor} /></TouchableOpacity> )}
                      </View>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                      {SCHEDULE_FILTERS.map(filterItem => (
                          <TouchableOpacity key={filterItem.filterValue} style={[ styles.filterButton, filter === filterItem.filterValue && styles.activeFilter ]} onPress={() => onFilterChange(filterItem.filterValue)} >
                              <Text style={[ styles.filterText, filter === filterItem.filterValue && styles.activeFilterText ]}>{filterItem.displayName}</Text>
                          </TouchableOpacity>
                      ))}
                  </ScrollView>
              </View>
             {/* Error Banner */}
             {dbError && !loading && scheduleOrders.length > 0 && ( <View style={styles.errorBanner}><Text style={styles.errorBannerText}>⚠️ {dbError}</Text></View> )}
             {/* List */}
             <FlatList
                data={filteredOrders}
                renderItem={renderOrderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[styles.flatListContainer, filteredOrders.length === 0 && styles.emptyListContainer]}
                // *** CORRECTED ListEmptyComponent ***
                ListEmptyComponent={
                   !loading && ( // Only show if not actively loading initial data
                       userId ? ( // Check if user is logged in
                           dbError ? ( // Check if there was a database error
                               <View style={styles.emptyView}>
                                   <MaterialIcons name="error-outline" size={60} color={CancelledColor} />
                                   <Text style={styles.errorText}>{dbError}</Text>
                                   {(dbError !== "Database Index Required. Ask admin." &&
                                    dbError !== "Database Index Required (userId ASC, paymentMethod ASC, createdAt DESC). Ask admin.") && ( // Check both possible messages
                                       <TouchableOpacity onPress={setupScheduleListener} style={styles.retryButton}>
                                           <Text style={styles.retryButtonText}>Retry</Text>
                                       </TouchableOpacity>
                                   )}
                               </View>
                           )
                           : ( // No DB error, check if list is empty due to filters or genuinely empty
                               <View style={styles.emptyView}>
                                   <Icon name={searchQuery || filter !== 'All' ? "filter-variant-remove" : "credit-card-off-outline"} size={50} color="#ccc"/>
                                   <Text style={styles.emptyText}>
                                       {searchQuery || filter !== 'All' ? "No schedules match criteria." : "No payment schedules found."}
                                   </Text>
                                   {scheduleOrders.length > 0 && (searchQuery || filter !== 'All') && (
                                       <Text style={styles.emptyDetailText}>(Found {scheduleOrders.length} total)</Text>
                                   )}
                               </View>
                           )
                       ) : ( // User is not logged in
                           <View style={styles.emptyView}>
                               <Icon name="login" size={50} color="#ccc"/>
                               <Text style={styles.emptyText}>Please log in to view schedules.</Text>
                           </View>
                       )
                   )
                } // End ListEmptyComponent
                // *** END CORRECTION ***
                refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[AccentColor]} tintColor={AccentColor} /> }
                ItemSeparatorComponent={renderSeparator}
            />
        </SafeAreaView>
    );
}

// --- Styles (OrderScreen Layout + Indicator Styles) ---
const styles = StyleSheet.create({
    // (Styles remain the same as v12)
    container: { flex: 1, backgroundColor: ScreenBackgroundColor },
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: ScreenBackgroundColor },
    loadingText: { marginTop: 10, color: TextColorSecondary, fontSize: 14, },
    errorText: { color: CancelledColor, fontSize: 16, textAlign: 'center', marginTop: 15, lineHeight: 22 },
    retryButton: { backgroundColor: AccentColor, paddingVertical: 10, paddingHorizontal: 25, borderRadius: 6, marginTop: 20 },
    retryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' },
    errorBanner: { backgroundColor: '#FFF3E0', paddingVertical: 8, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#FFCC80' },
    errorBannerText: { color: '#E65100', fontSize: 13, textAlign: 'center' },
    headerContainer: { backgroundColor: AccentColor, paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: 10, paddingHorizontal: 10, borderBottomLeftRadius: 15, borderBottomRightRadius: 15, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, marginBottom: 5, },
    headerTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingHorizontal: 5, },
    backButton: { padding: 6, marginRight: 6, },
    searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 50, paddingHorizontal: 13, height: 40, },
    searchIcon: { marginRight: 8, color: AccentColor },
    searchInput: { flex: 1, fontSize: 14, color: '#333', },
    clearSearchButton: { padding: 4, marginLeft: 4, },
    filterScroll: { paddingLeft:10 },
    filterButton: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, backgroundColor: AccentColor, borderWidth: 1, borderColor: '#FFFFFF', marginRight: 10, justifyContent: 'center', alignItems: 'center', height: 32, },
    filterText: { fontSize: 13, color: '#FFFFFF', fontWeight: '500', },
    activeFilter: { backgroundColor: '#000000', borderColor: '#000000', },
    activeFilterText: { color: '#FFFFFF', fontWeight: 'bold', },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center', },
    emptyView: { alignItems: 'center', paddingBottom: 50, },
    emptyText: { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 15 },
    emptyDetailText: { fontSize: 12, color: TextColorSecondary, marginTop: 5, },
    orderContainer: { backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 15, },
    orderRow: { flexDirection: 'row', alignItems: 'center', },
    previewImage: { width: 60, height: 60, borderRadius: 8, marginRight: 12, backgroundColor: PlaceholderBgColor, },
    middleContent: { flex: 1, justifyContent: 'center', marginRight: 8, },
    itemNameText: { fontSize: 14, fontWeight: '600', color: TextColorPrimary, marginBottom: 3, },
    orderDateTextSmall: { fontSize: 11, color: TextColorSecondary, marginBottom: 5, },
    orderTotalText: { fontSize: 14, color: TextColorPrimary, fontWeight: 'bold', marginBottom: 5, },
    bnplIndicatorContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 0, alignSelf: 'flex-start', backgroundColor: BnplIndicatorBgColor, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, maxWidth: '90%' },
    bnplIcon: { marginRight: 4, },
    bnplIndicatorText: { fontSize: 11, fontWeight: '600', color: BnplIndicatorTextColor, flexShrink: 1 },
    rightContent: { alignItems: 'flex-end', justifyContent: 'center', minWidth: 80, },
    statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, },
    statusText: { fontSize: 11, fontWeight: 'bold', color: '#fff', textAlign: 'center', },
    flatListContainer: { paddingBottom: 10, },
    emptyListContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    separator: { height: 1, backgroundColor: ItemSeparatorColor, },
    statusPending: { backgroundColor: PendingColor }, statusProcessing: { backgroundColor: ProcessingColor }, statusShipped: { backgroundColor: ShippedColor }, statusDelivered: { backgroundColor: DeliveredColor }, statusActive: { backgroundColor: ActiveColor }, statusCancelled: { backgroundColor: CancelledColor }, statusPaid: { backgroundColor: PaidColor }, statusUnknown: { backgroundColor: UnknownColor },
});